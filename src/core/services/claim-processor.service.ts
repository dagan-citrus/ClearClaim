/**
 * Claim processing service - handles receipt extraction and claim matching
 */

import { config } from '@config/index';
import {
  UUID,
  ExtractedReceiptData,
  ClaimStatus,
  CreateClaimDTO,
  UpdateClaimDTO,
  OneClickEligibilityDTO,
  Claim,
  ClaimWithDetails,
  UserPolicy,
} from '@core/types';
import {
  ClaimRepository,
  InsuredPersonRepository,
  PolicyRepository,
  InsurerRepository,
} from '@core/repositories';
import { GeminiService } from '@infrastructure/llm';
import { generateUUID, now } from '@core/utils';
import { SubscriptionService } from './subscription.service';

/**
 * Service for processing insurance claims
 */
export class ClaimProcessorService {
  constructor(
    private claimRepository: ClaimRepository,
    private insuredPersonRepository: InsuredPersonRepository,
    private policyRepository: PolicyRepository,
    private insurerRepository: InsurerRepository,
    private geminiService: GeminiService,
    private subscriptionService: SubscriptionService
  ) {}

  /**
   * Remove undefined values from an object (Firestore doesn't support undefined)
   */
  private cleanUndefined(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanUndefined(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.cleanUndefined(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    return obj;
  }

  /**
   * Process receipt images/documents and create draft claim
   */
  async processReceipt(
    appUserId: UUID,
    dto: CreateClaimDTO
  ): Promise<{ claimId: UUID; extractedData: ExtractedReceiptData }> {
    // Enforce subscription limits
    await this.subscriptionService.enforceClaimSubmissionLimit(appUserId);

    let extractedData: ExtractedReceiptData;

    // Determine processing strategy based on what was uploaded
    const hasImages = dto.images && dto.images.length > 0;
    const hasDocuments = dto.documents && dto.documents.length > 0;

    if (hasDocuments && !hasImages) {
      // Documents only - use text extraction
      extractedData = await this.geminiService.extractReceiptDataFromDocuments(dto.documents!);
    } else if (hasImages && !hasDocuments) {
      // Images only - use OCR
      extractedData = await this.geminiService.extractReceiptData(dto.images!);
    } else if (hasImages && hasDocuments) {
      // Both images and documents - combine results
      // Process images first (OCR)
      const imageData = await this.geminiService.extractReceiptData(dto.images!);
      // Process documents
      const docData = await this.geminiService.extractReceiptDataFromDocuments(dto.documents!);

      // Merge the results - prefer image data but supplement with document data
      extractedData = {
        ...docData,
        ...imageData,
        // Combine line items from both sources
        lineItems: [...(imageData.lineItems || []), ...(docData.lineItems || [])],
        // Use the higher confidence score
        extractionConfidence: Math.max(
          imageData.extractionConfidence || 0,
          docData.extractionConfidence || 0
        ),
      };
    } else {
      throw new Error('No images or documents provided for processing');
    }

    // Create draft claim
    const claimId = generateUUID();

    // Store claim with ID
    const db = (await import('@infrastructure/database/firebase')).getFirebaseFirestore();
    const { doc, setDoc, collection } = await import('firebase/firestore');
    const docRef = doc(db, 'claims', claimId);

    const timestamp = now();
    // Remove undefined values before storing (Firestore doesn't support undefined)
    const cleanedExtractedData = this.cleanUndefined(extractedData);

    // Store claim without attachments first (to avoid nested array size limits)
    await setDoc(docRef, {
      appUserId,
      personId: null,
      policyId: null,
      extractedData: cleanedExtractedData,
      attachments: [], // Store as empty array, will be populated from subcollection
      emailDraft: null,
      status: ClaimStatus.DRAFT,
      isOneClickEligible: false,
      submittedAt: null,
      createdAt: (await import('firebase/firestore')).Timestamp.fromMillis(timestamp),
      updatedAt: (await import('firebase/firestore')).Timestamp.fromMillis(timestamp),
    });

    // Store attachments in subcollection to avoid Firestore nested entity limits
    const attachmentsRef = collection(db, 'claims', claimId, 'attachments');
    let attachmentIndex = 0;

    // Store image attachments
    if (dto.images) {
      for (let i = 0; i < dto.images.length; i++) {
        const img = dto.images[i];
        const attachmentDoc = doc(attachmentsRef, `attachment_${attachmentIndex}`);
        await setDoc(attachmentDoc, {
          fileName: img.description || `image_${i}.jpg`,
          mimeType: img.type || 'image/jpeg',
          base64Data: img.data || '',
          order: attachmentIndex,
          createdAt: (await import('firebase/firestore')).Timestamp.fromMillis(timestamp),
        });
        attachmentIndex++;
      }
    }

    // Store document attachments
    if (dto.documents) {
      for (let i = 0; i < dto.documents.length; i++) {
        const doc_item = dto.documents[i];
        const attachmentDoc = doc(attachmentsRef, `attachment_${attachmentIndex}`);
        const extension = doc_item.type.includes('pdf') ? 'pdf' :
                         doc_item.type.includes('word') ? 'docx' : 'txt';
        await setDoc(attachmentDoc, {
          fileName: doc_item.description || `document_${i}.${extension}`,
          mimeType: doc_item.type || 'application/octet-stream',
          base64Data: doc_item.data || '',
          order: attachmentIndex,
          createdAt: (await import('firebase/firestore')).Timestamp.fromMillis(timestamp),
        });
        attachmentIndex++;
      }
    }

    return { claimId, extractedData };
  }

  /**
   * Check if claim is eligible for One-Click submission
   */
  async checkOneClickEligibility(
    appUserId: UUID,
    extractedData: ExtractedReceiptData
  ): Promise<OneClickEligibilityDTO> {
    // Check confidence threshold
    if (
      extractedData.extractionConfidence < config.app.ocrConfidenceThreshold
    ) {
      return {
        isEligible: false,
        reason: `OCR confidence (${extractedData.extractionConfidence}%) is below threshold (${config.app.ocrConfidenceThreshold}%)`,
      };
    }

    // Check amount threshold
    if (extractedData.totalAmount >= config.app.oneClickThreshold) {
      return {
        isEligible: false,
        reason: `Claim amount ($${extractedData.totalAmount}) exceeds one-click threshold ($${config.app.oneClickThreshold})`,
      };
    }

    // Try to auto-match using extracted policy number first
    if (extractedData.policyNumber) {
      const matchedPolicy = await this.findPolicyByNumber(
        appUserId,
        extractedData.policyNumber
      );

      if (matchedPolicy) {
        const person = await this.insuredPersonRepository.findByIdOrThrow(
          matchedPolicy.personId
        );

        return {
          isEligible: true,
          confidence: extractedData.extractionConfidence,
          suggestedPersonId: person.personId,
          suggestedPolicyId: matchedPolicy.policyId,
          estimatedAmount: extractedData.totalAmount,
        };
      }
    }

    // Fallback to single person + default policy logic
    const insuredPersons = await this.insuredPersonRepository.findByUserId(appUserId);
    if (insuredPersons.length === 0) {
      return {
        isEligible: false,
        reason: 'No insured persons configured',
      };
    }

    // If more than one person and no policy number match, require manual selection
    if (insuredPersons.length > 1) {
      return {
        isEligible: false,
        reason: 'Multiple insured persons - manual selection required',
      };
    }

    const person = insuredPersons[0];

    // Get default policy for this person
    const defaultPolicy = await this.policyRepository.findDefaultByPersonId(
      person.personId
    );

    if (!defaultPolicy) {
      return {
        isEligible: false,
        reason: 'No default policy configured',
      };
    }

    // All checks passed!
    return {
      isEligible: true,
      confidence: extractedData.extractionConfidence,
      suggestedPersonId: person.personId,
      suggestedPolicyId: defaultPolicy.policyId,
      estimatedAmount: extractedData.totalAmount,
    };
  }

  /**
   * Find policy by policy number for a user
   */
  private async findPolicyByNumber(
    appUserId: UUID,
    policyNumber: string
  ): Promise<UserPolicy | null> {
    // Get all insured persons for this user
    const insuredPersons = await this.insuredPersonRepository.findByUserId(appUserId);

    // Search through all policies for all persons
    for (const person of insuredPersons) {
      const policies = await this.policyRepository.findByPersonId(person.personId);
      const matchedPolicy = policies.find(
        (p) => p.policyNumber.toLowerCase() === policyNumber.toLowerCase()
      );

      if (matchedPolicy) {
        return matchedPolicy;
      }
    }

    return null;
  }

  /**
   * Update claim with person and policy selection
   */
  async updateClaim(
    claimId: UUID,
    appUserId: UUID,
    dto: UpdateClaimDTO
  ): Promise<Claim> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    // Verify ownership
    if (claim.appUserId !== appUserId) {
      throw new Error('Unauthorized to update this claim');
    }

    // Prepare updates
    const updates: Partial<Claim> = {};

    if (dto.personId) {
      // Verify person belongs to user
      const person = await this.insuredPersonRepository.findByIdOrThrow(dto.personId);
      if (person.appUserId !== appUserId) {
        throw new Error('Invalid person ID');
      }
      updates.personId = dto.personId;
    }

    if (dto.policyId) {
      // Verify policy belongs to person
      const policy = await this.policyRepository.findByIdOrThrow(dto.policyId);
      if (dto.personId && policy.personId !== dto.personId) {
        throw new Error('Policy does not belong to selected person');
      }
      updates.policyId = dto.policyId;
    }

    if (dto.emailDraft) {
      updates.emailDraft = dto.emailDraft;
    }

    if (dto.lineItemAllocations) {
      // Update line item allocations
      const updatedData = { ...claim.extractedData };
      dto.lineItemAllocations.forEach((allocation) => {
        if (allocation.lineItemIndex < updatedData.lineItems.length) {
          updatedData.lineItems[allocation.lineItemIndex].personId =
            allocation.personId;
          if (allocation.amount !== undefined) {
            updatedData.lineItems[allocation.lineItemIndex].amount =
              allocation.amount;
          }
        }
      });
      updates.extractedData = updatedData;
    }

    // Update status if person and policy are set
    if ((updates.personId || claim.personId) && (updates.policyId || claim.policyId)) {
      updates.status = ClaimStatus.READY_FOR_REVIEW;
    }

    await this.claimRepository.update(claimId, updates);
    return this.claimRepository.findByIdOrThrow(claimId);
  }

  /**
   * Get claim with full details (person, policy, insurer)
   */
  async getClaimWithDetails(claimId: UUID): Promise<ClaimWithDetails> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (!claim.personId || !claim.policyId) {
      throw new Error('Claim is not fully configured');
    }

    const [person, policy] = await Promise.all([
      this.insuredPersonRepository.findByIdOrThrow(claim.personId),
      this.policyRepository.findByIdOrThrow(claim.policyId),
    ]);

    const insurer = await this.insurerRepository.findByIdOrThrow(policy.insurerId);

    return {
      ...claim,
      person,
      policy,
      insurer,
    };
  }

  /**
   * Approve claim for submission
   */
  async approveClaim(claimId: UUID, appUserId: UUID): Promise<Claim> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (claim.appUserId !== appUserId) {
      throw new Error('Unauthorized to approve this claim');
    }

    if (claim.status !== ClaimStatus.READY_FOR_REVIEW) {
      throw new Error('Claim is not ready for approval');
    }

    await this.claimRepository.update(claimId, {
      status: ClaimStatus.APPROVED,
    } as Partial<Claim>);

    return this.claimRepository.findByIdOrThrow(claimId);
  }

  /**
   * Get all claims for a user
   */
  async getUserClaims(appUserId: UUID): Promise<Claim[]> {
    const result = await this.claimRepository.findByUserId(appUserId);
    return Array.isArray(result) ? result : result.items;
  }
}
