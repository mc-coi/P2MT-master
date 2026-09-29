// The app stores a student's name in one order: "Last, First". Pages that
// wrote "First Last" put the same student on the TMI Roster twice, filed
// under two different letters ("Bradshaw, Elijah" and "Elijah Bradshaw").
import { studentDisplayName } from './utils.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }

const elijah = { firstName: 'Elijah', lastName: 'Bradshaw' };
t("a student record formats Last, First", studentDisplayName(elijah) === 'Bradshaw, Elijah', studentDisplayName(elijah));
t("whitespace is trimmed", studentDisplayName({ firstName: ' Elijah ', lastName: ' Bradshaw ' }) === 'Bradshaw, Elijah');
t("a record written First Last is re-rendered in order",
  studentDisplayName(elijah, 'Elijah Bradshaw') === 'Bradshaw, Elijah');

// The roster and TMI Review pass the stored string as the fallback, for a
// record whose student has since left and is no longer in the roster.
t("an unknown student keeps whatever was stored",
  studentDisplayName(undefined, 'Elijah Bradshaw') === 'Elijah Bradshaw');
t("a null student keeps whatever was stored",
  studentDisplayName(null, 'Bradshaw, Elijah') === 'Bradshaw, Elijah');
t("nothing at all is an empty string, not 'undefined'", studentDisplayName(null) === '');
t("a surname on its own stands alone, with no stray comma",
  studentDisplayName({ lastName: 'Bradshaw' }) === 'Bradshaw');
t("a first name on its own stands alone too",
  studentDisplayName({ firstName: 'Elijah' }) === 'Elijah');
t("an empty record falls back rather than returning a comma",
  studentDisplayName({ firstName: '', lastName: '' }, 'A00408288') === 'A00408288');

console.log(fails ? `\n${fails} FAILED` : "\nAll student-name tests passed.");
