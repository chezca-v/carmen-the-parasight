/**
 * Secure JWT Helper Utility
 * Handles JWT operations with proper secret validation and security checks
 */

import jwt from 'jsonwebtoken';
import configValidator from './config-validator.js';

class JWTHelper {
  constructor() {
    this.secret = null;
    this.algorithm = 'HS256';
    this.expiresIn = '24h';
    this.initializeSecret();
  }

  /**
   * Initialize JWT secret with validation
   */
  initializeSecret() {
    try {
      // Try to get validated JWT secret
      const validatedConfig = configValidator.getValidatedConfig();
      this.secret = validatedConfig.jwt.secret;
      
      if (!this.secret || this.secret.length < 32) {
        throw new Error('JWT secret is too short or invalid');
      }
      
      console.log('✅ JWT secret initialized successfully');
      
    } catch (error) {
      if (configValidator.isProduction) {
        console.error('❌ JWT secret initialization failed:', error.message);
        throw new Error('JWT secret is required in production');
      } else {
        // In development, generate a secure fallback
        console.warn('⚠️ Using secure development JWT secret');
        this.secret = configValidator.generateSecureFallback('jwt-secret', 64);
      }
    }
  }

  /**
   * Generate JWT token with secure defaults
   */
  generateToken(payload, options = {}) {
    if (!this.secret) {
      throw new Error('JWT secret not initialized');
    }

    const tokenOptions = {
      algorithm: this.algorithm,
      expiresIn: options.expiresIn || this.expiresIn,
      issuer: options.issuer || 'lingaplink-healthcare',
      audience: options.audience || 'lingaplink-users',
      ...options
    };

    // Add timestamp for additional security
    const securePayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateTokenId()
    };

    return jwt.sign(securePayload, this.secret, tokenOptions);
  }

  /**
   * Verify JWT token with security checks
   */
  verifyToken(token, options = {}) {
    if (!this.secret) {
      throw new Error('JWT secret not initialized');
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }

    const verifyOptions = {
      algorithms: [this.algorithm],
      issuer: options.issuer || 'lingaplink-healthcare',
      audience: options.audience || 'lingaplink-users',
      ...options
    };

    try {
      const decoded = jwt.verify(token, this.secret, verifyOptions);
      
      // Additional security checks
      this.validateTokenPayload(decoded);
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Validate token payload for security
   */
  validateTokenPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid token payload');
    }

    // Check for required fields
    if (!payload.sub && !payload.userId && !payload.uid) {
      throw new Error('Token missing user identifier');
    }

    // Check for reasonable expiration time
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      
      // Token should not be valid for more than 30 days
      if (timeUntilExpiry > 30 * 24 * 60 * 60) {
        throw new Error('Token has unreasonably long expiration');
      }
    }

    return true;
  }

  /**
   * Generate unique token ID
   */
  generateTokenId() {
    return `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Decode token without verification (for debugging only)
   */
  decodeToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }

    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Token decoding failed');
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.payload && decoded.payload.exp) {
        return new Date(decoded.payload.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true; // Consider invalid tokens as expired
    }
    return expiration < new Date();
  }

  /**
   * Refresh token if it's close to expiration
   */
  refreshTokenIfNeeded(token, payload, thresholdMinutes = 30) {
    if (this.isTokenExpired(token)) {
      throw new Error('Token has expired');
    }

    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      throw new Error('Invalid token');
    }

    const now = new Date();
    const timeUntilExpiry = expiration.getTime() - now.getTime();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    if (timeUntilExpiry < thresholdMs) {
      // Token is close to expiration, generate new one
      return this.generateToken(payload);
    }

    return token; // Token is still valid
  }
}

// Export singleton instance
const jwtHelper = new JWTHelper();
export default jwtHelper; 