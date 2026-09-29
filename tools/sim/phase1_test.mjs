import { store, stats, resetStats, setFailQueriesMatching } from './db.js';
import { fetchClassLogs, fetchClassLogsForDate, fetchDailyLogs } from './attendance.js';
import * as Data from './data.js';
import { recalcTMIForStudent } from './tmiEngine.js';

function t(name, cond, detail) { console.log((cond?"PASS":"FAIL")+" - "+name+(detail?" :: "+detail:"")); if(!cond) process.exitCode=1; }
function reset(){ for (const k in store) store[k]=[]; resetStats(); setFailQueriesMatching(null); Data.invalidate('staff'); Data.invalidate('schoolCalendar'); }

// ── attendance.js: scoped read, mixed date fields, teacher + codes ──
reset();
store.attendanceEvents.push(
  { id:'a', studentId:'s1', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'U' },
  { id:'b', studentId:'s2', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'T', learningLab:true },   // learning-lab style
  { id:'c', studentId:'s3', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'P' },
  { id:'d', studentId:'s4', teacherLastName:'Hale',   date:'2026-09-10', attendanceCode:'U' },
  { id:'e', studentId:'s5', teacherLastName:'Jaynes', date:'2026-09-01', attendanceCode:'U' },
);
{
  const r = await fetchClassLogsForDate('2026-09-10', { teacherLastName:'Jaynes' });
  t("teacher+date returns regular and lab records, this teacher only", r.map(x=>x.id).sort().join()==='a,b,c', JSON.stringify(r.map(x=>x.id)));
  const r2 = await fetchClassLogs({ start:'2026-09-01', end:'2026-09-30', teacherLastName:'Jaynes', codes:['T','U','E'] });
  t("range + teacher + codes excludes P and other teachers", r2.map(x=>x.id).sort().join()==='a,b,e', JSON.stringify(r2.map(x=>x.id)));
}

// ── fallback: composite index missing for code filter → still correct ──
reset();
store.attendanceEvents.push(
  { id:'a', studentId:'s1', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'U' },
  { id:'c', studentId:'s3', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'P' },
  { id:'d', studentId:'s4', teacherLastName:'Hale',   date:'2026-09-10', attendanceCode:'U' },
);
setFailQueriesMatching((c, conds) => conds.some(x => x[0]==='attendanceCode' || x[0]==='teacherLastName'));
{
  const r = await fetchClassLogs({ start:'2026-09-10', end:'2026-09-10', teacherLastName:'Jaynes', codes:['T','U','E'] });
  t("missing composite index → date-only fallback + client filter gives identical result", r.map(x=>x.id).join()==='a', JSON.stringify(r.map(x=>x.id)));
  t("fallback never used a full getAll", stats.getAll===0, `getAll=${stats.getAll}`);
}

// ── fallback level 3: even range fails → full scan, still correct ──
reset();
store.attendanceEvents.push({ id:'a', studentId:'s1', teacherLastName:'Jaynes', date:'2026-09-10', attendanceCode:'U' },{ id:'z', studentId:'s9', teacherLastName:'Jaynes', date:'2026-08-01', attendanceCode:'U' });
setFailQueriesMatching(() => true);
{
  const r = await fetchClassLogs({ start:'2026-09-01', end:'2026-09-30', teacherLastName:'Jaynes' });
  t("total query failure → full scan fallback still filters correctly", r.map(x=>x.id).join()==='a' && stats.getAll===1);
}

// ── dailyAttendanceLogs: absenceDate vs date ──
reset();
store.dailyAttendanceLogs.push({ id:'d1', studentId:'s1', absenceDate:'2026-09-10' },{ id:'d2', studentId:'s2', date:'2026-09-10' },{ id:'d3', studentId:'s3', absenceDate:'2026-09-11' });
{
  const r = await fetchDailyLogs({ start:'2026-09-10', end:'2026-09-10' });
  t("daily logs found under either date field", r.map(x=>x.id).sort().join()==='d1,d2');
}

// ── data.js: one versions read, then cache; bump invalidates ──
reset();
store.staff.push({ id:'st1', firstName:'Erin', lastName:'Jaynes' });
store.meta.push({ id:'versions', staff:'v1' });
{
  const a = await Data.staff();
  const readsAfterFirst = stats.reads;
  const b = await Data.staff();
  t("second Data.staff() served from cache (no extra reads)", stats.reads===readsAfterFirst && b.length===1, `reads=${stats.reads}`);
  store.staff.push({ id:'st2', firstName:'Vince', lastName:'Hale' });
  await Data.bump('staff');
  const c = await Data.staff();
  t("bump() forces refetch and sees the new record", c.length===2);
  // Writing through db.js must invalidate automatically — no page bookkeeping
  const { addDoc } = await import('./db.js');
  await addDoc('staff', { firstName:'Anna', lastName:'Wineland' });
  const d = await Data.staff();
  t("a db.js write invalidates the cache automatically (no explicit bump)", d.length===3, `len=${d.length}`);
  t("write stamped meta/versions", stats.stampWrites>=2, `stampWrites=${stats.stampWrites}`);
  d.push({ id:'fake' });
  const e = await Data.staff();
  t("callers get a copy — local mutation doesn't leak into the cache", e.length===3);
}

// ── tmiEngine batch cache: shared period query, cross-student visibility ──
reset();
store.attendanceEvents.push(
  { id:'l1', studentId:'sA', chattStateANumber:'A', date:'2026-09-09', attendanceCode:'U', teacherLastName:'Jaynes' },
  { id:'l2', studentId:'sB', chattStateANumber:'B', date:'2026-09-09', attendanceCode:'U', teacherLastName:'Jaynes' },
);
{
  const cache = {};
  const base = { dateStr:'2026-09-09', assignedBy:'Admin', cache };
  await recalcTMIForStudent({ ...base, studentId:'sA', chattStateANumber:'A', studentName:'A, Stu' });
  const queriesAfterFirst = stats.query;
  await recalcTMIForStudent({ ...base, studentId:'sB', chattStateANumber:'B', studentName:'B, Stu' });
  const periodQueriesSecond = stats.query - queriesAfterFirst;
  // Second student issues its own log queries (2 identities × 1 date field = 2)
  // plus ONE scoped check for an existing custom-range record covering this
  // date — that check only happens when a record is about to be created, and
  // is scoped to the single student, not the whole collection.
  t("batch cache: 2nd student costs its own log queries + one overlap check", periodQueriesSecond===3, `queries for 2nd=${periodQueriesSecond}`);
  // Same student twice in one batch (two sections) must not create a duplicate,
  // and must not repeat the overlap check either — the record already exists.
  const beforeThird = stats.query;
  const r = await recalcTMIForStudent({ ...base, studentId:'sA', chattStateANumber:'A', studentName:'A, Stu' });
  t("a student who already has a record costs no overlap check", stats.query - beforeThird <= 2, `queries=${stats.query - beforeThird}`);
  t("same student again in batch → 'none', no duplicate", r.action==='none' && store.interventionLogs.filter(i=>i.studentId==='sA').length===1, JSON.stringify(r));
  t("both students have exactly one TMI record", store.interventionLogs.length===2);
}

// ── engine delete within batch is visible to later calls ──
reset();
store.interventionLogs.push({ id:'tmi_sC_week__2026-09-09__2026-09-15', studentId:'sC', chattStateANumber:'C', interventionType:'TMI', tmiPeriodKey:'week__2026-09-09__2026-09-15', startDate:'2026-09-09', tmiMinutes:120, tmiMinutesServed:0 });
{
  const cache = {};
  const r1 = await recalcTMIForStudent({ studentId:'sC', chattStateANumber:'C', dateStr:'2026-09-09', assignedBy:'Admin', cache });
  t("no logs → record deleted", r1.action==='deleted');
  const r2 = await recalcTMIForStudent({ studentId:'sC', chattStateANumber:'C', dateStr:'2026-09-09', assignedBy:'Admin', cache });
  t("second call in same batch does not see the deleted record", r2.action==='none', JSON.stringify(r2));
}
console.log("Done.");
