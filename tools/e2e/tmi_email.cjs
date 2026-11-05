// TMI Roster: "Email Student" and the bulk notifications always reach parents.
const { bootPage, makeT, FAMILIES } = require('./harness.cjs');
const { t, done } = makeT();

// Manual TMI records (no period key) — the simplest kind the roster shows.
// Dated inside the roster's default window: the last completed Wed–Tue week.
function lastCompletedWedTue(today = new Date()) {
  const d = new Date(today); d.setHours(0, 0, 0, 0);
  const back = (d.getDay() - 3 + 7) % 7;              // to this week's Wednesday
  const thisWed = new Date(d); thisWed.setDate(d.getDate() - back);
  const lastWed = new Date(thisWed); lastWed.setDate(thisWed.getDate() - 7);
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const thu = new Date(lastWed); thu.setDate(lastWed.getDate() + 1);
  return iso(thu);
}
const day = lastCompletedWedTue();
const tmi = (id, s) => ({ id, studentId: s.id, studentName: `${s.lastName}, ${s.firstName}`, interventionType: 'TMI',
  interventionStatus: 'Reviewed', tmiMinutes: 120, tmiMinutesServed: 0, startDate: day, reason: 'Unexcused' });

const stubs = `
  const fetchClassLogs = async () => [];
  const recalcTMIForWindow = async () => [];
  const fetchTMIRecordsForRange = async () => window.__fixtures.interventionLogs;
  const qualifies = () => true;
  const servedSummary = (r) => { const served = r.tmiMinutesServed || 0, assigned = r.tmiMinutes || 0;
    return { served, assigned, remaining: Math.max(0, assigned - served), open: null,
             status: served >= assigned && assigned > 0 ? 'Complete' : served > 0 ? 'Partial' : 'Not Started' }; };
  const startSession = async () => {}, endSession = async () => {}, editSession = async () => {},
        removeSession = async () => {}, setServedBase = async () => {}, openSessionOf = () => null,
        minutesOfSession = () => 0, saveSessionUpdate = async () => {};
`;

(async () => {
  const [ann, ben, cara] = FAMILIES.students;
  const p = bootPage('tmi-approval.html', {
    ...FAMILIES,
    interventionLogs: [tmi('tA', ann), tmi('tB', ben), tmi('tC', cara)],
    p2mtTemplates: [
      { id: 'ts', name: 'Student TMI', subject: 'TMI for {{studentName}}', body: 'You owe {{tmiMinutes}} minutes.' },
      { id: 'tp', name: 'Parent TMI',  subject: 'Your child has TMI', body: 'Parent version: {{tmiMinutes}} minutes.' },
    ],
  }, { inline: ['guardians.js'], stubs });
  for (let i = 0; i < 6; i++) await p.tick();
  t('the page starts without errors', p.bootErrors.length === 0, p.bootErrors.join(' | '));

  // ── per-row "Email Student" ──
  p.w.openEmailModal('tA', 'Adams, Ann', false);
  const toLine = p.$('#email-student-name').textContent;
  t('the To line shows the student and both parents',
    toLine.includes('aa@students.hcde.org') && toLine.includes('mom.adams@x.com') && toLine.includes('dad.adams@y.com'), toLine);
  p.$('#email-template-select').value = 'ts';
  p.w.previewEmailTemplate();
  p.w.openEmailInOutlook();
  const u = new URL(p.opened[0] || 'https://none/');
  t('Email Student opens Outlook on the web', u.origin === 'https://outlook.office.com', p.opened[0]);
  t('student and both parents are in To',
    u.searchParams.get('to') === 'aa@students.hcde.org,mom.adams@x.com,dad.adams@y.com', u.searchParams.get('to'));
  t('nothing relies on Cc or Bcc', !u.searchParams.has('cc') && !u.searchParams.has('bcc'));
  t('the subject is merged, not sent as {{placeholders}}',
    u.searchParams.get('subject') === 'TMI for Adams, Ann', u.searchParams.get('subject'));

  // ── bulk: student template only → parents get the student's email ──
  const csvParts = [];
  p.w.Blob = class { constructor(x) { csvParts.push(x.join('')); } };
  p.w.URL.createObjectURL = () => 'blob:x'; p.w.URL.revokeObjectURL = () => {};
  const rowsOf = () => csvParts[csvParts.length - 1].replace(/^﻿/, '').split('\r\n').slice(1)
    .map(l => { const m = l.match(/^"([^"]*)","([^"]*)"/); return m ? { to: m[1], subject: m[2] } : null; }).filter(Boolean);

  p.$('#bulk-student-template').innerHTML = '<option value="">—</option><option value="ts">Student TMI</option>';
  p.$('#bulk-parent-template').innerHTML  = '<option value="">— Same email as the student —</option><option value="tp">Parent TMI</option>';
  p.$('#bulk-student-template').value = 'ts';
  p.$('#bulk-parent-template').value  = '';
  p.w.rebuildBulkNotifications();
  t('with no parent template, the option says parents get the same email',
    p.$('#bulk-parent-template').options[0].textContent.includes('Same email as the student'));
  p.$('#copyAllNotifBtn').click();           // "Download Mail Merge CSV"
  let rows = csvParts.length ? rowsOf() : [];
  const tos = rows.map(r => r.to);
  t('bulk CSV was produced', rows.length > 0, `rows=${rows.length}`);
  t("parents are rows in the student's email",
    tos.includes('mom.adams@x.com') && tos.includes('dad.adams@y.com') && tos.includes('grandma.brown@x.com') && tos.includes('uncle.brown@y.com'),
    JSON.stringify(tos));
  t('everyone got the student version', rows.every(r => r.subject.startsWith('TMI for')));
  t('one row per address: 3 students + 4 parents', rows.length === 7, String(rows.length));

  // ── bulk: with a parent template, parents get that version — and only that ──
  p.$('#bulk-parent-template').value = 'tp';
  p.w.rebuildBulkNotifications();
  p.$('#copyAllNotifBtn').click();
  rows = rowsOf();
  const parentRows = rows.filter(r => !r.to.endsWith('@students.hcde.org'));
  t('parents get the parent version', parentRows.length === 4 && parentRows.every(r => r.subject === 'Your child has TMI'),
    JSON.stringify(parentRows));
  t('parents are not sent the student version as well',
    !rows.some(r => !r.to.endsWith('@students.hcde.org') && r.subject.startsWith('TMI for')));
  t('students still get theirs', rows.filter(r => r.to.endsWith('@students.hcde.org')).length === 3);
  t('every parent address on file is used, not just the first',
    parentRows.some(r => r.to === 'dad.adams@y.com') && parentRows.some(r => r.to === 'uncle.brown@y.com'));

  done('TMI email');
})();
