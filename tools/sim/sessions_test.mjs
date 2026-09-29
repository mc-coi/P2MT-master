import { store, resetStats } from './db.js';
import { startSession, endSession, editSession, removeSession, setServedBase,
         servedSummary, openSessionOf, minutesOfSession, recalcTMIForStudent } from './tmiEngine.js';

let fails = 0;
function t(name, cond, detail) { console.log((cond ? "PASS" : "FAIL") + " - " + name + (detail ? " :: " + detail : "")); if (!cond) { fails++; process.exitCode = 1; } }
const at = (h, m, day = 18) => new Date(2026, 8, day, h, m, 0);
const rec = (over = {}) => ({ id: 'tmi_sA_w', studentId: 'sA', tmiMinutes: 240, tmiMinutesServed: 0, ...over });

// ── A single sitting ──
{
  let r = rec();
  const a = startSession(r, { by: 'Zach', at: at(14, 0) });
  r = { ...r, ...a };
  t("clock in opens a session with no out", openSessionOf(r) && !openSessionOf(r).out);
  t("open session contributes 0 minutes", r.tmiMinutesServed === 0 && r.tmiMinutesRemaining === 240);
  t("double clock-in is refused", startSession(r, { at: at(14, 5) }) === null);

  r = { ...r, ...endSession(r, { at: at(14, 38) }) };
  t("clock out records 38 minutes", r.tmiMinutesServed === 38, `served=${r.tmiMinutesServed}`);
  t("remaining follows", r.tmiMinutesRemaining === 202);
  t("no open session after clocking out", openSessionOf(r) === null);
  t("clock out with nothing open is refused", endSession(r) === null);
}

// ── Several sittings across days accumulate ──
{
  let r = rec();
  r = { ...r, ...startSession(r, { at: at(14, 0, 18) }) };
  r = { ...r, ...endSession(r, { at: at(15, 0, 18) }) };
  r = { ...r, ...startSession(r, { at: at(14, 0, 21) }) };
  r = { ...r, ...endSession(r, { at: at(15, 30, 21) }) };
  t("two sittings sum to 150", r.tmiMinutesServed === 150 && r.sessions.length === 2, `served=${r.tmiMinutesServed}`);

  // Serve the rest and go past the total
  r = { ...r, ...startSession(r, { at: at(13, 0, 22) }) };
  r = { ...r, ...endSession(r, { at: at(15, 0, 22) }) };
  const s = servedSummary(r);
  t("over-serving clamps remaining at 0, not negative", s.served === 270 && s.remaining === 0, JSON.stringify(s));
  t("status is Complete once assigned is met", s.status === 'Complete');
}

// ── The forgotten clock-out, corrected ──
{
  let r = rec();
  r = { ...r, ...startSession(r, { at: at(14, 0) }) };
  r = { ...r, ...endSession(r, { at: at(23, 59) }) };     // left running until end of day
  t("uncorrected session records the full stretch", r.tmiMinutesServed === 599);
  const id = r.sessions[0].id;
  r = { ...r, ...editSession(r, id, { out: at(15, 0).toISOString() }) };
  t("editing the clock-out recomputes served", r.tmiMinutesServed === 60 && r.tmiMinutesRemaining === 180, `served=${r.tmiMinutesServed}`);
  r = { ...r, ...editSession(r, id, { in: at(14, 30).toISOString() }) };
  t("editing the clock-in recomputes too", r.tmiMinutesServed === 30);
  r = { ...r, ...editSession(r, id, { out: null }) };
  t("clearing the clock-out reopens the sitting", openSessionOf(r) !== null && r.tmiMinutesServed === 0);
  r = { ...r, ...removeSession(r, id) };
  t("removing a sitting drops its minutes", r.sessions.length === 0 && r.tmiMinutesServed === 0);
}

// ── Backwards or zero-length sittings count nothing ──
{
  let r = rec();
  r = { ...r, ...startSession(r, { at: at(15, 0) }) };
  r = { ...r, ...endSession(r, { at: at(14, 0) }) };      // out before in
  t("a backwards sitting counts 0, never negative", r.tmiMinutesServed === 0, `served=${r.tmiMinutesServed}`);
  t("minutesOfSession agrees", minutesOfSession(r.sessions[0]) === 0);
}

// ── Minutes typed in before sessions existed are not lost ──
{
  let r = rec({ tmiMinutesServed: 90 });                   // credited by hand last week
  r = { ...r, ...startSession(r, { at: at(14, 0) }) };
  r = { ...r, ...endSession(r, { at: at(14, 30) }) };
  t("old hand-entered minutes are kept as a base", r.servedBase === 90 && r.tmiMinutesServed === 120, `served=${r.tmiMinutesServed}`);
  r = { ...r, ...setServedBase(r, 30) };
  t("the base can be corrected without touching sittings", r.tmiMinutesServed === 60 && r.sessions.length === 1, `served=${r.tmiMinutesServed}`);
}

// ── A record with no sessions still reports its stored minutes ──
{
  const s = servedSummary(rec({ tmiMinutesServed: 45 }));
  t("legacy record reads straight through", s.served === 45 && s.remaining === 195);
}

// ── Recalculation must never wipe out served time ──
{
  for (const k in store) store[k] = [];
  resetStats();
  store.interventionLogs.push({
    id: 'tmi_sA_week__2026-09-16__2026-09-22', studentId: 'sA', chattStateANumber: 'A1',
    interventionType: 'TMI', tmiPeriodKey: 'week__2026-09-16__2026-09-22', startDate: '2026-09-16',
    tmiMinutes: 240, tmiMinutesServed: 60, servedBase: 0,
    sessions: [{ id: 's1', in: '2026-09-18T14:00:00.000Z', out: '2026-09-18T15:00:00.000Z', by: 'Zach' }],
  });
  // One U remains, so the assignment drops 240 -> 120; served must survive.
  store.attendanceEvents.push({ id: 'e1', studentId: 'sA', chattStateANumber: 'A1', date: '2026-09-18', attendanceCode: 'U', teacherLastName: 'Jaynes' });
  const r = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A1', dateStr: '2026-09-18', assignedBy: 'Admin' });
  const after = store.interventionLogs[0];
  t("recalc reduced the assignment", r.action === 'updated' && after.tmiMinutes === 120, JSON.stringify(r));
  t("recalc left the sitting and served minutes alone", (after.sessions || []).length === 1 && after.tmiMinutesServed === 60, `served=${after.tmiMinutesServed}`);
  t("remaining recomputed against served", after.tmiMinutesRemaining === 60, `remaining=${after.tmiMinutesRemaining}`);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll session tests passed.");
