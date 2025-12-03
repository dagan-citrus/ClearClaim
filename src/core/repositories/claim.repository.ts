/**
 * Repository for Claim entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { Claim, ClaimStatus, UUID, PaginatedResponse, PaginationParams } from '@core/types';
import { DocumentData, orderBy, where } from 'firebase/firestore';

/**
 * Repository for managing Claim entities in Firestore
 */
export class ClaimRepository extends BaseRepository<Claim> {
  constructor() {
    super('claims');
  }

  protected fromFirestore(id: string, data: DocumentData): Claim {
    return {
      claimId: id,
      appUserId: data.appUserId,
      personId: data.personId,
      policyId: data.policyId,
      extractedData: data.extractedData,
      emailSubject: data.emailSubject || null,
      emailDraft: data.emailDraft || null,
      status: data.status as ClaimStatus,
      isOneClickEligible: data.isOneClickEligible || false,
      submittedAt: data.submittedAt
        ? this.fromFirestoreTimestamp(data.submittedAt)
        : null,
      createdAt: this.fromFirestoreTimestamp(data.createdAt),
      updatedAt: this.fromFirestoreTimestamp(data.updatedAt),
    };
  }

  protected toFirestore(entity: Partial<Claim>): DocumentData {
    const data: DocumentData = {};

    if (entity.appUserId !== undefined) data.appUserId = entity.appUserId;
    if (entity.personId !== undefined) data.personId = entity.personId;
    if (entity.policyId !== undefined) data.policyId = entity.policyId;
    if (entity.extractedData !== undefined)
      data.extractedData = entity.extractedData;
    if (entity.emailSubject !== undefined) data.emailSubject = entity.emailSubject;
    if (entity.emailDraft !== undefined) data.emailDraft = entity.emailDraft;
    if (entity.status !== undefined) data.status = entity.status;
    if (entity.isOneClickEligible !== undefined)
      data.isOneClickEligible = entity.isOneClickEligible;
    if (entity.submittedAt !== undefined) {
      data.submittedAt = entity.submittedAt
        ? this.toFirestoreTimestamp(entity.submittedAt)
        : null;
    }

    return data;
  }

  /**
   * Find claims by user ID
   */
  async findByUserId(
    appUserId: UUID,
    params?: PaginationParams
  ): Promise<Claim[] | PaginatedResponse<Claim>> {
    if (params) {
      return this.findWithPagination(params, [
        where('appUserId', '==', appUserId),
        orderBy('createdAt', 'desc'),
      ]);
    }
    return this.findByField('appUserId', appUserId, [orderBy('createdAt', 'desc')]);
  }

  /**
   * Find claims by person ID
   */
  async findByPersonId(personId: UUID): Promise<Claim[]> {
    return this.findByField('personId', personId, [orderBy('createdAt', 'desc')]);
  }

  /**
   * Find claims by status
   */
  async findByStatus(appUserId: UUID, status: ClaimStatus): Promise<Claim[]> {
    return this.findAll([
      where('appUserId', '==', appUserId),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Count claims by user in a date range
   */
  async countByUserInPeriod(
    appUserId: UUID,
    periodStart: number,
    periodEnd: number
  ): Promise<number> {
    const claims = await this.findAll([
      where('appUserId', '==', appUserId),
      where('createdAt', '>=', this.toFirestoreTimestamp(periodStart)),
      where('createdAt', '<=', this.toFirestoreTimestamp(periodEnd)),
    ]);
    return claims.length;
  }

  /**
   * Find submitted claims in a date range
   */
  async findSubmittedInPeriod(
    appUserId: UUID,
    periodStart: number,
    periodEnd: number
  ): Promise<Claim[]> {
    return this.findAll([
      where('appUserId', '==', appUserId),
      where('status', '==', ClaimStatus.SUBMITTED),
      where('submittedAt', '>=', this.toFirestoreTimestamp(periodStart)),
      where('submittedAt', '<=', this.toFirestoreTimestamp(periodEnd)),
      orderBy('submittedAt', 'desc'),
    ]);
  }
}
