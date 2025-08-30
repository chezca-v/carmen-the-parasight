/**
 * Firestore Database Service - Secure Patient Data Management
 * Provides secure and validated patient data operations with Firestore
 */

// Import logger for production-safe logging
import('../utils/logger.js').then(({ default: logger }) => {
    window.firestoreLogger = logger;
}).catch(() => {
    // Fallback if logger not available
    window.firestoreLogger = {
        info: (...args) => console.log(...args),
        error: (...args) => console.error(...args),
        warn: (...args) => console.warn(...args),
        debug: (...args) => console.log(...args)
    };
});

// Import Firebase modules
let db = null;
let auth = null;
// Storage variable removed - using local storage instead

// Firestore Database Service
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    onSnapshot,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';
// Firebase Storage imports removed - using local storage instead

// Import Firebase configuration from config.js
import { firebaseConfig } from './config.js';

// Import USER_ROLES constant
const USER_ROLES = {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    PATIENT: 'patient',
    ORGANIZATION_ADMIN: 'organization_admin',
    ORGANIZATION_MEMBER: 'organization_member'
};

// Import validation utilities
import { 
    validateProfileUpdateData, 
    validateMedicalCondition, 
    validateCategory, 
    validateDocumentName,
    sanitizeInput,
    escapeHtml,
    rateLimiter
} from '../utils/validation.js';

// Initialize Firebase (avoid duplicate initialization)
let app;

try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        // Firebase initialized by Firestore service
    } else {
        app = getApp();
        // Using existing Firebase instance
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    // Storage initialization removed - using local storage instead
    
} catch (error) {
    const logger = window.firestoreLogger || console;
    logger.error('Firebase initialization error:', error);
    throw error;
}

// Log Firebase initialization
// Firestore DB Service initialized

// Export Firebase instances for global access (if needed)
window.firebaseApp = app;
window.auth = auth;
window.db = db;

// Firebase quota status tracking
let quotaExceeded = false;
let lastQuotaCheck = 0;
const QUOTA_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function isQuotaExceeded() {
    return quotaExceeded;
}

export function setQuotaExceeded(status) {
    quotaExceeded = status;
    if (status) {
        console.warn('🔥 Firebase quota exceeded - switching to local-only mode');
    } else {
        console.log('✅ Firebase quota status reset - operations can proceed');
    }
}

export function shouldCheckQuota() {
    return Date.now() - lastQuotaCheck > QUOTA_CHECK_INTERVAL;
}

export function updateQuotaCheckTime() {
    lastQuotaCheck = Date.now();
}

// ============= USER MANAGEMENT =============

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return auth.currentUser !== null;
}

/**
 * Listen to authentication state changes
 */
export function onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ============= PATIENT DATA OPERATIONS =============

/**
 * Get patient data by user ID
 */
export async function getPatientData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'patients', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            // No patient data found for user
            return null;
        }
    } catch (error) {
        const logger = window.firestoreLogger || console;
        logger.error('Error fetching patient data:', error);
        throw error;
    }
}

/**
 * Get current user's patient data
 */
export async function getCurrentPatientData() {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('No authenticated user');
    }
    return await getPatientData(user.uid);
}

/**
 * Generate unique patient ID
 */
export async function generateUniquePatientId() {
    try {
        // Get the current counter from Firestore
        const counterDoc = await getDoc(doc(db, 'counters', 'patientIds'));
        
        let nextId = 10000; // Start with LL-10000
        
        if (counterDoc.exists()) {
            nextId = counterDoc.data().currentId + 1;
        }
        
        // Update the counter
        await setDoc(doc(db, 'counters', 'patientIds'), {
            currentId: nextId,
            updatedAt: serverTimestamp()
        });
        
        // Return the formatted ID
        return `LL-${nextId}`;
    } catch (error) {
        console.error('Error generating unique patient ID:', error);
        
        // Fallback: Generate ID based on timestamp and random number
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const fallbackId = `LL-${timestamp}-${randomNum}`;
        
        console.warn('Using fallback patient ID generation:', fallbackId);
        return fallbackId;
    }
}

export async function createPatientDocument(user, additionalData = {}) {
    console.log('🔍 createPatientDocument called with:', { user: user?.uid, email: user?.email, additionalData })
    try {
        if (!user) {
            throw new Error('User is required');
        }

        const emailUsername = user.email.split('@')[0];
        
        // Detect auth provider from user object
        let authProvider = 'email'; // default
        if (user.providerData && user.providerData.length > 0) {
            const providers = user.providerData.map(p => p.providerId);
            if (providers.includes('google.com')) {
                authProvider = 'google';
            } else if (providers.includes('facebook.com')) {
                authProvider = 'facebook';
            } else if (providers.includes('apple.com')) {
                authProvider = 'apple';
            }
        }

        // Use Firebase UID as the unique patient ID
        const uniquePatientId = user.uid;
        
        const patientData = {
            uid: user.uid,
            email: user.email,
            role: USER_ROLES.PATIENT, // Always assign 'patient' role on creation
            uniquePatientId: uniquePatientId, // Use Firebase UID as patient ID
            
            // Personal Information (mostly empty, to be filled out in the portal)
            personalInfo: {
                firstName: additionalData.firstName || '',
                lastName: additionalData.lastName || '',
                fullName: user.displayName || emailUsername,
                dateOfBirth: '',
                age: null,
                gender: '',
                phone: '',
                address: '',
                bio: 'Welcome to LingapLink!',
            },

            // Set profile as incomplete
            profileComplete: false,
            
            // Timestamps and status
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isActive: true,
            emailVerified: user.emailVerified || false,
            authProvider: additionalData.authProvider || authProvider,
        };

        console.log('📦 About to create document in Firestore:', { collection: 'patients', docId: user.uid })
        await setDoc(doc(db, 'patients', user.uid), patientData);
        console.log('✅ Document created successfully in Firestore')
        const logger = window.firestoreLogger || console;
        logger.info('Minimal patient document created successfully for:', user.email, 'with provider:', authProvider);
        return patientData;

    } catch (error) {
        console.error('❌ Error in createPatientDocument:', error)
        console.error('❌ Error code:', error.code)
        console.error('❌ Error message:', error.message)
        let errorMessage = 'Failed to create patient document';
        
        // Handle specific Firestore errors
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. This is likely due to Firestore rules. Please check FIRESTORE_RULES_FIX.md for instructions.';
            // Log helpful information for debugging
            console.error('🔒 Firestore Permission Denied Error:');
            console.error('- Check if user is authenticated:', user ? '✅ Yes' : '❌ No');
            console.error('- User UID:', user?.uid);
            console.error('- User email verified:', user?.emailVerified ? '✅ Yes' : '❌ No');
            console.error('- User providers:', user?.providerData?.map(p => p.providerId));
            console.error('- Check Firestore rules for Google sign-in compatibility');
            console.error('- See FIRESTORE_RULES_FIX.md for detailed instructions');
        } else if (error.code === 'unauthenticated') {
            errorMessage = 'Authentication required to create patient document.';
        } else if (error.message) {
            errorMessage = `Error creating patient document: ${error.message}`;
        }
        
        console.error('Error creating patient document:', errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Update patient personal information
 */
export async function updatePatientPersonalInfo(userId, personalInfo) {
    try {
        console.log('🔍 updatePatientPersonalInfo called for user:', userId);
        console.log('📋 Personal info to update:', personalInfo);
        
        // Check rate limiting
        if (!rateLimiter.isAllowed(userId, 5, 60000)) {
            throw new Error('Too many update attempts. Please wait 1 minute before trying again.');
        }

        // Validate and sanitize the personal information
        const validationResult = validateProfileUpdateData(personalInfo);
        if (!validationResult.valid) {
            throw new Error(validationResult.errors[0]);
        }

        const updates = {
            personalInfo: validationResult.sanitizedData,
            updatedAt: serverTimestamp()
        };
        
        console.log('📦 Attempting to update document in Firestore...');
        console.log('Collection: patients');
        console.log('Document ID:', userId);
        console.log('Updates:', updates);
        
        // Use setDoc with merge option to create document if it doesn't exist
        await setDoc(doc(db, 'patients', userId), updates, { merge: true });
        
        console.log('✅ Patient personal info updated successfully in Firestore!');
        setQuotaExceeded(false); // Reset quota status on success
        return true;
    } catch (error) {
        console.error('❌ Error in updatePatientPersonalInfo:', error);
        let errorMessage = 'Failed to update patient personal info';
        
        // Handle specific Firestore errors
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your authentication and Firestore rules.';
        } else if (error.code === 'unauthenticated') {
            errorMessage = 'Authentication required to update patient info.';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'Firebase quota exceeded. Please try again later.';
            setQuotaExceeded(true);
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service temporarily unavailable. Please try again later.';
        } else if (error.code === 'deadline-exceeded') {
            errorMessage = 'Firebase request timeout. Please try again later.';
        } else if (error.message) {
            errorMessage = `Error updating patient info: ${error.message}`;
        }
        
        console.error('Error updating patient personal info:', error);
        throw new Error(errorMessage);
    }
}

/**
 * Update patient medical information
 */
export async function updatePatientMedicalInfo(userId, medicalInfo) {
    try {
        console.log('🔍 updatePatientMedicalInfo called for user:', userId);
        console.log('📋 Medical info to update:', medicalInfo);
        
        const updates = {
            medicalInfo: medicalInfo,
            updatedAt: serverTimestamp()
        };
        
        console.log('📦 Attempting to update medical info in Firestore...');
        console.log('Collection: patients');
        console.log('Document ID:', userId);
        console.log('Updates:', updates);
        
        // Use setDoc with merge option to create document if it doesn't exist
        await setDoc(doc(db, 'patients', userId), updates, { merge: true });
        
        console.log('✅ Patient medical info updated successfully in Firestore!');
        return true;
    } catch (error) {
        console.error('❌ Error in updatePatientMedicalInfo:', error);
        let errorMessage = 'Failed to update patient medical info';
        
        // Handle specific Firestore errors
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your authentication and Firestore rules.';
        } else if (error.code === 'unauthenticated') {
            errorMessage = 'Authentication required to update medical info.';
        } else if (error.message) {
            errorMessage = `Error updating medical info: ${error.message}`;
        }
        
        console.error('Error updating patient medical info:', errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Update patient settings
 */
export async function updatePatientSettings(userId, settings) {
    try {
        console.log('🔍 updatePatientSettings called for user:', userId);
        console.log('📋 Settings to update:', settings);
        
        const updates = {
            settings: settings,
            updatedAt: serverTimestamp()
        };
        
        console.log('📦 Attempting to update settings in Firestore...');
        console.log('Collection: patients');
        console.log('Document ID:', userId);
        console.log('Updates:', updates);
        
        // Use setDoc with merge option to create document if it doesn't exist
        await setDoc(doc(db, 'patients', userId), updates, { merge: true });
        
        console.log('✅ Patient settings updated successfully in Firestore!');
        return true;
    } catch (error) {
        console.error('❌ Error in updatePatientSettings:', error);
        throw error;
    }
}

/**
 * Add medical condition to patient
 */
export async function addMedicalCondition(userId, category, condition) {
    try {
        // Check rate limiting
        if (!rateLimiter.isAllowed(userId, 10, 60000)) {
            throw new Error('Too many condition additions. Please wait 1 minute before trying again.');
        }

        // Validate category
        const categoryResult = validateCategory(category);
        if (!categoryResult.valid) {
            throw new Error(categoryResult.error);
        }

        // Validate condition
        const conditionResult = validateMedicalCondition(condition);
        if (!conditionResult.valid) {
            throw new Error(conditionResult.error);
        }

        // First, get the current patient data to check existing conditions
        const patientDoc = await getDoc(doc(db, 'patients', userId));
        let currentConditions = {};
        
        if (patientDoc.exists()) {
            const patientData = patientDoc.data();
            currentConditions = patientData.medicalInfo?.conditions || {};
        }

        // Check if condition already exists in the category
        const existingConditions = currentConditions[categoryResult.value] || [];
        if (existingConditions.includes(conditionResult.value)) {
            throw new Error('This condition already exists in the selected category');
        }

        // Add the condition to the category array
        const updatedConditions = {
            ...currentConditions,
            [categoryResult.value]: [...existingConditions, conditionResult.value]
        };

        const updates = {
            'medicalInfo.conditions': updatedConditions,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), updates);
        const logger = window.firestoreLogger || console;
        logger.info('Medical condition added successfully');
        return true;
    } catch (error) {
        console.error('Error adding medical condition:', error);
        throw error;
    }
}

/**
 * Remove medical condition from patient
 */
export async function removeMedicalCondition(userId, category, condition) {
    try {
        // First, get the current patient data
        const patientDoc = await getDoc(doc(db, 'patients', userId));
        if (!patientDoc.exists()) {
            throw new Error('Patient document not found');
        }

        const patientData = patientDoc.data();
        const currentConditions = patientData.medicalInfo?.conditions || {};

        // Check if the category exists
        if (!currentConditions[category]) {
            throw new Error('Category not found');
        }

        // Remove the condition from the category array
        const updatedConditionsInCategory = currentConditions[category].filter(c => c !== condition);
        
        const updatedConditions = {
            ...currentConditions,
            [category]: updatedConditionsInCategory
        };

        const updates = {
            'medicalInfo.conditions': updatedConditions,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), updates);
        console.log('Medical condition removed successfully');
        return true;
    } catch (error) {
        console.error('Error removing medical condition:', error);
        throw error;
    }
}

// ============= CONSULTATION HISTORY =============

/**
 * Add consultation to patient history
 */
export async function addConsultationHistory(userId, consultation) {
    try {
        const consultationData = {
            id: `consultation_${Date.now()}`,
            date: consultation.date || new Date().toISOString(),
            doctor: consultation.doctor || '',
            type: consultation.type || '',
            status: consultation.status || 'completed',
            notes: consultation.notes || '',
            createdAt: new Date().toISOString() // Use regular date instead of serverTimestamp for array elements
        };
        
        const updates = {
            'activity.consultationHistory': arrayUnion(consultationData),
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), updates);
        console.log('Consultation history added successfully');
        return true;
    } catch (error) {
        console.error('Error adding consultation history:', error);
        throw error;
    }
}

/**
 * Get patient consultation history
 */
export async function getConsultationHistory(userId) {
    try {
        const patientData = await getPatientData(userId);
        return patientData?.activity?.consultationHistory || [];
    } catch (error) {
        console.error('Error fetching consultation history:', error);
        throw error;
    }
}

// ============= DOCUMENT MANAGEMENT =============

/**
 * Add document to patient records with local file storage
 */
export async function addPatientDocument(userId, file, documentName = null) {
    try {
        console.log('🔍 addPatientDocument called for user:', userId);
        console.log('📁 File to upload:', file);
        
        // Check rate limiting
        if (!rateLimiter.isAllowed(userId, 5, 60000)) {
            throw new Error('Too many document uploads. Please wait 1 minute before trying again.');
        }

        // Validate file
        if (!file) {
            throw new Error('No file provided for upload');
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new Error('File size too large. Maximum size is 10MB.');
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('File type not supported. Please upload JPEG, PNG, GIF, PDF, or text files.');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = documentName || file.name;
        const uniqueId = `doc_${timestamp}`;

        console.log('📦 Converting file to base64 for local storage...');
        console.log('File size:', file.size, 'bytes');
        console.log('File type:', file.type);

        // Convert file to base64 for local storage
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        console.log('✅ File converted to base64 successfully');

        // Validate document name
        const nameResult = validateDocumentName(fileName);
        if (!nameResult.valid) {
            throw new Error(nameResult.error);
        }

        // Create document with base64 data included
        const documentWithData = {
            id: uniqueId,
            name: nameResult.value,
            type: file.type,
            size: file.size,
            originalName: file.name,
            uploadDate: new Date().toISOString(),
            createdAt: new Date().toISOString(), // Use regular date instead of serverTimestamp for array elements
            url: base64Data // Include the base64 data directly
        };

        console.log('📋 Document with data to save:', documentWithData);
        
        // Use a transaction to ensure atomic updates
        const patientDocRef = doc(db, 'patients', userId);
        
        await runTransaction(db, async (transaction) => {
            const patientDoc = await transaction.get(patientDocRef);
            
            if (patientDoc.exists()) {
                const currentData = patientDoc.data();
                const currentDocuments = currentData?.activity?.documents || [];
                
                console.log('📋 Current documents in transaction:', currentDocuments);
                
                // Add new document to the array
                const updatedDocuments = [...currentDocuments, documentWithData];
                
                console.log('📋 Updated documents array in transaction:', updatedDocuments);
                
                // Update the document with the new array
                transaction.update(patientDocRef, {
                    'activity.documents': updatedDocuments,
                    updatedAt: serverTimestamp()
                });
            } else {
                // If patient document doesn't exist, create it with the document
                transaction.set(patientDocRef, {
                    uid: userId,
                    activity: {
                        documents: [documentWithData]
                    },
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        });
        
        console.log('✅ Document added successfully to Firestore using transaction');
        return documentWithData;
    } catch (error) {
        console.error('❌ Error adding document:', error);
        throw error;
    }
}

/**
 * Remove document from patient records (local storage)
 */
export async function removePatientDocument(userId, documentId) {
    try {
        console.log('🔍 removePatientDocument called for user:', userId, 'document:', documentId);
        
        const patientData = await getPatientData(userId);
        const documents = patientData?.activity?.documents || [];
        const documentToRemove = documents.find(doc => doc.id === documentId);
        
        if (!documentToRemove) {
            throw new Error('Document not found');
        }
        
        console.log('📁 Document to remove:', documentToRemove);
        
        // Remove from Firestore array
        const updatedDocuments = documents.filter(doc => doc.id !== documentId);
        const updates = {
            'activity.documents': updatedDocuments,
            updatedAt: serverTimestamp()
        };
        
        console.log('📦 Removing document from Firestore...');
        await setDoc(doc(db, 'patients', userId), updates, { merge: true });
        
        console.log('✅ Document removed successfully from Firestore');
        return true;
    } catch (error) {
        console.error('❌ Error removing document:', error);
        throw error;
    }
}

/**
 * Get patient documents (now includes base64 data directly)
 */
export async function getPatientDocuments(userId) {
    try {
        const patientData = await getPatientData(userId);
        const documents = patientData?.activity?.documents || [];
        
        console.log('📦 Retrieved documents from patient data:', documents);
        return documents;
    } catch (error) {
        console.error('Error fetching patient documents:', error);
        throw error;
    }
}

// ============= APPOINTMENT MANAGEMENT =============

/**
 * Add appointment to patient records and notify facility
 */
export async function addAppointment(userId, appointment) {
    try {
        const appointmentData = {
            id: `appointment_${Date.now()}`,
            patientId: userId,
            patientName: appointment.patientName || '',
            patientEmail: appointment.patientEmail || '',
            date: appointment.date || '',
            time: appointment.time || '',
            doctor: appointment.doctor || '',
            type: appointment.type || '',
            status: appointment.status || 'scheduled',
            notes: appointment.notes || '',
            facilityId: appointment.facilityId || '',
            facilityName: appointment.facilityName || '',
            createdAt: new Date().toISOString()
        };
        
        // Check if patient document exists, create it if it doesn't
        const patientDocRef = doc(db, 'patients', userId);
        const patientDocSnap = await getDoc(patientDocRef);
        
        if (!patientDocSnap.exists()) {
            console.log('Patient document does not exist, creating it...');
            
            // Use Firebase UID as the unique patient ID
            const uniquePatientId = userId;
            
            // Create a basic patient document
            const basicPatientData = {
                uid: userId,
                email: appointment.patientEmail || '',
                role: 'patient',
                uniquePatientId: uniquePatientId, // Use Firebase UID as patient ID
                personalInfo: {
                    fullName: appointment.patientName || 'Patient',
                    firstName: '',
                    lastName: '',
                    dateOfBirth: '',
                    age: null,
                    gender: '',
                    phone: '',
                    address: '',
                    bio: 'Welcome to LingapLink!'
                },
                profileComplete: false,
                activity: {
                    appointments: [appointmentData]
                },
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isActive: true,
                emailVerified: false,
                authProvider: 'email'
            };
            
            await setDoc(patientDocRef, basicPatientData);
            console.log('Patient document created successfully');
        } else {
            // Patient document exists, update it with new appointment
            const patientUpdates = {
                'activity.appointments': arrayUnion(appointmentData),
                updatedAt: serverTimestamp()
            };
            
            await updateDoc(patientDocRef, patientUpdates);
        }
        
        console.log('Appointment added successfully to patient document');
        return appointmentData;
    } catch (error) {
        console.error('Error adding appointment:', error);
        throw error;
    }
}

/**
 * Get facility appointments
 */
export async function getFacilityAppointments(facilityId) {
    try {
        console.log(`🔍 Fetching appointments for facility: ${facilityId}`);
        
        // Get all patient documents and filter for appointments belonging to this facility
        const patientsRef = collection(db, 'patients');
        const querySnapshot = await getDocs(patientsRef);
        
        const appointments = [];
        let totalAppointments = 0;
        
        querySnapshot.forEach((doc) => {
            const patientData = doc.data();
            const patientAppointments = patientData?.activity?.appointments || [];
            totalAppointments += patientAppointments.length;
            
            console.log(`Patient ${doc.id} has ${patientAppointments.length} appointments`);
            
            // Filter appointments for this facility
            const facilityAppointments = patientAppointments.filter(appointment => {
                const isMatch = appointment.facilityId === facilityId;
                console.log(`Appointment ${appointment.id}: facilityId=${appointment.facilityId}, match=${isMatch}`);
                return isMatch;
            });
            
            appointments.push(...facilityAppointments);
        });
        
        console.log(`📊 Summary: ${appointments.length}/${totalAppointments} appointments match facility ${facilityId}`);
        console.log(`📋 Returning appointments:`, appointments);
        return appointments;
    } catch (error) {
        console.error('Error fetching facility appointments:', error);
        throw error;
    }
}

/**
 * Update appointment status (for both patient and facility)
 */
export async function updateAppointmentStatus(appointmentId, status, patientId, facilityId) {
    try {
        // Update in patient's appointments
        if (patientId) {
            const patientData = await getPatientData(patientId);
            const appointments = patientData?.activity?.appointments || [];
            const updatedAppointments = appointments.map(apt => 
                apt.id === appointmentId ? { ...apt, status, updatedAt: new Date().toISOString() } : apt
            );
            
            const patientUpdates = {
                'activity.appointments': updatedAppointments,
                updatedAt: serverTimestamp()
            };
            
            await updateDoc(doc(db, 'patients', patientId), patientUpdates);
            console.log('Appointment status updated in patient document');
        }
        
        console.log('Appointment status updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating appointment status:', error);
        throw error;
    }
}

/**
 * Create appointment for a patient by facility (using patient UID)
 */
export async function createAppointmentForPatient(patientUid, appointmentData, facilityId, facilityName) {
    try {
        console.log('Creating appointment for patient:', patientUid);
        console.log('Appointment data:', appointmentData);
        console.log('Facility ID:', facilityId);
        console.log('Facility Name:', facilityName);
        
        // First, get the patient data to ensure they exist and get their details
        const patientDocRef = doc(db, 'patients', patientUid);
        const patientDocSnap = await getDoc(patientDocRef);
        
        if (!patientDocSnap.exists()) {
            throw new Error(`Patient with UID ${patientUid} not found`);
        }
        
        const patientData = patientDocSnap.data();
        console.log('Found patient data:', patientData);
        
        // Create the appointment object
        const appointment = {
            id: `appointment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            patientId: patientUid,
            patientName: patientData.personalInfo?.fullName || patientData.personalInfo?.firstName + ' ' + patientData.personalInfo?.lastName || 'Patient',
            patientEmail: patientData.email || '',
            date: appointmentData.date || '',
            time: appointmentData.time || '',
            doctor: appointmentData.doctor || '',
            type: appointmentData.type || 'consultation',
            status: appointmentData.status || 'scheduled',
            notes: appointmentData.notes || '',
            facilityId: facilityId,
            facilityName: facilityName,
            createdAt: new Date().toISOString(),
            createdBy: 'facility' // Mark that this was created by the facility
        };
        
        // Add the appointment to the patient's document
        const patientUpdates = {
            'activity.appointments': arrayUnion(appointment),
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(patientDocRef, patientUpdates);
        
        console.log('Appointment created successfully for patient:', patientUid);
        return appointment;
    } catch (error) {
        console.error('Error creating appointment for patient:', error);
        throw error;
    }
}

/**
 * Get patient appointments
 */
export async function getPatientAppointments(userId) {
    try {
        const patientData = await getPatientData(userId);
        return patientData?.activity?.appointments || [];
    } catch (error) {
        console.error('Error fetching patient appointments:', error);
        throw error;
    }
}

// ============= REAL-TIME LISTENERS =============

/**
 * Listen to patient data changes
 */
export function listenToPatientData(userId, callback) {
    const unsubscribe = onSnapshot(doc(db, 'patients', userId), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
    
    return unsubscribe;
}

/**
 * Listen to facility appointments changes
 */
export function listenToFacilityAppointments(facilityId, callback) {
    const patientsRef = collection(db, 'patients');
    
    const unsubscribe = onSnapshot(patientsRef, (querySnapshot) => {
        const appointments = [];
        querySnapshot.forEach((doc) => {
            const patientData = doc.data();
            const patientAppointments = patientData?.activity?.appointments || [];
            
            // Filter appointments for this facility
            const facilityAppointments = patientAppointments.filter(appointment => 
                appointment.facilityId === facilityId
            );
            
            appointments.push(...facilityAppointments);
        });
        callback(appointments);
    });
    
    return unsubscribe;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId) {
    try {
        console.log('🕐 Updating last login for user:', userId);
        
        // First, check if patient document exists
        const docRef = doc(db, 'patients', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            // Document exists, update it
            await updateDoc(docRef, {
                lastLoginAt: serverTimestamp()
            });
            console.log('✅ Last login updated successfully');
        } else {
            // Document doesn't exist, skip update silently
            console.log('⚠️ Patient document does not exist, skipping last login update');
        }
    } catch (error) {
        // Don't throw error, just log it - last login update is not critical
        console.warn('⚠️ Error updating last login (non-critical):', error.message);
    }
}

/**
 * Check if user profile is complete
 */
export async function checkProfileComplete(userId) {
    try {
        const patientData = await getPatientData(userId);
        if (!patientData) return false;
        
        const personalInfo = patientData.personalInfo || {};
        const hasBasicInfo = personalInfo.firstName && personalInfo.lastName && personalInfo.phone;
        
        return Boolean(hasBasicInfo);
    } catch (error) {
        console.error('Error checking profile completion:', error);
        return false;
    }
}

/**
 * Get patient statistics
 */
export async function getPatientStats(userId) {
    try {
        const patientData = await getPatientData(userId);
        if (!patientData) return null;
        
        const activity = patientData.activity || {};
        
        return {
            totalConsultations: activity.consultationHistory?.length || 0,
            totalDocuments: activity.documents?.length || 0,
            totalAppointments: activity.appointments?.length || 0,
            completedConsultations: activity.consultationHistory?.filter(c => c.status === 'completed').length || 0,
            upcomingAppointments: activity.appointments?.filter(a => a.status === 'scheduled').length || 0
        };
    } catch (error) {
        console.error('Error fetching patient stats:', error);
        return null;
    }
}

/**
 * Fix existing patient documents that are missing uniquePatientId
 * This function should be called once to update existing patient documents
 */
export async function fixExistingPatientIds() {
    try {
        console.log('Starting to fix existing patient documents...');
        
        // Get all patient documents
        const patientsQuery = query(collection(db, 'patients'));
        const querySnapshot = await getDocs(patientsQuery);
        
        let fixedCount = 0;
        let errorCount = 0;
        
        for (const docSnapshot of querySnapshot.docs) {
            const patientData = docSnapshot.data();
            
            // Check if uniquePatientId is missing
            if (!patientData.uniquePatientId) {
                try {
                    // Generate unique patient ID
                    const uniquePatientId = await generateUniquePatientId();
                    
                    // Update the document
                    await updateDoc(doc(db, 'patients', docSnapshot.id), {
                        uniquePatientId: uniquePatientId,
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log(`Fixed patient document ${docSnapshot.id} with ID: ${uniquePatientId}`);
                    fixedCount++;
                } catch (error) {
                    console.error(`Failed to fix patient document ${docSnapshot.id}:`, error);
                    errorCount++;
                }
            }
        }
        
        console.log(`Fixed ${fixedCount} patient documents. Errors: ${errorCount}`);
        return { fixedCount, errorCount };
    } catch (error) {
        console.error('Error fixing existing patient IDs:', error);
        throw error;
    }
}

/**
 * Assign unique patient ID to current user if missing
 */
export async function assignUniquePatientIdToCurrentUser() {
    try {
        const user = getCurrentUser();
        if (!user) {
            throw new Error('No authenticated user found');
        }
        
        const patientData = await getPatientData(user.uid);
        
        if (!patientData) {
            throw new Error('Patient document not found');
        }
        
        if (patientData.uniquePatientId) {
            console.log('Patient already has unique ID:', patientData.uniquePatientId);
            return patientData.uniquePatientId;
        }
        
        // Generate and assign unique patient ID
        const uniquePatientId = await generateUniquePatientId();
        
        await updateDoc(doc(db, 'patients', user.uid), {
            uniquePatientId: uniquePatientId,
            updatedAt: serverTimestamp()
        });
        
        console.log('Assigned unique patient ID:', uniquePatientId);
        return uniquePatientId;
    } catch (error) {
        console.error('Error assigning unique patient ID:', error);
        throw error;
    }
}

/**
 * Create facility document in Firestore
 */
export async function createFacilityDocument(user, additionalData = {}) {
    try {
        if (!user) {
            throw new Error('User is required');
        }

        const emailUsername = user.email.split('@')[0];
        
        // Detect auth provider from user object
        let authProvider = 'email'; // default
        if (user.providerData && user.providerData.length > 0) {
            const providers = user.providerData.map(p => p.providerId);
            if (providers.includes('google.com')) {
                authProvider = 'google';
            } else if (providers.includes('facebook.com')) {
                authProvider = 'facebook';
            } else if (providers.includes('apple.com')) {
                authProvider = 'apple';
            }
        }

        // Use Firebase UID as the unique facility ID
        const uniqueFacilityId = user.uid;
        
        const facilityData = {
            uid: user.uid,
            email: user.email,
            role: 'facility', // Assign 'facility' role
            uniqueFacilityId: uniqueFacilityId, // Use Firebase UID as facility ID
            
            // Basic facility information
            facilityInfo: {
                name: additionalData.facilityName || user.displayName || emailUsername,
                type: additionalData.facilityType || '',
                email: additionalData.email || user.email,
                phone: additionalData.phone || '',
                address: '',
                city: '',
                province: '',
                postalCode: '',
                country: 'Philippines',
                website: '',
                description: ''
            },

            // Operating hours (default)
            operatingHours: {
                monday: { open: '09:00', close: '17:00', closed: false },
                tuesday: { open: '09:00', close: '17:00', closed: false },
                wednesday: { open: '09:00', close: '17:00', closed: false },
                thursday: { open: '09:00', close: '17:00', closed: false },
                friday: { open: '09:00', close: '17:00', closed: false },
                saturday: { open: '09:00', close: '12:00', closed: false },
                sunday: { open: '09:00', close: '12:00', closed: true }
            },

            // Services and specialties
            specialties: [],
            services: [],
            
            // Staff information
            staff: {
                totalStaff: 0,
                doctors: 0,
                nurses: 0,
                supportStaff: 0
            },

            // Capacity
            capacity: {
                bedCapacity: 0,
                consultationRooms: 0
            },

            // Additional information
            licenseNumber: '',
            accreditation: [],
            insuranceAccepted: [],
            languages: ['English', 'Filipino'],
            
            // Status and timestamps
            isActive: true,
            isVerified: false,
            profileComplete: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            emailVerified: user.emailVerified || false,
            authProvider: additionalData.authProvider || authProvider,
        };

        // Create the facility document with the structure expected by both facility dashboard and patient search
        const finalFacilityData = {
            // Main facility info (for facility dashboard)
            uid: user.uid,
            email: user.email,
            role: 'facility',
            uniqueFacilityId: uniqueFacilityId,
            
            // Basic facility information
            facilityInfo: {
                name: additionalData.facilityName || user.displayName || emailUsername,
                type: additionalData.facilityType || 'Medical Clinic',
                email: additionalData.email || user.email,
                phone: additionalData.phone || '',
                address: '',
                city: '',
                province: '',
                postalCode: '',
                country: 'Philippines',
                website: '',
                description: 'Healthcare facility providing medical services.'
            },

            // Simplified structure for patient search (facility service)
            name: additionalData.facilityName || user.displayName || emailUsername,
            type: additionalData.facilityType || 'Medical Clinic',
            phone: additionalData.phone || '',
            address: '',
            city: '',
            province: '',
            postalCode: '',
            country: 'Philippines',
            website: '',
            specialties: [],
            services: ['Consultation'],
            
            // Operating hours
            operatingHours: {
                monday: { open: '09:00', close: '17:00', closed: false },
                tuesday: { open: '09:00', close: '17:00', closed: false },
                wednesday: { open: '09:00', close: '17:00', closed: false },
                thursday: { open: '09:00', close: '17:00', closed: false },
                friday: { open: '09:00', close: '17:00', closed: false },
                saturday: { open: '09:00', close: '12:00', closed: false },
                sunday: { open: '09:00', close: '12:00', closed: true }
            },
            
            // Staff information
            staff: {
                totalStaff: 0,
                doctors: 0,
                nurses: 0,
                supportStaff: 0,
                total: 1,
                doctors: 1,
                nurses: 0,
                supportStaff: 0
            },

            // Capacity
            capacity: {
                bedCapacity: 0,
                consultationRooms: 0,
                beds: 0,
                consultationRooms: 1
            },

            // Additional information
            licenseNumber: '',
            accreditation: ['Department of Health'],
            insuranceAccepted: ['PhilHealth'],
            languages: ['English', 'Filipino'],
            
            // Status and timestamps
            isActive: true,
            isSearchable: true,
            isVerified: false,
            profileComplete: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            emailVerified: user.emailVerified || false,
            authProvider: additionalData.authProvider || authProvider,
            
            // Description for facility service
            description: 'Healthcare facility providing medical services.'
        };
        
        await setDoc(doc(db, 'facilities', user.uid), finalFacilityData);
        
        const logger = window.firestoreLogger || console;
        logger.info('Facility documents created successfully for:', user.email, 'with provider:', authProvider);
        return facilityData;

    } catch (error) {
        let errorMessage = 'Failed to create facility document';
        
        // Handle specific Firestore errors
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. This is likely due to Firestore rules.';
            console.error('🔒 Firestore Permission Denied Error for facility creation:');
            console.error('- Check if user is authenticated:', user ? '✅ Yes' : '❌ No');
            console.error('- User UID:', user?.uid);
            console.error('- User email verified:', user?.emailVerified ? '✅ Yes' : '❌ No');
        } else if (error.code === 'unauthenticated') {
            errorMessage = 'Authentication required to create facility document.';
        } else if (error.message) {
            errorMessage = `Error creating facility document: ${error.message}`;
        }
        
        console.error('Error creating facility document:', errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Generate unique facility ID
 */
export async function generateUniqueFacilityId() {
    try {
        // Get the current counter from Firestore
        const counterDoc = await getDoc(doc(db, 'counters', 'facilityIds'));
        
        let nextId = 1000; // Start with FL-1000
        
        if (counterDoc.exists()) {
            nextId = counterDoc.data().currentId + 1;
        }
        
        // Update the counter
        await setDoc(doc(db, 'counters', 'facilityIds'), {
            currentId: nextId,
            updatedAt: serverTimestamp()
        });
        
        // Return the formatted ID
        return `FL-${nextId}`;
    } catch (error) {
        console.error('Error generating unique facility ID:', error);
        
        // Fallback: Generate ID based on timestamp and random number
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const fallbackId = `FL-${timestamp}-${randomNum}`;
        
        console.warn('Using fallback facility ID generation:', fallbackId);
        return fallbackId;
    }
}

/**
 * Get all facilities from Firestore
 */
export async function getAllFacilities() {
    try {
        const facilitiesRef = collection(db, 'facilities');
        const q = query(facilitiesRef, where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        
        const facilities = [];
        querySnapshot.forEach((doc) => {
            const facilityData = doc.data();
            facilities.push({
                id: doc.id,
                ...facilityData
            });
        });
        
        const logger = window.firestoreLogger || console;
        logger.info('Retrieved facilities:', facilities.length);
        return facilities;
        
    } catch (error) {
        const logger = window.firestoreLogger || console;
        logger.error('Error getting facilities:', error);
        throw new Error('Failed to retrieve facilities');
    }
}

/**
 * Clean up test facilities from the database
 */
export async function cleanupTestFacilities() {
    try {
        console.log('🔍 Checking for test facilities...')
        
        const facilitiesRef = collection(db, 'facilities')
        const querySnapshot = await getDocs(facilitiesRef)
        
        let deletedCount = 0
        
        querySnapshot.forEach((doc) => {
            const data = doc.data()
            console.log('Found facility:', data.name || data.facilityInfo?.name, 'with UID:', doc.id)
            
            // Check if this looks like a test facility (no address, city, or province)
            const isTestFacility = (
                !data.facilityInfo?.address || 
                data.facilityInfo?.address === '' ||
                data.facilityInfo?.city === '' ||
                data.facilityInfo?.province === '' ||
                data.facilityInfo?.name?.includes('Test') ||
                data.facilityInfo?.name?.includes('Sample')
            )
            
            if (isTestFacility) {
                console.log('🗑️ Deleting test facility:', data.facilityInfo?.name || data.name)
                deleteDoc(doc.ref)
                deletedCount++
            }
        })
        
        console.log(`✅ Cleanup complete. Deleted ${deletedCount} test facilities.`)
        return deletedCount
    } catch (error) {
        console.error('❌ Error cleaning up test facilities:', error)
        throw error
    }
}

// Console log for debugging
console.log('Firestore Database Service ready - Auth and DB instances created');

// Export Firebase instances
export { app, auth, db };