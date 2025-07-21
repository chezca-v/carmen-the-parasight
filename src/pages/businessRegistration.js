// Business Registration JavaScript
import organizationService from '../services/organization-service.js';
import authService from '../services/auth-service.js';

// State management
let isProcessing = false;
let validationErrors = [];

// DOM elements
const elements = {
    form: null,
    submitBtn: null,
    messageContainer: null,
    loadingOverlay: null
};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏢 Business Registration Page Loading...');
    
    // Initialize DOM elements
    initializeElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check if user is already authenticated
    checkAuthStatus();
    
    console.log('✅ Business Registration Page Loaded Successfully');
});

/**
 * Initialize DOM elements
 */
function initializeElements() {
    elements.form = document.getElementById('businessRegistrationForm');
    elements.submitBtn = document.getElementById('submitBtn');
    elements.messageContainer = document.getElementById('messageContainer');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!elements.form || !elements.submitBtn) {
        console.error('Required DOM elements not found');
        return;
    }
    
    console.log('✅ DOM elements initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Form submission
    elements.form.addEventListener('submit', handleFormSubmit);
    
    // Real-time validation
    const inputs = elements.form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
    
    // Password confirmation
    const passwordInput = document.getElementById('adminPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (passwordInput && confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }
    
    // Message close button
    const messageClose = document.querySelector('.message-close');
    if (messageClose) {
        messageClose.addEventListener('click', hideMessage);
    }
    
    console.log('✅ Event listeners set up');
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
    try {
        const isAuthenticated = authService.isAuthenticated();
        
        if (isAuthenticated) {
            const user = authService.getCurrentUser();
            const userRole = authService.getUserRole();
            
            // Redirect if user is already logged in
            if (user && userRole) {
                showMessage('You are already logged in. Redirecting to your dashboard...', 'success');
                
                setTimeout(() => {
                    authService.redirectAfterLogin();
                }, 2000);
            }
        }
    } catch (error) {
        console.log('No existing authentication found');
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (isProcessing) {
        return;
    }
    
    try {
        isProcessing = true;
        setLoadingState(true);
        hideMessage();
        
        // Validate form
        const validationResult = validateForm();
        if (!validationResult.isValid) {
            showMessage(validationResult.errors[0], 'error');
            return;
        }
        
        // Collect form data
        const formData = collectFormData();
        
        // Register organization
        const result = await organizationService.registerOrganization(
            formData.organization,
            formData.admin
        );
        
        // Show success message
        showMessage(result.message, 'success');
        
        // Clear form
        elements.form.reset();
        
        // Redirect to sign-in page after delay
        setTimeout(() => {
            window.location.href = '/public/businessSignIn.html';
        }, 3000);
        
    } catch (error) {
        console.error('Business registration error:', error);
        showMessage(getErrorMessage(error), 'error');
    } finally {
        isProcessing = false;
        setLoadingState(false);
    }
}

/**
 * Collect form data
 */
function collectFormData() {
    const formData = new FormData(elements.form);
    
    return {
        organization: {
            name: formData.get('orgName'),
            type: formData.get('orgType'),
            description: formData.get('orgDescription'),
            address: {
                street: formData.get('street'),
                city: formData.get('city'),
                state: formData.get('state'),
                zipCode: formData.get('zipCode'),
                country: 'US'
            },
            contact: {
                email: formData.get('contactEmail'),
                phone: formData.get('contactPhone'),
                website: formData.get('website')
            },
            license: {
                number: formData.get('licenseNumber'),
                state: formData.get('licenseState')
            },
            settings: {
                allowPatientRegistration: true,
                requireApproval: false,
                timezone: 'America/New_York'
            }
        },
        admin: {
            firstName: formData.get('adminFirstName'),
            lastName: formData.get('adminLastName'),
            title: formData.get('adminTitle'),
            phone: formData.get('adminPhone'),
            email: formData.get('adminEmail'),
            password: formData.get('adminPassword')
        }
    };
}

/**
 * Validate form
 */
function validateForm() {
    validationErrors = [];
    
    // Organization validation
    validateRequiredField('orgName', 'Organization name is required');
    validateRequiredField('orgType', 'Organization type is required');
    
    // Address validation
    validateRequiredField('street', 'Street address is required');
    validateRequiredField('city', 'City is required');
    validateRequiredField('state', 'State is required');
    validateRequiredField('zipCode', 'ZIP code is required');
    
    // Contact validation
    validateRequiredField('contactEmail', 'Business email is required');
    validateEmailField('contactEmail', 'Please enter a valid business email');
    validateRequiredField('contactPhone', 'Phone number is required');
    
    // Admin validation
    validateRequiredField('adminFirstName', 'Admin first name is required');
    validateRequiredField('adminLastName', 'Admin last name is required');
    validateRequiredField('adminEmail', 'Admin email is required');
    validateEmailField('adminEmail', 'Please enter a valid admin email');
    
    // Password validation
    validateRequiredField('adminPassword', 'Password is required');
    validatePasswordStrength();
    validatePasswordMatch();
    
    // Terms validation
    validateRequiredCheckbox('termsAgreement', 'You must agree to the Terms of Service');
    validateRequiredCheckbox('hipaaCompliance', 'You must acknowledge HIPAA compliance');
    
    return {
        isValid: validationErrors.length === 0,
        errors: validationErrors
    };
}

/**
 * Validate required field
 */
function validateRequiredField(fieldName, errorMessage) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (!field || !field.value.trim()) {
        validationErrors.push(errorMessage);
        markFieldAsError(field);
        return false;
    }
    clearFieldError(field);
    return true;
}

/**
 * Validate email field
 */
function validateEmailField(fieldName, errorMessage) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field && field.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value.trim())) {
            validationErrors.push(errorMessage);
            markFieldAsError(field);
            return false;
        }
    }
    clearFieldError(field);
    return true;
}

/**
 * Validate password strength
 */
function validatePasswordStrength() {
    const passwordField = document.getElementById('adminPassword');
    if (passwordField && passwordField.value.length < 6) {
        validationErrors.push('Password must be at least 6 characters long');
        markFieldAsError(passwordField);
        return false;
    }
    clearFieldError(passwordField);
    return true;
}

/**
 * Validate password match
 */
function validatePasswordMatch() {
    const passwordField = document.getElementById('adminPassword');
    const confirmField = document.getElementById('confirmPassword');
    
    if (passwordField && confirmField && confirmField.value) {
        if (passwordField.value !== confirmField.value) {
            validationErrors.push('Passwords do not match');
            markFieldAsError(confirmField);
            return false;
        }
    }
    clearFieldError(confirmField);
    return true;
}

/**
 * Validate required checkbox
 */
function validateRequiredCheckbox(fieldName, errorMessage) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (!field || !field.checked) {
        validationErrors.push(errorMessage);
        return false;
    }
    return true;
}

/**
 * Validate individual field
 */
function validateField(event) {
    const field = event.target;
    const fieldName = field.name;
    
    // Clear previous errors
    clearFieldError(field);
    
    // Validate based on field type
    switch (fieldName) {
        case 'adminEmail':
        case 'contactEmail':
            validateEmailField(fieldName, 'Please enter a valid email address');
            break;
        case 'adminPassword':
            validatePasswordStrength();
            break;
        case 'confirmPassword':
            validatePasswordMatch();
            break;
        default:
            // Check if required
            if (field.required && !field.value.trim()) {
                markFieldAsError(field);
            }
    }
}

/**
 * Mark field as error
 */
function markFieldAsError(field) {
    if (field) {
        field.classList.add('error');
        field.style.borderColor = '#dc3545';
    }
}

/**
 * Clear field error
 */
function clearFieldError(field) {
    if (field) {
        field.classList.remove('error');
        field.style.borderColor = '';
    }
}

/**
 * Set loading state
 */
function setLoadingState(loading) {
    if (loading) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.classList.add('loading');
        elements.loadingOverlay.style.display = 'flex';
    } else {
        elements.submitBtn.disabled = false;
        elements.submitBtn.classList.remove('loading');
        elements.loadingOverlay.style.display = 'none';
    }
}

/**
 * Show message
 */
function showMessage(message, type = 'success') {
    const messageText = elements.messageContainer.querySelector('.message-text');
    const messageElement = elements.messageContainer.querySelector('.message');
    
    if (messageText && messageElement) {
        messageText.textContent = message;
        messageElement.className = `message ${type}`;
        elements.messageContainer.style.display = 'block';
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                hideMessage();
            }, 5000);
        }
    }
}

/**
 * Hide message
 */
function hideMessage() {
    if (elements.messageContainer) {
        elements.messageContainer.style.display = 'none';
    }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
    if (error.message) {
        return error.message;
    }
    
    const errorMessages = {
        'auth/email-already-in-use': 'This email address is already registered. Please use a different email.',
        'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Registration is currently disabled. Please contact support.',
        'permission-denied': 'You do not have permission to perform this action.',
        'network-error': 'Network error. Please check your connection and try again.',
        'default': 'An error occurred during registration. Please try again.'
    };
    
    return errorMessages[error.code] || errorMessages.default;
}

// Export functions for testing
window.businessRegistration = {
    validateForm,
    collectFormData,
    showMessage,
    hideMessage
}; 