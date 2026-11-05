// Learning Lab → "Email Student": the student's parents are always on it.
const { bootPage, makeT, FAMILIES } = require('./harness.cjs');
const { t, done } = makeT();

const lab = (id, studentId, studentName) => ({
  id, learningLab: true, studentId, studentName, className: 'Algebra Lab', teacherLastName: 'Jaynes',
  classDays: ['M', 'W'], startTime: '13:00', endTime: '14:00', startDate: '2026-11-09', endDate: '2026-11-20',
});

(async () => {
  const p = bootPage('learning-lab.html', {
    ...FAMILIES,
    classSchedules: [lab('L1', 's1', 'Ann Adams'), lab('L2', 's2', 'Ben Brown'), lab('L3', 's3', 'Cara Cole')],
    p2mtTemplates: [{ id: 't1', name: 'Lab notice', subject: 'Learning Lab for {{studentName}}', body: 'You have a Learning Lab.' }],
  }, { inline: ['labInterventions.js', 'guardians.js'] });
  await p.tick(); await p.tick();
  t('the page starts without errors', p.bootErrors.length === 0, p.bootErrors.join(' | '));

  // ── Ann: two parents ──
  await p.w.openLabEmailModal('L1');
  const toLine = p.$('#lab-email-student-name').textContent;
  t("the window says it's to the student and parents", p.$('#labEmailModal h2').textContent.includes('Parents'));
  t('the To line shows Ann and both parents',
    toLine.startsWith('Ann Adams <aa@students.hcde.org>') && toLine.includes('mom.adams@x.com') && toLine.includes('dad.adams@y.com'), toLine);

  p.$('#lab-email-template-select').value = 't1';
  p.w.previewLabEmailTemplate();
  p.w.openLabEmailInOutlook();
  const u = new URL(p.opened[0]);
  t('it opens Outlook on the web', u.origin === 'https://outlook.office.com');
  t('student and both parents are in To',
    u.searchParams.get('to') === 'aa@students.hcde.org,mom.adams@x.com,dad.adams@y.com', u.searchParams.get('to'));
  t('nothing relies on Cc or Bcc', !u.searchParams.has('cc') && !u.searchParams.has('bcc'));

  // ── Ben: a parent field with two addresses ──
  await p.w.openLabEmailModal('L2');
  p.$('#lab-email-template-select').value = 't1'; p.w.previewLabEmailTemplate();
  p.w.openLabEmailInOutlook();
  t('a two-address parent field reaches both',
    new URL(p.opened[1]).searchParams.get('to') === 'bb@students.hcde.org,grandma.brown@x.com,uncle.brown@y.com',
    new URL(p.opened[1]).searchParams.get('to'));

  // ── Cara: no parent on file — still sends, and says so ──
  await p.w.openLabEmailModal('L3');
  t('a missing parent is flagged in the To line',
    p.$('#lab-email-student-name').textContent.includes('no parent email on file'), p.$('#lab-email-student-name').textContent);
  p.$('#lab-email-template-select').value = 't1'; p.w.previewLabEmailTemplate();
  p.w.openLabEmailInOutlook();
  t('the student still gets it', new URL(p.opened[2]).searchParams.get('to') === 'cc@students.hcde.org');

  t('one compose window per family, never mixed', p.opened.length === 3 &&
    !new URL(p.opened[0]).searchParams.get('to').includes('brown'));

  done('Learning Lab email');
})();
