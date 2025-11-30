/**
 * Common type definitions used across the application
 */

/**
 * Unique identifier type for all entities
 */
export type UUID = string;

/**
 * ISO 8601 date string (YYYY-MM-DD)
 */
export type ISODateString = string;

/**
 * Timestamp in milliseconds since Unix epoch
 */
export type Timestamp = number;

/**
 * Subscription tier enumeration
 */
export enum SubscriptionTier {
  FREE = 'FREE',
  PAID = 'PAID',
}

/**
 * Policy type enumeration
 */
export enum PolicyType {
  HEALTH = 'HEALTH',
  DENTAL = 'DENTAL',
  VISION = 'VISION',
  OTHER = 'OTHER',
}

/**
 * Claim status enumeration
 */
export enum ClaimStatus {
  DRAFT = 'DRAFT',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  APPROVED = 'APPROVED',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
}

/**
 * Payment method enumeration
 */
export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  CHECK = 'CHECK',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OTHER = 'OTHER',
}

/**
 * Base result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
