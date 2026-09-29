import { store, resetStats } from './db.js';
import * as Data from './data.js';
import { saveEvent, worthKeeping, fetchClassLogs } from './attendance.js';
import { computeTMI, recalcTMIForStudent, recalcTMIForWindow, MAX_TMI } from './tmiEngine.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); Data.invalidate('students'); Data.invalidate('staff'); Data.invalidate('schoolCalendar'); }
const seed = () => {
  store.students.push({ id: 'sA', chattStateANumber: 'A100200', firstName: 'Ann', lastName: 'Adams' });
  store.staff.push({ id: 'st1', firstName: 'Erin', lastName: 'Jaynes' });
};
const dress = (date, n = 1) => ({
  studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann',
  date, time: '10:15', attendanceCode: 'P', tmiMinutes: 30, tmiReason: 'dress code',
  className: 'Dress Code', teacherLastName: 'Jaynes',
  comment: 'DRESS CODE - untucked', sourceInterventionId: 'iv' + n,
});
const tardy = (date, cls) => ({
  studentId: 'sA', chattStateANumber: 'A100200', date, attendanceCode: 'T',
  className: cls, teacherLastName: 'Jaynes', startTime: '09:30',
});

// ── The event is stored even though the student was present ──
reset(); seed();
{
  t("a 30-minute event is worth keeping despite code P", worthKeeping({ attendanceCode: 'P', tmiMinutes: 30 }));
  t("a plain Present event still is not", !worthKeeping({ attendanceCode: 'P' }));
  const id = await saveEvent(dress('2026-09-17'));
  t("dress code event is stored", id && store.attendanceEvents.length === 1);
  const ev = store.attendanceEvents[0];
  t("it is NOT recorded as a tardy", ev.attendanceCode !== 'T', `code=${ev.attendanceCode}`);
  t("it carries its minutes and label", ev.tmiMinutes === 30 && ev.tmiReason === 'dress code');
}

// ── The maths ──
{
  t("one dress code = 30 min", computeTMI([dress('2026-09-17')]).totalMinutes === 30);
  t("and says so", /1× dress code \(30 min\)/.test(computeTMI([dress('2026-09-17')]).reason),
    computeTMI([dress('2026-09-17')]).reason);
  const two = computeTMI([dress('2026-09-17', 1), dress('2026-09-18', 2)]);
  t("two dress codes = 60 min, grouped in the reason", two.totalMinutes === 60 && /2× dress code \(60 min\)/.test(two.reason), two.reason);

  // The whole point: it must not feed the 3-tardies rule.
  const twoTardiesPlusDress = computeTMI([tardy('2026-09-16','Algebra'), tardy('2026-09-17','Biology'), dress('2026-09-18')]);
  t("2 tardies + a dress code is NOT a group of three", twoTardiesPlusDress.totalMinutes === 30, JSON.stringify(twoTardiesPlusDress));
  t("no tardy-group text appears", !/group of 3/.test(twoTardiesPlusDress.reason), twoTardiesPlusDress.reason);

  const threeTardiesPlusDress = computeTMI([tardy('2026-09-16','A'), tardy('2026-09-17','B'), tardy('2026-09-18','C'), dress('2026-09-18')]);
  t("3 real tardies still give 90, plus 30 for the dress code = 120", threeTardiesPlusDress.totalMinutes === 120, JSON.stringify(threeTardiesPlusDress));

  // Counts toward the cap.
  const u = { studentId: 'sA', attendanceCode: 'U', date: '2026-09-17' };
  const capped = computeTMI([u, { ...u, date: '2026-09-18' }, dress('2026-09-19')]);
  t("2 unexcused (240) + dress code is capped at 240, not 270", capped.totalMinutes === MAX_TMI, `${capped.totalMinutes}`);
  t("the cap is stated in the reason", /capped at 240 min/.test(capped.reason), capped.reason);
}

// ── End to end through the engine ──
reset(); seed();
{
  await saveEvent(dress('2026-09-17'));
  const r = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', studentName: 'Adams, Ann', dateStr: '2026-09-17', assignedBy: 'Zach' });
  t("engine creates a 30-minute TMI record", r.action === 'created' && r.minutes === 30, JSON.stringify(r));
  const rec = store.interventionLogs[0];
  t("the record explains it was dress code", /dress code/.test(rec.reason), rec.reason);

  // A second violation the same week adds another 30.
  await saveEvent(dress('2026-09-18', 2));
  const r2 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-18', assignedBy: 'Zach' });
  t("a second violation takes it to 60", r2.action === 'updated' && r2.minutes === 60, JSON.stringify(r2));
  t("still only one TMI record for the week", store.interventionLogs.length === 1);

  // Deleting the intervention removes the event; minutes come back off.
  store.attendanceEvents = store.attendanceEvents.filter(e => e.sourceInterventionId !== 'iv2');
  const r3 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-18', assignedBy: 'Zach' });
  t("removing one violation drops back to 30", r3.action === 'updated' && r3.minutes === 30, JSON.stringify(r3));
  store.attendanceEvents = [];
  const r4 = await recalcTMIForStudent({ studentId: 'sA', chattStateANumber: 'A100200', dateStr: '2026-09-17', assignedBy: 'Zach' });
  t("removing the last one clears the record", r4.action === 'deleted' && store.interventionLogs.length === 0, JSON.stringify(r4));
}

// ── The custom-range path must see it too (it used to filter to T/U/E) ──
reset(); seed();
{
  await saveEvent(dress('2026-09-17'));
  const res = await recalcTMIForWindow('2026-09-16', '2026-09-22', 'Zach');
  t("\"use this range\" counts dress-code minutes", store.interventionLogs.length === 1 && store.interventionLogs[0].tmiMinutes === 30,
    JSON.stringify(res));
}

// ── Same fix rescues manual TMI overrides, which were also being missed ──
reset(); seed();
{
  await saveEvent({ studentId: 'sA', chattStateANumber: 'A100200', date: '2026-09-17',
                    attendanceCode: 'P', assignTmi: true, className: 'Algebra', teacherLastName: 'Jaynes' });
  await recalcTMIForWindow('2026-09-16', '2026-09-22', 'Zach');
  t("a manual override is no longer invisible to a custom range", store.interventionLogs.length === 1 && store.interventionLogs[0].tmiMinutes === 120,
    JSON.stringify(store.interventionLogs.map(x => x.tmiMinutes)));
}

// ── A dress-code event must not be mistaken for an absence elsewhere ──
reset(); seed();
{
  await saveEvent(dress('2026-09-17'));
  await saveEvent(tardy('2026-09-17', 'Algebra'));
  const absences = await fetchClassLogs({ start: '2026-09-17', end: '2026-09-17', codes: ['T','U','E'] });
  t("absence lists show the tardy but not the dress code", absences.length === 1 && absences[0].attendanceCode === 'T',
    JSON.stringify(absences.map(a => a.attendanceCode)));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll dress-code tests passed.");

// ── The Roster must not treat a dress-code record as orphaned ──
// (mirrors tmi-approval.html's hasTriggeringLogs, which now uses qualifies())
{
  const { qualifies } = await import('./tmiEngine.js');
  t("a dress-code event counts as a basis for TMI", qualifies({ attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code' }));
  t("a manual override counts too", qualifies({ attendanceCode:'P', assignTmi:true }));
  t("a plain Present event does not", !qualifies({ attendanceCode:'P' }));
  t("U and T still do", qualifies({ attendanceCode:'U' }) && qualifies({ attendanceCode:'T' }));
}

// ── One staff member must not become two teachers ──
{
  const { repairEventTeacherNames } = await import('./tmiEngine.js');
  reset();
  store.students.push({ id:'sA', chattStateANumber:'A100200', firstName:'Ann', lastName:'Adams' });
  store.staff.push({ id:'st1', firstName:'Zachary', lastName:'McCoy', email:'zmccoy@x.edu' },
                   { id:'st2', firstName:'Anna', lastName:'Wineland', email:'aw@x.edu' });

  // Events as the old code wrote them: a display name where a surname belongs.
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', studentName:'Adams, Ann', date:'2026-09-17',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'ZACHARY MCCOY' });
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', studentName:'Adams, Ann', date:'2026-09-18',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'Anna Wineland' });
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', date:'2026-09-16',
                    attendanceCode:'U', className:'STEM 4', teacherLastName:'McCoy' });

  const before = new Set(store.attendanceEvents.map(e => e.teacherLastName));
  t("before the repair one person appears under two names",
    before.has('ZACHARY MCCOY') && before.has('McCoy'), JSON.stringify([...before]));

  const r = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  const after = new Set(store.attendanceEvents.map(e => e.teacherLastName));
  t("display names are mapped back to the staff surname",
    after.has('McCoy') && !after.has('ZACHARY MCCOY') && after.has('Wineland') && !after.has('Anna Wineland'),
    JSON.stringify([...after]));
  t("the teacher list collapses to real surnames", after.size === 2 && r.fixed === 2, JSON.stringify({ after:[...after], ...r, details:undefined }));
  t("an already-correct record is left alone", r.details.every(d => !d.includes('"McCoy" →')), JSON.stringify(r.details));

  const again = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("running the repair twice changes nothing", again.fixed === 0 && again.cleared === 0 && again.records === 0,
    JSON.stringify({ ...again, details: undefined }));

  // A name matching nobody is cleared, not guessed at.
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', date:'2026-09-19',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'SOMEONE WHO LEFT' });
  const r3 = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  const orphan = store.attendanceEvents.find(e => e.date === '2026-09-19');
  t("an unmatchable name is cleared rather than invented", r3.cleared === 1 && orphan.teacherLastName === '', JSON.stringify(orphan.teacherLastName));
}
// ── The TMI records carry their own teacher, and that is what the TMI Review
// ── Teacher dropdown is built from. Fixing the attendance is not enough.
{
  const { repairEventTeacherNames, recalcTMIForStudent } = await import('./tmiEngine.js');
  reset();
  store.students.push({ id:'sA', chattStateANumber:'A100200', firstName:'Ann', lastName:'Adams' });
  store.staff.push({ id:'st1', firstName:'Zachary', lastName:'McCoy', email:'zmccoy@x.edu' },
                   { id:'st2', firstName:'Anna', lastName:'Wineland', email:'aw@x.edu' });

  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', studentName:'Adams, Ann', date:'2026-09-17',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'ZACHARY MCCOY' });
  // As students.html used to write it: the record inherits the display name.
  await recalcTMIForStudent({ studentId:'sA', chattStateANumber:'A100200', studentName:'Adams, Ann',
                              dateStr:'2026-09-17', assignedBy:'Zach', teacherLastName:'ZACHARY MCCOY' });
  t("a TMI record can start out holding a display name",
    store.interventionLogs.length === 1, JSON.stringify(store.interventionLogs.map(r => r.teacherLastName)));

  await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  const names = store.interventionLogs.map(r => r.teacherLastName);
  t("the dropdown's source collapses to the staff surname",
    names.every(n => n === 'McCoy'), JSON.stringify(names));

  // A record whose attendance has since been deleted cannot be reached by
  // recalculation, so the repair has to rewrite it directly.
  store.interventionLogs[0].teacherLastName = 'ANNA WINELAND';
  store.attendanceEvents.length = 0;
  const r = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("a record with no surviving attendance is still corrected",
    r.records === 1 && store.interventionLogs[0].teacherLastName === 'Wineland',
    JSON.stringify({ records: r.records, name: store.interventionLogs[0].teacherLastName }));

  store.interventionLogs[0].teacherLastName = 'SOMEONE WHO LEFT';
  await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("an unmatchable teacher is cleared off the record, not invented",
    store.interventionLogs[0].teacherLastName === '', JSON.stringify(store.interventionLogs[0].teacherLastName));

  const third = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("the record pass is idempotent too", third.records === 0, JSON.stringify(third.records));
}

console.log(fails ? `\n${fails} FAILED (incl. roster/teacher-name)` : "Roster and teacher-name tests passed.");

// ── A week can belong to more than one teacher ─────────────────────────────
// A dress code logged by the front office and a missed class from a teacher
// land on ONE weekly record, which has room for one teacherLastName. The
// record has to remember both, or TMI Review's Teacher filter hides it from
// whichever one lost the tie.
{
  const { recalcTMIForStudent, teacherSurnamesFromLogs } = await import('./tmiEngine.js');
  reset();
  store.students.push({ id:'sA', chattStateANumber:'A100200', firstName:'Ann', lastName:'Adams' });
  store.staff.push({ id:'st1', firstName:'Zachary', lastName:'McCoy' },
                   { id:'st2', firstName:'Erin', lastName:'Jaynes' });

  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', date:'2026-09-17',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code',
                    className:'Dress Code', teacherLastName:'McCoy' });
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', date:'2026-09-18',
                    attendanceCode:'U', className:'Algebra', teacherLastName:'Jaynes' });
  await saveEvent({ studentId:'sA', chattStateANumber:'A100200', date:'2026-09-21',
                    attendanceCode:'U', className:'Algebra', teacherLastName:'Jaynes' });
  await recalcTMIForStudent({ studentId:'sA', chattStateANumber:'A100200', dateStr:'2026-09-18', assignedBy:'Zach' });

  const rec = store.interventionLogs[0];
  t("one record covers the whole week", store.interventionLogs.length === 1);
  t("it remembers BOTH teachers, not just the commonest",
    JSON.stringify(rec.teachers) === JSON.stringify(['Jaynes','McCoy']), JSON.stringify(rec.teachers));
  t("teacherLastName still holds the commonest, for the old single-name displays",
    rec.teacherLastName === 'Jaynes', rec.teacherLastName);

  // What tmi-review.html's filter does.
  const recordTeachers = r => [...new Set([...(r.teachers || []), r.teacherLastName].map(x => (x||'').trim()).filter(Boolean))];
  t("filtering by the dress-code teacher finds the record", recordTeachers(rec).includes('McCoy'));
  t("filtering by the class teacher finds it too", recordTeachers(rec).includes('Jaynes'));
  t("filtering by an uninvolved teacher does not", !recordTeachers(rec).includes('Hale'));

  // A record from before this change has no list at all; the fallback carries it.
  t("a record with no list falls back to its single teacher",
    JSON.stringify(recordTeachers({ teacherLastName:'McCoy' })) === JSON.stringify(['McCoy']));

  const second = await recalcTMIForStudent({ studentId:'sA', chattStateANumber:'A100200', dateStr:'2026-09-18', assignedBy:'Zach' });
  t("recalculating again changes nothing", second.action === 'none', JSON.stringify(second));

  t("an event with no teacher contributes no phantom entry",
    JSON.stringify(teacherSurnamesFromLogs([{ attendanceCode:'U' }, { attendanceCode:'U', teacherLastName:' Hale ' }])) === JSON.stringify(['Hale']));
  t("a Present row that earned nothing is not a teacher",
    JSON.stringify(teacherSurnamesFromLogs([{ attendanceCode:'P', teacherLastName:'Nobody' }])) === JSON.stringify([]));
}
console.log(fails ? `\n${fails} FAILED (incl. multi-teacher)` : "Multi-teacher tests passed.");

// ── "ZACHARY MCCOY" when the staff record says "Zach McCoy" ────────────────
// The Google display name uses a legal first name the staff list doesn't have,
// so a whole-name match misses. It used to clear the teacher off the record —
// which is how a dress code ended up filed under no teacher at all, invisible
// to its own assigner's filter.
{
  const { repairEventTeacherNames, recalcTMIForStudent, resolveStaffSurname } = await import('./tmiEngine.js');
  reset();
  store.students.push({ id:'sT', chattStateANumber:'A00111111', firstName:'Testy', lastName:'Tester' });
  store.staff.push({ id:'st1', firstName:'Zach', lastName:'McCoy', email:'zmccoy@x.edu' });

  t("the goes-by name still matches", resolveStaffSurname('Zach McCoy', store.staff) === 'McCoy');
  t("the legal first name no longer defeats the match",
    resolveStaffSurname('ZACHARY MCCOY', store.staff) === 'McCoy', resolveStaffSurname('ZACHARY MCCOY', store.staff));
  t("the email still matches", resolveStaffSurname('zmccoy@x.edu', store.staff) === 'McCoy');
  t("a stranger matches nobody", resolveStaffSurname('Someone Else', store.staff) === '');
  t("an empty name matches nobody", resolveStaffSurname('', store.staff) === '');

  await saveEvent({ studentId:'sT', chattStateANumber:'A00111111', studentName:'Tester, Testy', date:'2026-09-22',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'ZACHARY MCCOY' });
  await recalcTMIForStudent({ studentId:'sT', chattStateANumber:'A00111111', studentName:'Tester, Testy',
                              dateStr:'2026-09-22', assignedBy:'ZACHARY MCCOY', teacherLastName:'ZACHARY MCCOY' });
  const r = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("the dress code keeps its teacher instead of being cleared",
    r.cleared === 0 && store.attendanceEvents[0].teacherLastName === 'McCoy',
    JSON.stringify({ cleared: r.cleared, teacher: store.attendanceEvents[0].teacherLastName }));
  t("and the record filters under that teacher",
    (store.interventionLogs[0].teachers || []).includes('McCoy'), JSON.stringify(store.interventionLogs[0].teachers));
}

// ── Recovering a record an earlier repair already emptied ──────────────────
{
  const { repairEventTeacherNames } = await import('./tmiEngine.js');
  reset();
  store.students.push({ id:'sT', chattStateANumber:'A00111111', firstName:'Testy', lastName:'Tester' });
  store.staff.push({ id:'st1', firstName:'Zach', lastName:'McCoy', email:'zmccoy@x.edu' });

  // The state on screen: teacher blank on both the event and the record,
  // "Assigned By" still naming the person who gave the dress code.
  await saveEvent({ studentId:'sT', chattStateANumber:'A00111111', studentName:'Tester, Testy', date:'2026-09-22',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code', className:'Dress Code',
                    teacherLastName:'' });
  store.interventionLogs.push({ id:'tmi_sT_week__2026-09-16__2026-09-22', studentId:'sT', chattStateANumber:'A00111111',
    studentName:'Tester, Testy', interventionType:'TMI', tmiPeriodKey:'week__2026-09-16__2026-09-22',
    startDate:'2026-09-16', tmiMinutes:30, tmiMinutesServed:0, interventionStatus:'Reviewed',
    assignedBy:'ZACHARY MCCOY', teacherLastName:'' });

  const r = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("the assigner is adopted as the teacher", store.attendanceEvents[0].teacherLastName === 'McCoy',
    JSON.stringify({ fixed: r.fixed, teacher: store.attendanceEvents[0].teacherLastName }));
  t("so the record is findable by that teacher's filter",
    (store.interventionLogs[0].teachers || []).includes('McCoy'), JSON.stringify(store.interventionLogs[0].teachers));

  const again = await repairEventTeacherNames({ start:'2026-09-01', end:'2026-09-30' });
  t("and running it again settles", again.fixed === 0 && again.cleared === 0 && again.records === 0,
    JSON.stringify({ ...again, details: undefined }));
}
console.log(fails ? `\n${fails} FAILED (incl. display-name recovery)` : "Display-name recovery tests passed.");
