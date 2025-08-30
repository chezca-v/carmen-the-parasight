/**
 * Security Middleware for API Endpoints
 * Provides consistent input validation and sanitization
 */

import inputValidator from './input-validator.js';
import dbSanitizer from './db-sanitizer.js';
import fileSecurityManager from './file-security.js';

class SecurityMiddleware {
    constructor() {
        this.inputValidator = inputValidator;
        this.dbSanitizer = dbSanitizer;
        this.fileSecurityManager = fileSecurityManager;
    }

    /**
     * Input validation middleware
     */
    validateInput(validationRules) {
        return (req, res, next) => {
            try {
                const validation = this.inputValidator.validateForm(req.body, validationRules);
                
                if (!validation.valid) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: 'Input validation failed',
                        details: validation.errors,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Replace request body with sanitized data
                req.body = validation.sanitizedData;
                req.sanitized = true;
                
                next();
                
            } catch (error) {
                return res.status(500).json({
                    error: 'Validation Error',
                    message: 'Input validation processing failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Database query sanitization middleware
     */
    sanitizeDatabaseQueries() {
        return (req, res, next) => {
            try {
                // Sanitize query parameters
                if (req.query) {
                    req.query = this.dbSanitizer.sanitizeParams(req.query);
                }
                
                // Sanitize body parameters
                if (req.body) {
                    req.body = this.dbSanitizer.sanitizeParams(req.body);
                }
                
                // Sanitize URL parameters
                if (req.params) {
                    req.params = this.dbSanitizer.sanitizeParams(req.params);
                }
                
                req.dbSanitized = true;
                next();
                
            } catch (error) {
                return res.status(400).json({
                    error: 'Sanitization Error',
                    message: 'Input sanitization failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * File upload security middleware
     */
    secureFileUpload(allowedType = 'medical', maxSize = null) {
        return async (req, res, next) => {
            try {
                if (!req.files || Object.keys(req.files).length === 0) {
                    return next();
                }
                
                const fileValidationPromises = [];
                const validatedFiles = [];
                
                // Validate each uploaded file
                for (const [fieldName, file] of Object.entries(req.files)) {
                    if (Array.isArray(file)) {
                        // Handle multiple files
                        for (const singleFile of file) {
                            fileValidationPromises.push(
                                this.fileSecurityManager.validateFile(singleFile, allowedType, maxSize)
                                    .then(result => ({ fieldName, file: singleFile, result }))
                            );
                        }
                    } else {
                        // Handle single file
                        fileValidationPromises.push(
                            this.fileSecurityManager.validateFile(file, allowedType, maxSize)
                                .then(result => ({ fieldName, file, result }))
                        );
                    }
                }
                
                // Wait for all validations to complete
                const validationResults = await Promise.all(fileValidationPromises);
                
                // Check for validation errors
                const errors = [];
                for (const { fieldName, file, result } of validationResults) {
                    if (!result.valid) {
                        errors.push(`${fieldName}: ${result.error}`);
                    } else {
                        validatedFiles.push({
                            fieldName,
                            file: result.file,
                            sanitizedFilename: result.sanitizedFilename,
                            fileType: result.fileType,
                            fileSize: result.fileSize
                        });
                    }
                }
                
                if (errors.length > 0) {
                    return res.status(400).json({
                        error: 'File Validation Error',
                        message: 'One or more files failed validation',
                        details: errors,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Replace files with validated versions
                req.files = validatedFiles;
                req.filesValidated = true;
                
                next();
                
            } catch (error) {
                return res.status(500).json({
                    error: 'File Processing Error',
                    message: 'File validation processing failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * XSS protection middleware
     */
    preventXSS() {
        return (req, res, next) => {
            try {
                // Sanitize request body
                if (req.body && typeof req.body === 'object') {
                    req.body = this.sanitizeObject(req.body);
                }
                
                // Sanitize query parameters
                if (req.query && typeof req.query === 'object') {
                    req.query = this.sanitizeObject(req.query);
                }
                
                // Sanitize URL parameters
                if (req.params && typeof req.params === 'object') {
                    req.params = this.sanitizeObject(req.params);
                }
                
                req.xssProtected = true;
                next();
                
            } catch (error) {
                return res.status(500).json({
                    error: 'XSS Protection Error',
                    message: 'XSS protection processing failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Recursively sanitize object properties
     */
    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this.inputValidator.sanitizeText(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Rate limiting middleware
     */
    rateLimit(options = {}) {
        const {
            windowMs = 15 * 60 * 1000, // 15 minutes
            max = 100, // limit each IP to 100 requests per windowMs
            message = 'Too many requests from this IP, please try again later.',
            statusCode = 429
        } = options;
        
        const requests = new Map();
        
        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            
            if (!requests.has(ip)) {
                requests.set(ip, { count: 0, resetTime: now + windowMs });
            }
            
            const ipData = requests.get(ip);
            
            // Reset counter if window has passed
            if (now > ipData.resetTime) {
                ipData.count = 0;
                ipData.resetTime = now + windowMs;
            }
            
            // Increment counter
            ipData.count++;
            
            if (ipData.count > max) {
                return res.status(statusCode).json({
                    error: 'Rate Limit Exceeded',
                    message,
                    retryAfter: Math.ceil((ipData.resetTime - now) / 1000),
                    timestamp: new Date().toISOString()
                });
            }
            
            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': max,
                'X-RateLimit-Remaining': Math.max(0, max - ipData.count),
                'X-RateLimit-Reset': new Date(ipData.resetTime).toISOString()
            });
            
            next();
        };
    }

    /**
     * Content type validation middleware
     */
    validateContentType(allowedTypes = ['application/json']) {
        return (req, res, next) => {
            const contentType = req.get('Content-Type');
            
            if (!contentType) {
                return res.status(400).json({
                    error: 'Content Type Error',
                    message: 'Content-Type header is required',
                    allowedTypes,
                    timestamp: new Date().toISOString()
                });
            }
            
            const isValidType = allowedTypes.some(type => 
                contentType.includes(type) || contentType.includes('multipart/form-data')
            );
            
            if (!isValidType) {
                return res.status(415).json({
                    error: 'Unsupported Media Type',
                    message: 'Content-Type not supported',
                    received: contentType,
                    allowedTypes,
                    timestamp: new Date().toISOString()
                });
            }
            
            next();
        };
    }

    /**
     * Request size validation middleware
     */
    validateRequestSize(maxSize = '10mb') {
        return (req, res, next) => {
            const contentLength = parseInt(req.get('Content-Length') || '0');
            const maxSizeBytes = this.parseSize(maxSize);
            
            if (contentLength > maxSizeBytes) {
                return res.status(413).json({
                    error: 'Payload Too Large',
                    message: 'Request size exceeds maximum allowed size',
                    received: contentLength,
                    maxAllowed: maxSizeBytes,
                    timestamp: new Date().toISOString()
                });
            }
            
            next();
        };
    }

    /**
     * Parse size string to bytes
     */
    parseSize(sizeStr) {
        const units = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024
        };
        
        const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
        if (!match) return 1024 * 1024; // Default to 1MB
        
        const value = parseFloat(match[1]);
        const unit = match[2] || 'b';
        
        return value * (units[unit] || 1);
    }

    /**
     * Comprehensive security middleware
     */
    comprehensiveSecurity(validationRules = {}, fileUploadConfig = {}) {
        return [
            this.validateContentType(),
            this.validateRequestSize(),
            this.preventXSS(),
            this.sanitizeDatabaseQueries(),
            this.validateInput(validationRules),
            ...(fileUploadConfig.enabled ? [this.secureFileUpload(fileUploadConfig.type, fileUploadConfig.maxSize)] : []),
            this.rateLimit()
        ];
    }

    /**
     * Get middleware statistics
     */
    getMiddlewareStats() {
        return {
            inputValidator: this.inputValidator ? 'Available' : 'Not Available',
            dbSanitizer: this.dbSanitizer ? 'Available' : 'Not Available',
            fileSecurityManager: this.fileSecurityManager ? 'Available' : 'Not Available',
            timestamp: new Date().toISOString()
        };
    }
}

// Create singleton instance
const securityMiddleware = new SecurityMiddleware();

export default securityMiddleware;



