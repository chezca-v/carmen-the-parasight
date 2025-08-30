/**
 * Environment Detection Utility
 * Provides reliable environment detection across different deployment scenarios
 * TypeScript implementation with strict typing
 */

// Environment types
export type EnvironmentType = 'production' | 'development' | 'test' | 'staging';

// Environment information interface
export interface EnvironmentInfo {
  environment: EnvironmentType;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  isStaging: boolean;
  hostname: string;
  protocol: string;
  userAgent: string;
  nodeEnv?: string;
  viteMode?: string;
  viteProd?: boolean;
}

// Production domain configuration
export interface ProductionDomainConfig {
  domains: string[];
  customDomains: string[];
}

// Environment detection strategies
export interface EnvironmentDetectionStrategy {
  name: string;
  check: () => boolean;
  priority: number;
}

// Environment class with TypeScript support
export class Environment {
  private _isProduction: boolean | null = null;
  private _environment: EnvironmentType | null = null;
  private _isStaging: boolean | null = null;
  private readonly productionDomains: string[] = [
    'vercel.app',
    'netlify.app',
    'herokuapp.com',
    'firebaseapp.com',
    'github.io',
    'lingaplink.com', // Add your production domain
    'carmen-para-sight.vercel.app'
  ];

  constructor(private customProductionDomains: string[] = []) {
    this.productionDomains = [...this.productionDomains, ...customProductionDomains];
  }

  /**
   * Detect if the application is running in production
   */
  isProduction(): boolean {
    if (this._isProduction !== null) {
      return this._isProduction;
    }

    // Multiple ways to detect production environment
    const checks: EnvironmentDetectionStrategy[] = [
      {
        name: 'Vite Environment',
        priority: 1,
        check: (): boolean => {
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env.PROD === true || 
                   import.meta.env.MODE === 'production' ||
                   import.meta.env.NODE_ENV === 'production';
          }
          return false;
        }
      },
      {
        name: 'Node.js Environment',
        priority: 2,
        check: (): boolean => {
          if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'production';
          }
          return false;
        }
      },
      {
        name: 'Production Domains',
        priority: 3,
        check: (): boolean => {
          if (typeof window !== 'undefined' && window.location) {
            const hostname = window.location.hostname;
            return this.productionDomains.some(domain => 
              hostname.includes(domain) || hostname.endsWith(domain)
            );
          }
          return false;
        }
      },
      {
        name: 'HTTPS + Non-localhost',
        priority: 4,
        check: (): boolean => {
          if (typeof window !== 'undefined' && window.location) {
            const isHTTPS = window.location.protocol === 'https:';
            const isNotLocalhost = !this.isLocalhost(window.location.hostname);
            return isHTTPS && isNotLocalhost;
          }
          return false;
        }
      }
    ];

    // Sort by priority and run checks
    checks.sort((a, b) => a.priority - b.priority);
    
    this._isProduction = checks.some(check => {
      try {
        return check.check();
      } catch (error) {
        console.warn(`Environment check '${check.name}' failed:`, error);
        return false;
      }
    });

    return this._isProduction;
  }

  /**
   * Check if running in staging environment
   */
  isStaging(): boolean {
    if (this._isStaging !== null) {
      return this._isStaging;
    }

    const stagingChecks: EnvironmentDetectionStrategy[] = [
      {
        name: 'Vite Staging Mode',
        priority: 1,
        check: (): boolean => {
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env.MODE === 'staging';
          }
          return false;
        }
      },
      {
        name: 'Node.js Staging Environment',
        priority: 2,
        check: (): boolean => {
          if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'staging';
          }
          return false;
        }
      },
      {
        name: 'Staging Domains',
        priority: 3,
        check: (): boolean => {
          if (typeof window !== 'undefined' && window.location) {
            const hostname = window.location.hostname;
            return hostname.includes('staging') || 
                   hostname.includes('preview') ||
                   hostname.includes('dev');
          }
          return false;
        }
      }
    ];

    stagingChecks.sort((a, b) => a.priority - b.priority);
    
    this._isStaging = stagingChecks.some(check => {
      try {
        return check.check();
      } catch (error) {
        console.warn(`Staging check '${check.name}' failed:`, error);
        return false;
      }
    });

    return this._isStaging;
  }

  /**
   * Get the current environment name
   */
  getEnvironment(): EnvironmentType {
    if (this._environment !== null) {
      return this._environment;
    }

    if (this.isProduction()) {
      this._environment = 'production';
    } else if (this.isStaging()) {
      this._environment = 'staging';
    } else if (this.isTest()) {
      this._environment = 'test';
    } else {
      this._environment = 'development';
    }

    return this._environment;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return !this.isProduction() && !this.isTest() && !this.isStaging();
  }

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    const testChecks: EnvironmentDetectionStrategy[] = [
      {
        name: 'Node.js Test Environment',
        priority: 1,
        check: (): boolean => {
          if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'test' || 
                   process.env.NODE_ENV === 'testing' ||
                   process.env.TEST === 'true';
          }
          return false;
        }
      },
      {
        name: 'Vite Test Mode',
        priority: 2,
        check: (): boolean => {
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env.MODE === 'test' || 
                   import.meta.env.MODE === 'testing';
          }
          return false;
        }
      },
      {
        name: 'Test Runners',
        priority: 3,
        check: (): boolean => {
          if (typeof window !== 'undefined') {
            return Boolean(
              (window as any).__karma__ || 
              (window as any).jasmine || 
              (window as any).mocha ||
              (window as any).__TESTING__
            );
          }
          return false;
        }
      }
    ];

    testChecks.sort((a, b) => a.priority - b.priority);
    
    return testChecks.some(check => {
      try {
        return check.check();
      } catch (error) {
        console.warn(`Test check '${check.name}' failed:`, error);
        return false;
      }
    });
  }

  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'localhost.localdomain'
    ];
    
    return localhostPatterns.some(pattern => 
      hostname.includes(pattern) || hostname === pattern
    );
  }

  /**
   * Get environment information for debugging
   */
  getInfo(): EnvironmentInfo {
    const info: EnvironmentInfo = {
      environment: this.getEnvironment(),
      isProduction: this.isProduction(),
      isDevelopment: this.isDevelopment(),
      isTest: this.isTest(),
      isStaging: this.isStaging(),
      hostname: typeof window !== 'undefined' ? window.location?.hostname || 'unknown' : 'unknown',
      protocol: typeof window !== 'undefined' ? window.location?.protocol || 'unknown' : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || 'unknown' : 'unknown'
    };

    // Add Node.js environment info if available
    if (typeof process !== 'undefined' && process.env) {
      info.nodeEnv = process.env.NODE_ENV;
    }

    // Add Vite environment info if available
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      info.viteMode = import.meta.env.MODE;
      info.viteProd = import.meta.env.PROD;
    }

    return info;
  }

  /**
   * Get environment variables safely
   */
  getEnvVar(key: string, fallback?: string): string | undefined {
    // Check Vite environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as Record<string, string>)[key] || fallback;
    }
    
    // Check Node.js environment variables
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || fallback;
    }
    
    // Check window environment variables
    if (typeof window !== 'undefined' && (window as any).env) {
      return ((window as any).env as Record<string, string>)[key] || fallback;
    }
    
    return fallback;
  }

  /**
   * Check if a specific feature flag is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    const featureFlag = this.getEnvVar(`VITE_FEATURE_${feature.toUpperCase()}`, 'false');
    return featureFlag === 'true';
  }

  /**
   * Get build information
   */
  getBuildInfo(): {
    version?: string;
    buildTime?: string;
    commitHash?: string;
    branch?: string;
  } {
    return {
      version: this.getEnvVar('VITE_APP_VERSION'),
      buildTime: this.getEnvVar('VITE_BUILD_TIME'),
      commitHash: this.getEnvVar('VITE_COMMIT_HASH'),
      branch: this.getEnvVar('VITE_BRANCH')
    };
  }

  /**
   * Check if running in specific deployment platform
   */
  isDeploymentPlatform(platform: 'vercel' | 'netlify' | 'heroku' | 'firebase' | 'github'): boolean {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      
      switch (platform) {
        case 'vercel':
          return hostname.includes('vercel.app');
        case 'netlify':
          return hostname.includes('netlify.app');
        case 'heroku':
          return hostname.includes('herokuapp.com');
        case 'firebase':
          return hostname.includes('firebaseapp.com');
        case 'github':
          return hostname.includes('github.io');
        default:
          return false;
      }
    }
    return false;
  }

  /**
   * Reset cached environment detection (useful for testing)
   */
  resetCache(): void {
    this._isProduction = null;
    this._environment = null;
    this._isStaging = null;
  }

  /**
   * Add custom production domains
   */
  addProductionDomains(domains: string[]): void {
    this.productionDomains.push(...domains);
    this.resetCache(); // Reset cache to re-evaluate with new domains
  }

  /**
   * Get all production domains
   */
  getProductionDomains(): readonly string[] {
    return [...this.productionDomains];
  }
}

// Create singleton instance
const environment = new Environment();

// Export the class for custom instances
export { Environment };

// Export utility functions
export const isProduction = (): boolean => environment.isProduction();
export const isDevelopment = (): boolean => environment.isDevelopment();
export const isTest = (): boolean => environment.isTest();
export const isStaging = (): boolean => environment.isStaging();
export const getEnvironment = (): EnvironmentType => environment.getEnvironment();
export const getEnvironmentInfo = (): EnvironmentInfo => environment.getInfo();
export const getEnvVar = (key: string, fallback?: string): string | undefined => environment.getEnvVar(key, fallback);
export const isFeatureEnabled = (feature: string): boolean => environment.isFeatureEnabled(feature);
export const getBuildInfo = () => environment.getBuildInfo();
export const isDeploymentPlatform = (platform: 'vercel' | 'netlify' | 'heroku' | 'firebase' | 'github'): boolean => 
  environment.isDeploymentPlatform(platform);

// Default export
export default environment;



