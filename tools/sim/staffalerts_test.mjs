// Staff alerts: who gets them, what triggers them, and that they expire.
import { store, resetStats, stats } from './db.js';
import { shouldAlert, getAlertRecipients, setAlertRecipients, sendInterventionAlert,
         loadMyAlerts, dismissAlert, alertHeadline, ALERT_DAYS } from './staffAlerts.js';

let fails = 0;
function t(n, c, d) { console.log((c ? "PASS" : "FAIL") + " - " + n + (d ? " :: " + d : "")); if (!c) { fails++; process.exitCode = 1; } }
function reset() { for (const k in store) store[k] = []; resetStats(); }

// ── what triggers an alert ──
t("Level 2 Academic alerts", shouldAlert({ category: 'Academic', level: 2 }));
t("level as a string still counts", shouldAlert({ category: 'Academic', level: '2' }));
t("Level 3 Dress Code alerts", shouldAlert({ category: 'Dress Code', level: 3 }));
t("Level 1 Academic does not", !shouldAlert({ category: 'Academic', level: 1 }));
t("Level 3 Academic does not (only what was asked for)", !shouldAlert({ category: 'Academic', level: 3 }));
t("Level 2 Dress Code does not", !shouldAlert({ category: 'Dress Code', level: 2 }));
t("other categories do not", !shouldAlert({ category: 'Conduct', level: 3 }));
t("nothing doesn't throw", !shouldAlert(null));

// ── recipients ──
reset();
{
  t("no settings yet means nobody", (await getAlertRecipients()).length === 0);
  const saved = await setAlertRecipients([' ZMcCoy@x.org ', 'aw@x.org', 'zmccoy@x.org', 'not-an-email', '']);
  t("recipients are cleaned: trimmed, lower-cased, deduped, invalid dropped",
    JSON.stringify(saved) === JSON.stringify(['zmccoy@x.org', 'aw@x.org']), JSON.stringify(saved));
  t("and read back the same", JSON.stringify(await getAlertRecipients()) === JSON.stringify(saved));
}

// ── sending ──
reset();
{
  const none = await sendInterventionAlert({ interventionId: 'i1', studentId: 's1', studentName: 'Adams, Ann',
                                             category: 'Academic', level: 2 });
  t("with no recipients set, nothing is written", none === 0 && store.staffAlerts.length === 0);

  await setAlertRecipients(['zmccoy@x.org', 'aw@x.org']);
  const now = new Date('2026-11-05T10:00:00');
  const n = await sendInterventionAlert({ interventionId: 'i1', studentId: 's1', studentName: 'Adams, Ann',
                                          category: 'Academic', level: 2, reason: 'Second Learning Lab',
                                          createdBy: 'Zach McCoy', now });
  t("one alert per recipient", n === 2 && store.staffAlerts.length === 2);
  const a = store.staffAlerts.find(x => x.forEmail === 'aw@x.org');
  t("addressed by email", !!a);
  t("carries what Home needs", a.studentName === 'Adams, Ann' && a.studentId === 's1' && a.level === 2 && a.category === 'Academic');
  const days = (new Date(a.expiresAt) - new Date(a.createdAt)) / 86400000;
  t(`expires after ${ALERT_DAYS} days`, Math.round(days) === ALERT_DAYS, String(days));

  await sendInterventionAlert({ interventionId: 'i1', studentId: 's1', studentName: 'Adams, Ann',
                                category: 'Academic', level: 2, now });
  t("sending again for the same intervention doesn't duplicate", store.staffAlerts.length === 2);

  const skipped = await sendInterventionAlert({ interventionId: 'i2', studentId: 's1', category: 'Academic', level: 1 });
  t("a non-alerting intervention writes nothing", skipped === 0 && store.staffAlerts.length === 2);
  t("headline never contains the student's name",
    alertHeadline(a) === 'Level 2 Academic intervention' && !alertHeadline(a).includes('Adams'));
}

// ── Home: loading, expiry, dismissing ──
{
  const day = (d) => new Date(`2026-11-${String(d).padStart(2, '0')}T10:00:00`);
  resetStats();
  const mine = await loadMyAlerts('ZMcCoy@x.org', day(6));
  t("each person sees only their own alerts", mine.length === 1 && mine[0].forEmail === 'zmccoy@x.org');
  t("loading is a single query", stats.query <= 1 && stats.getAll === 0, JSON.stringify(stats));

  t("still shown on day 7", (await loadMyAlerts('zmccoy@x.org', day(11))).length === 1);
  const after = await loadMyAlerts('zmccoy@x.org', day(13));
  t("gone after a week", after.length === 0);
  t("and the expired alert is deleted, not just hidden", !store.staffAlerts.some(x => x.forEmail === 'zmccoy@x.org'));
  t("someone else's alert is untouched by my expiry sweep", store.staffAlerts.some(x => x.forEmail === 'aw@x.org'));

  const hers = await loadMyAlerts('aw@x.org', day(6));
  await dismissAlert(hers[0].id);
  t("dismissing removes it for that person", (await loadMyAlerts('aw@x.org', day(6))).length === 0);
  t("no email, no alerts", (await loadMyAlerts('', day(6))).length === 0);
}

console.log(fails ? `\n${fails} FAILED` : "\nAll staff-alert tests passed.");
