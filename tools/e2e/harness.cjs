// Boot a real P2MT page in jsdom: its own markup, its own module script.
//
// The page script runs inside one private function scope, exactly like a
// <script type="module">, so only what it assigns to window is reachable from
// onclick="" — the same rule the browser applies.
//
// Imports are replaced, not faked wholesale: shared modules that don't touch
// Firestore (utils, guardians, labInterventions) are the real files, inlined.
// Firestore, auth and nav are stubbed; reference data comes from fixtures.
// jQuery is real (pages load it from a CDN); DataTables is a stand-in, since
// these tests are about what the page does, not how the table paginates.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');

const moduleSource = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')
  .replace(/^\s*import[^;]*;\s*$/gm, '')
  .replace(/^export\s+/gm, '');

function bootPage(page, fixtures, { inline = [], stubs = '' } = {}) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  // Imports are stripped, but a renamed import (\`mailMergeCell as tmiCsvCell\`)
  // must keep working under the page's name for it.
  const aliases = [];
  for (const imp of m[1].matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of imp[1].split(',')) {
      const am = part.trim().match(/^(\w+)\s+as\s+(\w+)$/);
      if (am) aliases.push(`const ${am[2]} = ${am[1]};`);
    }
  }
  const pageScript = aliases.join('\n') + '\n' + m[1].replace(/^\s*import[^;]*;\s*$/gm, '');
  // External <script src> tags can't load here; drop them and supply jQuery.
  const shell = html.replace(m[0], '').replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');

  const dom = new JSDOM(shell, { runScripts: 'dangerously', url: `https://p2mt.example/${page}` });
  const w = dom.window;
  const opened = [], toasts = [], writes = [];
  w.open = (url) => { opened.push(url); return {}; };
  w.__toasts = toasts; w.__fixtures = fixtures; w.__writes = writes;
  // Anything the page logs as an error — including a throw while starting —
  // is recorded, so a half-booted page can't pass a test by accident.
  const bootErrors = [];
  w.console.error = (...a) => { bootErrors.push(a.map(String).join(' ')); };
  w.addEventListener('error', e => bootErrors.push(String(e.message)));

  w.eval(fs.readFileSync(require.resolve('jquery'), 'utf8'));
  w.eval(`
    jQuery.fn.DataTable = function () {
      const api = { destroy(){}, draw(){ return api; }, clear(){ return api; }, rows: { add(){ return api; } },
                    search(){ return api; }, column(){ return api; }, page(){ return api; }, on(){ return api; } };
      return api;
    };
    jQuery.fn.DataTable.isDataTable = () => false;
    jQuery.fn.DataTable.ext = { search: [] };
    jQuery.fn.dataTable = jQuery.fn.DataTable;
  `);

  const realUtils = moduleSource('utils.js')
    .replace(/function showToast\(/, 'function __realShowToast(')
    .replace(/function confirmTypedDelete\(/, 'function __realConfirm(');

  w.eval(`(function () {
    const getById = async (c, id) => (window.__fixtures[c] || []).find(d => d.id === id) || null;
    const getAll = async (c) => window.__fixtures[c] || [];
    const getWhere = async () => [], getWhereMultiple = async () => [];
    const addDoc = async (c, d) => { window.__writes.push(['add', c, d]); return 'new' + window.__writes.length; };
    const setDoc = async (c, id, d) => { window.__writes.push(['set', c, id, d]); };
    const updateDoc = async (c, id, d) => { window.__writes.push(['update', c, id, d]); };
    const deleteDoc = async (c, id) => { window.__writes.push(['delete', c, id]); };
    const batchWrite = async () => {};
    const initAuth = () => Promise.resolve({ uid: 'u1', email: 'zmccoy@x.org', displayName: 'Zach McCoy' });
    const getCurrentUser = () => ({ uid: 'u1', email: 'zmccoy@x.org', displayName: 'Zach McCoy' });
    const initNav = () => {};
    const Data = { get: async (c) => window.__fixtures[c] || [] };
    ${realUtils}
    const showToast = (msg) => window.__toasts.push(msg);
    const confirmTypedDelete = async () => true;
    ${inline.map(moduleSource).join('\n')}
    ${stubs}
    ${pageScript}
  })();`);

  return { w, $: s => w.document.querySelector(s), opened, toasts, writes, bootErrors,
           tick: () => new Promise(r => setTimeout(r, 40)) };
}

function makeT() {
  let fails = 0;
  const t = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d ? ' :: ' + d : '')); if (!c) fails++; };
  // Pages keep timers running (the TMI roster's live "in since" clock), which
  // would keep the simulator alive forever, so finishing exits explicitly.
  return { t, done: (label) => {
    console.log(fails ? `\n${fails} FAILED` : `\nAll ${label} tests passed.`);
    process.exit(fails ? 1 : 0);
  } };
}

// Shared fixtures: a student with two parents, one whose parent field holds
// two addresses, and one with no parent on file.
const FAMILIES = {
  students: [
    { id: 's1', firstName: 'Ann',  lastName: 'Adams', chattStateANumber: 'A100001', email: 'aa@students.hcde.org' },
    { id: 's2', firstName: 'Ben',  lastName: 'Brown', chattStateANumber: 'A100002', email: 'bb@students.hcde.org' },
    { id: 's3', firstName: 'Cara', lastName: 'Cole',  chattStateANumber: 'A100003', email: 'cc@students.hcde.org' },
  ],
  parents: [
    { chattStateANumber: 'A100001', motherEmail: 'mom.adams@x.com', fatherEmail: 'dad.adams@y.com' },
    { chattStateANumber: '100002',  guardianEmail: 'grandma.brown@x.com; uncle.brown@y.com' },
  ],
  guardianEmails: [],
};

module.exports = { bootPage, makeT, FAMILIES };
