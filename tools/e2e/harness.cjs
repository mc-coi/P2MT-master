// Boot a real P2MT page in jsdom: its own markup, its own module script.
//
// The page script runs inside one private, async function scope, like a
// <script type="module"> (which may use top-level await), so only what it
// assigns to window is reachable from onclick="" — the browser's rule.
//
// A small module loader stands in for the browser's. The real shared modules
// that don't touch Firestore (utils, guardians, labInterventions, staffAlerts)
// are each loaded into their own scope as a namespace, and every import —
// in a page or a module — binds only the names it lists. So a page sees what
// it imports and nothing else, and two modules can each keep a private
// `COLLECTION`. Imports from modules that aren't loaded (db, auth, nav, data,
// attendance, tmiEngine) are dropped; those names come from the stubs below.
//
// jQuery is real (pages load it from a CDN); DataTables is a stand-in, since
// these tests are about what a page does, not how its table paginates.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');

// Loaded in this order, so a module's own imports already exist.
const LOADABLE = ['utils.js', 'guardians.js', 'labInterventions.js', 'staffAlerts.js'];
// Supplied by the harness instead of utils, so tests can observe them.
const STUBBED = new Set(['showToast', 'confirmTypedDelete']);

const IMPORT_RE = /^\s*import\s*(\{[^}]*\}|\*\s+as\s+\w+)\s*from\s*['"]([^'"]+)['"];?\s*$/gm;

function bindImports(src, loaded) {
  return src.replace(IMPORT_RE, (all, spec, from) => {
    const file = path.basename(from);
    if (!loaded.includes(file)) return '';                       // name comes from the stubs
    if (spec.startsWith('*')) return `const ${spec.split(/\s+as\s+/)[1].trim()} = __mods['${file}'];`;
    const parts = spec.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean)
      .map(x => { const [a, b] = x.split(/\s+as\s+/).map(y => y.trim()); return { from: a, to: b || a }; })
      .filter(x => !STUBBED.has(x.to));
    if (!parts.length) return '';
    return `const { ${parts.map(x => (x.from === x.to ? x.from : `${x.from}: ${x.to}`)).join(', ')} } = __mods['${file}'];`;
  });
}

function loadModule(file, loaded) {
  const src = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  const names = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const body = bindImports(src, loaded).replace(/^export\s+/gm, '');
  return `__mods['${file}'] = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();`;
}

function bootPage(page, fixtures, { inline = [], stubs = '' } = {}) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  const loaded = LOADABLE.filter(f => f === 'utils.js' || inline.includes(f));
  const pageScript = bindImports(m[1], loaded);
  // External <script src> tags can't load here; drop them and supply jQuery.
  const shell = html.replace(m[0], '').replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');

  const dom = new JSDOM(shell, { runScripts: 'dangerously', url: `https://p2mt.example/${page}` });
  const w = dom.window;
  const opened = [], toasts = [], writes = [];
  w.open = (url) => { opened.push(url); return {}; };
  w.confirm = () => false; w.alert = () => {};
  w.fetch = () => Promise.reject(new Error('no network in tests'));
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

  w.eval(`(async function () {
    const getById = async (c, id) => (window.__fixtures[c] || []).find(d => d.id === id) || null;
    const getAll = async (c) => window.__fixtures[c] || [];
    // Equality queries answered from fixtures, like the real one-field query.
    const getWhere = async (c, f, op, v) => (window.__fixtures[c] || []).filter(d => op === '==' ? d[f] === v : true);
    const getWhereMultiple = async () => [];
    const addDoc = async (c, d) => { window.__writes.push(['add', c, d]); return 'new' + window.__writes.length; };
    const setDoc = async (c, id, d) => { window.__writes.push(['set', c, id, d]); };
    const updateDoc = async (c, id, d) => { window.__writes.push(['update', c, id, d]); };
    const deleteDoc = async (c, id) => { window.__writes.push(['delete', c, id]); };
    const batchWrite = async () => {};
    const initAuth = () => Promise.resolve({ uid: 'u1', email: 'zmccoy@x.org', displayName: 'Zach McCoy' });
    const getCurrentUser = () => ({ uid: 'u1', email: 'zmccoy@x.org', displayName: 'Zach McCoy' });
    const initNav = () => {};
    const Data = { get: async (c) => window.__fixtures[c] || [] };
    ${/function\s+showToast\s*\(/.test(pageScript) ? '' : 'const showToast = (msg) => window.__toasts.push(msg);'}
    ${/function\s+confirmTypedDelete\s*\(/.test(pageScript) ? '' : 'const confirmTypedDelete = async () => true;'}
    ${stubs}
    const __mods = {};
    ${loaded.map(f => loadModule(f, loaded)).join('\n')}
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
