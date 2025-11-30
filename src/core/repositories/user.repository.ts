/**
 * User repository for AppUser entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { AppUser, SubscriptionTier, UUID } from '@core/types';
import { DocumentData } from 'firebase/firestore';

/**
 * Repository for managing AppUser entities in Firestore
 */
export class UserRepository extends BaseRepository<AppUser> {
  constructor() {
    super('users');
  }

  protected fromFirestore(id: string, data: DocumentData): AppUser {
    return {
      appUserId: id,
      email: data.email,
      displayName: data.displayName || null,
      photoURL: data.photoURL || null,
      subscriptionTier: data.subscriptionTier as SubscriptionTier,
      createdAt: this.fromFirestoreTimestamp(data.createdAt),
      updatedAt: this.fromFirestoreTimestamp(data.updatedAt),
    };
  }

  protected toFirestore(entity: Partial<AppUser>): DocumentData {
    const data: DocumentData = {};

    if (entity.email !== undefined) data.email = entity.email;
    if (entity.displayName !== undefined) data.displayName = entity.displayName;
    if (entity.photoURL !== undefined) data.photoURL = entity.photoURL;
    if (entity.subscriptionTier !== undefined)
      data.subscriptionTier = entity.subscriptionTier;

    return data;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<AppUser | null> {
    const users = await this.findByField('email', email);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Create or update user from auth data
   */
  async upsertFromAuth(
    userId: UUID,
    email: string,
    displayName: string | null,
    photoURL: string | null
  ): Promise<AppUser> {
    const existingUser = await this.findById(userId);

    if (existingUser) {
      // Update existing user
      await this.update(userId, {
        displayName,
        photoURL,
      } as Partial<AppUser>);
      return this.findByIdOrThrow(userId);
    } else {
      // Create new user with FREE tier
      const now = Date.now();
      const newUser: AppUser = {
        appUserId: userId,
        email,
        displayName,
        photoURL,
        subscriptionTier: SubscriptionTier.FREE,
        createdAt: now,
        updatedAt: now,
      };

      // We need to store with the specific ID
      const db = (await import('@infrastructure/database/firebase')).getFirebaseFirestore();
      const { doc, setDoc } = await import('firebase/firestore');
      const docRef = doc(db, this.collectionName, userId);

      await setDoc(docRef, {
        ...this.toFirestore(newUser),
        createdAt: this.toFirestoreTimestamp(now),
        updatedAt: this.toFirestoreTimestamp(now),
      });

      return newUser;
    }
  }

  /**
   * Update user subscription tier
   */
  async updateSubscriptionTier(
    userId: UUID,
    tier: SubscriptionTier
  ): Promise<void> {
    await this.update(userId, { subscriptionTier: tier } as Partial<AppUser>);
  }
}
