/**
 * One-Click Claim workflow service
 */

import {
  UUID,
  CreateClaimDTO,
  Claim,
} from '@core/types';
import { ClaimProcessorService } from './claim-processor.service';
import { ClaimGeneratorService } from './claim-generator.service';

/**
 * Service for handling One-Click claim submissions
 */
export class OneClickClaimService {
  constructor(
    private claimProcessor: ClaimProcessorService,
    private claimGenerator: ClaimGeneratorService
  ) {}

  /**
   * Process and submit a claim via One-Click workflow
   */
  async processOneClickClaim(
    appUserId: UUID,
    dto: CreateClaimDTO
  ): Promise<{
    claimId: UUID;
    isEligible: boolean;
    reason?: string;
    claim?: Claim;
  }> {
    // Step 1: Process receipt and extract data
    const { claimId, extractedData } = await this.claimProcessor.processReceipt(
      appUserId,
      dto
    );

    // Step 2: Check One-Click eligibility
    const eligibility = await this.claimProcessor.checkOneClickEligibility(
      appUserId,
      extractedData
    );

    if (!eligibility.isEligible) {
      return {
        claimId,
        isEligible: false,
        reason: eligibility.reason,
      };
    }

    // Step 3: Auto-assign person and policy
    await this.claimProcessor.updateClaim(claimId, appUserId, {
      personId: eligibility.suggestedPersonId!,
      policyId: eligibility.suggestedPolicyId!,
    });

    // Step 4: Generate email draft
    await this.claimGenerator.generateEmailDraft(claimId);

    // Step 5: Auto-approve the claim
    const approvedClaim = await this.claimProcessor.approveClaim(claimId, appUserId);

    return {
      claimId,
      isEligible: true,
      claim: approvedClaim,
    };
  }

  /**
   * Complete One-Click submission (after user confirms)
   */
  async completeOneClickSubmission(
    claimId: UUID,
    appUserId: UUID
  ): Promise<Claim> {
    // Submit the claim
    const submittedClaim = await this.claimGenerator.submitClaim(
      { claimId },
      appUserId
    );

    return submittedClaim;
  }

  /**
   * Get One-Click claim preview (for user confirmation)
   */
  async getOneClickPreview(claimId: UUID): Promise<{
    subject: string;
    body: string;
    recipient: string;
    amount: number;
    date: string;
  }> {
    const submissionPackage = await this.claimGenerator.getClaimSubmissionPackage(
      claimId
    );

    const claim = await this.claimProcessor['claimRepository'].findByIdOrThrow(
      claimId
    );

    return {
      ...submissionPackage,
      amount: claim.extractedData.totalAmount,
      date: claim.extractedData.receiptDate,
    };
  }
}
