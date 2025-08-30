/**
 * Comprehensive Input Validation and Sanitization Utility
 * Protects against XSS, injection attacks, and ensures data integrity
 * TypeScript implementation with strict typing and generics
 */

// Validation result types
export interface ValidationResult<T = string> {
  valid: boolean;
  value?: T;
  error?: string;
  warnings?: string[];
}

export interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  allowEmpty?: boolean;
  strictMode?: boolean;
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  test: (value: string) => boolean;
  errorMessage: string;
}

export interface SanitizationOptions {
  removeHtml: boolean;
  removeScripts: boolean;
  removeControlChars: boolean;
  allowUnicode: boolean;
  maxLength?: number;
}

// Validation error types
export type ValidationErrorType = 
  | 'required'
  | 'invalid_format'
  | 'too_long'
  | 'too_short'
  | 'dangerous_content'
  | 'unsafe_protocol'
  | 'invalid_extension'
  | 'custom_rule_failed';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  field?: string;
  value?: string;
}

// Generic validation function type
export type Validator<T> = (value: T, options?: ValidationOptions) => ValidationResult<T>;

// HTML entity mapping for XSS prevention
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
} as const;

// Dangerous file extensions
const DANGEROUS_EXTENSIONS: readonly string[] = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', 
  '.js', '.jar', '.php', '.asp', '.jsp', '.sh', '.ps1'
] as const;

// Validation utility class
export class ValidationUtils {
  /**
   * HTML Entity Encoding to prevent XSS attacks
   */
  static escapeHtml(text: string): string {
    if (typeof text !== 'string') return String(text);
    
    return text.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  /**
   * Remove potentially dangerous characters
   */
  static sanitizeInput(input: string, options: Partial<SanitizationOptions> = {}): string {
    if (typeof input !== 'string') return String(input);
    
    const {
      removeHtml = true,
      removeScripts = true,
      removeControlChars = true,
      allowUnicode = true,
      maxLength
    } = options;
    
    let sanitized = input;
    
    if (removeControlChars) {
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    }
    
    if (removeHtml) {
      sanitized = sanitized
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/file:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:/gi, '')
        .replace(/\{\{.*?\}\}/g, '')
        .replace(/\$\{.*?\}/g, '')
        .replace(/<%.*?%>/g, '')
        .replace(/\[\[.*?\]\]/g, '');
    }
    
    if (removeScripts) {
      sanitized = sanitized
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    }
    
    if (!allowUnicode) {
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
    }
    
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized.trim();
  }

  /**
   * Validate and sanitize URL input
   */
  static validateUrl(url: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL is required' };
    }
    
    const sanitized = this.sanitizeInput(url.trim());
    
    if (sanitized.length === 0 && !options.allowEmpty) {
      return { valid: false, error: 'URL cannot be empty' };
    }
    
    if (options.maxLength && sanitized.length > options.maxLength) {
      return { valid: false, error: `URL is too long (max: ${options.maxLength} characters)` };
    }
    
    try {
      const urlObj = new URL(sanitized);
      
      // Only allow http and https protocols
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
      }
      
      // Check for dangerous protocols
      if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
        return { valid: false, error: 'Dangerous URL protocol detected' };
      }
      
      return { valid: true, value: sanitized };
    } catch {
      return { valid: false, error: 'Please enter a valid URL' };
    }
  }

  /**
   * Validate filename for file uploads
   */
  static validateFilename(filename: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!filename || typeof filename !== 'string') {
      return { valid: false, error: 'Filename is required' };
    }
    
    const sanitized = filename.trim()
      .replace(/[^a-zA-Z0-9\.\-\_]/g, '')
      .replace(/\.{2,}/g, '.')
      .substring(0, options.maxLength || 255);
    
    if (sanitized.length === 0 && !options.allowEmpty) {
      return { valid: false, error: 'Filename cannot be empty' };
    }
    
    if (options.minLength && sanitized.length < options.minLength) {
      return { valid: false, error: `Filename is too short (min: ${options.minLength} characters)` };
    }
    
    // Check for dangerous extensions
    const extension = sanitized.toLowerCase().substring(sanitized.lastIndexOf('.'));
    
    if (DANGEROUS_EXTENSIONS.includes(extension as any)) {
      return { valid: false, error: 'This file type is not allowed for security reasons' };
    }
    
    return { valid: true, value: sanitized };
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    
    const sanitized = this.sanitizeInput(email.trim());
    
    if (sanitized.length === 0 && !options.allowEmpty) {
      return { valid: false, error: 'Email cannot be empty' };
    }
    
    if (options.maxLength && sanitized.length > options.maxLength) {
      return { valid: false, error: `Email is too long (max: ${options.maxLength} characters)` };
    }
    
    // Basic email regex (RFC 5322 compliant)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(sanitized)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
    
    return { valid: true, value: sanitized };
  }

  /**
   * Validate phone number
   */
  static validatePhone(phone: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }
    
    const sanitized = this.sanitizeInput(phone.trim());
    
    if (sanitized.length === 0 && !options.allowEmpty) {
      return { valid: false, error: 'Phone number cannot be empty' };
    }
    
    // Remove all non-digit characters for validation
    const digitsOnly = sanitized.replace(/\D/g, '');
    
    if (options.minLength && digitsOnly.length < options.minLength) {
      return { valid: false, error: `Phone number is too short (min: ${options.minLength} digits)` };
    }
    
    if (options.maxLength && digitsOnly.length > options.maxLength) {
      return { valid: false, error: `Phone number is too long (max: ${options.maxLength} digits)` };
    }
    
    // Basic phone validation (7-15 digits)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return { valid: false, error: 'Phone number must be between 7 and 15 digits' };
    }
    
    return { valid: true, value: sanitized };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }
    
    const warnings: string[] = [];
    
    if (options.minLength && password.length < options.minLength) {
      return { valid: false, error: `Password must be at least ${options.minLength} characters long` };
    }
    
    if (options.maxLength && password.length > options.maxLength) {
      return { valid: false, error: `Password is too long (max: ${options.maxLength} characters)` };
    }
    
    // Check password strength
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasLower) warnings.push('Add lowercase letters');
    if (!hasUpper) warnings.push('Add uppercase letters');
    if (!hasNumber) warnings.push('Add numbers');
    if (!hasSpecial) warnings.push('Add special characters');
    
    const strength = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (strength < 3) {
      return { 
        valid: false, 
        error: 'Password is too weak. Please include at least 3 of: lowercase, uppercase, numbers, special characters',
        warnings
      };
    }
    
    return { 
      valid: true, 
      value: password,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate and sanitize text input
   */
  static validateText(text: string, options: ValidationOptions = {}): ValidationResult<string> {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Text is required' };
    }
    
    const sanitized = this.sanitizeInput(text.trim());
    
    if (sanitized.length === 0 && !options.allowEmpty) {
      return { valid: false, error: 'Text cannot be empty' };
    }
    
    if (options.minLength && sanitized.length < options.minLength) {
      return { valid: false, error: `Text is too short (min: ${options.minLength} characters)` };
    }
    
    if (options.maxLength && sanitized.length > options.maxLength) {
      return { valid: false, error: `Text is too long (max: ${options.maxLength} characters)` };
    }
    
    // Apply custom validation rules
    if (options.customRules) {
      for (const rule of options.customRules) {
        if (!rule.test(sanitized)) {
          return { valid: false, error: rule.errorMessage };
        }
      }
    }
    
    return { valid: true, value: sanitized };
  }

  /**
   * Validate numeric input
   */
  static validateNumber(value: string | number, options: ValidationOptions & {
    min?: number;
    max?: number;
    allowDecimals?: boolean;
    allowNegative?: boolean;
  } = {}): ValidationResult<number> {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: 'Number is required' };
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return { valid: false, error: 'Please enter a valid number' };
    }
    
    if (!options.allowDecimals && !Number.isInteger(numValue)) {
      return { valid: false, error: 'Only whole numbers are allowed' };
    }
    
    if (!options.allowNegative && numValue < 0) {
      return { valid: false, error: 'Negative numbers are not allowed' };
    }
    
    if (options.min !== undefined && numValue < options.min) {
      return { valid: false, error: `Number must be at least ${options.min}` };
    }
    
    if (options.max !== undefined && numValue > options.max) {
      return { valid: false, error: `Number must be no more than ${options.max}` };
    }
    
    return { valid: true, value: numValue };
  }

  /**
   * Validate date input
   */
  static validateDate(date: string | Date, options: ValidationOptions & {
    minDate?: Date;
    maxDate?: Date;
    allowFuture?: boolean;
    allowPast?: boolean;
  } = {}): ValidationResult<Date> {
    if (!date) {
      return { valid: false, error: 'Date is required' };
    }
    
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return { valid: false, error: 'Please enter a valid date' };
      }
    } else {
      dateObj = date;
    }
    
    const now = new Date();
    
    if (options.minDate && dateObj < options.minDate) {
      return { valid: false, error: `Date must be on or after ${options.minDate.toLocaleDateString()}` };
    }
    
    if (options.maxDate && dateObj > options.maxDate) {
      return { valid: false, error: `Date must be on or before ${options.maxDate.toLocaleDateString()}` };
    }
    
    if (options.allowFuture === false && dateObj > now) {
      return { valid: false, error: 'Future dates are not allowed' };
    }
    
    if (options.allowPast === false && dateObj < now) {
      return { valid: false, error: 'Past dates are not allowed' };
    }
    
    return { valid: true, value: dateObj };
  }

  /**
   * Create a custom validator
   */
  static createValidator<T>(
    validator: (value: T, options?: ValidationOptions) => ValidationResult<T>
  ): Validator<T> {
    return validator;
  }

  /**
   * Combine multiple validators
   */
  static combineValidators<T>(...validators: Validator<T>[]): Validator<T> {
    return (value: T, options?: ValidationOptions): ValidationResult<T> => {
      for (const validator of validators) {
        const result = validator(value, options);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true, value };
    };
  }

  /**
   * Validate object with schema
   */
  static validateObject<T extends Record<string, unknown>>(
    obj: T,
    schema: Record<keyof T, Validator<any>>
  ): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const validatedObj = { ...obj } as T;
    
    for (const [key, validator] of Object.entries(schema)) {
      const result = validator(obj[key], {});
      if (!result.valid) {
        errors.push({
          type: 'custom_rule_failed',
          message: result.error || 'Validation failed',
          field: key,
          value: String(obj[key])
        });
      } else {
        validatedObj[key as keyof T] = result.value;
      }
    }
    
    if (errors.length > 0) {
      return { 
        valid: false, 
        error: `Validation failed for fields: ${errors.map(e => e.field).join(', ')}`,
        warnings: errors.map(e => e.message)
      };
    }
    
    return { valid: true, value: validatedObj };
  }
}

// Export utility functions for backward compatibility
export const escapeHtml = (text: string): string => ValidationUtils.escapeHtml(text);
export const sanitizeInput = (input: string, options?: Partial<SanitizationOptions>): string => 
  ValidationUtils.sanitizeInput(input, options);
export const validateUrl = (url: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validateUrl(url, options);
export const validateFilename = (filename: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validateFilename(filename, options);
export const validateEmail = (email: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validateEmail(email, options);
export const validatePhone = (phone: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validatePhone(phone, options);
export const validatePassword = (password: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validatePassword(password, options);
export const validateText = (text: string, options?: ValidationOptions): ValidationResult<string> => 
  ValidationUtils.validateText(text, options);
export const validateNumber = (value: string | number, options?: ValidationOptions & {
  min?: number;
  max?: number;
  allowDecimals?: boolean;
  allowNegative?: boolean;
}): ValidationResult<number> => ValidationUtils.validateNumber(value, options);
export const validateDate = (date: string | Date, options?: ValidationOptions & {
  minDate?: Date;
  maxDate?: Date;
  allowFuture?: boolean;
  allowPast?: boolean;
}): ValidationResult<Date> => ValidationUtils.validateDate(date, options);

// Default export
export default ValidationUtils;



