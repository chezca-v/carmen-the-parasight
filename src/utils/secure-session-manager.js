/**
 * Secure Session Manager
 * Replaces localStorage with secure alternatives for sensitive data
 * Uses sessionStorage for non-sensitive data and in-memory storage for sensitive information
 */

class SecureSessionManager {
    constructor() {
        // In-memory storage for sensitive data (cleared on page refresh/close)
        this.sensitiveData = new Map();
        
        // Session storage keys for non-sensitive data
        this.sessionKeys = {
            SESSION_START: 'auth_session_start',
            LAST_ACTIVITY: 'auth_last_activity',
            USER_PREFERENCES: 'user_preferences',
            UI_STATE: 'ui_state',
            FORM_PROGRESS: 'form_progress'
        };
        
        // Secure storage keys for rate limiting and security
        this.secureKeys = {
            LOGIN_ATTEMPTS: 'auth_login_attempts',
            LOCKOUT_UNTIL: 'auth_lockout_until',
            CSRF_TOKEN: 'auth_csrf_token'
        };
        
        this.sessionActive = false;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.warningTime = 5 * 60 * 1000; // 5 minutes before timeout
        
        // Set up session monitoring
        this.setupSessionMonitoring();
        
        // Set up beforeunload handler to clear sensitive data
        this.setupBeforeUnloadHandler();
    }

    /**
     * Store sensitive data in memory only
     * @param {string} key - Data key
     * @param {*} value - Data value
     */
    setSensitiveData(key, value) {
        this.sensitiveData.set(key, {
            value,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.sessionTimeout
        });
    }

    /**
     * Get sensitive data from memory
     * @param {string} key - Data key
     * @returns {*} Data value or null if not found/expired
     */
    getSensitiveData(key) {
        const data = this.sensitiveData.get(key);
        if (!data) return null;
        
        // Check if data has expired
        if (Date.now() > data.expiresAt) {
            this.sensitiveData.delete(key);
            return null;
        }
        
        return data.value;
    }

    /**
     * Store non-sensitive data in sessionStorage
     * @param {string} key - Data key
     * @param {*} value - Data value
     */
    setSessionData(key, value) {
        try {
            if (this.sessionKeys[key] || key.startsWith('ui_') || key.startsWith('form_')) {
                sessionStorage.setItem(key, JSON.stringify({
                    value,
                    timestamp: Date.now()
                }));
            } else {
                console.warn('Attempted to store potentially sensitive data in sessionStorage:', key);
            }
        } catch (error) {
            console.warn('Failed to store session data:', error.message);
        }
    }

    /**
     * Get non-sensitive data from sessionStorage
     * @param {string} key - Data key
     * @returns {*} Data value or null if not found
     */
    getSessionData(key) {
        try {
            if (this.sessionKeys[key] || key.startsWith('ui_') || key.startsWith('form_')) {
                const data = sessionStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    return parsed.value;
                }
            }
        } catch (error) {
            console.warn('Failed to retrieve session data:', error.message);
        }
        return null;
    }

    /**
     * Store security-related data in localStorage (for persistence across sessions)
     * @param {string} key - Data key
     * @param {*} value - Data value
     */
    setSecureData(key, value) {
        try {
            if (this.secureKeys[key]) {
                localStorage.setItem(key, JSON.stringify({
                    value,
                    timestamp: Date.now()
                }));
            } else {
                console.warn('Attempted to store data with non-secure key:', key);
            }
        } catch (error) {
            console.warn('Failed to store secure data:', error.message);
        }
    }

    /**
     * Get security-related data from localStorage
     * @param {string} key - Data key
     * @returns {*} Data value or null if not found
     */
    getSecureData(key) {
        try {
            if (this.secureKeys[key]) {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    return parsed.value;
                }
            }
        } catch (error) {
            console.warn('Failed to retrieve secure data:', error.message);
        }
        return null;
    }

    /**
     * Start a secure session
     * @param {Object} user - User object
     */
    startSession(user) {
        const now = Date.now();
        
        // Store sensitive user data in memory
        this.setSensitiveData('userId', user.uid);
        this.setSensitiveData('userEmail', user.email);
        this.setSensitiveData('userRole', user.role || 'patient');
        this.setSensitiveData('emailVerified', user.emailVerified);
        this.setSensitiveData('permissions', user.permissions || []);
        
        // Store non-sensitive session data
        this.setSessionData(this.sessionKeys.SESSION_START, now);
        this.setSessionData(this.sessionKeys.LAST_ACTIVITY, now);
        
        this.sessionActive = true;
        
        // Set up session timeout
        this.setupSessionTimeout();
        
        console.log('🔒 Secure session started');
    }

    /**
     * Clear session data
     */
    clearSession() {
        // Clear sensitive data from memory
        this.sensitiveData.clear();
        
        // Clear session data
        Object.values(this.sessionKeys).forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        // Clear UI state and form progress
        this.clearUIState();
        
        this.sessionActive = false;
        
        console.log('🔒 Session cleared');
    }

    /**
     * Update last activity timestamp
     */
    updateLastActivity() {
        if (this.sessionActive) {
            this.setSessionData(this.sessionKeys.LAST_ACTIVITY, Date.now());
        }
    }

    /**
     * Check if session is active and valid
     * @returns {boolean} Whether session is active
     */
    isSessionActive() {
        if (!this.sessionActive) return false;
        
        const lastActivity = this.getSessionData(this.sessionKeys.LAST_ACTIVITY);
        if (!lastActivity) return false;
        
        const timeSinceActivity = Date.now() - lastActivity;
        return timeSinceActivity < this.sessionTimeout;
    }

    /**
     * Get session time remaining
     * @returns {number} Time remaining in milliseconds
     */
    getSessionTimeRemaining() {
        const lastActivity = this.getSessionData(this.sessionKeys.LAST_ACTIVITY);
        if (!lastActivity) return 0;
        
        const timeSinceActivity = Date.now() - lastActivity;
        return Math.max(0, this.sessionTimeout - timeSinceActivity);
    }

    /**
     * Store user preferences securely
     * @param {string} userId - User ID
     * @param {Object} preferences - User preferences
     */
    setUserPreferences(userId, preferences) {
        const key = `user_preferences_${userId}`;
        this.setSessionData(key, preferences);
    }

    /**
     * Get user preferences
     * @param {string} userId - User ID
     * @returns {Object} User preferences or default preferences
     */
    getUserPreferences(userId) {
        const key = `user_preferences_${userId}`;
        const preferences = this.getSessionData(key);
        
        if (preferences) {
            return preferences;
        }
        
        // Return default preferences
        return {
            notificationsEnabled: true,
            theme: 'light',
            language: 'en',
            accessibility: {
                highContrast: false,
                fontSize: 'medium'
            }
        };
    }

    /**
     * Store UI state (non-sensitive)
     * @param {string} component - Component name
     * @param {string} state - State identifier
     * @param {*} value - State value
     */
    setUIState(component, state, value) {
        const key = `ui_${component}_${state}`;
        this.setSessionData(key, value);
    }

    /**
     * Get UI state
     * @param {string} component - Component name
     * @param {string} state - State identifier
     * @param {*} defaultValue - Default value if not found
     * @returns {*} State value or default
     */
    getUIState(component, state, defaultValue = null) {
        const key = `ui_${component}_${state}`;
        return this.getSessionData(key) || defaultValue;
    }

    /**
     * Store form progress
     * @param {string} formId - Form identifier
     * @param {number} step - Current step
     * @param {Object} data - Form data
     */
    setFormProgress(formId, step, data) {
        const key = `form_${formId}_progress`;
        this.setSessionData(key, { step, data, timestamp: Date.now() });
    }

    /**
     * Get form progress
     * @param {string} formId - Form identifier
     * @returns {Object} Form progress or null
     */
    getFormProgress(formId) {
        const key = `form_${formId}_progress`;
        return this.getSessionData(key);
    }

    /**
     * Clear UI state and form progress
     */
    clearUIState() {
        // Clear all UI state keys
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('ui_') || key.startsWith('form_'))) {
                sessionStorage.removeItem(key);
            }
        }
    }

    /**
     * Set up session monitoring
     * @private
     */
    setupSessionMonitoring() {
        // Update activity every minute
        setInterval(() => {
            if (this.sessionActive) {
                this.updateLastActivity();
            }
        }, 60000);
        
        // Check session validity every 5 minutes
        setInterval(() => {
            if (this.sessionActive && !this.isSessionActive()) {
                console.warn('⚠️ Session expired, clearing data');
                this.clearSession();
                this.notifySessionExpired();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Set up session timeout
     * @private
     */
    setupSessionTimeout() {
        const timeRemaining = this.getSessionTimeRemaining();
        
        if (timeRemaining > this.warningTime) {
            // Set warning timeout
            setTimeout(() => {
                this.notifySessionWarning();
            }, timeRemaining - this.warningTime);
            
            // Set session timeout
            setTimeout(() => {
                this.clearSession();
                this.notifySessionExpired();
            }, timeRemaining);
        }
    }

    /**
     * Set up beforeunload handler
     * @private
     */
    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            // Clear sensitive data before page unload
            this.sensitiveData.clear();
        });
    }

    /**
     * Notify user of session warning
     * @private
     */
    notifySessionWarning() {
        // Dispatch custom event for session warning
        window.dispatchEvent(new CustomEvent('sessionWarning', {
            detail: {
                timeRemaining: this.getSessionTimeRemaining(),
                message: 'Your session will expire in 5 minutes'
            }
        }));
    }

    /**
     * Notify user of session expiration
     * @private
     */
    notifySessionExpired() {
        // Dispatch custom event for session expiration
        window.dispatchEvent(new CustomEvent('sessionExpired', {
            detail: {
                message: 'Your session has expired. Please log in again.'
            }
        }));
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getSessionStats() {
        return {
            sessionActive: this.sessionActive,
            timeRemaining: this.getSessionTimeRemaining(),
            sensitiveDataSize: this.sensitiveData.size,
            sessionDataKeys: Object.keys(this.sessionKeys),
            secureDataKeys: Object.keys(this.secureKeys)
        };
    }

    /**
     * Validate session data integrity
     * @returns {Object} Validation result
     */
    validateSessionIntegrity() {
        const issues = [];
        const warnings = [];
        
        // Check if sensitive data exists but session is inactive
        if (this.sensitiveData.size > 0 && !this.sessionActive) {
            issues.push('Sensitive data exists but session is inactive');
        }
        
        // Check session timeout
        const timeRemaining = this.getSessionTimeRemaining();
        if (timeRemaining < this.warningTime) {
            warnings.push(`Session will expire in ${Math.ceil(timeRemaining / 60000)} minutes`);
        }
        
        // Check for expired sensitive data
        let expiredCount = 0;
        for (const [key, data] of this.sensitiveData) {
            if (Date.now() > data.expiresAt) {
                expiredCount++;
            }
        }
        
        if (expiredCount > 0) {
            issues.push(`${expiredCount} sensitive data items have expired`);
        }
        
        return {
            valid: issues.length === 0,
            issues,
            warnings,
            stats: this.getSessionStats()
        };
    }
}

// Create singleton instance
const secureSessionManager = new SecureSessionManager();

export default secureSessionManager;



