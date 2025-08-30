#!/usr/bin/env node

/**
 * Secure Environment Validation Script
 * Validates environment variables and checks for hardcoded credentials
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class SecureEnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
    this.placeholderPatterns = [
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
      'your-private-key-here'
    ];
  }

  /**
   * Log colored message
   */
  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Check if .env file exists
   */
  checkEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      this.errors.push('❌ .env file not found. Please create one from env.template');
      return false;
    }
    this.successes.push('✅ .env file found');
    return true;
  }

  /**
   * Load and parse .env file
   */
  loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return envVars;
  }

  /**
   * Check for placeholder values in environment variables
   */
  checkPlaceholderValues(envVars) {
    let hasPlaceholders = false;

    for (const [key, value] of Object.entries(envVars)) {
      for (const pattern of this.placeholderPatterns) {
        if (value.toLowerCase().includes(pattern.toLowerCase())) {
          this.errors.push(`❌ ${key}: Contains placeholder value "${pattern}"`);
          hasPlaceholders = true;
          break;
        }
      }
    }

    if (!hasPlaceholders) {
      this.successes.push('✅ No placeholder values found in environment variables');
    }

    return !hasPlaceholders;
  }

  /**
   * Validate Firebase configuration
   */
  validateFirebaseConfig(envVars) {
    const requiredFirebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    let allValid = true;

    for (const varName of requiredFirebaseVars) {
      const value = envVars[varName];
      
      if (!value) {
        this.errors.push(`❌ ${varName}: Not set`);
        allValid = false;
        continue;
      }

      // Validate Firebase API key format
      if (varName === 'VITE_FIREBASE_API_KEY') {
        if (!/^AIza[0-9A-Za-z-_]{35}$/.test(value)) {
          this.warnings.push(`⚠️ ${varName}: May not be a valid Firebase API key format`);
        }
      }

      // Validate Firebase project ID format
      if (varName === 'VITE_FIREBASE_PROJECT_ID') {
        if (!/^[a-z0-9-]+$/.test(value) || value.length < 6) {
          this.warnings.push(`⚠️ ${varName}: May not be a valid Firebase project ID format`);
        }
      }

      this.successes.push(`✅ ${varName}: Set`);
    }

    return allValid;
  }

  /**
   * Validate JWT configuration
   */
  validateJWTConfig(envVars) {
    const jwtSecret = envVars['JWT_SECRET'];
    
    if (!jwtSecret) {
      this.errors.push('❌ JWT_SECRET: Not set');
      return false;
    }

    if (jwtSecret.length < 32) {
      this.errors.push('❌ JWT_SECRET: Too short (minimum 32 characters)');
      return false;
    }

    if (jwtSecret === 'fallback-secret') {
      this.errors.push('❌ JWT_SECRET: Using insecure fallback value');
      return false;
    }

    this.successes.push('✅ JWT_SECRET: Properly configured');
    return true;
  }

  /**
   * Check for hardcoded credentials in source files
   */
  checkSourceFiles() {
    const sourceDirs = ['src', 'api'];
    const fileExtensions = ['.js', '.ts', '.jsx', '.tsx'];
    let hasHardcodedCreds = false;

    for (const dir of sourceDirs) {
      if (!fs.existsSync(dir)) continue;

      this.scanDirectory(dir, fileExtensions, (filePath, content) => {
        for (const pattern of this.placeholderPatterns) {
          if (content.includes(pattern)) {
            this.errors.push(`❌ ${filePath}: Contains hardcoded placeholder "${pattern}"`);
            hasHardcodedCreds = true;
          }
        }
      });
    }

    if (!hasHardcodedCreds) {
      this.successes.push('✅ No hardcoded credentials found in source files');
    }

    return !hasHardcodedCreds;
  }

  /**
   * Recursively scan directory for files
   */
  scanDirectory(dir, extensions, callback) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath, extensions, callback);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            callback(fullPath, content);
          } catch (error) {
            this.warnings.push(`⚠️ Could not read ${fullPath}: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Generate secure JWT secret
   */
  generateSecureJWTSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Run complete validation
   */
  runValidation() {
    this.log('\n🔒 Secure Environment Validation', 'bold');
    this.log('================================\n', 'blue');

    // Check .env file
    if (!this.checkEnvFile()) {
      this.log('\n📝 Please create a .env file from env.template:', 'yellow');
      this.log('   cp env.template .env', 'cyan');
      this.log('   Then fill in your actual values.\n', 'yellow');
      return false;
    }

    // Load and validate environment variables
    const envVars = this.loadEnvFile();
    
    this.log('\n📋 Environment Variables Check:', 'bold');
    this.checkPlaceholderValues(envVars);
    this.validateFirebaseConfig(envVars);
    this.validateJWTConfig(envVars);

    // Check source files
    this.log('\n🔍 Source Files Check:', 'bold');
    this.checkSourceFiles();

    // Display results
    this.log('\n📊 Validation Results:', 'bold');
    
    if (this.successes.length > 0) {
      this.log('\n✅ Successes:', 'green');
      this.successes.forEach(success => this.log(`   ${success}`, 'green'));
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️ Warnings:', 'yellow');
      this.warnings.forEach(warning => this.log(`   ${warning}`, 'yellow'));
    }

    if (this.errors.length > 0) {
      this.log('\n❌ Errors:', 'red');
      this.errors.forEach(error => this.log(`   ${error}`, 'red'));
    }

    // Summary
    const totalChecks = this.successes.length + this.warnings.length + this.errors.length;
    this.log(`\n📈 Summary: ${this.successes.length} passed, ${this.warnings.length} warnings, ${this.errors.length} errors`, 'bold');

    if (this.errors.length === 0) {
      this.log('\n🎉 Environment validation passed!', 'green');
      return true;
    } else {
      this.log('\n💡 Recommendations:', 'yellow');
      this.log('   1. Replace all placeholder values with actual credentials', 'cyan');
      this.log('   2. Ensure JWT_SECRET is at least 32 characters long', 'cyan');
      this.log('   3. Remove any hardcoded credentials from source files', 'cyan');
      this.log('   4. Use environment variables for all sensitive data', 'cyan');
      
      if (this.errors.some(e => e.includes('JWT_SECRET'))) {
        this.log('\n🔑 Generate a secure JWT secret:', 'yellow');
        this.log(`   JWT_SECRET=${this.generateSecureJWTSecret()}`, 'cyan');
      }
      
      return false;
    }
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const validator = new SecureEnvValidator();
  const success = validator.runValidation();
  process.exit(success ? 0 : 1);
}

module.exports = SecureEnvValidator; 