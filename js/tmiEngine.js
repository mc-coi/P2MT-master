// TMI recalculation engine — shared logic for keeping interventionLogs (TMI)
// in sync with classAttendanceLogs, used anywhere a U/T record (or a
// TMI-triggering event like a Dress Code Level 1 intervention) can be
// created, edited, or removed outside of the Class Attendance grid's own
// save flow.
//
// Rules (all scoped to the student's current TMI period):
//   • Each U across any class              = +120 min
//   • Manual TMI override (assignTmi:true on a non-U log) = +120 min each
//   • 3 or more T's across all classes      = +90 min (once per period)
//   • Hard cap: 240 min total
//
// Mirrors the rules originally implemented in class-attendance.html's
// checkAndCreateTMIForSection — kept here as the single source of truth so
// other pages that touch attendance records outside that page's save flow
// (daily-attendance.html, students.html) stay consistent with it instead of
// re-implementing the math themselves.

import { getAll, addDoc, updateDoc, deleteDoc, getWhere, getWhereMultiple } from './db.js';

const MAX_TMI = 240;

// classAttendanceLogs is written with two different date field names:
// learning-lab.html writes only `classDate`, every other writer sets `date`
// (daily-attendance.html sets both). Any scoped query therefore has to ask
// for both, or Learning Lab records vanish from TMI silently.
const DATE_FIELDS = ['date', 'classDate'];

let scopedQueryWarned = false;

// Fetches ONLY the classAttendanceLogs that can fall inside [windowStart,
// windowEnd], instead of downloading the entire collection and filtering in
// JS. Optionally narrows further to a single student.
//
// Firestore can't OR across fields, so this fans out into one query per
// (identity, dateField) pair and merges the results by document id.
//
// If ANY of those queries fails — most likely a missing composite index —
// the whole thing falls back to the original getAll() scan, so behaviour is
// never worse than before and correctness never depends on index setup.
async function fetchLogsInWindow(windowStart, windowEnd, identity) {
  const idConds = [];
  if (identity) {
    if (identity.studentId) idConds.push(['studentId', '==', identity.studentId]);
    if (identity.chattStateANumber) idConds.push(['chattStateANumber', '==', identity.chattStateANumber]);
    if (!idConds.length) return [];
  } else {
    idConds.push(null);
  }

  const jobs = [];
  for (const cond of idConds) {
    for (const field of DATE_FIELDS) {
      const conditions = [
        [field, '>=', windowStart],
        [field, '<=', windowEnd],
      ];
      if (cond) conditions.unshift(cond);
      jobs.push(getWhereMultiple('classAttendanceLogs', conditions));
    }
  }

  try {
    const batches = await Promise.all(jobs);
    const merged = new Map();
    batches.forEach(batch => batch.forEach(doc => merged.set(doc.id, doc)));
    return Array.from(merged.values());
  } catch (err) {
    if (!scopedQueryWarned) {
      scopedQueryWarned = true;
      console.warn(
        'TMI: scoped classAttendanceLogs query failed, falling back to a full ' +
        'collection scan. Create the composite indexes Firestore suggests in ' +
        'the console link below to restore fast queries.', err
      );
    }
    const all = await getAll('classAttendanceLogs');
    return all.filter(l => {
      const d = (l.date || l.classDate || '').substring(0, 10);
      return d && d >= windowStart && d <= windowEnd;
    });
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

// Resolves who a TMI record should be "Assigned By", preferring the actual
// class teacher behind the U/T logs over whoever happens to be running the
// recalculation. This matters because recalculation can be triggered by
// someone other than the student's own teacher — an admin running
// "Recalculate All TMI" or "Merge Duplicate TMI Records" in Schedule Admin,
// or anyone editing Daily Attendance for a student outside their own
// classes — and stamping THAT person's name as the assigner produced TMI
// records that claimed to be assigned by staff who don't even teach the
// student. classAttendanceLogs already records teacherLastName for every
// U/T (the real class teacher), so we resolve from there first and only
// fall back to the caller-supplied name when no log carries a teacher
// (e.g. a Dress Code auto-tardy, which has no class/teacher of its own —
// there, the caller-supplied name is already the actual staff member who
// logged the intervention, which is correct).
function pickAssignedBy(periodLogs, staffList, fallback) {
  const qualifying = (periodLogs || []).filter(l =>
    l.attendanceCode === 'U' || l.attendanceCode === 'T' || (l.assignTmi && l.attendanceCode !== 'U')
  );
  const counts = new Map();
  qualifying.forEach(l => {
    const t = (l.teacherLastName || '').trim();
    if (!t) return;
    counts.set(t, (counts.get(t) || 0) + 1);
  });
  if (!counts.size) return fallback || 'Unknown';

  let bestTeacher = null, bestCount = -1;
  for (const [teacher, count] of counts) {
    if (count > bestCount) { bestTeacher = teacher; bestCount = count; }
  }
  const staffMatch = (staffList || []).find(
    s => (s.lastName || '').trim().toLowerCase() === bestTeacher.toLowerCase()
  );
  return staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : bestTeacher;
}

// Falls back to a Mon–Sun calendar week when no TMI period is defined for a
// given date (e.g. school calendar hasn't been configured for that stretch).
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
// the very next calendar day marked 'tmiDay' (inclusive).
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

// Recalculates TMI for one student, scoped to the TMI period containing
// dateStr, from whatever classAttendanceLogs currently exist for them.
// Creates, updates, or deletes that student's interventionLogs record for
// the period as needed. Idempotent — safe to call any time a
// classAttendanceLogs record is added, edited, or removed for that student.
//
// context: { studentId, chattStateANumber, studentName, dateStr,
//            className, teacherLastName, assignedBy }
// Returns { action: 'created' | 'updated' | 'deleted' | 'none', minutes? }
export async function recalcTMIForStudent(context) {
  const { studentId, dateStr } = context;
  const chattStateANumber = (context.chattStateANumber || '').trim();
  if ((!studentId && !chattStateANumber) || !dateStr) return { action: 'none' };

  // The TMI window depends on the school calendar, so that has to land first.
  const schoolCalendar = await getAll('schoolCalendar').catch(() => []);
  const { start: windowStart, end: windowEnd, key: periodKey } = getTmiPeriodWindow(dateStr, schoolCalendar);

  const [interventions, candidateLogs, staffList] = await Promise.all([
    // One equality filter on a single field — no composite index needed, and
    // it returns just this period's TMI records instead of every one ever.
    getWhere('interventionLogs', 'tmiPeriodKey', '==', periodKey)
      .catch(() => getAll('interventionLogs')),
    fetchLogsInWindow(windowStart, windowEnd, { studentId, chattStateANumber }),
    getAll('staff').catch(() => []),
  ]);

  // The JS filter stays as a safety net: it costs nothing on an already-small
  // result set and guarantees identical semantics to the old full scan even
  // if a query over-returns or the index fallback kicked in.
  const periodLogs = candidateLogs.filter(l => {
    const match = studentId
      ? (l.studentId === studentId || (chattStateANumber && (l.chattStateANumber || '').trim() === chattStateANumber))
      : ((l.chattStateANumber || '').trim() === chattStateANumber);
    if (!match) return false;
    const d = (l.date || l.classDate || '').substring(0, 10);
    return d >= windowStart && d <= windowEnd;
  });

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
  const reason = parts.length ? parts.join('; ') : 'No triggering events';

  const existingTMI = interventions.find(i =>
    i.interventionType === 'TMI' && i.tmiPeriodKey === periodKey &&
    (studentId ? i.studentId === studentId : (i.chattStateANumber || '').trim() === chattStateANumber)
  );

  if (existingTMI) {
    const alreadyServed = (existingTMI.tmiMinutesServed || 0) > 0;
    if (totalMinutes === 0 && !alreadyServed) {
      await deleteDoc('interventionLogs', existingTMI.id);
      return { action: 'deleted' };
    }

    const minutesChanged = existingTMI.tmiMinutes !== totalMinutes;
    // Self-heal records created before "Assigned By" tracking existed (or
    // created some other way without it): the first time we touch a record
    // that's missing it, resolve the actual class teacher from the U/T logs
    // behind it (see pickAssignedBy) rather than stamping whoever happens to
    // be triggering this recalculation — that could be an admin running a
    // bulk tool or editing a different student's attendance entirely.
    const needsAssignedBy = !existingTMI.assignedBy;

    if (minutesChanged || needsAssignedBy) {
      const newRemaining = Math.max(0, totalMinutes - (existingTMI.tmiMinutesServed || 0));
      const updates = {
        tmiMinutes: totalMinutes,
        tmiMinutesRemaining: newRemaining,
        reason,
        updatedAt: new Date().toISOString(),
      };
      if (needsAssignedBy) updates.assignedBy = pickAssignedBy(periodLogs, staffList, context.assignedBy);
      await updateDoc('interventionLogs', existingTMI.id, updates);
      return { action: 'updated', minutes: totalMinutes, backfilledAssignedBy: needsAssignedBy };
    }
    return { action: 'none' };
  } else if (totalMinutes > 0) {
    await addDoc('interventionLogs', {
      studentId: studentId || '',
      studentName: context.studentName || '',
      chattStateANumber,
      interventionType: 'TMI',
      interventionLevel: 1,
      startDate: windowStart,
      tmiPeriodKey: periodKey,
      tmiMinutes: totalMinutes,
      tmiMinutesServed: 0,
      tmiMinutesRemaining: totalMinutes,
      interventionStatus: 'Reviewed',
      assignedBy: pickAssignedBy(periodLogs, staffList, context.assignedBy),
      reason,
      className: context.className || '',
      teacherLastName: context.teacherLastName || '',
      createDate: new Date().toISOString(),
    });
    return { action: 'created', minutes: totalMinutes };
  }
  return { action: 'none' };
}

// Recalculates TMI for EVERY student using an explicit [startDate, endDate]
// window as the TMI period, instead of deriving the period from the school
// calendar's startTmiPeriod/tmiDay markers. Used by TMI Review and TMI Final
// Approval's "use this range as the TMI window" action, for schools where
// events or schedule changes shift the real period slightly and staff need
// to define the window by hand rather than trust the calendar flags.
//
// To avoid double-counting the same absences under two different period
// identities when a manually-chosen window shifts slightly week to week,
// this reuses (and re-labels) any existing TMI record whose period overlaps
// the given window, rather than always creating a new one. That means a
// record's tmiPeriodKey/startDate can move to match the newest manual
// window that was run against it — the manual range is treated as
// authoritative once someone runs it.
//
// Returns an array of { studentId, chattStateANumber, action, minutes? }.
export async function recalcTMIForWindow(startDate, endDate, assignedBy) {
  if (!startDate || !endDate || startDate > endDate) return [];

  const [interventions, inWindowRaw, staffList] = await Promise.all([
    getAll('interventionLogs'),
    fetchLogsInWindow(startDate, endDate, null),
    getAll('staff').catch(() => []),
  ]);

  const periodKey = `range__${startDate}__${endDate}`;

  const inWindow = inWindowRaw.filter(l => {
    const d = (l.date || l.classDate || '').substring(0, 10);
    return d && d >= startDate && d <= endDate;
  });

  const keyFor = l => l.studentId || `A#:${(l.chattStateANumber || '').trim()}`;

  // Students with a qualifying event inside the window.
  const students = new Map();
  inWindow.forEach(l => {
    const qualifies = ['T', 'U'].includes(l.attendanceCode) || (l.assignTmi && l.attendanceCode !== 'U');
    if (!qualifies) return;
    const k = keyFor(l);
    if (!students.has(k)) {
      students.set(k, {
        studentId: l.studentId || '',
        chattStateANumber: (l.chattStateANumber || '').trim(),
        studentName: l.studentName || '',
      });
    }
  });

  // Existing auto-calculated TMI records whose own period overlaps this
  // window — these must be reconciled too, even if the student has no
  // qualifying logs left in the new window (their old minutes may no longer
  // be justified once the window shifts).
  const overlapping = interventions.filter(iv => {
    if (iv.interventionType !== 'TMI' || !iv.tmiPeriodKey) return false;
    const ivStart = iv.startDate || '';
    const keyParts = iv.tmiPeriodKey.split('__');
    const ivEnd = keyParts[keyParts.length - 1] || '';
    if (!ivStart || !ivEnd) return false;
    return ivStart <= endDate && ivEnd >= startDate;
  });
  overlapping.forEach(iv => {
    const k = iv.studentId || `A#:${(iv.chattStateANumber || '').trim()}`;
    if (!students.has(k)) {
      students.set(k, {
        studentId: iv.studentId || '',
        chattStateANumber: (iv.chattStateANumber || '').trim(),
        studentName: iv.studentName || '',
      });
    }
  });

  const results = [];
  for (const [, info] of students) {
    const studentLogs = inWindow.filter(l => {
      return info.studentId
        ? (l.studentId === info.studentId || (info.chattStateANumber && (l.chattStateANumber || '').trim() === info.chattStateANumber))
        : ((l.chattStateANumber || '').trim() === info.chattStateANumber);
    });

    const uCount = studentLogs.filter(l => l.attendanceCode === 'U').length;
    const tCount = studentLogs.filter(l => l.attendanceCode === 'T').length;
    const overrideCount = studentLogs.filter(l => l.assignTmi && l.attendanceCode !== 'U').length;
    const tardyGroups = Math.floor(tCount / 3);
    const totalMinutes = Math.min((uCount * 120) + (overrideCount * 120) + (tardyGroups * 90), MAX_TMI);

    const parts = [];
    if (uCount > 0) parts.push(`${uCount}× unexcused (${uCount * 120} min)`);
    if (overrideCount > 0) parts.push(`${overrideCount}× manual override (${overrideCount * 120} min)`);
    if (tardyGroups > 0) parts.push(`${tCount} tardies → ${tardyGroups}× group of 3 (+${tardyGroups * 90} min)`);
    const reason = parts.length ? parts.join('; ') : 'No triggering events';

    const existingTMI = overlapping.find(iv =>
      info.studentId ? iv.studentId === info.studentId : (iv.chattStateANumber || '').trim() === info.chattStateANumber
    );

    const base = { studentId: info.studentId, chattStateANumber: info.chattStateANumber };

    if (existingTMI) {
      const alreadyServed = (existingTMI.tmiMinutesServed || 0) > 0;
      if (totalMinutes === 0 && !alreadyServed) {
        await deleteDoc('interventionLogs', existingTMI.id);
        results.push({ ...base, action: 'deleted' });
        continue;
      }

      const minutesChanged = existingTMI.tmiMinutes !== totalMinutes;
      const periodChanged  = existingTMI.tmiPeriodKey !== periodKey || existingTMI.startDate !== startDate;
      const needsAssignedBy = !existingTMI.assignedBy;

      if (minutesChanged || periodChanged || needsAssignedBy) {
        const newRemaining = Math.max(0, totalMinutes - (existingTMI.tmiMinutesServed || 0));
        const updates = {
          tmiMinutes: totalMinutes,
          tmiMinutesRemaining: newRemaining,
          tmiPeriodKey: periodKey,
          startDate,
          reason,
          updatedAt: new Date().toISOString(),
        };
        if (needsAssignedBy) updates.assignedBy = pickAssignedBy(studentLogs, staffList, assignedBy);
        await updateDoc('interventionLogs', existingTMI.id, updates);
        results.push({ ...base, action: 'updated', minutes: totalMinutes });
      } else {
        results.push({ ...base, action: 'none' });
      }
    } else if (totalMinutes > 0) {
      await addDoc('interventionLogs', {
        studentId: info.studentId || '',
        studentName: info.studentName || '',
        chattStateANumber: info.chattStateANumber || '',
        interventionType: 'TMI',
        interventionLevel: 1,
        startDate,
        tmiPeriodKey: periodKey,
        tmiMinutes: totalMinutes,
        tmiMinutesServed: 0,
        tmiMinutesRemaining: totalMinutes,
        interventionStatus: 'Reviewed',
        assignedBy: pickAssignedBy(studentLogs, staffList, assignedBy),
        reason,
        createDate: new Date().toISOString(),
      });
      results.push({ ...base, action: 'created', minutes: totalMinutes });
    } else {
      results.push({ ...base, action: 'none' });
    }
  }

  return results;
}

function periodBounds(iv) {
  const start = iv.startDate || '';
  const keyParts = (iv.tmiPeriodKey || '').split('__');
  const end = keyParts.length ? keyParts[keyParts.length - 1] : '';
  return { start, end };
}

function periodsOverlap(a, b) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return a.start <= b.end && a.end >= b.start;
}

// Finds and merges genuine duplicate TMI records — two or more
// interventionLogs (TMI, not Closed) for the SAME student whose periods
// OVERLAP. This is different from a student legitimately having several TMI
// rows for several separate, non-overlapping periods (e.g. different
// weeks), which is normal and expected when no custom school-calendar
// period is configured, and is left alone.
//
// Two ways a true duplicate happens:
//   1. Exact-period race condition: two teachers (or two tabs) each saving
//      Class Attendance for the same student around the same time can each
//      independently see "no existing TMI yet" for that period and both
//      create one, since neither's locally-loaded data reflects the
//      other's just-written record.
//   2. Shifted-window leftovers: "Use This Range as TMI Window" is meant to
//      relabel an existing overlapping record rather than create a new one
//      (see recalcTMIForWindow above), but records created before that
//      reuse logic existed — or by any other path that missed it — can be
//      left behind as a stale, overlapping duplicate of a later window.
//
// For an exact-period group, keeps the OLDEST record (so anything already
// referencing it, like a sent notification, stays valid) and recomputes its
// minutes from that shared period. For a shifted-window group (periods
// overlap but aren't identical), keeps whichever record's window is most
// recently defined — mirroring recalcTMIForWindow's own "the newest manual
// range is authoritative" behavior — and recomputes minutes from that kept
// record's own period. Either way, minutes already served are summed across
// every record in the group so nothing is lost, and the rest are deleted.
//
// Returns an array of { studentId, chattStateANumber, tmiPeriodKey, merged,
// keptId, minutes, servedMinutes } — one entry per duplicate group found.
export async function mergeDuplicateTMI(assignedBy) {
  const [interventions, allLogs, staffList] = await Promise.all([
    getAll('interventionLogs'),
    getAll('classAttendanceLogs'),
    getAll('staff').catch(() => []),
  ]);

  const candidates = interventions.filter(iv =>
    iv.interventionType === 'TMI' && iv.tmiPeriodKey && iv.interventionStatus !== 'Closed'
  );

  const byStudent = new Map();
  candidates.forEach(iv => {
    const studentKey = iv.studentId || `A#:${(iv.chattStateANumber || '').trim()}`;
    if (!byStudent.has(studentKey)) byStudent.set(studentKey, []);
    byStudent.get(studentKey).push(iv);
  });

  const results = [];

  for (const records of byStudent.values()) {
    if (records.length < 2) continue;

    // Connected components by period overlap — handles a chain of records
    // that each overlap the next (a window shifted forward step by step)
    // even when the first and last no longer overlap each other directly.
    const bounds = records.map(periodBounds);
    const n = records.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (periodsOverlap(bounds[i], bounds[j])) union(i, j);
      }
    }
    const clusters = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(records[i]);
    }

    for (const group of clusters.values()) {
      if (group.length < 2) continue;

      const studentId = group[0].studentId || '';
      const chattStateANumber = (group[0].chattStateANumber || '').trim();
      const totalServed = group.reduce((sum, iv) => sum + (iv.tmiMinutesServed || 0), 0);
      const allSameKey = group.every(iv => iv.tmiPeriodKey === group[0].tmiPeriodKey);

      let keep;
      if (allSameKey) {
        keep = [...group].sort((a, b) =>
          (a.createDate || a.createdAt || '').localeCompare(b.createDate || b.createdAt || '')
        )[0];
      } else {
        keep = [...group].sort((a, b) => {
          const aEnd = periodBounds(a).end, bEnd = periodBounds(b).end;
          if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
          return (b.updatedAt || b.createDate || b.createdAt || '').localeCompare(a.updatedAt || a.createDate || a.createdAt || '');
        })[0];
      }

      const { start: periodStart, end: periodEnd } = periodBounds(keep);
      const periodLogs = allLogs.filter(l => {
        const match = studentId
          ? (l.studentId === studentId || (chattStateANumber && (l.chattStateANumber || '').trim() === chattStateANumber))
          : ((l.chattStateANumber || '').trim() === chattStateANumber);
        if (!match) return false;
        const d = (l.date || l.classDate || '').substring(0, 10);
        return d && periodStart && periodEnd && d >= periodStart && d <= periodEnd;
      });

      const uCount = periodLogs.filter(l => l.attendanceCode === 'U').length;
      const tCount = periodLogs.filter(l => l.attendanceCode === 'T').length;
      const overrideCount = periodLogs.filter(l => l.assignTmi && l.attendanceCode !== 'U').length;
      const tardyGroups = Math.floor(tCount / 3);
      const recomputedMinutes = Math.min((uCount * 120) + (overrideCount * 120) + (tardyGroups * 90), MAX_TMI);

      const keepAssignedBy = keep.assignedBy || group.map(iv => iv.assignedBy).find(Boolean) ||
        pickAssignedBy(periodLogs, staffList, assignedBy);

      // Never show less than what's already been logged as served, even if
      // the recomputed total from current logs would otherwise be lower.
      const finalMinutes = Math.max(recomputedMinutes, totalServed);
      const remaining = Math.max(0, finalMinutes - totalServed);
      const toDelete = group.filter(iv => iv.id !== keep.id);

      await updateDoc('interventionLogs', keep.id, {
        tmiMinutes: finalMinutes,
        tmiMinutesServed: totalServed,
        tmiMinutesRemaining: remaining,
        assignedBy: keepAssignedBy,
        updatedAt: new Date().toISOString(),
      });
      await Promise.all(toDelete.map(iv => deleteDoc('interventionLogs', iv.id)));

      results.push({
        studentId, chattStateANumber, tmiPeriodKey: keep.tmiPeriodKey,
        merged: group.length, keptId: keep.id, minutes: finalMinutes, servedMinutes: totalServed,
      });
    }
  }

  return results;
}

// One-time repair for TMI records whose "Assigned By" was previously
// stamped with whoever happened to run a bulk tool (Schedule Admin's
// "Recalculate All TMI" or "Merge Duplicate TMI Records") or edit a
// different student's Daily Attendance, rather than the student's actual
// class teacher — a bug in the self-heal logic that both of those tools
// used before "Assigned By" was resolved from the underlying attendance
// logs (see pickAssignedBy above).
//
// Re-resolves "Assigned By" from the classAttendanceLogs behind each open
// TMI record and overwrites the stored value ONLY when a real class
// teacher can be confidently identified from those logs (via
// teacherLastName) and it differs from what's currently stored. A record
// with no teacher-bearing logs — e.g. a Dress Code Level 1 auto-tardy,
// which has no class/teacher of its own — is left untouched, since there's
// no better source to correct it with and its "Assigned By" was already
// set correctly at creation to whoever logged that intervention.
//
// Returns an array of { studentId, chattStateANumber, tmiPeriodKey, from,
// to } — one entry per record whose Assigned By was corrected.
export async function reconcileAssignedBy() {
  const [interventions, allLogs, staffList] = await Promise.all([
    getAll('interventionLogs'),
    getAll('classAttendanceLogs'),
    getAll('staff').catch(() => []),
  ]);

  const candidates = interventions.filter(iv =>
    iv.interventionType === 'TMI' && iv.tmiPeriodKey && iv.interventionStatus !== 'Closed'
  );

  const results = [];
  for (const iv of candidates) {
    const { start: periodStart, end: periodEnd } = periodBounds(iv);
    if (!periodStart || !periodEnd) continue;

    const studentId = iv.studentId || '';
    const chattStateANumber = (iv.chattStateANumber || '').trim();
    const periodLogs = allLogs.filter(l => {
      const match = studentId
        ? (l.studentId === studentId || (chattStateANumber && (l.chattStateANumber || '').trim() === chattStateANumber))
        : ((l.chattStateANumber || '').trim() === chattStateANumber);
      if (!match) return false;
      const d = (l.date || l.classDate || '').substring(0, 10);
      return d && d >= periodStart && d <= periodEnd;
    });

    const qualifying = periodLogs.filter(l =>
      l.attendanceCode === 'U' || l.attendanceCode === 'T' || (l.assignTmi && l.attendanceCode !== 'U')
    );
    const hasTeacherEvidence = qualifying.some(l => (l.teacherLastName || '').trim());
    if (!hasTeacherEvidence) continue;

    const resolved = pickAssignedBy(periodLogs, staffList, iv.assignedBy);
    if (resolved && resolved !== iv.assignedBy) {
      await updateDoc('interventionLogs', iv.id, {
        assignedBy: resolved,
        updatedAt: new Date().toISOString(),
      });
      results.push({
        studentId, chattStateANumber, tmiPeriodKey: iv.tmiPeriodKey,
        from: iv.assignedBy || '(blank)', to: resolved,
      });
    }
  }

  return results;
}
