import { store, resetStats } from './db.js';
import * as Data from './data.js';
import { saveEvent, saveSectionAttendance } from './attendance.js';
import { recalcTMIForStudent, reconcileAssignedBy, teacherFromLogs, pickAssignedBy } from './tmiEngine.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset(){ for (const k in store) store[k]=[]; resetStats(); Data.invalidate('students'); Data.invalidate('staff'); Data.invalidate('schoolCalendar'); }
const lily = { id:'sL', chattStateANumber:'A00406390', firstName:'Lily', lastName:'Conover' };
const seed = () => {
  store.students.push(lily);
  store.staff.push({ id:'st1', firstName:'Zach', lastName:'McCoy' },
                   { id:'st2', firstName:'Chris', lastName:'Brockelbank' });
};
const tmiRec = () => store.interventionLogs[0];

// ── teacherFromLogs says "I don't know" instead of guessing ──
reset(); seed();
{
  t("names the teacher when the logs carry one",
    teacherFromLogs([{ attendanceCode:'U', teacherLastName:'Brockelbank' }], store.staff) === 'Chris Brockelbank');
  t("returns null when no log carries a teacher",
    teacherFromLogs([{ attendanceCode:'U', teacherLastName:'' }], store.staff) === null);
  t("a teacher not on the staff list still comes through by surname",
    teacherFromLogs([{ attendanceCode:'U', teacherLastName:'Nobody' }], store.staff) === 'Nobody');
  t("pickAssignedBy still falls back for callers that want a value",
    pickAssignedBy([{ attendanceCode:'U', teacherLastName:'' }], store.staff, 'Zach McCoy') === 'Zach McCoy');
}

// ── The reported bug: admin takes another teacher's attendance ──
reset(); seed();
{
  await saveSectionAttendance({
    section: { date:'2026-09-10', teacherLastName:'Brockelbank', className:'STEM 4', startTime:'15:00' },
    roster: [{ student: lily, code:'U', comment:'', tmi:false }],
    previous: new Map(), savedBy: { uid:'zach', name:'Zach McCoy' },
  });
  await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', studentName:'Conover, Lily',
                              dateStr:'2026-09-10', assignedBy:'Zach McCoy' });
  t("created record credits the class teacher, not the signed-in admin",
    tmiRec().assignedBy === 'Chris Brockelbank', tmiRec().assignedBy);

  // The stuck case: a record already carrying the wrong name.
  tmiRec().assignedBy = 'Zach McCoy';
  const r = await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-10', assignedBy:'Someone Else' });
  t("a wrong name is corrected on the next recalculation",
    tmiRec().assignedBy === 'Chris Brockelbank', tmiRec().assignedBy);
  t("and the change is reported with the name it replaced",
    r.assignedByChanged && r.assignedByChanged.from === 'Zach McCoy' && r.assignedByChanged.to === 'Chris Brockelbank',
    JSON.stringify(r.assignedByChanged));

  // Once right, it must stop rewriting.
  const r2 = await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-10', assignedBy:'Someone Else' });
  t("a correct name causes no further writes", r2.action === 'none', JSON.stringify(r2));
}

// ── Records with no teacher evidence must NOT be clobbered ──
reset(); seed();
{
  // A front-office absence: no teacher on the record at all.
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', studentName:'Conover, Lily',
                    date:'2026-09-10', attendanceCode:'U', className:'', teacherLastName:'' });
  await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-10', assignedBy:'Front Office' });
  t("with no teacher on the logs, the caller's name is used", tmiRec().assignedBy === 'Front Office', tmiRec().assignedBy);

  const r = await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-10', assignedBy:'Someone Else' });
  t("and is NOT overwritten by whoever runs a later tool",
    tmiRec().assignedBy === 'Front Office' && r.action === 'none', `${tmiRec().assignedBy} / ${r.action}`);
}

// ── A dress-code entry keeps the staff member who logged it ──
reset(); seed();
{
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', date:'2026-09-10',
                    attendanceCode:'P', tmiMinutes:30, tmiReason:'dress code',
                    className:'Dress Code', teacherLastName:'McCoy' });
  await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-10', assignedBy:'Zach McCoy' });
  t("a dress code credits whoever logged it", tmiRec().assignedBy === 'Zach McCoy', tmiRec().assignedBy);
}

// ── The teacher with the most absences wins when classes differ ──
reset(); seed();
store.staff.push({ id:'st3', firstName:'Vince', lastName:'Hale' });
{
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', date:'2026-09-16', attendanceCode:'U', className:'STEM 4', teacherLastName:'Brockelbank', startTime:'15:00' });
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', date:'2026-09-17', attendanceCode:'T', className:'STEM 4', teacherLastName:'Brockelbank', startTime:'15:00' });
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', date:'2026-09-17', attendanceCode:'T', className:'Bio',    teacherLastName:'Hale', startTime:'09:00' });
  await recalcTMIForStudent({ studentId:'sL', chattStateANumber:'A00406390', dateStr:'2026-09-16', assignedBy:'Zach McCoy' });
  t("the teacher behind most of the absences is credited", tmiRec().assignedBy === 'Chris Brockelbank', tmiRec().assignedBy);
}

// ── The repair tool agrees with the engine ──
reset(); seed();
{
  await saveEvent({ studentId:'sL', chattStateANumber:'A00406390', date:'2026-09-16', attendanceCode:'U', className:'STEM 4', teacherLastName:'Brockelbank' });
  store.interventionLogs.push({
    id:'tmi_sL_week__2026-09-16__2026-09-22', studentId:'sL', chattStateANumber:'A00406390',
    interventionType:'TMI', tmiPeriodKey:'week__2026-09-16__2026-09-22', startDate:'2026-09-16',
    tmiMinutes:120, tmiMinutesServed:0, interventionStatus:'Reviewed', assignedBy:'Zach McCoy',
  });
  const fixed = await reconcileAssignedBy('2026-09-16', '2026-09-22');
  t("the repair tool corrects the same record the same way",
    fixed.length === 1 && fixed[0].to === 'Chris Brockelbank' && tmiRec().assignedBy === 'Chris Brockelbank',
    JSON.stringify(fixed));
  const again = await reconcileAssignedBy('2026-09-16', '2026-09-22');
  t("running the repair twice changes nothing", again.length === 0);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll Assigned By tests passed.");
