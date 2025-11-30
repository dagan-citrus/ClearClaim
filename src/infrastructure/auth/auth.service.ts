/**
 * Authentication service for Firebase Auth
 */

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { getFirebaseAuth } from '@infrastructure/database/firebase';
import { AuthenticationError, UUID } from '@core/types';
import { UserRepository } from '@core/repositories';

/**
 * Authentication state listener callback
 */
export type AuthStateListener = (user: AuthUser | null) => void;

/**
 * Authenticated user information
 */
export interface AuthUser {
  uid: UUID;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Authentication service class
 */
export class AuthService {
  private userRepository: UserRepository;
  private googleProvider: GoogleAuthProvider;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    this.googleProvider = new GoogleAuthProvider();
  }

  /**
   * Convert Firebase user to AuthUser
   */
  private toAuthUser(firebaseUser: FirebaseUser): AuthUser {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    };
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, this.googleProvider);
      const user = result.user;

      // Upsert user in database
      await this.userRepository.upsertFromAuth(
        user.uid,
        user.email!,
        user.displayName,
        user.photoURL
      );

      return this.toAuthUser(user);
    } catch (error) {
      throw new AuthenticationError(
        `Google sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Upsert user in database
      await this.userRepository.upsertFromAuth(
        user.uid,
        user.email!,
        user.displayName,
        user.photoURL
      );

      return this.toAuthUser(user);
    } catch (error) {
      throw new AuthenticationError(
        `Email sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create account with email and password
   */
  async createAccountWithEmail(
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Create user in database
      await this.userRepository.upsertFromAuth(
        user.uid,
        user.email!,
        displayName,
        null
      );

      return this.toAuthUser(user);
    } catch (error) {
      throw new AuthenticationError(
        `Account creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    } catch (error) {
      throw new AuthenticationError(
        `Sign out failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    return user ? this.toAuthUser(user) : null;
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(callback: AuthStateListener): () => void {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Upsert user in database on state change
        await this.userRepository.upsertFromAuth(
          firebaseUser.uid,
          firebaseUser.email!,
          firebaseUser.displayName,
          firebaseUser.photoURL
        );
        callback(this.toAuthUser(firebaseUser));
      } else {
        callback(null);
      }
    });
  }

  /**
   * Wait for authentication to be ready
   */
  async waitForAuth(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user ? this.toAuthUser(user) : null);
      });
    });
  }
}
