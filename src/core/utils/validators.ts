/**
 * Validation utilities for business logic
 */

import { z } from 'zod';
import { ValidationError } from '@core/types';

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Date of birth validation (must be in the past)
 */
export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((date) => {
    const dob = new Date(date);
    return dob < new Date();
  }, 'Date of birth must be in the past');

/**
 * Policy number validation (alphanumeric, dashes, and underscores allowed)
 */
export const policyNumberSchema = z
  .string()
  .min(1, 'Policy number is required')
  .regex(/^[A-Za-z0-9\-_]+$/, 'Policy number must be alphanumeric');

/**
 * Full name validation
 */
export const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters');

/**
 * Primary ID validation (national ID or passport)
 */
export const primaryIdSchema = z
  .string()
  .min(5, 'ID must be at least 5 characters')
  .max(20, 'ID must not exceed 20 characters');

/**
 * Amount validation (positive number with up to 2 decimal places)
 */
export const amountSchema = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

/**
 * UUID validation
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .or(z.string().min(1, 'ID is required'));

/**
 * Base64 image data validation
 */
export const base64ImageSchema = z
  .string()
  .min(100, 'Image data is too short')
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Invalid image format');

/**
 * MIME type validation for images
 */
export const imageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Helper function to validate data with a Zod schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        fields[path] = err.message;
      });
      throw new ValidationError(
        errorMessage || 'Validation failed',
        fields
      );
    }
    throw error;
  }
}

/**
 * Helper function to safely validate data (returns Result type)
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  try {
    const validData = validate(schema, data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new ValidationError('Unexpected validation error'),
    };
  }
}
