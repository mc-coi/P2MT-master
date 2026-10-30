// Learning Lab → Level 1 Academic intervention.
//
// Assigning a student a Learning Lab is itself an academic intervention, so
// the lab carries one automatically. It exists only for the lab's dates:
// hidden before the lab starts, removed once it has ended, and removed early
// if the lab is deleted.
//
// There are no Cloud Functions on the Spark plan, so nothing can wake up on
// the end date and delete the record. Instead:
//
//   - every page that lists interventions filters through isInterventionLive(),
//     so an out-of-window record is never shown, sweep or no sweep;
//   - the pages that already load interventions (Students, Student Profile)
//     delete expired ones from the data they have in hand — no extra reads.
//
// The record's ID is derived from the student and the lab's dates, so
// creating, moving and removing it never needs a lookup query first.

import { setDoc, deleteDoc } from './db.js';

export const LAB_INTERVENTION_SOURCE   = 'learningLab';
export const LAB_INTERVENTION_CATEGORY = 'Academic';
export const LAB_INTERVENTION_LEVEL    = 1;
const COLLECTION = 'studentInterventions';

// Today as YYYY-MM-DD in local time — the school's day, not UTC's, so a lab
// ending today is still live at 7pm.
export function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// One intervention per student per lab date range. Null when the lab has no
// dates, because a record with no end can never be removed.
export function labInterventionId(studentId, startDate, endDate) {
  if (!studentId || !startDate || !endDate) return null;
  return `lab_${studentId}_${startDate}_${endDate}`;
}

export function isLabIntervention(rec) {
  return !!rec && rec.source === LAB_INTERVENTION_SOURCE;
}

// Whether a record should be shown today. Anything not created by a lab is
// always live. A lab record with broken dates is shown rather than hidden —
// a visible oddity gets fixed, an invisible one doesn't.
export function isInterventionLive(rec, today = todayISO()) {
  if (!isLabIntervention(rec)) return true;
  const s = rec.labStartDate || '', e = rec.labEndDate || '';
  if (!s || !e) return true;
  return today >= s && today <= e;
}

export function isLabInterventionExpired(rec, today = todayISO()) {
  return isLabIntervention(rec) && !!rec.labEndDate && today > rec.labEndDate;
}

export function buildLabIntervention({ studentId, studentName, startDate, endDate,
                                       className, teacherLastName, assignedBy }) {
  const what = [className || 'Learning Lab', teacherLastName ? `with ${teacherLastName}` : '']
    .filter(Boolean).join(' ');
  return {
    studentId,
    studentName:   studentName || '',
    category:      LAB_INTERVENTION_CATEGORY,
    level:         LAB_INTERVENTION_LEVEL,
    // School starts at 9:30; the intervention begins with the lab.
    dateTime:      `${startDate}T09:30`,
    comments:      `Learning Lab: ${what}, ${startDate} to ${endDate}. Added automatically and removed when the lab ends.`,
    assignedBy:    assignedBy || 'Learning Lab',
    source:        LAB_INTERVENTION_SOURCE,
    labStartDate:  startDate,
    labEndDate:    endDate,
    createdAt:     new Date().toISOString(),
  };
}

// Create or move the lab's intervention. `previous` is the
// { studentId, startDate, endDate } the lab had before an edit, so a change
// of dates — or of student — moves the record rather than leaving the old
// one behind.
export async function syncLabIntervention({ studentId, studentName, startDate, endDate,
                                            className, teacherLastName, assignedBy,
                                            previous = null, today = todayISO() }) {
  const id = labInterventionId(studentId, startDate, endDate);
  const prevId = previous
    ? labInterventionId(previous.studentId || studentId, previous.startDate, previous.endDate)
    : null;

  if (prevId && prevId !== id) {
    await deleteDoc(COLLECTION, prevId).catch(() => {});
  }
  if (!id) return { action: 'skipped', reason: 'no dates' };

  // A lab entered after it has already finished gets no intervention — it
  // would only be swept away again on the next page load.
  if (today > endDate) {
    await deleteDoc(COLLECTION, id).catch(() => {});
    return { action: 'skipped', reason: 'already ended', id };
  }

  await setDoc(COLLECTION, id, buildLabIntervention({
    studentId, studentName, startDate, endDate, className, teacherLastName, assignedBy,
  }));
  return { action: prevId && prevId !== id ? 'moved' : 'saved', id };
}

export async function removeLabIntervention(studentId, startDate, endDate) {
  const id = labInterventionId(studentId, startDate, endDate);
  if (!id) return false;
  await deleteDoc(COLLECTION, id).catch(() => {});
  return true;
}

// Delete expired lab interventions from a list the page has already loaded.
// Returns the IDs removed so the caller can drop them from its own copy.
export async function sweepExpiredLabInterventions(records, today = todayISO()) {
  const expired = (records || []).filter(r => isLabInterventionExpired(r, today));
  const removed = [];
  for (const r of expired) {
    try { await deleteDoc(COLLECTION, r.id); removed.push(r.id); }
    catch (err) { console.warn('Could not remove expired Learning Lab intervention', r.id, err); }
  }
  return removed;
}

// A student's labs that haven't ended yet — running now or still to come —
// one entry per lab rather than per session. Used for the "already has a
// Learning Lab" warning.
export function openLabsForStudent(studentId, schedules, today = todayISO()) {
  if (!studentId) return [];
  const byLab = new Map();
  (schedules || []).forEach(s => {
    if (!s.learningLab || s.studentId !== studentId) return;
    if (s.endDate && s.endDate < today) return;
    const key = `${s.className || ''}|${s.teacherLastName || ''}|${s.startDate || ''}|${s.endDate || ''}`;
    if (!byLab.has(key)) {
      byLab.set(key, {
        className: s.className || 'Learning Lab',
        teacherLastName: s.teacherLastName || '',
        startDate: s.startDate || '',
        endDate: s.endDate || '',
        running: !!s.startDate && s.startDate <= today,
        sessionIds: [],
      });
    }
    byLab.get(key).sessionIds.push(s.id);
  });
  return [...byLab.values()].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}
