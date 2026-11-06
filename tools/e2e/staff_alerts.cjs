// Second Learning Lab → Level 2 Academic + staff alert; Home shows alerts with
// the student's name hidden until clicked; Admin chooses who gets them.
const { bootPage, makeT, FAMILIES } = require('./harness.cjs');
const { t, done } = makeT();

const lab = (id, studentId, studentName, startDate, endDate) => ({
  id, learningLab: true, studentId, studentName, className: 'Algebra Lab', teacherLastName: 'Jaynes',
  classDays: ['M'], startTime: '13:00', endTime: '14:00', startDate, endDate,
});
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const settings = [{ id: 'interventionAlerts', recipients: ['zmccoy@x.org', 'aw@x.org'] }];

// Fill in and save the Add Learning Lab form, the way a person would.
async function addLab(p, studentId, start, end) {
  p.w.openAddLabModal();
  const st = p.w.__fixtures.students.find(s => s.id === studentId);
  p.w.selectLabStudent(st.id, `${st.firstName} ${st.lastName}`, st.chattStateANumber);
  p.$('#labTeacherSelect').value = 'Jaynes';
  p.$('#labClassName').value = 'Bio Lab';
  p.$('#labStartDate').value = start;
  p.$('#labEndDate').value = end;
  p.w.document.querySelector('.session1Days[value="T"]').checked = true;
  p.$('#session1Start').value = '10:00';
  p.$('#session1End').value = '11:00';
  await p.w.saveLabSchedule();
  for (let i = 0; i < 4; i++) await p.tick();
}

(async () => {
  // ── Learning Lab ──
  {
    const p = bootPage('learning-lab.html', {
      ...FAMILIES, settings,
      classSchedules: [lab('L1', 's1', 'Ann Adams', plus(-3), plus(10))],   // Ann already has a running lab
      p2mtTemplates: [],
    }, { inline: ['labInterventions.js', 'guardians.js', 'staffAlerts.js'] });
    for (let i = 0; i < 4; i++) await p.tick();
    t('Learning Lab starts without errors', p.bootErrors.length === 0, p.bootErrors.join(' | '));

    // The warning says what saving will do.
    p.w.openAddLabModal();
    p.w.selectLabStudent('s1', 'Ann Adams', 'A100001');
    t('the existing-lab warning says a Level 2 will be added',
      p.$('#lab-existing-note').textContent.includes('Level 2 Academic'), p.$('#lab-existing-note').textContent);
    p.w.closeLabModal();

    await addLab(p, 's1', plus(14), plus(28));
    const sets = p.writes.filter(w => w[0] === 'set');
    const lvl2 = sets.find(w => w[1] === 'studentInterventions' && w[3].level === 2);
    t('a second lab adds a Level 2 Academic intervention', !!lvl2 && lvl2[3].category === 'Academic', JSON.stringify(sets.map(w => [w[1], w[2]])));
    t('it is a permanent record, not a lab intervention that gets swept', lvl2 && lvl2[3].source === 'learningLabEscalation');
    t('it says why', lvl2 && /Second Learning Lab/.test(lvl2[3].comments) && /Algebra Lab/.test(lvl2[3].comments), lvl2 && lvl2[3].comments);
    t('the new lab still gets its own Level 1', sets.some(w => w[1] === 'studentInterventions' && w[3].level === 1 && w[3].source === 'learningLab'));
    t('the earlier Level 1 is not removed', !p.writes.some(w => w[0] === 'delete' && w[1] === 'studentInterventions'));
    const alerts = sets.filter(w => w[1] === 'staffAlerts');
    t('both chosen staff are alerted', alerts.length === 2 &&
      alerts.map(w => w[3].forEmail).sort().join() === 'aw@x.org,zmccoy@x.org', JSON.stringify(alerts.map(w => w[3].forEmail)));
    t('the alert is about Level 2 Academic', alerts.every(w => w[3].level === 2 && w[3].category === 'Academic'));
    t('the toast confirms it', p.toasts.some(m => /Level 2 Academic intervention added — 2 staff alerted/.test(m)), p.toasts.slice(-2).join(' | '));

    // A first lab is not an escalation.
    const before = p.writes.length;
    await addLab(p, 's2', plus(1), plus(10));
    const newSets = p.writes.slice(before).filter(w => w[0] === 'set');
    t('a first lab adds only the Level 1', newSets.some(w => w[3].level === 1) && !newSets.some(w => w[3].level === 2));
    t('and alerts nobody', !newSets.some(w => w[1] === 'staffAlerts'));
  }

  // ── Home ──
  {
    const later = new Date(); later.setDate(later.getDate() + 6);
    const p = bootPage('dashboard.html', {
      staffAlerts: [],
    }, { inline: ['staffAlerts.js'], stubs: `
      const fetchClassLogsForDate = async () => [], fetchDailyLogsForDate = async () => [], fetchSessions = async () => [];
      const classLogDate = () => '', dailyLogDate = () => '';
    ` });
    for (let i = 0; i < 4; i++) await p.tick();
    t('Home with no alerts shows no alerts card', p.$('#staff-alerts-card').style.display === 'none');
  }
  {
    const later = new Date(); later.setDate(later.getDate() + 6);
    const alert = { id: 'i1__zmccoy_x_org', forEmail: 'zmccoy@x.org', interventionId: 'i1', studentId: 's1',
      studentName: 'Adams, Ann', category: 'Academic', level: 2, reason: 'Second Learning Lab',
      createdBy: 'Zach McCoy', createdAt: new Date().toISOString(), expiresAt: later.toISOString() };
    const p = bootPage('dashboard.html', { staffAlerts: [alert] }, { inline: ['staffAlerts.js'], stubs: `
      const fetchClassLogsForDate = async () => [], fetchDailyLogsForDate = async () => [], fetchSessions = async () => [];
      const classLogDate = () => '', dailyLogDate = () => '';
    ` });
    for (let i = 0; i < 4; i++) await p.tick();
    const card = p.$('#staff-alerts-card');
    t('Home shows the alerts card', card.style.display !== 'none', `display=${card.style.display}`);
    const row = p.$('.sa-row');
    t('the headline names the level, not the student', row && row.querySelector('.sa-head').textContent === 'Level 2 Academic intervention');
    t("the student's name is hidden at first", row && row.querySelector('.sa-reveal').hidden === true);
    row.querySelector('button[data-act="show"]').click();
    t('Show student reveals the name', !row.querySelector('.sa-reveal').hidden &&
      row.querySelector('.sa-reveal a').textContent === 'Adams, Ann');
    t('the name links to the profile', row.querySelector('.sa-reveal a').getAttribute('href') === './student-profile.html?id=s1');
    row.querySelector('button[data-act="show"]').click();
    t('Hide covers it again', row.querySelector('.sa-reveal').hidden === true);
    row.querySelector('button[data-act="dismiss"]').click();
    for (let i = 0; i < 3; i++) await p.tick();
    t('Dismiss deletes it', p.writes.some(w => w[0] === 'delete' && w[1] === 'staffAlerts' && w[2] === 'i1__zmccoy_x_org'));
    t('and the card disappears', card.style.display === 'none');
  }

  // ── Admin ──
  {
    const p = bootPage('admin.html', {
      ...FAMILIES, settings: [{ id: 'interventionAlerts', recipients: ['zmccoy@x.org'] }],
      staff: [
        { id: 'st1', firstName: 'Zach', lastName: 'McCoy', email: 'ZMcCoy@x.org' },
        { id: 'st2', firstName: 'Anna', lastName: 'Wineland', email: 'aw@x.org' },
        { id: 'st3', firstName: 'No', lastName: 'Email', email: '' },
      ],
      interventionTypes: [],
    }, { inline: ['staffAlerts.js'] });
    for (let i = 0; i < 6; i++) await p.tick();
    const boxes = [...p.w.document.querySelectorAll('#alert-staff-list input[type=checkbox]')];
    t('Admin lists staff who have an email', boxes.length === 2, String(boxes.length));
    t('staff without an email are shown as unable to receive', p.$('#alert-staff-list').textContent.includes("can't receive alerts"));
    t('the saved recipient is ticked (email case ignored)', boxes.find(b => b.dataset.email === 'zmccoy@x.org')?.checked === true);
    const anna = boxes.find(b => b.dataset.email === 'aw@x.org');
    anna.checked = true; anna.dispatchEvent(new p.w.Event('change', { bubbles: true }));
    t('the count updates', p.$('#alert-staff-count').textContent === '2 selected', p.$('#alert-staff-count').textContent);
    p.$('#btn-save-alert-staff').click();
    for (let i = 0; i < 3; i++) await p.tick();
    const saved = p.writes.find(w => w[0] === 'set' && w[1] === 'settings' && w[2] === 'interventionAlerts');
    t('saving writes both recipients', saved && saved[3].recipients.sort().join() === 'aw@x.org,zmccoy@x.org', JSON.stringify(saved && saved[3]));
  }

  // ── Students page: assigning interventions ──
  {
    const p = bootPage('students.html', {
      ...FAMILIES, settings, studentInterventions: [], staff: [],
    }, { inline: ['labInterventions.js', 'staffAlerts.js'], stubs: `
      const recalcTMIForStudent = async () => ({ action: 'none' });
      const resolveStaffSurname = () => 'McCoy';
      const saveEvent = async () => {}, deleteEvent = async () => {};
      const EVENTS_COLLECTION = 'attendanceEvents';
    ` });
    for (let i = 0; i < 6; i++) await p.tick();
    t('Students starts without errors', p.bootErrors.length === 0, p.bootErrors.slice(0, 2).join(' | '));

    async function assign(studentId, category, level) {
      p.w.openAssignModal(studentId);
      p.$('#int-category').value = category;
      p.w.updateLevelOptions();
      p.$('#int-level').value = String(level);
      p.$('#int-comments').value = 'Test';
      const before = p.writes.length;
      await p.w.saveIntervention(new p.w.Event('submit'));
      for (let i = 0; i < 4; i++) await p.tick();
      return p.writes.slice(before);
    }

    let w3 = await assign('s1', 'Dress Code', 3);
    const a3 = w3.filter(w => w[0] === 'set' && w[1] === 'staffAlerts');
    t('Dress Code Level 3 alerts both chosen staff', a3.length === 2 && a3.every(w => w[3].category === 'Dress Code' && w[3].level === 3),
      JSON.stringify(w3.map(w => [w[0], w[1]])));
    t('the intervention itself is saved', w3.some(w => w[0] === 'add' && w[1] === 'studentInterventions'));
    t('the toast says staff were alerted', p.toasts.some(m => /Intervention saved — 2 staff alerted/.test(m)), p.toasts.slice(-1)[0]);

    const w2 = await assign('s2', 'Academic', 2);
    t('a manually assigned Level 2 Academic alerts too', w2.filter(w => w[1] === 'staffAlerts').length === 2);

    const w1 = await assign('s3', 'Dress Code', 2);
    t('Dress Code Level 2 alerts nobody', !w1.some(w => w[1] === 'staffAlerts'));
  }

  done('staff alert');
})();
