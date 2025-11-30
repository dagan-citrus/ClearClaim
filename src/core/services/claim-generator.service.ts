/**
 * Claim email generation service
 */

import {
  UUID,
  ClaimStatus,
  SubmitClaimDTO,
  Claim,
} from '@core/types';
import {
  ClaimRepository,
  InsuredPersonRepository,
  PolicyRepository,
  InsurerRepository,
} from '@core/repositories';
import { GeminiService } from '@infrastructure/llm';
import { now } from '@core/utils';

/**
 * Service for generating and submitting claim emails
 */
export class ClaimGeneratorService {
  constructor(
    private claimRepository: ClaimRepository,
    private insuredPersonRepository: InsuredPersonRepository,
    private policyRepository: PolicyRepository,
    private insurerRepository: InsurerRepository,
    private geminiService: GeminiService
  ) {}

  /**
   * Generate email draft for a claim
   */
  async generateEmailDraft(claimId: UUID): Promise<string> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (!claim.personId || !claim.policyId) {
      throw new Error('Claim must have person and policy assigned');
    }

    // Get related entities
    const [person, policy] = await Promise.all([
      this.insuredPersonRepository.findByIdOrThrow(claim.personId),
      this.policyRepository.findByIdOrThrow(claim.policyId),
    ]);

    const insurer = await this.insurerRepository.findByIdOrThrow(policy.insurerId);

    // Generate email using Gemini
    const emailDraft = await this.geminiService.generateClaimEmail(
      claim.extractedData,
      person.fullName,
      policy.policyNumber,
      insurer.insurerName
    );

    // Save draft to claim
    await this.claimRepository.update(claimId, {
      emailDraft,
      status: ClaimStatus.READY_FOR_REVIEW,
    } as Partial<Claim>);

    return emailDraft;
  }

  /**
   * Get email subject line for a claim
   */
  async getEmailSubject(claimId: UUID): Promise<string> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (!claim.policyId) {
      throw new Error('Claim must have policy assigned');
    }

    const policy = await this.policyRepository.findByIdOrThrow(claim.policyId);
    const { receiptDate, serviceDescription } = claim.extractedData;

    return `Insurance Claim Submission - Policy ${policy.policyNumber} - ${serviceDescription} (${receiptDate})`;
  }

  /**
   * Get recipient email address for a claim
   */
  async getRecipientEmail(claimId: UUID): Promise<string> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (!claim.policyId) {
      throw new Error('Claim must have policy assigned');
    }

    const policy = await this.policyRepository.findByIdOrThrow(claim.policyId);
    const insurer = await this.insurerRepository.findByIdOrThrow(policy.insurerId);

    return insurer.claimsEmailTemplate;
  }

  /**
   * Submit claim (mark as submitted)
   */
  async submitClaim(dto: SubmitClaimDTO, appUserId: UUID): Promise<Claim> {
    const claim = await this.claimRepository.findByIdOrThrow(dto.claimId);

    // Verify ownership
    if (claim.appUserId !== appUserId) {
      throw new Error('Unauthorized to submit this claim');
    }

    // Verify claim is approved or ready for review
    if (
      claim.status !== ClaimStatus.APPROVED &&
      claim.status !== ClaimStatus.READY_FOR_REVIEW
    ) {
      throw new Error('Claim must be approved before submission');
    }

    // If user provided final edits, update email draft
    if (dto.finalEmailDraft) {
      await this.claimRepository.update(dto.claimId, {
        emailDraft: dto.finalEmailDraft,
      } as Partial<Claim>);
    }

    // Mark as submitted
    await this.claimRepository.update(dto.claimId, {
      status: ClaimStatus.SUBMITTED,
      submittedAt: now(),
    } as Partial<Claim>);

    return this.claimRepository.findByIdOrThrow(dto.claimId);
  }

  /**
   * Get full claim submission package (email subject, body, recipient)
   */
  async getClaimSubmissionPackage(claimId: UUID): Promise<{
    subject: string;
    body: string;
    recipient: string;
  }> {
    const claim = await this.claimRepository.findByIdOrThrow(claimId);

    if (!claim.emailDraft) {
      throw new Error('Email draft not generated yet');
    }

    const [subject, recipient] = await Promise.all([
      this.getEmailSubject(claimId),
      this.getRecipientEmail(claimId),
    ]);

    return {
      subject,
      body: claim.emailDraft,
      recipient,
    };
  }
}
