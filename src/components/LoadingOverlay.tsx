import React from 'react'

interface LoadingOverlayProps {
  isLoading: boolean
  isLoadingPatientData: boolean
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, isLoadingPatientData }) => {
  if (!isLoading && !isLoadingPatientData) return null

  return (
    <div 
      className="loading-overlay" 
      role="status" 
      aria-live="polite" 
      aria-label="Loading content"
    >
      <div className="loading-content">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p className="loading-message">Loading your health dashboard...</p>
        <p style={{ fontSize: '12px', color: '#4a5568', marginTop: '10px' }}> {/* Darker gray for WCAG AA compliance */}
          {isLoading ? 'Checking authentication...' : 'Loading patient data...'}
        </p>
      </div>
    </div>
  )
}

export default React.memo(LoadingOverlay)








