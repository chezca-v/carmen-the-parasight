/**
 * Comprehensive Input Validation & Sanitization Utility
 * Addresses XSS, SQL injection, and file upload vulnerabilities
 */

import DOMPurify from 'dompurify';
import xss from 'xss';

class InputValidator {
    constructor() {
        this.maxLengths = {
            name: 50,
            email: 254,
            phone: 20,
            address: 200,
            bio: 500,
            password: 128,
            url: 2048,
            filename: 255
        };
        
        this.allowedFileTypes = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            document: ['pdf', 'doc', 'docx', 'txt'],
            medical: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
        };
        
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * Sanitize HTML input to prevent XSS
     */
    sanitizeHTML(input, options = {}) {
        if (!input || typeof input !== 'string') return '';
        
        const defaultOptions = {
            allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            allowedAttributes: {
                'a': ['href', 'title'],
                'img': ['src', 'alt', 'title']
            }
        };
        
        const sanitizeOptions = { ...defaultOptions, ...options };
        
        // Use DOMPurify for HTML sanitization
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(input, sanitizeOptions);
        }
        
        // Fallback to xss library
        return xss(input, {
            whiteList: sanitizeOptions.allowedTags.reduce((acc, tag) => {
                acc[tag] = sanitizeOptions.allowedAttributes[tag] || [];
                return acc;
            }, {})
        });
    }

    /**
     * Sanitize plain text input
     */
    sanitizeText(input, maxLength = null) {
        if (!input || typeof input !== 'string') return '';
        
        let sanitized = input
            .trim()
            .replace(/[<>\"'&]/g, '') // Remove dangerous characters
            .replace(/\s+/g, ' '); // Normalize whitespace
        
        if (maxLength && sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    }

    /**
     * Validate and sanitize email
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email is required' };
        }
        
        const sanitized = this.sanitizeText(email, this.maxLengths.email);
        
        // RFC 5322 compliant email regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(sanitized)) {
            return { valid: false, error: 'Invalid email format' };
        }
        
        if (sanitized.length > this.maxLengths.email) {
            return { valid: false, error: 'Email is too long' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Validate and sanitize password
     */
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required' };
        }
        
        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters long' };
        }
        
        if (password.length > this.maxLengths.password) {
            return { valid: false, error: 'Password is too long' };
        }
        
        // Check for required character types
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        
        if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
            return { 
                valid: false, 
                error: 'Password must contain lowercase, uppercase, number, and special character' 
            };
        }
        
        // Check for common weak patterns
        const weakPatterns = [
            /^(.)\1+$/, // All same character
            /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
            /^(password|admin|user|login|guest|test|demo|root|toor)/i
        ];
        
        if (weakPatterns.some(pattern => pattern.test(password))) {
            return { valid: false, error: 'Password contains common weak patterns' };
        }
        
        return { valid: true, value: password };
    }

    /**
     * Validate and sanitize name
     */
    validateName(name, fieldName = 'Name') {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: `${fieldName} is required` };
        }
        
        const sanitized = this.sanitizeText(name, this.maxLengths.name);
        
        if (sanitized.length === 0) {
            return { valid: false, error: `${fieldName} cannot be empty` };
        }
        
        // Allow letters, spaces, hyphens, apostrophes, and periods
        const nameRegex = /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s'.-]+$/;
        
        if (!nameRegex.test(sanitized)) {
            return { valid: false, error: `${fieldName} contains invalid characters` };
        }
        
        // Prevent excessive repeated characters
        if (/(.)\1{4,}/.test(sanitized)) {
            return { valid: false, error: `${fieldName} contains too many repeated characters` };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Validate and sanitize phone number
     */
    validatePhone(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Phone number is required' };
        }
        
        const sanitized = this.sanitizeText(phone, this.maxLengths.phone);
        
        // Remove all non-digit characters for validation
        const digitsOnly = sanitized.replace(/\D/g, '');
        
        if (digitsOnly.length < 10 || digitsOnly.length > 15) {
            return { valid: false, error: 'Phone number must be between 10 and 15 digits' };
        }
        
        // Basic international phone format validation
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(digitsOnly)) {
            return { valid: false, error: 'Invalid phone number format' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Validate and sanitize address
     */
    validateAddress(address) {
        if (!address || typeof address !== 'string') {
            return { valid: false, error: 'Address is required' };
        }
        
        const sanitized = this.sanitizeText(address, this.maxLengths.address);
        
        if (sanitized.length === 0) {
            return { valid: false, error: 'Address cannot be empty' };
        }
        
        // Allow letters, numbers, spaces, hyphens, commas, periods, and common address characters
        const addressRegex = /^[a-zA-Z0-9\s\-.,#()]+$/;
        
        if (!addressRegex.test(sanitized)) {
            return { valid: false, error: 'Address contains invalid characters' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Validate and sanitize URL
     */
    validateURL(url, allowRelative = false) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }
        
        const sanitized = this.sanitizeText(url, this.maxLengths.url);
        
        if (sanitized.length === 0) {
            return { valid: false, error: 'URL cannot be empty' };
        }
        
        try {
            const urlObj = new URL(sanitized, allowRelative ? 'http://localhost' : undefined);
            
            // Check for allowed protocols
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(urlObj.protocol)) {
                return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
            }
            
            // Check for suspicious patterns
            const suspiciousPatterns = [
                /javascript:/i,
                /data:/i,
                /vbscript:/i,
                /file:/i
            ];
            
            if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
                return { valid: false, error: 'URL contains suspicious patterns' };
            }
            
            return { valid: true, value: sanitized };
            
        } catch (error) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    /**
     * Validate file upload
     */
    validateFile(file, allowedTypes = 'medical', maxSize = null) {
        if (!file || !(file instanceof File)) {
            return { valid: false, error: 'File is required' };
        }
        
        const maxFileSize = maxSize || this.maxFileSize;
        
        // Check file size
        if (file.size > maxFileSize) {
            return { 
                valid: false, 
                error: `File size exceeds maximum allowed size of ${Math.round(maxFileSize / 1024 / 1024)}MB` 
            };
        }
        
        // Check file type
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension) {
            return { valid: false, error: 'File has no extension' };
        }
        
        const allowedExtensions = this.allowedFileTypes[allowedTypes] || this.allowedFileTypes.medical;
        if (!allowedExtensions.includes(fileExtension)) {
            return { 
                valid: false, 
                error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}` 
            };
        }
        
        // Check filename for suspicious patterns
        const suspiciousPatterns = [
            /\.\./, // Directory traversal
            /[<>:"|?*]/, // Invalid filename characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i // Reserved Windows names
        ];
        
        if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
            return { valid: false, error: 'Invalid filename' };
        }
        
        return { valid: true, value: file };
    }

    /**
     * Validate and sanitize JSON input
     */
    validateJSON(input, schema = null) {
        if (!input || typeof input !== 'string') {
            return { valid: false, error: 'JSON input is required' };
        }
        
        try {
            const parsed = JSON.parse(input);
            
            // Basic schema validation if provided
            if (schema && typeof schema === 'object') {
                const validation = this.validateAgainstSchema(parsed, schema);
                if (!validation.valid) {
                    return validation;
                }
            }
            
            return { valid: true, value: parsed };
            
        } catch (error) {
            return { valid: false, error: 'Invalid JSON format' };
        }
    }

    /**
     * Validate object against schema
     */
    validateAgainstSchema(obj, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = obj[key];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${key} is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`${key} must be of type ${rules.type}`);
                }
                
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${key} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${key} must be no more than ${rules.maxLength} characters`);
                }
                
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${key} format is invalid`);
                }
                
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
                }
            }
        }
        
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        
        return { valid: true, value: obj };
    }

    /**
     * Sanitize SQL query parameters (prevent SQL injection)
     */
    sanitizeSQLParam(param) {
        if (param === null || param === undefined) {
            return null;
        }
        
        if (typeof param === 'string') {
            // Remove SQL injection patterns
            const dangerousPatterns = [
                /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/gi,
                /(--|#|\/\*|\*\/)/g,
                /(;|\||&|`|'|"|\\|\/)/g
            ];
            
            let sanitized = param;
            dangerousPatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '');
            });
            
            return sanitized.trim();
        }
        
        return param;
    }

    /**
     * Validate form data comprehensively
     */
    validateForm(formData, validationRules) {
        const errors = {};
        const sanitizedData = {};
        
        for (const [field, rules] of Object.entries(validationRules)) {
            const value = formData[field];
            const validation = this.validateField(value, rules);
            
            if (!validation.valid) {
                errors[field] = validation.error;
            } else {
                sanitizedData[field] = validation.value;
            }
        }
        
        return {
            valid: Object.keys(errors).length === 0,
            errors,
            sanitizedData
        };
    }

    /**
     * Validate individual field
     */
    validateField(value, rules) {
        if (rules.required && (value === undefined || value === null || value === '')) {
            return { valid: false, error: `${rules.label || 'Field'} is required` };
        }
        
        if (value !== undefined && value !== null && value !== '') {
            switch (rules.type) {
                case 'email':
                    return this.validateEmail(value);
                case 'password':
                    return this.validatePassword(value);
                case 'name':
                    return this.validateName(value, rules.label);
                case 'phone':
                    return this.validatePhone(value);
                case 'address':
                    return this.validateAddress(value);
                case 'url':
                    return this.validateURL(value, rules.allowRelative);
                case 'file':
                    return this.validateFile(value, rules.allowedTypes, rules.maxSize);
                case 'json':
                    return this.validateJSON(value, rules.schema);
                default:
                    return this.sanitizeText(value, rules.maxLength);
            }
        }
        
        return { valid: true, value: value || '' };
    }

    /**
     * Get validation rules for common fields
     */
    getCommonValidationRules() {
        return {
            email: { type: 'email', required: true, label: 'Email' },
            password: { type: 'password', required: true, label: 'Password' },
            firstName: { type: 'name', required: true, label: 'First name' },
            lastName: { type: 'name', required: true, label: 'Last name' },
            phone: { type: 'phone', required: true, label: 'Phone number' },
            address: { type: 'address', required: false, label: 'Address' }
        };
    }
}

// Create singleton instance
const inputValidator = new InputValidator();

export default inputValidator;



