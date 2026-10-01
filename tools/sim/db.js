// STUB db.js for simulation tests — mirrors the real js/db.js API surface,
// with Firestore-accurate semantics that matter for this app: a query
// condition never matches a document where the field is absent; every
// returned document is a billed read; index failures can be injected.
export const store = { schoolCalendar: [], interventionLogs: [], classAttendanceLogs: [], attendanceEvents: [], attendanceSessions: [], dailyAttendanceLogs: [], classSchedules: [], staff: [], students: [], meta: [], erWorkshops: [], erRooms: [], erRoomStudents: [] };
export const stats = { getAll: 0, query: 0, getById: 0, reads: 0, writes: 0, stampWrites: 0 };
let nextId = 1;
let failPredicate = null;
export function setFailQueriesMatching(fn) { failPredicate = fn; }
export const getAllBy = {};
export function resetStats() { for (const k in stats) stats[k] = 0; for (const k in getAllBy) delete getAllBy[k]; }

const VERSIONED = new Set(['students','staff','parents','classSchedules','p2mtTemplates','interventionTypes','schoolCalendar','pbls','pblTeams','pblEvents','erWorkshops','erRooms','guardianEmails']);
const listeners = [];
export function onCollectionWrite(cb) { listeners.push(cb); }
export function isVersionedCollection(c) { return VERSIONED.has(c); }
export function bumpVersion(c) {
  if (!VERSIONED.has(c)) return;
  stats.stampWrites++;
  let v = store.meta.find(d => d.id === 'versions');
  if (!v) { v = { id: 'versions' }; store.meta.push(v); }
  v[c] = 'stamp-' + (stats.stampWrites);
}
function noteWrite(c) { if (!VERSIONED.has(c)) return; listeners.forEach(cb => { try { cb(c); } catch (_) {} }); bumpVersion(c); }

const OPS = { '==':(a,b)=>a===b, '!=':(a,b)=>a!==b, '>=':(a,b)=>a>=b, '<=':(a,b)=>a<=b, '>':(a,b)=>a>b, '<':(a,b)=>a<b, 'in':(a,b)=>Array.isArray(b)&&b.includes(a) };

export async function getAll(c) { stats.getAll++; getAllBy[c] = (getAllBy[c]||0)+1; const r = (store[c]||[]).map(d => ({...d})); stats.reads += r.length; return r; }
export async function getById(c, id) { stats.getById++; stats.reads++; const d = (store[c]||[]).find(x => x.id === id); return d ? {...d} : null; }
export async function getWhere(c, f, o, v) { return getWhereMultiple(c, [[f, o, v]]); }
export async function getWhereMultiple(c, conditions) {
  stats.query++;
  if (failPredicate && failPredicate(c, conditions)) throw new Error('Simulated missing index: ' + conditions.map(x => x[0]).join('+'));
  const r = (store[c]||[]).filter(d => conditions.every(([f, o, v]) => { const x = d[f]; if (x === undefined) return false; const fn = OPS[o]; if (!fn) throw new Error('bad op ' + o); return fn(x, v); })).map(d => ({...d}));
  stats.reads += r.length; return r;
}
export async function addDoc(c, data) { stats.writes++; const id = 'id' + (nextId++); (store[c] = store[c] || []).push({ id, ...data }); noteWrite(c); return id; }
export async function setDoc(c, id, data) { stats.writes++; store[c] = (store[c] || []).filter(d => d.id !== id); store[c].push({ id, ...data }); noteWrite(c); return id; }
export async function setDocMerge(c, id, data) { stats.writes++; const d = (store[c] || []).find(x => x.id === id); if (d) Object.assign(d, data); else (store[c] = store[c] || []).push({ id, ...data }); noteWrite(c); return id; }
export async function updateDoc(c, id, data) { stats.writes++; const d = (store[c] || []).find(x => x.id === id); if (d) Object.assign(d, data); noteWrite(c); return id; }
export async function deleteDoc(c, id) { stats.writes++; store[c] = (store[c] || []).filter(d => d.id !== id); noteWrite(c); return true; }
export async function batchWrite(ops) { if (ops.length > 500) throw new Error('batch too large'); stats.batches = (stats.batches||0)+1; for (const op of ops) { if ((op.type||'set')==='delete') await deleteDoc(op.collection, op.id||op.docId); else if (op.type==='update') await updateDoc(op.collection, op.id||op.docId, op.data); else if (op.type==='merge') await setDocMerge(op.collection, op.id||op.docId, op.data); else await setDoc(op.collection, op.id||op.docId, op.data); } return true; }
