import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import PatientSignIn from './components/PatientSignIn'
import PatientSignUp from './components/PatientSignUp'
import PatientPortal from './components/PatientPortal'
import Dashboard from './components/Dashboard'
import PartnerSignIn from './components/PartnerSignIn'
import PartnerSignUp from './components/PartnerSignUp'
import './index.css'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/patient-sign-in" element={<PatientSignIn />} />
        <Route path="/patient-sign-up" element={<PatientSignUp />} />
        <Route path="/patient-portal" element={<PatientPortal />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/partner-sign-in" element={<PartnerSignIn />} />
        <Route path="/partner-sign-up" element={<PartnerSignUp />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App 