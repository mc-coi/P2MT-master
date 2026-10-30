// The Assign Intervention modal warns, as soon as a category is picked, that
// the student already has interventions in it — the level that's appropriate
// depends on what came before, and that history used to be two clicks away in
// a different modal.
//
// The function is lifted out of students.html so the real code is what's
// tested rather than a copy of it.
import fs from 'fs';
import { escapeHtml } from './utils.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }

const src = fs.readFileSync(new URL('../../students.html', import.meta.url), 'utf8');
const code = src.slice(
  src.indexOf('    // Everything this student already has in one category'),
  src.indexOf('    function updateLevelOptions() {'));
if (!code) { console.log('FAIL - could not find showPriorInterventionNote in students.html'); process.exit(1); }

function run(history, category, studentId = 's1') {
  const el = { style: {}, innerHTML: '', className: '' };
  const document = { getElementById: id => id === 'int-prior-note' ? el : { value: category } };
  new Function('document', 'interventionsData', 'assignStudentId', 'escapeHtml',
    code + '\nshowPriorInterventionNote();')(document, history, studentId, escapeHtml);
  return { shown: el.style.display === 'block', warn: el.className.includes('ipn-clear') === false, html: el.innerHTML };
}
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const history = [
  { studentId:'s1', category:'Dress Code', level:1, dateTime:'2026-09-14T08:40', comments:'Hoodie' },
  { studentId:'s1', category:'Dress Code', level:1, dateTime:'2026-10-12T09:05', comments:'Wrong shoes' },
  { studentId:'s1', category:'Dress Code', level:2, dateTime:'2026-10-28T08:35', comments:'' },
  { studentId:'s1', category:'Dress Code', level:1, dateTime:'2026-08-29T10:00', comments:'' },
  { studentId:'s1', category:'Conduct',    level:1, dateTime:'2026-10-01T13:00', comments:'' },
  { studentId:'s2', category:'Dress Code', level:3, dateTime:'2026-10-20T08:00', comments:'' },
];

{
  const r = run(history, 'Dress Code');
  t("a repeat offence is flagged", r.shown && r.warn);
  t("it counts only that category", text(r.html).startsWith('4 prior Dress Code interventions'), text(r.html).slice(0, 48));
  t("it names the highest level reached", text(r.html).includes('highest so far is Level 2'));
  t("the newest is listed first", text(r.html).indexOf('Oct 28') < text(r.html).indexOf('Oct 12'));
  t("at most three are listed, with a count of the rest",
    (r.html.match(/<li>/g) || []).length === 4 && text(r.html).includes('and 1 earlier'));
}

{
  const r = run(history, 'Conduct');
  t("one prior reads as singular", text(r.html).includes('1 prior Conduct intervention —'), text(r.html));
}

{
  const r = run(history, 'Academic');
  t("a clean category says so, in green rather than amber", r.shown && !r.warn);
  t("and names the category", text(r.html) === 'No prior Academic interventions for this student.', text(r.html));
}

t("nothing shows before a category is picked", !run(history, '').shown);
t("another student's history is not borrowed",
  text(run(history, 'Dress Code', 's2').html).startsWith('1 prior Dress Code intervention'),
  text(run(history, 'Dress Code', 's2').html));
t("a student with no record at all is clean", !run(history, 'Dress Code', 's99').warn);
t("an empty collection doesn't throw", !run([], 'Dress Code').warn);

// Comments come from a free-text box and go straight into markup.
{
  const r = run([{ studentId:'s1', category:'Dress Code', level:1, dateTime:'2026-10-01T08:00',
                   comments:'<img src=x onerror=alert(1)> "quoted"' }], 'Dress Code');
  t("a comment can't inject markup", !r.html.includes('<img'), r.html.slice(-120));
  t("quotes in a comment are escaped", r.html.includes('&quot;quoted&quot;'));
}

// A record saved before dateTime existed, or with a broken one.
{
  const r = run([{ studentId:'s1', category:'Dress Code', level:1, dateTime:'', comments:'' }], 'Dress Code');
  t("a missing date degrades to 'unknown date' rather than 'Invalid Date'",
    text(r.html).includes('unknown date'), text(r.html));
}

console.log(fails ? `\n${fails} FAILED` : "\nAll prior-intervention tests passed.");
