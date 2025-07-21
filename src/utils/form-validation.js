// ===================================
// Enhanced Form Validation System
// Comprehensive Client-Side Validation
// ===================================

class FormValidator {
  constructor() {
    this.rules = new Map();
    this.errorMessages = new Map();
    this.validators = new Map();
    this.activeValidations = new Set();
    this.debounceTimeouts = new Map();
    
    // Initialize default validators
    this.initializeDefaultValidators();
    this.initializeDefaultMessages();
  }

  initializeDefaultValidators() {
    // Required field validator
    this.validators.set('required', {
      validate: (value, params) => {
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        return value !== null && value !== undefined && value !== '';
      },
      message: 'This field is required'
    });

    // Email validator
    this.validators.set('email', {
      validate: (value) => {
        if (!value) return true; // Only validate if value exists
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(value.trim());
      },
      message: 'Please enter a valid email address'
    });

    // Phone number validator (Philippine format)
    this.validators.set('phone', {
      validate: (value) => {
        if (!value) return true;
        const phoneRegex = /^(\+63|0)[0-9]{10}$/;
        return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
      },
      message: 'Please enter a valid Philippine phone number'
    });

    // Minimum length validator
    this.validators.set('minLength', {
      validate: (value, params) => {
        if (!value) return true;
        const minLength = parseInt(params) || 0;
        return value.trim().length >= minLength;
      },
      message: (params) => `Must be at least ${params} characters long`
    });

    // Maximum length validator
    this.validators.set('maxLength', {
      validate: (value, params) => {
        if (!value) return true;
        const maxLength = parseInt(params) || Infinity;
        return value.trim().length <= maxLength;
      },
      message: (params) => `Must be no more than ${params} characters long`
    });

    // Pattern validator
    this.validators.set('pattern', {
      validate: (value, params) => {
        if (!value) return true;
        const pattern = new RegExp(params);
        return pattern.test(value);
      },
      message: 'Please enter a value in the correct format'
    });

    // Numeric validator
    this.validators.set('numeric', {
      validate: (value) => {
        if (!value) return true;
        return /^\d+$/.test(value.trim());
      },
      message: 'Please enter only numbers'
    });

    // Alpha validator (letters only)
    this.validators.set('alpha', {
      validate: (value) => {
        if (!value) return true;
        return /^[a-zA-Z\s]+$/.test(value.trim());
      },
      message: 'Please enter only letters'
    });

    // Alphanumeric validator
    this.validators.set('alphanumeric', {
      validate: (value) => {
        if (!value) return true;
        return /^[a-zA-Z0-9\s]+$/.test(value.trim());
      },
      message: 'Please enter only letters and numbers'
    });

    // Password strength validator
    this.validators.set('password', {
      validate: (value) => {
        if (!value) return true;
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return strongPassword.test(value);
      },
      message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
    });

    // Confirm password validator
    this.validators.set('confirmPassword', {
      validate: (value, params, form) => {
        if (!value) return true;
        const passwordField = form.querySelector(`[name="${params}"]`);
        return passwordField ? value === passwordField.value : false;
      },
      message: 'Passwords do not match'
    });

    // Date validator
    this.validators.set('date', {
      validate: (value) => {
        if (!value) return true;
        const date = new Date(value);
        return !isNaN(date.getTime());
      },
      message: 'Please enter a valid date'
    });

    // Age validator (minimum age)
    this.validators.set('minAge', {
      validate: (value, params) => {
        if (!value) return true;
        const birthDate = new Date(value);
        const today = new Date();
        const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= parseInt(params);
      },
      message: (params) => `Must be at least ${params} years old`
    });

    // File type validator
    this.validators.set('fileType', {
      validate: (files, params) => {
        if (!files || files.length === 0) return true;
        const allowedTypes = params.split(',').map(type => type.trim().toLowerCase());
        
        for (let file of files) {
          const fileExtension = file.name.split('.').pop().toLowerCase();
          const mimeType = file.type.toLowerCase();
          
          const isValidExtension = allowedTypes.some(type => 
            type.startsWith('.') ? type.substring(1) === fileExtension : type === mimeType
          );
          
          if (!isValidExtension) return false;
        }
        return true;
      },
      message: (params) => `Allowed file types: ${params}`
    });

    // File size validator (in MB)
    this.validators.set('fileSize', {
      validate: (files, params) => {
        if (!files || files.length === 0) return true;
        const maxSize = parseFloat(params) * 1024 * 1024; // Convert MB to bytes
        
        for (let file of files) {
          if (file.size > maxSize) return false;
        }
        return true;
      },
      message: (params) => `File size must be less than ${params}MB`
    });
  }

  initializeDefaultMessages() {
    this.errorMessages.set('required', 'This field is required');
    this.errorMessages.set('email', 'Please enter a valid email address');
    this.errorMessages.set('phone', 'Please enter a valid phone number');
    this.errorMessages.set('generic', 'Please check this field');
  }

  // Add validation rule to a field
  addRule(fieldName, validatorName, params = null, customMessage = null) {
    if (!this.rules.has(fieldName)) {
      this.rules.set(fieldName, []);
    }
    
    this.rules.get(fieldName).push({
      validator: validatorName,
      params: params,
      message: customMessage
    });
    
    return this;
  }

  // Add custom validator
  addValidator(name, validator, defaultMessage) {
    this.validators.set(name, {
      validate: validator,
      message: defaultMessage
    });
    
    return this;
  }

  // Initialize form validation
  initializeForm(formSelector, options = {}) {
    const form = typeof formSelector === 'string' 
      ? document.querySelector(formSelector) 
      : formSelector;
      
    if (!form) {
      console.warn('Form not found:', formSelector);
      return null;
    }

    const config = {
      validateOnInput: true,
      validateOnBlur: true,
      showSuccessStates: true,
      debounceDelay: 300,
      scrollToError: true,
      focusFirstError: true,
      ...options
    };

    // Add form class for styling
    form.classList.add('validated-form');

    // Setup real-time validation
    if (config.validateOnInput || config.validateOnBlur) {
      this.setupRealTimeValidation(form, config);
    }

    // Setup form submission
    this.setupFormSubmission(form, config);

    // Setup accessibility features
    this.setupAccessibility(form);

    return {
      form,
      validate: () => this.validateForm(form),
      reset: () => this.resetForm(form),
      getErrors: () => this.getFormErrors(form),
      isValid: () => this.isFormValid(form)
    };
  }

  setupRealTimeValidation(form, config) {
    const fields = form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      if (config.validateOnInput) {
        field.addEventListener('input', this.debounce(() => {
          this.validateField(field, form);
        }, config.debounceDelay));
      }

      if (config.validateOnBlur) {
        field.addEventListener('blur', () => {
          this.validateField(field, form);
        });
      }

      // Special handling for file inputs
      if (field.type === 'file') {
        field.addEventListener('change', () => {
          this.validateField(field, form);
        });
      }
    });
  }

  setupFormSubmission(form, config) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const isValid = this.validateForm(form);
      
      if (isValid) {
        // Dispatch custom valid event
        form.dispatchEvent(new CustomEvent('formValid', {
          detail: { formData: new FormData(form) }
        }));
      } else {
        // Dispatch custom invalid event
        form.dispatchEvent(new CustomEvent('formInvalid', {
          detail: { errors: this.getFormErrors(form) }
        }));

        if (config.scrollToError) {
          this.scrollToFirstError(form);
        }

        if (config.focusFirstError) {
          this.focusFirstError(form);
        }
      }
    });
  }

  setupAccessibility(form) {
    const fields = form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      // Add aria-describedby for error messages
      const fieldName = field.name || field.id;
      if (fieldName) {
        const errorId = `${fieldName}-error`;
        field.setAttribute('aria-describedby', errorId);
      }

      // Add aria-invalid attribute
      field.setAttribute('aria-invalid', 'false');
    });
  }

  validateField(field, form = null) {
    const fieldName = field.name || field.id;
    if (!fieldName || !this.rules.has(fieldName)) {
      return true;
    }

    const rules = this.rules.get(fieldName);
    const value = this.getFieldValue(field);
    let isValid = true;
    let errorMessage = '';

    // Clear previous validation state
    this.clearFieldError(field);

    // Validate each rule
    for (const rule of rules) {
      const validator = this.validators.get(rule.validator);
      if (!validator) {
        console.warn(`Validator "${rule.validator}" not found`);
        continue;
      }

      let valid;
      try {
        valid = validator.validate(value, rule.params, form);
      } catch (error) {
        console.error(`Validation error for ${fieldName}:`, error);
        valid = false;
      }

      if (!valid) {
        isValid = false;
        errorMessage = this.getErrorMessage(rule, validator);
        break; // Stop at first error
      }
    }

    // Update field state
    if (isValid) {
      this.setFieldSuccess(field);
    } else {
      this.setFieldError(field, errorMessage);
    }

    return isValid;
  }

  validateForm(form) {
    const fields = form.querySelectorAll('input, select, textarea');
    let isFormValid = true;

    fields.forEach(field => {
      const fieldValid = this.validateField(field, form);
      if (!fieldValid) {
        isFormValid = false;
      }
    });

    // Update form state
    form.classList.toggle('form-valid', isFormValid);
    form.classList.toggle('form-invalid', !isFormValid);

    return isFormValid;
  }

  getFieldValue(field) {
    switch (field.type) {
      case 'checkbox':
        return field.checked;
      case 'radio':
        const radioGroup = field.form.querySelectorAll(`[name="${field.name}"]`);
        for (const radio of radioGroup) {
          if (radio.checked) return radio.value;
        }
        return '';
      case 'file':
        return field.files;
      case 'select-multiple':
        return Array.from(field.selectedOptions).map(option => option.value);
      default:
        return field.value;
    }
  }

  getErrorMessage(rule, validator) {
    if (rule.message) {
      return typeof rule.message === 'function' 
        ? rule.message(rule.params) 
        : rule.message;
    }

    if (validator.message) {
      return typeof validator.message === 'function' 
        ? validator.message(rule.params) 
        : validator.message;
    }

    return this.errorMessages.get('generic');
  }

  setFieldError(field, message) {
    const fieldName = field.name || field.id;
    
    // Add error class
    field.classList.add('field-error');
    field.classList.remove('field-success');
    field.setAttribute('aria-invalid', 'true');

    // Create or update error message
    const errorId = `${fieldName}-error`;
    let errorElement = document.getElementById(errorId);
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = errorId;
      errorElement.className = 'field-error-message';
      errorElement.setAttribute('role', 'alert');
      errorElement.setAttribute('aria-live', 'polite');
      
      // Insert after field or field container
      const container = field.closest('.form-group, .field-container') || field.parentNode;
      container.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Add visual indicators
    this.addErrorIcon(field);
  }

  setFieldSuccess(field) {
    const fieldName = field.name || field.id;
    
    // Add success class
    field.classList.add('field-success');
    field.classList.remove('field-error');
    field.setAttribute('aria-invalid', 'false');

    // Hide error message
    const errorId = `${fieldName}-error`;
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
      errorElement.style.display = 'none';
    }

    // Add success icon
    this.addSuccessIcon(field);
  }

  clearFieldError(field) {
    field.classList.remove('field-error', 'field-success');
    field.setAttribute('aria-invalid', 'false');
    
    // Remove icons
    this.removeFieldIcons(field);
  }

  addErrorIcon(field) {
    this.removeFieldIcons(field);
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-circle field-error-icon';
    icon.setAttribute('aria-hidden', 'true');
    
    this.insertFieldIcon(field, icon);
  }

  addSuccessIcon(field) {
    this.removeFieldIcons(field);
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle field-success-icon';
    icon.setAttribute('aria-hidden', 'true');
    
    this.insertFieldIcon(field, icon);
  }

  insertFieldIcon(field, icon) {
    const container = field.closest('.form-group, .field-container') || field.parentNode;
    
    // Position icon appropriately
    if (container.style.position !== 'relative') {
      container.style.position = 'relative';
    }
    
    icon.style.position = 'absolute';
    icon.style.right = '10px';
    icon.style.top = '50%';
    icon.style.transform = 'translateY(-50%)';
    icon.style.pointerEvents = 'none';
    
    container.appendChild(icon);
  }

  removeFieldIcons(field) {
    const container = field.closest('.form-group, .field-container') || field.parentNode;
    const icons = container.querySelectorAll('.field-error-icon, .field-success-icon');
    icons.forEach(icon => icon.remove());
  }

  resetForm(form) {
    form.reset();
    
    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
      this.clearFieldError(field);
    });

    form.classList.remove('form-valid', 'form-invalid');

    // Clear all error messages
    const errorMessages = form.querySelectorAll('.field-error-message');
    errorMessages.forEach(msg => msg.style.display = 'none');
  }

  getFormErrors(form) {
    const errors = {};
    const errorElements = form.querySelectorAll('.field-error-message[style*="block"]');
    
    errorElements.forEach(element => {
      const fieldName = element.id.replace('-error', '');
      errors[fieldName] = element.textContent;
    });

    return errors;
  }

  isFormValid(form) {
    return form.classList.contains('form-valid');
  }

  scrollToFirstError(form) {
    const firstError = form.querySelector('.field-error');
    if (firstError) {
      firstError.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }

  focusFirstError(form) {
    const firstError = form.querySelector('.field-error');
    if (firstError) {
      firstError.focus();
    }
  }

  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Security utilities
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  // Utility to setup common form patterns
  setupSearchForm(formSelector) {
    const validator = this;
    
    return this.initializeForm(formSelector, {
      validateOnInput: true,
      debounceDelay: 300
    });
  }

  setupRegistrationForm(formSelector) {
    return this.initializeForm(formSelector, {
      validateOnBlur: true,
      showSuccessStates: true,
      scrollToError: true
    });
  }

  setupContactForm(formSelector) {
    return this.initializeForm(formSelector, {
      validateOnInput: false,
      validateOnBlur: true
    });
  }
}

// CSS styles for validation states
const validationStyles = `
.validated-form .field-error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

.validated-form .field-success {
  border-color: #22c55e !important;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1) !important;
}

.field-error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: none;
  font-weight: 500;
}

.field-error-icon {
  color: #ef4444 !important;
}

.field-success-icon {
  color: #22c55e !important;
}

.form-valid {
  /* Form is valid styles */
}

.form-invalid {
  /* Form is invalid styles */
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .validated-form .field-error {
    border-color: #000 !important;
    border-width: 2px !important;
  }
  
  .field-error-message {
    color: #000;
    font-weight: 700;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .validated-form .field-error,
  .validated-form .field-success {
    transition: none !important;
  }
}
`;

// Inject styles if not already present
if (!document.getElementById('form-validation-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'form-validation-styles';
  styleSheet.textContent = validationStyles;
  document.head.appendChild(styleSheet);
}

// Export for use
if (typeof window !== 'undefined') {
  window.FormValidator = FormValidator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidator;
} 