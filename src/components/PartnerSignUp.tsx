import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth'
import '../styles/partnerSignUp.css'
import '../styles/csp-utilities.css'

interface FormData {
  // Step 1: Basic Information
  facilityName: string
  facilityType: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  
  // Step 2: Location & Contact
  address: string
  city: string
  province: string
  postalCode: string
  country: string
  website: string
  
  // Step 3: Medical Services
  specialties: string[]
  services: string[]
  operatingHours: {
    monday: { open: string; close: string; closed: boolean }
    tuesday: { open: string; close: string; closed: boolean }
    wednesday: { open: string; close: string; closed: boolean }
    thursday: { open: string; close: string; closed: boolean }
    friday: { open: string; close: string; closed: boolean }
    saturday: { open: string; close: string; closed: boolean }
    sunday: { open: string; close: string; closed: boolean }
  }
  
  // Step 4: Staff & Capacity
  totalStaff: number
  doctors: number
  nurses: number
  supportStaff: number
  bedCapacity: number
  consultationRooms: number
  
  // Step 5: Additional Information
  licenseNumber: string
  accreditation: string[]
  insuranceAccepted: string[]
  languages: string[]
  description: string
  termsAccepted: boolean
  privacyAccepted: boolean
}

interface ValidationErrors {
  facilityName?: string
  facilityType?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  specialties?: string
  licenseNumber?: string
  general?: string
}

const PartnerSignUp: React.FC = React.memo(() => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    facilityName: '',
    facilityType: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Philippines',
    website: '',
    specialties: [],
    services: [],
    operatingHours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '12:00', closed: false },
      sunday: { open: '09:00', close: '12:00', closed: true }
    },
    totalStaff: 0,
    doctors: 0,
    nurses: 0,
    supportStaff: 0,
    bedCapacity: 0,
    consultationRooms: 0,
    licenseNumber: '',
    accreditation: [],
    insuranceAccepted: [],
    languages: ['English', 'Filipino'],
    description: '',
    termsAccepted: false,
    privacyAccepted: false
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGoogleSignUpInProgress, setIsGoogleSignUpInProgress] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [formProgress, setFormProgress] = useState(0)

  const formRef = useRef<HTMLFormElement>(null)

  // Validation patterns
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])

  // Available options
  const facilityTypes = useMemo(() => [
    'Hospital',
    'Medical Clinic',
    'Dental Clinic',
    'Specialty Clinic',
    'Diagnostic Center',
    'Rehabilitation Center',
    'Mental Health Facility',
    'Maternity Clinic',
    'Pediatric Clinic',
    'Surgical Center',
    'Urgent Care Center',
    'Other'
  ], [])

  // Calculate form progress
  useEffect(() => {
    const totalSteps = 5
    const progress = (currentStep / totalSteps) * 100
    setFormProgress(progress)
  }, [currentStep])

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const errors: ValidationErrors = {}
    
    switch (currentStep) {
      case 1:
        if (!formData.facilityName.trim()) {
          errors.facilityName = 'Facility name is required'
        }
        if (!formData.facilityType) {
          errors.facilityType = 'Please select a facility type'
        }
        if (!formData.email.trim()) {
          errors.email = 'Email is required'
        } else if (!emailRegex.test(formData.email)) {
          errors.email = 'Please enter a valid email address'
        }
        if (!formData.phone.trim()) {
          errors.phone = 'Phone number is required'
        }
        if (!formData.password) {
          errors.password = 'Password is required'
        } else if (formData.password.length < 8) {
          errors.password = 'Password must be at least 8 characters long'
        }
        if (!formData.confirmPassword) {
          errors.confirmPassword = 'Please confirm your password'
        } else if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match'
        }
        break
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [currentStep, formData, emailRegex])

  // Multi-step navigation (commented out for now - only showing step 1)
  // const nextStep = useCallback(() => {
  //   if (validateCurrentStep()) {
  //     setCurrentStep(prev => Math.min(prev + 1, 5))
  //     setErrorMessage('')
  //   }
  // }, [validateCurrentStep])

  const handleGoogleSignUp = useCallback(async () => {
    try {
      setIsGoogleSignUpInProgress(true)
      setErrorMessage('')
      
      // Validate required fields for Google sign-up
      if (!formData.facilityName.trim()) {
        setErrorMessage('Please enter a facility name before signing up with Google')
        return
      }
      if (!formData.facilityType) {
        setErrorMessage('Please select a facility type before signing up with Google')
        return
      }
      
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      
      const result = await signInWithPopup(auth, provider)
      
      if (result.user) {
        console.log('Google sign-up successful:', result.user.email)
        
        // Update user's display name to facility name
        await updateProfile(result.user, {
          displayName: formData.facilityName
        })
        
        // Create facility document in Firestore
        try {
          const { createFacilityDocument } = await import('../services/firestoredb.js')
          await createFacilityDocument(result.user, {
            facilityName: formData.facilityName,
            facilityType: formData.facilityType,
            email: formData.email || result.user.email,
            phone: formData.phone,
            authProvider: 'google'
          })
          console.log('Facility document created successfully')
        } catch (error) {
          console.error('Error creating facility document:', error)
          // Continue with registration even if document creation fails
        }
        
        showNotification('Facility registration successful! Welcome to LingapLink.', 'success')
        
        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      }
    } catch (error: any) {
      console.error('Google sign-up error:', error)
      
      let errorMsg = 'Google sign-up failed. Please try again.'
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMsg = 'Sign-up was cancelled. Please try again.'
          break
        case 'auth/popup-blocked':
          errorMsg = 'Pop-up was blocked. Please allow pop-ups and try again.'
          break
        case 'auth/account-exists-with-different-credential':
          errorMsg = 'An account already exists with this email using a different sign-in method.'
          break
        case 'auth/network-request-failed':
          errorMsg = 'Network error. Please check your internet connection and try again.'
          break
        default:
          errorMsg = error.message || errorMsg
      }
      
      setErrorMessage(errorMsg)
    } finally {
      setIsGoogleSignUpInProgress(false)
    }
  }, [formData, navigate])

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      // Update user's display name to facility name
      await updateProfile(userCredential.user, {
        displayName: formData.facilityName
      })

      // Create facility document in Firestore
      try {
        const { createFacilityDocument } = await import('../services/firestoredb.js')
        await createFacilityDocument(userCredential.user, {
          facilityName: formData.facilityName,
          facilityType: formData.facilityType,
          email: formData.email,
          phone: formData.phone,
          authProvider: 'email'
        })
        console.log('Facility document created successfully')
      } catch (error) {
        console.error('Error creating facility document:', error)
        // Continue with registration even if document creation fails
      }

      // Send email verification
      await sendEmailVerification(userCredential.user)

      console.log('Registration completed successfully!')
      console.log('User:', userCredential.user)
      console.log('Facility name set to:', formData.facilityName)
      console.log('Redirecting to dashboard...')
      
      showNotification('Facility registration successful! Welcome to LingapLink.', 'success')
      
      // Redirect to dashboard immediately
      navigate('/dashboard')

    } catch (error: any) {
      console.error('Registration error:', error)
      setErrorMessage(error.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [formData, validateCurrentStep, navigate])

  // Simple facility profile creation (commented out for now)
  // const createFacilityProfile = async (user: any, facilityData: FormData) => {
  //   // We'll add this back later when needed
  // }

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification')
    existingNotifications.forEach(notification => notification.remove())
    
    // Create notification
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    `
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close')
    closeBtn?.addEventListener('click', () => notification.remove())
    
    // Add to page
    document.body.appendChild(notification)
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => notification.remove(), 300)
      }
    }, 5000)
  }, [])

  return (
    <div className="partner-signup-container">
      <div className="signup-header">
        <div className="logo">
          <i className="fas fa-heartbeat"></i>
          <span>LingapLink</span>
        </div>
        <h1>Partner with LingapLink</h1>
        <p>Join our network of healthcare facilities and connect with patients nationwide</p>
      </div>

      <div className="signup-content">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${formProgress}%` }}></div>
          <div className="progress-steps">
            {[1, 2, 3, 4, 5].map(step => (
              <div 
                key={step} 
                className={`step-indicator ${step <= currentStep ? 'active' : ''}`}
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="signup-form">
          {currentStep === 1 && (
            <div className="form-step">
              <h2>Basic Information</h2>
              <p>Tell us about your healthcare facility</p>
            
            <div className="form-group">
              <label htmlFor="facilityName">Facility Name *</label>
              <input
                type="text"
                id="facilityName"
                value={formData.facilityName}
                onChange={(e) => setFormData(prev => ({ ...prev, facilityName: e.target.value }))}
                className={validationErrors.facilityName ? 'error' : ''}
                placeholder="Enter your facility name"
              />
              {validationErrors.facilityName && (
                <span className="error-message">{validationErrors.facilityName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="facilityType">Facility Type *</label>
              <select
                id="facilityType"
                value={formData.facilityType}
                onChange={(e) => setFormData(prev => ({ ...prev, facilityType: e.target.value }))}
                className={validationErrors.facilityType ? 'error' : ''}
              >
                <option value="">Select facility type</option>
                {facilityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {validationErrors.facilityType && (
                <span className="error-message">{validationErrors.facilityType}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={validationErrors.email ? 'error' : ''}
                placeholder="Enter your email address"
              />
              {validationErrors.email && (
                <span className="error-message">{validationErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className={validationErrors.phone ? 'error' : ''}
                placeholder="Enter your phone number"
              />
              {validationErrors.phone && (
                <span className="error-message">{validationErrors.phone}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={validationErrors.password ? 'error' : ''}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                </button>
              </div>
              {validationErrors.password && (
                <span className="error-message">{validationErrors.password}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="password-input">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={validationErrors.confirmPassword ? 'error' : ''}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas fa-${showConfirmPassword ? 'eye-slash' : 'eye'}`}></i>
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <span className="error-message">{validationErrors.confirmPassword}</span>
              )}
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isLoading}
                onClick={() => {
                  // Form submission is handled by onSubmit
                }}
              >
                {isLoading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </div>
          </div>
          )}
        </form>

        <div className="social-signup">
          <div className="divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="btn btn-google"
            onClick={handleGoogleSignUp}
            disabled={isGoogleSignUpInProgress}
          >
            <i className="fab fa-google"></i>
            {isGoogleSignUpInProgress ? 'Signing up...' : 'Continue with Google'}
          </button>
        </div>

        {errorMessage && (
          <div className="error-message general-error">
            <i className="fas fa-exclamation-circle"></i>
            {errorMessage}
          </div>
        )}
      </div>

      <div className="signup-footer">
        <p>Already have an account? <a href="/partner-sign-in">Sign in here</a></p>
        <p>Need help? <a href="/help">Contact our support team</a></p>
      </div>
    </div>
  )
})

PartnerSignUp.displayName = 'PartnerSignUp'

export default PartnerSignUp 