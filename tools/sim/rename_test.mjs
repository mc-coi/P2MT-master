import { store, resetStats } from './db.js';
import * as Data from './data.js';
import { saveSectionAttendance, renameTeacher, fetchClassLogs, fetchSessions, sectionKey } from './attendance.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset(){ for (const k in store) store[k]=[]; resetStats(); Data.invalidate('students'); Data.invalidate('classSchedules'); }
const lily = { id:'sL', chattStateANumber:'A1', firstName:'Lily', lastName:'Conover' };
const bo   = { id:'sB', chattStateANumber:'A2', firstName:'Bo',   lastName:'Baker' };

reset();
// Two students enrolled in the misspelled teacher's class, plus one in another class.
store.classSchedules.push(
  { id:'cs1', studentId:'sL', className:'STEM 4', teacherLastName:'Segle', startTime:'15:00', classDays:['M'] },
  { id:'cs2', studentId:'sB', className:'STEM 4', teacherLastName:'Segle', startTime:'15:00', classDays:['M'] },
  { id:'cs3', studentId:'sL', className:'Bio',    teacherLastName:'Hale',  startTime:'09:00', classDays:['T'] },
);
// A week of attendance under the misspelling.
const sec = { date:'2026-09-16', teacherLastName:'Segle', className:'STEM 4', startTime:'15:00' };
await saveSectionAttendance({ section: sec, roster:[{student:lily,code:'U',comment:'',tmi:false},{student:bo,code:'P',comment:'',tmi:false}], previous:new Map(), savedBy:{name:'Zach'} });
await saveSectionAttendance({ section:{...sec, date:'2026-09-17'}, roster:[{student:lily,code:'T',comment:'',tmi:false}], previous:new Map(), savedBy:{name:'Zach'} });
// And one under a different teacher, which must be untouched.
await saveSectionAttendance({ section:{ date:'2026-09-16', teacherLastName:'Hale', className:'Bio', startTime:'09:00' },
                              roster:[{student:lily,code:'U',comment:'',tmi:false}], previous:new Map(), savedBy:{name:'Zach'} });

const beforeIds = store.attendanceEvents.map(e => e.id);
t("attendance IDs carry the misspelling", beforeIds.some(id => id.includes('segle')), JSON.stringify(beforeIds));

const r = await renameTeacher({ from:'Segle', to:'Seigle', start:'2026-09-01', end:'2026-09-30' });
t("both class records renamed, the other teacher's left alone",
  r.schedules === 2 && store.classSchedules.filter(c => c.teacherLastName === 'Seigle').length === 2
  && store.classSchedules.find(c => c.id === 'cs3').teacherLastName === 'Hale', JSON.stringify(r));

const events = store.attendanceEvents;
t("no absence is left under the old spelling", !events.some(e => (e.teacherLastName || '').toLowerCase() === 'segle'),
  JSON.stringify(events.map(e => e.teacherLastName)));
t("and none is left at an old document ID", !events.some(e => e.id.includes('segle')), JSON.stringify(events.map(e => e.id)));
t("nothing was duplicated in the move", events.length === 3, `${events.length} events`);
t("the other teacher's absence is untouched", events.some(e => e.teacherLastName === 'Hale' && e.id.includes('hale')));

const sess = store.attendanceSessions;
t("sessions moved too", sess.filter(x => x.teacherLastName === 'Seigle').length === 2 && !sess.some(x => x.id.includes('segle')),
  JSON.stringify(sess.map(x => x.id)));
t("session sectionKey rebuilt from the new name",
  sess.filter(x => x.teacherLastName === 'Seigle').every(x => x.sectionKey === sectionKey({ teacherLastName:'Seigle', className:'STEM 4', startTime:'15:00' })));

// The class still reads as one class under the correct name.
const found = await fetchClassLogs({ start:'2026-09-01', end:'2026-09-30', teacherLastName:'Seigle' });
t("the class's history is intact under the correct name", found.length === 2, `${found.length} absences`);
const oldName = await fetchClassLogs({ start:'2026-09-01', end:'2026-09-30', teacherLastName:'Segle' });
t("and nothing answers to the old one", oldName.length === 0);

// Re-saving that section now lands on the SAME documents, not a fresh set.
const prev = new Map(found.filter(e => e.date === '2026-09-16').map(e => [e.studentId, e]));
await saveSectionAttendance({ section:{...sec, teacherLastName:'Seigle'},
  roster:[{student:lily,code:'U',comment:'',tmi:false},{student:bo,code:'P',comment:'',tmi:false}], previous:prev, savedBy:{name:'Zach'} });
t("a later save reuses the moved records rather than starting a new set", store.attendanceEvents.length === 3, `${store.attendanceEvents.length} events`);

// Guards
const noop = await renameTeacher({ from:'Seigle', to:'Seigle', start:'2026-09-01', end:'2026-09-30' });
t("renaming to the same name does nothing", noop.schedules === 0 && noop.events === 0);
const missing = await renameTeacher({ from:'', to:'X', start:'2026-09-01', end:'2026-09-30' });
t("a blank name is refused", missing.schedules === 0 && missing.events === 0);
const untidy = await renameTeacher({ from:'  seigle ', to:'Seigle-Jones', start:'2026-09-01', end:'2026-09-30' });
t("matching ignores case and stray spaces", untidy.schedules === 2, JSON.stringify(untidy));

console.log(fails ? `\n${fails} FAILED` : "\nAll teacher-rename tests passed.");
