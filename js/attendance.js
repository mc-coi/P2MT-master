// Attendance data access — the ONLY module that talks to Firestore for
// class attendance.
//
// Phase 2 data model ("exceptions only, addressed not searched"):
//
//   attendanceEvents/{date}_{sectionKey}_{studentKey}
//     One document per student per section per day — but ONLY when the
//     student was Tardy / Unexcused / Excused, or a TMI override was set.
//     Present is the absence of a document. Marking a student back to
//     Present deletes the document. Same field names as the old
//     classAttendanceLogs (attendanceCode, teacherLastName, className,
//     startTime, date, comment, assignTmi, learningLab …) so every reader
//     keeps working; the date always lives in `date` (never `classDate`).
//
//   attendanceSessions/{date}_{sectionKey}
//     "Attendance was taken for this section on this day": rosterCount,
//     exceptionCount, savedBy, savedAt. Present count = roster − exceptions.
//     This is what tells the Home page and admin tools that a class was
//     taken even when nobody was absent.
//
//   dailyAttendanceLogs  — front-office records, unchanged (still carries
//     its date in either absenceDate or date, so reads fan out over both).
//
// Because every document's ID is derived from what it IS, a writer never
// has to search for "the existing record" — it just sets the ID. Two tabs
// saving the same section can't create duplicates; they write the same doc.
//
// Reads are always bounded by a date range (plus teacher / student / code
// where the caller knows it) and degrade gracefully when a composite index
// is missing: full scope → date range only + client filter → full read as a
// last resort, warning once per query shape so a missing index gets noticed.

import { getAll, getWhereMultiple, setDocMerge, updateDoc, deleteDoc, batchWrite } from './db.js';

export const EVENTS_COLLECTION   = 'attendanceEvents';
export const SESSIONS_COLLECTION = 'attendanceSessions';
export const DAILY_COLLECTION    = 'dailyAttendanceLogs';

export const ABSENCE_CODES = ['T', 'U', 'E'];
export function isException(code) { return ABSENCE_CODES.includes(code); }

// Some events are not absences at all but still have to be stored, because
// they carry a consequence: a manual TMI override, or a Dress Code Level 1
// which is worth 30 minutes and is deliberately NOT a tardy. `worthKeeping`
// is the single rule for "does this record need to exist".
export function worthKeeping(rec) {
  return isException(rec.attendanceCode) || rec.assignTmi === true || Number(rec.tmiMinutes) > 0;
}

const DAILY_DATE_FIELDS = ['absenceDate', 'date'];
const MAX_BATCH = 450;   // Firestore allows 500 ops per batch; leave headroom

const warned = new Set();
function warnOnce(key, message, err) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`attendance.js: ${message}`, err || '');
}

// ── Identity helpers ───────────────────────────────────────────────────────

// Lower-case, non-alphanumerics collapsed to "_" — safe inside a Firestore
// document ID and stable regardless of how a name was typed.
export function slug(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || '-';
}

// A section is a teacher + class + meeting time (+ lab flag). It is derived
// from the record, never typed, so two writers describing the same class
// arrive at the same key.
export function sectionKey(rec) {
  const slot = rec.startTime || rec.time || '';
  return [slug(rec.teacherLastName), slug(rec.className), slug(slot)].join('~') + (rec.learningLab === true ? '~lab' : '');
}

export function studentKey(rec) {
  if (rec.studentId) return String(rec.studentId);
  const a = (rec.chattStateANumber || '').trim();
  if (a) return 'A' + slug(a);
  return 'N' + slug(rec.studentName);
}

export function eventDate(rec) {
  return (rec.date || rec.classDate || '').substring(0, 10);
}

export function eventId(rec) {
  const d = eventDate(rec);
  if (!d) throw new Error('attendance.js: an event needs a date');
  return `${d}_${sectionKey(rec)}_${studentKey(rec)}`;
}

export function sessionId(rec) {
  const d = eventDate(rec);
  if (!d) throw new Error('attendance.js: a session needs a date');
  return `${d}_${sectionKey(rec)}`;
}

// Kept for readers that still call these.
export function classLogDate(l) { return eventDate(l); }
export function dailyLogDate(l) { return (l.absenceDate || l.date || '').substring(0, 10); }

// Shapes a record for storage: date normalised into `date`, classDate
// dropped, blanks filled so equality queries on these fields behave.
export function normalizeEvent(rec) {
  const out = { ...rec };
  out.date = eventDate(rec);
  delete out.classDate;
  delete out.id;
  out.studentId         = out.studentId || '';
  out.chattStateANumber = (out.chattStateANumber || '').trim();
  out.teacherLastName   = out.teacherLastName || '';
  out.className         = out.className || '';
  out.startTime         = out.startTime || '';
  out.attendanceCode    = out.attendanceCode || '';
  out.assignTmi         = out.assignTmi === true;
  out.learningLab       = out.learningLab === true;
  // Minutes attached directly to this event (Dress Code Level 1 = 30), with a
  // label so TMI Review can say what they were for.
  out.tmiMinutes        = Number(out.tmiMinutes) > 0 ? Number(out.tmiMinutes) : 0;
  out.tmiReason         = out.tmiMinutes > 0 ? (out.tmiReason || 'other') : '';
  out.updatedAt         = new Date().toISOString();
  return out;
}

// ── Reads ──────────────────────────────────────────────────────────────────

function normalizeRange(start, end) {
  const s = (start || '').substring(0, 10);
  const e = (end || start || '').substring(0, 10);
  if (!s || !e) throw new Error('attendance.js: a start date (and optionally end date) is required');
  return s <= e ? [s, e] : [e, s];
}

async function fanOut(collectionName, dateFields, conditions, start, end) {
  const jobs = dateFields.map(field =>
    getWhereMultiple(collectionName, [...conditions, [field, '>=', start], [field, '<=', end]])
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

async function fetchRange(collectionName, dateFields, dateOf, { start, end, equals = [], codes = null }) {
  const [s, e] = normalizeRange(start, end);
  const strict = equals.map(([field, value]) => [field, '==', value]);
  if (codes && codes.length) strict.push(['attendanceCode', 'in', codes]);

  try {
    return await fanOut(collectionName, dateFields, strict, s, e);
  } catch (err) {
    if (strict.length === 0) throw err;
    warnOnce(`${collectionName}:${strict.map(c => c[0]).join('+')}`,
      `scoped query on ${collectionName} (${strict.map(c => c[0]).join(', ')} + date range) failed — ` +
      'falling back to a date-range-only read filtered in the browser. Create the composite index ' +
      'Firestore suggests in the console link below to restore the cheaper query.', err);
  }
  try {
    const docs = await fanOut(collectionName, dateFields, [], s, e);
    return clientFilter(docs, { equals, codes, start: s, end: e, dateOf });
  } catch (err) {
    warnOnce(`${collectionName}:range`,
      `date-range read on ${collectionName} failed — falling back to a FULL collection read.`, err);
  }
  const all = await getAll(collectionName);
  return clientFilter(all, { equals, codes, start: s, end: e, dateOf });
}

// Class attendance exceptions in [start, end].
//   opts: { start, end, teacherLastName?, codes?, learningLab?, studentId?, chattStateANumber? }
// studentId / chattStateANumber are alternatives — a record matching either
// is returned, since older records may carry only one.
export async function fetchClassLogs(opts) {
  const { start, end, teacherLastName, codes } = opts;
  const equalsBase = [];
  if (teacherLastName) equalsBase.push(['teacherLastName', teacherLastName]);
  if (opts.learningLab === true) equalsBase.push(['learningLab', true]);

  const identities = [];
  if (opts.studentId)                        identities.push(['studentId', opts.studentId]);
  if ((opts.chattStateANumber || '').trim()) identities.push(['chattStateANumber', opts.chattStateANumber.trim()]);

  if (!identities.length) {
    return fetchRange(EVENTS_COLLECTION, ['date'], eventDate, { start, end, equals: equalsBase, codes });
  }
  const batches = await Promise.all(identities.map(id =>
    fetchRange(EVENTS_COLLECTION, ['date'], eventDate, { start, end, equals: [...equalsBase, id], codes })
  ));
  const merged = new Map();
  batches.forEach(b => b.forEach(d => merged.set(d.id, d)));
  return Array.from(merged.values());
}
export const fetchEvents = fetchClassLogs;

export function fetchClassLogsForDate(dateStr, opts = {}) {
  return fetchClassLogs({ ...opts, start: dateStr, end: dateStr });
}

// Sessions ("attendance taken") in [start, end], optionally one teacher.
export async function fetchSessions({ start, end, teacherLastName } = {}) {
  const equals = teacherLastName ? [['teacherLastName', teacherLastName]] : [];
  return fetchRange(SESSIONS_COLLECTION, ['date'], eventDate, { start, end, equals });
}

// Front-office records in [start, end].
export async function fetchDailyLogs(opts) {
  const { start, end } = opts;
  const identities = [];
  if (opts.studentId)                        identities.push(['studentId', opts.studentId]);
  if ((opts.chattStateANumber || '').trim()) identities.push(['chattStateANumber', opts.chattStateANumber.trim()]);

  if (!identities.length) {
    return fetchRange(DAILY_COLLECTION, DAILY_DATE_FIELDS, dailyLogDate, { start, end });
  }
  const batches = await Promise.all(identities.map(id =>
    fetchRange(DAILY_COLLECTION, DAILY_DATE_FIELDS, dailyLogDate, { start, end, equals: [id] })
  ));
  const merged = new Map();
  batches.forEach(b => b.forEach(d => merged.set(d.id, d)));
  return Array.from(merged.values());
}

export function fetchDailyLogsForDate(dateStr, opts = {}) {
  return fetchDailyLogs({ ...opts, start: dateStr, end: dateStr });
}

// All of one student's exceptions inside a window (used by the TMI engine).
export async function fetchLogsInWindow(windowStart, windowEnd, identity) {
  if (!identity || (!identity.studentId && !(identity.chattStateANumber || '').trim())) return [];
  return fetchClassLogs({
    start: windowStart, end: windowEnd,
    studentId: identity.studentId || '',
    chattStateANumber: identity.chattStateANumber || '',
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────

// Creates or replaces the event for a record, or removes it when the record
// no longer represents an exception. If the record used to live under a
// different ID (its date, class, teacher or time was edited) pass prevId so
// the old document is removed. Returns the event's ID, or null if it was
// deleted / not stored.
export async function saveEvent(rec, { prevId = null } = {}) {
  const data = normalizeEvent(rec);
  const id = eventId(data);
  const keep = worthKeeping(data);

  if (prevId && prevId !== id) {
    try { await deleteDoc(EVENTS_COLLECTION, prevId); } catch (_) { /* already gone */ }
  }
  if (!keep) {
    if (prevId === id || prevId === null) {
      try { await deleteDoc(EVENTS_COLLECTION, id); } catch (_) {}
    }
    return null;
  }
  await setDocMerge(EVENTS_COLLECTION, id, data);
  return id;
}

export async function patchEvent(id, patch) {
  return updateDoc(EVENTS_COLLECTION, id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteEvent(id) {
  return deleteDoc(EVENTS_COLLECTION, id);
}

export async function deleteEvents(ids) {
  const ops = ids.map(id => ({ collection: EVENTS_COLLECTION, id, type: 'delete' }));
  for (let i = 0; i < ops.length; i += MAX_BATCH) await batchWrite(ops.slice(i, i + MAX_BATCH));
  return ops.length;
}

// Saves one section's attendance for one day in a single batch.
//
//   section:  { date, teacherLastName, className, startTime, learningLab, classScheduleId }
//   roster:   [{ student: { id, chattStateANumber, firstName, lastName }, code, comment, tmi }]
//   previous: Map<studentId, existingEventDoc>   (what was loaded for this section)
//   savedBy:  { uid, name }
//
// Writes an event for every exception, deletes the event of anyone marked
// back to Present, and stamps the session document. Reads: 0.
// Returns { events: [written docs], deletedIds: [...], session, changed: [{ student, before, after }] }
export async function saveSectionAttendance({ section, roster, previous = new Map(), savedBy = {} }) {
  const date = eventDate(section);
  if (!date) throw new Error('attendance.js: section date is required');
  const now = new Date().toISOString();
  const ops = [];
  const events = [];
  const deletedIds = [];
  const changed = [];
  let exceptionCount = 0;

  roster.forEach(({ student, code, comment, tmi }) => {
    const prev = previous.get(student.id) || null;
    const base = {
      studentId:         student.id,
      chattStateANumber: student.chattStateANumber || '',
      studentName:       `${student.lastName || ''}, ${student.firstName || ''}`,
      teacherLastName:   section.teacherLastName,
      className:         section.className,
      classScheduleId:   section.classScheduleId || '',
      startTime:         section.startTime || '',
      learningLab:       section.learningLab === true,
      date,
    };
    const id = eventId(base);
    // The class grid only ever sets a code and the TMI override; minute-bearing
    // events (Dress Code) are written from the Students page against their own
    // section key, so they are never part of a class roster save.
    const keep = worthKeeping({ attendanceCode: code, assignTmi: tmi });
    const beforeCode = prev ? (isException(prev.attendanceCode) ? prev.attendanceCode : 'P') : 'P';
    const beforeTmi  = !!(prev && prev.assignTmi);
    const afterCode  = isException(code) ? code : 'P';
    const afterTmi   = tmi === true;

    if (keep) {
      exceptionCount++;
      const data = normalizeEvent({
        ...base,
        attendanceCode: afterCode,
        comment: comment || '',
        assignTmi: afterTmi,
        updatedBy: savedBy.uid || '',
      });
      if (!prev) data.createdBy = savedBy.uid || '';
      ops.push({ collection: EVENTS_COLLECTION, id, type: 'merge', data });
      events.push({ id, ...(prev || {}), ...data });
      // A record loaded under a different ID (written by an older path or
      // with a different section shape) would otherwise linger as a duplicate.
      if (prev && prev.id && prev.id !== id) {
        ops.push({ collection: EVENTS_COLLECTION, id: prev.id, type: 'delete' });
        deletedIds.push(prev.id);
      }
    } else if (prev) {
      ops.push({ collection: EVENTS_COLLECTION, id: prev.id || id, type: 'delete' });
      deletedIds.push(prev.id || id);
    }

    if (beforeCode !== afterCode || beforeTmi !== afterTmi) {
      changed.push({ student, before: { code: beforeCode, tmi: beforeTmi }, after: { code: afterCode, tmi: afterTmi } });
    }
  });

  const session = {
    date,
    teacherLastName: section.teacherLastName,
    className:       section.className,
    startTime:       section.startTime || '',
    learningLab:     section.learningLab === true,
    classScheduleId: section.classScheduleId || '',
    sectionKey:      sectionKey(section),
    rosterCount:     roster.length,
    exceptionCount,
    savedBy:         savedBy.name || '',
    savedByUid:      savedBy.uid || '',
    savedAt:         now,
  };
  const sid = sessionId(section);
  ops.push({ collection: SESSIONS_COLLECTION, id: sid, type: 'merge', data: session });

  for (let i = 0; i < ops.length; i += MAX_BATCH) await batchWrite(ops.slice(i, i + MAX_BATCH));

  return { events, deletedIds, session: { id: sid, ...session }, changed };
}

// ── One-time migration from classAttendanceLogs ────────────────────────────

// Turns the legacy rows (one per student per class per day, Present
// included) into the batch operations for the new model: an event for every
// T/U/E / override row under its deterministic ID, and a session for every
// class-day that had real attendance saved. Pure function — the caller
// commits the ops. Re-running is safe because every op is an idempotent merge.
export function buildMigrationOps(legacyLogs) {
  const dated = legacyLogs.filter(l => (l.date || l.classDate || '').length >= 10);
  const events = new Map();
  const eventStamp = new Map();   // id -> legacy updatedAt, to keep the newest of duplicate rows
  let conflicts = 0;
  dated.forEach(l => {
    const code = (l.attendanceCode || '').trim();
    if (!isException(code) && l.assignTmi !== true) return;
    const doc = normalizeEvent({ ...l, attendanceCode: isException(code) ? code : 'P' });
    delete doc.status;
    doc.legacyId = l.id || '';
    const id = eventId(doc);
    const stamp = l.updatedAt || l.createdAt || '';
    if (events.has(id)) {
      conflicts++;
      if (stamp <= (eventStamp.get(id) || '')) return;
    }
    events.set(id, doc);
    eventStamp.set(id, stamp);
  });

  const sessions = new Map();
  dated.forEach(l => {
    const code = (l.attendanceCode || '').trim();
    if (!['P', 'T', 'U', 'E'].includes(code)) return;          // '?' placeholders / unmarked rows are not "taken"
    if (!l.teacherLastName || !l.className) return;
    const shape = { date: eventDate(l), teacherLastName: l.teacherLastName, className: l.className,
                    startTime: l.startTime || '', learningLab: l.learningLab === true, classScheduleId: l.classScheduleId || '' };
    const id = sessionId(shape);
    let sx = sessions.get(id);
    if (!sx) {
      sx = { ...shape, sectionKey: sectionKey(shape), students: new Set(), exceptions: new Set(),
             savedAt: l.updatedAt || '', savedBy: '', savedByUid: l.createdBy || '', migrated: true };
      sessions.set(id, sx);
    }
    const who = l.studentId || l.chattStateANumber || l.studentName || l.id;
    sx.students.add(who);
    if (isException(code) || l.assignTmi === true) sx.exceptions.add(who);
    if ((l.updatedAt || '') > (sx.savedAt || '')) sx.savedAt = l.updatedAt;
  });

  const ops = [];
  events.forEach((doc, id) => ops.push({ collection: EVENTS_COLLECTION, id, type: 'merge', data: doc }));
  sessions.forEach((sx, id) => {
    const { students, exceptions, ...rest } = sx;
    ops.push({ collection: SESSIONS_COLLECTION, id, type: 'merge', data: { ...rest, rosterCount: students.size, exceptionCount: exceptions.size } });
  });
  return { ops, eventCount: events.size, sessionCount: sessions.size, conflicts };
}

export async function commitOps(ops, onProgress) {
  for (let i = 0; i < ops.length; i += MAX_BATCH) {
    await batchWrite(ops.slice(i, i + MAX_BATCH));
    if (onProgress) onProgress(Math.min(i + MAX_BATCH, ops.length), ops.length);
  }
}
