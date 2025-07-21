/**
 * CSRF PROTECTION UTILITY
 * 
 * Provides Cross-Site Request Forgery (CSRF) protection for the LingapLink application.
 * Implements secure token generation, validation, and session binding to prevent
 * unauthorized state-changing operations.
 * 
 * Security Features:
 * - Cryptographically secure token generation
 * - Session-bound token validation
 * - Token rotation and expiration
 * - Double-submit cookie pattern support
 * - SameSite cookie protection
 * - Secure token storage and transmission
 */

const crypto = require('crypto');

// CSRF configuration constants
const CSRF_CONFIG = {
    TOKEN_LENGTH: 32, // 256 bits
    TOKEN_EXPIRY: 30 * 60 * 1000, // 30 minutes
    COOKIE_NAME: '__csrf_token',
    HEADER_NAME: 'x-csrf-token',
    ROTATION_INTERVAL: 15 * 60 * 1000, // 15 minutes
    MAX_TOKENS_PER_SESSION: 3 // Allow multiple tabs
};

// In-memory token store (in production, use Redis or database)
class CSRFTokenStore {
    constructor() {
        this.tokens = new Map();
        this.sessionTokens = new Map();
        
        // Clean up expired tokens every 5 minutes
        setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
    }
    
    /**
     * Store a CSRF token with session binding
     * @param {string} sessionId - User session identifier
     * @param {string} token - CSRF token
     * @param {number} expiry - Token expiration timestamp
     */
    storeToken(sessionId, token, expiry) {
        const tokenData = {
            sessionId,
            expiry,
            created: Date.now()
        };
        
        this.tokens.set(token, tokenData);
        
        // Track tokens per session
        if (!this.sessionTokens.has(sessionId)) {
            this.sessionTokens.set(sessionId, new Set());
        }
        
        const sessionSet = this.sessionTokens.get(sessionId);
        sessionSet.add(token);
        
        // Limit tokens per session
        if (sessionSet.size > CSRF_CONFIG.MAX_TOKENS_PER_SESSION) {
            const oldestToken = sessionSet.values().next().value;
            this.removeToken(oldestToken);
        }
    }
    
    /**
     * Validate a CSRF token
     * @param {string} token - CSRF token to validate
     * @param {string} sessionId - Expected session ID
     * @returns {boolean} - Whether token is valid
     */
    validateToken(token, sessionId) {
        const tokenData = this.tokens.get(token);
        
        if (!tokenData) {
            return false;
        }
        
        // Check expiration
        if (Date.now() > tokenData.expiry) {
            this.removeToken(token);
            return false;
        }
        
        // Check session binding
        if (tokenData.sessionId !== sessionId) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Remove a specific token
     * @param {string} token - Token to remove
     */
    removeToken(token) {
        const tokenData = this.tokens.get(token);
        if (tokenData) {
            this.tokens.delete(token);
            
            const sessionSet = this.sessionTokens.get(tokenData.sessionId);
            if (sessionSet) {
                sessionSet.delete(token);
                if (sessionSet.size === 0) {
                    this.sessionTokens.delete(tokenData.sessionId);
                }
            }
        }
    }
    
    /**
     * Remove all tokens for a session (on logout)
     * @param {string} sessionId - Session ID
     */
    removeSessionTokens(sessionId) {
        const sessionSet = this.sessionTokens.get(sessionId);
        if (sessionSet) {
            for (const token of sessionSet) {
                this.tokens.delete(token);
            }
            this.sessionTokens.delete(sessionId);
        }
    }
    
    /**
     * Clean up expired tokens
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        const expiredTokens = [];
        
        for (const [token, tokenData] of this.tokens) {
            if (now > tokenData.expiry) {
                expiredTokens.push(token);
            }
        }
        
        for (const token of expiredTokens) {
            this.removeToken(token);
        }
        
        console.log(`Cleaned up ${expiredTokens.length} expired CSRF tokens`);
    }
    
    /**
     * Get token statistics for monitoring
     */
    getStats() {
        return {
            totalTokens: this.tokens.size,
            activeSessions: this.sessionTokens.size,
            timestamp: new Date().toISOString()
        };
    }
}

// Global token store instance
const tokenStore = new CSRFTokenStore();

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} - Base64 encoded CSRF token
 */
function generateCSRFToken() {
    return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('base64url');
}

/**
 * Create a new CSRF token for a session
 * @param {string} sessionId - User session identifier
 * @returns {Object} - Token data with token and expiry
 */
function createCSRFToken(sessionId) {
    const token = generateCSRFToken();
    const expiry = Date.now() + CSRF_CONFIG.TOKEN_EXPIRY;
    
    tokenStore.storeToken(sessionId, token, expiry);
    
    return {
        token,
        expiry,
        maxAge: CSRF_CONFIG.TOKEN_EXPIRY
    };
}

/**
 * Validate CSRF token from request
 * @param {Object} req - Express request object
 * @param {string} sessionId - User session identifier
 * @returns {Object} - Validation result
 */
function validateCSRFToken(req, sessionId) {
    // Extract token from header or body
    const headerToken = req.headers[CSRF_CONFIG.HEADER_NAME];
    const bodyToken = req.body?._csrf;
    const cookieToken = req.cookies?.[CSRF_CONFIG.COOKIE_NAME];
    
    const token = headerToken || bodyToken;
    
    if (!token) {
        return {
            valid: false,
            error: 'CSRF token missing',
            code: 'CSRF_TOKEN_MISSING'
        };
    }
    
    // Double-submit cookie pattern validation
    if (cookieToken && token !== cookieToken) {
        return {
            valid: false,
            error: 'CSRF token mismatch',
            code: 'CSRF_TOKEN_MISMATCH'
        };
    }
    
    const isValid = tokenStore.validateToken(token, sessionId);
    
    if (!isValid) {
        return {
            valid: false,
            error: 'Invalid or expired CSRF token',
            code: 'CSRF_TOKEN_INVALID'
        };
    }
    
    return {
        valid: true,
        token
    };
}

/**
 * Express middleware for CSRF protection
 * @param {Object} options - Middleware configuration
 * @returns {Function} - Express middleware function
 */
function csrfMiddleware(options = {}) {
    const {
        skipRoutes = [],
        skipMethods = ['GET', 'HEAD', 'OPTIONS'],
        sessionIdExtractor = (req) => req.user?.uid || req.sessionID,
        errorHandler = null
    } = options;
    
    return (req, res, next) => {
        // Skip CSRF protection for safe methods
        if (skipMethods.includes(req.method)) {
            return next();
        }
        
        // Skip CSRF protection for specified routes
        if (skipRoutes.some(route => req.path.includes(route))) {
            return next();
        }
        
        // Extract session ID
        const sessionId = sessionIdExtractor(req);
        
        if (!sessionId) {
            const error = new Error('Session required for CSRF protection');
            error.status = 401;
            error.code = 'CSRF_SESSION_REQUIRED';
            return errorHandler ? errorHandler(error, req, res, next) : next(error);
        }
        
        // Validate CSRF token
        const validation = validateCSRFToken(req, sessionId);
        
        if (!validation.valid) {
            const error = new Error(validation.error);
            error.status = 403;
            error.code = validation.code;
            return errorHandler ? errorHandler(error, req, res, next) : next(error);
        }
        
        // Add CSRF context to request
        req.csrf = {
            token: validation.token,
            sessionId,
            valid: true
        };
        
        next();
    };
}

/**
 * Generate CSRF token for response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} sessionId - User session identifier
 * @returns {Object} - Token response data
 */
function generateTokenResponse(req, res, sessionId) {
    const tokenData = createCSRFToken(sessionId);
    
    // Set secure cookie with token (double-submit pattern)
    res.cookie(CSRF_CONFIG.COOKIE_NAME, tokenData.token, {
        httpOnly: false, // Allow JavaScript access for AJAX requests
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // Strict SameSite for CSRF protection
        maxAge: tokenData.maxAge,
        path: '/'
    });
    
    return {
        csrfToken: tokenData.token,
        expiry: tokenData.expiry,
        headerName: CSRF_CONFIG.HEADER_NAME,
        cookieName: CSRF_CONFIG.COOKIE_NAME
    };
}

/**
 * Cleanup session tokens on logout
 * @param {string} sessionId - Session to cleanup
 */
function cleanupSession(sessionId) {
    tokenStore.removeSessionTokens(sessionId);
}

/**
 * Check if token needs rotation
 * @param {string} token - Current token
 * @returns {boolean} - Whether token should be rotated
 */
function shouldRotateToken(token) {
    const tokenData = tokenStore.tokens.get(token);
    if (!tokenData) return true;
    
    const age = Date.now() - tokenData.created;
    return age > CSRF_CONFIG.ROTATION_INTERVAL;
}

/**
 * CSRF protection configuration helper
 * @param {Object} app - Express app instance
 * @param {Object} options - Configuration options
 */
function configureCSRFProtection(app, options = {}) {
    const {
        errorHandler,
        skipRoutes = ['/api/auth/csrf-token', '/api/health'],
        skipMethods = ['GET', 'HEAD', 'OPTIONS'],
        sessionIdExtractor
    } = options;
    
    // Add CSRF middleware to app
    app.use(csrfMiddleware({
        skipRoutes,
        skipMethods,
        sessionIdExtractor,
        errorHandler
    }));
    
    console.log('✅ CSRF protection configured');
    console.log(`   Skip routes: ${skipRoutes.join(', ')}`);
    console.log(`   Skip methods: ${skipMethods.join(', ')}`);
}

/**
 * Get CSRF protection statistics
 * @returns {Object} - Statistics object
 */
function getCSRFStats() {
    return {
        ...tokenStore.getStats(),
        config: {
            tokenLength: CSRF_CONFIG.TOKEN_LENGTH,
            tokenExpiry: CSRF_CONFIG.TOKEN_EXPIRY,
            rotationInterval: CSRF_CONFIG.ROTATION_INTERVAL,
            maxTokensPerSession: CSRF_CONFIG.MAX_TOKENS_PER_SESSION
        }
    };
}

// Export functions for both CommonJS and ES modules
const csrfProtection = {
    generateCSRFToken,
    createCSRFToken,
    validateCSRFToken,
    csrfMiddleware,
    generateTokenResponse,
    cleanupSession,
    shouldRotateToken,
    configureCSRFProtection,
    getCSRFStats,
    CSRF_CONFIG
};

// Support both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = csrfProtection;
} else if (typeof window !== 'undefined') {
    window.csrfProtection = csrfProtection;
}

export default csrfProtection; 