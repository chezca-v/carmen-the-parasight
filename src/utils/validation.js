// Comprehensive Input Validation and Sanitization Utility
// Protects against XSS, injection attacks, and ensures data integrity

/**
 * HTML Entity Encoding to prevent XSS attacks
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    return text.replace(/[&<>"'`=\/]/g, (s) => map[s]);
}

/**
 * Remove potentially dangerous characters
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove null bytes, control characters, and common injection patterns
    return input
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/vbscript:/gi, '') // Remove vbscript: protocol
        .replace(/file:/gi, '') // Remove file: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/data:/gi, '') // Remove data: protocol
        .replace(/\{\{.*?\}\}/g, '') // Remove template injection patterns
        .replace(/\$\{.*?\}/g, '') // Remove JS template literals
        .replace(/<%.*?%>/g, '') // Remove server-side template patterns
        .replace(/\[\[.*?\]\]/g, '') // Remove bracket injection patterns
        .trim();
}

/**
 * Validate and sanitize URL input
 */
function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }
    
    const sanitized = sanitizeInput(url.trim());
    
    if (sanitized.length === 0) {
        return { valid: false, error: 'URL cannot be empty' };
    }
    
    if (sanitized.length > 2048) {
        return { valid: false, error: 'URL is too long' };
    }
    
    try {
        const urlObj = new URL(sanitized);
        // Only allow http and https protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
        }
        return { valid: true, value: sanitized };
    } catch {
        return { valid: false, error: 'Please enter a valid URL' };
    }
}

/**
 * Validate filename for file uploads
 */
function validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return { valid: false, error: 'Filename is required' };
    }
    
    const sanitized = filename.trim()
        .replace(/[^a-zA-Z0-9\.\-\_]/g, '') // Only allow safe characters
        .replace(/\.{2,}/g, '.') // Prevent directory traversal
        .substring(0, 255);
    
    if (sanitized.length === 0) {
        return { valid: false, error: 'Filename cannot be empty' };
    }
    
    // Check for dangerous extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'];
    const extension = sanitized.toLowerCase().substring(sanitized.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(extension)) {
        return { valid: false, error: 'This file type is not allowed' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Sanitize HTML content (for rich text inputs)
 */
function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Remove dangerous tags and attributes
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
        .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '') // Remove form tags
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/vbscript:/gi, '') // Remove vbscript: protocol
        .replace(/data:/gi, ''); // Remove data: protocol
}

/**
 * Validate email format
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }
    
    const sanitized = sanitizeInput(email.toLowerCase());
    
    // RFC 5322 compliant email regex (simplified but secure)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(sanitized)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }
    
    if (sanitized.length > 254) {
        return { valid: false, error: 'Email address is too long' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate password strength
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }
    
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    // Check for common weak patterns
    const weakPatterns = [
        /^(.)\1+$/, // All same character
        /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
        /^(password|admin|user|login|guest|test|demo|root|toor)/i
    ];
    
    if (weakPatterns.some(pattern => pattern.test(password))) {
        errors.push('Password contains common weak patterns');
    }
    
    if (errors.length > 0) {
        return { valid: false, error: errors[0] };
    }
    
    return { valid: true, value: password };
}

/**
 * Validate name (first name, last name)
 */
function validateName(name, fieldName = 'Name') {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: `${fieldName} is required` };
    }
    
    const sanitized = sanitizeInput(name.trim());
    
    if (sanitized.length === 0) {
        return { valid: false, error: `${fieldName} cannot be empty` };
    }
    
    if (sanitized.length > 50) {
        return { valid: false, error: `${fieldName} must be less than 50 characters` };
    }
    
    // Allow letters, spaces, hyphens, apostrophes, and periods (for middle initials)
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
 * Validate phone number
 */
function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }
    
    const sanitized = sanitizeInput(phone.trim());
    
    // Remove all non-digit characters for validation
    const digitsOnly = sanitized.replace(/\D/g, '');
    
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return { valid: false, error: 'Phone number must be between 10 and 15 digits' };
    }
    
    // Basic international phone format validation
    const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)\.]{8,}$/;
    
    if (!phoneRegex.test(sanitized)) {
        return { valid: false, error: 'Please enter a valid phone number' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate date of birth
 */
function validateDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) {
        return { valid: false, error: 'Date of birth is required' };
    }
    
    const date = new Date(dateOfBirth);
    
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Please enter a valid date' };
    }
    
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    
    if (date < minDate) {
        return { valid: false, error: 'Please enter a valid date of birth' };
    }
    
    if (date > maxDate) {
        return { valid: false, error: 'You must be at least 13 years old' };
    }
    
    return { valid: true, value: date.toISOString().split('T')[0] };
}

/**
 * Validate address
 */
function validateAddress(address) {
    if (!address || typeof address !== 'string') {
        return { valid: false, error: 'Address is required' };
    }
    
    const sanitized = sanitizeInput(address.trim());
    
    if (sanitized.length === 0) {
        return { valid: false, error: 'Address cannot be empty' };
    }
    
    if (sanitized.length > 200) {
        return { valid: false, error: 'Address must be less than 200 characters' };
    }
    
    // Allow letters, numbers, spaces, and common address characters
    const addressRegex = /^[a-zA-Z0-9\s\-\.,#\/]+$/;
    
    if (!addressRegex.test(sanitized)) {
        return { valid: false, error: 'Address contains invalid characters' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate bio/description text
 */
function validateBio(bio) {
    if (!bio || typeof bio !== 'string') {
        return { valid: true, value: '' }; // Bio is optional
    }
    
    const sanitized = sanitizeInput(bio.trim());
    
    if (sanitized.length > 500) {
        return { valid: false, error: 'Bio must be less than 500 characters' };
    }
    
    // Allow most characters but prevent script injection
    const bioRegex = /^[a-zA-Z0-9\s\-\.,!?'"()&@#$%\n\r]+$/;
    
    if (!bioRegex.test(sanitized)) {
        return { valid: false, error: 'Bio contains invalid characters' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate medical condition
 */
function validateMedicalCondition(condition) {
    if (!condition || typeof condition !== 'string') {
        return { valid: false, error: 'Medical condition is required' };
    }
    
    const sanitized = sanitizeInput(condition.trim());
    
    if (sanitized.length === 0) {
        return { valid: false, error: 'Medical condition cannot be empty' };
    }
    
    if (sanitized.length > 100) {
        return { valid: false, error: 'Medical condition must be less than 100 characters' };
    }
    
    // Allow letters, numbers, spaces, hyphens, parentheses
    const conditionRegex = /^[a-zA-Z0-9\s\-\(\)\.]+$/;
    
    if (!conditionRegex.test(sanitized)) {
        return { valid: false, error: 'Medical condition contains invalid characters' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate category for medical conditions
 */
function validateCategory(category) {
    const validCategories = ['speech', 'physical', 'mental', 'other'];
    
    if (!category || typeof category !== 'string') {
        return { valid: false, error: 'Category is required' };
    }
    
    const sanitized = sanitizeInput(category.toLowerCase().trim());
    
    if (!validCategories.includes(sanitized)) {
        return { valid: false, error: 'Invalid category. Must be: speech, physical, mental, or other' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Validate document name
 */
function validateDocumentName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Document name is required' };
    }
    
    const sanitized = sanitizeInput(name.trim());
    
    if (sanitized.length === 0) {
        return { valid: false, error: 'Document name cannot be empty' };
    }
    
    if (sanitized.length > 100) {
        return { valid: false, error: 'Document name must be less than 100 characters' };
    }
    
    // Allow most printable characters except for potentially dangerous ones
    // This allows for international characters, common punctuation, etc.
    const nameRegex = /^[^\x00-\x1f\x7f]+$/;
    
    if (!nameRegex.test(sanitized)) {
        return { valid: false, error: 'Document name contains invalid characters' };
    }
    
    return { valid: true, value: sanitized };
}

/**
 * Comprehensive form validation
 */
function validatePatientRegistrationForm(formData) {
    const errors = [];
    const sanitizedData = {};
    
    // Validate each field
    const validations = [
        { field: 'firstName', validator: (val) => validateName(val, 'First name') },
        { field: 'lastName', validator: (val) => validateName(val, 'Last name') },
        { field: 'email', validator: validateEmail },
        { field: 'password', validator: validatePassword },
        { field: 'phone', validator: validatePhone },
        { field: 'address', validator: validateAddress, optional: true },
        { field: 'dateOfBirth', validator: validateDateOfBirth },
        { field: 'bio', validator: validateBio, optional: true }
    ];
    
    validations.forEach(({ field, validator, optional }) => {
        const value = formData[field];
        
        // Skip validation for optional fields that are empty
        if (optional && (!value || value.trim() === '')) {
            sanitizedData[field] = '';
            return;
        }
        
        const result = validator(value);
        
        if (!result.valid) {
            errors.push(result.error);
        } else {
            sanitizedData[field] = result.value;
        }
    });
    
    // Validate password confirmation
    if (formData.password && formData.confirmPassword) {
        if (formData.password !== formData.confirmPassword) {
            errors.push('Passwords do not match');
        }
    }
    
    // Validate terms agreement
    if (!formData.terms) {
        errors.push('You must agree to the Terms of Service and Privacy Policy');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        sanitizedData
    };
}

/**
 * Validate simplified sign-up form (for new design)
 */
function validateSimplifiedSignUpForm(formData) {
    const errors = [];
    const sanitizedData = {};
    
    // Required fields for simplified form
    const validations = [
        { field: 'email', validator: validateEmail },
        { field: 'password', validator: validatePassword },
        { field: 'phone', validator: validatePhone },
        { field: 'dateOfBirth', validator: validateDateOfBirth }
    ];
    
    validations.forEach(({ field, validator }) => {
        const value = formData[field];
        const result = validator(value);
        
        if (!result.valid) {
            errors.push(result.error);
        } else {
            sanitizedData[field] = result.value;
        }
    });
    
    // Auto-generate names from email if provided
    if (sanitizedData.email) {
        const emailUsername = sanitizedData.email.split('@')[0];
        const nameParts = emailUsername.split(/[._-]/);
        
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        
        sanitizedData.firstName = nameParts[0] ? capitalize(nameParts[0]) : 'User';
        sanitizedData.lastName = nameParts[1] ? capitalize(nameParts[1]) : '';
    }
    
    // Set defaults for optional fields
    sanitizedData.address = '';
    sanitizedData.bio = '';
    sanitizedData.terms = true; // Auto-accepted in simplified form
    
    return {
        valid: errors.length === 0,
        errors,
        sanitizedData
    };
}

/**
 * Validate profile update data
 */
function validateProfileUpdateData(data) {
    const errors = [];
    const sanitizedData = {};
    
    // Validate firstName
    if (data.firstName) {
        const firstNameResult = validateName(data.firstName, 'First name');
        if (!firstNameResult.valid) {
            errors.push(firstNameResult.error);
        } else {
            sanitizedData.firstName = firstNameResult.value;
        }
    }
    
    // Validate lastName
    if (data.lastName) {
        const lastNameResult = validateName(data.lastName, 'Last name');
        if (!lastNameResult.valid) {
            errors.push(lastNameResult.error);
        } else {
            sanitizedData.lastName = lastNameResult.value;
        }
    }
    
    // Validate fullName
    if (data.fullName) {
        const nameResult = validateName(data.fullName, 'Full name');
        if (!nameResult.valid) {
            errors.push(nameResult.error);
        } else {
            sanitizedData.fullName = nameResult.value;
        }
    }
    
    // Validate gender (simple validation for allowed values)
    if (data.gender !== undefined && data.gender !== null) {
        const allowedGenders = ['Male', 'Female', 'Other', 'Prefer not to say', ''];
        if (allowedGenders.includes(data.gender)) {
            sanitizedData.gender = data.gender;
        } else {
            errors.push('Invalid gender selection');
        }
    }
    
    // Validate phone
    if (data.phone) {
        const phoneResult = validatePhone(data.phone);
        if (!phoneResult.valid) {
            errors.push(phoneResult.error);
        } else {
            sanitizedData.phone = phoneResult.value;
        }
    }
    
    // Validate address
    if (data.address) {
        const addressResult = validateAddress(data.address);
        if (!addressResult.valid) {
            errors.push(addressResult.error);
        } else {
            sanitizedData.address = addressResult.value;
        }
    }
    
    // Validate dateOfBirth
    if (data.dateOfBirth) {
        const dobResult = validateDateOfBirth(data.dateOfBirth);
        if (!dobResult.valid) {
            errors.push(dobResult.error);
        } else {
            sanitizedData.dateOfBirth = dobResult.value;
        }
    }
    
    // Validate age (if provided)
    if (data.age !== undefined && data.age !== null) {
        if (typeof data.age === 'number' && data.age >= 0 && data.age <= 150) {
            sanitizedData.age = data.age;
        } else {
            errors.push('Invalid age value');
        }
    }
    
    // Validate bio
    if (data.bio) {
        const bioResult = validateBio(data.bio);
        if (!bioResult.valid) {
            errors.push(bioResult.error);
        } else {
            sanitizedData.bio = bioResult.value;
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        sanitizedData
    };
}

/**
 * Rate limiting helper
 */
class RateLimiter {
    constructor() {
        this.attempts = new Map();
    }
    
    isAllowed(key, maxAttempts = 5, windowMs = 60000) {
        const now = Date.now();
        const userAttempts = this.attempts.get(key) || [];
        
        // Remove expired attempts
        const validAttempts = userAttempts.filter(time => now - time < windowMs);
        
        if (validAttempts.length >= maxAttempts) {
            return false;
        }
        
        validAttempts.push(now);
        this.attempts.set(key, validAttempts);
        
        return true;
    }
    
    reset(key) {
        this.attempts.delete(key);
    }
}

// Create global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Export all validation functions
 */
export {
    escapeHtml,
    sanitizeInput,
    sanitizeHtml,
    validateEmail,
    validatePassword,
    validateName,
    validatePhone,
    validateDateOfBirth,
    validateAddress,
    validateBio,
    validateUrl,
    validateFilename,
    validateMedicalCondition,
    validateCategory,
    validateDocumentName,
    validatePatientRegistrationForm,
    validateProfileUpdateData,
    validateSimplifiedSignUpForm,
    RateLimiter,
    rateLimiter
};

console.log('Validation utility loaded successfully'); 