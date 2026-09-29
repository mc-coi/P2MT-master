import { store, resetStats } from './db.js';
import { getTmiWeekWindow, isLegacyWeekRecord, migrateToWedTueWeeks,
         recalcTMIForStudent, tmiDocId, servedSummary } from './tmiEngine.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); }
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dow = s => DAY[new Date(s + 'T00:00').getDay()];

// ── The window itself ──
{
  let ok = true;
  for (let i = 0; i < 14; i++) {
    const d = new Date(2026, 8, 14 + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const w = getTmiWeekWindow(iso);
    if (dow(w.start) !== 'Wed' || dow(w.end) !== 'Tue') ok = false;
    if (!(iso >= w.start && iso <= w.end)) ok = false;
  }
  t("every date lands in a Wed–Tue week containing it", ok);
  t("Wed 16th and Mon 21st are now the SAME period",
    getTmiWeekWindow('2026-09-16').key === getTmiWeekWindow('2026-09-21').key,
    `${getTmiWeekWindow('2026-09-16').key} vs ${getTmiWeekWindow('2026-09-21').key}`);
  t("Tue 22nd ends that week; Wed 23rd starts the next",
    getTmiWeekWindow('2026-09-22').key === getTmiWeekWindow('2026-09-16').key &&
    getTmiWeekWindow('2026-09-23').key !== getTmiWeekWindow('2026-09-22').key);
  t("legacy Mon-start record is detected", isLegacyWeekRecord({ tmiPeriodKey: 'week__2026-09-14__2026-09-20', startDate: '2026-09-14' }));
  t("new Wed-start record is not", !isLegacyWeekRecord({ tmiPeriodKey: 'week__2026-09-16__2026-09-22', startDate: '2026-09-16' }));
  t("a hand-picked range is never treated as legacy", !isLegacyWeekRecord({ tmiPeriodKey: 'range__2026-09-14__2026-09-20', startDate: '2026-09-14' }));
  t("manual TMI (no period) is never legacy", !isLegacyWeekRecord({ tmiMinutes: 60 }));
}

// ── The mismatch this fixes: absences split across two Mon–Sun records ──
reset();
store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
{
  // One U on Wed 16th, one U on Mon 21st. Same Wed–Tue week, different Mon–Sun weeks.
  store.attendanceEvents.push(
    { id: 'e1', studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann', date: '2026-09-16', attendanceCode: 'U', teacherLastName: 'Jaynes' },
    { id: 'e2', studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann', date: '2026-09-21', attendanceCode: 'U', teacherLastName: 'Jaynes' },
  );
  // The two records the old Mon–Sun grouping produced, one part-served.
  store.interventionLogs.push(
    { id: 'tmi_sA_week__2026-09-14__2026-09-20', studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann',
      interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-14__2026-09-20', startDate: '2026-09-14',
      tmiMinutes: 120, tmiMinutesServed: 45, tmiMinutesRemaining: 75, interventionStatus: 'Reviewed',
      parentNotification: true, assignedBy: 'Erin Jaynes', createDate: '2026-09-16T10:00:00.000Z',
      sessions: [{ id: 's1', in: '2026-09-17T14:00:00.000Z', out: '2026-09-17T14:45:00.000Z', by: 'Zach' }] },
    { id: 'tmi_sA_week__2026-09-21__2026-09-27', studentId: 'sA', chattStateANumber: 'A1', studentName: 'Adams, Ann',
      interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-21__2026-09-27', startDate: '2026-09-21',
      tmiMinutes: 120, tmiMinutesServed: 0, tmiMinutesRemaining: 120, interventionStatus: 'Reviewed',
      assignedBy: 'Erin Jaynes', createDate: '2026-09-21T10:00:00.000Z' },
  );

  const r = await migrateToWedTueWeeks({ start: '2026-09-01', end: '2026-09-30' });
  const left = store.interventionLogs;
  t("both legacy records replaced", r.removed === 2 && r.students === 1, JSON.stringify({ ...r, details: undefined }));
  t("the two U's now share ONE Wed–Tue record", left.length === 1, JSON.stringify(left.map(x => x.tmiPeriodKey)));
  const rec = left[0];
  t("it sits at the Wed–Tue id", rec.id === tmiDocId({ studentId: 'sA' }, 'week__2026-09-16__2026-09-22'), rec.id);
  t("minutes recomputed for the combined week (2 U = 240)", rec.tmiMinutes === 240, `minutes=${rec.tmiMinutes}`);
  t("the 45 minutes already served carried over", rec.tmiMinutesServed === 45 && rec.sessions.length === 1, `served=${rec.tmiMinutesServed}`);
  t("remaining recomputed against carried service", rec.tmiMinutesRemaining === 195, `remaining=${rec.tmiMinutesRemaining}`);
  t("notification flag and status preserved", rec.parentNotification === true && rec.interventionStatus === 'Reviewed');

  // Re-running must do nothing.
  const again = await migrateToWedTueWeeks({ start: '2026-09-01', end: '2026-09-30' });
  t("migration is idempotent", again.written === 0 && again.removed === 0 && store.interventionLogs.length === 1, JSON.stringify({ ...again, details: undefined }));

  // And the engine now agrees with the migrated record.
  // The migrated record carries no teacher, so the first recalc fills one in
  // from the logs — the minutes and the id are unchanged, and no second record
  // appears. The recalc after that has nothing left to do.
  const rc = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-21', assignedBy: 'Admin' });
  t("recalc finds the migrated record, creates no duplicate",
    store.interventionLogs.length === 1 && rc.minutes === 240 && rc.id === tmiDocId({ studentId: 'sA' }, 'week__2026-09-16__2026-09-22'),
    JSON.stringify(rc));
  t("the teacher is resolved from the logs it was migrated from",
    store.interventionLogs[0].teacherLastName === 'Jaynes', JSON.stringify(store.interventionLogs[0].teacherLastName));
  const rc2 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-21', assignedBy: 'Admin' });
  t("and settles after that", rc2.action === 'none', JSON.stringify(rc2));
}

// ── A hand-picked range must survive untouched ──
reset();
{
  store.interventionLogs.push({ id: 'tmi_sB_range__2026-09-14__2026-09-20', studentId: 'sB',
    interventionType: 'TMI', tmiPeriodKey: 'range__2026-09-14__2026-09-20', startDate: '2026-09-14',
    tmiMinutes: 120, tmiMinutesServed: 60 });
  const r = await migrateToWedTueWeeks({ start: '2026-09-01', end: '2026-09-30' });
  t("an explicit date range is left exactly as it was",
    r.removed === 0 && store.interventionLogs.length === 1 && store.interventionLogs[0].tmiPeriodKey === 'range__2026-09-14__2026-09-20');
}

// ── Sittings follow their own date into the right new week ──
reset();
{
  store.attendanceEvents.push(
    { id: 'e1', studentId: 'sC', chattStateANumber: 'A3', date: '2026-09-15', attendanceCode: 'U', teacherLastName: 'Hale' },  // Tue -> week of Sep 9
    { id: 'e2', studentId: 'sC', chattStateANumber: 'A3', date: '2026-09-17', attendanceCode: 'U', teacherLastName: 'Hale' },  // Thu -> week of Sep 16
  );
  store.interventionLogs.push({ id: 'tmi_sC_week__2026-09-14__2026-09-20', studentId: 'sC', chattStateANumber: 'A3',
    interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-14__2026-09-20', startDate: '2026-09-14',
    tmiMinutes: 240, tmiMinutesServed: 90, interventionStatus: 'Reviewed', servedBase: 30,
    sessions: [
      { id: 's1', in: '2026-09-15T14:00:00.000Z', out: '2026-09-15T14:30:00.000Z' },   // belongs to week of Sep 9
      { id: 's2', in: '2026-09-18T14:00:00.000Z', out: '2026-09-18T14:30:00.000Z' },   // belongs to week of Sep 16
    ] });
  await migrateToWedTueWeeks({ start: '2026-09-01', end: '2026-09-30' });
  const wk9  = store.interventionLogs.find(x => x.tmiPeriodKey === 'week__2026-09-09__2026-09-15');
  const wk16 = store.interventionLogs.find(x => x.tmiPeriodKey === 'week__2026-09-16__2026-09-22');
  t("one Mon–Sun record split into the two Wed–Tue weeks it spanned", store.interventionLogs.length === 2 && wk9 && wk16);
  t("each sitting landed in the week its date falls in",
    wk9.sessions.length === 1 && wk9.sessions[0].id === 's1' && wk16.sessions.length === 1 && wk16.sessions[0].id === 's2');
  t("hand-entered credit went to the earliest week", wk9.servedBase === 30 && wk16.servedBase === 0);
  t("served totals add up to what was carried (30 + 30 + 30)",
    wk9.tmiMinutesServed + wk16.tmiMinutesServed === 90, `${wk9.tmiMinutesServed} + ${wk16.tmiMinutesServed}`);
  t("each week's minutes recomputed from its own absence", wk9.tmiMinutes === 120 && wk16.tmiMinutes === 120);
}

// ── A legacy record whose absences are all gone, but time was served ──
reset();
{
  store.interventionLogs.push({ id: 'tmi_sD_week__2026-09-14__2026-09-20', studentId: 'sD',
    interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-14__2026-09-20', startDate: '2026-09-14',
    tmiMinutes: 120, tmiMinutesServed: 60, interventionStatus: 'Reviewed' });
  await migrateToWedTueWeeks({ start: '2026-09-01', end: '2026-09-30' });
  const kept = store.interventionLogs;
  t("served history is never dropped, even with no absences left",
    kept.length === 1 && kept[0].tmiMinutesServed === 60, JSON.stringify(kept.map(x => ({ k: x.tmiPeriodKey, s: x.tmiMinutesServed }))));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll Wed–Tue migration tests passed.");
