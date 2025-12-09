/**
 * Data Transfer Objects for API communication and service layer
 */

import {
  UUID,
  ISODateString,
  PolicyType,
  SubscriptionTier,
} from './common';

/**
 * DTO for creating a new insured person
 */
export interface CreateInsuredPersonDTO {
  fullName: string;
  dateOfBirth: ISODateString;
  primaryId: string;
}

/**
 * DTO for updating an insured person
 */
export interface UpdateInsuredPersonDTO {
  fullName?: string;
  dateOfBirth?: ISODateString;
  primaryId?: string;
}

/**
 * DTO for creating a new insurer
 */
export interface CreateInsurerDTO {
  insurerName: string;
  claimsEmail: string;
  claimsEmailTemplate: string;
  templatePrompt?: string; // Optional custom AI instructions (uses default if not provided)
}

/**
 * DTO for updating an insurer
 */
export interface UpdateInsurerDTO {
  insurerName?: string;
  claimsEmail?: string;
  claimsEmailTemplate?: string;
  templatePrompt?: string;
}

/**
 * DTO for creating a new user policy
 */
export interface CreateUserPolicyDTO {
  personId: UUID;
  insurerId: UUID;
  policyType: PolicyType;
  policyNumber: string;
  isDefault?: boolean;
}

/**
 * DTO for updating a user policy
 */
export interface UpdateUserPolicyDTO {
  policyType?: PolicyType;
  policyNumber?: string;
  isDefault?: boolean;
}

/**
 * DTO for receipt line item allocation
 */
export interface AllocateLineItemDTO {
  lineItemIndex: number;
  personId: UUID;
  amount?: number; // Optional for splitting amounts
}

/**
 * Image data for claim processing
 */
export interface ClaimImageData {
  data: string; // Base64 encoded image
  type: string; // MIME type
  description?: string; // Optional description (e.g., "Invoice", "Doctor's Summary")
}

/**
 * DTO for creating a new claim
 */
export interface CreateClaimDTO {
  images: ClaimImageData[]; // Array of images (invoice, doctor's summary, medicine list, etc.)
}

/**
 * DTO for updating claim after user review
 */
export interface UpdateClaimDTO {
  personId?: UUID;
  policyId?: UUID;
  emailDraft?: string;
  lineItemAllocations?: AllocateLineItemDTO[];
}

/**
 * DTO for claim submission
 */
export interface SubmitClaimDTO {
  claimId: UUID;
  finalEmailDraft?: string; // Optional user edits
}

/**
 * DTO for subscription check response
 */
export interface SubscriptionCheckDTO {
  canAddPerson: boolean;
  canSubmitClaim: boolean;
  currentTier: SubscriptionTier;
  insuredPersonCount: number;
  insuredPersonLimit: number | null;
  claimsThisMonth: number;
  claimsMonthlyLimit: number | null;
  requiresUpgrade: boolean;
}

/**
 * DTO for One-Click eligibility check
 */
export interface OneClickEligibilityDTO {
  isEligible: boolean;
  reason?: string;
  confidence?: number;
  suggestedPersonId?: UUID;
  suggestedPolicyId?: UUID;
  estimatedAmount?: number;
}

/**
 * DTO for refining email draft with natural language
 */
export interface RefineDraftDTO {
  claimId: UUID;
  refinementPrompt: string; // Natural language instruction (e.g., "make it more urgent")
}

/**
 * DTO for generating email with custom template
 */
export interface GenerateEmailDTO {
  claimId: UUID;
  templatePrompt?: string; // Optional override for insurer template
}
