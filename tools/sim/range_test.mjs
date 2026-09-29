// The remembering helpers run in the browser, so give them a localStorage.
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
const { rememberRange, recallRange, forgetRange } = await import('/sessions/bold-loving-cray/mnt/P2MT-master/js/utils.js');

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }

t("nothing remembered yet", recallRange('tmi-review') === null);

rememberRange('tmi-review', '2026-09-16', '2026-09-22');
const got = recallRange('tmi-review');
t("a chosen range comes back", got && got.start === '2026-09-16' && got.end === '2026-09-22', JSON.stringify(got));

rememberRange('tmi-roster', '2026-09-09', '2026-09-15');
t("pages remember separately",
  recallRange('tmi-review').start === '2026-09-16' && recallRange('tmi-roster').start === '2026-09-09');

forgetRange('tmi-review');
t("Clear forgets it", recallRange('tmi-review') === null);
t("and leaves the other page alone", recallRange('tmi-roster') !== null);

// Staleness: a range saved 13 hours ago must not pin an old week.
const stale = JSON.parse(mem.get('p2mt:range:tmi-roster'));
stale.at = Date.now() - 13 * 3600 * 1000;
mem.set('p2mt:range:tmi-roster', JSON.stringify(stale));
t("a stale choice is ignored so the default week returns", recallRange('tmi-roster') === null);
t("and the stale entry is cleaned up", !mem.has('p2mt:range:tmi-roster'));

rememberRange('x', '2026-09-16', '2026-09-22');
const fresh = JSON.parse(mem.get('p2mt:range:x'));
fresh.at = Date.now() - 11 * 3600 * 1000;
mem.set('p2mt:range:x', JSON.stringify(fresh));
t("still remembered within the window", recallRange('x') !== null);

rememberRange('y', '', '2026-09-22');
t("a half-filled range is not stored", recallRange('y') === null);

mem.set('p2mt:range:bad', 'not json');
t("corrupt storage is survived, not thrown", recallRange('bad') === null);

// Private mode: localStorage throws on write.
globalThis.localStorage = { getItem(){ throw new Error('denied'); }, setItem(){ throw new Error('denied'); }, removeItem(){ throw new Error('denied'); } };
let threw = false;
try { rememberRange('z', '2026-09-16', '2026-09-22'); recallRange('z'); forgetRange('z'); } catch (_) { threw = true; }
t("storage being unavailable never breaks the page", !threw);

console.log(fails ? `\n${fails} FAILED` : "\nAll range-memory tests passed.");
