import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import PatientSignIn from './components/PatientSignIn'
import PatientSignUp from './components/PatientSignUp'
import PatientPortal from './components/PatientPortal'
import Dashboard from './components/Dashboard'
import PartnerSignIn from './components/PartnerSignIn'
import PartnerSignUp from './components/PartnerSignUp'
import HIPAAComplianceDashboard from './components/HIPAAComplianceDashboard'
import QuickAppoinments from './components/QuickAppoinments'
import TriageDemo from './components/TriageDemo'
import './index.css'

const App: React.FC = () => {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/patient-sign-in" element={<PatientSignIn />} />
        <Route path="/patient-sign-up" element={<PatientSignUp />} />
        <Route path="/patient-portal" element={<PatientPortal />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hipaa-compliance" element={<HIPAAComplianceDashboard />} />
        <Route path="/partner-sign-in" element={<PartnerSignIn />} />
        <Route path="/partner-sign-up" element={<PartnerSignUp />} />
        <Route path="/quick-appointments" element={<QuickAppoinments />} />
        <Route path="/triage-demo" element={<TriageDemo />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App 