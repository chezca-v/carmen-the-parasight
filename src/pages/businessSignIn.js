// Business Sign In Page - LingapLink Healthcare Platform
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.ts';
import { rateLimiter, sanitizeInput, validateEmail } from '../utils/validation.js';

class BusinessSignIn {
    constructor() {
        this.form = document.getElementById('businessSignInForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.rememberMeCheckbox = document.getElementById('rememberMe');
        this.signInBtn = document.getElementById('signInBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.messageContainer = document.getElementById('messageContainer');
        this.passwordToggle = document.querySelector('.password-toggle');
        this.demoBtn = document.querySelector('.demo-btn');
        
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.checkAuthState();
        this.setupPasswordToggle();
        this.setupDemoButton();
        this.setupKeyboardNavigation();
    }

    attachEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', this.handleSignIn.bind(this));
        }

        // Real-time form validation
        if (this.emailInput) {
            this.emailInput.addEventListener('blur', this.validateEmail.bind(this));
            this.emailInput.addEventListener('input', this.clearFieldError.bind(this));
        }

        if (this.passwordInput) {
            this.passwordInput.addEventListener('blur', this.validatePassword.bind(this));
            this.passwordInput.addEventListener('input', this.clearFieldError.bind(this));
        }

        // Message close functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('message-close')) {
                this.hideMessage();
            }
        });

        // Remember me persistence
        if (this.rememberMeCheckbox) {
            this.loadRememberMeState();
            this.rememberMeCheckbox.addEventListener('change', this.saveRememberMeState.bind(this));
        }
    }

    setupPasswordToggle() {
        if (this.passwordToggle) {
            this.passwordToggle.addEventListener('click', () => {
                const type = this.passwordInput.type === 'password' ? 'text' : 'password';
                this.passwordInput.type = type;
                
                const icon = this.passwordToggle.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        }
    }

    setupDemoButton() {
        if (this.demoBtn) {
            this.demoBtn.addEventListener('click', () => {
                this.showMessage('Demo dashboard will be available soon. Please sign in with your business account for full access.', 'info');
            });
        }
    }

    setupKeyboardNavigation() {
        // Enhanced keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideMessage();
                this.hideLoading();
            }
        });

        // Auto-focus on first input
        if (this.emailInput && !this.emailInput.value) {
            setTimeout(() => this.emailInput.focus(), 100);
        }
    }

    async handleSignIn(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const email = sanitizeInput(this.emailInput.value.trim());
        const password = this.passwordInput.value;
        const rememberMe = this.rememberMeCheckbox.checked;

        // Check rate limiting for business sign-in attempts
        const userKey = email || 'anonymous_business';
        if (!rateLimiter.isAllowed(userKey, 3, 60000)) {
            this.showMessage('Too many sign-in attempts. Please wait 1 minute before trying again.', 'error');
            return;
        }

        this.setLoadingState(true);

        try {
            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check if user has business profile
            const businessDocRef = doc(db, 'organizations', user.uid);
            const businessDoc = await getDoc(businessDocRef);

            if (!businessDoc.exists()) {
                // Check if user is an admin in any organization
                const adminDocRef = doc(db, 'business_admins', user.uid);
                const adminDoc = await getDoc(adminDocRef);

                if (!adminDoc.exists()) {
                    await auth.signOut();
                    throw new Error('No business account found. Please register your organization first or contact support.');
                }
            }

            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem('businessRememberMe', 'true');
                localStorage.setItem('businessEmail', email);
            } else {
                localStorage.removeItem('businessRememberMe');
                localStorage.removeItem('businessEmail');
            }

            this.showMessage('Sign in successful! Redirecting to dashboard...', 'success');
            
            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            import('../utils/logger.js').then(({ default: logger }) => {
            logger.error('Sign in error:', error);
        }).catch(() => console.error('Sign in error:', error));
            this.handleSignInError(error);
        } finally {
            this.setLoadingState(false);
        }
    }

    validateForm() {
        let isValid = true;

        // Validate email
        if (!this.validateEmail()) {
            isValid = false;
        }

        // Validate password
        if (!this.validatePassword()) {
            isValid = false;
        }

        return isValid;
    }

    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            this.showFieldError(this.emailInput, 'Business email is required');
            return false;
        }

        if (!emailRegex.test(email)) {
            this.showFieldError(this.emailInput, 'Please enter a valid email address');
            return false;
        }

        // Check for business email domains (basic validation)
        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        
        if (personalDomains.includes(domain)) {
            this.showFieldError(this.emailInput, 'Please use your business email address');
            return false;
        }

        this.clearFieldError(this.emailInput);
        return true;
    }

    validatePassword() {
        const password = this.passwordInput.value;

        if (!password) {
            this.showFieldError(this.passwordInput, 'Password is required');
            return false;
        }

        if (password.length < 6) {
            this.showFieldError(this.passwordInput, 'Password must be at least 6 characters');
            return false;
        }

        this.clearFieldError(this.passwordInput);
        return true;
    }

    showFieldError(input, message) {
        this.clearFieldError(input);
        
        input.style.borderColor = '#dc3545';
        input.style.backgroundColor = '#fff5f5';
        
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
            color: #dc3545;
            font-size: 0.85rem;
            margin-top: 4px;
            font-weight: 500;
        `;
        
        input.parentNode.parentNode.appendChild(errorElement);
    }

    clearFieldError(input) {
        const inputElement = input.target || input;
        
        inputElement.style.borderColor = '';
        inputElement.style.backgroundColor = '';
        
        const errorElement = inputElement.parentNode.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    handleSignInError(error) {
        let message = 'Sign in failed. Please try again.';

        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email. Please check your email or register your organization.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password. Please try again or reset your password.';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your connection and try again.';
                break;
            default:
                if (error.message) {
                    message = error.message;
                }
        }

        this.showMessage(message, 'error');
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.showLoading();
            this.signInBtn.classList.add('loading');
            this.signInBtn.disabled = true;
            
            // Disable form inputs
            if (this.emailInput) this.emailInput.disabled = true;
            if (this.passwordInput) this.passwordInput.disabled = true;
            if (this.rememberMeCheckbox) this.rememberMeCheckbox.disabled = true;
        } else {
            this.hideLoading();
            this.signInBtn.classList.remove('loading');
            this.signInBtn.disabled = false;
            
            // Re-enable form inputs
            if (this.emailInput) this.emailInput.disabled = false;
            if (this.passwordInput) this.passwordInput.disabled = false;
            if (this.rememberMeCheckbox) this.rememberMeCheckbox.disabled = false;
        }
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    showMessage(text, type = 'info') {
        if (!this.messageContainer) return;

        const message = this.messageContainer.querySelector('.message');
        const messageText = this.messageContainer.querySelector('.message-text');
        const messageIcon = this.messageContainer.querySelector('.message-icon');

        // Set message content
        messageText.textContent = text;

        // Set message type and icon
        message.className = `message ${type}`;
        
        switch (type) {
            case 'success':
                messageIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                messageIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'warning':
                messageIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            case 'info':
            default:
                messageIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
                break;
        }

        // Show message
        this.messageContainer.style.display = 'block';

        // Auto-hide after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                this.hideMessage();
            }, 5000);
        }
    }

    hideMessage() {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'none';
        }
    }

    loadRememberMeState() {
        const rememberMe = localStorage.getItem('businessRememberMe');
        const savedEmail = localStorage.getItem('businessEmail');

        if (rememberMe === 'true' && savedEmail) {
            this.rememberMeCheckbox.checked = true;
            this.emailInput.value = savedEmail;
            // Focus on password field instead
            if (this.passwordInput) {
                this.passwordInput.focus();
            }
        }
    }

    saveRememberMeState() {
        if (this.rememberMeCheckbox.checked && this.emailInput.value.trim()) {
            localStorage.setItem('businessRememberMe', 'true');
            localStorage.setItem('businessEmail', this.emailInput.value.trim());
        } else {
            localStorage.removeItem('businessRememberMe');
            localStorage.removeItem('businessEmail');
        }
    }

    checkAuthState() {
        // Check if user is already signed in
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    // Check if user has business access
                    const businessDocRef = doc(db, 'organizations', user.uid);
                    const businessDoc = await getDoc(businessDocRef);
                    
                    if (businessDoc.exists()) {
                        // User is already signed in with business account
                        this.showMessage('You are already signed in. Redirecting to dashboard...', 'info');
                        setTimeout(() => {
                            window.location.href = 'dashboard.html';
                        }, 1500);
                    }
                } catch (error) {
                    import('../utils/logger.js').then(({ default: logger }) => {
            logger.warn('Auth state check error:', error);
        }).catch(() => console.log('Auth state check error:', error));
                    // Continue with normal sign in flow
                }
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BusinessSignIn();
});

// Add some enhanced animations
document.addEventListener('DOMContentLoaded', () => {
    // Animate feature items on load
    const featureItems = document.querySelectorAll('.feature-item');
    featureItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.5s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, 200 + (index * 100));
    });

    // Animate stats
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach((stat, index) => {
        setTimeout(() => {
            stat.style.transform = 'scale(1.1)';
            setTimeout(() => {
                stat.style.transform = 'scale(1)';
            }, 200);
        }, 500 + (index * 150));
    });

    // Add smooth hover effects to form inputs
    const inputs = document.querySelectorAll('.input-wrapper input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            const wrapper = input.closest('.input-wrapper');
            if (wrapper) {
                wrapper.style.transform = 'translateY(-2px)';
            }
        });

        input.addEventListener('blur', () => {
            const wrapper = input.closest('.input-wrapper');
            if (wrapper) {
                wrapper.style.transform = 'translateY(0)';
            }
        });
    });
}); 