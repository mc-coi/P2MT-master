// One guardian field can hold two addresses — "a@x.org; b@y.com" is how a
// household with two parents gets typed in. The mail merge treated the whole
// cell as a single recipient, so that row reached nobody: a real ER
// notification for one student went undelivered.
//
// splitEmails() is the single point every outgoing address passes through.
// It is lifted out of er-emailer.html here so the real code is what's tested.
import fs from 'fs';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }

const src = fs.readFileSync(new URL('../../er-emailer.html', import.meta.url), 'utf8');
const start = src.indexOf('    function splitEmails(raw) {');
const end = src.indexOf('\n    }\n', start) + 7;
if (start < 0) { console.log('FAIL - could not find splitEmails in er-emailer.html'); process.exit(1); }
const splitEmails = new Function(src.slice(start, end) + '\n return splitEmails;')();

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

t("the real-world case: two parents in one cell",
  eq(splitEmails('lori.foster1@ascension.org; dampssadd@gmail.com'),
     ['lori.foster1@ascension.org', 'dampssadd@gmail.com']),
  JSON.stringify(splitEmails('lori.foster1@ascension.org; dampssadd@gmail.com')));

t("a single address is unchanged", eq(splitEmails('a@x.org'), ['a@x.org']));
t("commas separate too", eq(splitEmails('a@x.org, b@y.com'), ['a@x.org', 'b@y.com']));
t("so does a bare space", eq(splitEmails('a@x.org b@y.com'), ['a@x.org', 'b@y.com']));
t("surrounding whitespace is trimmed", eq(splitEmails('  a@x.org  '), ['a@x.org']));
t("empty gives nothing", eq(splitEmails(''), []) && eq(splitEmails(null), []) && eq(splitEmails(undefined), []));
t("a cell of only punctuation gives nothing", eq(splitEmails(' ; , '), []));
t("something that isn't an address is dropped, not mailed",
  eq(splitEmails('none on file'), []), JSON.stringify(splitEmails('none on file')));
t("a good address survives alongside junk",
  eq(splitEmails('unknown; b@y.com'), ['b@y.com']));
t("three addresses all come through",
  eq(splitEmails('a@x.org;b@y.com,c@z.net'), ['a@x.org', 'b@y.com', 'c@z.net']));

// ── What the export does with it ──
function mergeRows(students, guardianEmails) {
  const rows = ['Email,Subject,Body'];
  students.forEach(s => {
    if (s.email) rows.push(`${s.email},Subj,Body`);
    splitEmails(guardianEmails[s.id]).forEach(addr => rows.push(`${addr},Subj,Body`));
  });
  return rows;
}

{
  const students = [{ id: 's1', email: 'kid@students.hcde.org' }, { id: 's2', email: '' }];
  const rows = mergeRows(students, { s1: 'lori.foster1@ascension.org; dampssadd@gmail.com', s2: 'solo@x.org' });
  t("the two-parent cell becomes two rows", rows.length === 1 + 1 + 2 + 1, JSON.stringify(rows.slice(1)));
  t("both parents are addressed separately",
    rows.includes('lori.foster1@ascension.org,Subj,Body') && rows.includes('dampssadd@gmail.com,Subj,Body'));
  t("a student with no address of their own is still skipped, not blanked",
    !rows.some(r => r.startsWith(',')));
}

// ── mailto cc wants commas, never semicolons ──
t("cc is comma-joined for the mail client",
  splitEmails('a@x.org; b@y.com').join(',') === 'a@x.org,b@y.com');

// ── What gets stored back when someone edits the field ──
function normalise(typed) {
  const parts = splitEmails(typed);
  return parts.length ? parts.join('; ') : typed;
}
t("editing normalises the separators", normalise('a@x.org,b@y.com') === 'a@x.org; b@y.com');
t("a half-typed entry is kept as typed rather than wiped",
  normalise('jsmith@') === 'jsmith@', normalise('jsmith@'));

console.log(fails ? `\n${fails} FAILED` : "\nAll guardian-email tests passed.");

// ── The file has to be one physical line per recipient ────────────────────
// Word's mail merge counts lines, not CSV records, so a line break inside a
// quoted Body field breaks the merge even though the file is valid CSV and
// opens correctly in Excel. The ER export hit this; the TMI export already
// avoided it. They now share one helper.
{
  const { mailMergeCell } = await import('./utils.js');

  const body = 'Hadil is required to attend.\n\nThe reason is:\n\nEnglish 3\n\nThank you.';
  const cell = mailMergeCell(body);
  t("no line break survives into the file", !/[\r\n]/.test(cell), JSON.stringify(cell.slice(0, 40)));
  t("they become vertical tabs, which Word draws as line breaks",
    (cell.match(/\v/g) || []).length === 6, String((cell.match(/\v/g) || []).length));
  t("the field is quoted", cell.startsWith('"') && cell.endsWith('"'));
  t("CRLF collapses to one break, not two",
    (mailMergeCell('a\r\nb').match(/\v/g) || []).length === 1);
  t("a lone CR counts too", (mailMergeCell('a\rb').match(/\v/g) || []).length === 1);
  t("quotes are doubled", mailMergeCell('say "hi"') === '"say ""hi"""');
  t("null and undefined give an empty field",
    mailMergeCell(null) === '""' && mailMergeCell(undefined) === '""');
  t("a comma stays inside the quotes", mailMergeCell('a,b') === '"a,b"');

  // A whole file: physical lines must equal rows.
  const rows = ['Email,Subject,Body'];
  for (let i = 0; i < 5; i++) {
    rows.push([mailMergeCell(`p${i}@x.org`), mailMergeCell('Subject – ER'), mailMergeCell(body)].join(','));
  }
  const file = rows.join('\r\n');
  t("155-style file: one physical line per record",
    file.split('\r\n').length === 6 && !/[^\r]\n/.test(file), String(file.split('\r\n').length));
}
console.log(fails ? `\n${fails} FAILED (incl. mail-merge cell)` : "Mail-merge cell tests passed.");
