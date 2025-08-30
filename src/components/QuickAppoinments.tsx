import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/index.css'

const QuickAppoinments: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredDate: '',
    preferredTime: '',
    facility: '',
    specialty: '',
    symptoms: '',
    urgency: 'normal'
  })
  const [facilities, setFacilities] = useState<Array<{uid: string, name: string}>>([])
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true)

  // Load partnered facilities from database
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        setIsLoadingFacilities(true)
        let allFacilities: any[] = []
        
        try {
          // Method 1: Try to use the facility service
          console.log('🔍 QuickAppoinments: Trying facility service...')
          const facilityService = await import('../services/facility-service.ts')
          allFacilities = await facilityService.default.searchFacilities()
          console.log('✅ QuickAppoinments: Facility service successful')
        } catch (serviceError) {
          console.log('⚠️ QuickAppoinments: Facility service failed, trying direct Firestore query...', serviceError)
          
          // Method 2: Try direct Firestore query (fallback)
          try {
            const firestoreModule = await import('firebase/firestore')
            const { getFirestore, collection, getDocs, query, limit } = firestoreModule
            
            const db = getFirestore()
            const facilitiesRef = collection(db, 'facilities')
            
            // First, try to get ALL facilities without any filters to test access
            console.log('🔍 QuickAppoinments: Testing basic Firestore access...')
            const basicQuery = query(facilitiesRef, limit(5))
            const basicSnapshot = await getDocs(basicQuery)
            console.log('✅ QuickAppoinments: Basic access test successful, documents found:', basicSnapshot.size)
            
            // Now try to get more facilities
            const activeQuery = query(
              facilitiesRef,
              limit(20)
            )
            
            const snapshot = await getDocs(activeQuery)
            console.log('✅ QuickAppoinments: Direct Firestore query successful, documents found:', snapshot.size)
            
            if (snapshot.size > 0) {
              allFacilities = snapshot.docs.map(doc => {
                const data = doc.data()
                console.log('🔍 QuickAppoinments: Raw facility data:', doc.id, data)
                return {
                  uid: doc.id,
                  name: data.facilityInfo?.name || data.name || '',
                  isActive: data.isActive !== false,
                  isSearchable: data.isSearchable !== false,
                  isVerified: data.isVerified || false
                }
              })
            }
          } catch (firestoreError: any) {
            console.error('❌ QuickAppoinments: Direct Firestore query also failed:', firestoreError)
            console.error('Error details:', {
              message: firestoreError.message,
              code: firestoreError.code,
              stack: firestoreError.stack
            })
            throw firestoreError
          }
        }
        
        console.log('🔍 QuickAppoinments: All facilities loaded:', allFacilities.length)
        console.log('🔍 QuickAppoinments: Facility details:', allFacilities.map(f => ({
          name: f.name,
          isActive: f.isActive,
          isVerified: f.isVerified,
          isSearchable: f.isSearchable,
          uid: f.uid
        })))
        
        // Filter for active facilities (temporarily removed isSearchable filter for debugging)
        const activeFacilities = allFacilities
          .filter(facility => 
            facility.isActive !== false // Default to true if not set
          )
          .map(facility => ({
            uid: facility.uid,
            name: facility.name
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        
        console.log('🔍 QuickAppoinments: Active facilities after filtering:', activeFacilities.length)
        console.log('🔍 QuickAppoinments: Active facility names:', activeFacilities.map(f => f.name))
        
        setFacilities(activeFacilities)
      } catch (error) {
        console.error('Error loading facilities:', error)
        // Fallback to empty array if service fails
        setFacilities([])
      } finally {
        setIsLoadingFacilities(false)
      }
    }

    loadFacilities()
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.facility) {
      setSubmitError('Please select a preferred facility')
      return
    }
    
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      // Import the function to create quick appointments
      const firestoreModule = await import('../services/firestoredb.js')
      
      // Create the appointment using the default export
      const result = await firestoreModule.default.createQuickAppointment(formData)
      
      console.log('✅ Quick appointment created:', result)
      setSubmitSuccess(true)
      
      // Show success message
      setTimeout(() => {
        alert(`Quick appointment request submitted successfully!\n\nAppointment ID: ${result.appointmentId}\nUrgency Level: ${result.urgency}\n\nPlease check your email (${formData.email}) or phone (${formData.phone}) for updates about your appointment.\n\nThe facility will contact you within 24 hours to confirm details.`)
        navigate('/')
      }, 1000)
      
    } catch (error: any) {
      console.error('❌ Error submitting quick appointment:', error)
      setSubmitError(error.message || 'Failed to submit appointment request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, navigate])

  const handleBackToHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  return (
    <div className="quick-appointments-container">
      <div className="container">
        <div className="quick-appointments-header">
          <button 
            onClick={handleBackToHome}
            className="back-btn"
            aria-label="Return to home page"
          >
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            Back to Home
          </button>
          <h1>Quick Appointment Request</h1>
          <p>Need an appointment fast? Fill out this form and we'll get back to you within 24 hours.</p>
        </div>

        <form onSubmit={handleSubmit} className="quick-appointment-form">
          <div className="form-section">
            <h2>Personal Information</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your first name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your last name"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email address"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your phone number"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Appointment Details</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="facility">
                  Preferred Facility
                  {isLoadingFacilities && <span className="loading-indicator"> (Loading...)</span>}
                </label>
                <select
                  id="facility"
                  name="facility"
                  value={formData.facility}
                  onChange={handleInputChange}
                  disabled={isLoadingFacilities}
                >
                  <option value="">
                    {isLoadingFacilities ? 'Loading facilities...' : 'Select a facility'}
                  </option>
                  {facilities.map(facility => (
                    <option key={facility.uid} value={facility.uid}>
                      {facility.name}
                    </option>
                  ))}
                  {facilities.length === 0 && !isLoadingFacilities && (
                    <option value="any" disabled>
                      No facilities available
                    </option>
                  )}
                </select>
                {facilities.length === 0 && !isLoadingFacilities && (
                  <p className="form-help-text">
                    No partnered facilities are currently available. Please check back later or contact us directly.
                  </p>
                )}
                {isLoadingFacilities && (
                  <p className="form-help-text">
                    Loading partnered healthcare facilities...
                  </p>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="specialty">Medical Specialty</label>
                <select
                  id="specialty"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleInputChange}
                >
                  <option value="">Select specialty</option>
                  <option value="general">General Medicine</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="orthopedics">Orthopedics</option>
                  <option value="pediatrics">Pediatrics</option>
                  <option value="dermatology">Dermatology</option>
                  <option value="neurology">Neurology</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="preferredDate">Preferred Date</label>
                <input
                  type="date"
                  id="preferredDate"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group">
                <label htmlFor="preferredTime">Preferred Time</label>
                <select
                  id="preferredTime"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleInputChange}
                >
                  <option value="">Select time</option>
                  <option value="morning">Morning (8AM - 12PM)</option>
                  <option value="afternoon">Afternoon (12PM - 5PM)</option>
                  <option value="evening">Evening (5PM - 8PM)</option>
                  <option value="any">Any available time</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="urgency">Urgency Level</label>
              <select
                id="urgency"
                name="urgency"
                value={formData.urgency}
                onChange={handleInputChange}
              >
                <option value="normal">Normal - Schedule within a week</option>
                <option value="urgent">Urgent - Within 2-3 days</option>
                <option value="emergency">Emergency - Same day if possible</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="symptoms">Symptoms or Reason for Visit</label>
              <textarea
                id="symptoms"
                name="symptoms"
                value={formData.symptoms}
                onChange={handleInputChange}
                rows={4}
                placeholder="Please describe your symptoms or reason for the appointment..."
              />
            </div>
          </div>

          {submitError && (
            <div className="form-error" style={{ 
              color: '#dc2626', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
              {submitError}
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={handleBackToHome} className="btn-secondary" aria-label="Cancel and return to home page">
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSubmitting}
              aria-label="Submit quick appointment request"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane" aria-hidden="true"></i>
                  Submit Quick Appointment Request
                </>
              )}
            </button>
          </div>
        </form>

        <div className="quick-appointments-info">
          <h3>What happens next?</h3>
          <div className="info-steps">
            <div className="info-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Submit Request</h4>
                <p>Fill out this form with your appointment details</p>
              </div>
            </div>
            <div className="info-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>We'll Contact You</h4>
                <p>Our team will reach out within 24 hours to confirm details</p>
              </div>
            </div>
            <div className="info-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Get Confirmed</h4>
                <p>Receive your confirmed appointment time and facility</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickAppoinments
