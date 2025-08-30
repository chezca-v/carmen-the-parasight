// TypeScript declarations for firestoredb.js

export interface PatientData {
  uid: string;
  email: string;
  role: string;
  uniquePatientId?: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth: string;
    age: number | null;
    gender: string;
    phone: string;
    address: string;
    bio: string;
  };
  medicalInfo?: {
    conditions?: {
      [category: string]: string[];
    };
  };
  settings?: {
    notificationsEnabled?: boolean;
  };
  profileComplete: boolean;
  createdAt: any;
  lastLoginAt: any;
  updatedAt: any;
  isActive: boolean;
  emailVerified: boolean;
  authProvider: string;
  activity?: {
    appointments?: AppointmentData[];
    documents?: PatientDocument[];
  };
}

export interface FacilityData {
  uid: string;
  email: string;
  role: string;
  uniqueFacilityId: string;
  facilityInfo: {
    name: string;
    type: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    website: string;
    description: string;
  };
  operatingHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  specialties: string[];
  services: string[];
  staff: {
    totalStaff: number;
    doctors: number;
    nurses: number;
    supportStaff: number;
  };
  capacity: {
    bedCapacity: number;
    consultationRooms: number;
  };
  licenseNumber: string;
  accreditation: string[];
  insuranceAccepted: string[];
  languages: string[];
  isActive: boolean;
  isVerified: boolean;
  profileComplete: boolean;
  createdAt: any;
  lastLoginAt: any;
  updatedAt: any;
  emailVerified: boolean;
  authProvider: string;
}

export interface AppointmentData {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
  doctor: string;
  type: string;
  status: string;
  notes: string;
  facilityId: string;
  facilityName: string;
  createdAt: string;
}

export interface PersonalInfo {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  phone?: string;
  address?: string;
  bio?: string;
}

export interface MedicalInfo {
  conditions?: {
    [category: string]: string[];
  };
}

export interface PatientSettings {
  notificationsEnabled?: boolean;
}

export interface ConsultationData {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: 'virtual' | 'in-person';
  status: 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  facilityId?: string;
  facilityName?: string;
}

export interface PatientDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  originalName: string;
  uploadDate: string;
  createdAt: any;
}

export interface PatientStats {
  totalAppointments: number;
  completedAppointments: number;
  upcomingAppointments: number;
  totalDocuments: number;
  lastAppointment?: string;
}

// Function declarations
export function getCurrentUser(): any;
export function isAuthenticated(): boolean;
export function onAuthStateChange(callback: (user: any) => void): () => void;

export function getPatientData(userId: string): Promise<PatientData | null>;
export function getCurrentPatientData(): Promise<PatientData | null>;
export function createPatientDocument(user: any, additionalData?: any): Promise<PatientData>;
export function createFacilityDocument(user: any, additionalData?: any): Promise<FacilityData>;

export function generateUniquePatientId(): Promise<string>;
export function generateUniqueFacilityId(): Promise<string>;

export function updatePatientPersonalInfo(userId: string, personalInfo: PersonalInfo): Promise<boolean>;
export function updatePatientMedicalInfo(userId: string, medicalInfo: MedicalInfo): Promise<boolean>;
export function updatePatientSettings(userId: string, settings: PatientSettings): Promise<boolean>;

export function addMedicalCondition(userId: string, category: string, condition: string): Promise<boolean>;
export function removeMedicalCondition(userId: string, category: string, condition: string): Promise<boolean>;

export function addConsultationHistory(userId: string, consultation: ConsultationData): Promise<boolean>;
export function getConsultationHistory(userId: string): Promise<ConsultationData[]>;

export function addPatientDocument(userId: string, file: File, documentName?: string): Promise<PatientDocument>;
export function removePatientDocument(userId: string, documentId: string): Promise<boolean>;
export function getPatientDocuments(userId: string): Promise<PatientDocument[]>;

export function addAppointment(userId: string, appointment: any): Promise<any>;
export function updateAppointment(userId: string, appointmentId: string, updatedAppointmentData: any): Promise<boolean>;
export function updateAppointmentByFacility(appointmentId: string, patientId: string, updatedAppointmentData: any, facilityId: string): Promise<boolean>;
export function getPatientAppointments(userId: string): Promise<AppointmentData[]>;
export function getFacilityAppointments(facilityId: string): Promise<AppointmentData[]>;
export function updateAppointmentStatus(appointmentId: string, status: string, patientId: string, facilityId: string): Promise<boolean>;

export function listenToPatientData(userId: string, callback: (data: PatientData | null) => void): () => void;
export function listenToFacilityAppointments(facilityId: string, callback: (appointments: AppointmentData[]) => void): () => void;

export function updateLastLogin(userId: string): Promise<boolean>;
export function checkProfileComplete(userId: string): Promise<boolean>;
export function getPatientStats(userId: string): Promise<PatientStats>;

export function getAllFacilities(): Promise<FacilityData[]>;

// Quota management functions
export function isQuotaExceeded(): boolean;
export function setQuotaExceeded(status: boolean): void;
export function shouldCheckQuota(): boolean;
export function updateQuotaCheckTime(): void; 