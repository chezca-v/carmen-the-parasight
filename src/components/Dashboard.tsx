import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { signOut } from 'firebase/auth'
import '../styles/shared-header.css'
import '../styles/dashboard.css'
import '../styles/csp-utilities.css'

// Types for better type safety
interface User {
  displayName: string | null
  email: string | null
  uid: string
}

interface Appointment {
  id: string
  doctorName: string
  specialty: string
  time: string
  patientName: string
  type: string
  status: 'confirmed' | 'pending' | 'virtual'
}





interface DashboardStats {
  totalPatients: number
  staffMembers: number
  todayAppointments: number
}

interface QuickAction {
  id: string
  title: string
  icon: string
  action: string
  description: string
}

const Dashboard: React.FC = React.memo(() => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<'dashboard' | 'my-consults' | 'help'>('dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('Yesterday')
  // Removed unused lastActivity state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [facilityAppointments, setFacilityAppointments] = useState<any[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [appointmentListener, setAppointmentListener] = useState<(() => void) | null>(null)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [selectedPatientData, setSelectedPatientData] = useState<any>(null)
  const [isLoadingPatientData, setIsLoadingPatientData] = useState(false)
  const [appointmentModalTab, setAppointmentModalTab] = useState<'details' | 'personal' | 'conditions' | 'history' | 'documents'>('details')
  const [facilityData, setFacilityData] = useState<any>(null)
  const [isLoadingFacilityData, setIsLoadingFacilityData] = useState(true)
  const [activeConsultsTab, setActiveConsultsTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming')
  
  // New appointment modal state
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false)
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    patientUid: '',
    date: '',
    time: '',
    doctor: '',
    type: 'consultation',
    notes: '',
    status: 'scheduled'
  })
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [patientValidationError, setPatientValidationError] = useState('')
  
  const sidebarRef = useRef<HTMLElement>(null)
  const sidebarOverlayRef = useRef<HTMLDivElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)







  // Dashboard statistics
  const dashboardStats: DashboardStats = useMemo(() => ({
    totalPatients: 2547,
    staffMembers: 45,
    todayAppointments: facilityAppointments.length
  }), [facilityAppointments])

  // Quick actions configuration
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'schedule',
      title: 'Schedule Appointment',
      icon: 'fas fa-calendar-plus',
      action: 'schedule',
      description: 'Book a new appointment'
    },
    {
      id: 'reports',
      title: 'View Reports',
      icon: 'fas fa-chart-bar',
      action: 'reports',
      description: 'Access analytics and reports'
    }
  ], [])

  useEffect(() => {
    // Check authentication
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user)
        setIsLoading(false)
        
        // Load facility data
        await loadFacilityData(user.uid)
        
        // Load appointments for the current user (facility or patient)
        loadUserAppointments(user.uid)
      } else {
        navigate('/')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [navigate])



  const loadFacilityData = useCallback(async (userId: string) => {
    setIsLoadingFacilityData(true)
    try {
      // Import the function dynamically to avoid TypeScript issues
      const { getFirestore, doc, getDoc } = await import('firebase/firestore')
      const db = getFirestore()
      const facilityDoc = await getDoc(doc(db, 'facilities', userId))
      
      if (facilityDoc.exists()) {
        const data = facilityDoc.data()
        setFacilityData(data)
      } else {
        setFacilityData(null)
      }
    } catch (error) {
      console.error('❌ Error loading facility data:', error)
      setFacilityData(null)
    } finally {
      setIsLoadingFacilityData(false)
    }
  }, [])

  const loadUserAppointments = useCallback(async (userId: string) => {
    setIsLoadingAppointments(true)
    try {
      // First, check if user is a facility
      const { getFirestore, doc, getDoc } = await import('firebase/firestore')
      const db = getFirestore()
      const facilityDoc = await getDoc(doc(db, 'facilities', userId))
      
      if (facilityDoc.exists()) {
        // User is a facility - load facility appointments
        const { getFacilityAppointments } = await import('../services/firestoredb.js')
        const appointments = await getFacilityAppointments(userId)
        setFacilityAppointments(appointments)
      } else {
        // User is a patient - load patient appointments
        const { getPatientAppointments } = await import('../services/firestoredb.js')
        const appointments = await getPatientAppointments(userId)
        setFacilityAppointments(appointments)
      }
    } catch (error) {
      console.error('❌ Error loading appointments:', error)
      setFacilityAppointments([])
    } finally {
      setIsLoadingAppointments(false)
    }
  }, [])



  const openAppointmentModal = useCallback(async (appointment: any) => {
    setSelectedAppointment(appointment)
    setShowAppointmentModal(true)
    setAppointmentModalTab('details')
    
    // Load comprehensive patient data
    if (appointment.patientId) {
      setIsLoadingPatientData(true)
      try {
        const { getPatientData, getConsultationHistory, getPatientDocuments } = await import('../services/firestoredb.js')
        
        // Load basic patient data
        const patientData = await getPatientData(appointment.patientId)
        console.log('📋 Basic patient data loaded:', patientData)
        
        // Load consultation history
        let consultationHistory: any[] = []
        try {
          consultationHistory = await getConsultationHistory(appointment.patientId)
          console.log('📋 Consultation history loaded:', consultationHistory)
        } catch (error) {
          console.warn('⚠️ Could not load consultation history:', error)
        }
        
        // Load patient documents
        let patientDocuments: any[] = []
        try {
          patientDocuments = await getPatientDocuments(appointment.patientId)
          console.log('📋 Patient documents loaded:', patientDocuments)
        } catch (error) {
          console.warn('⚠️ Could not load patient documents:', error)
        }
        
        // Combine all patient data
        const comprehensivePatientData = {
          ...patientData,
          activity: {
            ...(patientData?.activity || {}),
            consultationHistory: consultationHistory,
            documents: patientDocuments
          }
        }
        
        console.log('📋 Comprehensive patient data:', comprehensivePatientData)
        setSelectedPatientData(comprehensivePatientData)
      } catch (error) {
        console.error('❌ Error loading patient data:', error)
        setSelectedPatientData(null)
      } finally {
        setIsLoadingPatientData(false)
      }
    }
  }, [])

  const closeAppointmentModal = useCallback(() => {
    setShowAppointmentModal(false)
    setSelectedAppointment(null)
    setSelectedPatientData(null)
    setAppointmentModalTab('details')
  }, [])

  const openNewAppointmentModal = useCallback(() => {
    setShowNewAppointmentModal(true)
    setNewAppointmentForm({
      patientUid: '',
      date: '',
      time: '',
      doctor: '',
      type: 'consultation',
      notes: '',
      status: 'scheduled'
    })
    setPatientValidationError('')
  }, [])

  const closeNewAppointmentModal = useCallback(() => {
    setShowNewAppointmentModal(false)
    setNewAppointmentForm({
      patientUid: '',
      date: '',
      time: '',
      doctor: '',
      type: 'consultation',
      notes: '',
      status: 'scheduled'
    })
    setPatientValidationError('')
  }, [])

  const handleNewAppointmentFormChange = useCallback((field: string, value: string) => {
    setNewAppointmentForm(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear validation error when patient UID is being typed
    if (field === 'patientUid') {
      setPatientValidationError('')
    }
  }, [])

  const validatePatientUid = useCallback(async (uid: string) => {
    if (!uid.trim()) {
      setPatientValidationError('Patient UID is required')
      return false
    }
    
    try {
      const { getPatientData } = await import('../services/firestoredb.js')
      const patientData = await getPatientData(uid)
      
      if (!patientData) {
        setPatientValidationError('Patient not found with this UID')
        return false
      }
      
      if (patientData.role !== 'patient') {
        setPatientValidationError('UID belongs to a non-patient user')
        return false
      }
      
      setPatientValidationError('')
      return true
    } catch (error) {
      console.error('Error validating patient UID:', error)
      setPatientValidationError('Error validating patient UID')
      return false
    }
  }, [])

  // Removed unused auto-refresh effect

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth)
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [navigate])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const handleNavClick = useCallback((section: 'dashboard' | 'my-consults' | 'help') => {
    setActiveSection(section)
    closeSidebar()
  }, [closeSidebar])

  const handleTabClick = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  const handleConsultsTabClick = useCallback((tab: 'upcoming' | 'past' | 'cancelled') => {
    setActiveConsultsTab(tab)
  }, [])

  const filteredAppointments = useMemo(() => {
    if (!facilityAppointments.length) return []
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return facilityAppointments.filter(appointment => {
      const appointmentDate = new Date(appointment.date)
      const appointmentDateTime = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
      
      switch (activeConsultsTab) {
        case 'upcoming':
          return appointmentDateTime >= today && 
                 ['scheduled', 'confirmed', 'pending'].includes(appointment.status)
        case 'past':
          return appointmentDateTime < today || 
                 appointment.status === 'completed'
        case 'cancelled':
          return appointment.status === 'cancelled'
        default:
          return true
      }
    }).sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return activeConsultsTab === 'past' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime()
    })
  }, [facilityAppointments, activeConsultsTab])

  const handleQuickAction = useCallback((action: string) => {
    console.log(`Executing quick action: ${action}`)
    
    switch (action) {
      case 'schedule':
        showNotification('Opening appointment scheduler...', 'info')
        // In production, this would open the appointment booking interface
        break
      case 'reports':
        showNotification('Loading analytics dashboard...', 'info')
        // In production, this would navigate to reports section
        break
      default:
        showNotification('Action not implemented yet', 'info')
        break
    }
  }, [])

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }, [])

  const formatMonth = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [])

  const formatTime = useCallback((timeString: string) => {
    try {
      // Handle different time formats
      let time = timeString
      
      // If time is already in AM/PM format, return as is
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString
      }
      
      // If time is in HH:MM format, convert to AM/PM
      if (timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':')
        const hour = parseInt(hours, 10)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes.padStart(2, '0')} ${ampm}`
      }
      
      return timeString
    } catch (error) {
      console.warn('Error formatting time:', error)
      return timeString
    }
  }, [])

  const getUserInitials = useCallback(() => {
    if (!user?.displayName) return 'HF'
    return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
  }, [user?.displayName])

  const getUserDisplayName = useCallback(() => {
    // For facilities, get the facility name from the correct fields
    if (facilityData?.facilityInfo?.name) {
      return facilityData.facilityInfo.name
    }
    if (facilityData?.name) {
      return facilityData.name
    }
    if (facilityData?.personalInfo?.fullName) {
      return facilityData.personalInfo.fullName
    }
    if (user?.displayName) {
      return user.displayName
    }
    return 'Healthcare Facility'
  }, [facilityData, user?.displayName])

  // Check if current user is the facility that owns the appointment
  const isCurrentUserFacility = useCallback((appointmentFacilityId: string) => {
    return appointmentFacilityId === user?.uid
  }, [user?.uid])

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification')
    existingNotifications.forEach(notification => notification.remove())
    
    // Create notification
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${getNotificationColor(type)};
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

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'success': return 'check-circle'
      case 'error': return 'exclamation-circle'
      case 'warning': return 'exclamation-triangle'
      case 'info': return 'info-circle'
      default: return 'info-circle'
    }
  }, [])

  const getNotificationColor = useCallback((type: string) => {
    switch (type) {
      case 'success': return '#22c55e'
      case 'error': return '#ef4444'
      case 'warning': return '#f59e0b'
      case 'info': return '#3b82f6'
      default: return '#3b82f6'
    }
  }, [])

  // Removed unused handleNotificationToggle function

  // Removed unused updateLastActivity function

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    showNotification('Refreshing dashboard data...', 'info')
    
    // Simulate data refresh
    setTimeout(() => {
      setIsRefreshing(false)
      showNotification('Dashboard refreshed successfully!', 'success')
    }, 1500)
  }, [showNotification])

  const handleCreateAppointment = useCallback(async () => {
    // Validate form
    if (!newAppointmentForm.patientUid.trim()) {
      setPatientValidationError('Patient UID is required')
      return
    }
    
    if (!newAppointmentForm.date || !newAppointmentForm.time) {
      showNotification('Please select both date and time', 'error')
      return
    }
    
    // Validate patient UID
    const isValidPatient = await validatePatientUid(newAppointmentForm.patientUid)
    if (!isValidPatient) {
      return
    }
    
    setIsCreatingAppointment(true)
    
    try {
      const firestoreModule: any = await import('../services/firestoredb.js')
      
      await firestoreModule.createAppointmentForPatient(
        newAppointmentForm.patientUid,
        {
          date: newAppointmentForm.date,
          time: newAppointmentForm.time,
          doctor: newAppointmentForm.doctor,
          type: newAppointmentForm.type,
          notes: newAppointmentForm.notes,
          status: newAppointmentForm.status
        },
        user?.uid || '',
        getUserDisplayName()
      )
      
      showNotification('Appointment created successfully!', 'success')
      closeNewAppointmentModal()
      
      // Refresh appointments list
      if (user?.uid) {
        loadUserAppointments(user.uid)
      }
      
    } catch (error: any) {
      console.error('Error creating appointment:', error)
      showNotification(`Failed to create appointment: ${error.message}`, 'error')
    } finally {
      setIsCreatingAppointment(false)
    }
  }, [newAppointmentForm, user?.uid, validatePatientUid, closeNewAppointmentModal, loadUserAppointments, getUserDisplayName, showNotification])

  useEffect(() => {
    handleNavClick('dashboard')
    handleRefresh()
  }, [handleNavClick, handleRefresh])

  // Real-time listener for appointments (both facility and patient)
  useEffect(() => {
    if (!user?.uid) return
    
    // Real-time listener for appointments (both facility and patient)
    
    const setupRealTimeListener = async () => {
      try {
        const { getFirestore, collection, onSnapshot } = await import('firebase/firestore')
        const db = getFirestore()
        const patientsRef = collection(db, 'patients')
        
        const unsubscribe = onSnapshot(patientsRef, (querySnapshot) => {
          const appointments: any[] = []
          querySnapshot.forEach((doc) => {
            const patientData = doc.data()
            const patientAppointments = patientData?.activity?.appointments || []
            
            // Filter appointments based on user type
            let userAppointments: any[] = []
            
            // Check if current user is a facility
            if (doc.id === user.uid) {
              // User is a patient - show their own appointments
              userAppointments = patientAppointments
            } else {
              // Check if any appointments belong to this facility
              userAppointments = patientAppointments.filter((appointment: any) => {
                return appointment.facilityId === user.uid
              })
            }
            
            appointments.push(...userAppointments)
          })
          
          // Update the state with fresh data
          setFacilityAppointments(appointments)
          
          // Show notification if new appointments were added
          setFacilityAppointments(prevAppointments => {
            if (appointments.length > prevAppointments.length) {
              const newCount = appointments.length - prevAppointments.length
              const notification = document.createElement('div')
              notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #22c55e;
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
              notification.textContent = `${newCount} new appointment${newCount > 1 ? 's' : ''} received!`
              document.body.appendChild(notification)
              
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.remove()
                }
              }, 3000)
            }
            return appointments
          })
        })
        
        return unsubscribe
      } catch (error) {
        console.error('Error setting up real-time listener:', error)
        return () => {}
      }
    }
    
    let unsubscribe: (() => void) | null = null
    
    setupRealTimeListener().then((unsub) => {
      unsubscribe = unsub
    })
    
            return () => {
          if (unsubscribe) {
            unsubscribe()
          }
        }
  }, [user?.uid]) // Removed facilityAppointments.length from dependencies to prevent infinite loop

  // Removed unused handleAction function

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar()
      }
      if (event.key === 'm' && event.ctrlKey) {
        event.preventDefault()
        toggleSidebar()
      }
      if (event.key === 'r' && event.ctrlKey) {
        event.preventDefault()
        handleRefresh()
      }
      if (event.key === 'h' && event.ctrlKey) {
        event.preventDefault()
        handleNavClick('help')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeSidebar, toggleSidebar, handleNavClick, handleRefresh])

  if (isLoading || isLoadingFacilityData) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-message">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-layout" role="application" aria-label="Healthcare Management Dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`} ref={sidebarRef} role="navigation" aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="logo">
            <i className="fas fa-heartbeat" aria-hidden="true"></i>
            <span>LingapLink</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <ul className="nav-items">
            <li className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}>
              <button 
                className="nav-link" 
                onClick={(e) => { e.preventDefault(); handleNavClick('dashboard'); }}
                aria-current={activeSection === 'dashboard' ? 'page' : undefined}
              >
                <i className="fas fa-th-large" aria-hidden="true"></i>
                <span>Dashboard</span>
              </button>
            </li>
            <li className={`nav-item ${activeSection === 'my-consults' ? 'active' : ''}`}>
              <button 
                className="nav-link" 
                onClick={(e) => { e.preventDefault(); handleNavClick('my-consults'); }}
                aria-current={activeSection === 'my-consults' ? 'page' : undefined}
              >
                <i className="fas fa-notes-medical" aria-hidden="true"></i>
                <span>Appointments</span>
              </button>
            </li>
            <li className={`nav-item ${activeSection === 'help' ? 'active' : ''}`}>
              <button 
                className="nav-link" 
                onClick={(e) => { e.preventDefault(); handleNavClick('help'); }}
                aria-current={activeSection === 'help' ? 'page' : undefined}
              >
                <i className="fas fa-question-circle" aria-hidden="true"></i>
                <span>Help</span>
              </button>
            </li>
            <li className="nav-item">
              <button className="nav-link" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="sidebar-footer">
        </div>
      </aside>
      
      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} ref={sidebarOverlayRef} onClick={closeSidebar}></div>

      {/* Main Content */}
      <main className="main-content" ref={mainContentRef}>
        {/* Top Bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <button 
              className="mobile-menu-toggle" 
              onClick={toggleSidebar}
              aria-label="Toggle mobile menu"
            >
            </button>
            
            <button 
              className="refresh-btn" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard (Ctrl+R)"
            >
            </button>
          </div>
          

        </div>
        
        <div className="main-container">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <section className="content-section active">
              <div className="section-header">
                <h1>Dashboard</h1>
                <p>Healthcare facility management dashboard</p>
              </div>
            
              <div className="stats-grid" ref={statsRef} role="region" aria-label="Dashboard statistics">
                <div className="stat-card" role="article" aria-label="Total patients statistic">
                  <div className="stat-icon">
                    <i className="fas fa-users" aria-hidden="true"></i>
                  </div>
                  <div className="stat-info">
                    <h3 className="stat-number" data-target={dashboardStats.totalPatients}>
                      {dashboardStats.totalPatients.toLocaleString()}
                    </h3>
                    <p>Total Patients</p>
                  </div>
                </div>
                
                <div className="stat-card" role="article" aria-label="Staff members statistic">
                  <div className="stat-icon">
                    <i className="fas fa-id-badge" aria-hidden="true"></i>
                  </div>
                  <div className="stat-info">
                    <h3 className="stat-number" data-target={dashboardStats.staffMembers}>
                      {dashboardStats.staffMembers}
                    </h3>
                    <p>Staff Members</p>
                  </div>
                </div>
                
                <div className="stat-card" role="article" aria-label="Today's appointments statistic">
                  <div className="stat-icon">
                    <i className="fas fa-calendar-check" aria-hidden="true"></i>
                  </div>
                  <div className="stat-info">
                    <h3 className="stat-number" data-target={dashboardStats.todayAppointments}>
                      {dashboardStats.todayAppointments}
                    </h3>
                    <p>Today's Appointments</p>
                  </div>
                </div>
                

              </div>

              <div className="quick-actions" role="region" aria-label="Quick actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons" role="group" aria-label="Available quick actions">
                  {quickActions.map((action) => (
                    <button 
                      key={action.id}
                      className="btn btn-outline action-btn" 
                      onClick={() => handleQuickAction(action.action)}
                      aria-label={action.description}
                      title={action.description}
                    >
                      <i className={action.icon} aria-hidden="true"></i>
                      <span>{action.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="dashboard-section" role="region" aria-label="Today's schedule">
                <h3>Today's Schedule</h3>
                <div className="appointments-list" role="list" aria-label="List of today's appointments">
                  {isLoadingAppointments ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <i className="fas fa-spinner fa-spin"></i>
                      </div>
                      <h3>Loading Schedule...</h3>
                      <p>Please wait while we fetch today's appointments.</p>
                    </div>
                  ) : facilityAppointments.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <i className="fas fa-calendar-times"></i>
                      </div>
                      <h3>No Appointments Today</h3>
                      <p>You don't have any appointments scheduled for today.</p>
                    </div>
                  ) : (
                    facilityAppointments.map((appointment) => (
                      <div key={appointment.id} className="appointment-card" role="listitem">
                        <div className="appointment-date" aria-label={`Appointment time: ${appointment.time}`}>
                          <span className="date">{formatTime(appointment.time).split(' ')[0]}</span>
                          <span className="month">{formatTime(appointment.time).split(' ')[1]}</span>
                        </div>
                        <div className="appointment-info">
                          <h4>{appointment.doctor || 'Doctor TBD'}</h4>
                          <p>{appointment.type} - {appointment.facilityName || 'Facility'}</p>
                          <div className="appointment-time">Patient: {appointment.patientName}</div>
                        </div>
                        <div className="appointment-actions">
                          <span className={`status ${appointment.status}`} aria-label={`Appointment status: ${appointment.status}`}>
                            {appointment.status === 'confirmed' ? 'Confirmed' : 
                             appointment.status === 'pending' ? 'Pending' : 
                             appointment.status === 'scheduled' ? 'Scheduled' : 
                             appointment.status === 'completed' ? 'Completed' : 
                             appointment.status === 'cancelled' ? 'Cancelled' : appointment.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>


            </section>
          )}



          {/* My Consults Section */}
          {activeSection === 'my-consults' && (
            <section className="content-section active">
              <div className="section-header-flex">
                <div className="section-title">
                  <h1 className="section-main-title">Appointments</h1>
                  <p className="facility-info" style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                    <i className="fas fa-calendar-alt"></i> {facilityData ? 'Healthcare Facility' : 'Patient Portal'}
                  </p>
                </div>
                <div className="section-controls">
                  <select className="date-dropdown">
                    <option>May'23</option>
                  </select>
                                    <button 
                    className="btn btn-outline" 
                    onClick={() => user && loadUserAppointments(user.uid)}
                    disabled={isLoadingAppointments}
                    title="Refresh appointments list"
                  >
                    <i className={`fas ${isLoadingAppointments ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                    {isLoadingAppointments ? ' Refreshing...' : ' Refresh Appointments'}
                  </button>
                  <button className="btn btn-primary" onClick={openNewAppointmentModal}>
                    <i className="fas fa-plus"></i> New Appointment
                  </button>
                </div>
              </div>

              <div className="content-tabs">
                <button 
                  className={`tab-link ${activeConsultsTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => handleConsultsTabClick('upcoming')}
                >
                  Upcoming
                </button>
                <button 
                  className={`tab-link ${activeConsultsTab === 'past' ? 'active' : ''}`}
                  onClick={() => handleConsultsTabClick('past')}
                >
                  Past
                </button>
                <button 
                  className={`tab-link ${activeConsultsTab === 'cancelled' ? 'active' : ''}`}
                  onClick={() => handleConsultsTabClick('cancelled')}
                >
                  Cancelled
                </button>
              </div>
              
              <div className="records-list">
                {isLoadingAppointments ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                    <h3>Loading Appointments...</h3>
                    <p>Please wait while we fetch your appointments.</p>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="fas fa-calendar-times"></i>
                    </div>
                    <h3>No {activeConsultsTab.charAt(0).toUpperCase() + activeConsultsTab.slice(1)} Appointments</h3>
                    <p>
                      {activeConsultsTab === 'upcoming' && "You don't have any upcoming appointments scheduled."}
                      {activeConsultsTab === 'past' && "You don't have any past appointments or completed consultations."}
                      {activeConsultsTab === 'cancelled' && "You don't have any cancelled appointments."}
                    </p>
                    {activeConsultsTab === 'upcoming' && (
                      <>
                        <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                          <i className="fas fa-info-circle"></i> 
                          {facilityData ? 
                            'Patients can book appointments through the PatientPortal. Use the refresh button above to check for new appointments.' :
                            'You can book appointments through the PatientPortal. Use the refresh button above to check for new appointments.'
                          }
                        </p>
                        <button className="btn btn-primary" onClick={openNewAppointmentModal}>
                          <i className="fas fa-plus"></i> Schedule New Appointment
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <div key={appointment.id} className="record-item-card">
                      <div className="date-box">
                        <span className="day">{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="date-num">{new Date(appointment.date).getDate()}</span>
                      </div>
                      <div className="record-divider-v"></div>
                      <div className="record-details-grid">
                        <div className="detail-item-flex">
                          <i className="far fa-clock"></i>
                          <span>{formatTime(appointment.time)}</span>
                        </div>
                        <div className="detail-item-flex">
                          <span>Type: {appointment.type}</span>
                        </div>
                        <div className="detail-item-flex">
                          <i className="far fa-user"></i>
                          <span>{appointment.patientName}</span>
                        </div>
                        <div className="detail-item-flex">
                          <span>Status: {appointment.status}</span>
                        </div>
                        {appointment.doctor && (
                          <div className="detail-item-flex">
                            <i className="fas fa-user-md"></i>
                            <span>{appointment.doctor}</span>
                          </div>
                        )}
                        {appointment.notes && (
                          <div className="detail-item-flex">
                            <span>Notes: {appointment.notes}</span>
                          </div>
                        )}
                      </div>
                      <div className="record-actions-dropdown">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => openAppointmentModal(appointment)}
                          style={{ marginBottom: '8px' }}
                        >
                          <i className="fas fa-eye"></i> View Details
                        </button>
                        <select 
                          value={appointment.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value
                            console.log('Status changed to:', newStatus)
                            
                            try {
                              // Import the update function
                              const { updateAppointmentStatus } = await import('../services/firestoredb.js')
                              
                              // Update the appointment status in the database
                              await updateAppointmentStatus(
                                appointment.id,
                                newStatus,
                                appointment.patientId,
                                user?.uid || ''
                              )
                              
                              // Show success notification
                              showNotification(`Appointment status updated to ${newStatus}`, 'success')
                              
                              // Reload appointments to reflect the change
                              if (user?.uid) {
                                loadUserAppointments(user.uid)
                              }
                              
                            } catch (error) {
                              console.error('Error updating appointment status:', error)
                              showNotification('Failed to update appointment status', 'error')
                            }
                          }}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}



          {/* Help Section */}
          {activeSection === 'help' && (
            <section className="content-section active">
              <div className="section-header">
                <h1>Help & Support</h1>
                <p>Get help with managing your healthcare facility</p>
              </div>
              
              <div className="help-search">
                <div className="search-box">
                  <i className="fas fa-search" aria-hidden="true"></i>
                  <input type="text" placeholder="Search for help articles..." aria-label="Search for help articles" />
                </div>
              </div>
              
              <div className="help-categories">
                <h3>Help Categories</h3>
                <div className="category-grid">
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-tachometer-alt" aria-hidden="true"></i>
                    </div>
                    <h4>Dashboard Overview</h4>
                    <p>Learn about your facility dashboard features and navigation</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-users" aria-hidden="true"></i>
                    </div>
                    <h4>Patient Management</h4>
                    <p>Add, edit, and manage patient records effectively</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-calendar-alt" aria-hidden="true"></i>
                    </div>
                    <h4>Staff Scheduling</h4>
                    <p>Manage staff schedules and facility availability</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-video" aria-hidden="true"></i>
                    </div>
                    <h4>Virtual Care Setup</h4>
                    <p>Configure and manage virtual healthcare services</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-chart-bar" aria-hidden="true"></i>
                    </div>
                    <h4>Reports & Analytics</h4>
                    <p>Generate and analyze facility performance reports</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-shield-alt" aria-hidden="true"></i>
                    </div>
                    <h4>Security & Compliance</h4>
                    <p>Understand data protection and healthcare compliance</p>
                  </div>
                </div>
              </div>

              <div className="faq-section">
                <h3>Frequently Asked Questions</h3>
                <div className="faq-list">
                  <div className="faq-item">
                    <button className="faq-question">
                      <span>How do I register a new patient in the system?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>To register a new patient, go to the Patient Records section and click the "New Patient" button. Fill in the required information including personal details, medical history, and contact information.</p>
                    </div>
                  </div>
                  
                  <div className="faq-item">
                    <button className="faq-question">
                      <span>How can I manage staff schedules for my facility?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>Use the Staff Scheduling section to view and manage all medical staff schedules. You can assign shifts, track availability, and coordinate department coverage from the calendar interface.</p>
                    </div>
                  </div>
                  
                  <div className="faq-item">
                    <button className="faq-question">
                      <span>How do I set up virtual care services for my facility?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>Go to the Virtual Care section and enable virtual services. Configure available consultation types (video, phone, chat), set operating hours, and establish consultation fees for your facility.</p>
                    </div>
                  </div>
                  
                  <div className="faq-item">
                    <button className="faq-question">
                      <span>Can I export facility data and generate reports?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>Yes, you can export patient data and generate comprehensive facility reports from the dashboard. Use the "View Reports" quick action for detailed analytics and export options.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="help-categories">
                <h3>Need More Help?</h3>
                <div className="category-grid">
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-phone" aria-hidden="true"></i>
                    </div>
                    <h4>Phone Support</h4>
                    <p>Call us at +63 2 8123 4567. Available 24/7</p>
                  </div>
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-envelope" aria-hidden="true"></i>
                    </div>
                    <h4>Email Support</h4>
                    <p>support@lingaplink.ph. Response within 24 hours</p>
                  </div>
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-comments" aria-hidden="true"></i>
                    </div>
                    <h4>Live Chat</h4>
                    <p>Chat with our support team</p>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Start Chat</button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Appointment Details Modal */}
      {showAppointmentModal && selectedAppointment && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3>Appointment Details</h3>
              <button className="close-btn" onClick={closeAppointmentModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Modal Tabs */}
              <div className="modal-tabs">
                <button 
                  className={`modal-tab ${appointmentModalTab === 'details' ? 'active' : ''}`}
                  onClick={() => setAppointmentModalTab('details')}
                >
                  <i className="fas fa-calendar-alt"></i> Appointment Details
                </button>
                <button 
                  className={`modal-tab ${appointmentModalTab === 'personal' ? 'active' : ''}`}
                  onClick={() => setAppointmentModalTab('personal')}
                >
                  <i className="fas fa-user"></i> Personal Info
                </button>
                <button 
                  className={`modal-tab ${appointmentModalTab === 'conditions' ? 'active' : ''}`}
                  onClick={() => setAppointmentModalTab('conditions')}
                >
                  <i className="fas fa-heartbeat"></i> Medical Conditions
                </button>
                <button 
                  className={`modal-tab ${appointmentModalTab === 'history' ? 'active' : ''}`}
                  onClick={() => setAppointmentModalTab('history')}
                >
                  <i className="fas fa-history"></i> Consultation History
                </button>
                <button 
                  className={`modal-tab ${appointmentModalTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setAppointmentModalTab('documents')}
                >
                  <i className="fas fa-file-medical"></i> Documents
                </button>
              </div>

              {/* Tab Content */}
              <div className="modal-tab-content" style={{ padding: '20px', maxHeight: '60vh', overflow: 'auto' }}>
                {/* Appointment Details Tab */}
                {appointmentModalTab === 'details' && (
                  <div className="tab-panel">
                    <div className="appointment-details-grid">
                      <div className="detail-section">
                        <h4><i className="fas fa-calendar"></i> Appointment Information</h4>
                        <div className="detail-item">
                          <label>Date:</label>
                          <span>{new Date(selectedAppointment.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="detail-item">
                          <label>Time:</label>
                          <span>{formatTime(selectedAppointment.time)}</span>
                        </div>
                        <div className="detail-item">
                          <label>Type:</label>
                          <span className={`badge ${selectedAppointment.type}`}>{selectedAppointment.type}</span>
                        </div>
                        <div className="detail-item">
                          <label>Status:</label>
                          <span className={`badge ${selectedAppointment.status}`}>{selectedAppointment.status}</span>
                        </div>
                        {selectedAppointment.doctor && (
                          <div className="detail-item">
                            <label>Doctor:</label>
                            <span>{selectedAppointment.doctor}</span>
                          </div>
                        )}
                        {selectedAppointment.notes && (
                          <div className="detail-item">
                            <label>Notes:</label>
                            <span>{selectedAppointment.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="detail-section">
                        <h4><i className="fas fa-user"></i> Patient Information</h4>
                        <div className="detail-item">
                          <label>Name:</label>
                          <span>{selectedAppointment.patientName}</span>
                        </div>
                        <div className="detail-item">
                          <label>Email:</label>
                          <span>{selectedAppointment.patientEmail}</span>
                        </div>
                        <div className="detail-item">
                          <label>Facility:</label>
                          <span>{selectedAppointment.facilityName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Info Tab */}
                {appointmentModalTab === 'personal' && (
                  <div className="tab-panel">
                    {isLoadingPatientData ? (
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading patient information...</p>
                      </div>
                    ) : selectedPatientData ? (
                      <div className="personal-info-grid">
                        <div className="info-section">
                          <h4><i className="fas fa-user-circle"></i> Basic Information</h4>
                          <div className="info-item">
                            <label>Full Name:</label>
                            <span>{selectedPatientData.personalInfo?.fullName || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Date of Birth:</label>
                            <span>{selectedPatientData.personalInfo?.dateOfBirth || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Age:</label>
                            <span>{selectedPatientData.personalInfo?.age || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Gender:</label>
                            <span>{selectedPatientData.personalInfo?.gender || 'Not provided'}</span>
                          </div>
                        </div>

                        <div className="info-section">
                          <h4><i className="fas fa-address-book"></i> Contact Information</h4>
                          <div className="info-item">
                            <label>Email:</label>
                            <span>{selectedPatientData.email || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Phone:</label>
                            <span>{selectedPatientData.personalInfo?.phone || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Address:</label>
                            <span>{selectedPatientData.personalInfo?.address || 'Not provided'}</span>
                          </div>
                        </div>

                        <div className="info-section">
                          <h4><i className="fas fa-info-circle"></i> Additional Information</h4>
                          <div className="info-item">
                            <label>Bio:</label>
                            <span>{selectedPatientData.personalInfo?.bio || 'Not provided'}</span>
                          </div>
                          <div className="info-item">
                            <label>Profile Complete:</label>
                            <span className={`badge ${selectedPatientData.profileComplete ? 'success' : 'warning'}`}>
                              {selectedPatientData.profileComplete ? 'Complete' : 'Incomplete'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state">
                        <i className="fas fa-user-slash"></i>
                        <p>Patient information not available</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Medical Conditions Tab */}
                {appointmentModalTab === 'conditions' && (
                  <div className="tab-panel">
                    {isLoadingPatientData ? (
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading medical conditions...</p>
                      </div>
                    ) : selectedPatientData?.medicalInfo?.conditions ? (
                      <div className="conditions-grid">
                        {Object.entries(selectedPatientData.medicalInfo.conditions).map(([category, conditions]: [string, any]) => (
                          <div key={category} className="condition-category">
                            <h4>
                              <i className="fas fa-heartbeat"></i> 
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </h4>
                            <div className="condition-tags">
                              {conditions.map((condition: string, index: number) => (
                                <span key={index} className="condition-tag">
                                  <i className="fas fa-exclamation-triangle"></i>
                                  {condition}
                                </span>
                              ))}
                            </div>
                            <div className="condition-count">
                              <small>{conditions.length} condition{conditions.length !== 1 ? 's' : ''} in this category</small>
                            </div>
                          </div>
                        ))}
                        <div className="conditions-summary">
                          <div className="summary-card">
                            <h5><i className="fas fa-chart-pie"></i> Summary</h5>
                            <p>Total Categories: {Object.keys(selectedPatientData.medicalInfo.conditions).length}</p>
                            <p>Total Conditions: {Object.values(selectedPatientData.medicalInfo.conditions).flat().length}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state">
                        <i className="fas fa-heartbeat"></i>
                        <p>No medical conditions recorded</p>
                        <small>Patient has not reported any pre-existing medical conditions.</small>
                      </div>
                    )}
                  </div>
                )}

                {/* Consultation History Tab */}
                {appointmentModalTab === 'history' && (
                  <div className="tab-panel">
                    {isLoadingPatientData ? (
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading consultation history...</p>
                      </div>
                    ) : selectedPatientData?.activity?.consultationHistory?.length > 0 ? (
                      <div className="consultation-history">
                        {selectedPatientData.activity.consultationHistory.map((consultation: any, index: number) => (
                          <div key={index} className="consultation-item">
                            <div className="consultation-header">
                              <h5>{consultation.title || consultation.type || 'Consultation'}</h5>
                              <span className={`badge ${consultation.status}`}>{consultation.status}</span>
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
                                <span className="detail-value">{consultation.doctor || 'Not specified'}</span>
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
                              {consultation.facility && (
                                <div className="detail-row">
                                  <span className="detail-label"><i className="fas fa-hospital"></i> Facility:</span>
                                  <span className="detail-value">{consultation.facility}</span>
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
                )}

                {/* Documents Tab */}
                {appointmentModalTab === 'documents' && (
                  <div className="tab-panel">
                    {isLoadingPatientData ? (
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading patient documents...</p>
                      </div>
                    ) : selectedPatientData?.activity?.documents?.length > 0 ? (
                      <div className="documents-grid">
                        {selectedPatientData.activity.documents.map((document: any, index: number) => (
                          <div key={index} className="document-item">
                            <div className="document-icon">
                              <i className={`fas ${document.type?.startsWith('image/') ? 'fa-image' : 
                                               document.type === 'application/pdf' ? 'fa-file-pdf' : 
                                               'fa-file-medical'}`}></i>
                            </div>
                            <div className="document-info">
                              <h5>{document.name || document.originalName || 'Document'}</h5>
                              <p>{document.type || 'Unknown type'}</p>
                              <small>Uploaded: {new Date(document.uploadDate).toLocaleDateString()}</small>
                              {document.size && (
                                <small>Size: {(document.size / 1024 / 1024).toFixed(2)} MB</small>
                              )}
                            </div>
                            <div className="document-actions">
                              <button 
                                className="btn btn-outline btn-sm"
                                onClick={() => window.open(document.url, '_blank')}
                                title="View document"
                              >
                                <i className="fas fa-eye"></i> View
                              </button>
                              <a 
                                href={document.url} 
                                download={document.originalName || document.name}
                                className="btn btn-primary btn-sm"
                                title="Download document"
                              >
                                <i className="fas fa-download"></i> Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <i className="fas fa-file-medical"></i>
                        <p>No documents available</p>
                        <small>Patient has not uploaded any medical documents yet.</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeAppointmentModal}>
                Close
              </button>
              <button className="btn btn-primary">
                <i className="fas fa-edit"></i> Edit Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Modal */}
      {showNewAppointmentModal && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Create New Appointment</h3>
              <button className="close-btn" onClick={closeNewAppointmentModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="patientUid">Patient UID *</label>
                <input
                  type="text"
                  id="patientUid"
                  value={newAppointmentForm.patientUid}
                  onChange={(e) => handleNewAppointmentFormChange('patientUid', e.target.value)}
                  placeholder="Enter patient UID (e.g., 7ib2p9tdrs0QzKlrfLqay5fiw2t2)"
                  className={patientValidationError ? 'error' : ''}
                />
                {patientValidationError && (
                  <div className="error-message">
                    <i className="fas fa-exclamation-circle"></i>
                    {patientValidationError}
                  </div>
                )}
                <small className="form-help">
                  <i className="fas fa-info-circle"></i>
                  You can find the patient's UID in their profile in the PatientPortal.
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appointmentDate">Date *</label>
                  <input
                    type="date"
                    id="appointmentDate"
                    value={newAppointmentForm.date}
                    onChange={(e) => handleNewAppointmentFormChange('date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="appointmentTime">Time *</label>
                  <input
                    type="time"
                    id="appointmentTime"
                    value={newAppointmentForm.time}
                    onChange={(e) => handleNewAppointmentFormChange('time', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="doctor">Doctor</label>
                  <input
                    type="text"
                    id="doctor"
                    value={newAppointmentForm.doctor}
                    onChange={(e) => handleNewAppointmentFormChange('doctor', e.target.value)}
                    placeholder="Doctor's name"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="appointmentType">Type</label>
                  <select
                    id="appointmentType"
                    value={newAppointmentForm.type}
                    onChange={(e) => handleNewAppointmentFormChange('type', e.target.value)}
                  >
                    <option value="consultation">Consultation</option>
                    <option value="checkup">Check-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="followup">Follow-up</option>
                    <option value="surgery">Surgery</option>
                    <option value="virtual">Virtual Consultation</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="appointmentStatus">Status</label>
                <select
                  id="appointmentStatus"
                  value={newAppointmentForm.status}
                  onChange={(e) => handleNewAppointmentFormChange('status', e.target.value)}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="appointmentNotes">Notes</label>
                <textarea
                  id="appointmentNotes"
                  value={newAppointmentForm.notes}
                  onChange={(e) => handleNewAppointmentFormChange('notes', e.target.value)}
                  placeholder="Additional notes about the appointment..."
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeNewAppointmentModal}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateAppointment}
                disabled={isCreatingAppointment}
              >
                {isCreatingAppointment ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus"></i>
                    Create Appointment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

Dashboard.displayName = 'Dashboard'

export default Dashboard 