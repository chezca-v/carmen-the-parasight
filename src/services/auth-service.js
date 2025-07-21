// Comprehensive Authentication Service
// Handles session management, email verification, and role-based access control

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    updateProfile,
    sendEmailVerification,
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser,
    reload
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    collection
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';

// Import Firebase configuration
import { firebaseConfig } from './config.js';
import logger from '../utils/logger.js';
import * as secureErrorHandler from './secure-error-handler.js';
import { handleAuthError } from './auth-error-handler.js';

// Initialize Firebase (avoid duplicate initialization)
let app;
let auth;
let db;

try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        logger.info('Firebase initialized by Auth Service');
    } else {
        app = getApp();
        logger.info('Using existing Firebase instance');
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    
} catch (error) {
    logger.error('Firebase initialization error:', error);
    throw error;
}

// Configure Google Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Session management constants
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// User roles
const USER_ROLES = {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    NURSE: 'nurse', 
    PATIENT: 'patient',
    CLINIC_STAFF: 'clinic_staff',
    // New B2B roles
    ORGANIZATION_ADMIN: 'organization_admin',
    ORGANIZATION_MEMBER: 'organization_member',
    SYSTEM_ADMIN: 'system_admin'
};

// Secure session storage keys - using sessionStorage for non-sensitive data only
const SECURE_SESSION_KEYS = {
    SESSION_START: 'auth_session_start',
    LAST_ACTIVITY: 'auth_last_activity',
    LOGIN_ATTEMPTS: 'auth_login_attempts', // Keep in localStorage for security (rate limiting)
    LOCKOUT_UNTIL: 'auth_lockout_until'     // Keep in localStorage for security (rate limiting)
};

// In-memory storage for sensitive data (cleared on page refresh)
class SecureSessionManager {
    constructor() {
        this.sensitiveData = new Map();
        this.sessionActive = false;
    }

    // Store sensitive data in memory only
    setSensitiveData(key, value) {
        this.sensitiveData.set(key, value);
    }

    getSensitiveData(key) {
        return this.sensitiveData.get(key);
    }

    clearSensitiveData() {
        this.sensitiveData.clear();
        this.sessionActive = false;
    }

    isSessionActive() {
        return this.sessionActive && this.sensitiveData.size > 0;
    }

    setSessionActive(active) {
        this.sessionActive = active;
    }
}

const secureSession = new SecureSessionManager();

/**
 * Authentication Service Class
 */
class AuthService {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.sessionTimer = null;
        this.warningTimer = null;
        this.authListeners = [];
        this.sessionListeners = [];
        this.authPopupWindow = null; // Track popup window
        this.isInitialized = false;
        this.initializationPromise = new Promise(resolve => {
            this.resolveInitialization = resolve;
        });
        
        // Initialize session management
        this.initializeSessionManagement();
        
        // Set up auth state listener
        this.setupAuthStateListener();
        
        // Set up popup cleanup on page unload
        this.setupPopupCleanup();
        
        logger.info('Authentication Service initialized');
    }

    /**
     * Setup popup cleanup on page unload
     */
    setupPopupCleanup() {
        // Close popup when page unloads
        window.addEventListener('beforeunload', () => {
            this.closeAuthPopup();
        });
        
        // Listen for messages to close popups
        window.addEventListener('message', (event) => {
            if (event.origin === window.location.origin && event.data?.type === 'CLOSE_AUTH_POPUP') {
                this.closeAuthPopup();
            }
        });
    }

    /**
     * Close auth popup window if open
     */
    closeAuthPopup() {
        try {
            if (this.authPopupWindow && !this.authPopupWindow.closed) {
                logger.info('Closing auth popup window');
                this.authPopupWindow.close();
                this.authPopupWindow = null;
            }
            
            // Also close any global auth popup reference
            if (window.authPopup && !window.authPopup.closed) {
                window.authPopup.close();
                window.authPopup = null;
            }
        } catch (error) {
            logger.warn('Error closing auth popup:', error);
        }
    }
    
    /**
     * Waits for the auth service to complete its initial authentication check.
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return Promise.resolve();
        }
        return this.initializationPromise;
    }

    /**
     * Initialize secure session management
     */
    initializeSessionManagement() {
        // Check for existing session using sessionStorage (non-persistent)
        const sessionStart = sessionStorage.getItem(SECURE_SESSION_KEYS.SESSION_START);
        const lastActivity = sessionStorage.getItem(SECURE_SESSION_KEYS.LAST_ACTIVITY);
        
        if (sessionStart && lastActivity) {
            const now = Date.now();
            const sessionAge = now - parseInt(sessionStart);
            const timeSinceActivity = now - parseInt(lastActivity);
            
            // Check if session has expired
            if (sessionAge > SESSION_TIMEOUT || timeSinceActivity > SESSION_TIMEOUT) {
                this.clearSession();
                this.redirectToLogin('Session expired. Please login again.');
                return;
            }
            
            // Update last activity
            this.updateLastActivity();
        }
        
        // Set up activity tracking
        this.setupActivityTracking();
    }

    /**
     * Set up activity tracking
     */
    setupActivityTracking() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            }, { passive: true });
        });
    }

    /**
     * Update last activity timestamp (non-sensitive data in sessionStorage)
     */
    updateLastActivity() {
        sessionStorage.setItem(SECURE_SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
        
        // Reset session timer
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }
        
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
        }
        
        // Set up session warning
        this.warningTimer = setTimeout(() => {
            this.showSessionWarning();
        }, SESSION_TIMEOUT - SESSION_WARNING_TIME);
        
        // Set up session timeout
        this.sessionTimer = setTimeout(() => {
            this.handleSessionTimeout();
        }, SESSION_TIMEOUT);
    }

    /**
     * Show session warning
     */
    showSessionWarning() {
        const proceed = confirm('Your session will expire in 5 minutes. Click OK to continue your session.');
        
        if (proceed) {
            this.updateLastActivity();
        } else {
            this.logout();
        }
    }

    /**
     * Handle session timeout
     */
    handleSessionTimeout() {
        this.clearSession();
        this.logout();
        this.redirectToLogin('Your session has expired. Please login again.');
    }

    /**
     * Set up auth state listener
     */
    setupAuthStateListener() {
        onAuthStateChanged(auth, async (user) => {
            logger.info('Auth state change detected.', { providedUser: !!user });
            
            if (user) {
                // User is signed in.
                const userIsValid = await this.validateUserSession(user);
                if (userIsValid) {
                    await this.loadUserData(user);
                } else {
                    // If user session is invalid (e.g., banned), sign them out.
                    await this.logout();
                    return; // Stop processing
                }
            } else {
                // User is signed out.
                this.clearSession();
            }

            // Notify listeners about the auth state change
            this.notifyAuthListeners(this.currentUser, this.userRole);

            // Resolve the initialization promise now that the first check is complete
            if (!this.isInitialized) {
                this.isInitialized = true;
                this.resolveInitialization();
                logger.info('Auth Service has completed initial state check.');
            }
        });
    }

    /**
     * Validate user session (check if user is not banned, etc.)
     */
    async validateUserSession(user) {
        if (!user || !user.uid) {
            return false;
        }

        try {
            // For now, just return true as we don't have ban/restriction logic
            // In the future, this could check for banned users, account restrictions, etc.
            return true;
        } catch (error) {
            logger.error('Error validating user session:', error);
            return false;
        }
    }

    /**
     * Check if email verification is required
     */
    requireEmailVerification() {
        // Disable email verification requirement if configured
        return true; // Can be made configurable
    }

    /**
     * Handle unverified email
     */
    async handleUnverifiedEmail(user) {
        await signOut(auth);
        this.showEmailVerificationMessage(user.email);
        this.redirectToLogin('Please verify your email before signing in.');
    }

    /**
     * Show email verification message
     */
    showEmailVerificationMessage(email) {
        const message = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="color: #0c4a6e; margin: 0 0 8px 0;">📧 Email Verification Required</h3>
                <p style="color: #075985; margin: 0;">
                    Please check your email (${email}) and click the verification link before signing in.
                </p>
                <p style="color: #075985; margin: 8px 0 0 0; font-size: 0.9em;">
                    Didn't receive the email? Check your spam folder or try signing up again.
                </p>
            </div>
        `;
        
        // Try to show in an existing container or create alert
        const container = document.getElementById('auth-messages') || document.getElementById('error-container');
        if (container) {
            container.innerHTML = message;
            container.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Fallback to alert
            alert(`Please verify your email (${email}) before signing in.`);
        }
    }

    /**
     * Load user data and role from Firestore
     */
    async loadUserData(user) {
        if (!user) {
            this.clearSession();
            return null;
        }

        try {
            this.currentUser = user;
            this.userRole = USER_ROLES.PATIENT; // Default role

            try {
                const userDocRef = doc(db, 'patients', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    this.userRole = userData.role || USER_ROLES.PATIENT;
                    logger.info('User data loaded successfully from Firestore');
                } else {
                    // Try to create user document, but don't fail if it doesn't work
                    try {
                        this.userRole = await this.createUserDocument(user);
                        logger.info('New user document created successfully');
                    } catch (createError) {
                        logger.warn('Could not create user document, using default role:', createError.message);
                        // Continue with default role
                    }
                }
            } catch (firestoreError) {
                logger.warn('Firestore access error, continuing with default role:', firestoreError.message);
                // Continue with default patient role even if Firestore access fails
            }
            
            this.startSecureSession(user);
            this.notifyAuthListeners(user, this.userRole);
            return this.userRole;

        } catch (error) {
            logger.error('Critical error in loadUserData:', error);
            // Don't clear session completely for new users, just set defaults
            this.currentUser = user;
            this.userRole = USER_ROLES.PATIENT;
            this.startSecureSession(user);
            this.notifyAuthListeners(user, this.userRole);
            return this.userRole;
        }
    }

    /**
     * Create user document in Firestore
     */
    async createUserDocument(user) {
        const userDocRef = doc(db, 'patients', user.uid);
        const newUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'New Patient',
            role: USER_ROLES.PATIENT,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
        };
        
        try {
            await setDoc(userDocRef, newUser);
            logger.info('New patient document created for:', user.email);
            return newUser.role;
        } catch (error) {
            logger.warn('Could not create user document in Firestore:', error.message);
            // Don't throw error, return default role so auth can continue
            return USER_ROLES.PATIENT;
        }
    }

    /**
     * Update patient last login
     */
    async updatePatientLastLogin(userId) {
        const userDocRef = doc(db, 'patients', userId);
        try {
            await updateDoc(userDocRef, {
                lastLoginAt: serverTimestamp()
            });
        } catch (error) {
            logger.warn('Could not update last login:', error);
        }
    }

    /**
     * Start secure session (minimal data in sessionStorage, sensitive data in memory)
     */
    startSecureSession(user) {
        const now = Date.now();
        
        // Store only non-sensitive session timing data in sessionStorage
        sessionStorage.setItem(SECURE_SESSION_KEYS.SESSION_START, now.toString());
        sessionStorage.setItem(SECURE_SESSION_KEYS.LAST_ACTIVITY, now.toString());
        
        // Store sensitive data in memory only (cleared on page refresh/close)
        secureSession.setSensitiveData('userId', user.uid);
        secureSession.setSensitiveData('userEmail', user.email);
        secureSession.setSensitiveData('emailVerified', user.emailVerified);
        secureSession.setSessionActive(true);
        
        // Initialize CSRF token for the session
        if (window.csrfService && window.csrfService.fetchToken) {
            window.csrfService.fetchToken().catch(error => {
                logger.warn('Failed to initialize CSRF token:', error.message);
            });
        }
        
        // Set up session management
        this.updateLastActivity();
        
        logger.info('🔒 Secure session started for user');
    }

    /**
     * Clear session (both sessionStorage and memory)
     */
    clearSession() {
        // Clear session timers
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
            this.warningTimer = null;
        }
        
        // Clear non-sensitive session data from sessionStorage
        Object.values(SECURE_SESSION_KEYS).forEach(key => {
            if (key !== SECURE_SESSION_KEYS.LOGIN_ATTEMPTS && key !== SECURE_SESSION_KEYS.LOCKOUT_UNTIL) {
                sessionStorage.removeItem(key);
            }
        });
        
        // Clear CSRF tokens
        if (window.csrfService && window.csrfService.logout) {
            window.csrfService.logout();
        }
        
        // Clear sensitive data from memory
        secureSession.clearSensitiveData();
        
        logger.info('🔒 Secure session cleared');
    }

    /**
     * Force clear all authentication state (for troubleshooting)
     */
    forceClearAuthState() {
        logger.debug(' Force clearing all authentication state');
        
        // Clear internal state
        this.currentUser = null;
        this.userRole = null;
        
        // Clear session
        this.clearSession();
        
        // Clear any additional auth-related storage items (non-sensitive only)
        const nonSensitiveKeys = [
            'auth_redirect_message',
            'auth_return_url'
        ];
        
        nonSensitiveKeys.forEach(key => {
            if (sessionStorage.getItem(key)) {
                sessionStorage.removeItem(key);
                logger.debug(`🧹 Cleared sessionStorage key: ${key}`);
            }
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                logger.debug(`🧹 Cleared localStorage key: ${key}`);
            }
        });
        
        // Reset redirect flags
        if (typeof window !== 'undefined') {
            window.isRedirecting = false;
            window.redirectCount = 0;
            window.lastRedirectTime = 0;
        }
        
        logger.info(' All authentication state cleared');
    }

    /**
     * Check if user is locked out (keep rate limiting in localStorage for security)
     */
    isLockedOut() {
        const lockoutUntil = localStorage.getItem(SECURE_SESSION_KEYS.LOCKOUT_UNTIL);
        if (lockoutUntil) {
            const now = Date.now();
            const lockoutTime = parseInt(lockoutUntil);
            
            if (now < lockoutTime) {
                return true;
            } else {
                // Lockout expired, clear it
                localStorage.removeItem(SECURE_SESSION_KEYS.LOCKOUT_UNTIL);
                localStorage.removeItem(SECURE_SESSION_KEYS.LOGIN_ATTEMPTS);
                return false;
            }
        }
        return false;
    }

    /**
     * Track login attempts (keep in localStorage for security - rate limiting across sessions)
     */
    trackLoginAttempt(success = false) {
        if (success) {
            // Clear login attempts on success
            localStorage.removeItem(SECURE_SESSION_KEYS.LOGIN_ATTEMPTS);
            localStorage.removeItem(SECURE_SESSION_KEYS.LOCKOUT_UNTIL);
            return;
        }
        
        // Increment failed attempts
        const attempts = parseInt(localStorage.getItem(SECURE_SESSION_KEYS.LOGIN_ATTEMPTS) || '0') + 1;
        localStorage.setItem(SECURE_SESSION_KEYS.LOGIN_ATTEMPTS, attempts.toString());
        
        // Check if max attempts reached
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_DURATION;
            localStorage.setItem(SECURE_SESSION_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
            
            throw new Error(`Too many failed login attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`);
        }
        
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
        throw new Error(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
    }

    /**
     * Login with email and password
     */
    async loginWithEmail(email, password) {
        try {
            if (this.isLockedOut()) {
                throw new Error('Account locked due to too many failed login attempts. Please wait 15 minutes.');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (user) {
                this.trackLoginAttempt(true);
                await this.loadUserData(user);
                return user;
            }
        } catch (error) {
            this.trackLoginAttempt(false);
            throw handleAuthError(error);
        }
    }

    async loginWithGooglePopup() {
        try {
            this.closeAuthPopup();
            // The onAuthStateChanged listener will handle loading user data.
            // This function's only job is to trigger the popup.
            return await signInWithPopup(auth, googleProvider);
        } catch (error) {
            throw handleAuthError(error);
        }
    }

    /**
     * Register with email and password
     */
    async registerWithEmail(email, password, userData = {}) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update profile if display name provided
            if (userData.displayName) {
                await updateProfile(user, {
                    displayName: userData.displayName
                });
            }
            
            // Send email verification
            await sendEmailVerification(user);
            
            // Create user document
            await this.createUserDocument(user);
            
            // Sign out until email is verified
            await signOut(auth);
            
            // Registration successful, verification email sent
            return user;
            
        } catch (error) {
            logger.error('Registration error:', error);
            this.clearSession();
            throw handleAuthError(error);
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await signOut(auth);
            this.clearSession();
            // Logout successful
            
        } catch (error) {
            logger.error('Logout error:', error);
            throw error;
        }
    }

    /**
     * Update user password
     */
    async updateUserPassword(currentPassword, newPassword) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user');
            }
            
            // Re-authenticate user
            const credential = EmailAuthProvider.credential(this.currentUser.email, currentPassword);
            await reauthenticateWithCredential(this.currentUser, credential);
            
            // Update password
            await updatePassword(this.currentUser, newPassword);
            
            // Password updated successfully
            
        } catch (error) {
            logger.error('Password update error:', error);
            throw error;
        }
    }

    /**
     * Delete user account
     */
    async deleteAccount(password) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user');
            }
            
            // Re-authenticate user
            const credential = EmailAuthProvider.credential(this.currentUser.email, password);
            await reauthenticateWithCredential(this.currentUser, credential);
            
            // Delete user document
            await deleteDoc(doc(db, 'users', this.currentUser.uid));
            
            // Delete patient document if exists
            try {
                await deleteDoc(doc(db, 'patients', this.currentUser.uid));
            } catch (error) {
                // No patient document to delete
            }
            
            // Delete user account
            await deleteUser(this.currentUser);
            
            this.clearSession();
            // Account deleted successfully
            
        } catch (error) {
            logger.error('Account deletion error:', error);
            throw error;
        }
    }

    /**
     * Update user role (admin only)
     */
    async updateUserRole(userId, newRole) {
        try {
            // Check if current user is admin
            if (this.userRole !== USER_ROLES.ADMIN) {
                throw new Error('Insufficient permissions');
            }
            
            // Validate role
            if (!Object.values(USER_ROLES).includes(newRole)) {
                throw new Error('Invalid role');
            }
            
            // Update user document
            await updateDoc(doc(db, 'users', userId), {
                role: newRole,
                roleUpdatedAt: serverTimestamp(),
                roleUpdatedBy: this.currentUser.uid
            });
            
            // User role updated
            
        } catch (error) {
            logger.error('Role update error:', error);
            throw error;
        }
    }

    /**
     * Check if user has required role
     */
    hasRole(requiredRole) {
        if (Array.isArray(requiredRole)) {
            return requiredRole.includes(this.userRole);
        }
        return this.userRole === requiredRole;
    }

    /**
     * Check if user has permission
     */
    hasPermission(permission) {
        const rolePermissions = {
            [USER_ROLES.SYSTEM_ADMIN]: ['all'],
            [USER_ROLES.ADMIN]: ['all'],
            [USER_ROLES.ORGANIZATION_ADMIN]: ['manage_organization', 'read_organization_patients', 'write_organization_patients', 'manage_staff', 'read_appointments', 'write_appointments'],
            [USER_ROLES.DOCTOR]: ['read_patients', 'write_patients', 'read_appointments', 'write_appointments'],
            [USER_ROLES.NURSE]: ['read_patients', 'read_appointments', 'write_appointments'],
            [USER_ROLES.CLINIC_STAFF]: ['read_appointments', 'write_appointments'],
            [USER_ROLES.ORGANIZATION_MEMBER]: ['read_organization_patients', 'read_appointments', 'write_appointments'],
            [USER_ROLES.PATIENT]: ['read_own_data', 'write_own_data']
        };
        
        const userPermissions = rolePermissions[this.userRole] || [];
        return userPermissions.includes('all') || userPermissions.includes(permission);
    }

    /**
     * Get current user with validation
     */
    getCurrentUser() {
        // Validate that our stored user matches Firebase's current user
        const firebaseCurrentUser = auth.currentUser;
        
        if (!this.currentUser && firebaseCurrentUser) {
            logger.debug(' Firebase user found but not in auth service, syncing...');
            this.currentUser = firebaseCurrentUser;
            return firebaseCurrentUser;
        }
        
        if (this.currentUser && !firebaseCurrentUser) {
            logger.warn(' Auth service has user but Firebase doesn\'t, clearing...');
            this.currentUser = null;
            this.userRole = null;
            return null;
        }
        
        if (this.currentUser && firebaseCurrentUser && this.currentUser.uid !== firebaseCurrentUser.uid) {
            logger.warn(' User UID mismatch, clearing auth state');
            this.currentUser = null;
            this.userRole = null;
            return null;
        }
        
        return this.currentUser;
    }

    /**
     * Get user role
     */
    getUserRole() {
        return this.userRole;
    }

    /**
     * Check if user is authenticated with proper session validation
     */
    isAuthenticated() {
        // Check if we have a current user and they have a valid UID
        if (!this.currentUser || !this.currentUser.uid) {
            return false;
        }
        
        // Check if the Firebase auth state is consistent
        const firebaseCurrentUser = auth.currentUser;
        if (!firebaseCurrentUser || firebaseCurrentUser.uid !== this.currentUser.uid) {
            logger.warn(' Auth state mismatch detected, clearing current user');
            this.currentUser = null;
            this.userRole = null;
            return false;
        }
        
        return true;
    }

    /**
     * Add auth state listener
     */
    onAuthStateChange(callback) {
        this.authListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.authListeners.indexOf(callback);
            if (index > -1) {
                this.authListeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify auth listeners
     */
    notifyAuthListeners(user, role) {
        this.authListeners.forEach(callback => {
            try {
                callback(user, role);
            } catch (error) {
                logger.error('Auth listener error:', error);
            }
        });
    }

    /**
     * Redirect to login
     */
    redirectToLogin(message = '') {
        if (message) {
            sessionStorage.setItem('auth_message', message);
        }
        
        // Determine redirect URL based on current location
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('admin')) {
            window.location.href = '/admin/login.html';
        } else if (currentPath.includes('doctor')) {
            window.location.href = '/doctor/login.html';
        } else {
            window.location.href = '/public/patientSign-in.html';
        }
    }

    /**
     * Redirect after login based on role
     */
    redirectAfterLogin(role) {
        const userRole = role || this.userRole;
        logger.debug('Redirecting after login with role:', userRole);
        
        // Ensure we have a valid user and role
        if (!this.currentUser || !userRole) {
            logger.warn('No user or role found, defaulting to patient portal');
            // Fallback to patient role if needed
            const finalRole = userRole || USER_ROLES.PATIENT;
            this.redirectAfterLogin(finalRole);
            return;
        }
        
        // Set redirect flag to prevent interference
        window.isRedirecting = true;
        
        let redirectUrl;
        switch (userRole) {
            case USER_ROLES.SYSTEM_ADMIN:
                redirectUrl = '/admin/system-dashboard.html';
                break;
            case USER_ROLES.ADMIN:
                redirectUrl = '/admin/dashboard.html';
                break;
            case USER_ROLES.ORGANIZATION_ADMIN:
                redirectUrl = '/business/organization-dashboard.html';
                break;
            case USER_ROLES.ORGANIZATION_MEMBER:
                redirectUrl = '/business/member-dashboard.html';
                break;
            case USER_ROLES.DOCTOR:
                redirectUrl = '/doctor/dashboard.html';
                break;
            case USER_ROLES.NURSE:
                redirectUrl = '/nurse/dashboard.html';
                break;
            case USER_ROLES.CLINIC_STAFF:
                redirectUrl = '/staff/dashboard.html';
                break;
            case USER_ROLES.PATIENT:
                redirectUrl = '/public/patientPortal.html';
                break;
            default:
                redirectUrl = '/public/patientPortal.html';
        }
        
        logger.debug(' Redirecting to:', redirectUrl);
        
        // Perform redirect with delay to ensure auth state is stable
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 500);
    }

    /**
     * Get session info
     */
    getSessionInfo() {
        const sessionStart = sessionStorage.getItem(SECURE_SESSION_KEYS.SESSION_START);
        const lastActivity = sessionStorage.getItem(SECURE_SESSION_KEYS.LAST_ACTIVITY);
        
        if (!sessionStart || !lastActivity) {
            return null;
        }
        
        const now = Date.now();
        const sessionAge = now - parseInt(sessionStart);
        const timeSinceActivity = now - parseInt(lastActivity);
        
        return {
            sessionStart: parseInt(sessionStart),
            lastActivity: parseInt(lastActivity),
            sessionAge,
            timeSinceActivity,
            timeRemaining: SESSION_TIMEOUT - timeSinceActivity
        };
    }

    /**
     * Sign in with Google using a redirect flow.
     */
    async signInWithGoogle() {
        logger.info('Attempting Google sign-in with redirect');

        if (this.isLockedOut()) {
            logger.warn('Google sign-in blocked due to account lockout.');
            const error = new Error('Your account is temporarily locked due to too many failed login attempts.');
            error.code = 'auth/too-many-requests';
            throw error;
        }

        try {
            await signInWithRedirect(auth, googleProvider);
            // No need to return anything here, as the page will redirect.
            // The result is handled by getRedirectResult() on the destination page.
        } catch (error) {
            logger.error('Google sign-in redirect error:', error);
            // Let the caller handle the UI feedback for the error.
            throw handleAuthError(error);
        }
    }
}

// Create singleton instance
const authService = new AuthService();

// Export service and constants
export { authService as default, AuthService, USER_ROLES, SECURE_SESSION_KEYS, auth };

// Authentication Service module loaded 