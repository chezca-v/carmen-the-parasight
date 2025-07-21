// Patient Registration JavaScript - Updated for New Design
import authService, { USER_ROLES } from '../services/auth-service.js';
import authGuard from '../utils/auth-guard.js';
import { createPatientDocument } from '../services/firestoredb.js';

// Import logger for production-safe logging
import('../utils/logger.js').then(({ default: logger }) => {
    window.signUpLogger = logger;
}).catch(() => {
    // Fallback if logger not available
    window.signUpLogger = {
        info: (...args) => console.log(...args),
        error: (...args) => console.error(...args),
        warn: (...args) => console.warn(...args),
        debug: (...args) => console.log(...args)
    };
});

// Import validation utilities
import { 
    validatePatientRegistrationForm,
    validateSimplifiedSignUpForm,
    validateEmail, 
    validateName, 
    validatePhone, 
    validateAddress, 
    validateBio,
    validateDateOfBirth,
    sanitizeInput,
    escapeHtml,
    rateLimiter 
} from '../utils/validation.js';

// Import comprehensive validation schemas
import { 
    userRegistrationSchema, 
    validateData 
} from '../utils/validation-schemas.js';

// State management class for better organization
class SignUpState {
    constructor() {
        this.isProcessing = false;
        this.isRedirecting = false;
        this.redirectAttempts = 0;
        this.lastRedirectTime = 0;
        this.activeTimeouts = new Set();
        this.isInitialized = false;
    }

    setProcessing(value) {
        this.isProcessing = value;
    }

    canAttemptRedirect() {
        const now = Date.now();
        const timeSinceLastRedirect = now - this.lastRedirectTime;
        
        // Prevent rapid redirects (less than 2 seconds apart)
        if (timeSinceLastRedirect < 2000 && this.redirectAttempts > 0) {
            const logger = window.signUpLogger || console;
            logger.warn('🚨 Preventing rapid redirect attempt');
            return false;
        }
        
        // Prevent too many redirect attempts
        if (this.redirectAttempts >= 3) {
            const logger = window.signUpLogger || console;
            logger.warn('🚨 Too many redirect attempts, blocking');
            return false;
        }
        
        return !this.isRedirecting;
    }

    setRedirecting(value) {
        if (value) {
            this.redirectAttempts++;
            this.lastRedirectTime = Date.now();
        }
        this.isRedirecting = value;
    }

    addTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
    }

    clearAllTimeouts() {
        this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.activeTimeouts.clear();
    }

    reset() {
        this.isProcessing = false;
        this.isRedirecting = false;
        this.redirectAttempts = 0;
        this.lastRedirectTime = 0;
        this.clearAllTimeouts();
    }
}

// Initialize state manager
const signUpState = new SignUpState();

// Handle authentication state changes for existing users only
authService.onAuthStateChange((user, role, userData) => {
    // Only handle existing users on page load, not during active sign-up process
    if (window.location.pathname.includes('patientSign-up.html') && 
        !signUpState.isProcessing && 
        !window.isRedirecting &&
        !window.isSigningUp) {
        
        // Check if the user is logged in, has a role, and we aren't in the middle of sign-up
        if (user && role) {
            // Prevent multiple redirects
            window.isRedirecting = true;
            const logger = window.signUpLogger || console;
            logger.info(`👋 Existing user detected: ${user.email} with role ${role}. Redirecting...`);
            showSuccess('Welcome back! Redirecting to your portal...');
            
            // Small delay to allow success message to show
            setTimeout(() => {
                const redirectUrl = `${window.location.origin}/public/patientPortal.html`;
                window.location.href = redirectUrl;
            }, 1000);
        }
    }
});

// DOM Elements
let domElements = {};

// Initialize DOM elements when DOM is ready
function initializeDOMElements() {
    domElements = {
        registrationForm: document.getElementById('registrationForm'),
        registerBtn: document.getElementById('registerBtn'),
        googleSignUpBtn: document.getElementById('googleSignUp'),
        errorMessage: document.getElementById('errorMessage'),
        successMessage: document.getElementById('successMessage'),
        loadingSpinner: document.querySelector('.loading-spinner'),
        btnText: document.querySelector('.btn-text'),
        password: document.getElementById('password'),
        confirmPassword: document.getElementById('confirmPassword'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        birthDate: document.getElementById('birthDate'),
        countryCode: document.getElementById('countryCode'),
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        address: document.getElementById('address'),
        terms: document.getElementById('terms')
    };
    
    // Validate required elements
    const requiredElements = ['registrationForm', 'registerBtn', 'googleSignUpBtn', 'firstName', 'lastName', 'address', 'confirmPassword'];
    const missingElements = requiredElements.filter(name => !domElements[name]);
    
    if (missingElements.length > 0) {
        const logger = window.signUpLogger || console;
        logger.error('Missing required DOM elements:', missingElements);
        showError('Page initialization failed. Please refresh the page.');
        return false;
    }
    
    const logger = window.signUpLogger || console;
    logger.info('✅ DOM elements initialized successfully');
    return true;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    const logger = window.signUpLogger || console;
    logger.info('🚀 DOM Content Loaded');
    
    if (!initializeDOMElements()) {
        return;
    }
    
    setupEventListeners();
    signUpState.isInitialized = true;

    // Wait for the auth service to be ready
    await authService.waitForInitialization();
    logger.info('Auth service initialized.');
    
    // Check if user is already authenticated and redirect if so
    if (authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        const role = authService.getUserRole();
        if (user && role && !window.isRedirecting) {
            window.isRedirecting = true;
            logger.info('User already authenticated. Redirecting...');
            authService.redirectAfterLogin(role);
        }
    }
});

// Set up all event listeners
function setupEventListeners() {
    // Form submission handler
    domElements.registrationForm.addEventListener('submit', handleFormSubmission);
    
    // Google sign-up button handler with debouncing to prevent multiple clicks
    let isGoogleSignUpInProgress = false;
    
    domElements.googleSignUpBtn.addEventListener('click', async () => {
        if (isGoogleSignUpInProgress) {
            return; // Prevent multiple clicks
        }
        
        isGoogleSignUpInProgress = true;
        
        try {
            await handleGoogleSignUpClick();
        } finally {
            // Reset after a delay to prevent rapid clicking
            setTimeout(() => {
                isGoogleSignUpInProgress = false;
            }, 2000);
        }
    });
}

// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Simple redirect handling
function performRedirect(reason, user = null) {
    const logger = window.signUpLogger || console;
    logger.info(`Performing redirect: ${reason}`, user?.email || 'no user');
    
    // Use auth service redirect function for proper role-based routing
    setTimeout(() => {
        try {
            authService.redirectAfterLogin();
        } catch (redirectError) {
            logger.error('Redirect error:', redirectError);
            // Fallback direct redirect
            window.location.href = '/public/patientPortal.html';
        }
    }, 800);
}

// Check for authentication state on page load
window.addEventListener('load', async () => {
    try {
        // Check for redirect message from other pages (e.g., auth guard)
        const redirectMessage = sessionStorage.getItem('auth_redirect_message');
        if (redirectMessage) {
            showError(redirectMessage);
            sessionStorage.removeItem('auth_redirect_message');
        }
        
        // Check if user is already authenticated and redirect if so
        if (authService.isAuthenticated()) {
            const user = authService.getCurrentUser();
            const role = authService.getUserRole();
            if (user && role && !window.isRedirecting) {
                window.isRedirecting = true;
                const logger = window.signUpLogger || console;
                logger.info('User already authenticated. Redirecting...');
                authService.redirectAfterLogin(role);
            }
        }
    } catch (error) {
        const logger = window.signUpLogger || console;
        logger.error('Page load error:', error);
    }
});



// This class is not secure and gives a false sense of security.
// It will be removed in a future security patch.
class SecureStorage {
    // Base64 encoding is NOT encryption.
    static setItem(key, value, encrypt = true) {
        try {
            const stringValue = JSON.stringify(value);
            const encodedValue = encrypt ? btoa(stringValue) : stringValue;
            localStorage.setItem(key, encodedValue);
        } catch (error) {
            const logger = window.signUpLogger || console;
            logger.error(`Error saving to SecureStorage: ${key}`, error);
        }
    }

    static getItem(key, decrypt = true) {
        try {
            const encodedValue = localStorage.getItem(key);
            if (!encodedValue) return null;

            const stringValue = decrypt ? atob(encodedValue) : encodedValue;
            return JSON.parse(stringValue);
        } catch (error) {
            const logger = window.signUpLogger || console;
            logger.error(`Error reading from SecureStorage: ${key}`, error);
            // If decoding fails, it might be an old/invalid value. Remove it.
            localStorage.removeItem(key);
            return null;
        }
    }

    static removeItem(key) {
        localStorage.removeItem(key);
    }
}

// Generate a random, secure password
function generateSecurePassword() {
    // This is a placeholder. In a real app, you might suggest a strong password
    // or enforce stronger validation. For now, it's just for the hidden field.
    return Math.random().toString(36).slice(-10) + 'A1!';
}



// Message display utilities
function showError(message) {
    if (!domElements.errorMessage) return;
    
    domElements.errorMessage.textContent = message;
    domElements.errorMessage.style.display = 'block';
    if (domElements.successMessage) {
        domElements.successMessage.style.display = 'none';
    }
    
    // Auto-hide after 10 seconds
    const hideTimeout = setTimeout(hideMessages, 10000);
    signUpState.addTimeout(hideTimeout);
}

function showSuccess(message) {
    if (!domElements.successMessage) return;
    
    domElements.successMessage.textContent = message;
    domElements.successMessage.style.display = 'block';
    if (domElements.errorMessage) {
        domElements.errorMessage.style.display = 'none';
    }
}

function hideMessages() {
    if (domElements.errorMessage) domElements.errorMessage.style.display = 'none';
    if (domElements.successMessage) domElements.successMessage.style.display = 'none';
}

// Show field-specific error
function showFieldError(field, message) {
    if (field) {
        field.style.borderColor = '#dc3545';
        field.title = message;
        
        // Remove error styling after user starts typing
        const clearError = () => {
            field.style.borderColor = '';
            field.title = '';
            field.removeEventListener('input', clearError);
        };
        field.addEventListener('input', clearError);
    }
}

// Loading state management
function setLoading(isLoading) {
    signUpState.setProcessing(isLoading);
    
    if (domElements.registerBtn) {
        domElements.registerBtn.disabled = isLoading;
    }
    
    if (domElements.loadingSpinner) {
        domElements.loadingSpinner.style.display = isLoading ? 'block' : 'none';
    }
    
    if (domElements.btnText) {
        domElements.btnText.style.display = isLoading ? 'none' : 'block';
    }
    
    if (domElements.googleSignUpBtn) {
        domElements.googleSignUpBtn.disabled = isLoading;
    }
}

// Handle email/password registration
async function handleEmailRegistration(formData) {
    const logger = window.signUpLogger || console;
    logger.info('Starting email registration process');

    try {
        const { email, password, firstName, lastName, phone, birthDate, address } = formData;
        
        // Create user with email and password
        const userCredential = await authService.registerWithEmail(email, password, {
            displayName: `${firstName} ${lastName}`
        });
        const user = userCredential.user;
        logger.info(`User created successfully: ${user.uid}`);

        // Prepare patient data for Firestore
        const patientData = {
            uid: user.uid,
            email: email,
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            birthDate: birthDate,
            address: address,
            role: USER_ROLES.PATIENT,
            createdAt: new Date().toISOString(),
        };

        // Create a patient document in Firestore
        await createPatientDocument(user.uid, patientData);
        logger.info(`Patient document created for UID: ${user.uid}`);

        showSuccess('Registration successful! Please check your email for verification.');
        
        // Redirect to email verification page
        setTimeout(() => {
            window.location.href = '/email-verification.html';
        }, 2000);

    } catch (error) {
        logger.error('Email registration failed:', { 
            code: error.code, 
            message: error.message 
        });
        showError(getErrorMessage(error));
    } finally {
        setLoading(false);
    }
}

// Get user-friendly error message
function getErrorMessage(error) {
    if (error.message.includes('Too many failed login attempts')) {
        return error.message;
    }
    
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Please use a different email or sign in.',
        'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email registration is currently disabled. Please contact support.',
        'default': 'Registration failed. Please try again.'
    };
    
    return errorMessages[error.code] || errorMessages.default;
}

// Handle Google authentication result
async function handleGoogleAuthResult(user) {
    if (signUpState.isProcessing) {
        return;
    }
    
    try {
        signUpState.setProcessing(true);
        const logger = window.signUpLogger || console;
        logger.info('Processing Google authentication result for:', user.email);
        
        // Clear any error messages
        hideMessages();
        showSuccess('Welcome to LingapLink! Setting up your account...');
        
        // Try to create or update patient document (optional for successful login)
        try {
            const userExists = await checkIfUserExists(user.uid);
            
            if (!userExists) {
                logger.info('Attempting to create patient document for Google user');
                try {
                    await createPatientDocument(user, { 
                        authProvider: 'google',
                        firstName: user.displayName?.split(' ')[0] || '',
                        lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                        emailVerified: true
                    });
                    logger.info('Patient document created successfully');
                    showSuccess('Welcome to LingapLink! Your account has been created successfully.');
                } catch (createError) {
                    logger.warn('Could not create patient document due to permissions, but authentication successful:', createError.message);
                    showSuccess('Welcome to LingapLink! Your account has been set up successfully.');
                }
            } else {
                logger.info('Existing user found, welcoming back');
                showSuccess('Welcome back! Signing you in...');
            }
        } catch (error) {
            logger.warn('Error checking user existence, but authentication successful:', error.message);
            showSuccess('Welcome to LingapLink! Your account setup will be completed shortly.');
        }

        // Set user role and ensure auth service has the user
        authService.currentUser = user;
        authService.userRole = USER_ROLES.PATIENT;
        
        // Create a small delay to ensure auth state settles
        showSuccess('Sign-up successful! Redirecting to your portal...');
        
        // Try to wait for auth state to be properly established
        let redirectAttempts = 0;
        const maxAttempts = 5;
        
        const attemptRedirect = () => {
            redirectAttempts++;
            logger.info(`Redirect attempt ${redirectAttempts}/${maxAttempts}`);
            
            const currentUser = authService.getCurrentUser();
            const userRole = authService.getUserRole();
            const isAuthenticated = authService.isAuthenticated();
            
            logger.info('Current auth state:', {
                hasUser: !!currentUser,
                userEmail: currentUser?.email,
                userRole: userRole,
                isAuthenticated: isAuthenticated,
                userUID: currentUser?.uid
            });
            
            if (currentUser && userRole && isAuthenticated) {
                // Auth state is ready, proceed with redirect
                window.isRedirecting = true;
                const redirectUrl = `${window.location.origin}/public/patientPortal.html`;
                
                logger.info('✅ Auth state confirmed, redirecting to:', redirectUrl);
                window.location.href = redirectUrl;
                
            } else if (redirectAttempts < maxAttempts) {
                // Not ready yet, try again
                logger.info('⏳ Auth state not ready, retrying in 500ms...');
                setTimeout(attemptRedirect, 500);
                
            } else {
                // Max attempts reached, force redirect anyway
                logger.warn('🚨 Max redirect attempts reached, forcing redirect...');
                window.isRedirecting = true;
                const redirectUrl = `${window.location.origin}/public/patientPortal.html`;
                window.location.href = redirectUrl;
            }
        };
        
        // Start first attempt after a brief delay
        setTimeout(attemptRedirect, 1000);

    } catch (error) {
        const logger = window.signUpLogger || console;
        logger.error('Google auth result error:', error);
        showError('Failed to complete Google registration. Please try again.');
    } finally {
        setLoading(false);
        signUpState.setProcessing(false);
    }
}

// Check if user exists
async function checkIfUserExists(uid) {
    try {
        const { getPatientData } = await import('../services/firestoredb.js');
        const patientData = await getPatientData(uid);
        return patientData !== null;
    } catch (error) {
        const logger = window.signUpLogger || console;
        logger.error('Error checking user existence:', error);
        return false;
    }
}

// Enhanced Google auth error handling
function handleGoogleAuthError(error) {
    const logger = window.signUpLogger || console;
    logger.error('Google authentication error:', error);
    
    let errorMsg = 'Google sign-up failed. Please try again.';
    
    // Handle specific Google auth errors
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            errorMsg = 'Sign-up was cancelled. Please try again.';
            break;
        case 'auth/popup-blocked':
            errorMsg = 'Please allow popups for this site and try again.';
            break;
        case 'auth/unauthorized-domain':
            errorMsg = 'This domain is not authorized for Google sign-up.';
            break;
        case 'auth/operation-not-allowed':
            errorMsg = 'Google sign-up is not enabled. Please contact support.';
            break;
        case 'auth/network-request-failed':
            errorMsg = 'Network error. Please check your connection and try again.';
            break;
        case 'auth/account-exists-with-different-credential':
            errorMsg = 'An account already exists with this email using a different sign-in method. Please try signing in instead.';
            break;
        case 'auth/cancelled-popup-request':
            // Don't show error for cancelled popup
            return;
        default:
            if (error.message.includes('not enabled')) {
                errorMsg = 'Google Sign-Up is not enabled for this application.';
            } else if (error.message) {
                errorMsg = error.message;
            }
    }
    
    showError(errorMsg);
    
    // Log helpful debugging information
    logger.info('🔧 Google Sign-Up Debugging Information:');
    logger.info('- Error code:', error.code);
    logger.info('- Error message:', error.message);
    logger.info('- Check Firebase Console > Authentication > Sign-in method');
    logger.info('- Ensure Google provider is enabled');
    logger.info('- Check Authorized Domains includes:', window.location.hostname);
}

async function handleGoogleSignUpClick() {
    const logger = window.signUpLogger || console;
    logger.info('🚀 Google Sign-Up button clicked');
    
    if (signUpState.isProcessing) {
        logger.warn('Google sign-up ignored, another process is active.');
        return;
    }
    
    try {
        setLoading(true);
        hideMessages();
        
        // Set flag to prevent auth state listener interference
        window.isSigningUp = true;
        
        logger.info('Starting Google Sign-Up with popup...');
        showSuccess('Please complete the sign-up in the popup window...');
        
        // Perform Google sign-up with popup
        const result = await authService.loginWithGooglePopup();
        
        if (result && result.user) {
            logger.info('✅ Google sign-up successful:', result.user.email);
            
            // Handle the Google auth result
            await handleGoogleAuthResult(result.user);
        } else {
            logger.warn('⚠️ Google sign-up returned no result');
            showError('Google sign-up failed. Please try again.');
        }
        
    } catch (error) {
        logger.error('❌ Google sign-up failed:', error);
        handleGoogleAuthError(error);
    } finally {
        // Reset flags
        window.isSigningUp = false;
        
        // Only reset loading if we're not redirecting
        if (!window.isRedirecting) {
            setLoading(false);
        }
    }
}

async function handleFormSubmission(e) {
    e.preventDefault();
    const logger = window.signUpLogger || console;
    logger.info('📥 Form submitted');
    
    if (!signUpState.isInitialized) return;

    // Prevent multiple submissions
    if (signUpState.isProcessing) {
        logger.warn('Form submission ignored, already processing.');
        return;
    }

    setLoading(true);
    hideMessages();

    // Rate limit check
    if (rateLimiter('registration', 5, 60)) {
        showError('Too many attempts. Please try again in a minute.');
        setLoading(false);
        return;
    }
    
    const formData = new FormData(domElements.registrationForm);
    const formObject = Object.fromEntries(formData.entries());

    // Basic frontend check for password confirmation
    if (formObject.password !== formObject.confirmPassword) {
        showError("Passwords do not match.");
        setLoading(false);
        // Also show error on the confirmation field
        showFieldError(domElements.confirmPassword, 'Passwords do not match.');
        return;
    }

    try {
        const validationResult = validateData(formObject, userRegistrationSchema);

        if (!validationResult.isValid) {
            // Display all validation errors
            const errorMessages = Object.values(validationResult.errors).join('<br>');
            showError(errorMessages);
            // Highlight all invalid fields
            Object.keys(validationResult.errors).forEach(fieldName => {
                const field = domElements[fieldName];
                if (field) {
                    showFieldError(field, validationResult.errors[fieldName]);
                }
            });
            setLoading(false);
            return;
        }

        // Proceed with validated data
        await handleEmailRegistration(validationResult.sanitizedData);

    } catch (error) {
        logger.error('Unhandled form submission error:', error);
        showError('An unexpected error occurred. Please try again.');
        setLoading(false);
    }
}


// Cleanup timeouts on page unload
window.addEventListener('beforeunload', () => {
    signUpState.clearAllTimeouts();
});

// Initialize
console.log('✅ Patient Registration page loaded');
console.log('Current domain:', window.location.hostname);
