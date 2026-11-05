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
