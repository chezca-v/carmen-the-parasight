/**
 * Comprehensive Input Validation Schemas
 * This file contains validation schemas for all data types used in the application
 */

// Import validation utilities
import { 
    sanitizeInput, 
    sanitizeHtml, 
    validateEmail, 
    validatePassword, 
    validateName, 
    validatePhone, 
    validateUrl,
    validateFilename 
} from './validation.js';

/**
 * User Registration Schema
 */
export const userRegistrationSchema = {
    firstName: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s'-]+$/,
        sanitize: true,
        errorMessage: 'First name must be 2-50 characters and contain only letters'
    },
    lastName: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s'-]+$/,
        sanitize: true,
        errorMessage: 'Last name must be 2-50 characters and contain only letters'
    },
    email: {
        required: true,
        type: 'email',
        maxLength: 254,
        sanitize: true,
        validator: validateEmail,
        errorMessage: 'Please enter a valid email address'
    },
    password: {
        required: true,
        type: 'password',
        minLength: 8,
        maxLength: 128,
        validator: validatePassword,
        errorMessage: 'Password must meet security requirements'
    },
    phone: {
        required: false,
        type: 'phone',
        validator: validatePhone,
        errorMessage: 'Please enter a valid phone number'
    },
    dateOfBirth: {
        required: true,
        type: 'date',
        minAge: 13,
        maxAge: 120,
        errorMessage: 'Please enter a valid date of birth'
    }
};

/**
 * Patient Data Schema
 */
export const patientDataSchema = {
    id: {
        required: true,
        type: 'string',
        pattern: /^[a-zA-Z0-9_-]+$/,
        maxLength: 50,
        sanitize: true,
        errorMessage: 'Patient ID must contain only alphanumeric characters, hyphens, and underscores'
    },
    name: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s'-]+$/,
        sanitize: true,
        errorMessage: 'Name must be 2-100 characters and contain only letters'
    },
    age: {
        required: true,
        type: 'number',
        min: 0,
        max: 150,
        integer: true,
        errorMessage: 'Age must be a number between 0 and 150'
    },
    condition: {
        required: false,
        type: 'string',
        maxLength: 500,
        sanitize: true,
        errorMessage: 'Medical condition must be less than 500 characters'
    },
    medications: {
        required: false,
        type: 'array',
        maxItems: 50,
        itemType: 'string',
        itemMaxLength: 100,
        sanitize: true,
        errorMessage: 'Medications list is invalid'
    },
    contactInfo: {
        required: true,
        type: 'object',
        properties: {
            email: {
                required: false,
                type: 'email',
                validator: validateEmail
            },
            phone: {
                required: false,
                type: 'phone',
                validator: validatePhone
            }
        }
    }
};

/**
 * Medical Consultation Schema
 */
export const consultationSchema = {
    symptoms: {
        required: true,
        type: 'string',
        minLength: 10,
        maxLength: 1000,
        sanitize: true,
        errorMessage: 'Symptoms description must be 10-1000 characters'
    },
    patientHistory: {
        required: false,
        type: 'string',
        maxLength: 2000,
        sanitize: true,
        errorMessage: 'Patient history must be less than 2000 characters'
    },
    urgency: {
        required: true,
        type: 'enum',
        values: ['Low', 'Medium', 'High', 'Critical'],
        errorMessage: 'Urgency must be Low, Medium, High, or Critical'
    },
    patientId: {
        required: true,
        type: 'string',
        pattern: /^[a-zA-Z0-9_-]+$/,
        maxLength: 50,
        sanitize: true,
        errorMessage: 'Patient ID is invalid'
    }
};

/**
 * Organization Registration Schema
 */
export const organizationSchema = {
    name: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-\.\,\&]+$/,
        sanitize: true,
        errorMessage: 'Organization name must be 2-100 characters'
    },
    type: {
        required: true,
        type: 'enum',
        values: ['hospital', 'clinic', 'pharmacy', 'laboratory', 'other'],
        errorMessage: 'Please select a valid organization type'
    },
    description: {
        required: false,
        type: 'string',
        maxLength: 500,
        sanitize: true,
        errorMessage: 'Description must be less than 500 characters'
    },
    address: {
        required: true,
        type: 'object',
        properties: {
            street: {
                required: true,
                type: 'string',
                maxLength: 200,
                sanitize: true
            },
            city: {
                required: true,
                type: 'string',
                maxLength: 100,
                sanitize: true
            },
            state: {
                required: true,
                type: 'string',
                maxLength: 100,
                sanitize: true
            },
            zipCode: {
                required: true,
                type: 'string',
                pattern: /^[0-9\-\s]{3,20}$/,
                sanitize: true
            }
        }
    },
    contact: {
        required: true,
        type: 'object',
        properties: {
            email: {
                required: true,
                type: 'email',
                validator: validateEmail
            },
            phone: {
                required: true,
                type: 'phone',
                validator: validatePhone
            },
            website: {
                required: false,
                type: 'url',
                validator: validateUrl
            }
        }
    }
};

/**
 * File Upload Schema
 */
export const fileUploadSchema = {
    filename: {
        required: true,
        type: 'string',
        validator: validateFilename,
        errorMessage: 'Invalid filename'
    },
    size: {
        required: true,
        type: 'number',
        max: 10485760, // 10MB
        min: 1,
        errorMessage: 'File size must be between 1 byte and 10MB'
    },
    type: {
        required: true,
        type: 'enum',
        values: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'text/csv'],
        errorMessage: 'File type not allowed'
    }
};

/**
 * Search Query Schema
 */
export const searchQuerySchema = {
    query: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 200,
        sanitize: true,
        errorMessage: 'Search query must be 1-200 characters'
    },
    filters: {
        required: false,
        type: 'object',
        properties: {
            startDate: {
                required: false,
                type: 'date'
            },
            endDate: {
                required: false,
                type: 'date'
            },
            category: {
                required: false,
                type: 'string',
                maxLength: 50,
                sanitize: true
            }
        }
    },
    limit: {
        required: false,
        type: 'number',
        min: 1,
        max: 100,
        default: 20,
        errorMessage: 'Limit must be between 1 and 100'
    },
    offset: {
        required: false,
        type: 'number',
        min: 0,
        default: 0,
        errorMessage: 'Offset must be non-negative'
    }
};

/**
 * Generic Validation Function
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} - Validation result
 */
export function validateData(data, schema) {
    const errors = [];
    const sanitizedData = {};

    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];

        // Check required fields
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
        }

        // Skip validation if field is not required and not provided
        if (!rules.required && (value === undefined || value === null || value === '')) {
            continue;
        }

        // Type validation
        if (rules.type && !validateType(value, rules.type)) {
            errors.push(rules.errorMessage || `${field} has invalid type`);
            continue;
        }

        // Custom validator
        if (rules.validator && typeof rules.validator === 'function') {
            const result = rules.validator(value);
            if (!result.valid) {
                errors.push(result.error);
                continue;
            }
            sanitizedData[field] = result.value;
            continue;
        }

        // String validation
        if (rules.type === 'string') {
            let processedValue = value;

            if (rules.sanitize) {
                processedValue = sanitizeInput(value);
            }

            if (rules.minLength && processedValue.length < rules.minLength) {
                errors.push(`${field} must be at least ${rules.minLength} characters`);
                continue;
            }

            if (rules.maxLength && processedValue.length > rules.maxLength) {
                errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                continue;
            }

            if (rules.pattern && !rules.pattern.test(processedValue)) {
                errors.push(rules.errorMessage || `${field} format is invalid`);
                continue;
            }

            sanitizedData[field] = processedValue;
        }

        // Number validation
        else if (rules.type === 'number') {
            const numValue = parseFloat(value);
            
            if (isNaN(numValue) || !isFinite(numValue)) {
                errors.push(`${field} must be a valid number`);
                continue;
            }

            if (rules.integer && !Number.isInteger(numValue)) {
                errors.push(`${field} must be an integer`);
                continue;
            }

            if (rules.min !== undefined && numValue < rules.min) {
                errors.push(`${field} must be at least ${rules.min}`);
                continue;
            }

            if (rules.max !== undefined && numValue > rules.max) {
                errors.push(`${field} must be no more than ${rules.max}`);
                continue;
            }

            sanitizedData[field] = numValue;
        }

        // Enum validation
        else if (rules.type === 'enum') {
            if (!rules.values.includes(value)) {
                errors.push(rules.errorMessage || `${field} must be one of: ${rules.values.join(', ')}`);
                continue;
            }

            sanitizedData[field] = value;
        }

        // Array validation
        else if (rules.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`${field} must be an array`);
                continue;
            }

            if (rules.maxItems && value.length > rules.maxItems) {
                errors.push(`${field} can have at most ${rules.maxItems} items`);
                continue;
            }

            const sanitizedArray = value.map(item => {
                if (rules.itemType === 'string' && rules.sanitize) {
                    return sanitizeInput(item).substring(0, rules.itemMaxLength || 200);
                }
                return item;
            });

            sanitizedData[field] = sanitizedArray;
        }

        // Object validation
        else if (rules.type === 'object' && rules.properties) {
            const objectErrors = [];
            const sanitizedObject = {};

            for (const [prop, propRules] of Object.entries(rules.properties)) {
                const propValue = value[prop];

                if (propRules.required && (propValue === undefined || propValue === null || propValue === '')) {
                    objectErrors.push(`${field}.${prop} is required`);
                    continue;
                }

                if (propRules.validator && typeof propRules.validator === 'function') {
                    const result = propRules.validator(propValue);
                    if (!result.valid) {
                        objectErrors.push(`${field}.${prop}: ${result.error}`);
                        continue;
                    }
                    sanitizedObject[prop] = result.value;
                } else if (propRules.sanitize && typeof propValue === 'string') {
                    sanitizedObject[prop] = sanitizeInput(propValue);
                } else {
                    sanitizedObject[prop] = propValue;
                }
            }

            if (objectErrors.length > 0) {
                errors.push(...objectErrors);
            } else {
                sanitizedData[field] = sanitizedObject;
            }
        }

        // Default case
        else {
            sanitizedData[field] = rules.sanitize && typeof value === 'string' ? sanitizeInput(value) : value;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        data: sanitizedData
    };
}

/**
 * Type validation helper
 * @param {*} value - Value to validate
 * @param {string} type - Expected type
 * @returns {boolean} - Whether value matches type
 */
function validateType(value, type) {
    switch (type) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' || !isNaN(parseFloat(value));
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        case 'email':
        case 'phone':
        case 'url':
        case 'password':
        case 'date':
        case 'enum':
            return typeof value === 'string';
        default:
            return true;
    }
} 