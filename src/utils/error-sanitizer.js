/**
 * ERROR MESSAGE SANITIZER UTILITY
 * 
 * Prevents information leakage by sanitizing error messages in production
 * while maintaining useful debugging information in development.
 * 
 * Security Features:
 * - Removes stack traces from client responses
 * - Sanitizes technical error details
 * - Prevents database schema leakage
 * - Standardizes error response format
 * - Logs detailed errors server-side only
 */

// Environment detection
const isProduction = () => {
    // Check for Node.js environment
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
        return true;
    }
    
    // Check for Vite/modern frontend build environment
    if (typeof import.meta.env !== 'undefined' && import.meta.env.PROD) {
        return true;
    }
    
    // Fallback for browser environments if no specific variable is set
    // Assumes production if not explicitly in development
    if (typeof window !== 'undefined') {
        return !['localhost', '127.0.0.1'].includes(window.location.hostname);
    }

    // Default to production for safety if environment cannot be determined
    return true;
};

// Safe error messages for production
const SAFE_ERROR_MESSAGES = {
    // Authentication errors
    'auth/user-not-found': 'Invalid login credentials',
    'auth/wrong-password': 'Invalid login credentials',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/user-disabled': 'Account access has been restricted',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'auth/email-already-in-use': 'Email address is already registered',
    'auth/weak-password': 'Password does not meet security requirements',
    'auth/operation-not-allowed': 'This operation is not available',
    
    // Database errors  
    'permission-denied': 'Access denied',
    'not-found': 'Requested resource not found',
    'already-exists': 'Resource already exists',
    'failed-precondition': 'Operation cannot be completed',
    'out-of-range': 'Invalid request parameters',
    'invalid-argument': 'Invalid request data',
    'deadline-exceeded': 'Request timeout',
    'unavailable': 'Service temporarily unavailable',
    
    // Generic errors
    'validation-error': 'Invalid input data',
    'rate-limit-exceeded': 'Too many requests. Please try again later',
    'internal-error': 'An unexpected error occurred',
    'network-error': 'Network connection error',
    'timeout-error': 'Request timeout',
    'forbidden': 'Access forbidden',
    'unauthorized': 'Authentication required'
};

/**
 * Sanitizes error messages for client responses
 * @param {Error|Object|string} error - The error to sanitize
 * @param {Object} options - Configuration options
 * @returns {Object} Sanitized error response
 */
function sanitizeError(error, options = {}) {
    const {
        includeCode = false,
        includeDetails = false,
        logOriginal = true,
        context = 'general'
    } = options;
    
    // Log original error for debugging (server-side only)
    if (logOriginal && typeof console !== 'undefined') {
        console.error(`[${context}] Original error:`, error);
    }
    
    // Extract error information
    let errorCode = '';
    let errorMessage = '';
    let originalMessage = '';
    
    if (error && typeof error === 'object') {
        errorCode = error.code || error.name || 'unknown-error';
        errorMessage = error.message || '';
        originalMessage = errorMessage;
    } else if (typeof error === 'string') {
        originalMessage = error;
        errorMessage = error;
        errorCode = 'string-error';
    } else {
        originalMessage = String(error);
        errorMessage = 'Unknown error occurred';
        errorCode = 'unknown-error';
    }
    
    // In production, use safe messages
    if (isProduction()) {
        // Check for known error codes
        const safeMessage = SAFE_ERROR_MESSAGES[errorCode];
        if (safeMessage) {
            errorMessage = safeMessage;
        } else {
            // Check for error message patterns
            if (errorMessage.toLowerCase().includes('password')) {
                errorMessage = 'Authentication failed';
            } else if (errorMessage.toLowerCase().includes('email')) {
                errorMessage = 'Invalid email address';
            } else if (errorMessage.toLowerCase().includes('permission') || 
                      errorMessage.toLowerCase().includes('unauthorized') ||
                      errorMessage.toLowerCase().includes('forbidden')) {
                errorMessage = 'Access denied';
            } else if (errorMessage.toLowerCase().includes('network') ||
                      errorMessage.toLowerCase().includes('connection')) {
                errorMessage = 'Network error occurred';
            } else if (errorMessage.toLowerCase().includes('timeout')) {
                errorMessage = 'Request timeout';
            } else if (errorMessage.toLowerCase().includes('rate limit') ||
                      errorMessage.toLowerCase().includes('too many')) {
                errorMessage = 'Too many requests. Please try again later';
            } else {
                // Default safe message
                errorMessage = 'An error occurred. Please try again';
            }
        }
    }
    
    // Build sanitized response
    const sanitizedResponse = {
        error: errorMessage,
        timestamp: new Date().toISOString()
    };
    
    // Only include error codes in development or if explicitly requested
    if ((includeCode || !isProduction()) && errorCode) {
        sanitizedResponse.code = errorCode;
    }
    
    // Only include details in development or if explicitly requested
    if ((includeDetails || !isProduction()) && originalMessage !== errorMessage) {
        sanitizedResponse.originalMessage = originalMessage;
    }
    
    return sanitizedResponse;
}

/**
 * Sanitizes validation errors
 * @param {Array} validationErrors - Array of validation errors
 * @returns {Object} Sanitized validation response
 */
function sanitizeValidationErrors(validationErrors) {
    if (isProduction()) {
        // In production, return generic validation error
        return {
            error: 'Invalid input data',
            message: 'Please check your input and try again',
            timestamp: new Date().toISOString()
        };
    }
    
    // In development, return helpful but safe validation details
    const sanitizedErrors = validationErrors.map(err => ({
        field: err.param || err.path || 'unknown',
        message: err.msg || 'Invalid value',
        value: undefined // Never return the actual value
    }));
    
    return {
        error: 'Validation Error',
        message: 'Please correct the following issues',
        details: sanitizedErrors,
        timestamp: new Date().toISOString()
    };
}

/**
 * Creates a safe error response for HTTP APIs
 * @param {Error} error - The error object
 * @param {number} statusCode - HTTP status code
 * @param {Object} options - Additional options
 * @returns {Object} Safe HTTP error response
 */
function createSafeErrorResponse(error, statusCode = 500, options = {}) {
    const sanitized = sanitizeError(error, {
        context: options.context || 'http-api',
        ...options
    });
    
    return {
        status: statusCode,
        error: sanitized.error,
        timestamp: sanitized.timestamp,
        ...(sanitized.code && { code: sanitized.code }),
        ...(sanitized.originalMessage && { debug: sanitized.originalMessage })
    };
}

/**
 * Middleware for Express.js error handling
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function secureErrorHandler(err, req, res, next) {
    // Log original error for debugging
    console.error(`[${req.method} ${req.path}] Error:`, err);
    
    // Determine status code
    let statusCode = err.status || err.statusCode || 500;
    
    // Special handling for specific error types
    if (err.code) {
        if (err.code.startsWith('auth/')) {
            statusCode = 401;
        } else if (err.code === 'permission-denied') {
            statusCode = 403;
        } else if (err.code === 'not-found') {
            statusCode = 404;
        } else if (err.code === 'already-exists') {
            statusCode = 409;
        }
    }
    
    // Create safe response
    const safeResponse = createSafeErrorResponse(err, statusCode, {
        context: `${req.method} ${req.path}`
    });
    
    // Send response
    res.status(statusCode).json(safeResponse);
}

/**
 * Safely logs errors without exposing sensitive information
 * @param {string} context - Context of the error
 * @param {Error} error - Error object
 * @param {Object} additionalInfo - Additional safe information to log
 */
function secureErrorLog(context, error, additionalInfo = {}) {
    const timestamp = new Date().toISOString();
    
    // Safe information to log
    const logEntry = {
        timestamp,
        context,
        error: {
            message: error.message,
            code: error.code,
            name: error.name,
            ...(isProduction() ? {} : { stack: error.stack })
        },
        ...additionalInfo
    };
    
    console.error('Secure Error Log:', JSON.stringify(logEntry, null, 2));
}

// Export for use in both Node.js and browser environments
const errorSanitizerModule = {
    sanitizeError,
    sanitizeValidationErrors,
    createSafeErrorResponse,
    secureErrorHandler,
    secureErrorLog,
    isProduction
};

// Support both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = errorSanitizerModule;
} else if (typeof window !== 'undefined') {
    window.errorSanitizer = errorSanitizerModule;
}

export default errorSanitizerModule; 