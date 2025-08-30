/**
 * Firebase Configuration Validator
 * Ensures Firebase configuration follows security best practices
 * and validates environment variables
 */

export interface FirebaseConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface FirebaseSecurityCheck {
  hasSecurityRules: boolean;
  hasProperAuth: boolean;
  hasRateLimiting: boolean;
  hasAuditLogging: boolean;
  hasEncryption: boolean;
}

export class FirebaseConfigValidator {
  private static instance: FirebaseConfigValidator;

  private constructor() {}

  public static getInstance(): FirebaseConfigValidator {
    if (!FirebaseConfigValidator.instance) {
      FirebaseConfigValidator.instance = new FirebaseConfigValidator();
    }
    return FirebaseConfigValidator.instance;
  }

  /**
   * Validate Firebase configuration from environment variables
   */
  validateConfiguration(): FirebaseConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check required environment variables
    const requiredVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
    
    if (missingVars.length > 0) {
      errors.push(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
    }

    // Validate API key format (Firebase API keys are typically 39 characters)
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (apiKey && apiKey.length < 30) {
      warnings.push('Firebase API key appears to be too short. Verify it is correct.');
    }

    // Validate project ID format
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (projectId && !/^[a-z0-9-]+$/.test(projectId)) {
      warnings.push('Firebase project ID contains invalid characters. Should only contain lowercase letters, numbers, and hyphens.');
    }

    // Validate auth domain format
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    if (authDomain && !authDomain.endsWith('.firebaseapp.com')) {
      warnings.push('Firebase auth domain should end with .firebaseapp.com');
    }

    // Check for development vs production configuration
    if (import.meta.env.DEV) {
      warnings.push('Running in development mode. Ensure production environment variables are properly set.');
      recommendations.push('Use different Firebase projects for development and production');
    }

    // Security recommendations
    recommendations.push('Implement Firebase Security Rules to restrict data access');
    recommendations.push('Use Firebase Authentication with proper user roles');
    recommendations.push('Enable Firebase App Check for additional security');
    recommendations.push('Monitor Firebase usage and set up alerts for unusual activity');
    recommendations.push('Regularly rotate Firebase API keys (if possible)');
    recommendations.push('Use Firebase Admin SDK on the server side for sensitive operations');

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Check Firebase security configuration
   */
  async checkSecurityConfiguration(): Promise<FirebaseSecurityCheck> {
    // Note: In a real implementation, you would check these against your Firebase project
    // For now, we'll provide a template for manual verification
    
    return {
      hasSecurityRules: false, // Check if firestore.rules and storage.rules exist
      hasProperAuth: false,    // Check if Firebase Auth is properly configured
      hasRateLimiting: false,  // Check if rate limiting is implemented
      hasAuditLogging: false,  // Check if audit logging is enabled
      hasEncryption: false     // Check if data encryption is implemented
    };
  }

  /**
   * Generate security configuration report
   */
  generateSecurityReport(): string {
    const validation = this.validateConfiguration();
    
    let report = '🔒 Firebase Security Configuration Report\n';
    report += '==========================================\n\n';

    // Configuration Status
    report += `Configuration Status: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n\n`;

    // Errors
    if (validation.errors.length > 0) {
      report += '❌ Errors:\n';
      validation.errors.forEach(error => {
        report += `  • ${error}\n`;
      });
      report += '\n';
    }

    // Warnings
    if (validation.warnings.length > 0) {
      report += '⚠️ Warnings:\n';
      validation.warnings.forEach(warning => {
        report += `  • ${warning}\n`;
      });
      report += '\n';
    }

    // Recommendations
    if (validation.recommendations.length > 0) {
      report += '💡 Security Recommendations:\n';
      validation.recommendations.forEach(rec => {
        report += `  • ${rec}\n`;
      });
      report += '\n';
    }

    // Security Checklist
    report += '🔍 Security Checklist:\n';
    report += '  □ Firebase Security Rules configured\n';
    report += '  □ Authentication properly implemented\n';
    report += '  □ Rate limiting enabled\n';
    report += '  □ Audit logging active\n';
    report += '  □ Data encryption implemented\n';
    report += '  □ API key rotation plan\n';
    report += '  □ Monitoring and alerting setup\n';
    report += '  □ Regular security audits scheduled\n';

    return report;
  }

  /**
   * Validate Firebase project configuration
   */
  async validateProjectConfiguration(): Promise<{
    isValid: boolean;
    projectInfo: any;
    securityStatus: any;
  }> {
    try {
      // In a real implementation, you would make API calls to Firebase
      // to validate the project configuration
      
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      
      if (!projectId) {
        throw new Error('Firebase project ID not configured');
      }

      // Mock project validation - replace with actual Firebase Admin SDK calls
      const projectInfo = {
        projectId,
        status: 'active',
        createdAt: new Date().toISOString(),
        services: {
          auth: true,
          firestore: true,
          storage: true,
          functions: false
        }
      };

      const securityStatus = {
        hasSecurityRules: true,
        hasAppCheck: false,
        hasMonitoring: false,
        hasBackup: false
      };

      return {
        isValid: true,
        projectInfo,
        securityStatus
      };
    } catch (error) {
      console.error('Failed to validate Firebase project configuration:', error);
      return {
        isValid: false,
        projectInfo: null,
        securityStatus: null
      };
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigurationSummary(): {
    hasApiKey: boolean;
    hasProjectId: boolean;
    hasAuthDomain: boolean;
    environment: string;
    configSource: string;
  } {
    return {
      hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
      hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
      hasAuthDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      environment: import.meta.env.MODE || 'unknown',
      configSource: 'environment_variables'
    };
  }

  /**
   * Validate environment-specific configuration
   */
  validateEnvironmentConfiguration(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const environment = import.meta.env.MODE;

    if (environment === 'production') {
      // Production-specific validations
      if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
        issues.push('Analytics measurement ID recommended for production');
      }
      
      // Check for development values in production
      const devPatterns = ['localhost', '127.0.0.1', 'dev', 'test'];
      const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
      
      if (authDomain && devPatterns.some(pattern => authDomain.includes(pattern))) {
        issues.push('Development patterns detected in production configuration');
      }
    }

    if (environment === 'development') {
      // Development-specific validations
      if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
        issues.push('Analytics measurement ID not required for development');
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const firebaseConfigValidator = FirebaseConfigValidator.getInstance();

// Export utility functions
export const validateFirebaseConfig = () => firebaseConfigValidator.validateConfiguration();
export const generateFirebaseSecurityReport = () => firebaseConfigValidator.generateSecurityReport();
export const getFirebaseConfigSummary = () => firebaseConfigValidator.getConfigurationSummary();



