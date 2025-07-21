// Patient Sign In JavaScript
import authService, { USER_ROLES } from '../services/auth-service.js';
import authGuard from '../utils/auth-guard.js';
import { createPatientDocument } from '../services/firestoredb.js';

// Import validation utilities
import { 
    validateEmail,
    sanitizeInput,
    escapeHtml,
    rateLimiter 
} from '../utils/validation.js';

// Create fallback logger if import fails
let logger;
try {
    const loggerModule = await import('../utils/logger.js');
    logger = loggerModule.default;
} catch (error) {
    logger = {
        info: (...args) => console.log(...args),
        error: (...args) => console.error(...args),
        warn: (...args) => console.warn(...args),
        debug: (...args) => console.log(...args)
    };
}

// Set global logger for use in other functions
window.signInLogger = logger;

// Log initialization
logger.info('Patient Sign In initialized');

// DOM Elements
const signinForm = document.getElementById('signinForm');
const signinBtn = document.getElementById('signinBtn');
const googleSignInBtn = document.getElementById('googleSignIn');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const loadingSpinner = document.querySelector('.loading-spinner');
const btnText = document.querySelector('.btn-text');

// Handle redirection after successful login and data loading
authService.onAuthStateChange((user, role, userData) => {
    // Only redirect if the user is on the sign-in page
    if (window.location.pathname.includes('patientSign-in.html')) {
        // Check if the user is logged in, has a role, and we aren't already redirecting
        if (user && role && !window.isRedirecting) {
            // Prevent multiple redirects
            window.isRedirecting = true;
            logger.info(`Auth state confirmed for ${user.email} with role ${role}. Redirecting...`);
            showSuccess('Sign-in successful! Redirecting to your portal...');
            
            // Small delay to allow success message to show
            setTimeout(() => {
                authService.redirectAfterLogin(role);
            }, 1000);
        }
    }
});

// Check for authentication state and redirect messages
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
                logger.info('User already authenticated. Redirecting...');
                authService.redirectAfterLogin(role);
            }
        }
    } catch (error) {
        logger.error('Page load error:', error);
    }
});

// Form validation for sign-in
function validateSignInForm(formData) {
    // Check rate limiting first
    const userKey = formData.email || 'anonymous';
    if (!rateLimiter.isAllowed(userKey, 5, 60000)) {
        return { valid: false, errors: ['Too many sign-in attempts. Please wait 1 minute before trying again.'] };
    }

    const errors = [];
    
    // Sanitize inputs
    const email = sanitizeInput(formData.email);
    const password = formData.password; // Don't sanitize password

    // Validate email
    if (!email) {
        errors.push('Email is required');
    } else if (!validateEmail(email)) {
        errors.push('Please enter a valid email address');
    }

    // Validate password
    if (!password) {
        errors.push('Password is required');
    } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { 
        valid: true, 
        sanitizedData: { 
            email, 
            password 
        } 
    };
}

// Show/hide messages
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    // Auto-hide error after 10 seconds
    setTimeout(() => {
        hideMessages();
    }, 10000);
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Loading state management
function setLoading(isLoading) {
    if (isLoading) {
        signinBtn.disabled = true;
        loadingSpinner.style.display = 'block';
        btnText.style.display = 'none';
        googleSignInBtn.disabled = true;
    } else {
        signinBtn.disabled = false;
        loadingSpinner.style.display = 'none';
        btnText.style.display = 'block';
        googleSignInBtn.disabled = false;
    }
}

// Handle email/password sign-in
async function handleEmailSignIn(formData) {
    try {
        setLoading(true);
        hideMessages();

        // Validate form data
        const validationResult = validateSignInForm(formData);
        if (!validationResult.valid) {
            showError(validationResult.errors[0]);
            return;
        }

        const { email, password } = validationResult.sanitizedData;

        // Sign in with auth service
        const user = await authService.loginWithEmail(email, password);

        if (user) {
            if (user.emailVerified) {
                showSuccess('Sign in successful! Welcome back!');
                
                // Redirect after a short delay
                setTimeout(() => {
                    authService.redirectAfterLogin();
                }, 1500);
            } else {
                showError('Please verify your email before signing in. Check your inbox for the verification link.');
                
                // Redirect to email verification page
                setTimeout(() => {
                    window.location.href = '/email-verification.html';
                }, 3000);
            }
        }

    } catch (error) {
        logger.error('Sign in error:', error);
        
        let errorMsg = 'Sign in failed. Please try again.';
        
        if (error.message.includes('Too many failed login attempts')) {
            errorMsg = error.message;
        } else {
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMsg = 'No account found with this email address. Please check your email or sign up.';
                    break;
                case 'auth/wrong-password':
                    errorMsg = 'Incorrect password. Please try again or reset your password.';
                    break;
                case 'auth/invalid-email':
                    errorMsg = 'Please enter a valid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMsg = 'This account has been disabled. Please contact support.';
                    break;
                case 'auth/too-many-requests':
                    errorMsg = 'Too many failed attempts. Please try again later or reset your password.';
                    break;
                case 'auth/network-request-failed':
                    errorMsg = 'Network error. Please check your internet connection and try again.';
                    break;
                case 'auth/invalid-credential':
                    errorMsg = 'Invalid email or password. Please check your credentials and try again.';
                    break;
                default:
                    errorMsg = error.message || errorMsg;
            }
        }
        
        showError(errorMsg);
    } finally {
        setLoading(false);
    }
}

// Handle Google sign-in
async function handleGoogleSignIn() {
    try {
        setLoading(true);
        hideMessages();

        logger.info('Starting Google Sign-In with popup...');
        showSuccess('Please complete the sign-in in the popup window...');
        
        // Perform Google sign-in
        const result = await authService.loginWithGooglePopup();
        
        if (result && result.user) {
            logger.info('Google sign-in successful:', result.user.email);
            
            // Check if email is verified (Google users are automatically verified)
            if (result.user.emailVerified) {
                showSuccess('Google sign-in successful! Loading your account...');
                // The onAuthStateChange listener will handle redirection
            } else {
                // This shouldn't happen with Google, but handle it just in case
                showError('Email verification required. Please verify your email and try again.');
                setLoading(false);
            }
        }

    } catch (error) {
        setLoading(false);
        logger.error('Google sign-in failed:', error);
        handleGoogleAuthError(error);
    }
}

// Handle Google authentication errors
function handleGoogleAuthError(error) {
    logger.error('Google authentication error:', error);
    
    let errorMsg = 'Google sign-in failed. Please try again.';
    
    // Handle specific Google auth errors
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            errorMsg = 'Sign-in was cancelled. Please try again.';
            break;
        case 'auth/popup-blocked':
            errorMsg = 'Please allow popups for this site and try again.';
            break;
        case 'auth/unauthorized-domain':
            errorMsg = 'This domain is not authorized for Google sign-in.';
            break;
        case 'auth/operation-not-allowed':
            errorMsg = 'Google sign-in is not enabled. Please contact support.';
            break;
        case 'auth/network-request-failed':
            errorMsg = 'Network error. Please check your connection and try again.';
            break;
        default:
            if (error.message.includes('not enabled')) {
                errorMsg = 'Google Sign-In is not enabled for this application.';
            } else if (error.message) {
                errorMsg = error.message;
            }
    }
    
    showError(errorMsg);
    
    // Log helpful debugging information
    logger.info('🔧 Google Sign-In Debugging Information:');
    logger.info('- Error code:', error.code);
    logger.info('- Error message:', error.message);
    logger.info('- Check Firebase Console > Authentication > Sign-in method');
    logger.info('- Ensure Google provider is enabled');
    logger.info('- Check Authorized Domains includes:', window.location.hostname);
}

// Handle forgot password
async function handleForgotPassword() {
    const emailInput = document.getElementById('email');
    const email = sanitizeInput(emailInput.value.trim());
    
    if (!email) {
        showError('Please enter your email address first, then click "Forgot your password?"');
        emailInput.focus();
        return;
    }
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        emailInput.focus();
        return;
    }

    // Rate limiting for forgot password requests - very strict
    const userKey = `forgot_password_${email}`;
    if (!rateLimiter.isAllowed(userKey, 2, 300000)) { // 2 attempts per 5 minutes
        showError('Too many password reset requests. Please wait 5 minutes before trying again.');
        return;
    }
    
    try {
        // Import Firebase auth functions for password reset
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js');
        
        // Get auth instance from auth service
        const auth = authService.getCurrentUser()?.auth || (await import('./auth-service.js')).auth;
        
        if (!auth) {
            // If we can't get auth instance, use direct Firebase
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js');
            const { firebaseConfig } = await import('../services/config.js');
            
            const app = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(app);
            
            await sendPasswordResetEmail(firebaseAuth, email);
        } else {
            await sendPasswordResetEmail(auth, email);
        }
        
        showSuccess(`Password reset email sent to ${email}. Please check your inbox and follow the instructions.`);
        
    } catch (error) {
        logger.error('Password reset error:', error);
        
        let errorMsg = 'Failed to send password reset email. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email address. Please check your email or sign up.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many requests. Please wait before requesting another password reset email.';
                break;
            default:
                errorMsg = error.message || errorMsg;
        }
        
        showError(errorMsg);
    }

    // Auto-focus first input for accessibility
    document.getElementById('email').focus();
}

// Form submission handler
signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(signinForm);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    await handleEmailSignIn(data);
});

// Google sign-in button handler with debouncing
let isGoogleSignInInProgress = false;

googleSignInBtn.addEventListener('click', async () => {
    if (isGoogleSignInInProgress) {
        return; // Prevent multiple clicks
    }
    
    isGoogleSignInInProgress = true;
    
    try {
        await handleGoogleSignIn();
    } finally {
        // Reset after a delay to prevent rapid clicking
        setTimeout(() => {
            isGoogleSignInInProgress = false;
        }, 2000);
    }
});

// Forgot password link handler
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleForgotPassword();
});

// Enhanced form field validation
document.querySelectorAll('input[required]').forEach(field => {
    field.addEventListener('blur', function() {
        if (!this.value.trim()) {
            this.style.borderColor = '#dc3545';
        } else {
            this.style.borderColor = '';
        }
    });

    field.addEventListener('input', function() {
        if (this.style.borderColor === 'rgb(220, 53, 69)') {
            this.style.borderColor = '';
        }
    });
});

// Console log for debugging
logger.info('Patient Sign In page loaded');
logger.info('Current domain:', window.location.hostname);
logger.info('Firebase Auth configured for sign-in');
