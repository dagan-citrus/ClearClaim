/**
 * Repository for InsuredPerson entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { InsuredPerson, UUID } from '@core/types';
import { DocumentData, orderBy } from 'firebase/firestore';

/**
 * Repository for managing InsuredPerson entities in Firestore
 */
export class InsuredPersonRepository extends BaseRepository<InsuredPerson> {
  constructor() {
    super('insured_persons');
  }

  protected fromFirestore(id: string, data: DocumentData): InsuredPerson {
    return {
      personId: id,
      appUserId: data.appUserId,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      primaryId: data.primaryId,
      createdAt: this.fromFirestoreTimestamp(data.createdAt),
      updatedAt: this.fromFirestoreTimestamp(data.updatedAt),
    };
  }

  protected toFirestore(entity: Partial<InsuredPerson>): DocumentData {
    const data: DocumentData = {};

    if (entity.appUserId !== undefined) data.appUserId = entity.appUserId;
    if (entity.fullName !== undefined) data.fullName = entity.fullName;
    if (entity.dateOfBirth !== undefined) data.dateOfBirth = entity.dateOfBirth;
    if (entity.primaryId !== undefined) data.primaryId = entity.primaryId;

    return data;
  }

  /**
   * Find all insured persons for a user
   */
  async findByUserId(appUserId: UUID): Promise<InsuredPerson[]> {
    return this.findByField('appUserId', appUserId, [orderBy('fullName', 'asc')]);
  }

  /**
   * Count insured persons for a user
   */
  async countByUserId(appUserId: UUID): Promise<number> {
    const persons = await this.findByUserId(appUserId);
    return persons.length;
  }

  /**
   * Find insured person by primary ID
   */
  async findByPrimaryId(
    appUserId: UUID,
    primaryId: string
  ): Promise<InsuredPerson | null> {
    const persons = await this.findByUserId(appUserId);
    return persons.find((p) => p.primaryId === primaryId) || null;
  }
}
