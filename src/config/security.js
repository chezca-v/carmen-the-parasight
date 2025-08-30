/**
 * Security Configuration
 * Centralizes all security-related settings and provides validation
 */

class SecurityConfig {
    constructor() {
        this.config = {
            // Password requirements
            password: {
                minLength: 8,
                maxLength: 128,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                preventCommonPatterns: true,
                maxConsecutiveChars: 3,
                maxRepeatedChars: 2
            },
            
            // Session management
            session: {
                timeout: 30 * 60 * 1000, // 30 minutes
                warningTime: 5 * 60 * 1000, // 5 minutes before timeout
                maxConcurrentSessions: 3,
                requireReauthForSensitive: true
            },
            
            // Rate limiting
            rateLimit: {
                loginAttempts: {
                    max: 5,
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    lockoutDuration: 15 * 60 * 1000 // 15 minutes
                },
                apiRequests: {
                    general: { max: 100, windowMs: 15 * 60 * 1000 },
                    sensitive: { max: 10, windowMs: 15 * 60 * 1000 },
                    auth: { max: 5, windowMs: 15 * 60 * 1000 }
                }
            },
            
            // JWT configuration
            jwt: {
                algorithm: 'HS256',
                accessTokenExpiry: 30 * 60, // 30 minutes
                refreshTokenExpiry: 24 * 60 * 60, // 24 hours
                issuer: process.env.JWT_ISSUER || 'lingaplink-healthcare',
                audience: process.env.JWT_AUDIENCE || 'lingaplink-users',
                clockTolerance: 30 // 30 seconds
            },
            
            // CSRF protection
            csrf: {
                tokenLength: 32,
                tokenExpiry: 30 * 60 * 1000, // 30 minutes
                maxTokensPerSession: 5,
                requireForMethods: ['POST', 'PUT', 'DELETE', 'PATCH']
            },
            
            // Input validation
            validation: {
                maxStringLength: 1000,
                maxArrayLength: 100,
                maxObjectDepth: 5,
                allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
                maxFileSize: 10 * 1024 * 1024 // 10MB
            },
            
            // Security headers
            headers: {
                contentSecurityPolicy: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", "'unsafe-inline'"],
                    'style-src': ["'self'", "'unsafe-inline'"],
                    'img-src': ["'self'", 'data:', 'https:'],
                    'connect-src': ["'self'", 'https://firebase.googleapis.com'],
                    'frame-ancestors': ["'none'"],
                    'base-uri': ["'self'"],
                    'form-action': ["'self'"]
                },
                hsts: {
                    maxAge: 31536000, // 1 year
                    includeSubDomains: true,
                    preload: true
                }
            },
            
            // Environment-specific settings
            environment: {
                development: {
                    allowInsecureCookies: true,
                    logSensitiveData: false,
                    strictValidation: false
                },
                production: {
                    allowInsecureCookies: false,
                    logSensitiveData: false,
                    strictValidation: true
                }
            }
        };
        
        this.currentEnv = process.env.NODE_ENV || 'development';
        this.validateConfiguration();
    }

    /**
     * Get configuration value
     * @param {string} path - Configuration path (e.g., 'password.minLength')
     * @returns {*} Configuration value
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }

    /**
     * Set configuration value
     * @param {string} path - Configuration path
     * @param {*} value - Value to set
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const obj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
        obj[lastKey] = value;
    }

    /**
     * Get environment-specific configuration
     * @param {string} key - Configuration key
     * @returns {*} Environment-specific value
     */
    getEnvConfig(key) {
        const envConfig = this.config.environment[this.currentEnv];
        return envConfig?.[key] || this.config[key];
    }

    /**
     * Validate security configuration
     * @returns {Object} Validation result
     */
    validateConfiguration() {
        const issues = [];
        const warnings = [];

        // Validate password requirements
        if (this.config.password.minLength < 8) {
            issues.push('Password minimum length must be at least 8 characters');
        }

        if (this.config.password.maxLength > 256) {
            warnings.push('Password maximum length is very high (>256 characters)');
        }

        // Validate session timeout
        if (this.config.session.timeout < 5 * 60 * 1000) {
            issues.push('Session timeout is too short (<5 minutes)');
        }

        if (this.config.session.timeout > 24 * 60 * 60 * 1000) {
            warnings.push('Session timeout is very long (>24 hours)');
        }

        // Validate rate limiting
        if (this.config.rateLimit.loginAttempts.max > 10) {
            warnings.push('Login attempt limit is high (>10 attempts)');
        }

        // Validate JWT configuration
        if (this.config.jwt.accessTokenExpiry < 5 * 60) {
            issues.push('JWT access token expiry is too short (<5 minutes)');
        }

        if (this.config.jwt.refreshTokenExpiry > 7 * 24 * 60 * 60) {
            warnings.push('JWT refresh token expiry is very long (>7 days)');
        }

        // Validate CSRF configuration
        if (this.config.csrf.tokenLength < 16) {
            issues.push('CSRF token length is too short (<16 characters)');
        }

        // Environment-specific validation
        if (this.currentEnv === 'production') {
            if (this.config.environment.production.allowInsecureCookies) {
                issues.push('Insecure cookies are not allowed in production');
            }
            
            if (this.config.environment.production.logSensitiveData) {
                issues.push('Sensitive data logging is not allowed in production');
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings,
            environment: this.currentEnv
        };
    }

    /**
     * Get security recommendations
     * @returns {Array} Security recommendations
     */
    getSecurityRecommendations() {
        const recommendations = [];
        const validation = this.validateConfiguration();

        if (validation.issues.length > 0) {
            recommendations.push('Fix critical security issues:', ...validation.issues);
        }

        if (validation.warnings.length > 0) {
            recommendations.push('Consider addressing warnings:', ...validation.warnings);
        }

        // Environment-specific recommendations
        if (this.currentEnv === 'development') {
            recommendations.push(
                'Use strong passwords in development',
                'Enable strict validation in production',
                'Review security headers configuration',
                'Test CSRF protection thoroughly'
            );
        }

        if (this.currentEnv === 'production') {
            recommendations.push(
                'Ensure HTTPS is enforced',
                'Monitor rate limiting effectiveness',
                'Regular security audits',
                'Keep dependencies updated'
            );
        }

        return recommendations;
    }

    /**
     * Generate security report
     * @returns {Object} Security report
     */
    generateSecurityReport() {
        const validation = this.validateConfiguration();
        const recommendations = this.getSecurityRecommendations();

        return {
            timestamp: new Date().toISOString(),
            environment: this.currentEnv,
            validation,
            recommendations,
            config: {
                password: this.config.password,
                session: this.config.session,
                rateLimit: this.config.rateLimit,
                jwt: this.config.jwt,
                csrf: this.config.csrf
            }
        };
    }

    /**
     * Check if feature is enabled for current environment
     * @param {string} feature - Feature name
     * @returns {boolean} Whether feature is enabled
     */
    isFeatureEnabled(feature) {
        const envConfig = this.config.environment[this.currentEnv];
        return envConfig?.[feature] !== false;
    }

    /**
     * Get security headers configuration
     * @returns {Object} Security headers configuration
     */
    getSecurityHeaders() {
        const headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };

        // Add HSTS header for production
        if (this.currentEnv === 'production') {
            headers['Strict-Transport-Security'] = `max-age=${this.config.headers.hsts.maxAge}; includeSubDomains; preload`;
        }

        return headers;
    }

    /**
     * Validate environment variables
     * @returns {Object} Validation result
     */
    validateEnvironmentVariables() {
        const required = [
            'JWT_SECRET',
            'NODE_ENV'
        ];

        const optional = [
            'JWT_ISSUER',
            'JWT_AUDIENCE',
            'CSRF_SECRET'
        ];

        const missing = [];
        const weak = [];

        // Check required variables
        for (const varName of required) {
            if (!process.env[varName]) {
                missing.push(varName);
            }
        }

        // Check JWT secret strength
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret && (jwtSecret.length < 32 || jwtSecret === 'your-jwt-secret-key')) {
            weak.push('JWT_SECRET is too weak or using default value');
        }

        // Check CSRF secret strength
        const csrfSecret = process.env.CSRF_SECRET;
        if (csrfSecret && csrfSecret.length < 32) {
            weak.push('CSRF_SECRET is too weak');
        }

        return {
            valid: missing.length === 0 && weak.length === 0,
            missing,
            weak,
            environment: this.currentEnv
        };
    }
}

// Create singleton instance
const securityConfig = new SecurityConfig();

export default securityConfig;



