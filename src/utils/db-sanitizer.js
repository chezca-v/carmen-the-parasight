/**
 * Database Query Sanitizer
 * Prevents SQL injection and ensures safe database operations
 */

class DatabaseSanitizer {
    constructor() {
        this.dangerousPatterns = [
            // SQL injection patterns
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|cast|convert|xp_|sp_)\b)/gi,
            // Comment patterns
            /(--|#|\/\*|\*\/)/g,
            // Delimiter patterns
            /(;|\||&|`|'|"|\\|\/)/g,
            // Batch execution
            /go\s*$/gi,
            // Stored procedure execution
            /exec\s+sp_/gi,
            // Dynamic SQL
            /execute\s+immediate/gi,
            // Shell commands
            /(cmd|powershell|bash|sh)\s+/gi
        ];
        
        this.maxParamLength = 1000;
        this.maxQueryLength = 10000;
    }

    /**
     * Sanitize SQL parameter value
     */
    sanitizeParam(param) {
        if (param === null || param === undefined) {
            return null;
        }
        
        if (typeof param === 'string') {
            // Remove dangerous patterns
            let sanitized = param;
            this.dangerousPatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '');
            });
            
            // Trim and limit length
            sanitized = sanitized.trim();
            if (sanitized.length > this.maxParamLength) {
                sanitized = sanitized.substring(0, this.maxParamLength);
            }
            
            return sanitized;
        }
        
        if (typeof param === 'number') {
            // Ensure it's a finite number
            return isFinite(param) ? param : 0;
        }
        
        if (typeof param === 'boolean') {
            return param;
        }
        
        if (Array.isArray(param)) {
            // Recursively sanitize array elements
            return param.map(item => this.sanitizeParam(item));
        }
        
        if (typeof param === 'object') {
            // Recursively sanitize object properties
            const sanitized = {};
            for (const [key, value] of Object.entries(param)) {
                sanitized[key] = this.sanitizeParam(value);
            }
            return sanitized;
        }
        
        return param;
    }

    /**
     * Sanitize entire query object
     */
    sanitizeQuery(queryObj) {
        if (!queryObj || typeof queryObj !== 'object') {
            throw new Error('Invalid query object');
        }
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(queryObj)) {
            if (key === 'query' || key === 'sql') {
                // Sanitize the actual SQL query
                sanitized[key] = this.sanitizeSQLQuery(value);
            } else if (key === 'params' || key === 'values') {
                // Sanitize parameters
                sanitized[key] = this.sanitizeParams(value);
            } else if (key === 'options' || key === 'config') {
                // Sanitize configuration options
                sanitized[key] = this.sanitizeOptions(value);
            } else {
                // Sanitize other properties
                sanitized[key] = this.sanitizeParam(value);
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitize SQL query string
     */
    sanitizeSQLQuery(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid SQL query');
        }
        
        // Remove dangerous patterns
        let sanitized = query;
        this.dangerousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        
        // Check query length
        if (sanitized.length > this.maxQueryLength) {
            throw new Error('Query too long');
        }
        
        // Ensure query starts with allowed operations
        const allowedOperations = /^(select|insert|update|delete|create|drop|alter)/i;
        if (!allowedOperations.test(sanitized.trim())) {
            throw new Error('Invalid query operation');
        }
        
        return sanitized.trim();
    }

    /**
     * Sanitize query parameters
     */
    sanitizeParams(params) {
        if (!params) return {};
        
        if (Array.isArray(params)) {
            return params.map(param => this.sanitizeParam(param));
        }
        
        if (typeof params === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(params)) {
                sanitized[key] = this.sanitizeParam(value);
            }
            return sanitized;
        }
        
        return this.sanitizeParam(params);
    }

    /**
     * Sanitize query options
     */
    sanitizeOptions(options) {
        if (!options || typeof options !== 'object') return {};
        
        const sanitized = {};
        const allowedOptions = [
            'limit', 'offset', 'orderBy', 'groupBy', 'having',
            'timeout', 'retries', 'cache', 'index'
        ];
        
        for (const [key, value] of Object.entries(options)) {
            if (allowedOptions.includes(key)) {
                sanitized[key] = this.sanitizeParam(value);
            }
        }
        
        return sanitized;
    }

    /**
     * Validate query structure
     */
    validateQueryStructure(queryObj) {
        const requiredFields = ['query', 'params'];
        const missingFields = requiredFields.filter(field => !queryObj[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        if (typeof queryObj.query !== 'string') {
            throw new Error('Query must be a string');
        }
        
        if (queryObj.query.trim().length === 0) {
            throw new Error('Query cannot be empty');
        }
        
        return true;
    }

    /**
     * Create safe parameterized query
     */
    createSafeQuery(query, params = {}) {
        const sanitizedQuery = this.sanitizeSQLQuery(query);
        const sanitizedParams = this.sanitizeParams(params);
        
        return {
            query: sanitizedQuery,
            params: sanitizedParams,
            timestamp: new Date().toISOString(),
            sanitized: true
        };
    }

    /**
     * Validate Firestore query
     */
    validateFirestoreQuery(queryObj) {
        if (!queryObj || typeof queryObj !== 'object') {
            throw new Error('Invalid Firestore query object');
        }
        
        const allowedOperations = ['get', 'add', 'set', 'update', 'delete', 'where', 'orderBy', 'limit'];
        const sanitized = {};
        
        for (const [key, value] of Object.entries(queryObj)) {
            if (allowedOperations.includes(key)) {
                if (key === 'where') {
                    sanitized[key] = this.sanitizeFirestoreWhere(value);
                } else {
                    sanitized[key] = this.sanitizeParam(value);
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitize Firestore where clause
     */
    sanitizeFirestoreWhere(whereClause) {
        if (!Array.isArray(whereClause)) {
            throw new Error('Where clause must be an array');
        }
        
        return whereClause.map(clause => {
            if (Array.isArray(clause) && clause.length >= 3) {
                const [field, operator, value] = clause;
                return [
                    this.sanitizeParam(field),
                    this.sanitizeParam(operator),
                    this.sanitizeParam(value)
                ];
            }
            throw new Error('Invalid where clause format');
        });
    }

    /**
     * Sanitize MongoDB query
     */
    validateMongoQuery(queryObj) {
        if (!queryObj || typeof queryObj !== 'object') {
            throw new Error('Invalid MongoDB query object');
        }
        
        // Check for dangerous MongoDB operators
        const dangerousOperators = ['$where', '$eval', '$code', '$regex'];
        const sanitized = {};
        
        for (const [key, value] of Object.entries(queryObj)) {
            if (dangerousOperators.includes(key)) {
                throw new Error(`Dangerous MongoDB operator not allowed: ${key}`);
            }
            
            if (key === '$regex' && typeof value === 'string') {
                // Ensure regex is safe
                if (value.includes('^') || value.includes('$') || value.includes('.*')) {
                    throw new Error('Potentially dangerous regex pattern');
                }
                sanitized[key] = this.sanitizeParam(value);
            } else {
                sanitized[key] = this.sanitizeParam(value);
            }
        }
        
        return sanitized;
    }

    /**
     * Get sanitization statistics
     */
    getSanitizationStats() {
        return {
            maxParamLength: this.maxParamLength,
            maxQueryLength: this.maxQueryLength,
            dangerousPatterns: this.dangerousPatterns.length,
            timestamp: new Date().toISOString()
        };
    }
}

// Create singleton instance
const dbSanitizer = new DatabaseSanitizer();

export default dbSanitizer;



