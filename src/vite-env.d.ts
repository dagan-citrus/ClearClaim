/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_OCR_CONFIDENCE_THRESHOLD: string;
  readonly VITE_ONE_CLICK_THRESHOLD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
