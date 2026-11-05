// ER Emailer: a single student's email opens in Outlook with their parents in
// To. Parents used to be in Cc, which Outlook's compose link doesn't fill
// reliably — they could be silently left off.
const { bootPage, makeT, FAMILIES } = require('./harness.cjs');
const { t, done } = makeT();

const stubs = `
  const listenWhere = (c, f, op, v, cb) => { try { cb([]); } catch (_) {} return () => {}; };
  const saveEvent = async () => {}, deleteEvent = async () => {}, fetchClassLogs = async () => [];
  const EVENTS_COLLECTION = 'attendanceEvents';
`;

(async () => {
  const p = bootPage('er-emailer.html', {
    ...FAMILIES,
    erWorkshops: [{ id: 'w1', name: 'English 3', order: 0 }],
    p2mtTemplates: [{ id: 'er1', name: 'ER notice', subject: 'Extended Remediation – {{firstName}}',
                      body: '{{firstName}} is required to attend remediation.' }],
    classSchedules: [], erRooms: [],
  }, { inline: [], stubs });
  for (let i = 0; i < 6; i++) await p.tick();
  t('the page starts without errors', p.bootErrors.length === 0, p.bootErrors.slice(0, 3).join(' | '));

  // Choose the template the way the dropdown would.
  const sel = p.$('#er-email-tmpl-sel');
  if (sel) { sel.innerHTML += '<option value="er1">ER notice</option>'; sel.value = 'er1'; sel.dispatchEvent(new p.w.Event('change')); }
  if (typeof p.w.onEmailTmplChange === 'function') p.w.onEmailTmplChange();

  p.w.openSingleEmail('s1');
  const u = new URL(p.opened[0] || 'https://none/');
  t('a single ER email opens Outlook on the web', u.origin === 'https://outlook.office.com', p.opened[0] || 'nothing opened — ' + p.toasts.slice(-1)[0]);
  t('the student and their parents are all in To',
    u.searchParams.get('to') === 'aa@students.hcde.org,mom.adams@x.com,dad.adams@y.com', u.searchParams.get('to'));
  t('parents are no longer put in Cc', !u.searchParams.has('cc'));

  done('ER email');
})();
