// Firebase Configuration
// Replace the placeholder values below with your Firebase project credentials
// from your Firebase Console: https://console.firebase.google.com/

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTs2Ia-PN1mCaQHQyotGA9oFq-8_vE1Uk",
  authDomain: "p2mt-8d513.firebaseapp.com",
  projectId: "p2mt-8d513",
  storageBucket: "p2mt-8d513.firebasestorage.app",
  messagingSenderId: "981918337161",
  appId: "1:981918337161:web:9de337082e62b24a51de58",
  measurementId: "G-4H77EB2JND"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
