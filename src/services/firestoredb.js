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
            const patientData = userDoc.data();
            
            // Ensure medicalInfo structure exists
            if (!patientData.medicalInfo) {
                console.log('⚠️ Medical info structure not found in getPatientData, initializing...');
                await updateDoc(doc(db, 'patients', userId), {
                    medicalInfo: {
                        conditions: {},
                        allergies: [],
                        medications: [],
                        surgeries: []
                    },
                    updatedAt: serverTimestamp()
                });
                
                // Return updated data
                return {
                    ...patientData,
                    medicalInfo: {
                        conditions: {},
                        allergies: [],
                        medications: [],
                        surgeries: []
                    }
                };
            }
            
            return patientData;
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
            
            // Initialize medical information structure
            medicalInfo: {
                conditions: {},
                allergies: [],
                medications: [],
                surgeries: []
            },
            
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
        console.log('🔍 Validation result:', validationResult);
        console.log('🔍 Sanitized data:', validationResult.sanitizedData);
        
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
            // Ensure medicalInfo structure exists
            if (!patientData.medicalInfo) {
                console.log('⚠️ Medical info structure not found, initializing...');
                await updateDoc(doc(db, 'patients', userId), {
                    medicalInfo: {
                        conditions: {},
                        allergies: [],
                        medications: [],
                        surgeries: []
                    },
                    updatedAt: serverTimestamp()
                });
                currentConditions = {};
            } else {
                currentConditions = patientData.medicalInfo.conditions || {};
            }
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
        // Ensure medicalInfo structure exists
        if (!patientData.medicalInfo) {
            console.log('⚠️ Medical info structure not found, initializing...');
            await updateDoc(doc(db, 'patients', userId), {
                medicalInfo: {
                    conditions: {},
                    allergies: [],
                    medications: [],
                    surgeries: []
                },
                updatedAt: serverTimestamp()
            });
            return true; // No conditions to remove
        }
        const currentConditions = patientData.medicalInfo.conditions || {};

        // Check if the category exists
        if (!currentConditions[category]) {
            throw new Error('Category not found');
        }

        // Remove the condition from the category array
        const updatedConditionsInCategory = currentConditions[category].filter(c => c !== condition);
        
        // If the category becomes empty, remove it completely
        let updatedConditions;
        if (updatedConditionsInCategory.length === 0) {
            // Remove the entire category if it's empty
            const { [category]: removedCategory, ...remainingConditions } = currentConditions;
            updatedConditions = remainingConditions;
            console.log(`Category "${category}" removed completely as it's now empty`);
        } else {
            // Keep the category with remaining conditions
            updatedConditions = {
                ...currentConditions,
                [category]: updatedConditionsInCategory
            };
        }

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
            id: consultation.id || `consultation_${Date.now()}`,
            doctorName: consultation.doctorName || '',
            specialty: consultation.specialty || '',
            date: consultation.date || new Date().toISOString(),
            time: consultation.time || '00:00',
            type: consultation.type || '',
            status: consultation.status || 'completed',
            notes: consultation.notes || '',
            facilityId: consultation.facilityId || '',
            facilityName: consultation.facilityName || ''
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

/**
 * Remove consultation from patient history
 */
export async function removePatientConsultation(userId, consultationId) {
    try {
        console.log('🔍 removePatientConsultation called for user:', userId, 'consultation:', consultationId);
        
        // Get current consultation history
        const patientData = await getPatientData(userId);
        const currentConsultations = patientData?.activity?.consultationHistory || [];
        
        // Filter out the consultation to remove
        const updatedConsultations = currentConsultations.filter(consultation => consultation.id !== consultationId);
        
        // Update the document with the filtered array
        const updates = {
            'activity.consultationHistory': updatedConsultations,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), updates);
        console.log('✅ Consultation removed successfully from Firestore');
        return true;
    } catch (error) {
        console.error('❌ Error removing consultation from Firestore:', error);
        throw error;
    }
}

// ============= DOCUMENT MANAGEMENT =============

/**
 * Add document to patient records with local file storage
 */
export async function addPatientDocument(userId, file, documentName = null) {
    console.log('🔍 addPatientDocument called for user:', userId);
    console.log('📁 File to upload:', file);
    
    // Add global error handler for XMLHttpRequest errors
    const originalXMLHttpRequest = window.XMLHttpRequest;
    let xmlHttpRequestError = null;
    
    // Override XMLHttpRequest to catch any errors
    window.XMLHttpRequest = function() {
        const xhr = new originalXMLHttpRequest();
        
        // Override open method to track state
        const originalOpen = xhr.open;
        xhr.open = function() {
            try {
                return originalOpen.apply(this, arguments);
            } catch (error) {
                xmlHttpRequestError = error;
                console.error('🚨 XMLHttpRequest.open error:', error);
                throw error;
            }
        };
        
        // Override setRequestHeader method
        const originalSetRequestHeader = xhr.setRequestHeader;
        xhr.setRequestHeader = function() {
            try {
                return originalSetRequestHeader.apply(this, arguments);
            } catch (error) {
                xmlHttpRequestError = error;
                console.error('🚨 XMLHttpRequest.setRequestHeader error:', error);
                throw error;
            }
        };
        
        return xhr;
    };
    
    // Wrap everything in a try-catch to catch any XMLHttpRequest errors
    try {
        
        // Check rate limiting
        if (!rateLimiter.isAllowed(userId, 5, 60000)) {
            throw new Error('Too many document uploads. Please wait 1 minute before trying again.');
        }

        // Validate file
        if (!file) {
            throw new Error('No file provided for upload');
        }

        // Additional file validation
        if (!(file instanceof File)) {
            throw new Error('Invalid file object provided');
        }

        if (file.size === undefined || file.size === null) {
            throw new Error('File size information is missing');
        }

        if (file.type === undefined || file.type === null) {
            throw new Error('File type information is missing');
        }

        console.log('📁 File validation passed:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        });

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

        // Convert file to base64 for local storage using a completely different approach
        let base64Data;
        try {
            console.log('📖 Starting simplified file processing...');
            
            // Use the most basic and reliable method: arrayBuffer with chunked processing
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Process in smaller chunks to avoid memory issues and potential errors
            let binaryString = '';
            const chunkSize = 4096; // Smaller chunks for better compatibility
            
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.slice(i, Math.min(i + chunkSize, uint8Array.length));
                
                // Convert chunk to string character by character to avoid apply() issues
                for (let j = 0; j < chunk.length; j++) {
                    binaryString += String.fromCharCode(chunk[j]);
                }
            }
            
            // Create base64 data URL
            base64Data = `data:${file.type};base64,${btoa(binaryString)}`;
            console.log('✅ File processing successful using chunked arrayBuffer approach');
            
        } catch (error) {
            console.error('❌ File processing failed:', error);
            
            // If all else fails, try to create a minimal document without the file content
            console.log('🔄 Attempting to create document without file content...');
            base64Data = `data:${file.type};base64,`; // Empty base64 data
            
            console.warn('⚠️ Document will be created without file content due to processing error');
        }

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
        
        // Use a simpler approach without transactions to avoid network blocking issues
        const patientDocRef = doc(db, 'patients', userId);
        
        console.log('🔍 Starting Firestore document update...');
        console.log('📁 Patient document reference:', patientDocRef.path);
        
        try {
            // First, try to get the existing patient document
            console.log('📖 Getting patient document...');
            const patientDoc = await getDoc(patientDocRef);
            
            if (patientDoc.exists()) {
                const currentData = patientDoc.data();
                const currentDocuments = currentData?.activity?.documents || [];
                
                console.log('📋 Current documents:', currentDocuments);
                console.log('📋 Current patient data keys:', Object.keys(currentData));
                
                // Add new document to the array
                const updatedDocuments = [...currentDocuments, documentWithData];
                
                console.log('📋 Updated documents array:', updatedDocuments);
                
                // Update the document with the new array
                console.log('📝 Updating patient document with new documents...');
                await updateDoc(patientDocRef, {
                    'activity.documents': updatedDocuments,
                    updatedAt: serverTimestamp()
                });
                console.log('✅ Document update completed');
            } else {
                // If patient document doesn't exist, create it with the document
                console.log('📝 Creating new patient document with document...');
                await setDoc(patientDocRef, {
                    uid: userId,
                    activity: {
                        documents: [documentWithData]
                    },
                    updatedAt: serverTimestamp()
                }, { merge: true });
                console.log('✅ Document create completed');
            }
            console.log('✅ Firestore operation completed successfully');
        } catch (firestoreError) {
            console.error('❌ Firestore operation failed:', firestoreError);
            console.error('Firestore error details:', {
                code: firestoreError.code,
                message: firestoreError.message,
                stack: firestoreError.stack
            });
            throw firestoreError;
        }
        
        console.log('✅ Document added successfully to Firestore using transaction');
        
        // Check if we caught any XMLHttpRequest errors
        if (xmlHttpRequestError) {
            console.error('🚨 XMLHttpRequest error was caught during processing:', xmlHttpRequestError);
            throw new Error(`Document upload failed due to a network issue: ${xmlHttpRequestError.message}`);
        }
        
        return documentWithData;
    } catch (error) {
        console.error('❌ Error adding document:', error);
        
        // Check if this is an XMLHttpRequest error
        if (error.message && error.message.includes('XMLHttpRequest')) {
            console.error('🚨 XMLHttpRequest error detected!');
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Try to provide a more helpful error message
            throw new Error('Document upload failed due to a network configuration issue. Please try again or contact support if the problem persists.');
        }
        
        throw error;
    } finally {
        // Restore original XMLHttpRequest
        window.XMLHttpRequest = originalXMLHttpRequest;
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
        
        console.log('📦 Removing document from Firestore...');
        
        // Use updateDoc instead of setDoc for better reliability
        const patientDocRef = doc(db, 'patients', userId);
        await updateDoc(patientDocRef, {
            'activity.documents': updatedDocuments,
            updatedAt: serverTimestamp()
        });
        
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
            patientNotes: appointment.patientNotes || '',
            facilityNotes: appointment.facilityNotes || '',
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
        console.log('🔄 Updating appointment status:', { appointmentId, status, patientId, facilityId });
        
        // Validate inputs
        if (!appointmentId) {
            throw new Error('Appointment ID is required');
        }
        if (!status) {
            throw new Error('Status is required');
        }
        if (!patientId) {
            throw new Error('Patient ID is required');
        }
        
        // Update in patient's appointments
        if (patientId) {
            const patientData = await getPatientData(patientId);
            if (!patientData) {
                throw new Error('Patient data not found');
            }
            
            const appointments = patientData?.activity?.appointments || [];
            const appointmentIndex = appointments.findIndex(apt => apt.id === appointmentId);
            
            if (appointmentIndex === -1) {
                throw new Error(`Appointment with ID ${appointmentId} not found in patient data`);
            }
            
            console.log('📋 Found appointment:', appointments[appointmentIndex]);
            
            const updatedAppointments = appointments.map(apt => 
                apt.id === appointmentId ? { ...apt, status, updatedAt: new Date().toISOString() } : apt
            );
            
            const patientUpdates = {
                'activity.appointments': updatedAppointments,
                updatedAt: serverTimestamp()
            };
            
            console.log('📝 Updating patient document with:', patientUpdates);
            await updateDoc(doc(db, 'patients', patientId), patientUpdates);
            console.log('✅ Appointment status updated in patient document');
        }
        
        // Also update the appointment urgency if it exists
        if (patientId) {
            try {
                const patientData = await getPatientData(patientId);
                const appointments = patientData?.activity?.appointments || [];
                const appointment = appointments.find(apt => apt.id === appointmentId);
                
                if (appointment && appointment.urgency) {
                    // Update urgency data if it exists
                    const updatedAppointments = appointments.map(apt => 
                        apt.id === appointmentId ? { 
                            ...apt, 
                            status, 
                            updatedAt: new Date().toISOString(),
                            urgency: {
                                ...apt.urgency,
                                lastStatusUpdate: new Date().toISOString()
                            }
                        } : apt
                    );
                    
                    const urgencyUpdates = {
                        'activity.appointments': updatedAppointments,
                        updatedAt: serverTimestamp()
                    };
                    
                    await updateDoc(doc(db, 'patients', patientId), urgencyUpdates);
                    console.log('✅ Appointment urgency data updated');
                }
            } catch (urgencyError) {
                console.warn('⚠️ Could not update urgency data:', urgencyError);
                // Don't fail the entire operation if urgency update fails
            }
        }
        
        console.log('✅ Appointment status updated successfully');
        return true;
    } catch (error) {
        console.error('❌ Error updating appointment status:', error);
        throw error;
    }
}

/**
 * Update appointment details (for patients to edit their appointments)
 */
export async function updateAppointment(userId, appointmentId, updatedAppointmentData) {
    try {
        console.log('🔍 Updating appointment:', appointmentId);
        console.log('📋 Updated data:', updatedAppointmentData);
        
        // Get current patient data
        const patientData = await getPatientData(userId);
        if (!patientData) {
            throw new Error('Patient data not found');
        }
        
        const appointments = patientData?.activity?.appointments || [];
        const appointmentIndex = appointments.findIndex(apt => apt.id === appointmentId);
        
        if (appointmentIndex === -1) {
            throw new Error('Appointment not found');
        }
        
        // Update the appointment with new data while preserving existing fields
        const updatedAppointments = appointments.map((apt, index) => {
            if (index === appointmentIndex) {
                return {
                    ...apt,
                    ...updatedAppointmentData,
                    updatedAt: new Date().toISOString()
                };
            }
            return apt;
        });
        
        // Update the patient document
        const patientUpdates = {
            'activity.appointments': updatedAppointments,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), patientUpdates);
        
        console.log('✅ Appointment updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating appointment:', error);
        throw error;
    }
}

/**
 * Update appointment details by facility (for healthcare providers to edit appointments)
 */
export async function updateAppointmentByFacility(appointmentId, patientId, updatedAppointmentData, facilityId) {
    try {
        console.log('🏥 Facility updating appointment:', appointmentId);
        console.log('📋 Updated data:', updatedAppointmentData);
        console.log('👤 Patient ID:', patientId);
        console.log('🏥 Facility ID:', facilityId);
        
        // Deep clean function to remove ALL undefined values recursively
        const deepCleanObject = (obj) => {
            if (obj === null || obj === undefined) return null;
            if (typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) {
                return obj.map(item => deepCleanObject(item)).filter(item => item !== null);
            }
            
            const cleaned = {};
            Object.entries(obj).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    const cleanedValue = deepCleanObject(value);
                    if (cleanedValue !== null) {
                        cleaned[key] = cleanedValue;
                    }
                }
            });
            return cleaned;
        };
        
        // Clean the updated appointment data to remove undefined values
        const cleanedAppointmentData = deepCleanObject(updatedAppointmentData);
        
        console.log('🧹 Deep cleaned appointment data:', cleanedAppointmentData);
        console.log('🔍 Original appointment data keys:', Object.keys(updatedAppointmentData));
        console.log('🔍 Original appointment data values:', Object.values(updatedAppointmentData));
        console.log('🔍 Cleaned appointment data keys:', Object.keys(cleanedAppointmentData));
        console.log('🔍 Cleaned appointment data values:', Object.values(cleanedAppointmentData));
        
        // Get current patient data
        const patientData = await getPatientData(patientId);
        if (!patientData) {
            throw new Error('Patient data not found');
        }
        
        const appointments = patientData?.activity?.appointments || [];
        const appointmentIndex = appointments.findIndex(apt => apt.id === appointmentId);
        
        if (appointmentIndex === -1) {
            throw new Error('Appointment not found');
        }
        
        // Get the original appointment to preserve some fields
        const originalAppointment = appointments[appointmentIndex];
        
        // Check if facility notes or type changed, which might affect urgency
        const notesChanged = originalAppointment.facilityNotes !== cleanedAppointmentData.facilityNotes;
        const typeChanged = originalAppointment.type !== cleanedAppointmentData.type;
        const shouldReevaluateUrgency = notesChanged || typeChanged;
        
        // Re-evaluate urgency if relevant fields changed
        let urgencyLevel = originalAppointment.urgency?.level || 'GREEN';
        let urgencyDescription = originalAppointment.urgency?.description || 'ROUTINE';
        
        if (shouldReevaluateUrgency) {
            try {
                // Import and use the triage service to evaluate urgency
                const { evaluateAppointmentUrgency } = await import('./triage.service.ts');
                const urgencyResult = await evaluateAppointmentUrgency({
                    id: appointmentId,
                    type: cleanedAppointmentData.type || originalAppointment.type,
                    notes: `${cleanedAppointmentData.facilityNotes || originalAppointment.facilityNotes || ''} ${originalAppointment.patientNotes || ''}`.trim(),
                    status: cleanedAppointmentData.status || originalAppointment.status,
                    date: cleanedAppointmentData.date || originalAppointment.date,
                    time: cleanedAppointmentData.time || originalAppointment.time
                });
                
                urgencyLevel = urgencyResult.level;
                urgencyDescription = urgencyResult.urgency;
                console.log('🚨 Urgency re-evaluation result:', urgencyResult);
            } catch (urgencyError) {
                console.log('⚠️ Urgency re-evaluation failed, using fallback:', urgencyError.message);
                // Use fallback urgency evaluation based on keywords
                const text = `${cleanedAppointmentData.facilityNotes || originalAppointment.facilityNotes || ''} ${originalAppointment.patientNotes || ''} ${cleanedAppointmentData.type || originalAppointment.type || ''}`.toLowerCase();
                
                // Critical/Red indicators
                const redKeywords = [
                    'chest pain', 'heart attack', 'stroke', 'severe bleeding', 'unconscious',
                    'difficulty breathing', 'severe trauma', 'overdose', 'suicide', 'seizure',
                    'cardiac arrest', 'respiratory failure', 'anaphylaxis', 'severe burns'
                ];
                
                // Urgent/Orange indicators
                const orangeKeywords = [
                    'high fever', 'severe headache', 'broken bone', 'deep cut', 'infection',
                    'dehydration', 'severe pain', 'allergic reaction', 'meningitis symptoms',
                    'appendicitis', 'gallbladder', 'kidney stone', 'pneumonia symptoms'
                ];
                
                // Check for red level
                if (redKeywords.some(keyword => text.includes(keyword))) {
                    urgencyLevel = 'RED';
                    urgencyDescription = 'CRITICAL';
                }
                // Check for orange level
                else if (orangeKeywords.some(keyword => text.includes(keyword))) {
                    urgencyLevel = 'ORANGE';
                    urgencyDescription = 'VERY URGENT';
                }
                // Default to green
                else {
                    urgencyLevel = 'GREEN';
                    urgencyDescription = 'ROUTINE';
                }
                
                console.log('🚨 Fallback urgency re-evaluation:', { level: urgencyLevel, urgency: urgencyDescription });
            }
        }
        
        // Update the appointment with new data while preserving existing fields
        const updatedAppointments = appointments.map((apt, index) => {
            if (index === appointmentIndex) {
                const updatedAppointment = {
                    ...apt,
                    // Update only the fields that facilities can edit
                    date: cleanedAppointmentData.date || apt.date,
                    time: cleanedAppointmentData.time || apt.time,
                    doctor: cleanedAppointmentData.doctor || apt.doctor,
                    status: cleanedAppointmentData.status || apt.status,
                    facilityNotes: cleanedAppointmentData.facilityNotes || apt.facilityNotes,
                    // Update urgency if it was re-evaluated
                    urgency: shouldReevaluateUrgency ? {
                        level: urgencyLevel,
                        description: urgencyDescription,
                        evaluatedAt: new Date().toISOString(),
                        evaluatedBy: 'system',
                        reEvaluated: true
                    } : apt.urgency,
                    // Add metadata about the update
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'facility',
                    facilityId: facilityId,
                    lastModifiedBy: facilityId,
                    modificationHistory: [
                        ...(apt.modificationHistory || []),
                        {
                            timestamp: new Date().toISOString(),
                            modifiedBy: facilityId,
                            changes: (() => {
                                const changes = {
                                    date: apt.date !== cleanedAppointmentData.date ? { from: apt.date, to: cleanedAppointmentData.date } : null,
                                    time: apt.time !== cleanedAppointmentData.time ? { from: apt.time, to: cleanedAppointmentData.time } : null,
                                    doctor: apt.doctor !== cleanedAppointmentData.doctor ? { from: apt.doctor, to: cleanedAppointmentData.doctor } : null,
                                    status: apt.status !== cleanedAppointmentData.status ? { from: apt.status, to: cleanedAppointmentData.status } : null,
                                    facilityNotes: apt.facilityNotes !== cleanedAppointmentData.facilityNotes ? { from: apt.facilityNotes, to: cleanedAppointmentData.facilityNotes } : null,
                                    type: apt.type !== cleanedAppointmentData.type ? { from: apt.type, to: cleanedAppointmentData.type } : null
                                };
                                
                                // Remove null values to prevent undefined issues
                                return Object.fromEntries(
                                    Object.entries(changes).filter(([_, value]) => value !== null)
                                );
                            })()
                        }
                    ]
                };
                
                // Deep clean the final appointment object to ensure no undefined values
                const finalCleanedAppointment = deepCleanObject(updatedAppointment);
                
                // Debug: Check for any undefined values in the final object
                console.log('🔍 Final updated appointment object (before cleaning):', updatedAppointment);
                console.log('🔍 Final cleaned appointment object (after deep cleaning):', finalCleanedAppointment);
                console.log('🔍 Checking for undefined values...');
                Object.entries(finalCleanedAppointment).forEach(([key, value]) => {
                    if (value === undefined) {
                        console.error(`❌ UNDEFINED VALUE FOUND in key: ${key}`);
                    }
                });
                
                return finalCleanedAppointment;
            }
            return apt;
        });
        
        // Deep clean the final patient updates before sending to Firestore
        const cleanedPatientUpdates = deepCleanObject({
            'activity.appointments': updatedAppointments,
            updatedAt: serverTimestamp()
        });
        
        console.log('🔍 Final patient updates being sent to Firestore:', cleanedPatientUpdates);
        console.log('🔍 Checking patient updates for undefined values...');
        Object.entries(cleanedPatientUpdates).forEach(([key, value]) => {
            if (value === undefined) {
                console.error(`❌ UNDEFINED VALUE FOUND in patientUpdates key: ${key}`);
            }
        });
        
        // Additional check for nested undefined values in appointments array
        if (cleanedPatientUpdates['activity.appointments']) {
            console.log('🔍 Checking appointments array for undefined values...');
            cleanedPatientUpdates['activity.appointments'].forEach((apt, index) => {
                Object.entries(apt).forEach(([aptKey, aptValue]) => {
                    if (aptValue === undefined) {
                        console.error(`❌ UNDEFINED VALUE FOUND in appointment ${index}, key: ${aptKey}`);
                    }
                });
            });
        }
        
        await updateDoc(doc(db, 'patients', patientId), cleanedPatientUpdates);
        
        console.log('✅ Appointment updated by facility successfully');
        return true;
    } catch (error) {
        console.error('Error updating appointment by facility:', error);
        throw error;
    }
}

/**
 * Delete appointment for a patient
 */
export async function deleteAppointment(userId, appointmentId) {
    try {
        console.log('🔍 Deleting appointment:', appointmentId);
        console.log('👤 User ID:', userId);
        
        // Get current patient data
        const patientData = await getPatientData(userId);
        if (!patientData) {
            throw new Error('Patient data not found');
        }
        
        const appointments = patientData?.activity?.appointments || [];
        const appointmentIndex = appointments.findIndex(apt => apt.id === appointmentId);
        
        if (appointmentIndex === -1) {
            throw new Error('Appointment not found');
        }
        
        // Check if appointment is in the past
        const appointmentToDelete = appointments[appointmentIndex];
        const appointmentDate = new Date(appointmentToDelete.date + 'T' + appointmentToDelete.time);
        const now = new Date();
        
        if (appointmentDate <= now) {
            throw new Error('Cannot delete past appointments');
        }
        
        // Remove the appointment from the array
        const updatedAppointments = appointments.filter(apt => apt.id !== appointmentId);
        
        // Update the patient document
        const patientUpdates = {
            'activity.appointments': updatedAppointments,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'patients', userId), patientUpdates);
        
        console.log('✅ Appointment deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting appointment:', error);
        throw error;
    }
}

/**
 * Create appointment for a patient by facility (using patient UID)
 */
export async function createAppointmentForPatient(patientUid, appointmentData, facilityId, facilityName) {
    try {
        console.log('🔍 Creating appointment for patient:', patientUid);
        console.log('📋 Appointment data:', appointmentData);
        console.log('🏥 Facility ID:', facilityId);
        console.log('🏥 Facility Name:', facilityName);
        
        // First, get the patient data to ensure they exist and get their details
        const patientDocRef = doc(db, 'patients', patientUid);
        const patientDocSnap = await getDoc(patientDocRef);
        
        if (!patientDocSnap.exists()) {
            throw new Error(`Patient with UID ${patientUid} not found`);
        }
        
        const patientData = patientDocSnap.data();
        console.log('📋 Found patient data:', patientData);
        console.log('📋 Current activity field:', patientData.activity);
        console.log('📋 Current appointments:', patientData.activity?.appointments || []);
        
        // Ensure activity field exists
        if (!patientData.activity) {
            console.log('⚠️ Activity field not found, initializing...');
            await initializePatientActivity(patientUid);
        }
        
        // Evaluate urgency level for the appointment
        let urgencyLevel = 'GREEN';
        let urgencyDescription = 'ROUTINE';
        
        try {
            // Import and use the triage service to evaluate urgency
            const { evaluateAppointmentUrgency } = await import('./triage.service.ts');
            const urgencyResult = await evaluateAppointmentUrgency({
                id: `temp_${Date.now()}`,
                type: appointmentData.type || 'consultation',
                notes: `${appointmentData.facilityNotes || ''} ${appointmentData.patientNotes || ''}`.trim(),
                status: appointmentData.status || 'scheduled',
                date: appointmentData.date || '',
                time: appointmentData.time || ''
            });
            
            urgencyLevel = urgencyResult.level;
            urgencyDescription = urgencyResult.urgency;
            console.log('🚨 Urgency evaluation result:', urgencyResult);
        } catch (urgencyError) {
            console.log('⚠️ Urgency evaluation failed, using fallback:', urgencyError.message);
            // Use fallback urgency evaluation based on keywords
            const text = `${appointmentData.facilityNotes || ''} ${appointmentData.patientNotes || ''} ${appointmentData.type || ''}`.toLowerCase();
            
            // Critical/Red indicators
            const redKeywords = [
                'chest pain', 'heart attack', 'stroke', 'severe bleeding', 'unconscious',
                'difficulty breathing', 'severe trauma', 'overdose', 'suicide', 'seizure',
                'cardiac arrest', 'respiratory failure', 'anaphylaxis', 'severe burns'
            ];
            
            // Urgent/Orange indicators
            const orangeKeywords = [
                'high fever', 'severe headache', 'broken bone', 'deep cut', 'infection',
                'dehydration', 'severe pain', 'allergic reaction', 'meningitis symptoms',
                'appendicitis', 'gallbladder', 'kidney stone', 'pneumonia symptoms'
            ];
            
            // Check for red level
            if (redKeywords.some(keyword => text.includes(keyword))) {
                urgencyLevel = 'RED';
                urgencyDescription = 'CRITICAL';
            }
            // Check for orange level
            else if (orangeKeywords.some(keyword => text.includes(keyword))) {
                urgencyLevel = 'ORANGE';
                urgencyDescription = 'VERY URGENT';
            }
            // Default to green
            else {
                urgencyLevel = 'GREEN';
                urgencyDescription = 'ROUTINE';
            }
            
            console.log('🚨 Fallback urgency evaluation:', { level: urgencyLevel, urgency: urgencyDescription });
        }
        
        // Create the appointment object with urgency information
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
            patientNotes: appointmentData.patientNotes || '',
            facilityNotes: appointmentData.facilityNotes || '',
            facilityId: facilityId,
            facilityName: facilityName,
            createdAt: new Date().toISOString(),
            createdBy: 'facility', // Mark that this was created by the facility
            // Add urgency information
            urgency: {
                level: urgencyLevel,
                description: urgencyDescription,
                evaluatedAt: new Date().toISOString(),
                evaluatedBy: 'system'
            }
        };
        
        console.log('📅 Created appointment object with urgency:', appointment);
        
        // Add the appointment to the patient's document
        const patientUpdates = {
            'activity.appointments': arrayUnion(appointment),
            updatedAt: serverTimestamp()
        };
        
        console.log('📝 Updating patient document with:', patientUpdates);
        
        await updateDoc(patientDocRef, patientUpdates);
        
        console.log('✅ Appointment created successfully for patient:', patientUid);
        console.log('✅ Patient document updated with new appointment');
        console.log('🚨 Urgency level stored:', urgencyLevel);
        
        // Verify the update by reading the document again
        const updatedDocSnap = await getDoc(patientDocRef);
        if (updatedDocSnap.exists()) {
            const updatedData = updatedDocSnap.data();
            console.log('🔍 Verification - Updated patient data:', updatedData);
            console.log('🔍 Verification - Updated appointments:', updatedData.activity?.appointments || []);
            console.log('🔍 Verification - Number of appointments:', updatedData.activity?.appointments?.length || 0);
        }
        
        return appointment;
    } catch (error) {
        console.error('❌ Error creating appointment for patient:', error);
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
    console.log('🔍 Setting up real-time listener for facility:', facilityId);
    const patientsRef = collection(db, 'patients');
    
    const unsubscribe = onSnapshot(patientsRef, (querySnapshot) => {
        console.log('🔄 Real-time update received for facility:', facilityId);
        const appointments = [];
        let totalPatients = 0;
        let totalAppointments = 0;
        
        querySnapshot.forEach((doc) => {
            const patientData = doc.data();
            const patientAppointments = patientData?.activity?.appointments || [];
            totalPatients++;
            totalAppointments += patientAppointments.length;
            
            // Filter appointments for this facility
            const facilityAppointments = patientAppointments.filter(appointment => 
                appointment.facilityId === facilityId
            );
            
            if (facilityAppointments.length > 0) {
                console.log(`📋 Patient ${doc.id}: ${facilityAppointments.length} appointments for facility ${facilityId}`);
                facilityAppointments.forEach(apt => {
                    console.log(`  - Appointment ${apt.id}: ${apt.status} (${apt.date} ${apt.time})`);
                });
            }
            
            appointments.push(...facilityAppointments);
        });
        
        console.log(`📊 Real-time update: ${appointments.length} appointments for facility ${facilityId} from ${totalPatients} patients (${totalAppointments} total appointments)`);
        callback(appointments);
    }, (error) => {
        console.error('❌ Real-time listener error:', error);
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
                totalStaff: 1,
                doctors: 1,
                nurses: 0,
                supportStaff: 0
            },

            // Capacity
            capacity: {
                bedCapacity: 0,
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

/**
 * Ensure facility is searchable (utility function)
 */
export async function ensureFacilitySearchable(facilityId) {
    try {
        console.log('🔍 Ensuring facility is searchable:', facilityId);
        
        const facilityRef = doc(db, 'facilities', facilityId);
        const facilityDoc = await getDoc(facilityRef);
        
        if (!facilityDoc.exists()) {
            throw new Error('Facility not found');
        }
        
        const currentData = facilityDoc.data();
        
        // If isSearchable is not set or is false, set it to true
        if (currentData.isSearchable !== true) {
            await updateDoc(facilityRef, {
                isSearchable: true,
                updatedAt: serverTimestamp()
            });
            console.log('✅ Facility marked as searchable:', facilityId);
        } else {
            console.log('ℹ️ Facility already searchable:', facilityId);
        }
    } catch (error) {
        console.error('❌ Error ensuring facility is searchable:', error);
        throw error;
    }
}

/**
 * Update facility information
 */
export async function updateFacilityInfo(facilityId, updateData) {
    try {
        console.log('🔍 updateFacilityInfo called for facility:', facilityId);
        console.log('📦 Update data:', updateData);
        
        const facilityRef = doc(db, 'facilities', facilityId);
        
        // Validate that the facility exists
        const facilityDoc = await getDoc(facilityRef);
        if (!facilityDoc.exists()) {
            throw new Error('Facility not found');
        }
        
        // Get current facility data
        const currentData = facilityDoc.data();
        
        // Prepare the update object
        const updates = {
            updatedAt: serverTimestamp()
        };
        
        // Add facilityInfo updates if provided
        if (updateData.facilityInfo) {
            Object.keys(updateData.facilityInfo).forEach(key => {
                updates[`facilityInfo.${key}`] = updateData.facilityInfo[key];
            });
        }
        
        // Add other updates if provided
        if (updateData.licenseNumber !== undefined) {
            updates.licenseNumber = updateData.licenseNumber;
        }
        
        // Add new fields if provided
        if (updateData.specialties !== undefined) {
            updates.specialties = updateData.specialties;
        }
        if (updateData.services !== undefined) {
            updates.services = updateData.services;
        }
        if (updateData.staff !== undefined) {
            updates.staff = updateData.staff;
        }
        if (updateData.capacity !== undefined) {
            updates.capacity = updateData.capacity;
        }
        if (updateData.operatingHours !== undefined) {
            updates.operatingHours = updateData.operatingHours;
        }
        
        // Always ensure facility is searchable when updated
        updates.isSearchable = true;
        
        console.log('📦 Final updates object:', updates);
        console.log('🔍 Current facility data before update:', currentData);
        
        // Update the facility document
        await updateDoc(facilityRef, updates);
        
        console.log('✅ Facility information updated successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error updating facility information:', error);
        throw error;
    }
}

/**
 * Create quick appointment request (for non-registered patients)
 */
export async function createQuickAppointment(appointmentData) {
    try {
        console.log('🔍 Creating quick appointment request:', appointmentData);
        
        // Evaluate urgency level for the appointment
        let urgencyLevel = 'GREEN';
        let urgencyDescription = 'ROUTINE';
        
        try {
            // Import and use the triage service to evaluate urgency
            const { evaluateAppointmentUrgency } = await import('./triage.service.ts');
            const urgencyResult = await evaluateAppointmentUrgency({
                id: `temp_${Date.now()}`,
                type: appointmentData.type || 'consultation',
                notes: appointmentData.patientNotes || appointmentData.symptoms || '',
                status: 'pending',
                date: appointmentData.preferredDate || '',
                time: appointmentData.preferredTime || ''
            });
            
            urgencyLevel = urgencyResult.level;
            urgencyDescription = urgencyResult.urgency;
            console.log('🚨 Urgency evaluation result:', urgencyResult);
        } catch (urgencyError) {
            console.log('⚠️ Urgency evaluation failed, using fallback:', urgencyError.message);
            // Use fallback urgency evaluation based on keywords
            const text = `${appointmentData.patientNotes || appointmentData.symptoms || ''} ${appointmentData.specialty || ''}`.toLowerCase();
            
            // Critical/Red indicators
            const redKeywords = [
                'chest pain', 'heart attack', 'stroke', 'severe bleeding', 'unconscious',
                'difficulty breathing', 'severe trauma', 'overdose', 'suicide', 'seizure',
                'cardiac arrest', 'respiratory failure', 'anaphylaxis', 'severe burns'
            ];
            
            // Urgent/Orange indicators
            const orangeKeywords = [
                'high fever', 'severe headache', 'broken bone', 'deep cut', 'infection',
                'dehydration', 'severe pain', 'allergic reaction', 'meningitis symptoms',
                'appendicitis', 'gallbladder', 'kidney stone', 'pneumonia symptoms'
            ];
            
            // Check for red level
            if (redKeywords.some(keyword => text.includes(keyword))) {
                urgencyLevel = 'RED';
                urgencyDescription = 'CRITICAL';
            }
            // Check for orange level
            else if (orangeKeywords.some(keyword => text.includes(keyword))) {
                urgencyLevel = 'ORANGE';
                urgencyDescription = 'VERY URGENT';
            }
            // Default to green
            else {
                urgencyLevel = 'GREEN';
                urgencyDescription = 'ROUTINE';
            }
            
            console.log('🚨 Fallback urgency evaluation:', { level: urgencyLevel, urgency: urgencyDescription });
        }
        
        // Create the quick appointment object
        const quickAppointment = {
            id: `quick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'quick_appointment',
            status: 'pending',
            urgency: urgencyLevel,
            urgencyDescription: urgencyDescription,
            
            // Patient information
            patientName: `${appointmentData.firstName} ${appointmentData.lastName}`,
            patientEmail: appointmentData.email,
            patientPhone: appointmentData.phone,
            
            // Appointment details
            preferredDate: appointmentData.preferredDate,
            preferredTime: appointmentData.preferredTime,
            specialty: appointmentData.specialty,
            symptoms: appointmentData.symptoms,
            urgencyLevel: appointmentData.urgency,
            
            // Facility information
            facilityId: appointmentData.facility,
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            
            // Source
            source: 'quick_appointment_form'
        };
        
        console.log('📅 Created quick appointment object:', quickAppointment);
        
        // Add to a special collection for quick appointments
        const quickAppointmentsRef = collection(db, 'quickAppointments');
        const docRef = await addDoc(quickAppointmentsRef, quickAppointment);
        
        console.log('✅ Quick appointment created with ID:', docRef.id);
        
        // Also add to the facility's appointments if facility is specified
        if (appointmentData.facility && appointmentData.facility !== 'any') {
            try {
                const facilityRef = doc(db, 'facilities', appointmentData.facility);
                const facilityDoc = await getDoc(facilityRef);
                
                if (facilityDoc.exists()) {
                    const facilityData = facilityDoc.data();
                    const facilityAppointment = {
                        ...quickAppointment,
                        facilityName: facilityData.facilityInfo?.name || facilityData.name || 'Unknown Facility',
                        id: docRef.id // Use the same ID
                    };
                    
                    // Add to facility's quick appointments
                    await updateDoc(facilityRef, {
                        quickAppointments: arrayUnion(facilityAppointment),
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log('✅ Quick appointment added to facility:', appointmentData.facility);
                }
            } catch (facilityError) {
                console.warn('⚠️ Could not add to facility, but appointment was created:', facilityError);
            }
        }
        
        return {
            appointmentId: docRef.id,
            urgency: urgencyLevel,
            message: 'Quick appointment request submitted successfully!'
        };
        
    } catch (error) {
        console.error('❌ Error creating quick appointment:', error);
        throw error;
    }
}

export async function updateAppointmentUrgency(appointmentId, patientId, urgencyData, facilityId) {
  try {
    const { getFirestore, doc, updateDoc } = await import('firebase/firestore')
    const db = getFirestore()
    
    // Update the appointment document with urgency information
    const appointmentRef = doc(db, 'appointments', appointmentId)
    
    await updateDoc(appointmentRef, {
      urgency: {
        level: urgencyData.level,
        description: urgencyData.urgency,
        evaluatedAt: urgencyData.evaluatedAt,
        method: urgencyData.method
      },
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: facilityId
    })
    
    console.log(`✅ Urgency data updated for appointment ${appointmentId}`)
    return true
  } catch (error) {
    console.error('❌ Error updating appointment urgency:', error)
    throw error
  }
}

// Console log for debugging
console.log('Firestore Database Service ready - Auth and DB instances created');

// Export Firebase instances
export { app, auth, db };