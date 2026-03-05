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
  addDoc as firebaseAddDoc,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  writeBatch,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Get all documents from a collection
export async function getAll(collectionName) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
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
    return id;
  } catch (error) {
    console.error(`Error setting document ${id} in ${collectionName}:`, error);
    throw error;
  }
}

// Update a document (partial update)
export async function updateDoc(collectionName, id, data) {
  try {
    await firebaseUpdateDoc(doc(db, collectionName, id), data);
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
      const docRef = doc(db, operation.collection, operation.id);
      
      switch (operation.type) {
        case 'set':
          batch.set(docRef, operation.data);
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
    return true;
  } catch (error) {
    console.error('Error during batch write:', error);
    throw error;
  }
}
