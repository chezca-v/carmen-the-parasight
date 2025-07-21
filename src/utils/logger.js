/**
 * Production-Safe Logger Utility
 * Provides logging that respects production environment settings
 */

import environment from './environment.js';

class Logger {
    constructor() {
        this.isProduction = environment.isProduction();
        this.isDevelopment = environment.isDevelopment();
        
        // Log levels (lower number = higher priority)
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        // Set default log level based on environment
        this.currentLevel = this.isProduction ? this.levels.warn : this.levels.debug;
    }

    /**
     * Check if a log level should be displayed
     * @param {string} level - The log level to check
     * @returns {boolean}
     */
    shouldLog(level) {
        return this.levels[level] <= this.currentLevel;
    }

    /**
     * Format log message with timestamp and level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param  {...any} args - Additional arguments
     * @returns {array} Formatted arguments for console
     */
    formatMessage(level, message, ...args) {
        if (this.isProduction) {
            // In production, return minimal formatting
            return [message, ...args];
        }

        // In development, add rich formatting
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const levelIcon = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🐛',
            trace: '🔍'
        };

        return [
            `${levelIcon[level]} [${timestamp}] ${message}`,
            ...args
        ];
    }

    /**
     * Error logging - always shown (even in production for critical errors)
     * @param {string} message - Error message
     * @param  {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(...this.formatMessage('error', message, ...args));
        }
    }

    /**
     * Warning logging - shown in production for important warnings
     * @param {string} message - Warning message
     * @param  {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(...this.formatMessage('warn', message, ...args));
        }
    }

    /**
     * Info logging - hidden in production
     * @param {string} message - Info message
     * @param  {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.info(...this.formatMessage('info', message, ...args));
        }
    }

    /**
     * Debug logging - only in development
     * @param {string} message - Debug message
     * @param  {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.log(...this.formatMessage('debug', message, ...args));
        }
    }

    /**
     * Trace logging - only in development
     * @param {string} message - Trace message
     * @param  {...any} args - Additional arguments
     */
    trace(message, ...args) {
        if (this.shouldLog('trace')) {
            console.trace(...this.formatMessage('trace', message, ...args));
        }
    }

    /**
     * Group logging for complex operations
     * @param {string} groupName - Name of the log group
     * @param {function} callback - Function to execute within the group
     */
    group(groupName, callback) {
        if (this.isDevelopment) {
            console.group(groupName);
            try {
                callback();
            } finally {
                console.groupEnd();
            }
        } else {
            // In production, just execute without grouping
            callback();
        }
    }

    /**
     * Time logging for performance monitoring
     * @param {string} label - Timer label
     */
    time(label) {
        if (this.isDevelopment) {
            console.time(label);
        }
    }

    /**
     * End time logging
     * @param {string} label - Timer label
     */
    timeEnd(label) {
        if (this.isDevelopment) {
            console.timeEnd(label);
        }
    }

    /**
     * Table logging for structured data
     * @param {any} data - Data to display in table format
     */
    table(data) {
        if (this.isDevelopment) {
            console.table(data);
        }
    }

    /**
     * Set log level
     * @param {string} level - New log level
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.currentLevel = this.levels[level];
        }
    }

    /**
     * Development-only logging
     * @param {string} message - Message to log
     * @param  {...any} args - Additional arguments
     */
    dev(message, ...args) {
        if (this.isDevelopment) {
            console.log(`🔧 [DEV]`, message, ...args);
        }
    }

    /**
     * Production-safe performance logging
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     */
    performance(operation, duration) {
        if (this.isDevelopment) {
            console.log(`⚡ Performance: ${operation} took ${duration.toFixed(2)}ms`);
        } else if (duration > 1000) {
            // Only log slow operations in production
            this.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
        }
    }
}

// Create singleton instance
const logger = new Logger();

// Also provide direct console replacement functions for easy migration
export const developmentConsole = {
    log: (...args) => logger.debug(...args),
    info: (...args) => logger.info(...args),
    warn: (...args) => logger.warn(...args),
    error: (...args) => logger.error(...args),
    debug: (...args) => logger.debug(...args),
    trace: (...args) => logger.trace(...args),
    group: (name, callback) => logger.group(name, callback),
    time: (label) => logger.time(label),
    timeEnd: (label) => logger.timeEnd(label),
    table: (data) => logger.table(data)
};

export default logger; 