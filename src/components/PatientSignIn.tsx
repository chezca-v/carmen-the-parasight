import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import '../styles/patientSign-up.css'
import '../styles/csp-utilities.css'

// Types for better type safety
interface FormData {
  email: string
  password: string
  remember: boolean
}

interface ValidationErrors {
  email?: string
  password?: string
  general?: string
}

// Removed unused AuthError interface

const PatientSignIn: React.FC = React.memo(() => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    remember: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isGoogleSignInInProgress, setIsGoogleSignInInProgress] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [isFormValid, setIsFormValid] = useState(false)
  // Removed unused lastActivity state

  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Memoized values for performance
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])
  const isFormComplete = useMemo(() => 
    formData.email.trim() !== '' && formData.password.length > 0, 
    [formData.email, formData.password]
  )

  // Auto-refresh user activity
  useEffect(() => {
    const interval = setInterval(() => {
      // Update last activity timestamp
      localStorage.setItem('lastActivity', new Date().toISOString())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Form validation effect
  useEffect(() => {
    const errors: ValidationErrors = {}
    
    if (formData.email.trim() && !emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (formData.password.length > 0 && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long'
    }
    
    setValidationErrors(errors)
    setIsFormValid(Object.keys(errors).length === 0 && isFormComplete)
  }, [formData.email, formData.password, emailRegex, isFormComplete])

  // Focus management
  useEffect(() => {
    if (emailInputRef.current && !formData.email) {
      emailInputRef.current.focus()
    }
  }, [formData.email])

  // Auto-save form data to localStorage
  useEffect(() => {
    if (formData.email || formData.remember) {
      localStorage.setItem('patientSignIn_data', JSON.stringify({
        email: formData.email,
        remember: formData.remember
      }))
    }
  }, [formData.email, formData.remember])

  // Load saved form data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('patientSignIn_data')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setFormData(prev => ({
          ...prev,
          email: parsed.email || '',
          remember: parsed.remember || false
        }))
      } catch (error) {
        console.warn('Failed to load saved form data:', error)
      }
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    
    // Clear error message when user starts typing
    if (errorMessage) {
      setErrorMessage('')
    }
    
    // Clear specific validation error
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }, [errorMessage, validationErrors])

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev)
    // Focus back to password input after toggle
    setTimeout(() => {
      passwordInputRef.current?.focus()
    }, 100)
  }, [])

  const validateForm = useCallback((): ValidationErrors => {
    const errors: ValidationErrors = {}

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long'
    }

    return errors
  }, [formData.email, formData.password, emailRegex])

  const showError = useCallback((message: string) => {
    setErrorMessage(message)
    setSuccessMessage('')
    
    // Auto-hide error after 8 seconds
    setTimeout(() => {
      setErrorMessage('')
    }, 8000)
  }, [])

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message)
    setErrorMessage('')
    
    // Auto-hide success after 5 seconds
    setTimeout(() => {
      setSuccessMessage('')
    }, 5000)
  }, [])

  const handleEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      showError(Object.values(errors)[0] || 'Please fix the errors above')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    setValidationErrors({})

    try {
      console.log('Signing in with Firebase:', { email: formData.email })
      
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password)
      
      if (userCredential.user) {
        console.log('Email sign-in successful:', userCredential.user.email)
        showSuccess('Sign in successful! Welcome back!')
        
        // Save successful login time
        localStorage.setItem('lastSuccessfulLogin', new Date().toISOString())
        
        // Redirect after a short delay
        setTimeout(() => {
          navigate('/patient-portal')
        }, 1500)
      }
      
    } catch (error: any) {
      console.error('Sign in error:', error)
      
      let errorMsg = 'Sign in failed. Please check your credentials and try again.'
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMsg = 'No account found with this email address. Please check your email or sign up.'
          break
        case 'auth/wrong-password':
          errorMsg = 'Incorrect password. Please try again or reset your password.'
          break
        case 'auth/invalid-email':
          errorMsg = 'Please enter a valid email address.'
          break
        case 'auth/user-disabled':
          errorMsg = 'This account has been disabled. Please contact support.'
          break
        case 'auth/too-many-requests':
          errorMsg = 'Too many failed attempts. Please try again later or reset your password.'
          break
        case 'auth/network-request-failed':
          errorMsg = 'Network error. Please check your internet connection and try again.'
          break
        case 'auth/invalid-credential':
          errorMsg = 'Invalid email or password. Please check your credentials and try again.'
          break
        case 'auth/operation-not-allowed':
          errorMsg = 'Email/password sign-in is not enabled. Please contact support.'
          break
        default:
          errorMsg = error.message || errorMsg
      }
      
      showError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [formData.email, formData.password, validateForm, showError, showSuccess, navigate])

  const handleGoogleSignIn = useCallback(async () => {
    if (isGoogleSignInInProgress) {
      return // Prevent multiple clicks
    }
    
    setIsGoogleSignInInProgress(true)
    setErrorMessage('')
    setSuccessMessage('')
    setValidationErrors({})

    try {
      console.log('Starting Google Sign-In with Firebase...')
      
      // Configure Google provider
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      // Sign in with popup
      const result = await signInWithPopup(auth, provider)
      
      if (result.user) {
        console.log('Google sign-in successful:', result.user.email)
        showSuccess('Google sign-in successful! Loading your account...')
        
        // Save successful login time
        localStorage.setItem('lastSuccessfulLogin', new Date().toISOString())
        
        // Redirect after successful sign-in
        setTimeout(() => {
          navigate('/patient-portal')
        }, 1500)
      }
      
    } catch (error: any) {
      console.error('Google sign-in failed:', error)
      
      let errorMsg = 'Google sign-in failed. Please try again.'
      
      // Handle specific Google auth errors
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMsg = 'Sign-in was cancelled. Please try again.'
          break
        case 'auth/popup-blocked':
          errorMsg = 'Please allow popups for this site and try again.'
          break
        case 'auth/unauthorized-domain':
          errorMsg = 'This domain is not authorized for Google sign-in.'
          break
        case 'auth/operation-not-allowed':
          errorMsg = 'Google sign-in is not enabled. Please contact support.'
          break
        case 'auth/network-request-failed':
          errorMsg = 'Network error. Please check your connection and try again.'
          break
        case 'auth/cancelled-popup-request':
          errorMsg = 'Sign-in was cancelled. Please try again.'
          break
        default:
          if (error.message.includes('not enabled')) {
            errorMsg = 'Google Sign-In is not enabled for this application.'
          } else if (error.message.includes('api-key-not-valid')) {
            errorMsg = 'Firebase configuration error. Please check your API key configuration.'
          } else if (error.message) {
            errorMsg = error.message
          }
      }
      
      showError(errorMsg)
    } finally {
      // Reset after a delay to prevent rapid clicking
      setTimeout(() => {
        setIsGoogleSignInInProgress(false)
      }, 2000)
    }
  }, [isGoogleSignInInProgress, showError, showSuccess, navigate])

  const handleForgotPassword = useCallback(async () => {
    const email = formData.email.trim()
    
    if (!email) {
      showError('Please enter your email address first, then click "Forgot your password?"')
      emailInputRef.current?.focus()
      return
    }
    
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address')
      emailInputRef.current?.focus()
      return
    }

    try {
      console.log('Sending password reset email to:', email)
      
      // Send password reset email with Firebase
      await sendPasswordResetEmail(auth, email)
      
      showSuccess(`Password reset email sent to ${email}. Please check your inbox and follow the instructions.`)
      
    } catch (error: any) {
      console.error('Password reset error:', error)
      
      let errorMsg = 'Failed to send password reset email. Please try again.'
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMsg = 'No account found with this email address. Please check your email or sign up.'
          break
        case 'auth/invalid-email':
          errorMsg = 'Please enter a valid email address.'
          break
        case 'auth/too-many-requests':
          errorMsg = 'Too many requests. Please wait before requesting another password reset email.'
          break
        case 'auth/operation-not-allowed':
          errorMsg = 'Password reset is not enabled. Please contact support.'
          break
        default:
          errorMsg = error.message || errorMsg
      }
      
      showError(errorMsg)
    }

    // Auto-focus first input for accessibility
    emailInputRef.current?.focus()
  }, [formData.email, emailRegex, showError, showSuccess])

  const handleSocialSignIn = useCallback((platform: string) => {
    console.log(`Signing in with ${platform}...`)
    showError(`${platform} sign-in is not implemented yet. Please use email or Google sign-in.`)
  }, [showError])

  const handleClose = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        if (isFormValid && !isLoading) {
          formRef.current?.requestSubmit()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isFormValid, isLoading])

  // Accessibility: Announce form state changes
  useEffect(() => {
    if (errorMessage) {
      const liveRegion = document.getElementById('live-region')
      if (liveRegion) {
        liveRegion.textContent = `Error: ${errorMessage}`
      }
    }
  }, [errorMessage])

  return (
    <div className="signup-container" role="main" aria-label="Patient Sign In">
      {/* Accessibility live region */}
      <div id="live-region" aria-live="assertive" aria-atomic="true" className="sr-only"></div>
      
      {/* Left Side - Medical Professionals Image */}
      <div className="left-section" aria-hidden="true">
        <div className="logo-section">
          <div className="logo">
            <span className="logo-icon" aria-hidden="true">♡</span>
            <span className="logo-text">LingapLink</span>
          </div>
        </div>
        <div className="medical-professionals">
          <div className="professionals-content">
            <div className="professional-group">
              <div className="professional doctor" aria-hidden="true"></div>
              <div className="professional nurse-1" aria-hidden="true"></div>
              <div className="professional nurse-2" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signin Form */}
      <div className="right-section">
        <div className="close-btn">
          <button 
            type="button" 
            className="close-link" 
            onClick={handleClose}
            aria-label="Close and return to home page"
          >
            ×
          </button>
        </div>
        
        <div className="signup-content">
          <div className="signup-header">
            <h1>Welcome Back</h1>
            <p>New to LingapLink? <a href="/patient-sign-up" className="login-link">Sign up</a></p>
          </div>

          <form 
            ref={formRef}
            onSubmit={handleEmailSignIn} 
            className="signup-form"
            aria-label="Sign in form"
            noValidate
          >
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required 
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                ref={emailInputRef}
                disabled={isLoading}
                aria-describedby={validationErrors.email ? "email-error" : undefined}
                aria-invalid={!!validationErrors.email}
                placeholder="Enter your email address"
              />
              {validationErrors.email && (
                <div id="email-error" className="field-error" role="alert">
                  {validationErrors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Your password</label>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                name="password" 
                required 
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange}
                ref={passwordInputRef}
                disabled={isLoading}
                aria-describedby={validationErrors.password ? "password-error" : undefined}
                aria-invalid={!!validationErrors.password}
                placeholder="Enter your password"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              {validationErrors.password && (
                <div id="password-error" className="field-error" role="alert">
                  {validationErrors.password}
                </div>
              )}
            </div>

            <div className="form-group forgot-password">
              <button 
                type="button" 
                className="forgot-link" 
                onClick={handleForgotPassword}
                disabled={isLoading}
                aria-describedby="forgot-password-help"
              >
                Forgot your password?
              </button>
              <div id="forgot-password-help" className="sr-only">
                Click to receive a password reset email
              </div>
            </div>

            <button 
              type="submit" 
              className="signup-btn" 
              disabled={isLoading || !isFormValid}
              aria-describedby={!isFormValid ? "form-validation-help" : undefined}
            >
              <span className="btn-text" style={{ display: isLoading ? 'none' : 'block' }}>
                Sign In
              </span>
              <div 
                className="loading-spinner" 
                style={{ display: isLoading ? 'block' : 'none' }}
                aria-hidden="true"
              ></div>
            </button>
            {!isFormValid && (
              <div id="form-validation-help" className="sr-only">
                Please fill in all required fields correctly to enable sign in
              </div>
            )}
          </form>

          <div className="form-footer">
            <div className="remember-me">
              <input 
                type="checkbox" 
                id="remember" 
                name="remember"
                checked={formData.remember}
                onChange={handleInputChange}
                disabled={isLoading}
                aria-describedby="remember-help"
              />
              <label htmlFor="remember">Remember me</label>
              <div id="remember-help" className="sr-only">
                Keep me signed in on this device
              </div>
            </div>
          </div>

          <div className="divider">
            <span>Or sign in with</span>
          </div>

          <div className="social-buttons" role="group" aria-label="Social sign in options">
            <button 
              type="button" 
              className="social-btn google-btn" 
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleSignInInProgress}
              aria-label="Sign in with Google"
              aria-describedby="google-signin-help"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
            <div id="google-signin-help" className="sr-only">
              Sign in using your Google account
            </div>
            
            <button 
              type="button" 
              className="social-btn facebook-btn" 
              onClick={() => handleSocialSignIn('Facebook')}
              disabled={isLoading}
              aria-label="Sign in with Facebook"
              aria-describedby="facebook-signin-help"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
            <div id="facebook-signin-help" className="sr-only">
              Sign in using your Facebook account (not available)
            </div>
            
            <button 
              type="button" 
              className="social-btn apple-btn" 
              onClick={() => handleSocialSignIn('Apple')}
              disabled={isLoading}
              aria-label="Sign in with Apple"
              aria-describedby="apple-signin-help"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </button>
            <div id="apple-signin-help" className="sr-only">
              Sign in using your Apple account (not available)
            </div>
          </div>

          {errorMessage && (
            <div className="error-message" role="alert" aria-live="assertive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="success-message" aria-live="polite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              {successMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

PatientSignIn.displayName = 'PatientSignIn'

export default PatientSignIn 