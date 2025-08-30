// Firebase configuration for LingapLink Healthcare Platform
// ⚠️ SECURITY: All sensitive configuration is loaded from environment variables
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Vite environment variable types
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Environment variable validation
const validateEnvironmentVariables = (): FirebaseConfig => {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Firebase environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all Firebase configuration is set.'
    );
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    appId: import.meta.env.VITE_FIREBASE_APP_ID!,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };
};

// Get Firebase configuration from environment variables
const getFirebaseConfig = (): FirebaseConfig => {
  try {
    const config = validateEnvironmentVariables();
    
    // Log configuration details (without sensitive data)
    console.log(`✅ Firebase configuration loaded for ${config.projectId}`);
    console.log(`📁 Project: ${config.projectId}`);
    console.log(`🌐 Auth Domain: ${config.authDomain}`);
    console.log(`📦 Storage: ${config.storageBucket}`);
    
    return config;
  } catch (error) {
    console.error('❌ Firebase configuration error:', error);
    throw error;
  }
};

// Initialize Firebase with secure configuration
let app: any;
let auth: any;
let db: any;
let storage: any;

try {
  const firebaseConfig = getFirebaseConfig();
  app = initializeApp(firebaseConfig);
  
  // Initialize Firebase services
  auth = getAuth(app);
  
  // Initialize Firestore with additional settings for better compatibility
  db = getFirestore(app);
  
  // Initialize Storage
  storage = getStorage(app);
  
  // Enable Firestore offline persistence and network retry
  enableNetwork(db);
  
  console.log('🌐 Firestore network enabled');
  
  console.log('🚀 Firebase services initialized successfully');
} catch (error) {
  console.error('💥 Failed to initialize Firebase:', error);
  
  // In development, provide helpful error message
  if (import.meta.env.DEV) {
    console.error(`
🔧 DEVELOPMENT SETUP REQUIRED:
1. Copy env.template to .env
2. Fill in your Firebase configuration values
3. Restart your development server
4. Ensure all VITE_FIREBASE_* variables are set
    `);
  }
  
  throw error;
}

// Export Firebase services
export { auth, db, storage, app };

// Export the app instance as default
export default app;

// Types for TypeScript
export interface ClinicProfile {
  id: string;
  email: string;
  clinicName: string;
  licenseNumber: string;
  facilityType: 'hospital' | 'clinic' | 'health_center';
  createdAt: any;
  updatedAt?: any;
}

export interface PatientAssessment {
  id?: string;
  patientName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  vitalSigns: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
  };
  painLevel: number;
  consciousnessLevel?: string;
  mobility?: string;
  symptoms: string[];
  conditions: string[];
  urgencyLevel: {
    level: number;
    name: string;
    color: string;
    maxWait: number;
  };
  urgencyScore: number;
  clinicId: string;
  timestamp: any;
  status: 'waiting' | 'in_progress' | 'completed';
}

export interface AppointmentRequest {
  id?: string;
  patientName: string;
  patientEmail?: string;
  patientPhone: string;
  requestedDate: string;
  requestedTime: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  clinicId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt?: any;
} 