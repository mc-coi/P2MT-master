// Admin → Data Clean-up, and Parents → Check Contact Info.
const { bootPage, makeT } = require('./harness.cjs');
const { t, done } = makeT();

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const students = [
  { id: 's1', firstName: 'Ann',  lastName: 'Adams', chattStateANumber: 'A100001', email: 'aa@s.org', house: 'Telsa' },
  { id: 's2', firstName: 'Ben',  lastName: 'Brown', chattStateANumber: 'A100002', email: 'bb@s.org', house: 'Tesla' },
  { id: 's3', firstName: 'Cara', lastName: 'Cole',  chattStateANumber: 'A100003', email: 'cc@s.org', house: 'Staupers' },
];

(async () => {
  // ── Admin: clean-up ──
  {
    const p = bootPage('admin.html', {
      students, staff: [{ id: 'st1', firstName: 'Zach', lastName: 'McCoy', email: 'z@x.org', house: 'telsa' }],
      parents: [], interventionTypes: [], settings: [],
      classSchedules: [
        { id: 'L1', learningLab: true, studentId: 's1', className: 'Algebra Lab', teacherLastName: 'Jaynes', startDate: plus(-3), endDate: plus(10) },
        { id: 'L2', learningLab: true, studentId: 's2', className: 'Bio Lab', teacherLastName: 'Hale', startDate: plus(-30), endDate: plus(-20) },
      ],
      studentInterventions: [],
    }, { inline: ['staffAlerts.js', 'labInterventions.js', 'cleanup.js'] });
    p.w.confirm = () => true;
    for (let i = 0; i < 6; i++) await p.tick();
    t('Admin starts without errors', p.bootErrors.length === 0, p.bootErrors.slice(0, 2).join(' | '));

    t('house fix says what it will change', /2 records to fix: "Telsa", "telsa"/.test(p.$('#house-fix-status').textContent), p.$('#house-fix-status').textContent);
    t('lab backfill names the one current lab', /1 lab needs one: Adams, Ann/.test(p.$('#lab-backfill-status').textContent), p.$('#lab-backfill-status').textContent);

    p.$('#btn-house-fix').click();
    for (let i = 0; i < 3; i++) await p.tick();
    const houseWrites = p.writes.filter(w => w[0] === 'update' && w[3].house);
    t('house fix updates the student and the staff record to Tesla',
      houseWrites.length === 2 && houseWrites.every(w => w[3].house === 'Tesla') &&
      houseWrites.some(w => w[1] === 'staff'), JSON.stringify(houseWrites.map(w => [w[1], w[2]])));
    t('then reports nothing left to fix', /Nothing to fix/.test(p.$('#house-fix-status').textContent) && p.$('#btn-house-fix').disabled);

    p.$('#btn-lab-backfill').click();
    for (let i = 0; i < 3; i++) await p.tick();
    const labWrites = p.writes.filter(w => w[0] === 'set' && w[1] === 'studentInterventions');
    t('lab backfill adds the one Level 1 Academic',
      labWrites.length === 1 && labWrites[0][3].level === 1 && labWrites[0][3].category === 'Academic' &&
      labWrites[0][2] === `lab_s1_${plus(-3)}_${plus(10)}`, JSON.stringify(labWrites.map(w => w[2])));
    t('and sends no staff alerts', !p.writes.some(w => w[1] === 'staffAlerts'));
  }

  // ── Parents: contact check + A# matching ──
  {
    const fx = {
      students: [...students, { id: 's4', firstName: 'Dev', lastName: 'Diaz', chattStateANumber: 'A100004', email: '' }],
      parents: [
        { id: 'p1', chattStateANumber: 'A100001', motherEmail: 'mom@x.com' },
        { id: 'p2', chattStateANumber: '100002', motherName: 'Beth', motherEmail: 'beth@x.com' },   // A# without the A
        { id: 'p3', chattStateANumber: 'A100003', fatherEmail: 'dad@gmail' },                     // unusable
        { id: 'p9', chattStateANumber: 'A999999', motherEmail: 'old@x.com' },                     // matches nobody
      ],
      guardianEmails: [],
    };
    const p = bootPage('parents.html', fx, { inline: ['guardians.js'] });
    for (let i = 0; i < 6; i++) await p.tick();
    t('Parents starts without errors', p.bootErrors.length === 0, p.bootErrors.slice(0, 2).join(' | '));

    const benRow = [...p.w.document.querySelectorAll('#parents-tbody tr')].find(tr => tr.textContent.includes('Brown, Ben'));
    t('a parent stored without the A now shows on the student', benRow && benRow.textContent.includes('beth@x.com'), benRow?.textContent);

    p.$('#btn-check-contacts').click();
    for (let i = 0; i < 3; i++) await p.tick();
    const panel = p.$('#contact-check');
    t('the check panel opens', panel.style.display !== 'none');
    const txt = p.$('#contact-rows').textContent;
    t('lists the unusable address', txt.includes('Cole, Cara') && txt.includes('dad@gmail'));
    t('lists the student with no parent record and no student email', txt.includes('Diaz, Dev') && txt.includes('No student email'));
    t('lists the parent record that matches no student', txt.includes('A999999'));
    t("doesn't list families that can be emailed", !txt.includes('Adams, Ann') && !txt.includes('Brown, Ben'));
    const chips = [...p.w.document.querySelectorAll('#contact-summary .cc-chip')].map(c => c.textContent.trim());
    t('summary counts each problem', chips.includes('Unusable address: 1') && chips.includes('No parent record: 1') &&
      chips.includes('Not linked to a student: 1'), JSON.stringify(chips));

    p.w.document.querySelector('#contact-summary [data-kind="bad-address"]').click();
    const filtered = p.$('#contact-rows').textContent;
    t('clicking a count filters to that problem', filtered.includes('Cole, Cara') && !filtered.includes('Diaz, Dev'));

    p.w.document.querySelector('#contact-rows [data-fix]').click();
    await p.tick();
    t('Fix opens the edit form for that family', p.$('#editModal').style.display === 'block' &&
      p.$('#fatherEmail').value === 'dad@gmail', p.$('#fatherEmail').value);

    // Editing Ben (A# stored as "100002") must update his record, not create a second one.
    p.w.editParent('A100002');
    p.$('#motherEmail').value = 'beth.new@x.com';
    p.$('#editModal form, #parentForm, form').dispatchEvent(new p.w.Event('submit', { cancelable: true, bubbles: true }));
    for (let i = 0; i < 4; i++) await p.tick();
    const benWrites = p.writes.filter(w => (w[0] === 'update' && w[2] === 'p2') || (w[0] === 'add' && w[1] === 'parents'));
    t('editing a family whose A# is stored differently updates their record',
      benWrites.length === 1 && benWrites[0][0] === 'update', JSON.stringify(benWrites.map(w => w.slice(0, 3))));
  }

  done('clean-up and contact check');
})();
