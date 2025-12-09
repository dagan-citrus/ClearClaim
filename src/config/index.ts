/**
 * Application configuration with environment variable validation
 */

import { z } from 'zod';

/**
 * Configuration schema for validation
 */
const configSchema = z.object({
  firebase: z.object({
    apiKey: z.string().min(1, 'Firebase API key is required'),
    authDomain: z.string().min(1, 'Firebase auth domain is required'),
    projectId: z.string().min(1, 'Firebase project ID is required'),
    storageBucket: z.string().min(1, 'Firebase storage bucket is required'),
    messagingSenderId: z.string().min(1, 'Firebase messaging sender ID is required'),
    appId: z.string().min(1, 'Firebase app ID is required'),
  }),
  gemini: z.object({
    apiKey: z.string().min(1, 'Gemini API key is required'),
    model: z.string().default('gemini-2.0-flash-exp'),
  }),
  app: z.object({
    env: z.enum(['development', 'production', 'test']).default('development'),
    oneClickThreshold: z.number().positive().default(500),
    ocrConfidenceThreshold: z.number().min(0).max(100).default(98),
  }),
  subscription: z.object({
    free: z.object({
      maxInsuredPersons: z.number().positive().default(1),
      maxClaimsPerMonth: z.number().nullable().default(null), // null = unlimited (development mode)
    }),
    paid: z.object({
      maxInsuredPersons: z.number().nullable().default(null), // null = unlimited
      maxClaimsPerMonth: z.number().nullable().default(null), // null = unlimited
    }),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): AppConfig {
  const config = {
    firebase: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    },
    gemini: {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
      model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash-exp',
    },
    app: {
      env: import.meta.env.VITE_APP_ENV || 'development',
      oneClickThreshold: Number(import.meta.env.VITE_ONE_CLICK_THRESHOLD) || 500,
      ocrConfidenceThreshold: Number(import.meta.env.VITE_OCR_CONFIDENCE_THRESHOLD) || 98,
    },
    subscription: {
      free: {
        maxInsuredPersons: Number(import.meta.env.VITE_FREE_MAX_PERSONS) || 1,
        maxClaimsPerMonth: import.meta.env.VITE_FREE_MAX_CLAIMS ? Number(import.meta.env.VITE_FREE_MAX_CLAIMS) : null, // null = unlimited (development)
      },
      paid: {
        maxInsuredPersons: null,
        maxClaimsPerMonth: null,
      },
    },
  };

  return configSchema.parse(config);
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();
