// Authentication Module
// Handles Firebase Authentication with Google provider

import { auth } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const googleProvider = new GoogleAuthProvider();

// Initialize authentication and set up state listener
export function initAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in
        resolve(user);
      } else {
        // User is not logged in, redirect to login page
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
          window.location.href = './index.html';
        }
        resolve(null);
      }
    });
  });
}

// Sign in with Google using a popup
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

// Sign out the current user
export async function signOut() {
  try {
    await firebaseSignOut(auth);
    window.location.href = './index.html';
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Get the current logged-in user
export function getCurrentUser() {
  return auth.currentUser;
}

// Get the current user's ID token for API calls
export async function getIdToken() {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No user is currently logged in');
  }
  return await user.getIdToken();
}
