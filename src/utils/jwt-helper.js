/**
 * Secure JWT Helper Utility
 * Provides secure JWT token generation, validation, and management
 * with protection against common JWT vulnerabilities
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

class SecureJWTHelper {
    constructor() {
        this.algorithm = 'HS256';
        this.issuer = process.env.JWT_ISSUER || 'lingaplink-healthcare';
        this.audience = process.env.JWT_AUDIENCE || 'lingaplink-users';
        this.maxAge = 30 * 60; // 30 minutes in seconds
        this.refreshMaxAge = 24 * 60 * 60; // 24 hours in seconds
        
        // Token blacklist for revoked tokens
        this.tokenBlacklist = new Set();
        
        // Rate limiting for token generation
        this.tokenGenerationCounts = new Map();
        this.maxTokensPerMinute = 10;
    }

    /**
     * Generate a secure JWT token
     * @param {Object} payload - Token payload
     * @param {string} userId - User ID
     * @param {string} userRole - User role
     * @param {boolean} isRefreshToken - Whether this is a refresh token
     * @returns {Object} Token response with metadata
     */
    generateToken(payload, userId, userRole, isRefreshToken = false) {
        try {
            // Rate limiting check
            if (!this.checkRateLimit(userId)) {
                throw new Error('Token generation rate limit exceeded');
            }

            // Validate inputs
            if (!payload || !userId || !userRole) {
                throw new Error('Invalid token parameters');
            }

            // Sanitize payload to prevent injection attacks
            const sanitizedPayload = this.sanitizePayload(payload);

            // Create token claims
            const claims = {
                ...sanitizedPayload,
                sub: userId,
                role: userRole,
                iss: this.issuer,
                aud: this.audience,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (isRefreshToken ? this.refreshMaxAge : this.maxAge),
                jti: crypto.randomBytes(16).toString('hex'), // Unique token ID
                type: isRefreshToken ? 'refresh' : 'access'
            };

            // Get JWT secret
            const secret = this.getJWTSecret();
            if (!secret) {
                throw new Error('JWT secret not configured');
            }

            // Generate token
            const token = jwt.sign(claims, secret, {
                algorithm: this.algorithm,
                expiresIn: isRefreshToken ? this.refreshMaxAge : this.maxAge
            });

            // Update rate limiting
            this.updateRateLimit(userId);

            return {
                token,
                expiresIn: isRefreshToken ? this.refreshMaxAge : this.maxAge,
                tokenType: isRefreshToken ? 'refresh' : 'access',
                issuedAt: claims.iat,
                expiresAt: claims.exp,
                tokenId: claims.jti
            };

        } catch (error) {
            throw new Error(`Token generation failed: ${error.message}`);
        }
    }

    /**
     * Verify and validate a JWT token
     * @param {string} token - JWT token to verify
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            // Input validation
            if (!token || typeof token !== 'string') {
                throw new Error('Invalid token format');
            }

            // Check if token is blacklisted
            if (this.tokenBlacklist.has(token)) {
                throw new Error('Token has been revoked');
            }

            // Get JWT secret
            const secret = this.getJWTSecret();
            if (!secret) {
                throw new Error('JWT secret not configured');
            }

            // Verify token signature and decode
            const decoded = jwt.verify(token, secret, {
                algorithms: [this.algorithm],
                issuer: this.issuer,
                audience: this.audience,
                clockTolerance: 30 // 30 seconds tolerance for clock skew
            });

            // Additional validation
            this.validateTokenClaims(decoded);

            return decoded;

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token signature');
            } else if (error.name === 'NotBeforeError') {
                throw new Error('Token not yet valid');
            } else {
                throw new Error(`Token verification failed: ${error.message}`);
            }
        }
    }

    /**
     * Refresh an access token using a refresh token
     * @param {string} refreshToken - Valid refresh token
     * @returns {Object} New access token
     */
    refreshAccessToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = this.verifyToken(refreshToken);
            
            // Ensure it's actually a refresh token
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type for refresh');
            }

            // Generate new access token
            const newAccessToken = this.generateToken(
                { userId: decoded.sub, email: decoded.email },
                decoded.sub,
                decoded.role,
                false
            );

            return newAccessToken;

        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    /**
     * Revoke a token (add to blacklist)
     * @param {string} token - Token to revoke
     */
    revokeToken(token) {
        try {
            if (!token) return;

            // Decode token to get expiration
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) return;

            // Add to blacklist
            this.tokenBlacklist.add(token);

            // Schedule cleanup when token expires
            const timeUntilExpiry = (decoded.exp * 1000) - Date.now();
            if (timeUntilExpiry > 0) {
                setTimeout(() => {
                    this.tokenBlacklist.delete(token);
                }, timeUntilExpiry);
            }

        } catch (error) {
            console.warn('Failed to revoke token:', error.message);
        }
    }

    /**
     * Validate token claims
     * @param {Object} decoded - Decoded token
     * @private
     */
    validateTokenClaims(decoded) {
        const now = Math.floor(Date.now() / 1000);

        // Check required claims
        const requiredClaims = ['sub', 'role', 'iss', 'aud', 'iat', 'exp', 'jti', 'type'];
        for (const claim of requiredClaims) {
            if (!decoded[claim]) {
                throw new Error(`Missing required claim: ${claim}`);
            }
        }

        // Check expiration
        if (decoded.exp < now) {
            throw new Error('Token has expired');
        }

        // Check issued at
        if (decoded.iat > now) {
            throw new Error('Token issued in the future');
        }

        // Check issuer
        if (decoded.iss !== this.issuer) {
            throw new Error('Invalid token issuer');
        }

        // Check audience
        if (decoded.aud !== this.audience) {
            throw new Error('Invalid token audience');
        }

        // Validate role
        const validRoles = ['admin', 'doctor', 'nurse', 'patient', 'clinic_staff', 'organization_admin', 'organization_member', 'system_admin'];
        if (!validRoles.includes(decoded.role)) {
            throw new Error('Invalid user role');
        }
    }

    /**
     * Sanitize payload to prevent injection attacks
     * @param {Object} payload - Raw payload
     * @returns {Object} Sanitized payload
     * @private
     */
    sanitizePayload(payload) {
        const sanitized = {};
        const allowedKeys = ['userId', 'email', 'name', 'permissions', 'metadata'];

        for (const [key, value] of Object.entries(payload)) {
            if (allowedKeys.includes(key) && typeof value === 'string') {
                // Remove potentially dangerous characters
                sanitized[key] = value.replace(/[<>\"'&]/g, '');
            } else if (allowedKeys.includes(key) && typeof value === 'object') {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizePayload(value);
            } else if (allowedKeys.includes(key)) {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Get JWT secret from environment
     * @returns {string} JWT secret
     * @private
     */
    getJWTSecret() {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret === 'your-jwt-secret-key' || secret.length < 32) {
            throw new Error('JWT secret not properly configured');
        }
        return secret;
    }

    /**
     * Check rate limiting for token generation
     * @param {string} userId - User ID
     * @returns {boolean} Whether rate limit allows generation
     * @private
     */
    checkRateLimit(userId) {
        const now = Date.now();
        const userCounts = this.tokenGenerationCounts.get(userId) || { count: 0, resetTime: now + 60000 };

        // Reset counter if minute has passed
        if (now > userCounts.resetTime) {
            userCounts.count = 0;
            userCounts.resetTime = now + 60000;
        }

        return userCounts.count < this.maxTokensPerMinute;
    }

    /**
     * Update rate limiting counter
     * @param {string} userId - User ID
     * @private
     */
    updateRateLimit(userId) {
        const now = Date.now();
        const userCounts = this.tokenGenerationCounts.get(userId) || { count: 0, resetTime: now + 60000 };

        if (now > userCounts.resetTime) {
            userCounts.count = 1;
            userCounts.resetTime = now + 60000;
        } else {
            userCounts.count++;
        }

        this.tokenGenerationCounts.set(userId, userCounts);
    }

    /**
     * Get token statistics
     * @returns {Object} Token statistics
     */
    getStats() {
        return {
            blacklistedTokens: this.tokenBlacklist.size,
            activeRateLimits: this.tokenGenerationCounts.size,
            maxTokensPerMinute: this.maxTokensPerMinute,
            algorithm: this.algorithm,
            issuer: this.issuer,
            audience: this.audience,
            maxAge: this.maxAge,
            refreshMaxAge: this.refreshMaxAge
        };
    }

    /**
     * Clean up expired blacklisted tokens
     */
    cleanup() {
        const now = Math.floor(Date.now() / 1000);
        let cleaned = 0;

        for (const token of this.tokenBlacklist) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.exp && decoded.exp < now) {
                    this.tokenBlacklist.delete(token);
                    cleaned++;
                }
            } catch (error) {
                // Remove invalid tokens
                this.tokenBlacklist.delete(token);
                cleaned++;
            }
        }

        return cleaned;
    }
}

// Create singleton instance
const jwtHelper = new SecureJWTHelper();

// Cleanup expired tokens every hour
setInterval(() => {
    jwtHelper.cleanup();
}, 60 * 60 * 1000);

export default jwtHelper;



