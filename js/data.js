// Reference-data cache
//
// Small, slow-changing collections (students, staff, schedules, templates…)
// used to be re-downloaded in full by almost every page on every load —
// classSchedules alone is ~1,000 documents, so a single click-through of four
// pages cost thousands of Firestore reads for data that had not changed.
//
// This module loads each such collection at most once per browser tab and
// keeps it in memory + sessionStorage. Freshness is decided by ONE document,
// meta/versions, which holds a stamp per collection. The write helpers in
// js/db.js update that stamp automatically whenever a versioned collection is
// written; the next page load sees the stamp changed and re-fetches only that
// collection. Net cost of a page load for reference data: 1 read.
//
// A long TTL is kept purely as a safety net (e.g. data edited directly in the
// Firebase console, which bypasses db.js) — it is NOT the primary freshness
// mechanism, and must stay long (hours), because a short TTL would silently
// reintroduce the read storm.

import { getAll, getById, onCollectionWrite, bumpVersion, isVersionedCollection } from './db.js';

const VERSIONS_COLLECTION = 'meta';
const VERSIONS_DOC        = 'versions';
const STORAGE_PREFIX      = 'p2mt:cache:';
const TTL_MS              = 24 * 60 * 60 * 1000;  // 24 hours — safety net only

// Collections allowed through the cache. Anything that grows with daily use
// (attendance logs, interventions) is deliberately NOT here — those must be
// read with scoped queries, never in full.
// The list itself lives in db.js (VERSIONED_COLLECTIONS) so the write helpers
// and this cache can never disagree about what is versioned.
const CACHEABLE = { has: isVersionedCollection };

// Named list for the bulk helpers below (refreshAll / clearLocal). Membership
// is still decided by db.js via CACHEABLE — this is only the set to iterate.
const CACHED_COLLECTIONS = [
  'students', 'staff', 'parents', 'classSchedules', 'p2mtTemplates',
  'interventionTypes', 'schoolCalendar', 'pbls', 'pblTeams', 'pblEvents',
  'erWorkshops', 'erRooms', 'guardianEmails',
];

const memory = new Map();          // collection -> { stamp, fetchedAt, docs }
let versionsCache = null;          // { <collection>: <stamp>, ... }
let versionsPromise = null;

// localStorage, NOT sessionStorage: sessionStorage is scoped to one browser
// tab, so closing the tab (or opening the app in a second one) threw the
// cache away and every fresh tab re-downloaded every reference collection —
// ~800 reads before the user had done anything. Staff open the app several
// times a day, so that alone was the largest single source of reads in the
// app. localStorage survives tab closes and browser restarts, and freshness
// is decided by the meta/versions stamp rather than by the storage lifetime,
// so keeping a copy longer is safe: a stale copy is detected on the next
// page load and re-fetched.
//
// Falls back to sessionStorage where localStorage is unavailable (private
// mode, locked-down browser), and to the in-memory Map where neither works.
function storageArea() {
  try {
    if (typeof localStorage !== 'undefined') {
      // Safari in private mode exposes localStorage but throws on write.
      localStorage.setItem(STORAGE_PREFIX + '__probe', '1');
      localStorage.removeItem(STORAGE_PREFIX + '__probe');
      return localStorage;
    }
  } catch (_) {}
  try { if (typeof sessionStorage !== 'undefined') return sessionStorage; } catch (_) {}
  return null;
}
const store = storageArea();

function storageGet(collection) {
  try {
    const raw = store && store.getItem(STORAGE_PREFIX + collection);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function storageSet(collection, entry) {
  if (!store) return;
  try { store.setItem(STORAGE_PREFIX + collection, JSON.stringify(entry)); }
  catch (_) {
    // Out of quota — drop every cached collection and keep the newest one
    // rather than silently caching nothing from here on.
    try {
      Object.keys(store).filter(k => k.startsWith(STORAGE_PREFIX)).forEach(k => store.removeItem(k));
      store.setItem(STORAGE_PREFIX + collection, JSON.stringify(entry));
    } catch (_) { /* memory cache still works */ }
  }
}

function storageDrop(collection) {
  try { if (store) store.removeItem(STORAGE_PREFIX + collection); } catch (_) {}
}

// Reads meta/versions once per page load (1 read). Subsequent calls in the
// same page reuse it; bump() updates the local copy so a page that writes
// and then re-reads sees its own change without another fetch.
async function getVersions() {
  if (versionsCache) return versionsCache;
  if (!versionsPromise) {
    versionsPromise = getById(VERSIONS_COLLECTION, VERSIONS_DOC)
      .then(docData => { versionsCache = docData || {}; return versionsCache; })
      .catch(err => {
        console.warn('Data: could not read meta/versions — treating caches as unverified', err);
        versionsCache = {};
        return versionsCache;
      });
  }
  return versionsPromise;
}

function stampOf(versions, collection) {
  const v = versions[collection];
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v.toMillis === 'function') return String(v.toMillis());
  return String(v);
}

// Returns the collection's documents, from cache when it is provably fresh.
export async function get(collection, { force = false } = {}) {
  if (!CACHEABLE.has(collection)) {
    // Not a reference collection — never cache, but don't break callers.
    return getAll(collection);
  }

  const versions = await getVersions();
  const stamp    = stampOf(versions, collection);
  const now      = Date.now();

  if (!force) {
    const entry = memory.get(collection) || storageGet(collection);
    if (entry && entry.stamp === stamp && (now - entry.fetchedAt) < TTL_MS) {
      if (!memory.has(collection)) memory.set(collection, entry);
      // Fresh array each time so a page sorting or splicing its copy can't
      // disturb the cached one.
      return entry.docs.slice();
    }
  }

  const docs  = await getAll(collection);
  const entry = { stamp, fetchedAt: now, docs };
  memory.set(collection, entry);
  storageSet(collection, entry);
  return docs.slice();
}

// Every write helper in db.js already updates meta/versions for versioned
// collections, and notifies this module so the local copy is dropped at
// once — a page that writes and immediately re-reads gets fresh data.
// bump() remains for callers that change data some other way.
function markStale(collection) {
  if (versionsCache) versionsCache[collection] = `local-${Date.now()}`;
  memory.delete(collection);
  storageDrop(collection);
}
onCollectionWrite(markStale);

export async function bump(collection) {
  if (!CACHEABLE.has(collection)) return;
  markStale(collection);
  bumpVersion(collection);
}

// Drops the local copy without touching meta/versions — for a page that
// wants a guaranteed fresh read of its own next call.
export function invalidate(collection) {
  memory.delete(collection);
  storageDrop(collection);
}

// Marks EVERY cached collection stale for every browser, by stamping each one
// in meta/versions (one write). Needed because a change made outside the app —
// editing a document directly in the Firebase console — bypasses db.js and so
// never stamps anything, and cached copies are otherwise kept until the 24h
// safety-net TTL. Wired to the "Refresh cached lists" button in Schedule Admin.
export async function refreshAll() {
  CACHED_COLLECTIONS.forEach(c => { markStale(c); bumpVersion(c); });
  return CACHED_COLLECTIONS.length;
}

// Drops this browser's copies only — no writes, no effect on anyone else.
export function clearLocal() {
  CACHED_COLLECTIONS.forEach(c => invalidate(c));
  versionsCache = null;
  versionsPromise = null;
}

// Convenience accessors used by pages.
export const students          = (opts) => get('students', opts);
export const staff             = (opts) => get('staff', opts);
export const parents           = (opts) => get('parents', opts);
export const classSchedules    = (opts) => get('classSchedules', opts);
export const templates         = (opts) => get('p2mtTemplates', opts);
export const interventionTypes = (opts) => get('interventionTypes', opts);
export const schoolCalendar    = (opts) => get('schoolCalendar', opts);
export const pbls              = (opts) => get('pbls', opts);
export const pblTeams          = (opts) => get('pblTeams', opts);
export const pblEvents         = (opts) => get('pblEvents', opts);
