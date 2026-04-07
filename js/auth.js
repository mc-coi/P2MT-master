// Authentication Module
// Handles Firebase Authentication with Google provider

import { auth } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getWhere } from './db.js';

const googleProvider = new GoogleAuthProvider();

// Initialize authentication and set up state listener
// On protected pages, also verifies the signed-in email is in the staff allowlist.
export function initAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isLoginPage =
          window.location.pathname.includes('index.html') ||
          window.location.pathname === '/';

        if (!isLoginPage) {
          // Verify this email is registered as staff
          try {
            const results = await getWhere('staff', 'email', '==', user.email);
            if (!results || results.length === 0) {
              // Not authorized — sign out and send back to login with denied flag
              await firebaseSignOut(auth);
              window.location.href = './index.html?denied=1';
              resolve(null);
              return;
            }
          } catch (err) {
            console.error('Staff allowlist check failed:', err);
            // Fail open on network/Firestore errors so a temporary outage
            // doesn't lock everyone out of the app.
          }
        }

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
