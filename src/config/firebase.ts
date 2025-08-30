// Firebase configuration for Carmen Para Sight
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyADZIfbk0DqSxWwhNbFtU8bf-pX6qdVM6s",
  authDomain: "carmen-para-sight-v2.firebaseapp.com",
  projectId: "carmen-para-sight-v2",
  storageBucket: "carmen-para-sight-v2.firebasestorage.app",
  messagingSenderId: "99887505888",
  appId: "1:99887505888:web:99bbf44ebf52d8edfccb85",
  measurementId: "G-GSV3W1CH0V"
};

console.log(`✅ Firebase configuration loaded for carmen-para-sight-v2`);
console.log(`📁 Project: ${firebaseConfig.projectId}`);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export the app instance
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