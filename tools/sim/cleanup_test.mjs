// One-time clean-ups (house spelling, Learning Lab backfill) and the contact
// check on the Parents page.
import { store, resetStats } from './db.js';
import { planHouseFixes, applyHouseFixes, planLabBackfill, applyLabBackfill } from './cleanup.js';
import { normalizeHouse, isValidEmail } from './utils.js';
import { contactProblems } from './guardians.js';
import { isInterventionLive } from './labInterventions.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); }

// ── normalizeHouse ──
t("Telsa becomes Tesla", normalizeHouse('Telsa') === 'Tesla');
t("any case and spacing of Tesla becomes Tesla", normalizeHouse(' tesla ') === 'Tesla' && normalizeHouse('TELSA') === 'Tesla');
t("other houses are only trimmed", normalizeHouse(' Staupers ') === 'Staupers' && normalizeHouse('einstein') === 'einstein');
t("blank stays blank", normalizeHouse('') === '' && normalizeHouse(null) === '');

// ── house fixes ──
reset();
{
  const students = [
    { id: 's1', firstName: 'Ann', lastName: 'Adams', house: 'Telsa' },
    { id: 's2', firstName: 'Ben', lastName: 'Brown', house: 'Tesla' },
    { id: 's3', firstName: 'Cara', lastName: 'Cole', house: 'Staupers' },
    { id: 's4', firstName: 'Dev', lastName: 'Diaz', house: '' },
  ];
  const staff = [{ id: 'st1', firstName: 'Zach', lastName: 'McCoy', house: 'telsa' }];
  store.students.push(...students.map(s => ({ ...s })));
  store.staff.push(...staff.map(s => ({ ...s })));
  const plan = planHouseFixes(students, staff);
  t("finds the student and the staff member", plan.length === 2 && plan.some(c => c.collection === 'staff'), JSON.stringify(plan));
  t("leaves correct and blank houses alone", !plan.some(c => ['s2', 's3', 's4'].includes(c.id)));
  const n = await applyHouseFixes(plan);
  t("applies exactly those", n === 2 && store.students.find(s => s.id === 's1').house === 'Tesla'
    && store.staff[0].house === 'Tesla' && store.students.find(s => s.id === 's3').house === 'Staupers');
  t("a second run finds nothing", planHouseFixes(store.students, store.staff).length === 0);
}

// ── Learning Lab backfill ──
reset();
{
  const today = '2026-11-10';
  const lab = (id, sid, start, end, extra = {}) => ({ id, learningLab: true, studentId: sid, studentName: '', className: 'Algebra Lab',
    teacherLastName: 'Jaynes', startDate: start, endDate: end, ...extra });
  const schedules = [
    lab('L1', 's1', '2026-11-02', '2026-11-20'),                 // running, no intervention yet
    lab('L1b', 's1', '2026-11-02', '2026-11-20'),                // second session of the same lab
    lab('L2', 's2', '2026-11-16', '2026-11-27'),                 // upcoming
    lab('L3', 's3', '2026-09-01', '2026-09-12'),                 // finished
    lab('L4', 's4', '', ''),                                     // no dates
    lab('L5', 's5', '2026-11-02', '2026-11-20'),                 // already has one
    { id: 'C1', learningLab: false, studentId: 's6', startDate: '2026-08-10', endDate: '2027-05-20' },   // ordinary class
  ];
  const students = ['s1','s2','s3','s4','s5'].map((id, i) => ({ id, firstName: 'F' + i, lastName: 'L' + i }));
  const existing = ['lab_s5_2026-11-02_2026-11-20', 'someOtherIntervention'];
  const plan = planLabBackfill(schedules, existing, students, today);
  t("running and upcoming labs without one are planned", plan.map(p => p.id).sort().join() ===
    'lab_s1_2026-11-02_2026-11-20,lab_s2_2026-11-16_2026-11-27', JSON.stringify(plan.map(p => p.id)));
  t("a lab's sessions count once", plan.filter(p => p.studentId === 's1').length === 1);
  t("finished, undated, existing and ordinary classes are skipped", !plan.some(p => ['s3','s4','s5','s6'].includes(p.studentId)));
  const n = await applyLabBackfill(plan, 'Learning Lab (added by clean-up)');
  const rec = store.studentInterventions.find(r => r.id === 'lab_s1_2026-11-02_2026-11-20');
  t("writes one per planned lab", n === 2 && store.studentInterventions.length === 2);
  t("each is a Level 1 Academic lab intervention", rec.category === 'Academic' && rec.level === 1 && rec.source === 'learningLab');
  t("it ends with its lab, like any other", isInterventionLive(rec, '2026-11-20') && !isInterventionLive(rec, '2026-11-21'));
  t("no Level 2 and no staff alerts", !store.studentInterventions.some(r => r.level === 2) && (store.staffAlerts || []).length === 0);
  t("a second run finds nothing", planLabBackfill(schedules, store.studentInterventions.map(r => r.id).concat(existing), students, today).length === 0);
}

// ── contact check ──
{
  t("valid addresses pass", isValidEmail('a.b@x.org') && isValidEmail(' mom@gmail.com '));
  t("unusable ones fail", !isValidEmail('jsmith@gmail') && !isValidEmail('jsmith.gmail.com') && !isValidEmail('N/A') && !isValidEmail('a b@x.org'));

  const students = [
    { id: 's1', firstName: 'Ann',  lastName: 'Adams', chattStateANumber: 'A100001', email: 'aa@s.org' },   // fine
    { id: 's2', firstName: 'Ben',  lastName: 'Brown', chattStateANumber: 'A100002', email: 'bb@s.org' },   // no parent record
    { id: 's3', firstName: 'Cara', lastName: 'Cole',  chattStateANumber: 'A100003', email: '' },           // record, no email; no student email
    { id: 's4', firstName: 'Dev',  lastName: 'Diaz',  chattStateANumber: 'A100004', email: 'dd@s.org' },   // bad address
    { id: 's5', firstName: 'Eve',  lastName: 'Ems',   chattStateANumber: 'A100005', email: 'ee@s.org' },   // two records
    { id: 's6', firstName: 'Fay',  lastName: 'Fox',   chattStateANumber: 'A100006', email: 'ff@s.org' },   // ER override only
    { id: 's7', firstName: 'Gus',  lastName: 'Gray',  chattStateANumber: 'A100007', email: 'gg@s.org' },   // A# stored without the A
  ];
  const parents = [
    { id: 'p1', chattStateANumber: 'A100001', motherEmail: 'mom@x.com' },
    { id: 'p3', chattStateANumber: 'A100003', motherName: 'Carol', motherEmail: '' },
    { id: 'p4', chattStateANumber: 'A100004', fatherEmail: 'dad@gmail', motherEmail: 'N/A', guardianEmail: 'ok@x.com' },
    { id: 'p5a', chattStateANumber: 'A100005', motherEmail: 'm5@x.com' },
    { id: 'p5b', chattStateANumber: 'a100005', fatherEmail: 'd5@x.com' },
    { id: 'p7', chattStateANumber: '100007', motherEmail: 'm7@x.com' },
    { id: 'p9', chattStateANumber: 'A999999', motherName: 'Old', motherEmail: 'old@x.com' },   // graduated / typo
  ];
  const overrides = [{ studentId: 's6', email: 'er6@x.com' }];
  const { rows, orphans } = contactProblems(students, parents, overrides);
  const kinds = sid => (rows.find(r => r.studentId === sid)?.issues || []).map(i => i.kind);

  t("a family with a good address isn't listed", !rows.some(r => r.studentId === 's1'));
  t("no parent record is flagged", kinds('s2').includes('no-parent-record'));
  t("a record with no email is flagged", kinds('s3').includes('no-parent-email'));
  t("a missing student email is flagged", kinds('s3').includes('no-student-email'));
  const s4 = rows.find(r => r.studentId === 's4');
  t("unusable addresses are flagged, each named", kinds('s4').filter(k => k === 'bad-address').length === 2 &&
    s4.issues.some(i => /dad@gmail/.test(i.detail)) && s4.issues.some(i => /N\/A/.test(i.detail)), JSON.stringify(s4?.issues));
  t("…but a family with one good address isn't called unreachable", !kinds('s4').includes('no-parent-email'));
  t("two records for one student are flagged", kinds('s5').includes('duplicate-records'));
  t("the ER override counts as a way to reach the family", !rows.some(r => r.studentId === 's6'));
  t("an A# stored without the A still matches", !rows.some(r => r.studentId === 's7'));
  t("a parent record matching nobody is listed", orphans.length === 1 && orphans[0].aNumber === 'A999999');
  t("rows are alphabetical", rows.map(r => r.name).join('|') === [...rows.map(r => r.name)].sort().join('|'));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll clean-up and contact-check tests passed.");
