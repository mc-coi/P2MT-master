import { store, resetStats } from './db.js';
import * as Data from './data.js';
import { mergeDuplicateTMIRecords, recalcTMIForStudent, tmiDocId, resolveIdentity } from './tmiEngine.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); Data.invalidate('students'); Data.invalidate('staff'); }

const roster = () => store.students.push(
  { id: 'sA', chattStateANumber: 'A100200', firstName: 'Ann', lastName: 'Adams' },
  { id: 'sB', chattStateANumber: 'A100300', firstName: 'Bo',  lastName: 'Baker' },
);

// ── The split identity itself ──
reset(); roster();
{
  const byId  = await resolveIdentity({ studentId: 'sA' });
  const byNum = await resolveIdentity({ chattStateANumber: 'A100200' });
  t("an A#-only record resolves to the roster studentId", byNum.studentId === 'sA', JSON.stringify(byNum));
  t("an id-only record resolves to the A#", byId.chattStateANumber === 'A100200');
  t("both now address the SAME document", tmiDocId(byId, 'week__2026-09-16__2026-09-22') === tmiDocId(byNum, 'week__2026-09-16__2026-09-22'));
  const unknown = await resolveIdentity({ chattStateANumber: 'A999999' });
  t("a student not on the roster keeps what it was given", unknown.chattStateANumber === 'A999999' && !unknown.studentId);
}

// ── The duplicate pair Zach is seeing ──
reset(); roster();
{
  const period = 'week__2026-09-16__2026-09-22';
  store.interventionLogs.push(
    // written from Class Attendance (has studentId), part-served
    { id: `tmi_sA_${period}`, studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann',
      interventionType: 'TMI', tmiPeriodKey: period, startDate: '2026-09-16',
      tmiMinutes: 240, servedBase: 0, tmiMinutesServed: 40, interventionStatus: 'Reviewed',
      assignedBy: 'Erin Jaynes',
      sessions: [{ id: 's1', in: '2026-09-17T14:00:00.000Z', out: '2026-09-17T14:40:00.000Z' }] },
    // written from Daily Attendance (A# only), parent already emailed
    { id: `tmi_Aa100200_${period}`, studentId: '', chattStateANumber: 'A100200', studentName: 'Adams, Ann',
      interventionType: 'TMI', tmiPeriodKey: period, startDate: '2026-09-16',
      tmiMinutes: 240, tmiMinutesServed: 25, interventionStatus: 'Reviewed',
      parentNotification: true,
      sessions: [{ id: 's2', in: '2026-09-18T14:00:00.000Z', out: '2026-09-18T14:25:00.000Z' }] },
  );

  const r = await mergeDuplicateTMIRecords({ start: '2026-09-01', end: '2026-09-30' });
  t("the pair is found and merged", r.groups === 1 && r.merged === 1 && r.removed === 1, JSON.stringify({ ...r, details: undefined }));
  t("only one record remains", store.interventionLogs.length === 1);
  const rec = store.interventionLogs[0];
  t("it lives at the id-based canonical id", rec.id === `tmi_sA_${period}`, rec.id);
  t("both sittings survive", rec.sessions.length === 2 && rec.sessions.map(x => x.id).sort().join() === 's1,s2');
  t("served time is the sum, not one or the other", rec.tmiMinutesServed === 65, `served=${rec.tmiMinutesServed}`);
  t("remaining recomputed", rec.tmiMinutesRemaining === 175);
  t("the parent notification from the other copy is kept", rec.parentNotification === true);
  t("the missing studentId is filled in", rec.studentId === 'sA');
  t("assignedBy preserved", rec.assignedBy === 'Erin Jaynes');

  const again = await mergeDuplicateTMIRecords({ start: '2026-09-01', end: '2026-09-30' });
  t("running it again does nothing", again.merged === 0 && again.removed === 0 && store.interventionLogs.length === 1);
}

// ── After the fix, the two writers converge on one document ──
reset(); roster();
store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
{
  store.attendanceEvents.push({ id: 'e1', studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Jaynes' });
  // Class Attendance path: knows the studentId
  await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann', dateStr: '2026-09-17', assignedBy: 'Admin' });
  // Daily Attendance path: knows only the A#
  await recalcTMIForStudent({ studentId: '', chattStateANumber: 'A100200', studentName: 'Adams, Ann', dateStr: '2026-09-17', assignedBy: 'Admin' });
  t("a second writer knowing only the A# updates the same record", store.interventionLogs.length === 1, JSON.stringify(store.interventionLogs.map(x => x.id)));
  t("and it is the id-keyed one", store.interventionLogs[0].id === tmiDocId({ studentId: 'sA' }, 'week__2026-09-16__2026-09-22'));
}

// ── Overlapping-but-different periods are a real decision, not a duplicate ──
reset(); roster();
{
  store.interventionLogs.push(
    { id: 'tmi_sB_week__2026-09-16__2026-09-22', studentId: 'sB', interventionType: 'TMI',
      tmiPeriodKey: 'week__2026-09-16__2026-09-22', startDate: '2026-09-16', tmiMinutes: 120 },
    { id: 'tmi_sB_range__2026-09-14__2026-09-20', studentId: 'sB', interventionType: 'TMI',
      tmiPeriodKey: 'range__2026-09-14__2026-09-20', startDate: '2026-09-14', tmiMinutes: 240 },
  );
  const r = await mergeDuplicateTMIRecords({ start: '2026-09-01', end: '2026-09-30' });
  t("a hand-picked range is not merged into the weekly record", r.merged === 0 && store.interventionLogs.length === 2, JSON.stringify(r));
}

// ── Different students are never conflated ──
reset(); roster();
{
  store.interventionLogs.push(
    { id: 'x1', studentId: 'sA', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-16__2026-09-22', startDate: '2026-09-16', tmiMinutes: 120 },
    { id: 'x2', studentId: 'sB', interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-16__2026-09-22', startDate: '2026-09-16', tmiMinutes: 120 },
  );
  const r = await mergeDuplicateTMIRecords({ start: '2026-09-01', end: '2026-09-30' });
  t("two students in the same week stay two records", r.merged === 0 && store.interventionLogs.length === 2);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll duplicate-merge tests passed.");
