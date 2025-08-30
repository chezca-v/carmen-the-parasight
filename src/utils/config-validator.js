/**
 * Secure Configuration Validator
 * Validates and sanitizes environment variables to prevent hardcoded credentials
 */

class ConfigValidator {
  constructor() {
    this.isProduction = this.detectProduction();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Detect if running in production environment
   */
  detectProduction() {
    return (
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
      (typeof import.meta !== 'undefined' && import.meta.env?.PROD === true) ||
      (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname))
    );
  }

  /**
   * Validate required environment variables
   */
  validateRequired(envVars, context = 'application') {
    const missing = [];
    const invalid = [];

    for (const [key, config] of Object.entries(envVars)) {
      const value = this.getEnvValue(key);
      
      if (!value) {
        missing.push(key);
        console.log(`❌ Missing required environment variable: ${key}`);
        continue;
      }

      // Check for placeholder values
      if (this.isPlaceholderValue(value)) {
        invalid.push({ key, value, reason: 'placeholder_value' });
        console.log(`❌ Placeholder value detected for: ${key}`);
        continue;
      }

      // Validate format if specified
      if (config.format && !this.validateFormat(value, config.format)) {
        invalid.push({ key, value, reason: 'invalid_format' });
        console.log(`❌ Invalid format for: ${key} (expected: ${config.format})`);
        continue;
      }

      // Validate length if specified
      if (config.minLength && value.length < config.minLength) {
        invalid.push({ key, value, reason: 'too_short' });
        console.log(`❌ Too short for: ${key} (min: ${config.minLength}, got: ${value.length})`);
        continue;
      }

      if (config.maxLength && value.length > config.maxLength) {
        invalid.push({ key, value, reason: 'too_long' });
        console.log(`❌ Too long for: ${key} (max: ${config.maxLength}, got: ${value.length})`);
        continue;
      }

      console.log(`✅ Validated ${key} successfully`);
    }

    if (missing.length > 0 || invalid.length > 0) {
      const error = new Error(`Configuration validation failed for ${context}`);
      error.missing = missing;
      error.invalid = invalid;
      error.context = context;
      console.log(`❌ Validation failed for ${context}:`, { missing, invalid });
      throw error;
    }

    return true;
  }

  /**
   * Get environment variable value safely
   */
  getEnvValue(key) {
    // Try different environment variable sources
    if (typeof process !== 'undefined' && process.env) {
      const value = process.env[key];
      if (value) {
        console.log(`🔍 Found ${key} in process.env: ${value.substring(0, 10)}...`);
        return value;
      }
    }
    
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const value = import.meta.env[key];
      if (value) {
        console.log(`🔍 Found ${key} in import.meta.env: ${value.substring(0, 10)}...`);
        return value;
      }
    }

    console.log(`❌ Environment variable ${key} not found`);
    return null;
  }

  /**
   * Check if value is a placeholder
   */
  isPlaceholderValue(value) {
    if (typeof value !== 'string') return false;
    
    const placeholders = [
      'your-api-key-here',
      'your-project.firebaseapp.com',
      'your-project-id',
      'your-project.appspot.com',
      '123456789',
      '1:123456789:web:abcdef123456',
      'G-XXXXXXXXXX',
      'fallback-secret',
      'your-app-secret-key',
      'your-jwt-secret-key',
      'your-email@gmail.com',
      'your-email-password',
      'your-sms-api-key',
      'your-ga-tracking-id',
      'path/to/firebase-service-account.json',
      'your-service-account@project.iam.gserviceaccount.com',
      'your-private-key-here',
      'placeholder_key_for_development_only'
    ];

    // Check for exact placeholder matches, not partial matches
    return placeholders.some(placeholder => 
      value.toLowerCase() === placeholder.toLowerCase() ||
      value.toLowerCase().includes('placeholder_key_for_development_only')
    );
  }

  /**
   * Validate value format
   */
  validateFormat(value, format) {
    switch (format) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          // Handle Firebase auth domains which don't include protocol
          if (value.includes('.firebaseapp.com')) {
            return /^[a-z0-9-]+\.firebaseapp\.com$/.test(value);
          }
          // For other URLs, try with https:// prefix if no protocol
          const urlToTest = value.startsWith('http') ? value : `https://${value}`;
          new URL(urlToTest);
          return true;
        } catch {
          return false;
        }
      case 'firebase-api-key':
        return /^AIza[0-9A-Za-z-_]{35}$/.test(value);
      case 'firebase-project-id':
        return /^[a-z0-9-]+$/.test(value) && value.length >= 6;
      case 'jwt-secret':
        return value.length >= 32 && /[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
      default:
        return true;
    }
  }

  /**
   * Generate secure fallback values for development
   */
  generateSecureFallback(type, length = 32) {
    if (this.isProduction) {
      throw new Error(`Cannot generate fallback values in production for ${type}`);
    }

    // For Firebase API keys, we need to return a proper format
    if (type === 'firebase-api-key') {
      return 'AIzaSyC_placeholder_key_for_development_only_123456789';
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Validate Firebase configuration
   */
  validateFirebaseConfig() {
    const firebaseConfig = {
      VITE_FIREBASE_API_KEY: { format: 'firebase-api-key', minLength: 39, maxLength: 39 },
      VITE_FIREBASE_AUTH_DOMAIN: { format: 'url', minLength: 10 },
      VITE_FIREBASE_PROJECT_ID: { format: 'firebase-project-id', minLength: 6, maxLength: 30 },
      VITE_FIREBASE_STORAGE_BUCKET: { minLength: 10 },
      VITE_FIREBASE_MESSAGING_SENDER_ID: { minLength: 9, maxLength: 12 },
      VITE_FIREBASE_APP_ID: { minLength: 20, maxLength: 50 }
    };

    return this.validateRequired(firebaseConfig, 'Firebase');
  }

  /**
   * Validate JWT configuration
   */
  validateJWTConfig() {
    const jwtConfig = {
      JWT_SECRET: { format: 'jwt-secret', minLength: 32 }
    };

    return this.validateRequired(jwtConfig, 'JWT');
  }

  /**
   * Get validated configuration object
   */
  getValidatedConfig() {
    try {
      // Validate Firebase config
      this.validateFirebaseConfig();
      
      // Only validate JWT in production
      let jwtSecret = this.getEnvValue('JWT_SECRET');
      if (this.isProduction && !jwtSecret) {
        this.validateJWTConfig();
      }

      return {
        firebase: {
          apiKey: this.getEnvValue('VITE_FIREBASE_API_KEY'),
          authDomain: this.getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
          projectId: this.getEnvValue('VITE_FIREBASE_PROJECT_ID'),
          storageBucket: this.getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
          messagingSenderId: this.getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
          appId: this.getEnvValue('VITE_FIREBASE_APP_ID'),
          measurementId: this.getEnvValue('VITE_FIREBASE_MEASUREMENT_ID')
        },
        jwt: {
          secret: jwtSecret || this.generateSecureFallback('jwt-secret', 64)
        },
        environment: this.isProduction ? 'production' : 'development'
      };
    } catch (error) {
      if (this.isProduction) {
        throw error;
      } else {
        // In development, generate secure fallbacks
        console.warn('⚠️ Using secure fallback values for development:', error.message);
        return this.generateDevelopmentConfig();
      }
    }
  }

  /**
   * Generate secure development configuration
   */
  generateDevelopmentConfig() {
    return {
      firebase: {
        apiKey: this.generateSecureFallback('firebase-api-key', 39),
        authDomain: 'dev-project.firebaseapp.com',
        projectId: 'dev-project-id',
        storageBucket: 'dev-project.appspot.com',
        messagingSenderId: '123456789012',
        appId: '1:123456789012:web:abcdef1234567890',
        measurementId: 'G-DEVXXXXXXXX'
      },
      jwt: {
        secret: this.generateSecureFallback('jwt-secret', 64)
      },
      environment: 'development'
    };
  }
}

// Export singleton instance
const configValidator = new ConfigValidator();
export default configValidator; 