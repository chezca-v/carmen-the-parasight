/**
 * Firebase Configuration Service
 * Centralized configuration management with TypeScript support
 * 🔒 SECURITY: Uses environment variables only - no hardcoded credentials
 */

// Environment variable types
interface EnvironmentVariables {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
}

// Firebase configuration interface
export interface FirebaseConfig {
  apiKey: string | null;
  authDomain: string | null;
  projectId: string | null;
  storageBucket: string | null;
  messagingSenderId: string | null;
  appId: string | null;
  measurementId: string | null;
}

// Environment variable getter with type safety
const getEnvVar = (key: keyof EnvironmentVariables, fallback: string | null): string | null => {
  // Check for Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as EnvironmentVariables)[key] || fallback;
  }
  
  // Check for process.env (Node.js)
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as EnvironmentVariables)[key] || fallback;
  }
  
  // Check for window environment (browser)
  if (typeof window !== 'undefined' && (window as any).env) {
    return ((window as any).env as EnvironmentVariables)[key] || fallback;
  }
  
  return fallback;
};

// 🔒 SECURE: Firebase configuration using environment variables only
export const firebaseConfig: FirebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', null),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', null),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', null),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', null),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', null),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', null),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', null)
};

// Configuration validation
export interface ConfigValidationResult {
  isValid: boolean;
  missingFields: string[];
  errors: string[];
  warnings: string[];
}

export const validateFirebaseConfig = (): ConfigValidationResult => {
  const requiredFields: (keyof FirebaseConfig)[] = ['apiKey', 'authDomain', 'projectId'];
  const missingFields: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const field of requiredFields) {
    if (!firebaseConfig[field]) {
      missingFields.push(field);
      errors.push(`Missing required Firebase configuration field: ${field}`);
    }
  }

  // Check optional fields and provide warnings
  const optionalFields: (keyof FirebaseConfig)[] = ['storageBucket', 'messagingSenderId', 'appId'];
  for (const field of optionalFields) {
    if (!firebaseConfig[field]) {
      warnings.push(`Optional Firebase configuration field missing: ${field}`);
    }
  }

  // Validate field formats
  if (firebaseConfig.authDomain && !firebaseConfig.authDomain.endsWith('.firebaseapp.com')) {
    warnings.push('Firebase auth domain should end with .firebaseapp.com');
  }

  if (firebaseConfig.storageBucket && !firebaseConfig.storageBucket.endsWith('.appspot.com')) {
    warnings.push('Firebase storage bucket should end with .appspot.com');
  }

  const isValid = missingFields.length === 0;

  return {
    isValid,
    missingFields,
    errors,
    warnings
  };
};

// Validate configuration on import
const validation = validateFirebaseConfig();

if (!validation.isValid) {
  console.error('🚨 CRITICAL: Missing Firebase environment variables!');
  console.error('Missing required Firebase configuration fields:', validation.missingFields);
  console.error('');
  console.error('🔒 SECURITY: Firebase credentials must be provided via environment variables');
  console.error('');
  console.error('🔧 Setup Instructions:');
  console.error('1. Create a .env file in your project root');
  console.error('2. Add the following environment variables:');
  console.error('   VITE_FIREBASE_API_KEY=your-api-key');
  console.error('   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com');
  console.error('   VITE_FIREBASE_PROJECT_ID=your-project-id');
  console.error('   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com');
  console.error('   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id');
  console.error('   VITE_FIREBASE_APP_ID=your-app-id');
  console.error('   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id');
  console.error('3. Restart your development server');
  console.error('');
  console.error('⚠️  SECURITY: Never hardcode Firebase credentials in source code!');
  
  throw new Error(`🚨 Firebase configuration incomplete. Missing: ${validation.missingFields.join(', ')}`);
}

// Log configuration status
if (validation.warnings.length > 0) {
  console.warn('⚠️  Firebase configuration warnings:', validation.warnings);
}

console.log('✅ Firebase configuration loaded successfully');

// Configuration utilities
export const getConfigValue = <K extends keyof FirebaseConfig>(key: K): FirebaseConfig[K] => {
  return firebaseConfig[key];
};

export const isConfigComplete = (): boolean => {
  return validation.isValid;
};

export const getMissingFields = (): string[] => {
  return validation.missingFields;
};

export const getConfigurationSummary = (): {
  projectId: string | null;
  authDomain: string | null;
  usingEnvVars: boolean;
  environment: 'vite' | 'browser' | 'node';
  securityStatus: string;
  isValid: boolean;
} => {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    usingEnvVars: Boolean(getEnvVar('VITE_FIREBASE_API_KEY', null)),
    environment: typeof import.meta !== 'undefined' ? 'vite' : typeof window !== 'undefined' ? 'browser' : 'node',
    securityStatus: 'SECURE - Environment variables only',
    isValid: validation.isValid
  };
};

// Default export for backward compatibility
export default firebaseConfig;

