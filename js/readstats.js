// Central read reporting.
//
// js/db.js counts every document this browser reads, broken down by collection
// and by page, and keeps the day's tally in localStorage. That's only visible
// to the person sitting at that machine, which is no help when the question is
// "who burned 35,000 reads at 1pm?".
//
// This module flushes that tally to Firestore so an admin can see everyone's
// numbers in one place (Diagnostics -> Read Usage). One small document per
// person, per device, per day:
//
//   readStats/{date}_{uid}_{deviceId}
//     { date, uid, email, name, device, page, total,
//       byCollection: { students: {docs, calls}, ... },
//       byPage:       { 'class-attendance.html': {docs, calls}, ... },
//       events: [ { at, page, collection, kind, count, stack } ],   // biggest reads
//       updatedAt }
//
// The document is rewritten with the running daily total rather than
// incremented, so a lost or duplicated flush can't corrupt the number, and two
// devices used by the same person stay separate.
//
// Cost: one write per flush. Flushes happen when a page is hidden or unloaded
// (i.e. once per page view) and at most once every FLUSH_INTERVAL_MS while a
// page sits open, and only when the tally has actually changed — a few hundred
// writes a day against a 20,000/day limit.

import { setDocMerge, getReadTally, isReadTallyDirty, markReadTallyFlushed, readMeterDateKey } from './db.js';
import { getCurrentUser } from './auth.js';

export const READ_STATS_COLLECTION = 'readStats';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const DEVICE_KEY = 'p2mt:device';

let started = false;
let flushing = false;
let lastFlushedTotal = -1;

// A stable per-browser id, so the same person on a laptop and a phone shows up
// as two rows instead of overwriting each other.
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_) {
    return 'nostore';
  }
}

// Best-effort label for the machine, to make the admin table readable.
function deviceLabel() {
  const ua = (navigator.userAgent || '');
  const os = /iPhone|iPad/.test(ua) ? 'iOS'
           : /Android/.test(ua)     ? 'Android'
           : /Mac OS X/.test(ua)    ? 'Mac'
           : /Windows/.test(ua)     ? 'Windows'
           : /Linux/.test(ua)       ? 'Linux' : 'Other';
  const browser = /Edg\//.test(ua)     ? 'Edge'
                : /OPR\//.test(ua)     ? 'Opera'
                : /Chrome\//.test(ua)  ? 'Chrome'
                : /Firefox\//.test(ua) ? 'Firefox'
                : /Safari\//.test(ua)  ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}

function safeId(s) {
  return String(s || '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'unknown';
}

export async function flushReadStats({ force = false } = {}) {
  if (flushing) return false;
  const tally = getReadTally();
  if (!tally || !tally.total) return false;
  if (!force && !isReadTallyDirty()) return false;
  if (!force && tally.total === lastFlushedTotal) return false;

  const user = getCurrentUser();
  if (!user) return false;   // signed out — nothing to attribute it to

  flushing = true;
  try {
    const date = readMeterDateKey();
    const dev  = deviceId();
    const id   = `${date}_${safeId(user.uid)}_${safeId(dev)}`;
    await setDocMerge(READ_STATS_COLLECTION, id, {
      date,
      uid:    user.uid || '',
      email:  user.email || '',
      name:   user.displayName || user.email || '',
      device: dev,
      deviceLabel: deviceLabel(),
      total:  tally.total,
      byCollection: tally.byCollection || {},
      byPage:       tally.byPage || {},
      events:       (tally.events || []).slice(0, 25),
      updatedAt: new Date().toISOString(),
    });
    lastFlushedTotal = tally.total;
    markReadTallyFlushed();
    return true;
  } catch (err) {
    // Never let reporting break the page it's reporting on.
    console.warn('readstats: could not flush read stats', err);
    return false;
  } finally {
    flushing = false;
  }
}

// Called once per page from js/nav.js, after auth has resolved.
export function startReadStats() {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Once per page view: when the user navigates away or switches tabs. This is
  // the reliable moment — 'unload' is not guaranteed to let a network request
  // finish, whereas 'hidden' fires early enough that the write goes out.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushReadStats();
  });
  window.addEventListener('pagehide', () => { flushReadStats(); });

  // Backup for a page left open all period.
  setInterval(() => flushReadStats(), FLUSH_INTERVAL_MS);

  // And once shortly after load, so a page that is opened and left alone still
  // reports the reads its own load just did.
  setTimeout(() => flushReadStats(), 20 * 1000);
}

if (typeof window !== 'undefined') window.p2mtFlushReads = () => flushReadStats({ force: true });
