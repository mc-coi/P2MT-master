// Database Module
// Firestore database helper functions using Firebase Firestore v10 modular SDK

import { db } from '../firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot,
  addDoc as firebaseAddDoc,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  writeBatch,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Reference-data version stamps ───────────────────────────────────────────
// js/data.js caches slow-changing collections per browser tab and decides
// whether a cached copy is still fresh by comparing one document,
// meta/versions, which holds a stamp per collection. Every write helper below
// calls noteWrite() so that stamp is updated automatically whenever one of
// these collections changes — no page has to remember to do it.
//
// Bursts (e.g. a CSV upload writing 1,000 schedules) are coalesced: one stamp
// write at the start of the burst and one after it settles.
const VERSIONED_COLLECTIONS = new Set([
  'students', 'staff', 'parents', 'classSchedules', 'p2mtTemplates',
  'interventionTypes', 'schoolCalendar', 'pbls', 'pblTeams', 'pblEvents',
  'erWorkshops', 'erRooms', 'guardianEmails',
]);
const BUMP_WINDOW_MS = 3000;
const writeListeners = [];
const bumpState = new Map();

// data.js registers here to drop its local copy the moment this tab writes.
export function onCollectionWrite(callback) { writeListeners.push(callback); }

export function isVersionedCollection(collectionName) { return VERSIONED_COLLECTIONS.has(collectionName); }

async function writeVersionStamp(collectionName) {
  try {
    await firebaseSetDoc(doc(db, 'meta', 'versions'), { [collectionName]: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.warn(`Could not update version stamp for ${collectionName}:`, error);
  }
}

export function bumpVersion(collectionName) {
  if (!VERSIONED_COLLECTIONS.has(collectionName)) return;
  const now = Date.now();
  const st = bumpState.get(collectionName) || { last: 0, timer: null };
  if (now - st.last > BUMP_WINDOW_MS) {
    st.last = now;
    writeVersionStamp(collectionName);
  } else if (!st.timer) {
    st.timer = setTimeout(() => {
      st.timer = null;
      st.last = Date.now();
      writeVersionStamp(collectionName);
    }, BUMP_WINDOW_MS);
  }
  bumpState.set(collectionName, st);
}

function noteWrite(collectionName) {
  if (!VERSIONED_COLLECTIONS.has(collectionName)) return;
  writeListeners.forEach(cb => { try { cb(collectionName); } catch (_) {} });
  bumpVersion(collectionName);
}

// ── Read meter ──────────────────────────────────────────────────────────────
// Every read helper reports how many documents it returned. The day's totals
// are kept in localStorage, broken down by collection AND by page, together
// with a short list of the biggest single reads (with the calling stack), so
// a usage spike can be attributed to a person, a page and a function instead
// of guessed at. Counting costs nothing against Firestore.
//
// js/readstats.js flushes this tally to Firestore periodically so an admin can
// see everyone's numbers in one place (Diagnostics -> Read Usage); p2mtReads()
// in any page's console prints the local copy.
const READ_WARN  = 300;   // a single call returning more than this is logged
const MAX_EVENTS = 25;    // biggest-read records kept per browser per day

export function readMeterDateKey() { return new Date().toISOString().slice(0, 10); }
const METER_KEY = () => `p2mt:reads:${readMeterDateKey()}`;

let tallyCache = null;
let tallyDirty = false;

function emptyTally() {
  return { total: 0, byCollection: {}, byPage: {}, events: [] };
}

// Kept in memory and mirrored to localStorage, so a page that reads a lot
// isn't parsing/serialising the whole tally on every single query.
function loadTally() {
  if (tallyCache) return tallyCache;
  try {
    const raw = localStorage.getItem(METER_KEY());
    const parsed = raw ? JSON.parse(raw) : null;
    tallyCache = parsed && parsed.byCollection ? parsed : emptyTally();
  } catch (_) { tallyCache = emptyTally(); }
  return tallyCache;
}

function saveTally() {
  try { localStorage.setItem(METER_KEY(), JSON.stringify(tallyCache)); } catch (_) {}
}

function currentPage() {
  try { return (location.pathname.split('/').pop() || 'index.html'); } catch (_) { return 'unknown'; }
}

function meter(collectionName, kind, count) {
  try {
    const tally = loadTally();
    const page  = currentPage();

    const col = tally.byCollection[collectionName] || (tally.byCollection[collectionName] = { docs: 0, calls: 0 });
    col.docs += count; col.calls += 1;

    const pg = tally.byPage[page] || (tally.byPage[page] = { docs: 0, calls: 0 });
    pg.docs += count; pg.calls += 1;

    tally.total += count;

    if (count > READ_WARN) {
      // Trim the stack to the frames that identify the caller, and drop the
      // URL noise — what matters is which function on which page did this.
      const stack = (new Error().stack || '').split('\n').slice(2, 6)
        .map(l => l.trim().replace(/https?:\/\/[^ )]+\//g, '').replace(/^at /, ''))
        .filter(Boolean).join(' <- ');
      tally.events.unshift({ at: new Date().toISOString(), page, collection: collectionName, kind, count, stack });
      tally.events = tally.events.slice(0, MAX_EVENTS);
      console.warn(`[p2mt reads] ${kind} on ${collectionName} returned ${count} documents on ${page}`, stack);
    }

    tallyDirty = true;
    saveTally();
  } catch (_) { /* metering must never break a read */ }
}

// For js/readstats.js.
export function getReadTally() { return loadTally(); }
export function isReadTallyDirty() { return tallyDirty; }
export function markReadTallyFlushed() { tallyDirty = false; }

if (typeof window !== 'undefined') {
  window.p2mtReads = function() {
    const tally = loadTally();
    const rows = Object.entries(tally.byCollection)
      .map(([c, v]) => ({ collection: c, documents: v.docs, calls: v.calls }))
      .sort((a, b) => b.documents - a.documents);
    console.table(rows);
    console.table(Object.entries(tally.byPage)
      .map(([p, v]) => ({ page: p, documents: v.docs, calls: v.calls }))
      .sort((a, b) => b.documents - a.documents));
    if (tally.events.length) {
      console.log('Biggest single reads today:');
      console.table(tally.events.map(e => ({ time: e.at.slice(11, 19), page: e.page, collection: e.collection, documents: e.count, from: e.stack })));
    }
    console.log(`Total documents read today from this browser: ${tally.total}`);
    return tally;
  };
}

// Get all documents from a collection
export async function getAll(collectionName) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    meter(collectionName, 'getAll', querySnapshot.size);
    const documents = [];
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return documents;
  } catch (error) {
    console.error(`Error getting all documents from ${collectionName}:`, error);
    throw error;
  }
}

// Get a single document by ID
export async function getById(collectionName, id) {
  try {
    const docSnapshot = await getDoc(doc(db, collectionName, id));
    meter(collectionName, 'getById', 1);
    if (docSnapshot.exists()) {
      return {
        id: docSnapshot.id,
        ...docSnapshot.data()
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting document ${id} from ${collectionName}:`, error);
    throw error;
  }
}

// Get documents with a single where condition
export async function getWhere(collectionName, field, operator, value) {
  try {
    const q = query(collection(db, collectionName), where(field, operator, value));
    const querySnapshot = await getDocs(q);
    meter(collectionName, `getWhere(${field})`, querySnapshot.size);
    const documents = [];
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return documents;
  } catch (error) {
    console.error(`Error querying ${collectionName} where ${field} ${operator} ${value}:`, error);
    throw error;
  }
}

// Get documents with multiple where conditions
export async function getWhereMultiple(collectionName, conditions) {
  try {
    const constraints = conditions.map(([field, operator, value]) =>
      where(field, operator, value)
    );
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    meter(collectionName, `query(${conditions.map(c => c[0]).join('+')})`, querySnapshot.size);
    const documents = [];
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return documents;
  } catch (error) {
    console.error(`Error querying ${collectionName} with multiple conditions:`, error);
    throw error;
  }
}

// Add a new document with auto-generated ID
export async function addDoc(collectionName, data) {
  try {
    const docRef = await firebaseAddDoc(collection(db, collectionName), data);
    noteWrite(collectionName);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw error;
  }
}

// Set a document (overwrites if exists)
export async function setDoc(collectionName, id, data) {
  try {
    await firebaseSetDoc(doc(db, collectionName, id), data);
    noteWrite(collectionName);
    return id;
  } catch (error) {
    console.error(`Error setting document ${id} in ${collectionName}:`, error);
    throw error;
  }
}

// Set a document, merging into any existing fields (creates it if missing)
export async function setDocMerge(collectionName, id, data) {
  try {
    await firebaseSetDoc(doc(db, collectionName, id), data, { merge: true });
    noteWrite(collectionName);
    return id;
  } catch (error) {
    console.error(`Error merging document ${id} in ${collectionName}:`, error);
    throw error;
  }
}

// Update a document (partial update)
export async function updateDoc(collectionName, id, data) {
  try {
    await firebaseUpdateDoc(doc(db, collectionName, id), data);
    noteWrite(collectionName);
    return id;
  } catch (error) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
    throw error;
  }
}

// Delete a document
export async function deleteDoc(collectionName, id) {
  try {
    await firebaseDeleteDoc(doc(db, collectionName, id));
    noteWrite(collectionName);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${id} from ${collectionName}:`, error);
    throw error;
  }
}

// Batch write operations
export async function batchWrite(operations) {
  try {
    const batch = writeBatch(db);
    
    operations.forEach((operation) => {
      const docRef = doc(db, operation.collection, operation.id || operation.docId);
      
      // Default to 'set' when caller omits type (legacy upload code path)
      const opType = operation.type || 'set';
      switch (opType) {
        case 'set':
          batch.set(docRef, operation.data);
          break;
        case 'merge':
          batch.set(docRef, operation.data, { merge: true });
          break;
        case 'update':
          batch.update(docRef, operation.data);
          break;
        case 'delete':
          batch.delete(docRef);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    });
    
    await batch.commit();
    new Set(operations.map(op => op.collection)).forEach(noteWrite);
    return true;
  } catch (error) {
    console.error('Error during batch write:', error);
    throw error;
  }
}

// Real-time listener — returns an unsubscribe function to stop listening
export function listenWhere(collectionName, field, operator, value, callback) {
  const q = query(collection(db, collectionName), where(field, operator, value));
  return onSnapshot(q, (snapshot) => {
    meter(collectionName, `listen(${field})`, snapshot.docChanges().length);
    const documents = [];
    snapshot.forEach((docSnap) => {
      documents.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(documents, snapshot);
  }, (error) => {
    console.error(`listenWhere error on ${collectionName}:`, error);
  });
}
