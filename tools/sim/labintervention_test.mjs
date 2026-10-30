// A Learning Lab carries a Level 1 Academic intervention for exactly the
// lab's dates: hidden before it starts, deleted once it ends, deleted early if
// the lab is deleted, and moved if the lab's dates or student change. Plus the
// "already has a Learning Lab" warning's lookup.
import { store, resetStats, stats } from './db.js';
import {
  labInterventionId, isInterventionLive, isLabInterventionExpired,
  syncLabIntervention, removeLabIntervention, sweepExpiredLabInterventions,
  openLabsForStudent, todayISO, LAB_INTERVENTION_SOURCE,
} from './labInterventions.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); }
const ints = () => store.studentInterventions;

const lab = { studentId: 'sA', studentName: 'Adams, Ann', startDate: '2026-11-02', endDate: '2026-11-20',
              className: 'Algebra Lab', teacherLastName: 'Jaynes', assignedBy: 'Zach McCoy' };

// ── Creating ──
reset();
{
  const r = await syncLabIntervention({ ...lab, today: '2026-10-30' });
  const rec = ints()[0];
  t("assigning a lab creates one intervention", r.action === 'saved' && ints().length === 1, JSON.stringify(r));
  t("it is Level 1 Academic", rec.category === 'Academic' && rec.level === 1);
  t("it is marked as coming from the lab", rec.source === LAB_INTERVENTION_SOURCE);
  t("it carries the lab's dates", rec.labStartDate === '2026-11-02' && rec.labEndDate === '2026-11-20');
  t("it starts when the lab does", rec.dateTime === '2026-11-02T09:30', rec.dateTime);
  t("it says what it's for", rec.comments.includes('Algebra Lab') && rec.comments.includes('Jaynes'), rec.comments);
  t("it records who assigned the lab", rec.assignedBy === 'Zach McCoy');
  t("the student name is stored Last, First", rec.studentName === 'Adams, Ann');

  const again = await syncLabIntervention({ ...lab, today: '2026-10-30' });
  t("saving again doesn't duplicate it", ints().length === 1 && again.id === r.id);
}

// ── The window ──
{
  const rec = { source: LAB_INTERVENTION_SOURCE, labStartDate: '2026-11-02', labEndDate: '2026-11-20' };
  t("hidden the day before the lab starts", !isInterventionLive(rec, '2026-11-01'));
  t("live on the first day", isInterventionLive(rec, '2026-11-02'));
  t("live mid-lab", isInterventionLive(rec, '2026-11-10'));
  t("live on the last day", isInterventionLive(rec, '2026-11-20'));
  t("gone the day after", !isInterventionLive(rec, '2026-11-21'));
  t("expired only after the last day",
    !isLabInterventionExpired(rec, '2026-11-20') && isLabInterventionExpired(rec, '2026-11-21'));

  const manual = { category: 'Academic', level: 1, dateTime: '2026-01-01T10:00' };
  t("an ordinary intervention is never hidden", isInterventionLive(manual, '2030-01-01'));
  t("nor ever swept", !isLabInterventionExpired(manual, '2030-01-01'));
  t("a lab record with broken dates is shown, not hidden",
    isInterventionLive({ source: LAB_INTERVENTION_SOURCE, labStartDate: '', labEndDate: '' }, '2026-11-10'));
}

// ── Sweeping expired ones, from data already loaded ──
reset();
{
  await syncLabIntervention({ ...lab, today: '2026-10-30' });
  await syncLabIntervention({ ...lab, studentId: 'sB', startDate: '2026-10-01', endDate: '2026-10-15', today: '2026-09-30' });
  store.studentInterventions.push({ id: 'manual1', studentId: 'sB', category: 'Conduct', level: 2 });

  resetStats();
  const removed = await sweepExpiredLabInterventions([...ints()], '2026-10-30');
  t("only the finished lab's intervention is deleted",
    removed.length === 1 && removed[0] === labInterventionId('sB', '2026-10-01', '2026-10-15'), JSON.stringify(removed));
  t("the running lab's and the manual one survive",
    ints().length === 2 && ints().some(r => r.id === 'manual1'));
  t("the sweep reads nothing", stats.reads === 0 && stats.getAll === 0 && stats.query === 0, JSON.stringify(stats));
  t("and writes only what it deletes", stats.writes === 1, String(stats.writes));

  resetStats();
  const nothing = await sweepExpiredLabInterventions([...ints()], '2026-10-30');
  t("a second sweep has nothing to do", nothing.length === 0 && stats.writes === 0);
}

// ── Editing the lab ──
reset();
{
  await syncLabIntervention({ ...lab, today: '2026-10-30' });
  const r = await syncLabIntervention({ ...lab, endDate: '2026-12-04', today: '2026-10-30',
                                        previous: { studentId: 'sA', startDate: lab.startDate, endDate: lab.endDate } });
  t("extending the lab moves the intervention", r.action === 'moved' && ints().length === 1, JSON.stringify(r));
  t("to the new dates", ints()[0].labEndDate === '2026-12-04');

  const r2 = await syncLabIntervention({ ...lab, studentId: 'sZ', studentName: 'Zed, Zoe', endDate: '2026-12-04', today: '2026-10-30',
                                         previous: { studentId: 'sA', startDate: lab.startDate, endDate: '2026-12-04' } });
  t("reassigning to another student moves it to them",
    r2.action === 'moved' && ints().length === 1 && ints()[0].studentId === 'sZ', JSON.stringify(ints().map(i => i.studentId)));
}

// ── Edge cases on save ──
reset();
{
  const r = await syncLabIntervention({ ...lab, startDate: '', endDate: '' });
  t("a lab with no dates gets no intervention — it could never be removed",
    r.action === 'skipped' && r.reason === 'no dates' && ints().length === 0, JSON.stringify(r));

  const r2 = await syncLabIntervention({ ...lab, startDate: '2026-09-01', endDate: '2026-09-15', today: '2026-10-30' });
  t("a lab entered after it ended gets none either",
    r2.action === 'skipped' && r2.reason === 'already ended' && ints().length === 0, JSON.stringify(r2));
}

// ── Deleting the lab ──
reset();
{
  await syncLabIntervention({ ...lab, today: '2026-10-30' });
  await removeLabIntervention('sA', lab.startDate, lab.endDate);
  t("deleting the lab removes its intervention", ints().length === 0);
  t("removing one that's already gone is harmless",
    (await removeLabIntervention('sA', lab.startDate, lab.endDate)) === true);
  t("removing with no dates is a no-op", (await removeLabIntervention('sA', '', '')) === false);
}

// ── The "already has a Learning Lab" lookup ──
{
  const schedules = [
    // one lab, two sessions -> should count once
    { id: 'x1', learningLab: true, studentId: 'sA', className: 'Algebra Lab', teacherLastName: 'Jaynes', startDate: '2026-10-19', endDate: '2026-11-06', classDays: ['M'] },
    { id: 'x2', learningLab: true, studentId: 'sA', className: 'Algebra Lab', teacherLastName: 'Jaynes', startDate: '2026-10-19', endDate: '2026-11-06', classDays: ['W'] },
    // upcoming
    { id: 'x3', learningLab: true, studentId: 'sA', className: 'Bio Lab', teacherLastName: 'Wineland', startDate: '2026-11-16', endDate: '2026-11-27' },
    // finished
    { id: 'x4', learningLab: true, studentId: 'sA', className: 'Old Lab', teacherLastName: 'Hale', startDate: '2026-09-01', endDate: '2026-09-12' },
    // not a lab
    { id: 'x5', learningLab: false, studentId: 'sA', className: 'English II', startDate: '2026-08-10', endDate: '2027-05-20' },
    // someone else
    { id: 'x6', learningLab: true, studentId: 'sB', className: 'Algebra Lab', startDate: '2026-10-19', endDate: '2026-11-06' },
  ];
  const open = openLabsForStudent('sA', schedules, '2026-10-30');
  t("two sessions of one lab count as one lab", open.filter(l => l.className === 'Algebra Lab').length === 1);
  t("running and upcoming labs are both listed", open.length === 2, JSON.stringify(open.map(l => l.className)));
  t("the running one is marked as running", open.find(l => l.className === 'Algebra Lab').running === true);
  t("the upcoming one is not", open.find(l => l.className === 'Bio Lab').running === false);
  t("a finished lab doesn't warn", !open.some(l => l.className === 'Old Lab'));
  t("an ordinary class doesn't warn", !open.some(l => l.className === 'English II'));
  t("another student's lab doesn't warn", openLabsForStudent('sC', schedules, '2026-10-30').length === 0);
  t("a lab ending today still counts", openLabsForStudent('sA', schedules, '2026-11-06').some(l => l.className === 'Algebra Lab'));
  t("soonest first", open[0].className === 'Algebra Lab');
  t("no student, no warning", openLabsForStudent('', schedules).length === 0);
}

t("today is local YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(todayISO()) && todayISO(new Date(2026, 0, 5)) === '2026-01-05');

console.log(fails ? `\n${fails} FAILED` : "\nAll Learning Lab intervention tests passed.");
