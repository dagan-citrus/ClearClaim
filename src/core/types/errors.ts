/**
 * Custom error types for domain-specific error handling
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization-related errors
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 'AUTHZ_ERROR', 403);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Subscription limit errors
 */
export class SubscriptionLimitError extends AppError {
  constructor(
    message: string,
    public limitType: 'PERSON_LIMIT' | 'CLAIM_LIMIT'
  ) {
    super(message, 'SUBSCRIPTION_LIMIT', 403);
    this.name = 'SubscriptionLimitError';
    Object.setPrototypeOf(this, SubscriptionLimitError.prototype);
  }
}

/**
 * Entity not found errors
 */
export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * LLM/AI processing errors
 */
export class LLMProcessingError extends AppError {
  constructor(message: string = 'Failed to process with LLM') {
    super(message, 'LLM_ERROR', 500);
    this.name = 'LLMProcessingError';
    Object.setPrototypeOf(this, LLMProcessingError.prototype);
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 'DB_ERROR', 500);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Email sending errors
 */
export class EmailSendingError extends AppError {
  constructor(message: string = 'Failed to send email') {
    super(message, 'EMAIL_ERROR', 500);
    this.name = 'EmailSendingError';
    Object.setPrototypeOf(this, EmailSendingError.prototype);
  }
}
