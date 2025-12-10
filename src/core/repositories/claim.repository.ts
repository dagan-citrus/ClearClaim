/**
 * Repository for Claim entities
 */

import { BaseRepository } from '@infrastructure/database/base-repository';
import { Claim, ClaimStatus, UUID, PaginatedResponse, PaginationParams, ClaimAttachment } from '@core/types';
import { DocumentData, orderBy, where, collection, getDocs, query } from 'firebase/firestore';
import { getFirebaseFirestore } from '@infrastructure/database/firebase';

/**
 * Repository for managing Claim entities in Firestore
 */
export class ClaimRepository extends BaseRepository<Claim> {
  constructor() {
    super('claims');
  }

  /**
   * Load attachments from subcollection
   */
  private async loadAttachments(claimId: string): Promise<ClaimAttachment[]> {
    try {
      const db = getFirebaseFirestore();
      const attachmentsRef = collection(db, 'claims', claimId, 'attachments');
      const q = query(attachmentsRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          fileName: data.fileName,
          mimeType: data.mimeType,
          storageUrl: data.storageUrl,
          base64Data: data.base64Data, // Keep for backwards compatibility
        };
      });
    } catch (error) {
      console.error('Failed to load attachments:', error);
      return [];
    }
  }

  protected fromFirestore(id: string, data: DocumentData): Claim {
    return {
      claimId: id,
      appUserId: data.appUserId,
      personId: data.personId,
      policyId: data.policyId,
      extractedData: data.extractedData,
      attachments: data.attachments || [],
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
    if (entity.attachments !== undefined) data.attachments = entity.attachments;
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
   * Override findById to load attachments from subcollection
   */
  async findById(id: UUID): Promise<Claim | null> {
    const claim = await super.findById(id);
    if (claim) {
      claim.attachments = await this.loadAttachments(id);
    }
    return claim;
  }

  /**
   * Override findByIdOrThrow to load attachments from subcollection
   */
  async findByIdOrThrow(id: UUID): Promise<Claim> {
    const claim = await super.findByIdOrThrow(id);
    claim.attachments = await this.loadAttachments(id);
    return claim;
  }

  /**
   * Find claims by user ID
   */
  async findByUserId(
    appUserId: UUID,
    params?: PaginationParams
  ): Promise<Claim[] | PaginatedResponse<Claim>> {
    let result: Claim[] | PaginatedResponse<Claim>;

    if (params) {
      result = await this.findWithPagination(params, [
        where('appUserId', '==', appUserId),
        orderBy('createdAt', 'desc'),
      ]);
    } else {
      result = await this.findByField('appUserId', appUserId, [orderBy('createdAt', 'desc')]);
    }

    // Load attachments for each claim
    if (Array.isArray(result)) {
      await Promise.all(result.map(async (claim) => {
        claim.attachments = await this.loadAttachments(claim.claimId);
      }));
    } else {
      await Promise.all(result.items.map(async (claim) => {
        claim.attachments = await this.loadAttachments(claim.claimId);
      }));
    }

    return result;
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
