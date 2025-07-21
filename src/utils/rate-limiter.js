// Enhanced Rate Limiting Utility
// Provides comprehensive rate limiting for frontend forms and API calls

/**
 * Enhanced Rate Limiter with multiple strategies and persistence
 */
class EnhancedRateLimiter {
    constructor() {
        this.attempts = new Map();
        this.persistenceKey = 'rate_limiter_data';
        this.loadFromStorage();
        
        // Clean up expired entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Load rate limiting data from sessionStorage
     */
    loadFromStorage() {
        try {
            const stored = sessionStorage.getItem(this.persistenceKey);
            if (stored) {
                const data = JSON.parse(stored);
                // Convert back to Map and filter out expired entries
                const now = Date.now();
                for (const [key, attempts] of Object.entries(data)) {
                    const validAttempts = attempts.filter(time => now - time < 24 * 60 * 60 * 1000); // 24 hours max
                    if (validAttempts.length > 0) {
                        this.attempts.set(key, validAttempts);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load rate limiter data:', error);
        }
    }

    /**
     * Save rate limiting data to sessionStorage
     */
    saveToStorage() {
        try {
            const data = Object.fromEntries(this.attempts);
            sessionStorage.setItem(this.persistenceKey, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save rate limiter data:', error);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, attempts] of this.attempts.entries()) {
            const validAttempts = attempts.filter(time => now - time < 24 * 60 * 60 * 1000);
            if (validAttempts.length === 0) {
                expiredKeys.push(key);
            } else if (validAttempts.length !== attempts.length) {
                this.attempts.set(key, validAttempts);
            }
        }
        
        expiredKeys.forEach(key => this.attempts.delete(key));
        this.saveToStorage();
    }

    /**
     * Check if an action is allowed based on rate limiting
     * @param {string} key - Unique identifier for the action/user
     * @param {number} maxAttempts - Maximum attempts allowed
     * @param {number} windowMs - Time window in milliseconds
     * @param {string} strategy - Rate limiting strategy ('sliding_window', 'fixed_window')
     * @returns {boolean} - Whether the action is allowed
     */
    isAllowed(key, maxAttempts = 5, windowMs = 60000, strategy = 'sliding_window') {
        const now = Date.now();
        const userAttempts = this.attempts.get(key) || [];
        
        let validAttempts;
        
        switch (strategy) {
            case 'sliding_window':
                // Remove attempts outside the time window
                validAttempts = userAttempts.filter(time => now - time < windowMs);
                break;
                
            case 'fixed_window':
                // Fixed time window (e.g., per minute, per hour)
                const windowStart = Math.floor(now / windowMs) * windowMs;
                validAttempts = userAttempts.filter(time => time >= windowStart);
                break;
                
            default:
                validAttempts = userAttempts.filter(time => now - time < windowMs);
        }
        
        return validAttempts.length < maxAttempts;
    }

    /**
     * Record an attempt
     * @param {string} key - Unique identifier for the action/user
     * @param {number} maxAttempts - Maximum attempts allowed
     * @param {number} windowMs - Time window in milliseconds
     * @param {string} strategy - Rate limiting strategy
     * @returns {boolean} - Whether the action is still allowed after recording
     */
    recordAttempt(key, maxAttempts = 5, windowMs = 60000, strategy = 'sliding_window') {
        if (!this.isAllowed(key, maxAttempts, windowMs, strategy)) {
            return false;
        }
        
        const now = Date.now();
        const userAttempts = this.attempts.get(key) || [];
        
        userAttempts.push(now);
        this.attempts.set(key, userAttempts);
        this.saveToStorage();
        
        return this.isAllowed(key, maxAttempts, windowMs, strategy);
    }

    /**
     * Reset attempts for a specific key
     * @param {string} key - Unique identifier for the action/user
     */
    reset(key) {
        this.attempts.delete(key);
        this.saveToStorage();
    }

    /**
     * Get remaining attempts for a key
     * @param {string} key - Unique identifier for the action/user
     * @param {number} maxAttempts - Maximum attempts allowed
     * @param {number} windowMs - Time window in milliseconds
     * @param {string} strategy - Rate limiting strategy
     * @returns {number} - Number of attempts remaining
     */
    getRemainingAttempts(key, maxAttempts = 5, windowMs = 60000, strategy = 'sliding_window') {
        const now = Date.now();
        const userAttempts = this.attempts.get(key) || [];
        
        let validAttempts;
        
        switch (strategy) {
            case 'sliding_window':
                validAttempts = userAttempts.filter(time => now - time < windowMs);
                break;
            case 'fixed_window':
                const windowStart = Math.floor(now / windowMs) * windowMs;
                validAttempts = userAttempts.filter(time => time >= windowStart);
                break;
            default:
                validAttempts = userAttempts.filter(time => now - time < windowMs);
        }
        
        return Math.max(0, maxAttempts - validAttempts.length);
    }

    /**
     * Get time until reset for a specific key
     * @param {string} key - Unique identifier for the action/user
     * @param {number} windowMs - Time window in milliseconds
     * @returns {number} - Milliseconds until rate limit resets
     */
    getTimeUntilReset(key, windowMs = 60000) {
        const userAttempts = this.attempts.get(key) || [];
        if (userAttempts.length === 0) {
            return 0;
        }
        
        const oldestAttempt = Math.min(...userAttempts);
        const resetTime = oldestAttempt + windowMs;
        return Math.max(0, resetTime - Date.now());
    }
}

/**
 * Predefined rate limiting configurations for common use cases
 */
const RATE_LIMIT_CONFIGS = {
    // Authentication attempts
    LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000, strategy: 'sliding_window' }, // 5 attempts per 15 minutes
    REGISTRATION: { maxAttempts: 3, windowMs: 10 * 60 * 1000, strategy: 'sliding_window' }, // 3 attempts per 10 minutes
    FORGOT_PASSWORD: { maxAttempts: 2, windowMs: 5 * 60 * 1000, strategy: 'sliding_window' }, // 2 attempts per 5 minutes
    
    // Form submissions
    CONTACT_FORM: { maxAttempts: 3, windowMs: 5 * 60 * 1000, strategy: 'sliding_window' }, // 3 attempts per 5 minutes
    PROFILE_UPDATE: { maxAttempts: 10, windowMs: 5 * 60 * 1000, strategy: 'sliding_window' }, // 10 attempts per 5 minutes
    
    // API calls
    API_GENERAL: { maxAttempts: 30, windowMs: 60 * 1000, strategy: 'sliding_window' }, // 30 calls per minute
    API_SENSITIVE: { maxAttempts: 5, windowMs: 60 * 1000, strategy: 'sliding_window' }, // 5 calls per minute
    
    // Search and analytics
    SEARCH: { maxAttempts: 20, windowMs: 60 * 1000, strategy: 'sliding_window' }, // 20 searches per minute
    
    // File uploads
    FILE_UPLOAD: { maxAttempts: 5, windowMs: 5 * 60 * 1000, strategy: 'sliding_window' }, // 5 uploads per 5 minutes
    
    // Very strict for security-sensitive operations
    ADMIN_ACTION: { maxAttempts: 3, windowMs: 10 * 60 * 1000, strategy: 'sliding_window' }, // 3 attempts per 10 minutes
    DELETE_ACTION: { maxAttempts: 2, windowMs: 5 * 60 * 1000, strategy: 'sliding_window' }, // 2 attempts per 5 minutes
};

/**
 * Create a rate-limited wrapper for functions
 * @param {Function} fn - Function to wrap
 * @param {string} key - Rate limit key
 * @param {Object} config - Rate limit configuration
 * @returns {Function} - Rate-limited function
 */
function rateLimited(fn, key, config = RATE_LIMIT_CONFIGS.API_GENERAL) {
    return async function(...args) {
        if (!enhancedRateLimiter.recordAttempt(key, config.maxAttempts, config.windowMs, config.strategy)) {
            const timeUntilReset = enhancedRateLimiter.getTimeUntilReset(key, config.windowMs);
            const minutes = Math.ceil(timeUntilReset / 60000);
            throw new Error(`Rate limit exceeded. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
        }
        
        return await fn.apply(this, args);
    };
}

/**
 * Form rate limiting helper
 * @param {HTMLFormElement} form - Form element
 * @param {string} formType - Type of form for rate limiting
 * @param {Function} onRateLimit - Callback when rate limited
 */
function protectForm(form, formType, onRateLimit = null) {
    if (!form || !formType) return;
    
    const config = RATE_LIMIT_CONFIGS[formType] || RATE_LIMIT_CONFIGS.API_GENERAL;
    
    form.addEventListener('submit', (e) => {
        const key = `form_${formType}_${form.id || 'default'}`;
        
        if (!enhancedRateLimiter.isAllowed(key, config.maxAttempts, config.windowMs, config.strategy)) {
            e.preventDefault();
            e.stopPropagation();
            
            const timeUntilReset = enhancedRateLimiter.getTimeUntilReset(key, config.windowMs);
            const minutes = Math.ceil(timeUntilReset / 60000);
            const message = `Too many form submissions. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before trying again.`;
            
            if (onRateLimit) {
                onRateLimit(message);
            } else {
                alert(message);
            }
            
            return false;
        }
        
        // Record the attempt
        enhancedRateLimiter.recordAttempt(key, config.maxAttempts, config.windowMs, config.strategy);
    });
}

/**
 * API call rate limiting wrapper
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string} category - Rate limit category
 * @returns {Promise} - Fetch promise
 */
async function rateLimitedFetch(url, options = {}, category = 'API_GENERAL') {
    const config = RATE_LIMIT_CONFIGS[category] || RATE_LIMIT_CONFIGS.API_GENERAL;
    const key = `api_${category}_${url}`;
    
    if (!enhancedRateLimiter.recordAttempt(key, config.maxAttempts, config.windowMs, config.strategy)) {
        const timeUntilReset = enhancedRateLimiter.getTimeUntilReset(key, config.windowMs);
        const minutes = Math.ceil(timeUntilReset / 60000);
        throw new Error(`API rate limit exceeded for ${url}. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
    }
    
    return fetch(url, options);
}

// Create global enhanced rate limiter instance
const enhancedRateLimiter = new EnhancedRateLimiter();

// Export the enhanced rate limiter and utilities
export {
    EnhancedRateLimiter,
    enhancedRateLimiter,
    RATE_LIMIT_CONFIGS,
    rateLimited,
    protectForm,
    rateLimitedFetch
};

// Make it available globally for easier use
if (typeof window !== 'undefined') {
    window.enhancedRateLimiter = enhancedRateLimiter;
    window.rateLimitedFetch = rateLimitedFetch;
    window.protectForm = protectForm;
} 