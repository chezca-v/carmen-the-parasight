/**
 * Environment Detection Utility
 * Provides reliable environment detection across different deployment scenarios
 */

class Environment {
    constructor() {
        this._isProduction = null;
        this._environment = null;
    }

    /**
     * Detect if the application is running in production
     * @returns {boolean} True if in production, false otherwise
     */
    isProduction() {
        if (this._isProduction !== null) {
            return this._isProduction;
        }

        // Multiple ways to detect production environment
        const checks = [
            // 1. Vite environment variable
            () => {
                if (typeof import.meta !== 'undefined' && import.meta.env) {
                    return import.meta.env.PROD === true || 
                           import.meta.env.MODE === 'production' ||
                           import.meta.env.NODE_ENV === 'production';
                }
                return false;
            },

            // 2. Node.js environment variable
            () => {
                if (typeof process !== 'undefined' && process.env) {
                    return process.env.NODE_ENV === 'production';
                }
                return false;
            },

            // 3. Production domains (common deployment platforms)
            () => {
                if (typeof window !== 'undefined' && window.location) {
                    const hostname = window.location.hostname;
                    const productionDomains = [
                        'vercel.app',
                        'netlify.app',
                        'herokuapp.com',
                        'firebaseapp.com',
                        'github.io',
                        'lingaplink.com', // Add your production domain
                        'carmen-para-sight.vercel.app'
                    ];
                    
                    return productionDomains.some(domain => 
                        hostname.includes(domain) || hostname.endsWith(domain)
                    );
                }
                return false;
            },

            // 4. HTTPS + non-localhost indicates production
            () => {
                if (typeof window !== 'undefined' && window.location) {
                    const isHTTPS = window.location.protocol === 'https:';
                    const isNotLocalhost = !window.location.hostname.includes('localhost') &&
                                          !window.location.hostname.includes('127.0.0.1') &&
                                          !window.location.hostname.includes('0.0.0.0');
                    return isHTTPS && isNotLocalhost;
                }
                return false;
            }
        ];

        // Run all checks - if any returns true, we're in production
        this._isProduction = checks.some(check => {
            try {
                return check();
            } catch (error) {
                return false;
            }
        });

        return this._isProduction;
    }

    /**
     * Get the current environment name
     * @returns {string} Environment name: 'production', 'development', 'test'
     */
    getEnvironment() {
        if (this._environment !== null) {
            return this._environment;
        }

        if (this.isProduction()) {
            this._environment = 'production';
        } else if (this.isTest()) {
            this._environment = 'test';
        } else {
            this._environment = 'development';
        }

        return this._environment;
    }

    /**
     * Check if running in development mode
     * @returns {boolean}
     */
    isDevelopment() {
        return !this.isProduction() && !this.isTest();
    }

    /**
     * Check if running in test mode
     * @returns {boolean}
     */
    isTest() {
        // Check for test environment indicators
        const testChecks = [
            () => {
                if (typeof process !== 'undefined' && process.env) {
                    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing';
                }
                return false;
            },
            () => {
                if (typeof import.meta !== 'undefined' && import.meta.env) {
                    return import.meta.env.MODE === 'test' || import.meta.env.MODE === 'testing';
                }
                return false;
            },
            () => {
                // Check for common test runners
                if (typeof window !== 'undefined') {
                    return Boolean(window.__karma__ || window.jasmine || window.mocha);
                }
                return false;
            }
        ];

        return testChecks.some(check => {
            try {
                return check();
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Get environment information for debugging
     * @returns {object}
     */
    getInfo() {
        return {
            environment: this.getEnvironment(),
            isProduction: this.isProduction(),
            isDevelopment: this.isDevelopment(),
            isTest: this.isTest(),
            hostname: typeof window !== 'undefined' ? window.location?.hostname : 'unknown',
            protocol: typeof window !== 'undefined' ? window.location?.protocol : 'unknown',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        };
    }
}

// Create singleton instance
const environment = new Environment();

export default environment; 