/**
 * Comprehensive CSRF Protection Utility
 * Provides protection against Cross-Site Request Forgery attacks
 * with secure token generation, validation, and middleware
 */

import crypto from 'crypto';

class CSRFProtection {
    constructor() {
        this.secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
        this.tokenLength = 32;
        this.tokenExpiry = 30 * 60 * 1000; // 30 minutes
        this.maxTokensPerSession = 5;
        
        // Store active tokens with expiration
        this.activeTokens = new Map();
        
        // Cleanup expired tokens every 5 minutes
        setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
    }

    /**
     * Generate a CSRF token for a session
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} sessionId - Unique session identifier
     * @returns {Object} Token response with metadata
     */
    generateTokenResponse(req, res, sessionId) {
        try {
            if (!sessionId) {
                throw new Error('Session ID is required');
            }

            // Check token limit for session
            if (!this.checkTokenLimit(sessionId)) {
                throw new Error('Too many tokens for this session');
            }

            // Generate secure random token
            const token = crypto.randomBytes(this.tokenLength).toString('hex');
            const tokenId = crypto.randomBytes(16).toString('hex');
            const expiresAt = Date.now() + this.tokenExpiry;

            // Store token with metadata
            this.activeTokens.set(token, {
                sessionId,
                tokenId,
                expiresAt,
                createdAt: Date.now(),
                lastUsed: null,
                useCount: 0
            });

            // Set token in cookie (HttpOnly, Secure, SameSite)
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: this.tokenExpiry,
                path: '/'
            };

            res.cookie('csrf-token', token, cookieOptions);

            return {
                token,
                tokenId,
                headerName: 'X-CSRF-Token',
                cookieName: 'csrf-token',
                expiresAt,
                expiresIn: this.tokenExpiry,
                instructions: {
                    header: `Include token in 'X-CSRF-Token' header`,
                    cookie: 'Token also set as secure cookie',
                    expiry: 'Token expires in 30 minutes'
                }
            };

        } catch (error) {
            throw new Error(`CSRF token generation failed: ${error.message}`);
        }
    }

    /**
     * Verify CSRF token from request
     * @param {Object} req - Express request object
     * @param {string} sessionId - Session identifier
     * @returns {boolean} Whether token is valid
     */
    verifyToken(req, sessionId) {
        try {
            if (!sessionId) {
                return false;
            }

            // Get token from header or body
            const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
            
            if (!token) {
                return false;
            }

            // Check if token exists and is valid
            const tokenData = this.activeTokens.get(token);
            if (!tokenData) {
                return false;
            }

            // Verify session match
            if (tokenData.sessionId !== sessionId) {
                return false;
            }

            // Check expiration
            if (Date.now() > tokenData.expiresAt) {
                this.activeTokens.delete(token);
                return false;
            }

            // Update token usage
            tokenData.lastUsed = Date.now();
            tokenData.useCount++;

            return true;

        } catch (error) {
            console.warn('CSRF token verification failed:', error.message);
            return false;
        }
    }

    /**
     * Create CSRF middleware for Express
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware function
     */
    csrfMiddleware(options = {}) {
        const {
            skipRoutes = [],
            skipMethods = ['GET', 'HEAD', 'OPTIONS'],
            sessionIdExtractor = (req) => req.user?.uid || req.sessionID || `anonymous_${req.ip}`,
            errorHandler = this.defaultErrorHandler
        } = options;

        return (req, res, next) => {
            try {
                // Skip CSRF check for safe methods
                if (skipMethods.includes(req.method)) {
                    return next();
                }

                // Skip CSRF check for specified routes
                if (skipRoutes.some(route => req.path.startsWith(route))) {
                    return next();
                }

                // Extract session ID
                const sessionId = sessionIdExtractor(req);
                if (!sessionId) {
                    return errorHandler(req, res, new Error('Unable to identify session'));
                }

                // Verify CSRF token
                if (!this.verifyToken(req, sessionId)) {
                    const error = new Error('Invalid or missing CSRF token');
                    error.code = 'CSRF_TOKEN_MISSING';
                    error.status = 403;
                    return errorHandler(req, res, error);
                }

                // Token is valid, proceed
                next();

            } catch (error) {
                return errorHandler(req, res, error);
            }
        };
    }

    /**
     * Default error handler for CSRF failures
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Error} error - Error object
     */
    defaultErrorHandler(req, res, error) {
        const status = error.status || 403;
        const message = error.message || 'CSRF validation failed';
        
        res.status(status).json({
            error: 'CSRF Protection Error',
            message,
            code: error.code || 'CSRF_VALIDATION_FAILED',
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
        });
    }

    /**
     * Check if token should be rotated
     * @param {string} token - CSRF token
     * @returns {boolean} Whether token should be rotated
     */
    shouldRotateToken(token) {
        const tokenData = this.activeTokens.get(token);
        if (!tokenData) {
            return true;
        }

        // Rotate if token is old or heavily used
        const age = Date.now() - tokenData.createdAt;
        const shouldRotate = age > (this.tokenExpiry * 0.8) || tokenData.useCount > 100;

        return shouldRotate;
    }

    /**
     * Check token limit for session
     * @param {string} sessionId - Session identifier
     * @returns {boolean} Whether limit allows new token
     * @private
     */
    checkTokenLimit(sessionId) {
        let count = 0;
        const now = Date.now();

        // Count active tokens for this session
        for (const [token, data] of this.activeTokens) {
            if (data.sessionId === sessionId && data.expiresAt > now) {
                count++;
            }
        }

        return count < this.maxTokensPerSession;
    }

    /**
     * Clean up expired tokens
     * @returns {number} Number of tokens cleaned up
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        let cleaned = 0;

        for (const [token, data] of this.activeTokens) {
            if (data.expiresAt <= now) {
                this.activeTokens.delete(token);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Get CSRF protection statistics
     * @returns {Object} Protection statistics
     */
    getCSRFStats() {
        const now = Date.now();
        let activeTokens = 0;
        let expiredTokens = 0;
        const sessionCounts = new Map();

        for (const [token, data] of this.activeTokens) {
            if (data.expiresAt > now) {
                activeTokens++;
                const count = sessionCounts.get(data.sessionId) || 0;
                sessionCounts.set(data.sessionId, count + 1);
            } else {
                expiredTokens++;
            }
        }

        return {
            activeTokens,
            expiredTokens,
            totalTokens: this.activeTokens.size,
            uniqueSessions: sessionCounts.size,
            maxTokensPerSession: this.maxTokensPerSession,
            tokenExpiry: this.tokenExpiry,
            lastCleanup: now
        };
    }

    /**
     * Revoke all tokens for a session
     * @param {string} sessionId - Session identifier
     * @returns {number} Number of tokens revoked
     */
    revokeSessionTokens(sessionId) {
        let revoked = 0;

        for (const [token, data] of this.activeTokens) {
            if (data.sessionId === sessionId) {
                this.activeTokens.delete(token);
                revoked++;
            }
        }

        return revoked;
    }

    /**
     * Validate CSRF configuration
     * @returns {Object} Validation result
     */
    validateConfiguration() {
        const issues = [];
        const warnings = [];

        // Check secret
        if (!this.secret || this.secret.length < 32) {
            issues.push('CSRF secret is too short or missing');
        }

        // Check environment
        if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
            warnings.push('CSRF_SECRET not set in production - using generated secret');
        }

        // Check token expiry
        if (this.tokenExpiry < 5 * 60 * 1000) {
            warnings.push('CSRF token expiry is very short (< 5 minutes)');
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings,
            config: {
                secretLength: this.secret?.length || 0,
                tokenLength: this.tokenLength,
                tokenExpiry: this.tokenExpiry,
                maxTokensPerSession: this.maxTokensPerSession
            }
        };
    }
}

// Create singleton instance
const csrfProtection = new CSRFProtection();

// Export configuration for middleware
csrfProtection.CSRF_CONFIG = {
    HEADER_NAME: 'X-CSRF-Token',
    COOKIE_NAME: 'csrf-token',
    BODY_FIELD: '_csrf',
    QUERY_FIELD: '_csrf'
};

export default csrfProtection;



