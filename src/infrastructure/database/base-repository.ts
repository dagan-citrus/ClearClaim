/**
 * Base repository with common Firestore operations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  startAfter,
  Query,
  DocumentData,
  QueryConstraint,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import { UUID, Timestamp, PaginatedResponse, PaginationParams } from '@core/types';
import { DatabaseError, NotFoundError } from '@core/types';

/**
 * Base repository class with common CRUD operations
 */
export abstract class BaseRepository<T extends { [key: string]: any }> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  /**
   * Get Firestore collection reference
   */
  protected getCollection() {
    const db = getFirebaseFirestore();
    return collection(db, this.collectionName);
  }

  /**
   * Convert Firestore document to entity
   */
  protected abstract fromFirestore(id: string, data: DocumentData): T;

  /**
   * Convert entity to Firestore document
   */
  protected abstract toFirestore(entity: Partial<T>): DocumentData;

  /**
   * Convert timestamp to Firestore timestamp
   */
  protected toFirestoreTimestamp(timestamp: Timestamp): FirestoreTimestamp {
    return FirestoreTimestamp.fromMillis(timestamp);
  }

  /**
   * Convert Firestore timestamp to number
   */
  protected fromFirestoreTimestamp(timestamp: FirestoreTimestamp): Timestamp {
    return timestamp.toMillis();
  }

  /**
   * Find entity by ID
   */
  async findById(id: UUID): Promise<T | null> {
    try {
      const db = getFirebaseFirestore();
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.fromFirestore(docSnap.id, docSnap.data());
    } catch (error) {
      throw new DatabaseError(
        `Failed to find ${this.collectionName} by ID: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find entity by ID or throw
   */
  async findByIdOrThrow(id: UUID): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundError(this.collectionName, id);
    }
    return entity;
  }

  /**
   * Find all entities with optional query constraints
   */
  async findAll(constraints?: QueryConstraint[]): Promise<T[]> {
    try {
      const collectionRef = this.getCollection();
      const q = constraints ? query(collectionRef, ...constraints) : collectionRef;
      const querySnapshot = await getDocs(q as Query<DocumentData>);

      return querySnapshot.docs.map((doc) =>
        this.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to find ${this.collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find entities with pagination
   */
  async findWithPagination(
    params: PaginationParams,
    constraints?: QueryConstraint[]
  ): Promise<PaginatedResponse<T>> {
    try {
      const collectionRef = this.getCollection();
      const baseConstraints = constraints || [];

      // Count query (without pagination)
      const countQuery = query(collectionRef, ...baseConstraints);
      const countSnapshot = await getDocs(countQuery as Query<DocumentData>);
      const total = countSnapshot.size;

      // Data query (with pagination)
      const paginatedConstraints = [
        ...baseConstraints,
        limit(params.limit + 1), // Fetch one extra to check hasMore
      ];

      if (params.offset > 0) {
        // For offset-based pagination, we need to skip documents
        const offsetQuery = query(
          collectionRef,
          ...baseConstraints,
          limit(params.offset)
        );
        const offsetSnapshot = await getDocs(offsetQuery as Query<DocumentData>);
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        if (lastDoc) {
          paginatedConstraints.push(startAfter(lastDoc));
        }
      }

      const dataQuery = query(collectionRef, ...paginatedConstraints);
      const dataSnapshot = await getDocs(dataQuery as Query<DocumentData>);

      const items = dataSnapshot.docs
        .slice(0, params.limit)
        .map((doc) => this.fromFirestore(doc.id, doc.data()));

      const hasMore = dataSnapshot.docs.length > params.limit;

      return {
        items,
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore,
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to paginate ${this.collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new entity
   */
  async create(entity: Partial<T>): Promise<UUID> {
    try {
      const collectionRef = this.getCollection();
      const now = Date.now();

      const dataToStore = {
        ...this.toFirestore(entity),
        createdAt: this.toFirestoreTimestamp(now),
        updatedAt: this.toFirestoreTimestamp(now),
      };

      const docRef = await addDoc(collectionRef, dataToStore);
      return docRef.id;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create ${this.collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing entity
   */
  async update(id: UUID, updates: Partial<T>): Promise<void> {
    try {
      const db = getFirebaseFirestore();
      const docRef = doc(db, this.collectionName, id);

      const dataToUpdate = {
        ...this.toFirestore(updates),
        updatedAt: this.toFirestoreTimestamp(Date.now()),
      };

      await updateDoc(docRef, dataToUpdate);
    } catch (error) {
      throw new DatabaseError(
        `Failed to update ${this.collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: UUID): Promise<void> {
    try {
      const db = getFirebaseFirestore();
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete ${this.collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find entities by field value
   */
  async findByField(
    fieldName: string,
    value: any,
    constraints?: QueryConstraint[]
  ): Promise<T[]> {
    const whereConstraint = where(fieldName, '==', value);
    const allConstraints = constraints
      ? [whereConstraint, ...constraints]
      : [whereConstraint];

    return this.findAll(allConstraints);
  }

  /**
   * Check if entity exists
   */
  async exists(id: UUID): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }
}
