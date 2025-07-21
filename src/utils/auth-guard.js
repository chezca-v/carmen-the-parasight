// Authentication Guard
// Provides route protection and role-based access control

import authService, { USER_ROLES } from '../services/auth-service.js';

// Global redirect manager to prevent conflicts
class GlobalRedirectManager {
    constructor() {
        this.isRedirecting = false;
        this.redirectCount = 0;
        this.maxRedirects = 3;
        this.redirectCooldown = 3000; // 3 seconds
        this.lastRedirectTime = 0;
        this.redirectTimeouts = new Set();
        
        // Set up global variables
        window.isRedirecting = false;
        window.redirectCount = 0;
        window.lastRedirectTime = 0;
    }
    
    canRedirect() {
        const now = Date.now();
        const timeSinceLastRedirect = now - this.lastRedirectTime;
        
        // Check cooldown period
        if (timeSinceLastRedirect < this.redirectCooldown) {
            console.log('🚫 Global: Redirect blocked - cooldown period');
            return false;
        }
        
        // Check max redirects
        if (this.redirectCount >= this.maxRedirects) {
            console.log('🚫 Global: Redirect blocked - max redirects exceeded');
            return false;
        }
        
        // Check if already redirecting
        if (this.isRedirecting || window.isRedirecting) {
            console.log('🚫 Global: Redirect blocked - already redirecting');
            return false;
        }
        
        return true;
    }
    
    startRedirect() {
        this.isRedirecting = true;
        this.redirectCount++;
        this.lastRedirectTime = Date.now();
        
        // Update global flags
        window.isRedirecting = true;
        window.redirectCount = this.redirectCount;
        window.lastRedirectTime = this.lastRedirectTime;
        
        // Clear redirect flag after timeout
        const timeout = setTimeout(() => {
            this.isRedirecting = false;
            window.isRedirecting = false;
        }, 5000);
        
        this.redirectTimeouts.add(timeout);
        
        // Reduce redirect count after cooldown
        setTimeout(() => {
            this.redirectCount = Math.max(0, this.redirectCount - 1);
            window.redirectCount = this.redirectCount;
        }, this.redirectCooldown * 2);
    }
    
    reset() {
        this.isRedirecting = false;
        this.redirectCount = 0;
        this.lastRedirectTime = 0;
        
        // Clear timeouts
        this.redirectTimeouts.forEach(timeout => clearTimeout(timeout));
        this.redirectTimeouts.clear();
        
        // Update global flags
        window.isRedirecting = false;
        window.redirectCount = 0;
        window.lastRedirectTime = 0;
    }
}

// Create global redirect manager
const globalRedirectManager = new GlobalRedirectManager();

// Make it available globally
window.redirectManager = globalRedirectManager;

/**
 * Authentication Guard Class
 */
class AuthGuard {
    constructor() {
        this.protectedRoutes = new Map();
        this.currentRoute = window.location.pathname;
        this.initialized = false;
        this.authCheckInProgress = false;
        
        console.log('Authentication Guard initialized');
    }

    /**
     * Check if we can perform a redirect (prevent rapid redirects)
     */
    canRedirect() {
        return globalRedirectManager.canRedirect();
    }

    /**
     * Record a redirect attempt
     */
    recordRedirect() {
        globalRedirectManager.startRedirect();
    }

    /**
     * Initialize the auth guard
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Set up route protection rules
            this.setupRouteProtection();
            
            // Set up auth state listener with debouncing
            authService.onAuthStateChange(this.debounce((user, role) => {
                this.handleAuthStateChange(user, role);
            }, 500));
            
            // Check current route protection after a delay
            setTimeout(() => {
                this.checkCurrentRoute();
            }, 1000);
            
            this.initialized = true;
            console.log('Auth Guard initialized successfully');
            
        } catch (error) {
            console.error('Error initializing Auth Guard:', error);
        }
    }

    /**
     * Debounce utility function
     */
    debounce(func, wait) {
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

    /**
     * Set up route protection rules
     */
    setupRouteProtection() {
        // Define protected routes and their required roles
        const routes = [
            // Patient routes
            {
                path: '/public/patientPortal.html',
                roles: [USER_ROLES.PATIENT],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/public/patientDashboard.html',
                roles: [USER_ROLES.PATIENT],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // Admin routes
            {
                path: '/admin',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/admin/dashboard.html',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/admin/users.html',
                roles: [USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // Doctor routes
            {
                path: '/doctor',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/doctor/dashboard.html',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/doctor/patients.html',
                roles: [USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // Nurse routes
            {
                path: '/nurse',
                roles: [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/nurse/dashboard.html',
                roles: [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // Staff routes
            {
                path: '/staff',
                roles: [USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // Organization routes
            {
                path: '/business/organization-dashboard.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/member-dashboard.html',
                roles: [USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/staff-management.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            {
                path: '/business/patient-management.html',
                roles: [USER_ROLES.ORGANIZATION_ADMIN, USER_ROLES.ORGANIZATION_MEMBER],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // System admin routes
            {
                path: '/admin/system-dashboard.html',
                roles: [USER_ROLES.SYSTEM_ADMIN],
                requireAuth: true,
                requireEmailVerification: true
            },
            
            // API routes (for fetch requests)
            {
                path: '/api',
                roles: [USER_ROLES.PATIENT, USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN, USER_ROLES.ORGANIZATION_ADMIN, USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.SYSTEM_ADMIN],
                requireAuth: true,
                requireEmailVerification: false
            }
        ];
        
        // Store route protection rules
        routes.forEach(route => {
            this.protectedRoutes.set(route.path, route);
        });
    }

    /**
     * Handle auth state changes
     */
    handleAuthStateChange(user, role) {
        // Prevent multiple simultaneous auth checks
        if (this.authCheckInProgress) {
            console.log('🛡️ Auth Guard: Auth check already in progress, skipping');
            return;
        }
        
        // Don't interfere during Google authentication
        if (window.isProcessingGoogleAuth) {
            console.log('🛡️ Auth Guard: Skipping during Google auth process');
            return;
        }
        
        // Don't interfere during redirects
        if (window.isRedirecting) {
            console.log('🛡️ Auth Guard: Skipping auth state change check during redirect');
            return;
        }
        
        console.log('🛡️ Auth Guard: Auth state changed', { user: user?.uid, role });
        
        // Check if current route is still accessible with debouncing
        this.debounce(() => {
            this.checkCurrentRoute();
        }, 1000)();
    }

    /**
     * Check if current route is protected and accessible
     */
    async checkCurrentRoute() {
        // Prevent multiple simultaneous checks
        if (this.authCheckInProgress) {
            console.log('🛡️ Auth Guard: Route check already in progress');
            return true;
        }
        
        // Don't interfere with Google auth
        if (window.isProcessingGoogleAuth) {
            console.log('🛡️ Auth Guard: Skipping route check during Google auth');
            return true;
        }
        
        // Don't interfere with ongoing redirects
        if (window.isRedirecting) {
            console.log('🛡️ Auth Guard: Skipping route check during redirect');
            return true;
        }
        
        this.authCheckInProgress = true;
        
        try {
            const currentPath = window.location.pathname;
            const protection = this.getRouteProtection(currentPath);
            
            if (!protection) {
                // Route is not protected
                return true;
            }
            
            console.log('🛡️ Auth Guard: Checking route protection for:', currentPath, protection);
            
            // Wait for auth state to settle
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Strict authentication check without assumptions
            const isAuthenticated = authService.isAuthenticated();
            const user = authService.getCurrentUser();
            
            console.log('🛡️ Auth Guard: Authentication status:', {
                isAuthenticated,
                hasUser: !!user,
                userUID: user?.uid,
                requireAuth: protection.requireAuth
            });
            
            // Check authentication requirement with strict validation
            if (protection.requireAuth) {
                if (!isAuthenticated || !user || !user.uid) {
                    console.log('❌ Route requires authentication but user is not properly authenticated');
                    this.redirectToLogin('This page requires authentication');
                    return false;
                }
                
                // Double-check Firebase session validity (with timeout)
                try {
                    const reloadPromise = user.reload();
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Reload timeout')), 5000)
                    );
                    
                    await Promise.race([reloadPromise, timeoutPromise]);
                    console.log('✅ Auth Guard: Firebase session valid');
                } catch (error) {
                    console.log('❌ Auth Guard: Invalid Firebase session detected:', error);
                    // Only clear session if it's clearly invalid, not just slow
                    if (error.code && error.code.includes('auth/')) {
                        await authService.logout();
                        this.redirectToLogin('Session expired, please sign in again');
                        return false;
                    } else {
                        console.log('⚠️ Session check timed out, assuming valid for now');
                    }
                }
            }
            
            // Check email verification requirement (Google users are auto-verified)
            if (protection.requireEmailVerification && authService.isAuthenticated()) {
                const user = authService.getCurrentUser();
                const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
                
                if (!user.emailVerified && !isGoogleUser) {
                    console.log('❌ Route requires email verification but email is not verified');
                    this.redirectToEmailVerification();
                    return false;
                }
            }
            
            // Check role requirement (be more permissive for authenticated users)
            if (protection.roles && protection.roles.length > 0) {
                const userRole = authService.getUserRole();
                
                if (!userRole) {
                    console.log('⚠️ User role not loaded, assuming patient role for authenticated user');
                    // If user is authenticated but role not loaded, assume patient role
                    if (authService.isAuthenticated() && protection.roles.includes(USER_ROLES.PATIENT)) {
                        console.log('✅ Allowing access with assumed patient role');
                        return true;
                    }
                }
                
                if (!protection.roles.includes(userRole)) {
                    console.log('❌ User role not authorized for this route', { userRole, requiredRoles: protection.roles });
                    this.redirectToUnauthorized();
                    return false;
                }
            }
            
            console.log('✅ Route access granted');
            return true;
            
        } catch (error) {
            console.error('❌ Error checking route protection:', error);
            
            // If the user is authenticated, allow access to patient portal despite errors
            if (authService.isAuthenticated() && currentPath.includes('patientPortal')) {
                console.log('⚠️ Allowing access to patient portal despite errors for authenticated user');
                return true;
            }
            
            this.redirectToLogin('An error occurred. Please login again.');
            return false;
        } finally {
            this.authCheckInProgress = false;
        }
    }

    /**
     * Get route protection settings for a path
     */
    getRouteProtection(path) {
        // Check for exact match first
        if (this.protectedRoutes.has(path)) {
            return this.protectedRoutes.get(path);
        }
        
        // Check for partial matches (for directories)
        for (const [routePath, protection] of this.protectedRoutes) {
            if (path.startsWith(routePath)) {
                return protection;
            }
        }
        
        return null;
    }

    /**
     * Redirect to login page
     */
    redirectToLogin(message = '') {
        if (!this.canRedirect()) {
            console.log('🚫 Auth Guard: Login redirect blocked');
            return;
        }
        
        // Don't redirect during Google auth
        if (window.isProcessingGoogleAuth) {
            console.log('🚫 Auth Guard: Skipping redirect during Google auth');
            return;
        }
        
        console.log('🔄 Redirecting to login:', message);
        this.recordRedirect();
        
        if (message) {
            sessionStorage.setItem('auth_redirect_message', message);
        }
        
        // Store return URL
        sessionStorage.setItem('auth_return_url', window.location.href);
        
        // Redirect based on current path
        const currentPath = window.location.pathname;
        
        setTimeout(() => {
            if (currentPath.includes('/admin')) {
                window.location.href = '/admin/login.html';
            } else if (currentPath.includes('/doctor')) {
                window.location.href = '/doctor/login.html';
            } else if (currentPath.includes('/nurse')) {
                window.location.href = '/nurse/login.html';
            } else if (currentPath.includes('/staff')) {
                window.location.href = '/staff/login.html';
            } else {
                window.location.href = '/public/patientSign-in.html';
            }
        }, 500);
    }

    /**
     * Redirect to email verification page
     */
    redirectToEmailVerification() {
        if (!this.canRedirect()) {
            console.log('🚫 Auth Guard: Email verification redirect blocked');
            return;
        }
        
        console.log('Redirecting to email verification');
        this.recordRedirect();
        
        // Store return URL
        sessionStorage.setItem('auth_return_url', window.location.href);
        
        setTimeout(() => {
            window.location.href = '/email-verification.html';
        }, 500);
    }

    /**
     * Redirect to unauthorized page
     */
    redirectToUnauthorized() {
        console.log('Redirecting to unauthorized page');
        
        // Show unauthorized message
        this.showUnauthorizedMessage();
    }

    /**
     * Show unauthorized access message
     */
    showUnauthorizedMessage() {
        const userRole = authService.getUserRole();
        const message = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; text-align: center;">
                    <h3 style="color: #dc3545;">Access Denied</h3>
                    <p>You don't have permission to access this page.</p>
                    <p>Your role: <strong>${userRole || 'None'}</strong></p>
                    <div style="margin-top: 20px;">
                        <button onclick="window.history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                            Go Back
                        </button>
                        <button onclick="window.location.href='/public/patientPortal.html'" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
    }

    /**
     * Protect a specific element based on role
     */
    protectElement(element, requiredRoles, hideIfUnauthorized = true) {
        if (!element) return;
        
        const userRole = authService.getUserRole();
        const hasAccess = Array.isArray(requiredRoles) 
            ? requiredRoles.includes(userRole)
            : userRole === requiredRoles;
        
        if (!hasAccess) {
            if (hideIfUnauthorized) {
                element.style.display = 'none';
            } else {
                element.style.opacity = '0.5';
                element.style.pointerEvents = 'none';
                element.title = 'You do not have permission to access this feature';
            }
        }
    }

    /**
     * Protect multiple elements based on role
     */
    protectElements(selector, requiredRoles, hideIfUnauthorized = true) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            this.protectElement(element, requiredRoles, hideIfUnauthorized);
        });
    }

    /**
     * Check if user has permission for an action
     */
    hasPermission(permission) {
        return authService.hasPermission(permission);
    }

    /**
     * Check if user has role
     */
    hasRole(role) {
        return authService.hasRole(role);
    }

    /**
     * Secure fetch wrapper that adds authentication headers
     */
    async secureFetch(url, options = {}) {
        const user = authService.getCurrentUser();
        
        if (!user) {
            throw new Error('Authentication required');
        }
        
        try {
            // Get ID token
            const idToken = await user.getIdToken();
            
            // Add authorization header
            const headers = {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            // Make request
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            // Check if unauthorized
            if (response.status === 401) {
                console.log('API request unauthorized, redirecting to login');
                this.redirectToLogin('Session expired. Please login again.');
                return;
            }
            
            // Check if forbidden
            if (response.status === 403) {
                console.log('API request forbidden');
                throw new Error('You do not have permission to perform this action');
            }
            
            return response;
            
        } catch (error) {
            console.error('Secure fetch error:', error);
            throw error;
        }
    }

    /**
     * Initialize page-specific protections
     */
    initializePageProtections() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyPageProtections();
            });
        } else {
            this.applyPageProtections();
        }
    }

    /**
     * Apply page-specific protections
     */
    applyPageProtections() {
        // Protect admin-only elements
        this.protectElements('[data-admin-only]', [USER_ROLES.ADMIN]);
        
        // Protect system admin-only elements
        this.protectElements('[data-system-admin-only]', [USER_ROLES.SYSTEM_ADMIN]);
        
        // Protect organization admin-only elements
        this.protectElements('[data-org-admin-only]', [USER_ROLES.ORGANIZATION_ADMIN]);
        
        // Protect organization member elements
        this.protectElements('[data-org-member-only]', [USER_ROLES.ORGANIZATION_MEMBER, USER_ROLES.ORGANIZATION_ADMIN]);
        
        // Protect doctor-only elements
        this.protectElements('[data-doctor-only]', [USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        // Protect nurse-only elements
        this.protectElements('[data-nurse-only]', [USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        // Protect staff-only elements
        this.protectElements('[data-staff-only]', [USER_ROLES.CLINIC_STAFF, USER_ROLES.NURSE, USER_ROLES.DOCTOR, USER_ROLES.ADMIN]);
        
        // Protect patient-only elements
        this.protectElements('[data-patient-only]', [USER_ROLES.PATIENT]);
        
        // Show role-specific content
        this.showRoleSpecificContent();
    }

    /**
     * Show content based on user role
     */
    showRoleSpecificContent() {
        const userRole = authService.getUserRole();
        
        // Hide all role-specific content first
        document.querySelectorAll('[data-role]').forEach(element => {
            element.style.display = 'none';
        });
        
        // Show content for current role
        if (userRole) {
            document.querySelectorAll(`[data-role="${userRole}"]`).forEach(element => {
                element.style.display = '';
            });
            
            // Show content for "all authenticated users"
            document.querySelectorAll('[data-role="authenticated"]').forEach(element => {
                element.style.display = '';
            });
        } else {
            // Show content for unauthenticated users
            document.querySelectorAll('[data-role="unauthenticated"]').forEach(element => {
                element.style.display = '';
            });
        }
    }

    /**
     * Create middleware for protecting routes
     */
    createRouteMiddleware(requiredRoles = [], options = {}) {
        return async () => {
            const {
                requireAuth = true,
                requireEmailVerification = true,
                redirectOnFail = true
            } = options;
            
            // Check authentication
            if (requireAuth && !authService.isAuthenticated()) {
                if (redirectOnFail) {
                    this.redirectToLogin('Authentication required');
                }
                return false;
            }
            
            // Check email verification
            if (requireEmailVerification && authService.isAuthenticated()) {
                const user = authService.getCurrentUser();
                if (!user.emailVerified) {
                    if (redirectOnFail) {
                        this.redirectToEmailVerification();
                    }
                    return false;
                }
            }
            
            // Check roles
            if (requiredRoles.length > 0) {
                const userRole = authService.getUserRole();
                if (!userRole || !requiredRoles.includes(userRole)) {
                    if (redirectOnFail) {
                        this.redirectToUnauthorized();
                    }
                    return false;
                }
            }
            
            return true;
        };
    }
}

// Create singleton instance
const authGuard = new AuthGuard();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authGuard.initialize();
        authGuard.initializePageProtections();
    });
} else {
    authGuard.initialize();
    authGuard.initializePageProtections();
}

// Export auth guard
export default authGuard;
export { AuthGuard, USER_ROLES };

// Production-safe debug utilities
import('../utils/environment.js').then(({ default: environment }) => {
    import('../utils/logger.js').then(({ default: logger }) => {
        // Only create debug utilities in development
        if (environment.isDevelopment()) {
            window.authDebug = {
                getAuthState: () => {
                    return {
                        isAuthenticated: authService.isAuthenticated(),
                        currentUser: authService.getCurrentUser()?.email || null,
                        userRole: authService.getUserRole(),
                        isRedirecting: window.isRedirecting,
                        redirectCount: window.redirectCount,
                        lastRedirectTime: window.lastRedirectTime,
                        currentPath: window.location.pathname
                    };
                },
                
                resetRedirects: () => {
                    globalRedirectManager.reset();
                    logger.debug('Redirects reset');
                },
                
                forceAuth: () => {
                    authService.forceClearAuthState();
                    logger.debug('Auth state cleared');
                }
            };
            
            logger.info('Authentication Guard module loaded');
            logger.dev('Debug utilities available: window.authDebug.getAuthState(), window.authDebug.resetRedirects(), window.authDebug.forceAuth()');
        } else {
            // In production, just log that auth guard is loaded
            logger.info('Authentication Guard module loaded');
        }
    });
}).catch(() => {
    // Fallback if logger/environment modules are not available
    console.log('Authentication Guard module loaded');
}); 