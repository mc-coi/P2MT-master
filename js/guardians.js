// Who a student's parents and guardians are, for sending them email.
//
// Matching is by A# only — the same link the Parents page uses to show a
// family — so what you see on Parents is exactly who gets the email. There is
// deliberately no name-based fallback: the ER Emailer has one, and a loose
// name match ("Ann" inside "Joanna") would send a family's message to someone
// else's parent. Getting that wrong is worse than reaching nobody.
//
// The ER grid's manually-typed guardian address (guardianEmails) is used only
// when the student has no parent record with an address on it.

import { splitEmails } from './utils.js';

// "A70446", "70446" and "a70446" are the same student.
export function aNumberKeys(raw) {
  const up = String(raw || '').trim().toUpperCase();
  if (!up) return [];
  const num = up.startsWith('A') ? up.slice(1) : up;
  return [...new Set([up, num, 'A' + num])];
}

// Parent records indexed by A#, plus the ER overrides indexed by student ID.
export function buildGuardianIndex(parents = [], overrides = []) {
  const byANum = new Map();
  (parents || []).forEach(p => {
    const emails = [p.guardianEmail, p.motherEmail, p.fatherEmail].flatMap(splitEmails);
    if (!emails.length) return;
    aNumberKeys(p.chattStateANumber).forEach(k => {
      byANum.set(k, [...(byANum.get(k) || []), ...emails]);
    });
  });
  const overrideByStudent = new Map();
  (overrides || []).forEach(o => {
    const emails = splitEmails(o.email);
    if (o.studentId && emails.length) overrideByStudent.set(o.studentId, emails);
  });
  return { byANum, overrideByStudent };
}

// Distinct parent/guardian addresses for one student. Never includes the
// student's own address, which is sometimes typed into a parent field.
export function guardianEmailsFor(student, index) {
  if (!student || !index) return [];
  let emails = [];
  for (const k of aNumberKeys(student.chattStateANumber)) {
    if (index.byANum.has(k)) { emails = index.byANum.get(k); break; }
  }
  if (!emails.length) emails = index.overrideByStudent.get(student.id) || [];

  const own = String(student.email || '').trim().toLowerCase();
  const seen = new Set();
  return emails.filter(e => {
    const key = e.toLowerCase();
    if (key === own || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Everyone an intervention email to a student should reach: the student, then
// their parents/guardians. Every page that emails a student about an
// intervention (Learning Lab, TMI, ER, dress code via Email Students) builds
// its To line from this, so the rule "parents are always included" lives in
// one place. All of one family's addresses go in To — Outlook's compose link
// doesn't fill Cc/Bcc reliably — and a message never mixes families.
export function familyRecipients(student, index) {
  const own = splitEmails(student?.email || student?.studentEmail || '');
  const parents = guardianEmailsFor(student, index);
  return { own, parents, all: [...own, ...parents] };
}

// "Ann Adams <a@x> · Parents: m@x, d@y" — for a preview's To line.
export function describeRecipients(name, r) {
  const parts = [];
  if (r.own.length)     parts.push(`${name} <${r.own.join(', ')}>`);
  if (r.parents.length) parts.push(`Parents: ${r.parents.join(', ')}`);
  else if (r.own.length) parts.push('no parent email on file');
  return parts.join('  ·  ');
}

// ── Contact check ─────────────────────────────────────────────────────────────
// Every current student whose family can't be emailed properly, and why, using
// exactly the matching above — so this lists precisely the families an
// intervention email would miss. Plus parent records that match no current
// student (graduated, or an A# typo that strands the family).
//
//   no-parent-record   nothing on Parents for this A#, and no ER override
//   no-parent-email    a record exists but holds no usable address
//   bad-address        a parent field holds text that isn't an address
//                      ("N/A", "jsmith@gmail", "jsmith.gmail.com")
//   duplicate-records  two or more parent records for one student
//   no-student-email   the student has no usable address of their own
const PARENT_FIELDS = [['guardianEmail', 'Guardian'], ['motherEmail', 'Mother'], ['fatherEmail', 'Father']];
const isAddress = e => /^[^\s@;,]+@[^\s@;,]+\.[A-Za-z]{2,}$/.test(e);
const tokens = v => String(v || '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean);

export function contactProblems(students = [], parents = [], overrides = []) {
  const index = buildGuardianIndex(parents, overrides);
  const recordsByKey = new Map();
  parents.forEach(p => aNumberKeys(p.chattStateANumber).forEach(k =>
    recordsByKey.set(k, [...(recordsByKey.get(k) || []), p])));
  const recordsFor = s => {
    for (const k of aNumberKeys(s.chattStateANumber)) if (recordsByKey.has(k)) return recordsByKey.get(k);
    return [];
  };

  const rows = [];
  const matched = new Set();
  students.forEach(s => {
    const recs = [...new Set(recordsFor(s))];
    recs.forEach(r => matched.add(r));
    const issues = [];

    PARENT_FIELDS.forEach(([f, label]) => recs.forEach(r => {
      const bad = tokens(r[f]).filter(t => !isAddress(t));
      if (bad.length) issues.push({ kind: 'bad-address', detail: `${label}: "${bad.join(' ')}"` });
    }));

    const reachable = guardianEmailsFor(s, index).filter(isAddress);
    if (!recs.length && !reachable.length) issues.push({ kind: 'no-parent-record', detail: 'No parent record for this A#' });
    else if (!reachable.length) issues.push({ kind: 'no-parent-email', detail: 'Parent record has no email address' });
    if (recs.length > 1) issues.push({ kind: 'duplicate-records', detail: `${recs.length} parent records for this student` });

    const own = tokens(s.email);
    if (!own.length) issues.push({ kind: 'no-student-email', detail: 'No student email' });
    else if (!own.every(isAddress)) issues.push({ kind: 'bad-address', detail: `Student: "${s.email}"` });

    if (issues.length) rows.push({
      studentId: s.id, aNumber: s.chattStateANumber || '',
      name: `${s.lastName || ''}, ${s.firstName || ''}`, issues,
    });
  });

  const orphans = parents.filter(p => !matched.has(p)).map(p => ({
    parentId: p.id, aNumber: p.chattStateANumber || '',
    names: [p.motherName, p.fatherName].filter(Boolean).join(' / '),
    emails: PARENT_FIELDS.flatMap(([f]) => tokens(p[f])).join(', '),
  }));

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows, orphans };
}
