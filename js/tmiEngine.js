// TMI (Time Management Intervention) engine — the single place that turns a
// student's attendance exceptions into the TMI record for a period.
//
// Rules (all scoped to the student's TMI period):
//   • Each U across any class                            = +120 min
//   • Manual TMI override (assignTmi:true on a non-U)    = +120 min each
//   • 3 or more T's across all classes                   = +90 min (once per period)
//   • Hard cap: 240 min total
//
// Phase 2: every auto-calculated TMI record lives in interventionLogs under
// a DETERMINISTIC document ID — tmi_{student}_{periodKey} — so there is
// exactly one place a student's record for a period can be, and finding it
// is a single direct read (no query, no scan, no duplicates by construction).
// Manually assigned TMI (Students page) keeps auto IDs and no tmiPeriodKey;
// the engine never touches those.
//
// Reads per recalculation: 1 (the TMI doc) + the student's exceptions for
// the period (a handful). Calendar and staff come from the session cache.

import { getAll, getById, setDoc, updateDoc, deleteDoc, getWhereMultiple } from './db.js';
import { fetchClassLogs, fetchLogsInWindow, slug } from './attendance.js';
import * as Data from './data.js';

export const MAX_TMI = 240;

function pad(n) { return String(n).padStart(2, '0'); }
function nowISO() { return new Date().toISOString(); }

// ── Identity ───────────────────────────────────────────────────────────────

export function tmiStudentKey(rec) {
  if (rec.studentId) return String(rec.studentId);
  const a = (rec.chattStateANumber || '').trim();
  return a ? 'A' + slug(a) : 'N' + slug(rec.studentName);
}

// Firestore forbids IDs that both start and end with "__"; ours start with
// "tmi_" so the period key's "__" separators are safe. Everything else is
// reduced to [a-z0-9_-].
export function tmiDocId(rec, periodKey) {
  const key = String(periodKey || '').replace(/[^A-Za-z0-9_-]+/g, '_');
  return `tmi_${tmiStudentKey(rec).replace(/[^A-Za-z0-9_-]+/g, '_')}_${key}`;
}

// Same person if the Firestore student IDs match, or — since older records
// may carry only one identifier — the A#s match.
function sameStudent(a, b) {
  if (a.studentId && b.studentId && a.studentId === b.studentId) return true;
  const aA = (a.chattStateANumber || '').trim(), bA = (b.chattStateANumber || '').trim();
  return !!(aA && aA === bA);
}

// ── Periods ────────────────────────────────────────────────────────────────

// Mon–Sun calendar week, used when no TMI period is defined for a date.
export function getTmiWeekWindow(dateStr) {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const dt = new Date(yr, mo - 1, dy);
  const dow = dt.getDay();
  const toMon = (dow === 0) ? -6 : 1 - dow;
  const mon = new Date(dt); mon.setDate(dt.getDate() + toMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const toStr = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  const start = toStr(mon), end = toStr(sun);
  return { start, end, key: `week__${start}__${end}` };
}

// A TMI period begins on a calendar day marked 'startTmiPeriod' and ends on
// the next calendar day marked 'tmiDay' (inclusive).
export function getTmiPeriodWindow(dateStr, schoolCalendar) {
  const sorted = (schoolCalendar || [])
    .filter(c => c.classDate)
    .sort((a, b) => a.classDate.localeCompare(b.classDate));
  const starts = sorted.filter(c => c.startTmiPeriod && c.classDate <= dateStr);
  if (starts.length) {
    const start = starts[starts.length - 1].classDate;
    const ends = sorted.filter(c => c.tmiDay && c.classDate > start);
    if (ends.length && dateStr <= ends[0].classDate) {
      const end = ends[0].classDate;
      return { start, end, key: `${start}__${end}` };
    }
  }
  return getTmiWeekWindow(dateStr);
}

export function periodBounds(iv) {
  const start = iv.startDate || '';
  const keyParts = (iv.tmiPeriodKey || '').split('__');
  const end = keyParts.length ? keyParts[keyParts.length - 1] : '';
  return { start, end };
}

function periodsOverlap(a, b) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return a.start <= b.end && a.end >= b.start;
}

// ── Math ───────────────────────────────────────────────────────────────────

export function qualifies(l) {
  return l.attendanceCode === 'U' || l.attendanceCode === 'T' || (l.assignTmi && l.attendanceCode !== 'U');
}

export function computeTMI(periodLogs) {
  const uCount = periodLogs.filter(l => l.attendanceCode === 'U').length;
  const tCount = periodLogs.filter(l => l.attendanceCode === 'T').length;
  const overrideCount = periodLogs.filter(l => l.assignTmi && l.attendanceCode !== 'U').length;
  const tardyGroups = Math.floor(tCount / 3);
  const tardyMinutes = tardyGroups * 90;
  const totalMinutes = Math.min((uCount * 120) + (overrideCount * 120) + tardyMinutes, MAX_TMI);
  const parts = [];
  if (uCount > 0) parts.push(`${uCount}× unexcused (${uCount * 120} min)`);
  if (overrideCount > 0) parts.push(`${overrideCount}× manual override (${overrideCount * 120} min)`);
  if (tardyGroups > 0) parts.push(`${tCount} tardies → ${tardyGroups}× group of 3 (+${tardyMinutes} min)`);
  return { uCount, tCount, overrideCount, totalMinutes, reason: parts.length ? parts.join('; ') : 'No triggering events' };
}

// Who a TMI record is "Assigned By": the class teacher behind most of the
// U/T logs (resolved to a display name via staff), falling back to the
// caller-supplied name only when no log carries a teacher (e.g. a Dress
// Code auto-tardy, where the caller IS the staff member who logged it).
export function pickAssignedBy(periodLogs, staffList, fallback) {
  const counts = new Map();
  (periodLogs || []).filter(qualifies).forEach(l => {
    const t = (l.teacherLastName || '').trim();
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  });
  if (!counts.size) return fallback || 'Unknown';
  let bestTeacher = null, bestCount = -1;
  for (const [teacher, count] of counts) if (count > bestCount) { bestTeacher = teacher; bestCount = count; }
  const staffMatch = (staffList || []).find(s => (s.lastName || '').trim().toLowerCase() === bestTeacher.toLowerCase());
  return staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : bestTeacher;
}

function filterToStudentAndWindow(logs, identity, start, end) {
  return logs.filter(l => {
    if (!sameStudent(identity, l)) return false;
    const d = (l.date || l.classDate || '').substring(0, 10);
    return d >= start && d <= end;
  });
}

// ── Reads ──────────────────────────────────────────────────────────────────

// TMI records whose period could contain an absence in [start, end]:
// startDate on or before `end` and not more than lookbackDays before
// `start`. Needs the interventionType+startDate composite index; falls back
// to a full read with a one-time warning.
let tmiRangeWarned = false;
export async function fetchTMIRecordsForRange(start, end, { lookbackDays = 45 } = {}) {
  const s = (start || '').substring(0, 10), e = (end || '').substring(0, 10);
  if (!s || !e) return [];
  const lb = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  lb.setDate(lb.getDate() - lookbackDays);
  const lookback = `${lb.getFullYear()}-${pad(lb.getMonth() + 1)}-${pad(lb.getDate())}`;
  try {
    return await getWhereMultiple('interventionLogs', [
      ['interventionType', '==', 'TMI'],
      ['startDate', '>=', lookback],
      ['startDate', '<=', e],
    ]);
  } catch (err) {
    if (!tmiRangeWarned) {
      tmiRangeWarned = true;
      console.warn('tmiEngine: scoped TMI read failed (missing interventionType+startDate index?) — falling back to a full interventionLogs read.', err);
    }
    const all = await getAll('interventionLogs');
    return all.filter(i => i.interventionType === 'TMI' && (i.startDate || '') >= lookback && (i.startDate || '') <= e);
  }
}

// ── Write helpers ──────────────────────────────────────────────────────────

function buildRecord(identity, window, math, assignedBy, extra = {}) {
  return {
    studentId:            identity.studentId || '',
    studentName:          identity.studentName || '',
    chattStateANumber:    (identity.chattStateANumber || '').trim(),
    interventionType:     'TMI',
    interventionLevel:    1,
    startDate:            window.start,
    tmiPeriodKey:         window.key,
    tmiMinutes:           math.totalMinutes,
    tmiMinutesServed:     0,
    tmiMinutesRemaining:  math.totalMinutes,
    interventionStatus:   'Reviewed',
    assignedBy,
    reason:               math.reason,
    createDate:           nowISO(),
    ...extra,
  };
}

// Applies a recomputed total to an existing record: deletes it when nothing
// is owed and nothing was served, otherwise updates minutes (and re-labels
// the period / moves the doc to its new ID when the window changed).
async function applyToExisting(existing, window, math, periodLogs, staffList, fallbackAssignedBy) {
  const alreadyServed = (existing.tmiMinutesServed || 0) > 0;
  if (math.totalMinutes === 0 && !alreadyServed) {
    await deleteDoc('interventionLogs', existing.id);
    return { action: 'deleted' };
  }
  const targetId = tmiDocId(existing, window.key);
  const minutesChanged  = existing.tmiMinutes !== math.totalMinutes;
  const periodChanged   = existing.tmiPeriodKey !== window.key || existing.startDate !== window.start;
  const idChanged       = existing.id !== targetId;
  const needsAssignedBy = !existing.assignedBy;
  if (!minutesChanged && !periodChanged && !idChanged && !needsAssignedBy) return { action: 'none', id: existing.id };

  const updates = {
    tmiMinutes:          math.totalMinutes,
    tmiMinutesRemaining: Math.max(0, math.totalMinutes - (existing.tmiMinutesServed || 0)),
    tmiPeriodKey:        window.key,
    startDate:           window.start,
    reason:              math.reason,
    updatedAt:           nowISO(),
  };
  if (needsAssignedBy) updates.assignedBy = pickAssignedBy(periodLogs, staffList, fallbackAssignedBy);

  if (idChanged) {
    // Move to the deterministic ID: write the full record there, drop the old doc.
    const { id: _oldId, ...rest } = existing;
    await setDoc('interventionLogs', targetId, { ...rest, ...updates });
    await deleteDoc('interventionLogs', existing.id);
  } else {
    await updateDoc('interventionLogs', existing.id, updates);
  }
  Object.assign(existing, updates, { id: targetId });
  return { action: 'updated', minutes: math.totalMinutes, id: targetId, backfilledAssignedBy: needsAssignedBy };
}

// ── Public: recalc for one student ─────────────────────────────────────────

// Recalculates TMI for one student for the period containing dateStr from
// the exceptions that currently exist. Idempotent; call it any time an
// attendance event is added, edited, or removed for that student.
//
// context: { studentId, chattStateANumber, studentName, dateStr,
//            className, teacherLastName, assignedBy, cache? }
// A caller running several recalculations in one save may pass one shared
// context.cache = {} so calendar/staff are fetched once and records touched
// earlier in the batch are seen by later calls.
// Returns { action: 'created' | 'updated' | 'deleted' | 'none', minutes?, id? }
export async function recalcTMIForStudent(context) {
  const { studentId, dateStr } = context;
  const chattStateANumber = (context.chattStateANumber || '').trim();
  if ((!studentId && !chattStateANumber) || !dateStr) return { action: 'none' };
  const identity = { studentId: studentId || '', chattStateANumber, studentName: context.studentName || '' };

  const cache = context.cache || {};
  const schoolCalendar = cache.schoolCalendar || (cache.schoolCalendar = await Data.schoolCalendar().catch(() => []));
  const window = getTmiPeriodWindow(dateStr, schoolCalendar);
  const docId = tmiDocId(identity, window.key);

  cache.tmiById = cache.tmiById || new Map();
  const [existing, candidateLogs, staffList] = await Promise.all([
    cache.tmiById.has(docId) ? cache.tmiById.get(docId) : getById('interventionLogs', docId),
    fetchLogsInWindow(window.start, window.end, identity),
    cache.staffList || (cache.staffList = Data.staff().catch(() => [])),
  ]);

  const periodLogs = filterToStudentAndWindow(candidateLogs, identity, window.start, window.end);
  const math = computeTMI(periodLogs);

  if (existing) {
    const r = await applyToExisting(existing, window, math, periodLogs, staffList, context.assignedBy);
    cache.tmiById.set(docId, r.action === 'deleted' ? null : existing);
    return r;
  }
  if (math.totalMinutes > 0) {
    const record = buildRecord(identity, window, math, pickAssignedBy(periodLogs, staffList, context.assignedBy), {
      className: context.className || '',
      teacherLastName: context.teacherLastName || '',
    });
    await setDoc('interventionLogs', docId, record);
    cache.tmiById.set(docId, { id: docId, ...record });
    return { action: 'created', minutes: math.totalMinutes, id: docId };
  }
  cache.tmiById.set(docId, null);
  return { action: 'none' };
}

// ── Public: recalc for an explicit window (TMI Review / Final Approval) ────

// Recalculates TMI for EVERY student with an exception in [startDate,
// endDate], treating that range as the TMI period. Any existing record
// whose period overlaps the window is re-labelled to it (the newest manual
// range is authoritative) rather than duplicated.
// Returns [{ studentId, chattStateANumber, action, minutes? }].
export async function recalcTMIForWindow(startDate, endDate, assignedBy) {
  if (!startDate || !endDate || startDate > endDate) return [];
  const window = { start: startDate, end: endDate, key: `range__${startDate}__${endDate}` };

  const [candidates, inWindow, staffList] = await Promise.all([
    fetchTMIRecordsForRange(startDate, endDate, { lookbackDays: 60 }),
    fetchClassLogs({ start: startDate, end: endDate, codes: ['T', 'U', 'E'] }),
    Data.staff().catch(() => []),
  ]);

  const overlapping = candidates.filter(iv => iv.tmiPeriodKey && periodsOverlap(periodBounds(iv), window));

  const students = new Map();
  const remember = (rec) => {
    const k = tmiStudentKey(rec);
    if (!students.has(k)) students.set(k, { studentId: rec.studentId || '', chattStateANumber: (rec.chattStateANumber || '').trim(), studentName: rec.studentName || '' });
  };
  inWindow.filter(qualifies).forEach(remember);
  overlapping.forEach(remember);

  const results = [];
  for (const identity of students.values()) {
    const studentLogs = filterToStudentAndWindow(inWindow, identity, startDate, endDate);
    const math = computeTMI(studentLogs);
    const base = { studentId: identity.studentId, chattStateANumber: identity.chattStateANumber };
    const mine = overlapping.filter(iv => sameStudent(identity, iv));

    if (mine.length) {
      // Keep the one whose window ends latest (ties → most recently updated);
      // fold served minutes from any others into it and remove them.
      mine.sort((a, b) => {
        const ae = periodBounds(a).end, be = periodBounds(b).end;
        if (ae !== be) return be.localeCompare(ae);
        return (b.updatedAt || b.createDate || '').localeCompare(a.updatedAt || a.createDate || '');
      });
      const keep = mine[0];
      const extras = mine.slice(1);
      if (extras.length) {
        keep.tmiMinutesServed = mine.reduce((s, iv) => s + (iv.tmiMinutesServed || 0), 0);
        await Promise.all(extras.map(iv => deleteDoc('interventionLogs', iv.id)));
      }
      const r = await applyToExisting(keep, window, math, studentLogs, staffList, assignedBy);
      results.push({ ...base, ...r });
    } else if (math.totalMinutes > 0) {
      const docId = tmiDocId(identity, window.key);
      await setDoc('interventionLogs', docId, buildRecord(identity, window, math, pickAssignedBy(studentLogs, staffList, assignedBy)));
      results.push({ ...base, action: 'created', minutes: math.totalMinutes, id: docId });
    } else {
      results.push({ ...base, action: 'none' });
    }
  }
  return results;
}

// ── Public: one-time migration of existing TMI records ────────────────────

// Moves every auto-calculated TMI record (has a tmiPeriodKey) to its
// deterministic ID, merging any overlapping duplicates for the same student
// on the way (oldest record wins for identical periods, latest-ending window
// wins otherwise; served minutes are summed so nothing is lost). Safe to
// re-run: records already at their ID with no duplicates are untouched.
// Returns { scanned, moved, merged, untouched, details: [] }.
export async function migrateTMIRecords() {
  const all = await getAll('interventionLogs');
  const candidates = all.filter(iv => iv.interventionType === 'TMI' && iv.tmiPeriodKey);
  const byStudent = new Map();
  candidates.forEach(iv => {
    const k = tmiStudentKey(iv);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(iv);
  });

  const out = { scanned: candidates.length, moved: 0, merged: 0, untouched: 0, details: [] };

  for (const records of byStudent.values()) {
    // Connected components by period overlap.
    const n = records.length;
    const bounds = records.map(periodBounds);
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (periodsOverlap(bounds[i], bounds[j])) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
    const clusters = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(records[i]); }

    for (const group of clusters.values()) {
      let keep = group[0];
      if (group.length > 1) {
        const allSameKey = group.every(iv => iv.tmiPeriodKey === group[0].tmiPeriodKey);
        keep = allSameKey
          ? [...group].sort((a, b) => (a.createDate || a.createdAt || '').localeCompare(b.createDate || b.createdAt || ''))[0]
          : [...group].sort((a, b) => {
              const ae = periodBounds(a).end, be = periodBounds(b).end;
              if (ae !== be) return be.localeCompare(ae);
              return (b.updatedAt || b.createDate || '').localeCompare(a.updatedAt || a.createDate || '');
            })[0];
        const served = group.reduce((s, iv) => s + (iv.tmiMinutesServed || 0), 0);
        keep.tmiMinutesServed = served;
        keep.tmiMinutes = Math.max(keep.tmiMinutes || 0, served);
        keep.tmiMinutesRemaining = Math.max(0, keep.tmiMinutes - served);
        keep.assignedBy = keep.assignedBy || group.map(iv => iv.assignedBy).find(Boolean) || '';
        const extras = group.filter(iv => iv !== keep);
        await Promise.all(extras.map(iv => deleteDoc('interventionLogs', iv.id)));
        out.merged += extras.length;
        out.details.push(`${keep.studentName || keep.studentId || keep.chattStateANumber}: merged ${group.length} → 1 (${keep.tmiPeriodKey})`);
      }
      const targetId = tmiDocId(keep, keep.tmiPeriodKey);
      if (keep.id === targetId && group.length === 1) { out.untouched++; continue; }
      const { id: oldId, ...rest } = keep;
      await setDoc('interventionLogs', targetId, { ...rest, updatedAt: nowISO() });
      if (oldId !== targetId) await deleteDoc('interventionLogs', oldId);
      out.moved++;
    }
  }
  return out;
}

// ── Public: repair "Assigned By" for records in a range ───────────────────

// Re-resolves "Assigned By" from the exceptions behind each open TMI record
// in [start, end] and overwrites it only when a real class teacher can be
// identified from those logs and differs from what's stored.
// Returns [{ studentId, chattStateANumber, tmiPeriodKey, from, to }].
export async function reconcileAssignedBy(start, end) {
  if (!start || !end) return [];
  const [interventions, staffList] = await Promise.all([
    fetchTMIRecordsForRange(start, end),
    Data.staff().catch(() => []),
  ]);
  const candidates = interventions.filter(iv => iv.tmiPeriodKey && iv.interventionStatus !== 'Closed');
  if (!candidates.length) return [];

  const spanStart = candidates.reduce((m, iv) => { const s = periodBounds(iv).start; return (!m || (s && s < m)) ? s : m; }, '');
  const spanEnd   = candidates.reduce((m, iv) => { const e = periodBounds(iv).end;   return (!m || (e && e > m)) ? e : m; }, '');
  const allLogs = (spanStart && spanEnd) ? await fetchClassLogs({ start: spanStart, end: spanEnd, codes: ['T', 'U', 'E'] }) : [];

  const results = [];
  for (const iv of candidates) {
    const { start: ps, end: pe } = periodBounds(iv);
    if (!ps || !pe) continue;
    const periodLogs = filterToStudentAndWindow(allLogs, iv, ps, pe);
    if (!periodLogs.filter(qualifies).some(l => (l.teacherLastName || '').trim())) continue;
    const resolved = pickAssignedBy(periodLogs, staffList, iv.assignedBy);
    if (resolved && resolved !== iv.assignedBy) {
      await updateDoc('interventionLogs', iv.id, { assignedBy: resolved, updatedAt: nowISO() });
      results.push({ studentId: iv.studentId || '', chattStateANumber: (iv.chattStateANumber || '').trim(), tmiPeriodKey: iv.tmiPeriodKey, from: iv.assignedBy || '(blank)', to: resolved });
    }
  }
  return results;
}
