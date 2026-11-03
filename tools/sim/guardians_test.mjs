// Who counts as a student's parent for "send to parents".
//
// The rules that matter are the ones that stop a message reaching the wrong
// family: A#-only matching (no fuzzy name match), and the ER override used
// only when there's no parent record with an address.
import { aNumberKeys, buildGuardianIndex, guardianEmailsFor } from './guardians.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

{
  const k = v => aNumberKeys(v).sort().join('|');
  t("A70446, 70446 and a70446 are one student",
    k('A70446') === k('70446') && k('70446') === k(' a70446 '), k('A70446'));
}
t("no A# gives no keys", eq(aNumberKeys(''), []) && eq(aNumberKeys(null), []));

const parents = [
  { chattStateANumber: 'A100001', motherEmail: 'mom@x.com', fatherEmail: 'dad@y.com', guardianEmail: '' },
  { chattStateANumber: '100002',  guardianEmail: 'g1@x.com; g2@y.com' },
  { chattStateANumber: 'A100004', motherEmail: 'kid4@students.hcde.org', fatherEmail: 'DAD4@y.com', guardianEmail: 'dad4@y.com' },
  { chattStateANumber: 'A100005', motherEmail: '', fatherEmail: '' },
  // Same surname as student 6, different A#: must never be picked up for them.
  { chattStateANumber: 'A999999', studentName: 'Joanna Smith', motherEmail: 'not.your.parent@x.com' },
];
const overrides = [
  { studentId: 's5', email: 'override5@x.com' },
  { studentId: 's1', email: 'should.not.win@x.com' },
];
const idx = buildGuardianIndex(parents, overrides);
const st = (id, a, email = '') => ({ id, chattStateANumber: a, email });

t("mother and father both reached", eq(guardianEmailsFor(st('s1', 'A100001'), idx), ['mom@x.com', 'dad@y.com']));
t("a parent record wins over the ER override", !guardianEmailsFor(st('s1', 'A100001'), idx).includes('should.not.win@x.com'));
t("A# with or without the leading A still matches", eq(guardianEmailsFor(st('s2', 'A100002'), idx), ['g1@x.com', 'g2@y.com']));
t("a two-address field becomes two addresses", guardianEmailsFor(st('s2', 'A100002'), idx).length === 2);
t("the student's own address is never treated as a parent's",
  !guardianEmailsFor(st('s4', 'A100004', 'kid4@students.hcde.org'), idx).includes('kid4@students.hcde.org'),
  JSON.stringify(guardianEmailsFor(st('s4', 'A100004', 'kid4@students.hcde.org'), idx)));
{
  // Whichever spelling is read first is kept; what matters is that it's once.
  const got = guardianEmailsFor(st('s4', 'A100004', 'kid4@students.hcde.org'), idx);
  t("the same parent typed twice, in different case, appears once",
    got.length === 1 && got[0].toLowerCase() === 'dad4@y.com', JSON.stringify(got));
}
t("a parent record with no addresses falls back to the ER override",
  eq(guardianEmailsFor(st('s5', 'A100005'), idx), ['override5@x.com']));
t("no record and no override reaches nobody", eq(guardianEmailsFor(st('s6', 'A100006'), idx), []));
t("there is no name-based guessing",
  eq(guardianEmailsFor({ id: 's6', chattStateANumber: 'A100006', firstName: 'Ann', lastName: 'Smith' }, idx), []));
t("a student with no A# reaches nobody unless overridden", eq(guardianEmailsFor(st('s7', ''), idx), []));
t("empty inputs don't throw",
  eq(guardianEmailsFor(st('s1', 'A100001'), buildGuardianIndex()), []) && eq(guardianEmailsFor(null, idx), []));

console.log(fails ? `\n${fails} FAILED` : "\nAll guardian-matching tests passed.");
