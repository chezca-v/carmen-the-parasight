/**
 * CSRF SERVICE - Frontend
 * 
 * Handles CSRF token management for frontend applications to protect against
 * Cross-Site Request Forgery attacks. Integrates with the backend CSRF protection
 * system to ensure all state-changing operations include valid CSRF tokens.
 * 
 * Features:
 * - Automatic token fetching and refreshing
 * - Secure token storage (sessionStorage, not localStorage)
 * - Request interceptor integration
 * - Token rotation handling
 * - Error recovery mechanisms
 */

// Secure error handling (imported asynchronously to avoid import issues)
let secureErrorHandler = null;

// Try to import secure error handler
(async () => {
    try {
        const errorHandlerModule = await import('./secure-error-handler.js');
        secureErrorHandler = errorHandlerModule.default || errorHandlerModule;
        console.log('✅ CSRF: Secure error handler loaded');
    } catch (err) {
        console.warn('⚠️ CSRF: Secure error handler not available:', err.message);
    }
})();

class CSRFService {
    constructor() {
        this.csrfToken = null;
        this.tokenExpiry = null;
        this.headerName = 'x-csrf-token';
        this.cookieName = '__csrf_token';
        this.isRefreshing = false;
        this.refreshPromise = null;
        this.refreshThreshold = 5 * 60 * 1000; // Refresh 5 minutes before expiry
        
        // Storage keys
        this.STORAGE_KEYS = {
            TOKEN: 'csrf_token',
            EXPIRY: 'csrf_token_expiry',
            HEADER_NAME: 'csrf_header_name',
            COOKIE_NAME: 'csrf_cookie_name'
        };
        
        // Initialize from stored token if available
        this.loadStoredToken();
        
        // Set up automatic token refresh
        this.setupTokenRefresh();
    }
    
    /**
     * Load stored CSRF token from sessionStorage
     */
    loadStoredToken() {
        try {
            const token = sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
            const expiry = sessionStorage.getItem(this.STORAGE_KEYS.EXPIRY);
            const headerName = sessionStorage.getItem(this.STORAGE_KEYS.HEADER_NAME);
            const cookieName = sessionStorage.getItem(this.STORAGE_KEYS.COOKIE_NAME);
            
            if (token && expiry) {
                const expiryTime = parseInt(expiry);
                
                // Check if token is still valid
                if (Date.now() < expiryTime) {
                    this.csrfToken = token;
                    this.tokenExpiry = expiryTime;
                    this.headerName = headerName || this.headerName;
                    this.cookieName = cookieName || this.cookieName;
                    console.log('✅ Loaded stored CSRF token');
                } else {
                    console.log('⚠️ Stored CSRF token expired, will fetch new one');
                    this.clearStoredToken();
                }
            }
        } catch (error) {
            console.warn('Failed to load stored CSRF token:', error);
            this.clearStoredToken();
        }
    }
    
    /**
     * Store CSRF token in sessionStorage
     * @param {string} token - CSRF token
     * @param {number} expiry - Token expiry timestamp
     * @param {string} headerName - Header name for token
     * @param {string} cookieName - Cookie name for token
     */
    storeToken(token, expiry, headerName, cookieName) {
        try {
            sessionStorage.setItem(this.STORAGE_KEYS.TOKEN, token);
            sessionStorage.setItem(this.STORAGE_KEYS.EXPIRY, expiry.toString());
            sessionStorage.setItem(this.STORAGE_KEYS.HEADER_NAME, headerName);
            sessionStorage.setItem(this.STORAGE_KEYS.COOKIE_NAME, cookieName);
        } catch (error) {
            console.warn('Failed to store CSRF token:', error);
        }
    }
    
    /**
     * Clear stored CSRF token
     */
    clearStoredToken() {
        try {
            Object.values(this.STORAGE_KEYS).forEach(key => {
                sessionStorage.removeItem(key);
            });
            this.csrfToken = null;
            this.tokenExpiry = null;
        } catch (error) {
            console.warn('Failed to clear stored CSRF token:', error);
        }
    }
    
    /**
     * Setup automatic token refresh
     */
    setupTokenRefresh() {
        // Check token status every minute
        setInterval(() => {
            if (this.shouldRefreshToken()) {
                this.refreshToken();
            }
        }, 60 * 1000);
    }
    
    /**
     * Check if token should be refreshed
     * @returns {boolean} - Whether token should be refreshed
     */
    shouldRefreshToken() {
        if (!this.csrfToken || !this.tokenExpiry) {
            return false; // No token to refresh
        }
        
        const timeUntilExpiry = this.tokenExpiry - Date.now();
        return timeUntilExpiry <= this.refreshThreshold;
    }
    
    /**
     * Fetch CSRF token from server
     * @returns {Promise<Object>} - Token response
     */
    async fetchToken() {
        try {
            const response = await fetch('/api/auth/csrf-token', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required for CSRF token');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.csrfToken) {
                throw new Error(data.message || 'Failed to fetch CSRF token');
            }
            
            // Store the new token
            this.csrfToken = data.csrfToken;
            this.tokenExpiry = data.expiry;
            this.headerName = data.headerName || this.headerName;
            this.cookieName = data.cookieName || this.cookieName;
            
            // Persist to sessionStorage
            this.storeToken(this.csrfToken, this.tokenExpiry, this.headerName, this.cookieName);
            
            console.log('✅ CSRF token fetched successfully');
            return data;
            
        } catch (error) {
            let errorMessage = 'Failed to fetch CSRF token';
            
            if (secureErrorHandler && secureErrorHandler.handleNetworkError) {
                const secureError = secureErrorHandler.handleNetworkError(error, { 
                    context: 'csrf-token-fetch',
                    endpoint: '/api/auth/csrf-token'
                });
                errorMessage = secureError.message;
            } else {
                // Fallback error handling
                if (error.status === 401) {
                    errorMessage = 'Authentication required for CSRF token';
                } else if (error.message) {
                    errorMessage = `Network error: ${error.message}`;
                }
            }
            
            console.error('Failed to fetch CSRF token:', errorMessage);
            throw new Error(errorMessage);
        }
    }
    
    /**
     * Refresh CSRF token
     * @returns {Promise<Object>} - Token response
     */
    async refreshToken() {
        // Prevent multiple simultaneous refresh attempts
        if (this.isRefreshing) {
            return this.refreshPromise;
        }
        
        this.isRefreshing = true;
        
        try {
            this.refreshPromise = this.performTokenRefresh();
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }
    
    /**
     * Perform token refresh operation
     * @returns {Promise<Object>} - Token response
     */
    async performTokenRefresh() {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': this.getAuthHeader()
            };
            
            // Include current token if available
            if (this.csrfToken) {
                headers[this.headerName] = this.csrfToken;
            }
            
            const response = await fetch('/api/auth/csrf-token/refresh', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    _csrf: this.csrfToken // Include in body for double-submit pattern
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Authentication failed, need to re-authenticate
                    throw new Error('Authentication required for CSRF token refresh');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to refresh CSRF token');
            }
            
            // Update token if rotated
            if (data.rotated && data.csrfToken) {
                this.csrfToken = data.csrfToken;
                this.tokenExpiry = data.expiry;
                this.headerName = data.headerName || this.headerName;
                this.cookieName = data.cookieName || this.cookieName;
                
                // Persist to sessionStorage
                this.storeToken(this.csrfToken, this.tokenExpiry, this.headerName, this.cookieName);
                
                console.log('✅ CSRF token refreshed and rotated');
            } else {
                console.log('✅ CSRF token still valid, no refresh needed');
            }
            
            return data;
            
        } catch (error) {
            let errorMessage = 'Failed to refresh CSRF token';
            
            if (secureErrorHandler && secureErrorHandler.handleNetworkError) {
                const secureError = secureErrorHandler.handleNetworkError(error, { 
                    context: 'csrf-token-refresh',
                    endpoint: '/api/auth/csrf-token/refresh'
                });
                errorMessage = secureError.message;
            } else {
                // Fallback error handling
                if (error.status === 401) {
                    errorMessage = 'Authentication required for CSRF token refresh';
                } else if (error.message) {
                    errorMessage = `Network error: ${error.message}`;
                }
            }
            
            console.error('Failed to refresh CSRF token:', errorMessage);
            
            // If refresh fails, try to fetch new token
            console.log('Attempting to fetch new CSRF token after refresh failure');
            return this.fetchToken();
        }
    }
    
    /**
     * Get current CSRF token, fetching if necessary
     * @returns {Promise<string>} - CSRF token
     */
    async getToken() {
        // Return cached token if valid and not expiring soon
        if (this.csrfToken && this.tokenExpiry && 
            (this.tokenExpiry - Date.now()) > this.refreshThreshold) {
            return this.csrfToken;
        }
        
        // Fetch new token if none available or expiring soon
        if (!this.isRefreshing) {
            await this.fetchToken();
        } else {
            // Wait for ongoing refresh
            await this.refreshPromise;
        }
        
        return this.csrfToken;
    }
    
    /**
     * Add CSRF token to request headers
     * @param {Object} headers - Request headers object
     * @returns {Promise<Object>} - Headers with CSRF token
     */
    async addTokenToHeaders(headers = {}) {
        try {
            const token = await this.getToken();
            if (token) {
                headers[this.headerName] = token;
            }
            return headers;
        } catch (error) {
            console.warn('Failed to add CSRF token to headers:', error.message);
            return headers;
        }
    }
    
    /**
     * Add CSRF token to request body
     * @param {Object} body - Request body object
     * @returns {Promise<Object>} - Body with CSRF token
     */
    async addTokenToBody(body = {}) {
        try {
            const token = await this.getToken();
            if (token) {
                body._csrf = token;
            }
            return body;
        } catch (error) {
            console.warn('Failed to add CSRF token to body:', error.message);
            return body;
        }
    }
    
    /**
     * Make a secure fetch request with CSRF protection
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} - Fetch response
     */
    async secureFetch(url, options = {}) {
        const method = options.method || 'GET';
        
        // Only add CSRF protection for state-changing methods
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
            try {
                // Add CSRF token to headers
                options.headers = await this.addTokenToHeaders(options.headers || {});
                
                // Add CSRF token to body if it's JSON
                if (options.body && typeof options.body === 'string') {
                    try {
                        const bodyObj = JSON.parse(options.body);
                        const secureBody = await this.addTokenToBody(bodyObj);
                        options.body = JSON.stringify(secureBody);
                    } catch (parseError) {
                        // If body is not JSON, just add header token
                        console.warn('Could not parse request body for CSRF token, using header only');
                    }
                } else if (options.body && typeof options.body === 'object') {
                    options.body = await this.addTokenToBody(options.body);
                }
                
                // Ensure credentials are included for cookies
                options.credentials = options.credentials || 'include';
                
            } catch (error) {
                console.warn('Failed to add CSRF protection to request:', error.message);
                // Continue with request even if CSRF token fails
            }
        }
        
        return fetch(url, options);
    }
    
    /**
     * Get authorization header for requests
     * @returns {string} - Authorization header value
     */
    getAuthHeader() {
        // Try to get auth token from various sources
        const authService = window.authService;
        if (authService && authService.getCurrentUser) {
            try {
                const user = authService.getCurrentUser();
                return user ? `Bearer ${user.accessToken}` : '';
            } catch (error) {
                console.warn('Failed to get auth token from auth service');
            }
        }
        
        // Fallback to localStorage/sessionStorage
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        return token ? `Bearer ${token}` : '';
    }
    
    /**
     * Clear CSRF token on logout
     */
    logout() {
        this.clearStoredToken();
        console.log('✅ CSRF tokens cleared on logout');
    }
    
    /**
     * Get CSRF service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            hasToken: !!this.csrfToken,
            tokenExpiry: this.tokenExpiry,
            isExpiring: this.shouldRefreshToken(),
            timeUntilExpiry: this.tokenExpiry ? Math.max(0, this.tokenExpiry - Date.now()) : 0,
            headerName: this.headerName,
            cookieName: this.cookieName,
            isRefreshing: this.isRefreshing
        };
    }
}

// Create global CSRF service instance
const csrfService = new CSRFService();

// Export for use in modules
export default csrfService;

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.csrfService = csrfService;
} 