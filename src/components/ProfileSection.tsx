import React, { useState, useCallback } from 'react'
import { formatDate } from '../utils/dateUtils'
import '../styles/profileSection.css'

interface ProfileSectionProps {
  patientData: any
  user: any
  onOpenModal: (modalType: string, additionalData?: any) => void
  onRemoveCondition: (category: string, condition: string) => void
  consultationHistory?: any[]
  onRemoveConsultation?: (consultationId: string) => void
  onDownloadDocument?: (document: any) => void
  onRemoveDocument?: (documentId: string) => void
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  patientData,
  user,
  onOpenModal,
  onRemoveCondition,
  consultationHistory = [],
  onRemoveConsultation,
  onDownloadDocument,
  onRemoveDocument
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'consultation-history' | 'patient-documents'>('general')

  const handleTabClick = useCallback((tab: 'general' | 'consultation-history' | 'patient-documents') => {
    setActiveTab(tab)
  }, [])

  const getUserInitials = useCallback(() => {
    if (patientData?.personalInfo?.fullName) {
      return patientData.personalInfo.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    }
    if (user?.displayName) {
      return user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    }
    return 'U'
  }, [patientData?.personalInfo?.fullName, user?.displayName])

  const getUserDisplayName = useCallback(() => {
    if (patientData?.personalInfo?.fullName && patientData.personalInfo.fullName.trim()) {
      return patientData.personalInfo.fullName
    }
    if (patientData?.personalInfo?.firstName && patientData.personalInfo.lastName) {
      return `${patientData.personalInfo.firstName} ${patientData.personalInfo.lastName}`
    }
    if (user?.displayName) {
      return user.displayName
    }
    return 'Patient'
  }, [patientData?.personalInfo, user?.displayName])

  const getUserEmail = useCallback(() => {
    return patientData?.email || user?.email || ''
  }, [patientData?.email, user?.email])

  const getPatientAge = useCallback(() => {
    if (patientData?.personalInfo?.age) {
      return patientData.personalInfo.age.toString()
    }
    if (patientData?.personalInfo?.dateOfBirth) {
      const birthDate = new Date(patientData.personalInfo.dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return (age - 1).toString()
      }
      return age.toString()
    }
    return '--'
  }, [patientData?.personalInfo?.age, patientData?.personalInfo?.dateOfBirth])

  const getPatientPhone = useCallback(() => {
    return patientData?.personalInfo?.phone || 'Not set'
  }, [patientData?.personalInfo?.phone])

  const getPatientAddress = useCallback(() => {
    return patientData?.personalInfo?.address || 'Not set'
  }, [patientData?.personalInfo?.address])

  const getPatientBio = useCallback(() => {
    return patientData?.personalInfo?.bio || 'Welcome to LingapLink!'
  }, [patientData?.personalInfo?.bio])

  const getPatientGender = useCallback(() => {
    return patientData?.personalInfo?.gender || 'Not set'
  }, [patientData?.personalInfo?.gender])

  const getPatientDateOfBirth = useCallback(() => {
    return patientData?.personalInfo?.dateOfBirth || '--/--/----'
  }, [patientData?.personalInfo?.dateOfBirth])

  const getUniquePatientId = useCallback(() => {
    if (user?.uid) {
      return user.uid
    }
    if (patientData?.uniquePatientId) {
      return patientData.uniquePatientId
    }
    return 'Not assigned'
  }, [user?.uid, patientData?.uniquePatientId])

  return (
    <section className="content-section active">
      <div className="section-header">
        <h1>Profile</h1>
      </div>

      {/* Profile Tabs */}
      <div className="profile-tabs">
        <div className="tab-nav">
          <button 
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`} 
            onClick={() => handleTabClick('general')}
          >
            General
          </button>
          <button 
            className={`tab-button ${activeTab === 'consultation-history' ? 'active' : ''}`} 
            onClick={() => handleTabClick('consultation-history')}
          >
            Consultation History
          </button>
          <button 
            className={`tab-button ${activeTab === 'patient-documents' ? 'active' : ''}`} 
            onClick={() => handleTabClick('patient-documents')}
          >
            Patient Documents
          </button>
        </div>

        {/* General Tab Content */}
        {activeTab === 'general' && (
          <div className="tab-content active">
            {/* Profile Header */}
            <div className="profile-header">
              <div className="profile-info">
                <div className="profile-avatar">
                  <div className="profile-avatar-placeholder">
                    <span>{getUserInitials()}</span>
                  </div>
                </div>
                <div className="profile-details">
                  <h3 className="profile-name">{getUserDisplayName()} <span className="gender-tag">(Patient)</span></h3>
                  <p className="profile-role">Patient</p>
                  <p className="profile-id" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0040e7', fontSize: '14px', marginTop: '4px' }}>
                    ID: {getUniquePatientId()}
                  </p>
                  <p className="profile-location">{getUserEmail()}</p>
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => onOpenModal('editProfile')}
                aria-label="Edit profile information"
              >
                <i className="fas fa-edit"></i>
                Edit Profile
              </button>
            </div>

            {/* Personal Information */}
            <div className="info-section">
              <div className="section-header">
                <h3>Personal Information</h3>
                <button 
                  className="btn btn-outline" 
                  onClick={() => onOpenModal('editProfile')}
                  aria-label="Edit personal information"
                >
                  <i className="fas fa-edit"></i>
                  Edit
                </button>
              </div>
              
              <div className="info-grid">
                <div className="info-item">
                  <label>Patient ID</label>
                  <span className="long-text" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0040e7' }}>{getUniquePatientId()}</span>
                </div>
                <div className="info-item">
                  <label>Name</label>
                  <span>{getUserDisplayName()}</span>
                </div>
                <div className="info-item">
                  <label>Date Of Birth</label>
                  <span>{getPatientDateOfBirth()}</span>
                </div>
                <div className="info-item">
                  <label>Age</label>
                  <span>{getPatientAge()}</span>
                </div>
                <div className="info-item">
                  <label>Gender</label>
                  <span>{getPatientGender()}</span>
                </div>
                <div className="info-item">
                  <label>Phone Number</label>
                  <span>{getPatientPhone()}</span>
                </div>
                <div className="info-item">
                  <label>Email Address</label>
                  <span className="long-text">{getUserEmail()}</span>
                </div>
                <div className="info-item">
                  <label>Address</label>
                  <span>{getPatientAddress()}</span>
                </div>
                <div className="info-item">
                  <label>Bio</label>
                  <span>{getPatientBio()}</span>
                </div>
              </div>
              
              {!patientData?.personalInfo?.firstName || !patientData?.personalInfo?.lastName ? (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  borderRadius: '8px',
                  color: '#856404'
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                  <strong>Profile Incomplete:</strong> Please complete your profile information for better healthcare services.
                </div>
              ) : null}
            </div>

            {/* Pre-existing Diseases */}
            <div className="info-section">
              <div className="section-header">
                <h3>Pre-existing Conditions</h3>
                <button 
                  className="btn btn-outline"
                  onClick={() => onOpenModal('addCondition')}
                  aria-label="Add new medical condition"
                >
                  <i className="fas fa-plus"></i>
                  Add Condition
                </button>
              </div>
              
              <div className="diseases-section">
                {patientData?.medicalInfo?.conditions && Object.keys(patientData.medicalInfo.conditions).length > 0 ? (
                  Object.entries(patientData.medicalInfo.conditions).map(([category, conditions]) => (
                    <div key={category} className="disease-category">
                      <h4>{category.replace(/\b\w/g, l => l.toUpperCase())}</h4>
                      <div className="disease-tags">
                        {conditions.map((condition: string, index: number) => (
                          <span 
                            key={index} 
                            className="disease-tag"
                            onClick={() => onRemoveCondition(category, condition)}
                            style={{ cursor: 'pointer' }}
                          >
                            {condition} <i className="fas fa-times"></i>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No medical conditions recorded yet.</p>
                )}
              </div>
            </div>


          </div>
        )}

        {/* Consultation History Tab Content */}
        {activeTab === 'consultation-history' && (
          <div className="tab-content active">
            <div className="history-container">
              <div className="history-header">
                <h2>Consultation History</h2>
                <div className="history-controls">
                  <button className="btn btn-primary" onClick={() => onOpenModal('addConsultationHistory')} aria-label="Add new consultation record">
                    <i className="fas fa-plus" aria-hidden="true"></i> Add Consultation
                  </button>
                </div>
              </div>
              
              {consultationHistory.length > 0 ? (
                <div className="consultation-list">
                  {consultationHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((consultation, index) => (
                    <div key={index} className="consultation-item">
                      <div className="consultation-header">
                        <h5>{(consultation.type || 'Consultation').replace(/\b\w/g, l => l.toUpperCase())}</h5>
                        <div className="consultation-header-controls">
                          <span className={`badge ${consultation.status}`}>{consultation.status}</span>
                        </div>
                        {onRemoveConsultation && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onRemoveConsultation(consultation.id || index.toString())}
                            aria-label="Delete consultation"
                            title="Delete consultation"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                      <div className="consultation-details">
                        <div className="detail-row">
                          <span className="detail-label"><i className="fas fa-calendar"></i> Date:</span>
                          <span className="detail-value">{new Date(consultation.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label"><i className="fas fa-user-md"></i> Doctor:</span>
                          <span className="detail-value">{consultation.doctorName || consultation.doctor || 'Not specified'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label"><i className="fas fa-stethoscope"></i> Type:</span>
                          <span className="detail-value">{consultation.type || 'General consultation'}</span>
                        </div>
                        {consultation.notes && (
                          <div className="detail-row">
                            <span className="detail-label"><i className="fas fa-notes-medical"></i> Notes:</span>
                            <span className="detail-value">{consultation.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-history"></i>
                  <p>No consultation history available</p>
                  <small>Patient has no previous consultation records.</small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patient Documents Tab Content */}
        {activeTab === 'patient-documents' && (
          <div className="tab-content active">
            <div className="documents-header">
              <h2>Documents</h2>
              <button 
                className="btn btn-primary" 
                onClick={() => onOpenModal('uploadDocument')}
                aria-label="Upload medical document"
              >
                <i className="fas fa-upload" aria-hidden="true"></i>
                Upload Document
              </button>
            </div>
            
            {/* Display actual patient documents */}
            {patientData?.activity?.documents && patientData.activity.documents.length > 0 ? (
              <div className="documents-list">
                {patientData.activity.documents.map((document: any, index: number) => (
                  <div key={index} className="document-item">
                    <div className="document-header">
                      <div className="document-info">
                        <h5>{document.name}</h5>
                        <div className="document-meta">
                          <span className="document-type">{document.type}</span>
                          <span className="document-size">{(document.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="document-date">
                            {new Date(document.uploadDate).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="document-actions">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => onOpenModal('viewDocument', document)}
                          aria-label="View document"
                          title="View document"
                        >
                          <i className="fas fa-eye"></i> View
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => onDownloadDocument && onDownloadDocument(document)}
                          aria-label="Download document"
                          title="Download document"
                        >
                          <i className="fas fa-download"></i> Download
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            console.log('🔍 Delete button clicked for document:', document)
                            console.log('🔍 Document ID:', document.id)
                            console.log('🔍 Document object:', document)
                            onRemoveDocument && onRemoveDocument(document.id)
                          }}
                          aria-label="Delete document"
                          title="Delete document"
                        >
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <i className="fas fa-file-medical"></i>
                <p>No documents uploaded yet</p>
                <small>Upload your first medical document to get started.</small>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default React.memo(ProfileSection)

