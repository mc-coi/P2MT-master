// Runs email-templates.html's real markup and real module script in jsdom.
//
// The page script runs inside one private function scope, exactly like a
// <script type="module">, so an onclick="" that calls a module-private
// function fails here the way it fails in the browser. That is the bug this
// was written for: the "N selected" counter ignored clicks on the checkbox
// itself. Verified to fail on the old handler.
// Only the imports are swapped: Firebase/auth/nav are stubbed, utils.js and
// guardians.js are the real modules (inlined), data comes from fixtures.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');

let fails = 0;
const t = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d ? ' :: ' + d : '')); if (!c) fails++; };

const html = fs.readFileSync(path.join(ROOT, 'email-templates.html'), 'utf8');
const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
const pageScript = scriptMatch[1].replace(/^\s*import[^;]*;\s*$/gm, '');
const asCommonBlock = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')
  .replace(/^\s*import[^;]*;\s*$/gm, '').replace(/^export\s+/gm, '');

const fixtures = {
  students: [
    { id: 's1', firstName: 'Ann',  lastName: 'Adams', chattStateANumber: 'A100001', email: 'aa@students.hcde.org', yearOfGraduation: '2027', house: 'Tesla' },
    { id: 's2', firstName: 'Ben',  lastName: 'Brown', chattStateANumber: 'A100002', email: '',                     yearOfGraduation: '2027', house: 'Tesla' },
    { id: 's3', firstName: 'Cara', lastName: 'Cole',  chattStateANumber: 'A100003', email: 'cc@students.hcde.org', yearOfGraduation: '2028', house: 'Curie' },
  ],
  parents: [
    { chattStateANumber: 'A100001', motherEmail: 'mom.adams@x.com', fatherEmail: 'dad.adams@y.com' },
    { chattStateANumber: '100002',  guardianEmail: 'grandma.brown@x.com; uncle.brown@y.com' },
  ],
  guardianEmails: [],
  p2mtTemplates: [
    { id: 't1', name: 'Reminder', subject: 'Reminder for {{firstName}}',
      body: '<p>Dear family of {{firstName}},</p><p>Line one.<br>Line two.</p>' },
  ],
  pbls: [], pblEvents: [], pblTeams: [],
};

const opened = [];
const dom = new JSDOM(html.replace(scriptMatch[0], ''), { runScripts: 'dangerously', url: 'https://p2mt.example/email-templates.html?tab=send' });
const w = dom.window;
w.open = (url) => { opened.push(url); return {}; };
const toasts = [];

w.__toasts = toasts;
w.__fixtures = fixtures;
const parts = [];
w.Blob = class { constructor(p) { parts.push(p.join('')); } };
w.eval(`(function () {
  ${asCommonBlock('utils.js').replace(/function showToast\(/, 'function __realShowToast(').replace(/function confirmTypedDelete\(/, 'function __realConfirm(')}
  ${asCommonBlock('guardians.js')}
  const showToast = (m, type) => window.__toasts.push(m);
  const confirmTypedDelete = async () => true;
  const initAuth = () => Promise.resolve();
  const initNav = () => {};
  const getAll = async () => [], addDoc = async () => 'x', updateDoc = async () => {}, deleteDoc = async () => {};
  const Data = { get: async (c) => window.__fixtures[c] || [] };
  ${pageScript}
})();`);

const tick = () => new Promise(r => setTimeout(r, 30));
(async () => {
  await tick(); await tick();
  const $ = sel => w.document.querySelector(sel);
  const count = () => $('#sel-count').textContent;
  const addr = () => $('#addr-count').textContent.trim();

  // ── the reported bug: the counter ──
  $('#chk-s1').click();
  t('clicking the checkbox square counts it', count() === '1', `counter=${count()}`);
  $('#chk-s1').closest('.student-check-item').querySelector('label').click();
  t('clicking the name toggles it back off', count() === '0', `counter=${count()}`);
  w.selectAllStudents();
  t('Select All counts everyone', count() === '3');
  w.clearStudents();
  t('Clear resets to zero', count() === '0');

  // ── recipients ──
  $('#send-template').value = 't1'; w.rebuildPreview();
  $('#chk-s1').click(); $('#chk-s2').click(); $('#chk-s3').click();
  t('students only: three selected, two addresses (Ben has none)', count() === '3' && addr() === '· 2 addresses', addr());
  t("Ben's row says he has no student email",
    $('#chk-s2').closest('.student-check-item').textContent.includes('no student email'));

  $('#send-to-parents').checked = true; w.onRecipientModeChanged();
  t('students + parents: 2 student + 4 parent addresses', addr() === '· 6 addresses', addr());

  $('#send-to-students').checked = false; w.onRecipientModeChanged();
  t('parents only: 4 addresses', addr() === '· 4 addresses', addr());
  t("Cara's row says she has no parent email",
    $('#chk-s3').closest('.student-check-item').textContent.includes('no parent email'));

  $('#send-to-parents').checked = false; w.onRecipientModeChanged();
  t('unticking both keeps one ticked', $('#send-to-students').checked === true);

  // ── preview + sending ──
  $('#send-to-parents').checked = true; w.onRecipientModeChanged();
  t('first preview is Ann (alphabetical)', $('#prev-to').textContent.startsWith('Ann Adams <aa@students.hcde.org>'), $('#prev-to').textContent);
  t('her parents are in the To line', $('#prev-to').textContent.includes('mom.adams@x.com') && $('#prev-to').textContent.includes('dad.adams@y.com'));
  t('the preview shows plain text, not HTML tags', !$('#prev-body').textContent.includes('<p>') && $('#prev-body').textContent.includes('Line one.\nLine two.'),
    JSON.stringify($('#prev-body').textContent));

  w.openCurrentInOutlook();
  const u = new URL(opened[0]);
  t('it opens Outlook on the web, not mailto:', u.origin === 'https://outlook.office.com' && u.pathname === '/mail/deeplink/compose', opened[0].slice(0, 60));
  t("the student and both parents are in To", u.searchParams.get('to') === 'aa@students.hcde.org,mom.adams@x.com,dad.adams@y.com', u.searchParams.get('to'));
  t('the subject is merged', u.searchParams.get('subject') === 'Reminder for Ann');
  t('the body is plain text', !u.searchParams.get('body').includes('<'), u.searchParams.get('body'));
  t('no cc or bcc is relied on', !u.searchParams.has('cc') && !u.searchParams.has('bcc'));
  t('it moves on to the next family', $('#prev-to').textContent.includes('Parents: grandma.brown@x.com'), $('#prev-to').textContent);
  t('the opened count shows', $('#rcpt-label').textContent.includes('1 opened'), $('#rcpt-label').textContent);

  w.openCurrentInOutlook(); w.openCurrentInOutlook();
  t('three families, three compose windows', opened.length === 3);
  t('a two-address parent field became two recipients',
    new URL(opened[1]).searchParams.get('to') === 'grandma.brown@x.com,uncle.brown@y.com', new URL(opened[1]).searchParams.get('to'));
  t('a finished batch says so', toasts.some(m => /All 3 opened/.test(m)), toasts.slice(-1)[0]);

  // ── CSV ──
  w.URL.createObjectURL = () => 'blob:x';
  w.URL.revokeObjectURL = () => {};
  w.downloadAllMailMerge();
  const text = parts[parts.length - 1] || '';
  const lines = text.replace(/^﻿/, '').split('\r\n');
  t('the CSV has one row per address (header + 6)', lines.length === 1 + 6, `lines=${lines.length}`);
  t('every row is one physical line', !/[^\r]\n/.test(text));
  t('no cell holds two addresses', !lines.slice(1).some(l => /^"[^"]*[;,][^"]*@/.test(l)));

  console.log(fails ? `\n${fails} FAILED` : '\nAll Email Students end-to-end tests passed.');
  process.exitCode = fails ? 1 : 0;
})();
