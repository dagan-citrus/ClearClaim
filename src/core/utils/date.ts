/**
 * Date utility functions
 */

import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ISODateString, Timestamp } from '@core/types';

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): ISODateString {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Convert ISO date string to Date object
 */
export function fromISODateString(dateString: ISODateString): Date {
  return new Date(dateString);
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): Timestamp {
  return Date.now();
}

/**
 * Get start of current month timestamp
 */
export function getMonthStart(date: Date = new Date()): Timestamp {
  return startOfMonth(date).getTime();
}

/**
 * Get end of current month timestamp
 */
export function getMonthEnd(date: Date = new Date()): Timestamp {
  return endOfMonth(date).getTime();
}

/**
 * Get billing period (current month)
 */
export function getCurrentBillingPeriod(): {
  periodStart: Timestamp;
  periodEnd: Timestamp;
} {
  const now = new Date();
  return {
    periodStart: getMonthStart(now),
    periodEnd: getMonthEnd(now),
  };
}

/**
 * Get next billing period
 */
export function getNextBillingPeriod(): {
  periodStart: Timestamp;
  periodEnd: Timestamp;
} {
  const nextMonth = addMonths(new Date(), 1);
  return {
    periodStart: getMonthStart(nextMonth),
    periodEnd: getMonthEnd(nextMonth),
  };
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(
  timestamp: Timestamp,
  formatString: string = 'MMM dd, yyyy'
): string {
  return format(new Date(timestamp), formatString);
}

/**
 * Check if a date is in the past
 */
export function isInPast(date: Date | ISODateString): boolean {
  const dateObj = typeof date === 'string' ? fromISODateString(date) : date;
  return dateObj < new Date();
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: ISODateString): number {
  const dob = fromISODateString(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}
