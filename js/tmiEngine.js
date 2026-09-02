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

import { getAll, addDoc, updateDoc, deleteDoc } from './db.js';

const MAX_TMI = 240;

function pad(n) { return String(n).padStart(2, '0'); }

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

  const [schoolCalendar, interventions, allLogs] = await Promise.all([
    getAll('schoolCalendar').catch(() => []),
    getAll('interventionLogs'),
    getAll('classAttendanceLogs'),
  ]);

  const { start: windowStart, end: windowEnd, key: periodKey } = getTmiPeriodWindow(dateStr, schoolCalendar);

  const periodLogs = allLogs.filter(l => {
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
    // that's missing it, stamp whoever's responsible for this recalculation.
    // This attributes the record to whoever happened to trigger the next
    // recalculation, not necessarily who originally caused it — the original
    // assigner is unrecoverable for those older records — but it's better
    // than leaving "Assigned By" blank indefinitely.
    const needsAssignedBy = !existingTMI.assignedBy && !!context.assignedBy;

    if (minutesChanged || needsAssignedBy) {
      const newRemaining = Math.max(0, totalMinutes - (existingTMI.tmiMinutesServed || 0));
      const updates = {
        tmiMinutes: totalMinutes,
        tmiMinutesRemaining: newRemaining,
        reason,
        updatedAt: new Date().toISOString(),
      };
      if (needsAssignedBy) updates.assignedBy = context.assignedBy;
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
      assignedBy: context.assignedBy || 'Unknown',
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

  const [interventions, allLogs] = await Promise.all([
    getAll('interventionLogs'),
    getAll('classAttendanceLogs'),
  ]);

  const periodKey = `range__${startDate}__${endDate}`;

  const inWindow = allLogs.filter(l => {
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
      const needsAssignedBy = !existingTMI.assignedBy && !!assignedBy;

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
        if (needsAssignedBy) updates.assignedBy = assignedBy;
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
        assignedBy: assignedBy || 'Unknown',
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
