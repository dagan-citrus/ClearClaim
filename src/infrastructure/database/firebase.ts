/**
 * Firebase initialization and configuration
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { config } from '@config/index';

/**
 * Singleton Firebase app instance
 */
let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

/**
 * Initialize Firebase app
 */
export function initializeFirebase(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = initializeApp(config.firebase);
  return firebaseApp;
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    initializeFirebase();
    authInstance = getAuth(firebaseApp!);
  }
  return authInstance;
}

/**
 * Get Firestore instance
 */
export function getFirebaseFirestore(): Firestore {
  if (!firestoreInstance) {
    initializeFirebase();
    firestoreInstance = getFirestore(firebaseApp!);
  }
  return firestoreInstance;
}

/**
 * Get Firebase Storage instance
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    initializeFirebase();
    storageInstance = getStorage(firebaseApp!);
  }
  return storageInstance;
}
