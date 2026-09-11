// Scoped reads for the attendance collections.
//
// classAttendanceLogs and dailyAttendanceLogs are the only collections in
// P2MT that grow every school day, so they must never be read in full — one
// full read of classAttendanceLogs already costs more than half of the daily
// Firestore quota. Every page that needs attendance records goes through
// this module, which asks Firestore only for the records in a date range
// (and, where possible, only for one teacher / student / set of codes).
//
// Two quirks of the existing data shape are handled here so pages don't
// have to know about them:
//
//   1. classAttendanceLogs records carry their date in either `date` (most
//      writers) or `classDate` (learning-lab.html). Firestore can't OR across
//      fields and a missing field never matches a query, so each query is
//      issued once per date field and merged by document id.
//      dailyAttendanceLogs has the same split between `absenceDate` and
//      `date`.
//
//   2. Combining an equality filter (teacher, student, code) with a date
//      range needs a composite index. The needed ones are listed in
//      firestore.indexes.json, but if one is missing the query fails —
//      so every fetch degrades step by step: full scope → date range only
//      (single-field index, always available) with the rest filtered in JS
//      → full collection as the very last resort, with a console warning
//      each time so a missing index is noticed rather than silently paid
//      for.

import { getAll, getWhereMultiple } from './db.js';

const CLASS_DATE_FIELDS = ['date', 'classDate'];
const DAILY_DATE_FIELDS = ['absenceDate', 'date'];

const warned = new Set();
function warnOnce(key, message, err) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`attendance.js: ${message}`, err || '');
}

export function classLogDate(l) {
  return (l.date || l.classDate || '').substring(0, 10);
}

export function dailyLogDate(l) {
  return (l.absenceDate || l.date || '').substring(0, 10);
}

function normalizeRange(start, end) {
  const s = (start || '').substring(0, 10);
  const e = (end || start || '').substring(0, 10);
  if (!s || !e) throw new Error('attendance.js: a start date (and optionally end date) is required');
  return s <= e ? [s, e] : [e, s];
}

// Fans one logical query out across the possible date fields and merges
// the results by document id.
async function fanOut(collectionName, dateFields, conditions, start, end) {
  const jobs = dateFields.map(field =>
    getWhereMultiple(collectionName, [
      ...conditions,
      [field, '>=', start],
      [field, '<=', end],
    ])
  );
  const batches = await Promise.all(jobs);
  const merged = new Map();
  batches.forEach(batch => batch.forEach(d => merged.set(d.id, d)));
  return Array.from(merged.values());
}

function clientFilter(docs, { equals, codes, start, end, dateOf }) {
  return docs.filter(d => {
    for (const [field, value] of equals) {
      if ((d[field] ?? '') !== value) return false;
    }
    if (codes && codes.length && !codes.includes(d.attendanceCode)) return false;
    const dt = dateOf(d);
    return dt && dt >= start && dt <= end;
  });
}

// Core: read a date range with optional equality filters and code filter,
// degrading gracefully if an index is missing.
async function fetchRange(collectionName, dateFields, dateOf, { start, end, equals = [], codes = null }) {
  const [s, e] = normalizeRange(start, end);
  const strict = equals.map(([field, value]) => [field, '==', value]);
  if (codes && codes.length) strict.push(['attendanceCode', 'in', codes]);

  // Level 1 — fully scoped (needs a composite index when strict is non-empty)
  try {
    return await fanOut(collectionName, dateFields, strict, s, e);
  } catch (err) {
    if (strict.length === 0) throw err; // nothing to degrade to below
    warnOnce(`${collectionName}:${strict.map(c => c[0]).join('+')}`,
      `scoped query on ${collectionName} (${strict.map(c => c[0]).join(', ')} + date range) failed — ` +
      'falling back to a date-range-only read filtered in the browser. Create the composite index ' +
      'Firestore suggests in the console link below to restore the cheaper query.', err);
  }

  // Level 2 — date range only (single-field range: no composite index needed)
  try {
    const docs = await fanOut(collectionName, dateFields, [], s, e);
    return clientFilter(docs, { equals, codes, start: s, end: e, dateOf });
  } catch (err) {
    warnOnce(`${collectionName}:range`,
      `date-range read on ${collectionName} failed — falling back to a FULL collection read. ` +
      'This is expensive; check the console error.', err);
  }

  // Level 3 — full scan (last resort)
  const all = await getAll(collectionName);
  return clientFilter(all, { equals, codes, start: s, end: e, dateOf });
}

// ── Public API ─────────────────────────────────────────────────────────────

// Class attendance records in [start, end].
//   opts: { start, end, teacherLastName?, codes?, learningLab?, studentId?, chattStateANumber? }
// studentId / chattStateANumber, if given, are treated as alternatives (a
// record matching either is returned) because older records may carry only
// one of them.
export async function fetchClassLogs(opts) {
  const { start, end, teacherLastName, codes } = opts;
  const equalsBase = [];
  if (teacherLastName) equalsBase.push(['teacherLastName', teacherLastName]);
  if (opts.learningLab === true) equalsBase.push(['learningLab', true]);

  const identities = [];
  if (opts.studentId)                   identities.push(['studentId', opts.studentId]);
  if ((opts.chattStateANumber || '').trim()) identities.push(['chattStateANumber', opts.chattStateANumber.trim()]);

  if (!identities.length) {
    return fetchRange('classAttendanceLogs', CLASS_DATE_FIELDS, classLogDate, { start, end, equals: equalsBase, codes });
  }

  const batches = await Promise.all(identities.map(id =>
    fetchRange('classAttendanceLogs', CLASS_DATE_FIELDS, classLogDate, { start, end, equals: [...equalsBase, id], codes })
  ));
  const merged = new Map();
  batches.forEach(b => b.forEach(d => merged.set(d.id, d)));
  return Array.from(merged.values());
}

// Everything logged for one calendar day (optionally one teacher).
export function fetchClassLogsForDate(dateStr, opts = {}) {
  return fetchClassLogs({ ...opts, start: dateStr, end: dateStr });
}

// Daily Attendance (front-office) records in [start, end].
//   opts: { start, end, studentId?, chattStateANumber? }
export async function fetchDailyLogs(opts) {
  const { start, end } = opts;
  const identities = [];
  if (opts.studentId)                        identities.push(['studentId', opts.studentId]);
  if ((opts.chattStateANumber || '').trim()) identities.push(['chattStateANumber', opts.chattStateANumber.trim()]);

  if (!identities.length) {
    return fetchRange('dailyAttendanceLogs', DAILY_DATE_FIELDS, dailyLogDate, { start, end });
  }
  const batches = await Promise.all(identities.map(id =>
    fetchRange('dailyAttendanceLogs', DAILY_DATE_FIELDS, dailyLogDate, { start, end, equals: [id] })
  ));
  const merged = new Map();
  batches.forEach(b => b.forEach(d => merged.set(d.id, d)));
  return Array.from(merged.values());
}

export function fetchDailyLogsForDate(dateStr, opts = {}) {
  return fetchDailyLogs({ ...opts, start: dateStr, end: dateStr });
}

// Kept for the TMI engine: all class logs for one student inside a period
// window. identity = { studentId?, chattStateANumber? }. Returns [] when no
// identity is given rather than reading every student's records.
export async function fetchLogsInWindow(windowStart, windowEnd, identity) {
  if (!identity || (!identity.studentId && !(identity.chattStateANumber || '').trim())) return [];
  return fetchClassLogs({
    start: windowStart, end: windowEnd,
    studentId: identity.studentId || '',
    chattStateANumber: identity.chattStateANumber || '',
  });
}

// Convenience: the exception codes that matter to every consumer.
export const ABSENCE_CODES = ['T', 'U', 'E'];
