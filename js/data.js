// Reference-data cache
//
// Small, slow-changing collections (students, staff, schedules, templates…)
// used to be re-downloaded in full by almost every page on every load —
// classSchedules alone is ~1,000 documents, so a single click-through of four
// pages cost thousands of Firestore reads for data that had not changed.
//
// This module loads each such collection at most once per browser tab and
// keeps it in memory + sessionStorage. Freshness is decided by ONE document,
// meta/versions, which holds a stamp per collection. Every page that writes to
// a cached collection calls Data.bump('<collection>') afterwards, which
// updates that stamp; the next page load sees the stamp changed and re-fetches
// only that collection. Net cost of a page load for reference data: 1 read.
//
// A long TTL is kept purely as a safety net in case a write path forgets to
// bump — it is NOT the primary freshness mechanism, and must stay long
// (hours), because a short TTL would silently reintroduce the read storm.

import { getAll, getById, setDocMerge } from './db.js';

const VERSIONS_COLLECTION = 'meta';
const VERSIONS_DOC        = 'versions';
const STORAGE_PREFIX      = 'p2mt:cache:';
const TTL_MS              = 6 * 60 * 60 * 1000;   // 6 hours — safety net only

// Collections allowed through the cache. Anything that grows with daily use
// (attendance logs, interventions) is deliberately NOT here — those must be
// read with scoped queries, never in full.
const CACHEABLE = new Set([
  'students', 'staff', 'parents', 'classSchedules', 'p2mtTemplates',
  'interventionTypes', 'schoolCalendar', 'pbls', 'pblTeams', 'pblEvents',
  'erWorkshops', 'erRooms', 'guardianEmails',
]);

const memory = new Map();          // collection -> { stamp, fetchedAt, docs }
let versionsCache = null;          // { <collection>: <stamp>, ... }
let versionsPromise = null;

function storageGet(collection) {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + collection);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function storageSet(collection, entry) {
  try { sessionStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(entry)); }
  catch (_) { /* quota or private mode — memory cache still works */ }
}

function storageDrop(collection) {
  try { sessionStorage.removeItem(STORAGE_PREFIX + collection); } catch (_) {}
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
      return entry.docs;
    }
  }

  const docs  = await getAll(collection);
  const entry = { stamp, fetchedAt: now, docs };
  memory.set(collection, entry);
  storageSet(collection, entry);
  return docs;
}

// Call after writing to a cached collection so every tab re-fetches it on
// its next page load. Cost: 1 write. Safe to call for non-cached collections
// (no-op).
export async function bump(collection) {
  if (!CACHEABLE.has(collection)) return;
  const stamp = new Date().toISOString();
  try {
    await setDocMerge(VERSIONS_COLLECTION, VERSIONS_DOC, { [collection]: stamp });
  } catch (err) {
    console.warn(`Data: could not bump version for ${collection}`, err);
  }
  if (versionsCache) versionsCache[collection] = stamp;
  memory.delete(collection);
  storageDrop(collection);
}

// Drops the local copy without touching meta/versions — for a page that
// wants a guaranteed fresh read of its own next call.
export function invalidate(collection) {
  memory.delete(collection);
  storageDrop(collection);
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
