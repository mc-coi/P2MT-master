import { store, stats, getAllBy, resetStats, setFailQueriesMatching } from './db.js';
import { eventId, sessionId, sectionKey, saveSectionAttendance, saveEvent, fetchClassLogs, fetchClassLogsForDate, fetchSessions, fetchLogsInWindow } from './attendance.js';
import * as Data from './data.js';
import { recalcTMIForStudent, recalcTMIForWindow, migrateTMIRecords, tmiDocId, computeTMI } from './tmiEngine.js';

let fails = 0;
function t(name, cond, detail) { console.log((cond ? "PASS" : "FAIL") + " - " + name + (detail ? " :: " + detail : "")); if (!cond) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); setFailQueriesMatching(null); Data.invalidate('staff'); Data.invalidate('schoolCalendar'); }

const S = (id, a, ln, fn) => ({ id, chattStateANumber: a, lastName: ln, firstName: fn });
const sec = { date: '2026-09-14', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', learningLab: false, classScheduleId: 'cs1' };
const roster = (codes) => codes.map(([st, code, tmi]) => ({ student: st, code, comment: '', tmi: !!tmi }));
const sA = S('sA', 'A1', 'Adams', 'Ann'), sB = S('sB', 'A2', 'Baker', 'Bo'), sC = S('sC', 'A3', 'Cole', 'Cy');

// ── IDs are deterministic and normalised ──
{
  const a = eventId({ date: '2026-09-14', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', studentId: 'sA' });
  const b = eventId({ classDate: '2026-09-14', teacherLastName: ' jaynes ', className: 'algebra  i', startTime: '09:30', studentId: 'sA' });
  t("same section typed differently → same event id", a === b, `${a} vs ${b}`);
  const lab = eventId({ date: '2026-09-14', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', studentId: 'sA', learningLab: true });
  t("lab section gets a distinct id", lab !== a);
  t("no '/' in ids", !a.includes('/') && !sessionId(sec).includes('/'));
  const tid = tmiDocId({ studentId: 'sA' }, 'week__2026-09-14__2026-09-20');
  t("tmi id does not start+end with __", !/^__.*__$/.test(tid), tid);
}

// ── Save a section: exceptions only, 0 reads, one batch ──
reset();
{
  const r = await saveSectionAttendance({ section: sec, roster: roster([[sA, 'P'], [sB, 'U'], [sC, 'T']]), previous: new Map(), savedBy: { uid: 'u1', name: 'Erin Jaynes' } });
  t("save reads nothing", stats.reads === 0, `reads=${stats.reads}`);
  t("one batch commit", stats.batches === 1, `batches=${stats.batches}`);
  t("only exceptions stored (2 of 3)", store.attendanceEvents.length === 2, JSON.stringify(store.attendanceEvents.map(e => e.attendanceCode)));
  t("session doc written with roster/exception counts", store.attendanceSessions.length === 1 && store.attendanceSessions[0].rosterCount === 3 && store.attendanceSessions[0].exceptionCount === 2);
  t("changed list = the two exceptions", r.changed.map(c => c.student.id).sort().join() === 'sB,sC');

  // Re-save identical → idempotent, nothing changed
  const prev = new Map(r.events.map(e => [e.studentId, e]));
  const r2 = await saveSectionAttendance({ section: sec, roster: roster([[sA, 'P'], [sB, 'U'], [sC, 'T']]), previous: prev, savedBy: { uid: 'u1' } });
  t("re-save is idempotent: still 2 events, 1 session", store.attendanceEvents.length === 2 && store.attendanceSessions.length === 1);
  t("re-save reports no changes", r2.changed.length === 0);

  // Mark sB back to present, sA now tardy
  const prev2 = new Map(r2.events.map(e => [e.studentId, e]));
  const r3 = await saveSectionAttendance({ section: sec, roster: roster([[sA, 'T'], [sB, 'P'], [sC, 'T']]), previous: prev2, savedBy: { uid: 'u1' } });
  t("present → event deleted; new tardy → event added", store.attendanceEvents.map(e => e.studentId).sort().join() === 'sA,sC', JSON.stringify(store.attendanceEvents.map(e => e.studentId)));
  t("changed = sA and sB", r3.changed.map(c => c.student.id).sort().join() === 'sA,sB');
  t("deleted ids reported", r3.deletedIds.length === 1);

  // Two tabs save the same section → no duplicates
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'T'], [sB, 'P'], [sC, 'T']]), previous: new Map(), savedBy: { uid: 'u2' } });
  t("concurrent save of same section cannot duplicate", store.attendanceEvents.length === 2);

  // Reads for this teacher/day
  resetStats();
  const loaded = await fetchClassLogsForDate('2026-09-14', { teacherLastName: 'Jaynes' });
  t("teacher/day load returns just the exceptions", loaded.length === 2 && stats.reads === 2, `reads=${stats.reads}`);
  const sess = await fetchSessions({ start: '2026-09-14', end: '2026-09-14' });
  t("sessions readable by date", sess.length === 1 && sess[0].sectionKey === sectionKey(sec));
}

// ── Override flag alone keeps an event ──
reset();
{
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'P', true]]), previous: new Map(), savedBy: {} });
  t("assignTmi on a Present student is stored as an event", store.attendanceEvents.length === 1 && store.attendanceEvents[0].assignTmi === true && store.attendanceEvents[0].attendanceCode === 'P');
}

// ── saveEvent (single record paths: Daily Attendance, Dress Code, ER) ──
reset();
{
  const id = await saveEvent({ studentName: 'Doe, Jo', chattStateANumber: 'A9', classDate: '2026-09-15', attendanceCode: 'U', className: '', teacherLastName: '' });
  t("record with only A# and classDate stored under `date`", id && store.attendanceEvents[0].date === '2026-09-15' && !('classDate' in store.attendanceEvents[0]));
  // Edit: move date → old doc removed, new one created
  const id2 = await saveEvent({ ...store.attendanceEvents[0], date: '2026-09-16' }, { prevId: id });
  t("editing the date moves the doc (no leftover)", id2 !== id && store.attendanceEvents.length === 1 && store.attendanceEvents[0].date === '2026-09-16');
  // Edit to Present → removed
  const id3 = await saveEvent({ ...store.attendanceEvents[0], attendanceCode: 'P' }, { prevId: id2 });
  t("editing to P deletes the event", id3 === null && store.attendanceEvents.length === 0);
}

// ── TMI engine: addressed record, batch cache, minimal reads ──
reset();
store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
{
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'U'], [sB, 'U']]), previous: new Map(), savedBy: {} });
  resetStats();
  const cache = {};
  const r1 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann', dateStr: '2026-09-14', assignedBy: 'Admin', cache });
  t("U → TMI created at deterministic id", r1.action === 'created' && r1.minutes === 120 && store.interventionLogs[0].id === tmiDocId({ studentId: 'sA' }, 'week__2026-09-09__2026-09-15'), JSON.stringify(r1));
  t("assigned by resolved from the log's teacher", store.interventionLogs[0].assignedBy === 'Erin Jaynes', store.interventionLogs[0].assignedBy);
  // reads: 1 getById + 2 identity queries (1 doc each) = 3 ; plus staff (1) and versions (1)... all cached via Data except first.
  const readsFirst = stats.reads;
  const r2 = await recalcTMIForStudent({ studentId: 'sB', chattStateANumber: 'A2', studentName: 'Baker, Bo', dateStr: '2026-09-14', assignedBy: 'Admin', cache });
  const readsSecond = stats.reads - readsFirst;
  t("second student in batch: only its own doc + logs read", readsSecond <= 3, `reads for 2nd=${readsSecond}`);
  // Same student again → none, no dup
  const r3 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-14', assignedBy: 'Admin', cache });
  t("same student twice → 'none', still one record", r3.action === 'none' && store.interventionLogs.filter(i => i.studentId === 'sA').length === 1);
  // Two U's same week from a second class → 240
  const sec2 = { ...sec, className: 'Biology', startTime: '11:00', date: '2026-09-15' };
  await saveSectionAttendance({ section: sec2, roster: roster([[sA, 'U']]), previous: new Map(), savedBy: {} });
  const r4 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-15', assignedBy: 'Admin' });
  t("second U → updated to 240", r4.action === 'updated' && r4.minutes === 240, JSON.stringify(r4));
  // Clear both → deleted
  store.attendanceEvents = [];
  const r5 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-15', assignedBy: 'Admin' });
  t("no exceptions left → TMI deleted", r5.action === 'deleted' && store.interventionLogs.filter(i => i.studentId === 'sA').length === 0);
  // 3 tardies = 90; 4 tardies still 90; served minutes preserved
  const days = ['2026-09-16', '2026-09-17', '2026-09-18'];   // all inside the Wed–Tue week of Sep 16
  for (const d of days) await saveSectionAttendance({ section: { ...sec, date: d }, roster: roster([[sC, 'T']]), previous: new Map(), savedBy: {} });
  const r6 = await recalcTMIForStudent({ studentId: 'sC', chattStateANumber: 'A3', dateStr: '2026-09-18', assignedBy: 'Admin' });
  t("3 tardies → 90 min", r6.action === 'created' && r6.minutes === 90, JSON.stringify(r6));
  const rec = store.interventionLogs.find(i => i.studentId === 'sC'); rec.tmiMinutesServed = 30;
  store.attendanceEvents = store.attendanceEvents.filter(e => !(e.studentId === 'sC' && e.date === '2026-09-18'));
  const r7 = await recalcTMIForStudent({ studentId: 'sC', chattStateANumber: 'A3', dateStr: '2026-09-18', assignedBy: 'Admin' });
  t("served minutes keep the record alive at 0 owed", r7.action === 'updated' && rec.tmiMinutes === 0 && rec.tmiMinutesRemaining === 0);
}

// ── Legacy record (random id) gets moved to its deterministic id on touch ──
reset();
{
  store.interventionLogs.push({ id: 'rand1', studentId: 'sA', chattStateANumber: 'A1', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-09__2026-09-15', startDate: '2026-09-09', tmiMinutes: 120, tmiMinutesServed: 0, assignedBy: 'X' });
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'U']]), previous: new Map(), savedBy: {} });
  // engine can't see rand1 by id → would create a duplicate. Migration fixes this:
  const m = await migrateTMIRecords();
  t("migration moves legacy record to deterministic id", m.moved === 1 && store.interventionLogs.length === 1 && store.interventionLogs[0].id === tmiDocId({ studentId: 'sA' }, 'week__2026-09-09__2026-09-15'));
  const r = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-14', assignedBy: 'Admin' });
  // The engine finds the migrated record rather than creating a second one.
  // It does rewrite Assigned By: the fixture's record says 'X' while the
  // absence behind it names Jaynes, and the logs are the source of truth.
  t("after migration engine finds it — no duplicate", store.interventionLogs.length === 1 && r.action !== 'created', JSON.stringify(r));
  t("and corrects Assigned By from the absence behind it",
    r.assignedByChanged && r.assignedByChanged.from === 'X' && r.assignedByChanged.to === 'Jaynes', JSON.stringify(r.assignedByChanged));
  const m2 = await migrateTMIRecords();
  t("migration is idempotent", m2.moved === 0 && m2.untouched === 1);
}

// ── Migration merges overlapping duplicates, sums served ──
reset();
{
  store.interventionLogs.push(
    { id: 'r1', studentId: 'sB', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-07__2026-09-13', startDate: '2026-09-07', tmiMinutes: 120, tmiMinutesServed: 60, createDate: '2026-09-08' },
    { id: 'r2', studentId: 'sB', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-07__2026-09-13', startDate: '2026-09-07', tmiMinutes: 120, tmiMinutesServed: 30, createDate: '2026-09-09' },
    { id: 'r3', studentId: 'sB', interventionType: 'TMI', tmiPeriodKey: 'range__2026-09-10__2026-09-16', startDate: '2026-09-10', tmiMinutes: 240, tmiMinutesServed: 0, createDate: '2026-09-11' },
    { id: 'r4', studentId: 'sB', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-21__2026-09-27', startDate: '2026-09-21', tmiMinutes: 120, tmiMinutesServed: 0 },
    { id: 'manual', studentId: 'sB', interventionType: 'TMI', tmiMinutes: 60 },
  );
  const m = await migrateTMIRecords();
  const keyed = store.interventionLogs.filter(i => i.tmiPeriodKey);
  t("overlapping chain r1,r2,r3 merged to 1; r4 separate", m.merged === 2 && keyed.length === 2, JSON.stringify(m));
  const kept = keyed.find(i => i.tmiPeriodKey === 'range__2026-09-10__2026-09-16');
  t("latest-ending window kept, served summed (90)", kept && kept.tmiMinutesServed === 90 && kept.tmiMinutes === 240);
  t("manual TMI untouched", store.interventionLogs.some(i => i.id === 'manual'));
}

// ── recalcTMIForWindow relabels overlapping record by moving its id ──
reset();
store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
{
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'U']]), previous: new Map(), savedBy: {} });
  await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-14', assignedBy: 'Admin' });
  const before = store.interventionLogs[0].id;
  const res = await recalcTMIForWindow('2026-09-10', '2026-09-16', 'Admin');
  const after = store.interventionLogs;
  t("window recalc: still exactly one record", after.length === 1, JSON.stringify(after.map(i => i.id)));
  t("record moved to the range key id", after[0].id !== before && after[0].id === tmiDocId({ studentId: 'sA' }, 'range__2026-09-10__2026-09-16') && after[0].tmiPeriodKey === 'range__2026-09-10__2026-09-16');
  t("window recalc never scanned a growing collection", !getAllBy.interventionLogs && !getAllBy.attendanceEvents, JSON.stringify(getAllBy));
  // Re-run → none
  const res2 = await recalcTMIForWindow('2026-09-10', '2026-09-16', 'Admin');
  t("re-run is a no-op", res2.every(r => r.action === 'none') && store.interventionLogs.length === 1, JSON.stringify(res2));
}

// ── Index-missing fallback still works on the new collection ──
reset();
{
  await saveSectionAttendance({ section: sec, roster: roster([[sA, 'U'], [sB, 'T']]), previous: new Map(), savedBy: {} });
  await saveSectionAttendance({ section: { ...sec, teacherLastName: 'Hale' }, roster: roster([[sC, 'U']]), previous: new Map(), savedBy: {} });
  setFailQueriesMatching((c, conds) => conds.some(x => x[0] === 'teacherLastName'));
  const r = await fetchClassLogs({ start: '2026-09-14', end: '2026-09-14', teacherLastName: 'Jaynes', codes: ['U'] });
  t("fallback gives correct result without scanning events", r.length === 1 && r[0].studentId === 'sA' && !getAllBy.attendanceEvents);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll Phase 2 simulation tests passed.");

// ── Legacy migration: exceptions + sessions, placeholders dropped, idempotent ──
{
  const { buildMigrationOps, commitOps } = await import('./attendance.js');
  reset();
  const legacy = [
    { id: 'l1', studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', date: '2026-09-01', attendanceCode: 'P', updatedAt: '2026-09-01T10:00:00Z' },
    { id: 'l2', studentId: 'sB', chattStateANumber: 'A2', studentName: 'Baker, Bo', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', date: '2026-09-01', attendanceCode: 'U', updatedAt: '2026-09-01T10:00:00Z' },
    { id: 'l2dup', studentId: 'sB', chattStateANumber: 'A2', studentName: 'Baker, Bo', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', date: '2026-09-01', attendanceCode: 'T', updatedAt: '2026-09-01T11:00:00Z' },  // race duplicate, newer
    { id: 'l3', studentId: 'sC', chattStateANumber: 'A3', studentName: 'Cole, Cy', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30', date: '2026-09-01', attendanceCode: 'P', assignTmi: true },
    { id: 'l4', studentId: 'sA', teacherLastName: 'Hale', className: 'Lab', classDate: '2026-09-02', attendanceCode: '?', learningLab: true },   // lab placeholder
    { id: 'l5', studentId: 'sA', teacherLastName: 'Hale', className: 'Lab', classDate: '2026-09-03', attendanceCode: 'U', learningLab: true },
    { id: 'l6', studentId: 'sA', teacherLastName: 'Hale', className: 'Bio', date: '2026-09-04', status: 'P' },   // propagated, never taken
  ];
  const m = buildMigrationOps(legacy);
  t("migration: 3 events (U/T collapsed to newest T, override, lab U)", m.eventCount === 3 && m.conflicts === 1, JSON.stringify({ e: m.eventCount, c: m.conflicts }));
  t("migration: 2 sessions (Algebra 9/1, Lab 9/3) — placeholder and propagated rows are not 'taken'", m.sessionCount === 2, `sessions=${m.sessionCount}`);
  await commitOps(m.ops);
  const bo = store.attendanceEvents.find(e => e.studentId === 'sB');
  t("newest duplicate wins", bo && bo.attendanceCode === 'T' && bo.legacyId === 'l2dup');
  const labEv = store.attendanceEvents.find(e => e.learningLab);
  t("lab classDate became date", labEv && labEv.date === '2026-09-03' && !('classDate' in labEv));
  const alg = store.attendanceSessions.find(sx => sx.className === 'Algebra I');
  t("session roster=3 exceptions=2", alg && alg.rosterCount === 3 && alg.exceptionCount === 2, JSON.stringify(alg));
  await commitOps(buildMigrationOps(legacy).ops);
  t("re-running migration changes nothing", store.attendanceEvents.length === 3 && store.attendanceSessions.length === 2);
  // Class Attendance load after migration finds the migrated record and a save updates it in place
  const loaded = await fetchClassLogsForDate('2026-09-01', { teacherLastName: 'Jaynes' });
  const prev = new Map(loaded.map(e => [e.studentId, e]));
  await saveSectionAttendance({ section: { date: '2026-09-01', teacherLastName: 'Jaynes', className: 'Algebra I', startTime: '09:30' }, roster: roster([[sA, 'P'], [sB, 'P'], [sC, 'P']]), previous: prev, savedBy: {} });
  t("marking migrated exceptions Present deletes them (no leftovers)", store.attendanceEvents.filter(e => e.date === '2026-09-01').length === 0);
}
console.log(fails ? `\n${fails} FAILED (incl. migration)` : "Migration tests passed.");
