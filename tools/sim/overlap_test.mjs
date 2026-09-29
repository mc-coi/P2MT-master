import { store, resetStats } from './db.js';
import * as Data from './data.js';
import { recalcTMIForWindow, recalcTMIForStudent, tmiDocId } from './tmiEngine.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); Data.invalidate('students'); Data.invalidate('staff'); Data.invalidate('schoolCalendar'); }
const seed = () => {
  store.students.push({ id: 'sA', chattStateANumber: 'A100200', firstName: 'Ann', lastName: 'Adams' });
  store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
};

// ── The reported sequence: custom range, then an ordinary recalculation ──
reset(); seed();
{
  store.attendanceEvents.push(
    { id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' },
    { id: 'e2', studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann', date: '2026-09-18', attendanceCode: 'U', teacherLastName: 'Jaynes' },
  );

  // 1. Someone applies a custom TMI window on TMI Review.
  await recalcTMIForWindow('2026-09-14', '2026-09-20', 'Zach');
  t("custom range produces one record", store.interventionLogs.length === 1, JSON.stringify(store.interventionLogs.map(x => x.tmiPeriodKey)));
  t("and it is a range__ period", store.interventionLogs[0].tmiPeriodKey === 'range__2026-09-14__2026-09-20');

  // 2. A teacher then edits attendance, which triggers an ordinary recalculation
  //    for a date inside that range.
  const r = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann', dateStr: '2026-09-18', assignedBy: 'Teacher' });
  t("ordinary recalc does NOT create a second record", store.interventionLogs.length === 1, JSON.stringify(store.interventionLogs.map(x => x.tmiPeriodKey)));
  t("it updates the custom range instead", store.interventionLogs[0].tmiPeriodKey === 'range__2026-09-14__2026-09-20', JSON.stringify(r));
  t("no weekly record was written", !store.interventionLogs.some(x => (x.tmiPeriodKey || '').startsWith('week__')));
}

// ── Served time inside a custom range survives the recalculation ──
reset(); seed();
{
  store.attendanceEvents.push({ id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' });
  await recalcTMIForWindow('2026-09-14', '2026-09-20', 'Zach');
  const rec = store.interventionLogs[0];
  rec.servedBase = 45; rec.tmiMinutesServed = 45;
  await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-17', assignedBy: 'Teacher' });
  t("served minutes inside a custom range are preserved", store.interventionLogs.length === 1 && store.interventionLogs[0].tmiMinutesServed === 45,
    JSON.stringify(store.interventionLogs.map(x => ({ k: x.tmiPeriodKey, s: x.tmiMinutesServed }))));
}

// ── A date OUTSIDE the custom range still gets its own weekly record ──
reset(); seed();
{
  store.attendanceEvents.push(
    { id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' },
    { id: 'e2', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-10-01', attendanceCode: 'U', teacherLastName: 'Jaynes' },
  );
  await recalcTMIForWindow('2026-09-14', '2026-09-20', 'Zach');
  await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-10-01', assignedBy: 'Teacher' });
  t("an absence outside the range still gets its own weekly record", store.interventionLogs.length === 2,
    JSON.stringify(store.interventionLogs.map(x => x.tmiPeriodKey)));
  t("the custom range is untouched", store.interventionLogs.some(x => x.tmiPeriodKey === 'range__2026-09-14__2026-09-20'));
}

// ── Without the index the query fails; we must not crash or block the save ──
reset(); seed();
{
  const { setFailQueriesMatching } = await import('./db.js');
  setFailQueriesMatching((c, conds) => c === 'interventionLogs' && conds.some(x => x[0] === 'startDate'));
  store.attendanceEvents.push({ id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' });
  const r = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-17', assignedBy: 'Teacher' });
  t("a missing index degrades to the old behaviour rather than failing", r.action === 'created' && store.interventionLogs.length === 1, JSON.stringify(r));
  setFailQueriesMatching(null);
}

// ── Two students in the same custom range stay separate ──
reset(); seed();
store.students.push({ id: 'sB', chattStateANumber: 'A100300', firstName: 'Bo', lastName: 'Baker' });
{
  store.attendanceEvents.push(
    { id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' },
    { id: 'e2', studentId: 'sB', chattStateANumber: 'A100300', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' },
  );
  await recalcTMIForWindow('2026-09-14', '2026-09-20', 'Zach');
  await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-17', assignedBy: 'T' });
  await recalcTMIForStudent({ studentId: 'sB', chattStateANumber: 'A100300', dateStr: '2026-09-17', assignedBy: 'T' });
  t("one record per student, no cross-contamination", store.interventionLogs.length === 2 &&
    new Set(store.interventionLogs.map(x => x.studentId)).size === 2, JSON.stringify(store.interventionLogs.map(x => [x.studentId, x.tmiPeriodKey])));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll custom-range overlap tests passed.");
