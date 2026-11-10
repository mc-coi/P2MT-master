// One-time data clean-ups, run from Admin → Settings → Data Clean-up.
//
// Each has a plan step that only reads data already loaded (or cached) and
// says what it would change, and an apply step that writes exactly that.
// Both are safe to run again: a second run finds nothing to do.

import { updateDoc, setDoc } from './db.js';
import { normalizeHouse } from './utils.js';
import { labInterventionId, buildLabIntervention, todayISO } from './labInterventions.js';

// ── House spelling ────────────────────────────────────────────────────────────
// Student and staff records whose house isn't stored the standard way
// ("Telsa", " tesla ") — the CSV imports wrote them as typed.
export function planHouseFixes(students = [], staff = []) {
  const changes = [];
  const scan = (collection, rows) => rows.forEach(r => {
    const raw = r.house ?? '';
    if (!raw) return;
    const fixed = normalizeHouse(raw);
    if (fixed !== raw) changes.push({ collection, id: r.id, from: raw, to: fixed,
                                      name: `${r.lastName || ''}, ${r.firstName || ''}`.replace(/^, |, $/g, '') });
  });
  scan('students', students);
  scan('staff', staff);
  return changes;
}

export async function applyHouseFixes(changes) {
  let done = 0;
  for (const c of changes) { await updateDoc(c.collection, c.id, { house: c.to }); done++; }
  return done;
}

// ── Learning Lab interventions for labs that predate them ─────────────────────
// Every Learning Lab running now or still to come should carry its Level 1
// Academic intervention. Labs saved before that rule existed don't. One per
// student per date range, however many sessions the lab has. Labs with no
// dates are skipped (they could never be removed), as are finished ones.
//
// Deliberately not done retroactively: the Level 2 escalation and staff
// alerts. Those are for a new assignment, not a history clean-up.
export function planLabBackfill(schedules = [], existingInterventionIds = [], students = [],
                                today = todayISO()) {
  const have = new Set(existingInterventionIds);
  const byId = new Map(students.map(s => [s.id, s]));
  const plan = new Map();
  schedules.forEach(s => {
    if (!s.learningLab || !s.studentId || !s.startDate || !s.endDate) return;
    if (s.endDate < today) return;
    const id = labInterventionId(s.studentId, s.startDate, s.endDate);
    if (!id || have.has(id) || plan.has(id)) return;
    const st = byId.get(s.studentId);
    plan.set(id, {
      id,
      studentId: s.studentId,
      studentName: st ? `${st.lastName || ''}, ${st.firstName || ''}` : (s.studentName || ''),
      startDate: s.startDate, endDate: s.endDate,
      className: s.className || '', teacherLastName: s.teacherLastName || '',
    });
  });
  return [...plan.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export async function applyLabBackfill(plan, assignedBy = 'Learning Lab') {
  let done = 0;
  for (const p of plan) {
    await setDoc('studentInterventions', p.id, buildLabIntervention({ ...p, assignedBy }));
    done++;
  }
  return done;
}
