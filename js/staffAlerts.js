// Staff alerts: a short note on chosen staff members' Home screens when a
// student reaches a serious intervention level.
//
// Who receives them is a list of staff emails kept in settings/interventionAlerts
// and edited in Admin. Each alert is written once per recipient
// (staffAlerts/{interventionId}__{email}), so Home finds a person's alerts with
// a single equality query on forEmail — no composite index — and dismissing one
// removes it for that person only.
//
// The student's name is stored so Home can show it, but Home keeps it hidden
// until clicked: the screen may be visible to students passing by.
//
// Alerts last a week. With no Cloud Functions nothing deletes them on time, so
// Home filters out anything expired and deletes it from the data it already
// read — the same approach as Learning Lab interventions.

import { getById, getWhere, setDoc, deleteDoc } from './db.js';

export const ALERT_DAYS = 7;
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC = 'interventionAlerts';
const COLLECTION = 'staffAlerts';

// Which interventions raise an alert. One row per rule, so another level is a
// one-line change.
export const ALERT_RULES = [
  { category: 'Academic',   level: 2 },
  { category: 'Dress Code', level: 3 },
];

export function shouldAlert(intervention) {
  if (!intervention) return false;
  const level = Number(intervention.level);
  return ALERT_RULES.some(r => r.category === intervention.category && r.level === level);
}

const normEmail = e => String(e || '').trim().toLowerCase();
const emailKey  = e => normEmail(e).replace(/[^a-z0-9]+/g, '_');

export async function getAlertRecipients() {
  const doc = await getById(SETTINGS_COLLECTION, SETTINGS_DOC).catch(() => null);
  return [...new Set((doc?.recipients || []).map(normEmail).filter(e => e.includes('@')))];
}

export async function setAlertRecipients(emails, updatedBy = '') {
  const recipients = [...new Set((emails || []).map(normEmail).filter(e => e.includes('@')))];
  await setDoc(SETTINGS_COLLECTION, SETTINGS_DOC, { recipients, updatedBy, updatedAt: new Date().toISOString() });
  return recipients;
}

// Alert every recipient about one intervention. Safe to call twice for the
// same intervention: the IDs are fixed, so a repeat overwrites rather than
// duplicating. Returns how many people were alerted.
export async function sendInterventionAlert({ interventionId, studentId, studentName,
                                              category, level, reason = '', createdBy = '',
                                              now = new Date() }) {
  if (!interventionId || !shouldAlert({ category, level })) return 0;
  const recipients = await getAlertRecipients();
  if (!recipients.length) return 0;

  const expires = new Date(now);
  expires.setDate(expires.getDate() + ALERT_DAYS);
  const base = {
    interventionId, studentId: studentId || '', studentName: studentName || '',
    category, level: Number(level), reason, createdBy,
    createdAt: now.toISOString(), expiresAt: expires.toISOString(),
  };
  for (const r of recipients) {
    await setDoc(COLLECTION, `${interventionId}__${emailKey(r)}`, { ...base, forEmail: r });
  }
  return recipients.length;
}

// The signed-in person's current alerts, newest first. Expired ones are
// deleted from what was just read rather than with a separate query.
export async function loadMyAlerts(email, now = new Date()) {
  const me = normEmail(email);
  if (!me) return [];
  const all = await getWhere(COLLECTION, 'forEmail', '==', me);
  const stamp = now.toISOString();
  const live = [], expired = [];
  (all || []).forEach(a => ((a.expiresAt || '') > stamp ? live : expired).push(a));
  for (const a of expired) await deleteDoc(COLLECTION, a.id).catch(() => {});
  return live.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function dismissAlert(id) {
  if (id) await deleteDoc(COLLECTION, id);
}

// What an alert says, without the name — the name is revealed on click.
export function alertHeadline(a) {
  return `Level ${a.level} ${a.category} intervention`;
}
