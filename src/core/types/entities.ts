/**
 * Core entity type definitions as per PRD Section 2
 */

import {
  UUID,
  ISODateString,
  Timestamp,
  SubscriptionTier,
  PolicyType,
  ClaimStatus,
  PaymentMethod,
} from './common';

/**
 * Registered application user with authentication details
 */
export interface AppUser {
  appUserId: UUID;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  subscriptionTier: SubscriptionTier;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Subscription limits and usage tracking
 */
export interface SubscriptionUsage {
  appUserId: UUID;
  tier: SubscriptionTier;
  insuredPersonCount: number;
  claimsThisMonth: number;
  periodStart: Timestamp;
  periodEnd: Timestamp;
}

/**
 * Insured Person Profile (PRD Section 2.1)
 * Stores core PII, linked to a single registered app user
 */
export interface InsuredPerson {
  personId: UUID;
  appUserId: UUID;
  fullName: string;
  dateOfBirth: ISODateString;
  primaryId: string; // National ID or Passport Number
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Insurer Master Table (PRD Section 2.2)
 * Stores static, shared details about the insurance company
 */
export interface Insurer {
  insurerId: UUID;
  insurerName: string;
  claimsEmailTemplate: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * User Policy Link (PRD Section 2.3)
 * Links an Insured Person to a specific Insurer with policy details
 */
export interface UserPolicy {
  policyId: UUID;
  personId: UUID;
  insurerId: UUID;
  policyType: PolicyType;
  policyNumber: string;
  isDefault: boolean; // For One-Click claim workflow
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Line item on a receipt/invoice
 */
export interface ReceiptLineItem {
  description: string;
  amount: number;
  quantity?: number;
  personId?: UUID; // Allocated to specific insured person
}

/**
 * Extracted receipt data from OCR
 */
export interface ExtractedReceiptData {
  retailerName: string;
  serviceDescription: string;
  receiptDate: ISODateString;
  totalAmount: number;
  currency: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  paymentMethod: PaymentMethod;
  lineItems: ReceiptLineItem[];
  extractionConfidence: number; // 0-100 percentage
  rawText?: string;
}

/**
 * Claim record
 */
export interface Claim {
  claimId: UUID;
  appUserId: UUID;
  personId: UUID;
  policyId: UUID;
  extractedData: ExtractedReceiptData;
  emailDraft: string | null;
  status: ClaimStatus;
  isOneClickEligible: boolean;
  submittedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Full claim details with related entities
 */
export interface ClaimWithDetails extends Claim {
  person: InsuredPerson;
  policy: UserPolicy;
  insurer: Insurer;
}
