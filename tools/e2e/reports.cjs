// Reports: every figure checked against data whose right answers are known.
// Chart.js is replaced by a recorder, so each chart's labels/data/colours/axes
// can be inspected exactly as the page built them.
const { bootPage, makeT } = require('./harness.cjs');
const { t, done } = makeT();

const students = [
  { id: 's1', firstName: 'Ann',  lastName: 'Adams', chattStateANumber: 'A100001', house: 'Tesla',      yearOfGraduation: '2027' },
  { id: 's2', firstName: 'Ben',  lastName: 'Brown', chattStateANumber: 'A100002', house: 'Telsa',      yearOfGraduation: '2027' },
  { id: 's3', firstName: 'Cara', lastName: 'Cole',  chattStateANumber: 'A100003', house: 'Staupers',   yearOfGraduation: '2028' },
  { id: 's4', firstName: 'Dev',  lastName: 'Diaz',  chattStateANumber: 'A100004', house: 'Einstein',   yearOfGraduation: '2028' },
  { id: 's5', firstName: 'Eve',  lastName: 'Ems',   chattStateANumber: 'A100005', house: 'Mirzakhani', yearOfGraduation: '2029' },
  { id: 's6', firstName: 'Fay',  lastName: 'Fox',   chattStateANumber: 'A100006', house: '',           yearOfGraduation: '' },
];
const D = '2026-10-14';   // a Wednesday inside the fall semester of 2026-2027

const classLogs = [
  { studentId: 's1', chattStateANumber: 'A100001', classDate: D, attendanceCode: 'U', className: 'Algebra', teacherLastName: 'Jaynes' },
  { studentId: 's1', chattStateANumber: 'A100001', classDate: D, attendanceCode: 'T', className: 'Biology', teacherLastName: 'Wineland' },
  { studentId: '',   chattStateANumber: 'a100002 ', classDate: D, attendanceCode: 'U', className: 'Algebra', teacherLastName: 'Jaynes' },   // A# only, odd case
  { studentId: 's3', chattStateANumber: 'A100003', classDate: D, attendanceCode: 'U', className: 'Extended Remediation', teacherLastName: 'McCoy' },
  { studentId: 'gone', chattStateANumber: 'A999999', classDate: D, attendanceCode: 'U', className: 'Algebra', teacherLastName: 'Jaynes' }, // left the school
  { studentId: 's4', chattStateANumber: 'A100004', classDate: D, attendanceCode: 'U', className: '', teacherLastName: '' },                  // no class
];
const dailyLogs = [
  { chattStateANumber: 'A100001', absenceDate: D, attendanceCode: 'U' },                // same day as a class absence → not double-counted
  { chattStateANumber: 'A100005', absenceDate: '2026-10-15', attendanceCode: 'MC' },    // not an absence code
];

const tmiLogs = [
  // s1: 240 assigned; 60 served via a sitting, while the stale stored field still says 0
  { id: 'T1', interventionType: 'TMI', studentId: 's1', chattStateANumber: 'A100001', startDate: D, tmiMinutes: 240,
    tmiMinutesServed: 0, servedBase: 0, sessions: [{ minutes: 60 }], interventionStatus: 'Reviewed',
    teachers: ['Jaynes', 'McCoy'], teacherLastName: 'Jaynes', className: 'Algebra' },
  // s1 again, same week range: still one student
  { id: 'T2', interventionType: 'TMI', studentId: 's1', startDate: '2026-10-21', tmiMinutes: 30, tmiMinutesServed: 30,
    interventionStatus: 'Closed', teacherLastName: 'McCoy' },
  // s2 by A# only, manual TMI saved as "Pending"
  { id: 'T3', interventionType: 'TMI', studentId: '', chattStateANumber: 'A100002', startDate: D, tmiMinutes: 120,
    tmiMinutesServed: 0, interventionStatus: 'Pending' },
  // a student no longer on the roster
  { id: 'T4', interventionType: 'TMI', studentId: 'gone', startDate: D, tmiMinutes: 120, interventionStatus: 'Reviewed', teacherLastName: 'Jaynes' },
];

const interventions = [
  { studentId: 's1', category: 'Dress Code', level: 1, dateTime: D + 'T09:00' },
  { studentId: 's2', category: 'Dress Code', level: 3, dateTime: D + 'T09:00' },
  { studentId: 's2', category: 'Academic',   level: 2, dateTime: D + 'T09:00' },
  { studentId: 's3', category: '',           level: 1, dateTime: D + 'T09:00' },   // no category
  { studentId: 'gone', category: 'Conduct',  level: 1, dateTime: D + 'T09:00' },   // left
  // one each for the other houses, so every house colour is on a chart
  { studentId: 's3', category: 'Conduct', level: 1, dateTime: D + 'T10:00' },
  { studentId: 's4', category: 'Conduct', level: 1, dateTime: D + 'T10:00' },
  { studentId: 's5', category: 'Conduct', level: 1, dateTime: D + 'T10:00' },
];

const PK = '2026-10-12_2026-10-16';
const erAssignments = [
  { studentId: 's1', periodKey: PK, workshopIds: ['w1', 'w2', 'w3'] },
  { studentId: 's1', periodKey: '2026-10-19_2026-10-23', workshopIds: ['w1'] },   // same class again, later period
  { studentId: 's2', periodKey: PK, workshopIds: ['w1', 'wDeleted'] },            // a class since deleted
  { studentId: 's3', periodKey: PK, workshopIds: ['wER'] },                       // only "Extended Remediation"
  { studentId: 'gone', periodKey: PK, workshopIds: ['w1'] },
];
const erWorkshops = [
  { id: 'w1', name: 'English 3' }, { id: 'w2', name: 'Precal' }, { id: 'w3', name: 'Biology' },
  { id: 'wER', name: 'Extended Remediation' },
];
const erClearance = [
  { studentId: 's1', periodKey: PK, teacherLastName: 'Jaynes', className: 'Algebra' },
  { studentId: 's2', periodKey: PK, teacherLastName: 'Jaynes', className: 'Geometry' },   // same teacher, other class
  { studentId: 's1', periodKey: PK, teacherLastName: 'Wineland', className: 'Biology' },
  { studentId: 's2', periodKey: PK, teacherLastName: '', className: 'Precal' },           // no teacher
  { studentId: 's3', teacherLastName: 'Hale', className: 'Art' },                         // no period
];

const stubs = `
  const fetchClassLogs = async () => window.__fixtures.classLogs;
  const fetchDailyLogs = async () => window.__fixtures.dailyLogs;
  const ABSENCE_CODES = ['U','T','E'];
  // Same rule as tmiEngine.servedSummary for these fixtures.
  const servedSummary = (r) => {
    const s = r.sessions || [];
    const base = Number.isFinite(r.servedBase) ? r.servedBase : (s.length ? 0 : (r.tmiMinutesServed || 0));
    const served = base + s.reduce((n, x) => n + (x.minutes || 0), 0);
    return { served, remaining: Math.max(0, (r.tmiMinutes||0) - served) };
  };
`;

(async () => {
  const p = bootPage('reports.html', {
    students, classLogs, dailyLogs, erWorkshops,
    interventionLogs: tmiLogs, studentInterventions: interventions,
    erAssignments, erClearance,
  }, { inline: ['labInterventions.js'], stubs });

  // Chart.js stand-in: remember each chart's config by canvas id.
  const charts = {};
  p.w.Chart = class { constructor(ctx, cfg) { charts[ctx.id] = cfg; } destroy() {} };
  p.$('#fil-year').value = '2026-2027';
  p.$('#fil-sem').value = 'fall';
  await p.w.runReports();
  for (let i = 0; i < 3; i++) await p.tick();
  t('Reports runs without errors', p.bootErrors.length === 0, p.bootErrors.slice(0, 3).join(' | '));

  const text = id => p.$('#' + id).textContent.trim();
  const chart = id => charts[id] || { data: { labels: [], datasets: [{ data: [] }] }, options: {} };
  const pairs = id => Object.fromEntries(chart(id).data.labels.map((l, i) => [l, chart(id).data.datasets[0].data[i]]));
  const rows = id => [...p.w.document.querySelectorAll(`#${id} tbody tr`)].map(tr => [...tr.cells].map(c => c.textContent.trim()));
  const noUnknown = id => !chart(id).data.labels.some(l => /unknown/i.test(String(l)));

  // ── Attendance ──
  t('attendance total: departed student and MC left out, same-day daily not doubled', text('att-total') === '5', text('att-total'));
  t('unique students counts only roster students, A#-only resolved', text('att-students') === '4', text('att-students'));
  const missed = pairs('chart-att-classes');
  t('Extended Remediation is not ranked as a class', !Object.keys(missed).some(k => /remediation/i.test(k)), JSON.stringify(missed));
  t('a record with no class is not shown as "Unknown"', noUnknown('chart-att-classes'));
  t('Algebra counts both current students, including the A#-only one', missed['Algebra (Jaynes)'] === 2, JSON.stringify(missed));
  const attTop = rows('tbl-att-students');
  t('Top 10 has no unknown or departed students', attTop.every(r => r[1] && !/unknown/i.test(r[1])) && attTop.length === 4, JSON.stringify(attTop));
  t('names are Last, First', attTop[0][1] === 'Adams, Ann', attTop[0][1]);
  t('the A#-only absence belongs to Ben', attTop.find(r => r[1] === 'Brown, Ben')?.[2] === '1');

  // ── TMI ──
  t('TMI students: departed student left out', text('tmi-students') === '2', text('tmi-students'));
  t('TMI assigned: current students only', text('tmi-assigned') === '390', text('tmi-assigned'));
  t('TMI served comes from sign-in sittings, not the stale field', text('tmi-served') === '90', text('tmi-served'));
  t('TMI remaining = assigned − served', text('tmi-remaining') === '300', text('tmi-remaining'));
  const status = pairs('chart-tmi-status');
  t('"Pending" manual TMI is counted under Pending Review', status['Pending Review'] === 1 && status['Reviewed'] === 1 && status['Closed'] === 1, JSON.stringify(status));
  const tmiHouse = pairs('chart-tmi-house');
  t('Telsa is counted as Tesla, students once each', tmiHouse['Tesla'] === 2 && !('Telsa' in tmiHouse), JSON.stringify(tmiHouse));
  t('no Unknown house on TMI', noUnknown('chart-tmi-house'));
  const teachers = pairs('chart-tmi-class');
  t('TMI by teacher uses every teacher on a record', teachers['Jaynes'] === 1 && teachers['McCoy'] === 2, JSON.stringify(teachers));
  t('TMI by teacher shows no class names', !Object.keys(teachers).some(k => /\(/.test(k)));
  const tmiTop = rows('tbl-tmi-students');
  t('TMI Top 10 combines a student\'s records', tmiTop[0][1] === 'Adams, Ann' && tmiTop[0][2] === '270' && tmiTop[0][3] === '90', JSON.stringify(tmiTop[0]));

  // ── Interventions ──
  t('interventions: no category / departed left out', text('int-total') === '6', text('int-total'));
  const intHouse = pairs('chart-int-house');
  t('interventions by house merges Telsa', intHouse['Tesla'] === 3, JSON.stringify(intHouse));
  t('no Unknown categories', noUnknown('chart-int-cat') && noUnknown('chart-int-level'));

  // ── ER ──
  t('ER total skips deleted classes and Extended Remediation itself', text('er-total') === '5', text('er-total'));
  t('ER students: only those with a real class', text('er-students') === '2', text('er-students'));
  const ws = pairs('chart-er-workshops');
  t('Most Assigned has no Extended Remediation or raw IDs', !Object.keys(ws).some(k => /remediation|wDeleted|wER/i.test(k)), JSON.stringify(ws));
  t('Most Assigned counts English 3 across periods', ws['English 3'] === 3, JSON.stringify(ws));
  const erT = pairs('chart-er-class');
  t('Teacher chart combines a teacher\'s classes', erT['Jaynes'] === 2 && erT['Wineland'] === 1, JSON.stringify(erT));
  t('Teacher chart has no blank or undated entries', Object.keys(erT).length === 2, JSON.stringify(erT));
  const erTop = rows('tbl-er-students');
  t('Top 10 ER shows only classes count', erTop.every(r => r.length === 3), JSON.stringify(erTop));
  t('Ann has ER in 3 distinct classes', erTop[0][1] === 'Adams, Ann' && erTop[0][2] === '3', JSON.stringify(erTop[0]));
  t('Ben has 1 (the deleted class is not counted)', erTop[1][2] === '1', JSON.stringify(erTop[1]));
  t('table header says Classes with ER', p.$('#tbl-er-students thead').textContent.includes('Classes with ER') &&
    !p.$('#tbl-er-students thead').textContent.includes('Assignments'));

  // ── axes and colours ──
  const intAxis = id => { const sc = chart(id).options.scales || {}; return (sc.x?.ticks?.precision === 0) || (sc.y?.ticks?.precision === 0); };
  t('Most Assigned axis is whole numbers only', intAxis('chart-er-workshops'));
  t('every bar chart axis is whole numbers only',
    ['chart-att-classes','chart-att-dow','chart-att-month','chart-tmi-house','chart-tmi-grade','chart-tmi-class',
     'chart-int-cat','chart-int-house','chart-int-level','chart-er-workshops','chart-er-class'].every(intAxis));
  const colorOf = (id, h) => { const c = chart(id); return c.data.datasets[0].backgroundColor[c.data.labels.indexOf(h)]; };
  t('Tesla is green',          colorOf('chart-int-house', 'Tesla') === '#16A34A');
  t('Staupers is red',         colorOf('chart-int-house', 'Staupers') === '#DC2626');
  t('Einstein is purple',      colorOf('chart-int-house', 'Einstein') === '#7C3AED');
  t('Mirzakhani is turquoise', colorOf('chart-int-house', 'Mirzakhani') === '#1CC6B5');
  t('Tesla is green on the TMI chart too', colorOf('chart-tmi-house', 'Tesla') === '#16A34A');
  t('a student with no house is left off the house chart', !chart('chart-int-house').data.labels.includes(''));

  done('Reports');
})();
