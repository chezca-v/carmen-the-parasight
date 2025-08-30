import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { signOut } from 'firebase/auth'
import '../styles/shared-header.css'
import '../styles/patientPortal.css'
import '../styles/csp-utilities.css'

import QuotaStatusBanner from './QuotaStatusBanner'

// Lazy load components for better performance
const DashboardSection = lazy(() => import('./DashboardSection'))
const ProfileSection = lazy(() => import('./ProfileSection'))
const Sidebar = lazy(() => import('./Sidebar'))
const TopBar = lazy(() => import('./TopBar'))
const LoadingOverlay = lazy(() => import('./LoadingOverlay'))
const NotificationSystem = lazy(() => import('./NotificationSystem'))
const VirtualScrollingList = lazy(() => import('./VirtualScrollingList'))

// Import utility functions
import { formatTime, formatDate, formatDateTime } from '../utils/dateUtils'

// Define types locally to avoid import issues
interface PatientData {
  uid: string;
  email: string;
  role: string;
  uniquePatientId?: string; // Keep unique patient ID optional
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth: string;
    age: number | null;
    gender: string;
    phone: string;
    address: string;
    bio: string;
  };
  medicalInfo?: {
    conditions?: {
      [category: string]: string[];
    };
  };

  profileComplete: boolean;
  createdAt: any;
  lastLoginAt: any;
  updatedAt: any;
  isActive: boolean;
  emailVerified: boolean;
  authProvider: string;
  activity?: {
    appointments?: any[];
    documents?: any[];
  };
}

interface AppointmentData {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
  doctor: string;
  type: string;
  status: string;
  patientNotes: string; // Notes from the patient when booking
  facilityNotes: string; // Notes/remarks from healthcare facility staff
  facilityId: string;
  facilityName: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  modificationHistory?: Array<{
    timestamp: string;
    modifiedBy: string;
    changes: {
      [field: string]: {
        from: any;
        to: any;
      } | null;
    };
  }>;
}

interface PersonalInfo {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  phone?: string;
  address?: string;
  bio?: string;
}

interface MedicalInfo {
  conditions?: {
    [category: string]: string[];
  };
}



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
  date: string
  time: string
  type: 'virtual' | 'in-person'
  status: 'upcoming' | 'completed' | 'cancelled'
}

interface Activity {
  id: string
  type: 'appointment' | 'upload' | 'prescription'
  title: string
  description: string
  timestamp: string
  icon: string
}

interface EditProfileForm {
  firstName: string
  lastName: string
  fullName: string
  dateOfBirth: string
  age: number | null
  gender: string
  phone: string
  address: string
  bio: string
}

interface AddConditionForm {
  category: string
  condition: string
}

interface ConsultationHistoryForm {
  date: string
  doctor: string
  type: 'virtual' | 'in-person'
  status: 'completed' | 'cancelled' | 'no-show'
  notes: string
}

interface FacilityData {
  id: string;
  uid: string;
  email: string;
  role: string;
  uniqueFacilityId: string;
  facilityInfo: {
    name: string;
    type: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    website: string;
    description: string;
  };
  operatingHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  specialties: string[];
  services: string[];
  staff: {
    totalStaff: number;
    doctors: number;
    nurses: number;
    supportStaff: number;
  };
  capacity: {
    bedCapacity: number;
    consultationRooms: number;
  };
  licenseNumber: string;
  accreditation: string[];
  insuranceAccepted: string[];
  languages: string[];
  isActive: boolean;
  isVerified: boolean;
  profileComplete: boolean;
  createdAt: any;
  lastLoginAt: any;
  updatedAt: any;
  emailVerified: boolean;
  authProvider: string;
}

const PatientPortal: React.FC = () => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<'dashboard' | 'profile' | 'help' | 'facilities'>('dashboard')
  
  const [activeTab, setActiveTab] = useState<'general' | 'consultation-history' | 'patient-documents'>('general')
  const [activeAppointmentsTab, setActiveAppointmentsTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const [showModal, setShowModal] = useState<string | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isBookingAppointment, setIsBookingAppointment] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState({
    facilityId: '',
    facilityName: '',
    doctor: '',
    date: '',
    time: '',
    type: '',
    patientNotes: '', // Notes from the patient when booking
    // New fields for booking for different people
    isBookingForOther: false,
    patientForAppointment: {
      name: '',
      relationship: '',
      age: '',
      gender: '',
      phone: '',
      email: ''
    }
  })
  
  // Patient data state
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [isLoadingPatientData, setIsLoadingPatientData] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isAddingCondition, setIsAddingCondition] = useState(false)
  
  // Profile edit form state
  const [editProfileForm, setEditProfileForm] = useState<EditProfileForm>({
    firstName: '',
    lastName: '',
    fullName: '',
    dateOfBirth: '',
    age: null,
    gender: '',
    phone: '',
    address: '',
    bio: ''
  })
  
  // Add condition form state
  const [addConditionForm, setAddConditionForm] = useState<AddConditionForm>({
    category: '',
    condition: ''
  })
  
  // Consultation history form state
  const [consultationHistoryForm, setConsultationHistoryForm] = useState<ConsultationHistoryForm>({
    date: '',
    doctor: '',
    type: 'virtual',
    status: 'completed',
    notes: ''
  })
  
  // Consultation history state
  const [consultationHistory, setConsultationHistory] = useState<any[]>([])
  const [isLoadingConsultationHistory, setIsLoadingConsultationHistory] = useState(false)
  const [isAddingConsultation, setIsAddingConsultation] = useState(false)
  
  // Document upload state
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [isPerformingDocumentOperation, setIsPerformingDocumentOperation] = useState(false)
  
  // Document viewer state
  const [viewingDocument, setViewingDocument] = useState<any>(null)
  
  // Edit appointment state
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [isEditingAppointment, setIsEditingAppointment] = useState(false)
  const [editAppointmentForm, setEditAppointmentForm] = useState({
    facilityId: '',
    facilityName: '',
    doctor: '',
    date: '',
    time: '',
    type: '',
    patientNotes: '' // Notes from the patient when booking
  })
  
  // Appointment updates modal state
  const [viewingAppointmentUpdates, setViewingAppointmentUpdates] = useState<any>(null)
  
  // Facilities state
  const [facilities, setFacilities] = useState<FacilityData[]>([])
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false)
  const [facilitySearchTerm, setFacilitySearchTerm] = useState('')
  const [selectedFacilityType, setSelectedFacilityType] = useState('')
  const [selectedFacilityCity, setSelectedFacilityCity] = useState('')
  const [selectedFacilitySpecialty, setSelectedFacilitySpecialty] = useState('')
  const [selectedFacility, setSelectedFacility] = useState<FacilityData | null>(null)
  
  // Available categories for medical conditions
  const conditionCategories = [
    'Speech',
    'Physical',
    'Mental Health',
    'Cardiovascular',
    'Respiratory',
    'Digestive',
    'Neurological',
    'Endocrine',
    'Other'
  ]
  
  // Refs for cleanup
  const headerScrollRef = useRef<(() => void) | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const notificationTimeoutRef = useRef<number | null>(null)

  // Refs for focus management
  const mainContentRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const sidebarOverlayRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const firstTabRef = useRef<HTMLButtonElement>(null)
  const lastTabRef = useRef<HTMLButtonElement>(null)

  // Memoized data for better performance
  const appointments: Appointment[] = useMemo(() => [
    {
      id: '1',
      doctorName: 'Dr. Sarah Johnson',
      specialty: 'Cardiology Consultation',
      date: '2024-03-22',
      time: '10:30 AM',
      type: 'virtual',
      status: 'upcoming'
    }
  ], [])

  // Filter appointments based on active tab
  const filteredAppointments = useMemo(() => {
    if (!patientData?.activity?.appointments?.length) return []
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return patientData.activity.appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.date)
      const appointmentDateTime = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
      
      switch (activeAppointmentsTab) {
        case 'upcoming':
          return appointmentDateTime >= today && 
                 ['scheduled', 'confirmed', 'pending'].includes(appointment.status)
        case 'completed':
          return appointment.status === 'completed'
        case 'cancelled':
          return appointment.status === 'cancelled'
        default:
          return true
      }
    }).sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return activeAppointmentsTab === 'completed' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime()
    })
  }, [patientData?.activity?.appointments, activeAppointmentsTab])

  const activities: Activity[] = useMemo(() => [
    {
      id: '1',
      type: 'appointment',
      title: 'Appointment Scheduled',
      description: 'Cardiology consultation with Dr. Sarah Johnson',
      timestamp: '2 hours ago',
      icon: 'fas fa-calendar-plus'
    },
    {
      id: '2',
      type: 'upload',
      title: 'Lab Results Uploaded',
      description: 'Blood work results from March 15, 2024',
      timestamp: '1 day ago',
      icon: 'fas fa-file-upload'
    },
    {
      id: '3',
      type: 'prescription',
      title: 'Prescription Updated',
      description: 'Medication dosage adjusted by Dr. Michael Chen',
      timestamp: '3 days ago',
      icon: 'fas fa-pills'
    }
  ], [])

  useEffect(() => {
    console.log('🔍 PatientPortal useEffect triggered')
    // Check authentication
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('🔍 Auth state changed:', user ? 'User logged in' : 'No user')
      
            if (user) {
        setUser(user)
        setIsLoading(false)
        
        // Try to load from localStorage first
        try {
          const localPatientData = localStorage.getItem(`patientData_${user.uid}`)
          if (localPatientData) {
            const parsedData = JSON.parse(localPatientData)
            console.log('📦 Loaded patient data from localStorage:', parsedData)
            setPatientData(parsedData)
            
            // Check for appointment modifications on localStorage load
            if (parsedData?.activity?.appointments) {
              checkForAppointmentModifications(parsedData.activity.appointments)
            }
            
            setIsLoadingPatientData(false)
            return
          }
        } catch (error) {
          console.warn('Failed to load from localStorage:', error)
        }
        
        // Try to load existing patient data from Firestore first
        try {
          console.log('📦 Attempting to load existing patient data from Firestore...')
          const { getPatientData } = await import('../services/firestoredb.js')
          const existingPatientData = await getPatientData(user.uid)
          
          if (existingPatientData) {
            console.log('✅ Found existing patient data in Firestore:', existingPatientData)
            console.log('📋 Documents in loaded data:', existingPatientData?.activity?.documents)
            console.log('📋 Number of documents:', existingPatientData?.activity?.documents?.length || 0)
            setPatientData(existingPatientData)
            
            // Check for appointment modifications on Firestore load
            if (existingPatientData?.activity?.appointments) {
              checkForAppointmentModifications(existingPatientData.activity.appointments)
            }
            
            setIsLoadingPatientData(false)
            return
          }
        } catch (error) {
          console.warn('⚠️ Failed to load from Firestore, will create new document:', error)
        }
        
        // If no existing data, try to create patient document in Firestore
        try {
          console.log('📦 Creating new patient document in Firestore...')
          const { createPatientDocument } = await import('../services/firestoredb.js')
          const firestorePatientData = await createPatientDocument(user, {
            firstName: user.displayName?.split(' ')[0] || '',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            authProvider: user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email'
          })
          console.log('✅ Patient document created in Firestore:', firestorePatientData)
          setPatientData(firestorePatientData)
          
          // Check for appointment modifications on initial load
          if (firestorePatientData?.activity?.appointments) {
            checkForAppointmentModifications(firestorePatientData.activity.appointments)
          }
        } catch (error) {
          console.warn('⚠️ Failed to create patient document in Firestore, using local data:', error)
          
          // Create basic patient data locally as fallback
          const basicPatientData = {
            uid: user.uid,
            email: user.email || '',
            role: 'patient',
            uniquePatientId: user.uid,
            personalInfo: {
              firstName: user.displayName?.split(' ')[0] || '',
              lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
              fullName: user.displayName || user.email?.split('@')[0] || 'Patient',
              dateOfBirth: '',
              age: null,
              gender: '',
              phone: '',
              address: '',
              bio: 'Welcome to LingapLink!'
            },
            medicalInfo: {
              conditions: {}
            },

            profileComplete: false,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            emailVerified: user.emailVerified || false,
            authProvider: user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email',
            activity: {
              appointments: []
            }
          }
          
          setPatientData(basicPatientData)
          
          // Save to localStorage
          try {
            localStorage.setItem(`patientData_${user.uid}`, JSON.stringify(basicPatientData))
            console.log('✅ Basic patient data saved to localStorage')
          } catch (localStorageError) {
            console.warn('Failed to save to localStorage:', localStorageError)
          }
        }
        
        setIsLoadingPatientData(false)
      } else {
        console.log('🔍 No user found, redirecting to sign-in')
        navigate('/patient-sign-in')
      }
    })

    return () => unsubscribe()
  }, [navigate])

  // Real-time listener for patient data updates (appointments, etc.)
  useEffect(() => {
    if (!user?.uid) return

    console.log('🔍 Setting up real-time listener for patient data...')
    
    const setupRealTimeListener = async () => {
      try {
        const { listenToPatientData } = await import('../services/firestoredb.js')
        const unsubscribe = listenToPatientData(user.uid, (updatedPatientData) => {
          console.log('🔄 Real-time update received:', updatedPatientData)
          console.log('📋 Appointments in update:', updatedPatientData?.activity?.appointments || [])
          console.log('📋 Number of appointments:', updatedPatientData?.activity?.appointments?.length || 0)
          console.log('📋 Documents in update:', updatedPatientData?.activity?.documents || [])
          console.log('📋 Number of documents:', updatedPatientData?.activity?.documents?.length || 0)
          
          // Check for appointment modifications and show notifications
          if (updatedPatientData?.activity?.appointments) {
            checkForAppointmentModifications(updatedPatientData.activity.appointments)
          }
          
          // Only update state if the data is actually different to prevent conflicts
          // and if we're not currently performing a document operation
          if (!isPerformingDocumentOperation) {
            setPatientData(prevData => {
              if (!prevData) return updatedPatientData
              
              // Check if documents have changed
              const prevDocCount = prevData?.activity?.documents?.length || 0
              const newDocCount = updatedPatientData?.activity?.documents?.length || 0
              
              if (prevDocCount !== newDocCount) {
                console.log('🔄 Document count changed, updating state')
                return updatedPatientData
              }
              
              // Check if appointments have changed
              const prevApptCount = prevData?.activity?.appointments?.length || 0
              const newApptCount = updatedPatientData?.activity?.appointments?.length || 0
              
              if (prevApptCount !== newApptCount) {
                console.log('🔄 Appointment count changed, updating state')
                return updatedPatientData
              }
              
              // For other changes, update the state
              return updatedPatientData
            })
          } else {
            console.log('🔄 Skipping real-time update during document operation')
          }
          
          // Update localStorage
          try {
            localStorage.setItem(`patientData_${user.uid}`, JSON.stringify(updatedPatientData))
            console.log('💾 Updated localStorage with fresh data')
          } catch (localStorageError) {
            console.warn('⚠️ localStorage update failed:', localStorageError)
          }
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
        console.log('🔍 Cleaning up real-time listener...')
        unsubscribe()
      }
    }
  }, [user?.uid])



  // Debug patient data changes
  useEffect(() => {
    console.log('🔍 Patient data changed:', patientData)
    console.log('🔍 Documents array:', patientData?.activity?.documents)
  }, [patientData])

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth)
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [navigate])

  // Keyboard navigation handlers
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, isFirstTab: boolean, isLastTab: boolean) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && isFirstTab) {
        // Shift+Tab from first tab should go to previous element
        e.preventDefault()
        const prevElement = e.currentTarget.previousElementSibling as HTMLElement
        prevElement?.focus()
      } else if (!e.shiftKey && isLastTab) {
        // Tab from last tab should go to next element
        e.preventDefault()
        const nextElement = e.currentTarget.nextElementSibling as HTMLElement
        nextElement?.focus()
      }
    }
  }, [])

  const handleSidebarKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isSidebarOpen) {
      closeSidebar()
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from sidebar should go to main content
      e.preventDefault()
      mainContentRef.current?.focus()
    }
  }, [isSidebarOpen])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Enter in search should trigger search
      e.preventDefault()
      // Add search functionality here
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from search should go to first tab
      e.preventDefault()
      firstTabRef.current?.focus()
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    console.log('🔘 toggleSidebar called')
    const newState = !isSidebarOpen
    console.log('🔘 Setting sidebar state to:', newState)
    setIsSidebarOpen(newState)
    
    if (sidebarRef.current) {
      console.log('🔘 Toggling sidebar active class')
      sidebarRef.current.classList.toggle('active')
      console.log('🔘 Sidebar classes after toggle:', sidebarRef.current.className)
    }
    
    if (sidebarOverlayRef.current) {
      console.log('🔘 Toggling sidebar overlay active class')
      sidebarOverlayRef.current.classList.toggle('active')
      console.log('🔘 Overlay classes after toggle:', sidebarOverlayRef.current.className)
    }
  }, [isSidebarOpen])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
    if (sidebarRef.current) {
      sidebarRef.current.classList.remove('active')
    }
    if (sidebarOverlayRef.current) {
      sidebarOverlayRef.current.classList.remove('active')
    }
  }, [])

  const handleNavClick = useCallback((section: 'dashboard' | 'profile' | 'help' | 'facilities') => {
    setActiveSection(section)
    closeSidebar()
  }, [closeSidebar])

  const handleTabClick = useCallback((tab: 'general' | 'consultation-history' | 'patient-documents') => {
    setActiveTab(tab)
  }, [])

  const handleAppointmentsTabClick = useCallback((tab: 'upcoming' | 'completed' | 'cancelled') => {
    setActiveAppointmentsTab(tab)
  }, [])

  const openModal = useCallback((modalType: string, additionalData?: any) => {
    console.log('🔘 openModal called with:', modalType, additionalData)
    console.log('Current showModal state before:', showModal)
    setShowModal(modalType)
    console.log('Setting showModal to:', modalType)
    
    // Handle document-specific modals
    if (modalType === 'viewDocument' && additionalData) {
      console.log('📄 Setting viewing document:', additionalData)
      setViewingDocument(additionalData)
    }
    
    // Load facilities if opening Book Appointment modal (regardless of current section)
    if (modalType === 'bookAppointment' && user) {
      console.log('🔍 Loading facilities for Book Appointment modal...')
      loadFacilities()
    }
    
    // Initialize forms when opening modals
    if (modalType === 'editProfile' && patientData?.personalInfo) {
      console.log('📝 Initializing edit profile form with:', patientData.personalInfo)
      setEditProfileForm({
        firstName: patientData.personalInfo.firstName || '',
        lastName: patientData.personalInfo.lastName || '',
        fullName: patientData.personalInfo.fullName || '',
        dateOfBirth: patientData.personalInfo.dateOfBirth || '',
        age: patientData.personalInfo.age || null,
        gender: patientData.personalInfo.gender || '',
        phone: patientData.personalInfo.phone || '',
        address: patientData.personalInfo.address || '',
        bio: patientData.personalInfo.bio || ''
      })
    }
    
    if (modalType === 'addCondition') {
      console.log('📝 Initializing add condition form')
      setAddConditionForm({ category: '', condition: '' })
    }
  }, [patientData, user])

  const closeModal = useCallback(() => {
    setShowModal(null)
    setAppointmentForm({
      facilityId: '',
      facilityName: '',
      doctor: '',
      date: '',
      time: '',
      type: '',
      patientNotes: '', // Notes from the patient when booking
      // Reset new fields for booking for different people
      isBookingForOther: false,
      patientForAppointment: {
        name: '',
        relationship: '',
        age: '',
        gender: '',
        phone: '',
        email: ''
      }
    })
    // Reset edit appointment form
    setEditAppointmentForm({
      facilityId: '',
      facilityName: '',
      doctor: '',
      date: '',
      time: '',
      type: '',
      patientNotes: '' // Notes from the patient when booking
    })
    setEditingAppointment(null)
    // Reset consultation history form
    setConsultationHistoryForm({
      date: '',
      doctor: '',
      type: 'virtual',
      status: 'completed',
      notes: ''
    })
    // Reset upload form
    setSelectedFile(null)
    setDocumentName('')
    setUploadProgress(0)
    setIsUploadingDocument(false)
    // Reset appointment updates viewer
    setViewingAppointmentUpdates(null)
  }, [])

  // Notification function - simplified since we moved the complex logic to NotificationSystem
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // This will be handled by the NotificationSystem component
    if (typeof window !== 'undefined' && (window as any).showNotification) {
      (window as any).showNotification(message, type)
    }
  }, [])

  // Check for appointment modifications and show notifications
  const checkForAppointmentModifications = useCallback((appointments: any[]) => {
    appointments.forEach(appointment => {
      // Skip appointments that don't have meaningful modification history
      if (!appointment.updatedBy || 
          !appointment.modificationHistory || 
          appointment.modificationHistory.length === 0) {
        return
      }
      
      // Skip if this appears to be an initial appointment creation (all 'to' values are undefined)
      const lastModification = appointment.modificationHistory[appointment.modificationHistory.length - 1]
      if (!lastModification?.changes) {
        return
      }
      
      // Check if this is just an initial creation (all 'to' values are undefined)
      const allChangesUndefined = Object.values(lastModification.changes).every(change => {
        const typedChange = change as { from: any; to: any } | null
        return !typedChange || typedChange.to === undefined || typedChange.to === null
      })
      
      if (allChangesUndefined) {
        return // Skip initial appointment creation
      }
      
      const modificationTime = new Date(lastModification.timestamp)
      const now = new Date()
      
      // Show notification if modification was made in the last 5 minutes
      if (now.getTime() - modificationTime.getTime() < 5 * 60 * 1000) {
        const changes = Object.entries(lastModification.changes)
          .filter(([field, change]) => {
            const typedChange = change as { from: any; to: any } | null
            // Filter out changes where 'to' is undefined (initial creation) or where from equals to (no actual change)
            return typedChange && 
                   typedChange.to !== undefined && 
                   typedChange.from !== typedChange.to &&
                   typedChange.to !== null
          })
          .map(([field, change]) => {
            const typedChange = change as { from: any; to: any }
            return `${field}: ${formatTimeForDisplay(typedChange.from) || '—'} → ${formatTimeForDisplay(typedChange.to)}`
          })
          .join(', ')
        
        // Only show notification if there are actual meaningful changes
        if (changes.trim()) {
          showNotification(`Your appointment has been updated by ${appointment.facilityName || 'the healthcare facility'}: ${changes}`, 'info')
        }
      }
    })
  }, [showNotification])

  const handleBookAppointment = useCallback(async () => {
    console.log('🔍 handleBookAppointment called')
    console.log('User:', user)
    console.log('Appointment form:', appointmentForm)
    
    if (!user) {
      console.error('❌ No user found')
      showNotification('Please sign in to book an appointment', 'error')
      return
    }
    
    // Enhanced validation
    const requiredFields = {
      facilityId: appointmentForm.facilityId,
      date: appointmentForm.date,
      time: appointmentForm.time,
      type: appointmentForm.type
    }
    
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key)
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields)
      showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error')
      return
    }

    // Validate date is not in the past
    const selectedDate = new Date(appointmentForm.date + 'T' + appointmentForm.time)
    const now = new Date()
    if (selectedDate <= now) {
      showNotification('Please select a future date and time for your appointment', 'error')
      return
    }

    setIsBookingAppointment(true)
    console.log('🔄 Starting appointment booking...')
    
    try {
      console.log('📦 Importing firestoredb...')
      const { addAppointment, getPatientData } = await import('../services/firestoredb.js')
      console.log('✅ addAppointment imported successfully')
      
      const appointmentData = {
        facilityId: appointmentForm.facilityId,
        facilityName: appointmentForm.facilityName,
        patientName: appointmentForm.isBookingForOther ? appointmentForm.patientForAppointment.name : (user.displayName || patientData?.personalInfo?.fullName || 'Patient'),
        patientEmail: user.email || patientData?.email || '',
        doctor: appointmentForm.doctor || 'To Be Determined',
        date: appointmentForm.date,
        time: appointmentForm.time,
        type: appointmentForm.type,
        patientNotes: appointmentForm.patientNotes || '', // Notes from the patient when booking
        facilityNotes: '', // Initialize empty facility notes
        status: 'scheduled',
        // New fields for booking for different people
        isBookingForOther: appointmentForm.isBookingForOther,
        patientForAppointment: appointmentForm.isBookingForOther ? appointmentForm.patientForAppointment : null,
        bookedBy: {
          uid: user.uid,
          name: user.displayName || patientData?.personalInfo?.fullName || 'Patient',
          email: user.email || patientData?.email || '',
          relationship: appointmentForm.isBookingForOther ? appointmentForm.patientForAppointment.relationship : 'self'
        }
      }
      
      console.log('📋 Appointment data:', appointmentData)
      console.log('🔄 Calling addAppointment...')
      
      const result = await addAppointment(user.uid, appointmentData)
      
      console.log('✅ Appointment booked successfully!', result)
      
      // Refresh patient data to show the new appointment
      try {
        console.log('🔄 Refreshing patient data...')
        const updatedPatientData = await getPatientData(user.uid)
        if (updatedPatientData) {
          setPatientData(updatedPatientData)
          console.log('✅ Patient data refreshed with new appointment')
          
          // Update localStorage
          try {
            localStorage.setItem(`patientData_${user.uid}`, JSON.stringify(updatedPatientData))
            console.log('✅ Updated localStorage with fresh data')
          } catch (localStorageError) {
            console.warn('⚠️ localStorage update failed:', localStorageError)
          }
        } else {
          console.warn('⚠️ Could not get updated patient data')
        }
      } catch (refreshError) {
        console.warn('⚠️ Could not refresh patient data:', refreshError)
        // Try to update local state manually
        if (patientData) {
                  const newAppointment = {
          id: typeof result === 'object' && result?.id ? result.id : `appointment_${Date.now()}`,
          patientId: user.uid,
          patientName: appointmentData.patientName,
          patientEmail: appointmentData.patientEmail,
          date: appointmentData.date,
          time: appointmentData.time,
          doctor: appointmentData.doctor,
          type: appointmentData.type,
          status: appointmentData.status,
          patientNotes: appointmentData.patientNotes,
          facilityNotes: appointmentData.facilityNotes,
          facilityId: appointmentData.facilityId,
          facilityName: appointmentData.facilityName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
          setPatientData(prev => prev ? {
            ...prev,
            activity: {
              ...(prev.activity || {}),
              appointments: [...(prev.activity?.appointments || []), newAppointment]
            },
            updatedAt: new Date().toISOString()
          } : null)
          console.log('✅ Updated local state manually with new appointment')
        }
      }
      
              showNotification('Appointment booked successfully!', 'success')
      closeModal()
      
    } catch (error: any) {
      console.error('❌ Error booking appointment:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      
      let errorMessage = 'Failed to book appointment'
      
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to book appointments. Please contact support.'
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
      } else if (error.message) {
        errorMessage = `Booking failed: ${error.message}`
      }
      
      showNotification(errorMessage, 'error')
    } finally {
      setIsBookingAppointment(false)
    }
  }, [user, appointmentForm, patientData, closeModal])

  const handleSaveProfile = useCallback(async () => {
    console.log('🔍 handleSaveProfile called')
    console.log('User:', user)
    console.log('Edit form data:', editProfileForm)
    

    
    // Validate required fields
    if (!editProfileForm.firstName.trim() || !editProfileForm.lastName.trim() || !editProfileForm.fullName.trim()) {
      console.error('❌ Missing required fields')
      showNotification('Please fill in all required fields (First Name, Last Name, and Full Name)', 'error')
      return
    }
    
    setIsSavingProfile(true)
    console.log('🔄 Starting profile update...')
    
    try {
      // Calculate age from date of birth if provided
      let calculatedAge = editProfileForm.age
      if (editProfileForm.dateOfBirth && !editProfileForm.age) {
        const birthDate = new Date(editProfileForm.dateOfBirth)
        const today = new Date()
        calculatedAge = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge = calculatedAge - 1
        }
      }
      
      const personalInfo: PersonalInfo = {
        firstName: editProfileForm.firstName.trim(),
        lastName: editProfileForm.lastName.trim(),
        fullName: editProfileForm.fullName.trim(),
        dateOfBirth: editProfileForm.dateOfBirth,
        age: calculatedAge || undefined,
        gender: editProfileForm.gender,
        phone: editProfileForm.phone.trim(),
        address: editProfileForm.address.trim(),
        bio: editProfileForm.bio.trim()
      }
      
      console.log('📋 Personal info to update:', personalInfo)
      console.log('🔍 Gender value being sent:', personalInfo.gender)
      console.log('🔍 Gender type:', typeof personalInfo.gender)
      
      // Update local state immediately for better UX
      setPatientData(prev => prev ? {
        ...prev,
        personalInfo: {
          ...prev.personalInfo,
          ...personalInfo
        },
        updatedAt: new Date().toISOString()
      } : null)
      
      console.log('✅ Local state updated successfully!')
      
      // Save to localStorage for persistence
      try {
        const userData = {
          ...patientData,
          personalInfo: {
            ...patientData?.personalInfo,
            ...personalInfo
          },
          updatedAt: new Date().toISOString()
        }
        localStorage.setItem(`patientData_${user?.uid || 'local'}`, JSON.stringify(userData))
        console.log('✅ Data saved to localStorage')
      } catch (localStorageError) {
        console.warn('⚠️ localStorage save failed:', localStorageError)
      }
      
      // Try to update Firebase
      if (user) {
        try {
          console.log('📦 Attempting Firebase update...')
          console.log('🔐 User authentication status:', user.uid, user.email)
          
          const { updatePatientPersonalInfo, getPatientData, createPatientDocument } = await import('../services/firestoredb.js')
          
          // First check if patient document exists
          const existingPatientData = await getPatientData(user.uid)
          
          if (!existingPatientData) {
            console.log('📝 Patient document does not exist, creating it first...')
            // Create the patient document first
            await createPatientDocument(user, {
              firstName: personalInfo.firstName,
              lastName: personalInfo.lastName
            })
            console.log('✅ Patient document created successfully')
          }
          
          // Now update the personal info
          await updatePatientPersonalInfo(user.uid, personalInfo)
          
          console.log('✅ Firebase update successful!')
          showNotification('Profile updated successfully! Changes saved to server.', 'success')
        } catch (firebaseError: any) {
          console.warn('⚠️ Firebase update failed:', firebaseError)
          
          // Show more specific error information
          let errorMessage = 'Profile updated locally! Server sync failed. Your changes are saved.'
          
          if (firebaseError.code === 'permission-denied') {
            errorMessage = 'Profile updated locally! Permission denied. Please check your authentication.'
          } else if (firebaseError.code === 'unauthenticated') {
            errorMessage = 'Profile updated locally! Please sign in again to sync with server.'
          } else if (firebaseError.code === 'resource-exhausted') {
            errorMessage = 'Profile updated locally! Firebase quota exceeded. Please try again later.'
          } else if (firebaseError.message) {
            errorMessage = `Profile updated locally! ${firebaseError.message}`
          }
          
          showNotification(errorMessage, 'info')
        }
      } else {
        // No user logged in - local only
        showNotification('Profile updated locally! Sign in to sync with server.', 'info')
      }
      
      closeModal()
    } catch (error: any) {
      console.error('❌ Error saving profile:', error)
      showNotification('Profile update failed. Please try again.', 'error')
    } finally {
      setIsSavingProfile(false)
    }
  }, [user, editProfileForm, closeModal, patientData])

  const handleAddCondition = useCallback(async () => {
    console.log('🔍 handleAddCondition called')
    console.log('User:', user)
    console.log('Add condition form:', addConditionForm)
    
    if (!addConditionForm.category || !addConditionForm.condition.trim()) {
      console.error('❌ Missing required fields')
      showNotification('Please fill in both category and condition', 'error')
      return
    }
    
    const trimmedCondition = addConditionForm.condition.trim()
    
    // Check if condition already exists in the category
    const existingConditions = patientData?.medicalInfo?.conditions?.[addConditionForm.category] || []
    if (existingConditions.includes(trimmedCondition)) {
      console.error('❌ Condition already exists')
      showNotification('This condition already exists in the selected category', 'error')
      return
    }
    
    setIsAddingCondition(true)
    console.log('🔄 Starting condition addition...')
    
    try {
      // Update local state immediately
      setPatientData(prev => {
        if (!prev) return prev
        
        const updatedConditions = {
          ...prev.medicalInfo?.conditions,
          [addConditionForm.category]: [
            ...(prev.medicalInfo?.conditions?.[addConditionForm.category] || []),
            trimmedCondition
          ]
        }
        
        return {
          ...prev,
          medicalInfo: {
            ...prev.medicalInfo,
            conditions: updatedConditions
          }
        }
      })
      
      console.log('✅ Local state updated successfully!')
      
      // Save to localStorage for persistence
      try {
        const userData = {
          ...patientData,
          medicalInfo: {
            ...patientData?.medicalInfo,
            conditions: {
              ...patientData?.medicalInfo?.conditions,
              [addConditionForm.category]: [
                ...(patientData?.medicalInfo?.conditions?.[addConditionForm.category] || []),
                trimmedCondition
              ]
            }
          },
          updatedAt: new Date().toISOString()
        }
        localStorage.setItem(`patientData_${user?.uid || 'local'}`, JSON.stringify(userData))
        console.log('✅ Data saved to localStorage')
      } catch (localStorageError) {
        console.warn('⚠️ localStorage save failed:', localStorageError)
      }
      
      // Try to update Firebase with timeout
      if (user) {
        try {
          console.log('📦 Attempting Firebase update...')
          const { addMedicalCondition } = await import('../services/firestoredb.js')
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase update timeout - quota likely exceeded')), 5000)
          })
          
          await Promise.race([
            addMedicalCondition(user.uid, addConditionForm.category, trimmedCondition),
            timeoutPromise
          ])
          
          console.log('✅ Firebase update successful!')
          showNotification('Medical condition added successfully! Changes saved to server.', 'success')
        } catch (firebaseError: any) {
          console.warn('⚠️ Firebase update failed:', firebaseError)
          console.warn('This might be due to quota limits. Changes saved locally.')
          showNotification('Medical condition added locally! Note: Server sync failed due to quota limits.', 'info')
        }
      }
      
      // Reset form
      setAddConditionForm({ category: '', condition: '' })
      closeModal()
    } catch (error: any) {
      console.error('❌ Error adding condition:', error)
      showNotification('Failed to add condition. Please try again.', 'error')
    } finally {
      setIsAddingCondition(false)
    }
  }, [user, addConditionForm, closeModal, patientData])

  const handleAddConsultationHistory = useCallback(async () => {
    console.log('🔍 handleAddConsultationHistory called')
    console.log('User:', user)
    console.log('Consultation form:', consultationHistoryForm)
    
    if (!consultationHistoryForm.date || !consultationHistoryForm.doctor.trim()) {
      console.error('❌ Missing required fields')
      showNotification('Please fill in the date and doctor name', 'error')
      return
    }
    
    setIsAddingConsultation(true)
    console.log('🔄 Starting consultation history addition...')
    
    try {
      // Update local state immediately
      const newConsultation = {
        id: `consultation_${Date.now()}`,
        doctorName: consultationHistoryForm.doctor.trim(),
        specialty: consultationHistoryForm.type,
        date: consultationHistoryForm.date,
        time: '00:00',
        type: consultationHistoryForm.type,
        status: consultationHistoryForm.status,
        notes: consultationHistoryForm.notes.trim()
      }
      
      setConsultationHistory(prev => [newConsultation, ...prev])
      console.log('✅ Local state updated successfully!')
      
      // Try to update Firebase
      if (user) {
        try {
          console.log('📦 Attempting Firebase update...')
          const { addConsultationHistory } = await import('../services/firestoredb.js')
          
          await addConsultationHistory(user.uid, {
            id: `consultation_${Date.now()}`,
            doctorName: consultationHistoryForm.doctor.trim(),
            specialty: consultationHistoryForm.type,
            date: consultationHistoryForm.date,
            time: '00:00',
            type: consultationHistoryForm.type,
            status: consultationHistoryForm.status,
            notes: consultationHistoryForm.notes.trim()
          })
          
          console.log('✅ Firebase update successful!')
          showNotification('Consultation history added successfully!', 'success')
        } catch (firebaseError: any) {
          console.warn('⚠️ Firebase update failed:', firebaseError)
          showNotification('Consultation history added locally! Note: Server sync failed.', 'info')
        }
      }
      
      // Reset form
      setConsultationHistoryForm({
        date: '',
        doctor: '',
        type: 'virtual',
        status: 'completed',
        notes: ''
      })
      closeModal()
    } catch (error: any) {
      console.error('❌ Error adding consultation history:', error)
      showNotification('Failed to add consultation history. Please try again.', 'error')
    } finally {
      setIsAddingConsultation(false)
    }
  }, [user, consultationHistoryForm, closeModal])

  const handleRemoveCondition = useCallback(async (category: string, condition: string) => {
    if (!user) return
    
    if (!confirm(`Are you sure you want to remove "${condition}" from ${category}?`)) {
      return
    }
    
    try {
      const { removeMedicalCondition } = await import('../services/firestoredb.js')
      
      await removeMedicalCondition(user.uid, category, condition)
      
      // Update local state
      setPatientData(prev => {
        if (!prev) return prev
        
        const currentConditions = prev.medicalInfo?.conditions || {}
        const updatedConditionsInCategory = currentConditions[category]?.filter(c => c !== condition) || []
        
        let updatedConditions;
        if (updatedConditionsInCategory.length === 0) {
          // Remove the entire category if it's empty
          const { [category]: removedCategory, ...remainingConditions } = currentConditions;
          updatedConditions = remainingConditions;
          console.log(`Category "${category}" removed completely from local state as it's now empty`);
        } else {
          // Keep the category with remaining conditions
          updatedConditions = {
            ...currentConditions,
            [category]: updatedConditionsInCategory
          };
        }
        
        return {
          ...prev,
          medicalInfo: {
            ...prev.medicalInfo,
            conditions: updatedConditions
          }
        }
      })
      
      showNotification('Medical condition removed successfully!', 'success')
    } catch (error: any) {
      console.error('Error removing condition:', error)
      showNotification(`Failed to remove condition: ${error.message}`, 'error')
    }
  }, [user])

  const handleUploadDocument = useCallback(async () => {
    if (!user || !selectedFile) {
      showNotification('Please select a file to upload', 'error')
      return
    }
    
    setIsUploadingDocument(true)
    setUploadProgress(0)
    
    try {
      console.log('🔍 handleUploadDocument called')
      console.log('User:', user)
      console.log('File:', selectedFile)
      console.log('Document name:', documentName)
      
      // Set flag to prevent real-time listener interference
      setIsPerformingDocumentOperation(true)
      
      const { addPatientDocument } = await import('../services/firestoredb.js')
      
      // Upload document to Firestore and Firebase Storage
      const uploadedDocument = await addPatientDocument(user.uid, selectedFile, documentName || selectedFile.name)
      
      console.log('✅ Document uploaded successfully:', uploadedDocument)
      
      // Update local state directly with the new document
      setPatientData(prev => {
        if (!prev) return prev
        
        const updatedDocuments = [
          ...(prev.activity?.documents || []),
          uploadedDocument
        ]
        
        console.log('📦 Updated documents array:', updatedDocuments)
        
        return {
          ...prev,
          activity: {
            ...prev.activity,
            documents: updatedDocuments
          }
        }
      })
      
      // Reset form
      setSelectedFile(null)
      setDocumentName('')
      setUploadProgress(0)
      
      showNotification('Document uploaded successfully!', 'success')
      closeModal()
      
    } catch (error: any) {
      console.error('❌ Error uploading document:', error)
      showNotification(`Failed to upload document: ${error.message}`, 'error')
    } finally {
      setIsUploadingDocument(false)
      setUploadProgress(0)
      // Clear the flag after operation completes
      setIsPerformingDocumentOperation(false)
    }
  }, [user, selectedFile, documentName, closeModal])

  const handleViewDocument = useCallback((document: any) => {
    console.log('🔍 Opening document viewer for:', document)
    setViewingDocument(document)
    setShowModal('viewDocument')
  }, [])
  
  const handleViewAppointmentUpdates = useCallback((appointment: any) => {
    console.log('🔍 Opening appointment updates viewer for:', appointment)
    setViewingAppointmentUpdates(appointment)
    setShowModal('viewAppointmentUpdates')
  }, [])

  const handleOpenDocument = useCallback((document: any) => {
    try {
      console.log('🔍 Opening document in new tab:', document)
      
      // Convert base64 to blob
      const base64Data = document.url.split(',')[1] // Remove data:application/pdf;base64, prefix
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: document.type })
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob)
      
      // Open in new tab
      window.open(blobUrl, '_blank')
      
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 1000)
      
    } catch (error) {
      console.error('❌ Error opening document:', error)
      showNotification('Failed to open document. Please try downloading it instead.', 'error')
    }
  }, [])
  
  const handleDownloadDocument = useCallback((document: any) => {
    try {
      console.log('🔍 Downloading document:', document)
      
      // Convert base64 to blob
      const base64Data = document.url.split(',')[1] // Remove data:application/pdf;base64, prefix
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: document.type })
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob)
      
      // Create download link
      const downloadLink = document.createElement('a')
      downloadLink.href = blobUrl
      downloadLink.download = document.originalName || document.name
      downloadLink.style.display = 'none'
      
      // Append to body, click, and remove
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 1000)
      
      showNotification('Document download started!', 'success')
      
    } catch (error) {
      console.error('❌ Error downloading document:', error)
      showNotification('Failed to download document. Please try again.', 'error')
    }
  }, [])

  const handleRemoveDocument = useCallback(async (documentId: string) => {
    if (!user) return
    
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }
    
    try {
      console.log('🔍 handleRemoveDocument called for document:', documentId)
      console.log('🔍 Current patient data documents:', patientData?.activity?.documents)
      console.log('🔍 Document IDs in current data:', patientData?.activity?.documents?.map(doc => doc.id))
      
      // Set flag to prevent real-time listener interference
      setIsPerformingDocumentOperation(true)
      
      // Update local state immediately for better UX
      setPatientData(prev => {
        if (!prev) return prev
        
        const updatedDocuments = prev.activity?.documents?.filter(doc => doc.id !== documentId) || []
        
        console.log('📦 Updated documents array after removal:', updatedDocuments)
        console.log('📦 Number of documents before:', prev.activity?.documents?.length || 0)
        console.log('📦 Number of documents after:', updatedDocuments.length)
        
        return {
          ...prev,
          activity: {
            ...prev.activity,
            documents: updatedDocuments
          },
          updatedAt: new Date().toISOString()
        }
      })
      
      // Try to remove from Firebase/Firestore
      try {
        console.log('📦 Attempting Firebase/Firestore removal...')
        const { removePatientDocument } = await import('../services/firestoredb.js')
        
        await removePatientDocument(user.uid, documentId)
        
        console.log('✅ Firebase/Firestore removal successful!')
      showNotification('Document removed successfully!', 'success')
        
        // Update localStorage
        try {
          const updatedData = {
            ...patientData,
            activity: {
              ...patientData?.activity,
              documents: patientData?.activity?.documents?.filter(doc => doc.id !== documentId) || []
            },
            updatedAt: new Date().toISOString()
          }
          localStorage.setItem(`patientData_${user.uid}`, JSON.stringify(updatedData))
          console.log('✅ Updated localStorage after document removal')
        } catch (localStorageError) {
          console.warn('⚠️ localStorage update failed:', localStorageError)
        }
        
      } catch (firebaseError: any) {
        console.warn('⚠️ Firebase/Firestore removal failed:', firebaseError)
        console.warn('Firebase error details:', {
          message: firebaseError.message,
          code: firebaseError.code,
          stack: firebaseError.stack
        })
        
        // Revert local state if Firebase removal failed
        setPatientData(prev => {
          if (!prev) return prev
          
          const originalDocuments = patientData?.activity?.documents || []
          
          return {
            ...prev,
            activity: {
              ...prev.activity,
              documents: originalDocuments
            }
          }
        })
        
        showNotification('Failed to remove document from server. Please try again.', 'error')
      } finally {
        // Clear the flag after operation completes
        setIsPerformingDocumentOperation(false)
      }
      
    } catch (error: any) {
      console.error('❌ Error removing document:', error)
      showNotification('Failed to remove document. Please try again.', 'error')
      // Clear the flag on error too
      setIsPerformingDocumentOperation(false)
    }
  }, [user, patientData])

  const handleEditAppointment = useCallback(async () => {
    console.log('🔍 handleEditAppointment called')
    console.log('User:', user)
    console.log('Edit appointment form:', editAppointmentForm)
    console.log('Editing appointment:', editingAppointment)
    
    if (!user || !editingAppointment) {
      console.error('❌ No user or appointment to edit')
      showNotification('Please select an appointment to edit', 'error')
      return
    }
    
    // Enhanced validation
    const requiredFields = {
      facilityId: editAppointmentForm.facilityId,
      date: editAppointmentForm.date,
      time: editAppointmentForm.time,
      type: editAppointmentForm.type
    }
    
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key)
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields)
      showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error')
      return
    }

    // Validate date is not in the past
    const selectedDate = new Date(editAppointmentForm.date + 'T' + editAppointmentForm.time)
    const now = new Date()
    if (selectedDate <= now) {
      showNotification('Please select a future date and time for your appointment', 'error')
      return
    }

    setIsEditingAppointment(true)
    console.log('🔄 Starting appointment update...')
    
    try {
      console.log('📦 Importing firestoredb...')
      const { updateAppointment } = await import('../services/firestoredb.js')
      console.log('✅ updateAppointment imported successfully')
      
      const updatedAppointmentData = {
        facilityId: editAppointmentForm.facilityId,
        facilityName: editAppointmentForm.facilityName,
        patientName: user.displayName || patientData?.personalInfo?.fullName || 'Patient',
        patientEmail: user.email || patientData?.email || '',
        doctor: editAppointmentForm.doctor || 'To Be Determined',
        date: editAppointmentForm.date,
        time: editAppointmentForm.time,
        type: editAppointmentForm.type,
        patientNotes: editAppointmentForm.patientNotes || '', // Notes from the patient when booking
        facilityNotes: editingAppointment.facilityNotes || '', // Preserve existing facility notes
        status: editingAppointment.status || 'scheduled'
      }
      
      console.log('📋 Updated appointment data:', updatedAppointmentData)
      console.log('🔄 Calling updateAppointment...')
      
      const result = await updateAppointment(user.uid, editingAppointment.id, updatedAppointmentData)
      
      console.log('✅ Appointment updated successfully!', result)
      
      // Refresh patient data to show the updated appointment
      try {
        const { getCurrentPatientData } = await import('../services/firestoredb.js')
        const updatedPatientData = await getCurrentPatientData()
        setPatientData(updatedPatientData)
        console.log('✅ Patient data refreshed with updated appointment')
      } catch (refreshError) {
        console.warn('⚠️ Could not refresh patient data:', refreshError)
      }
      
      showNotification('Appointment updated successfully!', 'success')
      closeModal()
      
    } catch (error: any) {
      console.error('❌ Error updating appointment:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      
      let errorMessage = 'Failed to update appointment'
      
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to update appointments. Please contact support.'
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
      } else if (error.message) {
        errorMessage = `Update failed: ${error.message}`
      }
      
      showNotification(errorMessage, 'error')
    } finally {
      setIsEditingAppointment(false)
    }
  }, [user, editAppointmentForm, editingAppointment, patientData, closeModal])

  const handleDeleteAppointment = useCallback(async (appointmentId: string) => {
    console.log('🔍 handleDeleteAppointment called for appointment:', appointmentId)
    
    if (!user) {
      console.error('❌ No user found')
      showNotification('Please sign in to delete appointments', 'error')
      return
    }
    
    // Find the appointment to get its details
    const appointmentToDelete = patientData?.activity?.appointments?.find(apt => apt.id === appointmentId)
    
    if (!appointmentToDelete) {
      console.error('❌ Appointment not found')
      showNotification('Appointment not found', 'error')
      return
    }
    
    // Check if appointment is in the past
    const appointmentDate = new Date(appointmentToDelete.date + 'T' + appointmentToDelete.time)
    const now = new Date()
    if (appointmentDate <= now) {
      showNotification('Cannot delete past appointments', 'error')
      return
    }
    
    // Check if appointment is within 24 hours (some facilities may have policies)
    const timeUntilAppointment = appointmentDate.getTime() - now.getTime()
    const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60)
    
    if (hoursUntilAppointment < 24) {
      const confirmed = window.confirm(
        'This appointment is within 24 hours. Some facilities may have cancellation policies. Are you sure you want to delete this appointment?'
      )
      if (!confirmed) return
    } else {
      const confirmed = window.confirm(
        `Are you sure you want to delete your appointment with ${appointmentToDelete.facilityName || 'the healthcare facility'} on ${appointmentToDelete.date} at ${appointmentToDelete.time}? This action cannot be undone.`
      )
      if (!confirmed) return
    }
    
    try {
      console.log('🔄 Starting appointment deletion...')
      
      // Update local state immediately for better UX
      setPatientData(prev => {
        if (!prev) return prev
        
        const updatedAppointments = prev.activity?.appointments?.filter(apt => apt.id !== appointmentId) || []
        
        return {
          ...prev,
          activity: {
            ...prev.activity,
            appointments: updatedAppointments
          },
          updatedAt: new Date().toISOString()
        }
      })
      
      console.log('✅ Local state updated successfully!')
      
      // Try to delete from Firebase
      try {
        console.log('📦 Attempting Firebase deletion...')
        const { deleteAppointment } = await import('../services/firestoredb.js')
        
        await deleteAppointment(user.uid, appointmentId)
        
        console.log('✅ Firebase deletion successful!')
        showNotification('Appointment deleted successfully!', 'success')
        
        // Update localStorage
        try {
          const updatedData = {
            ...patientData,
            activity: {
              ...patientData?.activity,
              appointments: patientData?.activity?.appointments?.filter(apt => apt.id !== appointmentId) || []
            },
            updatedAt: new Date().toISOString()
          }
          localStorage.setItem(`patientData_${user.uid}`, JSON.stringify(updatedData))
          console.log('✅ Updated localStorage after deletion')
        } catch (localStorageError) {
          console.warn('⚠️ localStorage update failed:', localStorageError)
        }
        
      } catch (firebaseError: any) {
        console.warn('⚠️ Firebase deletion failed:', firebaseError)
        
        // Revert local state if Firebase deletion failed
        setPatientData(prev => {
          if (!prev) return prev
          
          const originalAppointments = patientData?.activity?.appointments || []
          
          return {
            ...prev,
            activity: {
              ...prev.activity,
              appointments: originalAppointments
            }
          }
        })
        
        showNotification('Failed to delete appointment from server. Please try again.', 'error')
      }
      
    } catch (error: any) {
      console.error('❌ Error deleting appointment:', error)
      showNotification('Failed to delete appointment. Please try again.', 'error')
    }
  }, [user, patientData])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-fill document name if not already set
      if (!documentName) {
        setDocumentName(file.name)
      }
    }
  }, [documentName])



  const loadConsultationHistory = useCallback(async () => {
    if (!user) return
    
    setIsLoadingConsultationHistory(true)
    try {
      const { getConsultationHistory } = await import('../services/firestoredb.js')
      const history = await getConsultationHistory(user.uid)
      setConsultationHistory(history)
      console.log('✅ Consultation history loaded successfully')
    } catch (error: any) {
      console.error('❌ Error loading consultation history:', error)
      setConsultationHistory([])
    } finally {
      setIsLoadingConsultationHistory(false)
    }
  }, [user])

  const handleRemoveConsultation = useCallback(async (consultationId: string) => {
    if (!user) return
    
    if (!confirm('Are you sure you want to delete this consultation? This action cannot be undone.')) {
      return
    }
    
    try {
      console.log('🔍 handleRemoveConsultation called for consultation:', consultationId)
      
      // Update local state immediately for better UX
      setConsultationHistory(prev => {
        const updatedConsultations = prev.filter(consultation => consultation.id !== consultationId)
        return updatedConsultations
      })
      
      // Try to remove from Firestore
      try {
        console.log('📦 Attempting Firestore removal...')
        const firestoredb: any = await import('../services/firestoredb.js')
        
        await firestoredb.removePatientConsultation(user.uid, consultationId)
        
        console.log('✅ Firestore removal successful!')
        showNotification('Consultation removed successfully!', 'success')
      } catch (firebaseError: any) {
        console.warn('⚠️ Firestore removal failed:', firebaseError)
        showNotification('Consultation removal failed. Please try again.', 'error')
      }
    } catch (error: any) {
      console.error('❌ Error removing consultation:', error)
      showNotification(`Failed to remove consultation: ${error.message}`, 'error')
    }
  }, [user])











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
    // Use Firebase UID directly as the patient ID
    if (user?.uid) {
      return user.uid
    }
    
    // Fallback to patient data if available
    if (patientData?.uniquePatientId) {
      return patientData.uniquePatientId
    }
    
    return 'Not assigned'
  }, [user?.uid, patientData?.uniquePatientId])

  const getTimeAgo = useCallback((timestamp: string) => {
    return timestamp // For now, return as is. Could implement actual time calculation
  }, [])

  // Helper function to format time for display (convert 24-hour to 12-hour with AM/PM)
  const formatTimeForDisplay = useCallback((time: string) => {
    if (!time || typeof time !== 'string') return time
    
    // Check if it's a time value (HH:MM format)
    if (time.match(/^\d{1,2}:\d{2}$/)) {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minutes} ${ampm}`
    }
    
    return time
  }, [])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal()
        closeSidebar()
      }
      if (event.key === 'm' && event.ctrlKey) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeModal, closeSidebar, toggleSidebar])

  // Auto-save user preferences
  useEffect(() => {
    if (user) {
      localStorage.setItem('patientPortal_preferences', JSON.stringify({
        lastActiveSection: activeSection,
        lastActiveTab: activeTab
      }))
    }
  }, [user, activeSection, activeTab])



  // Load user preferences and local data on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('patientPortal_preferences')
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences)
        setActiveSection(preferences.lastActiveSection ?? 'dashboard')
        setActiveTab(preferences.lastActiveTab ?? 'general')
      } catch (error) {
        console.warn('Failed to load user preferences:', error)
      }
    }
    
    // Load local patient data if available
    try {
      const localPatientData = localStorage.getItem(`patientData_${user?.uid || 'local'}`)
      if (localPatientData) {
        const parsedData = JSON.parse(localPatientData)
        console.log('📦 Loaded local patient data:', parsedData)
        setPatientData(parsedData)
      }
    } catch (error) {
      console.warn('Failed to load local patient data:', error)
    }
  }, [user])

  // Debug modal state
  useEffect(() => {
    console.log('🔍 Modal state changed - showModal:', showModal)
  }, [showModal])

  // Load consultation history when user is available
  useEffect(() => {
    if (user) {
      loadConsultationHistory()
    }
  }, [user, loadConsultationHistory])

  // Initialize edit form when patient data changes
  useEffect(() => {
    if (patientData?.personalInfo) {
      setEditProfileForm({
        firstName: patientData.personalInfo.firstName || '',
        lastName: patientData.personalInfo.lastName || '',
        fullName: patientData.personalInfo.fullName || '',
        dateOfBirth: patientData.personalInfo.dateOfBirth || '',
        age: patientData.personalInfo.age || null,
        gender: patientData.personalInfo.gender || '',
        phone: patientData.personalInfo.phone || '',
        address: patientData.personalInfo.address || '',
        bio: patientData.personalInfo.bio || ''
      })
    }
  }, [patientData])

  // Load facilities from Firestore
  const loadFacilities = useCallback(async () => {
    if (!user) return
    
    setIsLoadingFacilities(true)
    try {
      console.log('🔍 Loading facilities from Firestore...')
      
      // Import the facility service
      const facilityService = await import('../services/facility-service.ts')
      
      // Get all active and searchable facilities
      const allFacilities = await facilityService.default.searchFacilities()
      
      console.log('✅ Loaded facilities:', allFacilities)
      
      // Transform the facilities to match our FacilityData interface
      const transformedFacilities: FacilityData[] = allFacilities.map(facility => {
        console.log('🔍 Processing facility:', facility.name, 'with data:', facility)
        
        const transformed = {
          id: facility.uid,
          uid: facility.uid,
          email: facility.email || '',
          role: 'facility',
          uniqueFacilityId: facility.uid,
          facilityInfo: {
            name: facility.name,
            type: facility.type,
            email: facility.email,
            phone: facility.phone,
            address: facility.address,
            city: facility.city,
            province: facility.province,
            postalCode: facility.postalCode,
            country: facility.country,
            website: facility.website,
            description: facility.description
          },
          operatingHours: facility.operatingHours,
          specialties: facility.specialties || [],
          services: facility.services || [],
          staff: {
            totalStaff: facility.staff.totalStaff,
            doctors: facility.staff.doctors,
            nurses: facility.staff.nurses,
            supportStaff: facility.staff.supportStaff
          },
          capacity: {
            bedCapacity: facility.capacity.bedCapacity,
            consultationRooms: facility.capacity.consultationRooms
          },
          licenseNumber: facility.licenseNumber,
          accreditation: facility.accreditation || [],
          insuranceAccepted: facility.insuranceAccepted || [],
          languages: facility.languages || [],
          isActive: facility.isActive,
          isVerified: facility.isVerified || false,
          profileComplete: facility.profileComplete || false,
          createdAt: facility.createdAt,
          lastLoginAt: facility.lastLoginAt,
          updatedAt: facility.updatedAt,
          emailVerified: facility.emailVerified || false,
          authProvider: facility.authProvider || 'email'
        }
        
        console.log('✅ Transformed facility:', transformed.facilityInfo.name, 'with staff:', transformed.staff, 'and capacity:', transformed.capacity)
        return transformed
      })
      
      setFacilities(transformedFacilities)
      
      if (transformedFacilities.length === 0) {
        console.log('ℹ️ No facilities found - this is normal if no facilities have signed up yet')
      }
    } catch (error) {
      console.error('❌ Error loading facilities:', error)
      // Fallback to empty array if loading fails
      setFacilities([])
    } finally {
      setIsLoadingFacilities(false)
    }
  }, [user])

  // Load facilities when component mounts or user changes
  useEffect(() => {
    if (user && activeSection === 'facilities') {
      loadFacilities()
      
      // DISABLED: Real-time listener for facility updates to prevent console errors
      console.log('🔍 Real-time facility listeners disabled - using periodic refresh only')
      
      // Set up periodic refresh instead of real-time listener
      const refreshInterval = setInterval(() => {
        loadFacilities()
      }, 30000) // Refresh every 30 seconds
      
      // Cleanup function
      return () => {
        clearInterval(refreshInterval)
      }
    }
  }, [user, activeSection, loadFacilities])

  // Filter facilities based on search term and filters
  const filteredFacilities = useMemo(() => {
    return facilities.filter(facility => {
      // Filter by search term
      if (facilitySearchTerm && !facility.facilityInfo.name.toLowerCase().includes(facilitySearchTerm.toLowerCase())) {
        return false
      }
      
      // Filter by facility type
      if (selectedFacilityType && facility.facilityInfo.type !== selectedFacilityType) {
        return false
      }
      
      // Filter by city
      if (selectedFacilityCity && facility.facilityInfo.city !== selectedFacilityCity) {
        return false
      }
      
      // Filter by specialty
      if (selectedFacilitySpecialty && !facility.specialties.includes(selectedFacilitySpecialty)) {
        return false
      }
      
      return true
    })
  }, [facilities, facilitySearchTerm, selectedFacilityType, selectedFacilityCity, selectedFacilitySpecialty])

    if (isLoading || isLoadingPatientData) {
    return (
      <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
        <LoadingOverlay
          isLoading={isLoading}
          isLoadingPatientData={isLoadingPatientData}
        />
      </Suspense>
    )
  }
  
  return (
    <div className="dashboard-layout" role="application" aria-label="Patient Portal Dashboard">
      {/* Quota Status Banner */}
      <QuotaStatusBanner />
      
      {/* Notification System */}
      <Suspense fallback={null}>
        <NotificationSystem showNotification={showNotification} />
      </Suspense>
      
      {/* Sidebar */}
      <Suspense fallback={<div className="loading-spinner">Loading sidebar...</div>}>
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          activeSection={activeSection}
          onNavClick={handleNavClick}
          onLogout={handleLogout}
          sidebarRef={sidebarRef}
        />
      </Suspense>
        

      
      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        ref={sidebarOverlayRef} 
        onClick={closeSidebar}
        aria-hidden="true"
        role="presentation"
      />

      {/* Main Content */}
      <main 
        className="main-content" 
        ref={mainContentRef}
        tabIndex={-1}
        role="main"
        aria-label="Patient portal main content"
      >
        {/* Top Bar */}
        <Suspense fallback={<div className="loading-spinner">Loading top bar...</div>}>
          <TopBar
            onToggleSidebar={toggleSidebar}
            isSidebarOpen={isSidebarOpen}
          />
        </Suspense>
        
        <div className="main-container">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <Suspense fallback={<div className="loading-spinner">Loading dashboard...</div>}>
              <DashboardSection
                patientData={patientData}
                activeAppointmentsTab={activeAppointmentsTab}
                onAppointmentsTabClick={handleAppointmentsTabClick}
                onOpenModal={openModal}
                onEditAppointment={(appointment) => {
                  setEditingAppointment(appointment)
                  setEditAppointmentForm({
                    facilityId: appointment.facilityId || '',
                    facilityName: appointment.facilityName || '',
                    doctor: appointment.doctor || '',
                    date: appointment.date || '',
                    time: appointment.time || '',
                    type: appointment.type || '',
                    patientNotes: appointment.patientNotes || '' // Notes from the patient when booking
                  })
                  openModal('editAppointment')
                }}
                onDeleteAppointment={handleDeleteAppointment}
                onViewUpdates={handleViewAppointmentUpdates}
              />
            </Suspense>
          )}



          {/* Profile Section */}
          {activeSection === 'profile' && (
            <Suspense fallback={<div className="loading-spinner">Loading profile...</div>}>
              <ProfileSection
                patientData={patientData}
                user={user}
                onOpenModal={openModal}
                onRemoveCondition={handleRemoveCondition}
                consultationHistory={consultationHistory}
                onRemoveConsultation={handleRemoveConsultation}
                onDownloadDocument={handleDownloadDocument}
                onRemoveDocument={handleRemoveDocument}
              />
            </Suspense>
          )}





          {/* Facilities Section */}
          {activeSection === 'facilities' && (
            <section className="content-section active">
              <div className="section-header">
                <h1>Healthcare Facilities</h1>
                <p>Find and book appointments with healthcare providers near you</p>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={loadFacilities}
                  disabled={isLoadingFacilities}
                  style={{ marginTop: '10px' }}
                >
                  <i className={`fas ${isLoadingFacilities ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                  {isLoadingFacilities ? ' Refreshing...' : ' Refresh Facilities'}
                </button>
              </div>
              
              <div className="facilities-search">
                <div className="search-filters">
                  <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input 
                      type="text" 
                      placeholder="Search facilities by name..." 
                      value={facilitySearchTerm}
                      onChange={(e) => setFacilitySearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="filter-row">
                    <select 
                      className="filter-select"
                      value={selectedFacilityType}
                      onChange={(e) => setSelectedFacilityType(e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="Hospital">Hospital</option>
                      <option value="Medical Clinic">Medical Clinic</option>
                      <option value="Dental Clinic">Dental Clinic</option>
                      <option value="Specialty Clinic">Specialty Clinic</option>
                      <option value="Diagnostic Center">Diagnostic Center</option>
                      <option value="Rehabilitation Center">Rehabilitation Center</option>
                      <option value="Mental Health Facility">Mental Health Facility</option>
                      <option value="Maternity Clinic">Maternity Clinic</option>
                      <option value="Pediatric Clinic">Pediatric Clinic</option>
                      <option value="Surgical Center">Surgical Center</option>
                      <option value="Urgent Care Center">Urgent Care Center</option>
                    </select>
                    
                    <select 
                      className="filter-select"
                      value={selectedFacilityCity}
                      onChange={(e) => setSelectedFacilityCity(e.target.value)}
                    >
                      <option value="">All Cities</option>
                      <option value="Manila">Manila</option>
                      <option value="Quezon City">Quezon City</option>
                      <option value="Makati">Makati</option>
                      <option value="Taguig">Taguig</option>
                      <option value="Pasig">Pasig</option>
                      <option value="Marikina">Marikina</option>
                      <option value="Caloocan">Caloocan</option>
                      <option value="Malabon">Malabon</option>
                      <option value="Navotas">Navotas</option>
                      <option value="Parañaque">Parañaque</option>
                      <option value="Las Piñas">Las Piñas</option>
                      <option value="Muntinlupa">Muntinlupa</option>
                      <option value="San Juan">San Juan</option>
                      <option value="Mandaluyong">Mandaluyong</option>
                      <option value="Pateros">Pateros</option>
                      <option value="Valenzuela">Valenzuela</option>
                    </select>
                    
                    <select 
                      className="filter-select"
                      value={selectedFacilitySpecialty}
                      onChange={(e) => setSelectedFacilitySpecialty(e.target.value)}
                    >
                      <option value="">All Specialties</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="Internal Medicine">Internal Medicine</option>
                      <option value="Emergency Medicine">Emergency Medicine</option>
                      <option value="Surgery">Surgery</option>
                      <option value="Obstetrics and Gynecology">Obstetrics and Gynecology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Psychiatry">Psychiatry</option>
                      <option value="Ophthalmology">Ophthalmology</option>
                      <option value="ENT">ENT</option>
                      <option value="Urology">Urology</option>
                      <option value="Oncology">Oncology</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="facilities-grid">
                {isLoadingFacilities ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading healthcare facilities...</p>
                  </div>
                ) : filteredFacilities.length > 0 ? (
                  filteredFacilities.map((facility) => (
                    <div key={facility.uid} className="facility-card">
                      <div className="facility-header">
                        <div className="facility-icon">
                          <i className={`fas fa-${facility.facilityInfo.type === 'Hospital' ? 'hospital' : 'stethoscope'}`}></i>
                        </div>
                        <div className="facility-info">
                          <h3>{facility.facilityInfo.name}</h3>
                          <p className="facility-type">{facility.facilityInfo.type}</p>
                          <p className="facility-location">
                            <i className="fas fa-map-marker-alt"></i>
                            {facility.facilityInfo.city && facility.facilityInfo.province 
                              ? `${facility.facilityInfo.city}, ${facility.facilityInfo.province}`
                              : facility.facilityInfo.address || 'Location not available'
                            }
                          </p>
                        </div>
                        <div className="facility-rating">
                          <div className="stars">
                            <i className="fas fa-star"></i>
                            <i className="fas fa-star"></i>
                            <i className="fas fa-star"></i>
                            <i className="fas fa-star"></i>
                            <i className="far fa-star"></i>
                          </div>
                          <span className="rating-text">4.0 (New)</span>
                        </div>
                      </div>
                      
                      <div className="facility-details">
                        {facility.specialties && facility.specialties.length > 0 && (
                          <div className="facility-specialties">
                            <h4>Specialties</h4>
                            <div className="specialty-tags">
                              {facility.specialties.slice(0, 3).map((specialty, index) => (
                                <span key={index} className="specialty-tag">{specialty}</span>
                              ))}
                              {facility.specialties.length > 3 && (
                                <span className="specialty-tag">+{facility.specialties.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {facility.services && facility.services.length > 0 && (
                          <div className="facility-services">
                            <h4>Services</h4>
                            <div className="service-tags">
                              {facility.services.slice(0, 3).map((service, index) => (
                                <span key={index} className="service-tag">{service}</span>
                              ))}
                              {facility.services.length > 3 && (
                                <span className="service-tag">+{facility.services.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="facility-hours">
                          <h4>Operating Hours</h4>
                          {facility.operatingHours && (
                            <>
                              <p>Monday - Friday: {facility.operatingHours.monday.open} - {facility.operatingHours.monday.close}</p>
                              <p>Saturday: {facility.operatingHours.saturday.open} - {facility.operatingHours.saturday.close}</p>
                              <p>Sunday: {facility.operatingHours.sunday.closed ? 'Closed' : `${facility.operatingHours.sunday.open} - ${facility.operatingHours.sunday.close}`}</p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="facility-actions">
                        <button 
                          className="btn btn-outline" 
                          onClick={() => {
                            setSelectedFacility(facility)
                            openModal('viewFacility')
                          }}
                        >
                          <i className="fas fa-info-circle"></i>
                          View Details
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => {
                            setSelectedFacility(facility)
                            setAppointmentForm(prev => ({
                              ...prev,
                              facilityId: facility.uid,
                              facilityName: facility.facilityInfo.name
                            }))
                            openModal('bookAppointment')
                          }}
                        >
                          <i className="fas fa-calendar-plus"></i>
                          Book Appointment
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <i className="fas fa-hospital"></i>
                    </div>
                    <h3>No Facilities Available</h3>
                    <p>There are currently no healthcare facilities registered in the system.</p>
                    <p>This is normal if no facilities have signed up yet. Facilities will appear here once they register.</p>
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#4a5568' }}> {/* Darker gray for WCAG AA compliance */}
                        <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }}></i>
                        <strong>For Healthcare Facilities:</strong> Sign up through the Partner Registration to appear in this list.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Help Section */}
          {activeSection === 'help' && (
            <section className="content-section active">
              <div className="section-header">
                <h1>Help & Support</h1>
              </div>
              
              <div className="help-search">
                <div className="search-box">
                  <i className="fas fa-search" aria-hidden="true"></i>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Search for help articles..." 
                    aria-label="Search help articles"
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>
              </div>
              
              <div className="help-categories">
                <h3>Help Categories</h3>
                <div className="category-grid">
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <h4>Appointments</h4>
                    <p>Book, reschedule, or cancel appointments</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-file-medical"></i>
                    </div>
                    <h4>Medical Records</h4>
                    <p>Access and manage your medical documents</p>
                  </div>
                  
                  <div className="help-category">
                    <div className="category-icon">
                      <i className="fas fa-video"></i>
                    </div>
                    <h4>Virtual Consultations</h4>
                    <p>Join video calls and online consultations</p>
                  </div>
                  

                </div>
              </div>

              <div className="faq-section">
                <h3>Frequently Asked Questions</h3>
                <div className="faq-list">
                  <div className="faq-item">
                    <button className="faq-question" aria-label="How do I book an appointment? Click to expand answer">
                      <span>How do I book an appointment?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>You can book an appointment by clicking the "Book Appointment" button in the Quick Actions section on the Dashboard. Choose your preferred doctor, date, and time, then submit your request.</p>
                    </div>
                  </div>
                  
                  <div className="faq-item">
                    <button className="faq-question" aria-label="How do I join a virtual consultation? Click to expand answer">
                      <span>How do I join a virtual consultation?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>When it's time for your virtual consultation, go to your Dashboard and click the "Join Call" button next to your appointment.</p>
                    </div>
                  </div>
                  
                  <div className="faq-item">
                    <button className="faq-question" aria-label="Can I reschedule or cancel my appointment? Click to expand answer">
                      <span>Can I reschedule or cancel my appointment?</span>
                      <i className="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div className="faq-answer">
                      <p>Yes, you can reschedule or cancel appointments up to 24 hours before the scheduled time. Go to your appointments and click the "Reschedule" button.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Modals */}
      

      
      {/* Edit Profile Modal */}
      {showModal === 'editProfile' && (
        <div className="modal" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="modal-content" style={{ position: 'relative', backgroundColor: 'white', margin: '5% auto', padding: '20px', border: '1px solid #888', width: '90%', maxWidth: '600px', borderRadius: '8px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Edit Profile Information</h3>
              <button className="close-btn" onClick={closeModal} aria-label="Close edit profile modal">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form id="editProfileForm" onSubmit={(e) => { 
                e.preventDefault(); 
                console.log('Form submitted, calling handleSaveProfile...');
                handleSaveProfile(); 
              }}>
                <div className="form-group">
                  <label htmlFor="editFirstName">First Name *</label>
                  <input 
                    type="text" 
                    id="editFirstName" 
                    required
                    value={editProfileForm.firstName}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editLastName">Last Name *</label>
                  <input 
                    type="text" 
                    id="editLastName" 
                    required
                    value={editProfileForm.lastName}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editFullName">Full Name *</label>
                  <input 
                    type="text" 
                    id="editFullName" 
                    required
                    value={editProfileForm.fullName}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editDateOfBirth">Date of Birth</label>
                  <input 
                    type="date" 
                    id="editDateOfBirth" 
                    max={new Date().toISOString().split('T')[0]}
                    value={editProfileForm.dateOfBirth}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editGender">Gender</label>
                  <select 
                    id="editGender" 
                    value={editProfileForm.gender}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="editPhoneNumber">Phone Number</label>
                  <input 
                    type="tel" 
                    id="editPhoneNumber" 
                    pattern="[0-9+\-\s\(\)]+"
                    placeholder="+63 912 345 6789"
                    value={editProfileForm.phone}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editAddress">Address</label>
                  <textarea 
                    id="editAddress" 
                    rows={2}
                    placeholder="Enter your complete address"
                    value={editProfileForm.address}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, address: e.target.value }))}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label htmlFor="editBio">Bio</label>
                  <textarea 
                    id="editBio" 
                    rows={3}
                    placeholder="Tell us about yourself..."
                    value={editProfileForm.bio}
                    onChange={(e) => setEditProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                  ></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal} aria-label="Cancel editing profile">Cancel</button>
              <button 
                className="btn-primary" 
                type="submit"
                form="editProfileForm"
                disabled={isSavingProfile || !editProfileForm.firstName || !editProfileForm.lastName || !editProfileForm.fullName}
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      {showModal === 'bookAppointment' && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90vw' }}>
            <div className="modal-header">
              <h3>Book Appointment</h3>
              <button className="close-btn" onClick={closeModal} aria-label="Close book appointment modal">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleBookAppointment(); }}>
                {/* Patient Selection Section */}
                <div className="form-section">
                  <h4><i className="fas fa-user"></i> Patient Information</h4>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={appointmentForm.isBookingForOther}
                        onChange={(e) => setAppointmentForm(prev => ({ 
                          ...prev, 
                          isBookingForOther: e.target.checked 
                        }))}
                      />
                      Book appointment for someone else (family member, dependent, etc.)
                    </label>
                  </div>

                  {appointmentForm.isBookingForOther && (
                    <div className="patient-for-appointment-fields">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="patientName">Patient Name *</label>
                          <input 
                            type="text" 
                            id="patientName"
                            required={appointmentForm.isBookingForOther}
                            placeholder="Enter patient's full name"
                            value={appointmentForm.patientForAppointment.name}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                name: e.target.value
                              }
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="relationship">Relationship *</label>
                          <select 
                            id="relationship"
                            required={appointmentForm.isBookingForOther}
                            value={appointmentForm.patientForAppointment.relationship}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                relationship: e.target.value
                              }
                            }))}
                          >
                            <option value="">Select relationship</option>
                            <option value="son">Son</option>
                            <option value="daughter">Daughter</option>
                            <option value="spouse">Spouse</option>
                            <option value="parent">Parent</option>
                            <option value="sibling">Sibling</option>
                            <option value="grandchild">Grandchild</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="patientAge">Age</label>
                          <input 
                            type="number" 
                            id="patientAge"
                            min="0"
                            max="120"
                            placeholder="Enter age"
                            value={appointmentForm.patientForAppointment.age}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                age: e.target.value
                              }
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="patientGender">Gender</label>
                          <select 
                            id="patientGender"
                            value={appointmentForm.patientForAppointment.gender}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                gender: e.target.value
                              }
                            }))}
                          >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="patientPhone">Patient Phone (Optional)</label>
                          <input 
                            type="tel" 
                            id="patientPhone"
                            pattern="[0-9+\-\s\(\)]+"
                            placeholder="+63 912 345 6789"
                            value={appointmentForm.patientForAppointment.phone}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                phone: e.target.value
                              }
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="patientEmail">Patient Email (Optional)</label>
                          <input 
                            type="email" 
                            id="patientEmail"
                            placeholder="patient@email.com"
                            value={appointmentForm.patientForAppointment.email}
                            onChange={(e) => setAppointmentForm(prev => ({
                              ...prev,
                              patientForAppointment: {
                                ...prev.patientForAppointment,
                                email: e.target.value
                              }
                            }))}
                          />
                        </div>
                      </div>

                      <div className="alert alert-info">
                        <i className="fas fa-info-circle"></i>
                        <strong>Note:</strong> You are booking this appointment for {appointmentForm.patientForAppointment.name || 'this person'}. 
                        The healthcare facility will contact them directly using their phone/email for any updates or changes. 
                        However, all appointment changes will still be reflected in your patient portal since you made the booking.
                      </div>
                    </div>
                  )}

                  {!appointmentForm.isBookingForOther && (
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle"></i>
                      <strong>Booking for yourself:</strong> This appointment will be booked under your account name: 
                      <strong> {user?.displayName || patientData?.personalInfo?.fullName || 'Patient'}</strong>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="appointmentFacility">Healthcare Facility *</label>
                  <select 
                    id="appointmentFacility" 
                    required
                    value={appointmentForm.facilityId}
                    onChange={(e) => {
                      const facilityId = e.target.value
                      const facilityName = e.target.options[e.target.selectedIndex].text
                      console.log('Selected facility:', { facilityId, facilityName })
                      setAppointmentForm(prev => ({
                        ...prev,
                        facilityId,
                        facilityName
                      }))
                    }}
                  >
                    <option value="">Select Facility</option>
                    {isLoadingFacilities ? (
                      <option value="" disabled>Loading facilities...</option>
                    ) : facilities.length > 0 ? (
                      facilities.map(facility => (
                        <option key={facility.uid} value={facility.uid}>
                          {facility.facilityInfo.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No facilities available</option>
                    )}
                  </select>
                  {!isLoadingFacilities && facilities.length === 0 && (
                    <small style={{ color: '#dc2626', fontSize: '12px' }}> {/* Darker red for WCAG AA compliance */}
                      No facilities available. Please check back later.
                    </small>
                  )}
                  {isLoadingFacilities && (
                    <small style={{ color: '#4a5568', fontSize: '12px' }}> {/* Darker gray for WCAG AA compliance */}
                      <i className="fas fa-spinner fa-spin"></i> Loading healthcare facilities...
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="appointmentType">Appointment Type *</label>
                  <select 
                    id="appointmentType" 
                    required
                    value={appointmentForm.type}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="">Select Type</option>
                    <option value="checkup">Regular Checkup</option>
                    <option value="consultation">Consultation</option>
                    <option value="therapy">Therapy Session</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="appointmentDoctor">Doctor (Optional)</label>
                  <input 
                    type="text" 
                    id="appointmentDoctor"
                    placeholder="Enter doctor name or leave blank"
                    value={appointmentForm.doctor}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, doctor: e.target.value }))}
                  />
                </div>
                                  <div className="form-group">
                    <label htmlFor="appointmentDate">Date *</label>
                    <input 
                      type="date" 
                      id="appointmentDate" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={appointmentForm.date}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <small style={{ color: '#4a5568', fontSize: '12px' }}> {/* Darker gray for WCAG AA compliance */}
                      Select a future date
                    </small>
                  </div>
                                  <div className="form-group">
                    <label htmlFor="appointmentTime">Time *</label>
                    <input 
                      type="time" 
                      id="appointmentTime" 
                      required
                      value={appointmentForm.time}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, time: e.target.value }))}
                    />
                    <small style={{ color: '#4a5568', fontSize: '12px' }}> {/* Darker gray for WCAG AA compliance */}
                      Select appointment time
                    </small>
                  </div>
                <div className="form-group">
                  <label htmlFor="appointmentNotes">Patient Notes</label>
                  <textarea 
                    id="appointmentNotes" 
                    rows={3}
                    placeholder="Any additional information about your appointment..."
                    value={appointmentForm.patientNotes}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, patientNotes: e.target.value }))}
                  ></textarea>
                  <small style={{ color: '#4a5568', fontSize: '12px' }}>
                    These notes are for your reference and will be shared with the healthcare facility.
                  </small>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={(e) => {
                  e.preventDefault()
                  console.log('🔘 Book Appointment button clicked!')
                  handleBookAppointment()
                }}
                disabled={isBookingAppointment}
              >
                {isBookingAppointment ? 'Booking...' : 'Book Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Consultation Modal */}
      {showModal === 'videoConsultation' && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Video Consultation</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="video-setup">
                <div className="video-preview">
                  <i className="fas fa-video"></i>
                  <p>Camera Preview</p>
                </div>
                <div className="form-group">
                  <label htmlFor="audioInput">Microphone</label>
                  <select id="audioInput">
                    <option value="default">Default Microphone</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="videoInput">Camera</label>
                  <select id="videoInput">
                    <option value="default">Default Camera</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn-primary">Join Consultation</button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Refill Modal */}
      {showModal === 'prescriptionRefill' && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Refill Prescription</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form>
                <div className="form-group">
                  <label htmlFor="prescriptionSelect">Select Prescription</label>
                  <select id="prescriptionSelect" required>
                    <option value="">Choose Prescription</option>
                    <option value="med1">Medication 1 - 50mg</option>
                    <option value="med2">Medication 2 - 25mg</option>
                    <option value="med3">Medication 3 - 100mg</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="refillQuantity">Quantity</label>
                  <input type="number" id="refillQuantity" min="1" required />
                </div>
                <div className="form-group">
                  <label htmlFor="deliveryAddress">Delivery Address</label>
                  <textarea id="deliveryAddress" rows={3} required></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn-primary">Request Refill</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Medical Condition Modal */}
      {showModal === 'addCondition' && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Medical Condition</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form id="addConditionForm" onSubmit={(e) => { 
                e.preventDefault(); 
                console.log('Add condition form submitted, calling handleAddCondition...');
                handleAddCondition(); 
              }}>
                <div className="form-group">
                  <label htmlFor="conditionCategory">Category *</label>
                  <select 
                    id="conditionCategory" 
                    required
                    value={addConditionForm.category}
                    onChange={(e) => setAddConditionForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="">Select Category</option>
                    {conditionCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="conditionName">Condition Name *</label>
                  <input 
                    type="text" 
                    id="conditionName" 
                    required
                    placeholder="Enter condition name (e.g., Diabetes, Hypertension)"
                    value={addConditionForm.condition}
                    onChange={(e) => setAddConditionForm(prev => ({ ...prev, condition: e.target.value }))}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className="btn-primary" 
                type="submit"
                form="addConditionForm"
                disabled={isAddingCondition || !addConditionForm.category || !addConditionForm.condition}
              >
                {isAddingCondition ? 'Adding...' : 'Add Condition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Consultation History Modal */}
      {showModal === 'addConsultationHistory' && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Consultation History</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form id="addConsultationHistoryForm" onSubmit={(e) => { 
                e.preventDefault(); 
                console.log('Add consultation history form submitted, calling handleAddConsultationHistory...');
                handleAddConsultationHistory(); 
              }}>
                <div className="form-group">
                  <label htmlFor="consultationDate">Date *</label>
                  <input 
                    type="date" 
                    id="consultationDate" 
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={consultationHistoryForm.date}
                    onChange={(e) => setConsultationHistoryForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="consultationDoctor">Doctor Name *</label>
                  <input 
                    type="text" 
                    id="consultationDoctor" 
                    required
                    placeholder="Enter doctor's name"
                    value={consultationHistoryForm.doctor}
                    onChange={(e) => setConsultationHistoryForm(prev => ({ ...prev, doctor: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="consultationType">Consultation Type *</label>
                  <select 
                    id="consultationType" 
                    required
                    value={consultationHistoryForm.type}
                    onChange={(e) => setConsultationHistoryForm(prev => ({ ...prev, type: e.target.value as 'virtual' | 'in-person' }))}
                  >
                    <option value="virtual">Virtual</option>
                    <option value="in-person">In-Person</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="consultationStatus">Status *</label>
                  <select 
                    id="consultationStatus" 
                    required
                    value={consultationHistoryForm.status}
                    onChange={(e) => setConsultationHistoryForm(prev => ({ ...prev, status: e.target.value as 'completed' | 'cancelled' | 'no-show' }))}
                  >
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No Show</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="consultationNotes">Notes</label>
                  <textarea 
                    id="consultationNotes" 
                    rows={3}
                    placeholder="Enter any notes about the consultation..."
                    value={consultationHistoryForm.notes}
                    onChange={(e) => setConsultationHistoryForm(prev => ({ ...prev, notes: e.target.value }))}
                  ></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className="btn-primary" 
                type="submit"
                form="addConsultationHistoryForm"
                disabled={isAddingConsultation || !consultationHistoryForm.date || !consultationHistoryForm.doctor}
              >
                {isAddingConsultation ? 'Adding...' : 'Add Consultation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showModal === 'uploadDocument' && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Upload Medical Document</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form id="uploadDocumentForm" onSubmit={(e) => { 
                e.preventDefault(); 
                handleUploadDocument(); 
              }}>
                <div className="form-group">
                  <label htmlFor="documentName">Document Name (Optional)</label>
                  <input 
                    type="text" 
                    id="documentName"
                    placeholder="Enter a custom name for the document"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                  />
                  <small>Leave blank to use the original filename</small>
                </div>
                <div className="form-group">
                  <label htmlFor="documentFile">Select File *</label>
                  <input 
                    type="file" 
                    id="documentFile"
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.txt"
                    onChange={handleFileSelect}
                    required
                  />
                  <small>
                    Supported formats: JPEG, PNG, GIF, PDF, TXT (Max size: 10MB)
                  </small>
                </div>
                {selectedFile && (
                  <div className="file-info">
                    <p><strong>Selected File:</strong> {selectedFile.name}</p>
                    <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><strong>Type:</strong> {selectedFile.type}</p>
                  </div>
                )}
                {isUploadingDocument && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p>Uploading document... {uploadProgress}%</p>
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className="btn-primary" 
                type="submit"
                form="uploadDocumentForm"
                disabled={isUploadingDocument || !selectedFile}
              >
                {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showModal === 'viewDocument' && viewingDocument && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content document-viewer-modal">
            <div className="modal-header">
              <h3>View Document: {viewingDocument.name}</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body document-viewer-body">
              <div className="document-info">
                <p><strong>File Name:</strong> {viewingDocument.originalName}</p>
                <p><strong>Size:</strong> {(viewingDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Type:</strong> {viewingDocument.type}</p>
                <p><strong>Upload Date:</strong> {formatDate(viewingDocument.uploadDate)}</p>
              </div>
              
              <div className="document-content">
                {viewingDocument.type.startsWith('image/') ? (
                  <div className="image-viewer">
                    <img 
                      src={viewingDocument.url} 
                      alt={viewingDocument.name}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '70vh', 
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: '8px'
                      }}
                    />
                  </div>
                ) : viewingDocument.type === 'application/pdf' ? (
                  <div className="pdf-viewer">
                    <div className="pdf-preview">
                      <i className="fas fa-file-pdf" style={{ fontSize: '4rem', color: '#e74c3c', marginBottom: '1rem' }}></i>
                      <h4>{viewingDocument.name}</h4>
                      <p>PDF documents cannot be previewed directly in the browser for security reasons.</p>
                      <div className="pdf-actions">
                        <button 
                          onClick={() => handleOpenDocument(viewingDocument)}
                          className="btn btn-primary"
                          style={{ marginRight: '1rem' }}
                        >
                          <i className="fas fa-external-link-alt"></i>
                          Open in New Tab
                        </button>
                        <a 
                          href={viewingDocument.url} 
                          download={viewingDocument.originalName}
                          className="btn btn-outline"
                        >
                          <i className="fas fa-download"></i>
                          Download PDF
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-viewer">
                    <div className="unsupported-format">
                      <i className="fas fa-file-alt"></i>
                      <h4>Document Preview Not Available</h4>
                      <p>This file type cannot be previewed in the browser.</p>
                      <a 
                        href={viewingDocument.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        download={viewingDocument.originalName}
                      >
                        <i className="fas fa-download"></i>
                        Download Document
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {showModal === 'editAppointment' && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Appointment</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form id="editAppointmentForm" onSubmit={(e) => { 
                e.preventDefault(); 
                console.log('Edit appointment form submitted, calling handleEditAppointment...');
                handleEditAppointment(); 
              }}>
                <div className="form-group">
                  <label htmlFor="editAppointmentFacility">Healthcare Facility *</label>
                  <select 
                    id="editAppointmentFacility" 
                    required
                    value={editAppointmentForm.facilityId}
                    onChange={(e) => {
                      const facilityId = e.target.value
                      const facilityName = e.target.options[e.target.selectedIndex].text
                      console.log('Selected facility for edit:', { facilityId, facilityName })
                      setEditAppointmentForm(prev => ({
                        ...prev,
                        facilityId,
                        facilityName
                      }))
                    }}
                  >
                    <option value="">Select Facility</option>
                    {facilities.map(facility => (
                      <option key={facility.uid} value={facility.uid}>
                        {facility.facilityInfo.name}
                      </option>
                    ))}
                  </select>
                  {facilities.length === 0 && (
                    <small style={{ color: '#dc3545', fontSize: '12px' }}>
                      No facilities available. Please check back later.
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="editAppointmentType">Appointment Type *</label>
                  <select 
                    id="editAppointmentType" 
                    required
                    value={editAppointmentForm.type}
                    onChange={(e) => setEditAppointmentForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="">Select Type</option>
                    <option value="checkup">Regular Checkup</option>
                    <option value="consultation">Consultation</option>
                    <option value="therapy">Therapy Session</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="editAppointmentDoctor">Doctor (Optional)</label>
                  <input 
                    type="text" 
                    id="editAppointmentDoctor"
                    placeholder="Enter doctor name or leave blank"
                    value={editAppointmentForm.doctor}
                    onChange={(e) => setEditAppointmentForm(prev => ({ ...prev, doctor: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editAppointmentDate">Date *</label>
                  <input 
                    type="date" 
                    id="editAppointmentDate" 
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={editAppointmentForm.date}
                    onChange={(e) => setEditAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Select a future date
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="editAppointmentTime">Time *</label>
                  <input 
                    type="time" 
                    id="editAppointmentTime" 
                    required
                    value={editAppointmentForm.time}
                    onChange={(e) => setEditAppointmentForm(prev => ({ ...prev, time: e.target.value }))}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Select appointment time
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="editAppointmentNotes">Patient Notes</label>
                  <textarea 
                    id="editAppointmentNotes" 
                    rows={3}
                    placeholder="Any additional information about your appointment..."
                    value={editAppointmentForm.patientNotes}
                    onChange={(e) => setEditAppointmentForm(prev => ({ ...prev, patientNotes: e.target.value }))}
                  ></textarea>
                  <small style={{ color: '#4a5568', fontSize: '12px' }}>
                    These notes are for your reference and will be shared with the healthcare facility.
                  </small>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={(e) => {
                  e.preventDefault()
                  console.log('🔘 Edit Appointment button clicked!')
                  handleEditAppointment()
                }}
                disabled={isEditingAppointment}
              >
                {isEditingAppointment ? 'Updating...' : 'Update Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Facility Details Modal */}
      {showModal === 'viewFacility' && selectedFacility && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content facility-details-modal">
            <div className="modal-header">
              <h3>Facility Details: {selectedFacility.facilityInfo.name}</h3>
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="facility-details-content">
                {/* Basic Information */}
                <div className="facility-section">
                  <h4><i className="fas fa-info-circle"></i> Basic Information</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Facility Type:</label>
                      <span>{selectedFacility.facilityInfo.type}</span>
                    </div>
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{selectedFacility.facilityInfo.email}</span>
                    </div>
                    <div className="info-item">
                      <label>Phone:</label>
                      <span>{selectedFacility.facilityInfo.phone}</span>
                    </div>
                    <div className="info-item">
                      <label>Website:</label>
                      <span>
                        {selectedFacility.facilityInfo.website ? (
                          <a href={selectedFacility.facilityInfo.website} target="_blank" rel="noopener noreferrer">
                            {selectedFacility.facilityInfo.website}
                          </a>
                        ) : 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="facility-section">
                  <h4><i className="fas fa-map-marker-alt"></i> Address</h4>
                  <p>{selectedFacility.facilityInfo.address}</p>
                  <p>{selectedFacility.facilityInfo.city}, {selectedFacility.facilityInfo.province} {selectedFacility.facilityInfo.postalCode}</p>
                  <p>{selectedFacility.facilityInfo.country}</p>
                </div>

                {/* Description */}
                {selectedFacility.facilityInfo.description && (
                  <div className="facility-section">
                    <h4><i className="fas fa-align-left"></i> Description</h4>
                    <p>{selectedFacility.facilityInfo.description}</p>
                  </div>
                )}

                {/* Specialties */}
                {selectedFacility.specialties && selectedFacility.specialties.length > 0 && (
                  <div className="facility-section">
                    <h4><i className="fas fa-stethoscope"></i> Specialties</h4>
                    <div className="tags-container">
                      {selectedFacility.specialties.map((specialty, index) => (
                        <span key={index} className="tag specialty-tag">{specialty}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services */}
                {selectedFacility.services && selectedFacility.services.length > 0 && (
                  <div className="facility-section">
                    <h4><i className="fas fa-medical-kit"></i> Services</h4>
                    <div className="tags-container">
                      {selectedFacility.services.map((service, index) => (
                        <span key={index} className="tag service-tag">{service}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operating Hours */}
                <div className="facility-section">
                  <h4><i className="fas fa-clock"></i> Operating Hours</h4>
                  <div className="hours-grid">
                    <div className="hour-item">
                      <span className="day">Monday - Friday:</span>
                      <span className="time">
                        {selectedFacility.operatingHours.monday.closed ? 'Closed' : 
                         `${selectedFacility.operatingHours.monday.open} - ${selectedFacility.operatingHours.monday.close}`}
                      </span>
                    </div>
                    <div className="hour-item">
                      <span className="day">Saturday:</span>
                      <span className="time">
                        {selectedFacility.operatingHours.saturday.closed ? 'Closed' : 
                         `${selectedFacility.operatingHours.saturday.open} - ${selectedFacility.operatingHours.saturday.close}`}
                      </span>
                    </div>
                    <div className="hour-item">
                      <span className="day">Sunday:</span>
                      <span className="time">
                        {selectedFacility.operatingHours.sunday.closed ? 'Closed' : 
                         `${selectedFacility.operatingHours.sunday.open} - ${selectedFacility.operatingHours.sunday.close}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Staff Information */}
                <div className="facility-section">
                  <h4><i className="fas fa-users"></i> Staff Information</h4>
                  <div className="staff-grid">
                    <div className="staff-item">
                      <span className="staff-type">Total Staff:</span>
                      <span className="staff-count">{selectedFacility.staff.totalStaff}</span>
                    </div>
                    <div className="staff-item">
                      <span className="staff-type">Doctors:</span>
                      <span className="staff-count">{selectedFacility.staff.doctors}</span>
                    </div>
                    <div className="staff-item">
                      <span className="staff-type">Nurses:</span>
                      <span className="staff-count">{selectedFacility.staff.nurses}</span>
                    </div>
                    <div className="staff-item">
                      <span className="staff-type">Support Staff:</span>
                      <span className="staff-count">{selectedFacility.staff.supportStaff}</span>
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                <div className="facility-section">
                  <h4><i className="fas fa-bed"></i> Capacity</h4>
                  <div className="capacity-grid">
                    <div className="capacity-item">
                      <span className="capacity-type">Bed Capacity:</span>
                      <span className="capacity-count">{selectedFacility.capacity.bedCapacity}</span>
                    </div>
                    <div className="capacity-item">
                      <span className="capacity-type">Consultation Rooms:</span>
                      <span className="capacity-count">{selectedFacility.capacity.consultationRooms}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="facility-section">
                  <h4><i className="fas fa-certificate"></i> Additional Information</h4>
                  <div className="additional-info">
                    <div className="info-item">
                      <label>License Number:</label>
                      <span>{selectedFacility.licenseNumber || 'Not provided'}</span>
                    </div>
                    
                    {selectedFacility.accreditation && selectedFacility.accreditation.length > 0 && (
                      <div className="info-item">
                        <label>Accreditations:</label>
                        <div className="tags-container">
                          {selectedFacility.accreditation.map((acc, index) => (
                            <span key={index} className="tag accreditation-tag">{acc}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedFacility.insuranceAccepted && selectedFacility.insuranceAccepted.length > 0 && (
                      <div className="info-item">
                        <label>Insurance Accepted:</label>
                        <div className="tags-container">
                          {selectedFacility.insuranceAccepted.map((insurance, index) => (
                            <span key={index} className="tag insurance-tag">{insurance}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedFacility.languages && selectedFacility.languages.length > 0 && (
                      <div className="info-item">
                        <label>Languages:</label>
                        <div className="tags-container">
                          {selectedFacility.languages.map((language, index) => (
                            <span key={index} className="tag language-tag">{language}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setAppointmentForm(prev => ({
                    ...prev,
                    facilityId: selectedFacility.uid,
                    facilityName: selectedFacility.facilityInfo.name
                  }))
                  closeModal()
                  openModal('bookAppointment')
                }}
              >
                <i className="fas fa-calendar-plus"></i>
                Book Appointment
              </button>
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

             {/* View Appointment Updates Modal */}
       {showModal === 'viewAppointmentUpdates' && viewingAppointmentUpdates && (
         <div className="modal" style={{ display: 'block' }}>
           <div className="modal-content appointment-updates-modal">
             <div className="modal-header">
               <h3>Appointment Updates & Notes</h3>
               <button className="close-btn" onClick={closeModal}>
                 <i className="fas fa-times"></i>
               </button>
             </div>
             <div className="modal-body">
               <div className="appointment-updates-content">
                 {/* Basic Appointment Info */}
                 <div className="appointment-info-section">
                   <h4><i className="fas fa-calendar-alt"></i> Appointment Details</h4>
                   <div className="info-grid">
                     <div className="info-item">
                       <label>Date:</label>
                       <span>{new Date(viewingAppointmentUpdates.date).toLocaleDateString()}</span>
                     </div>
                     <div className="info-item">
                       <label>Time:</label>
                       <span>{viewingAppointmentUpdates.time}</span>
                     </div>
                     <div className="info-item">
                       <label>Doctor:</label>
                       <span>{viewingAppointmentUpdates.doctor || 'To Be Determined'}</span>
                     </div>
                     <div className="info-item">
                       <label>Type:</label>
                       <span>{viewingAppointmentUpdates.type}</span>
                     </div>
                     <div className="info-item">
                       <label>Status:</label>
                       <span className={`status-badge ${viewingAppointmentUpdates.status}`}>
                         {viewingAppointmentUpdates.status}
                       </span>
                     </div>
                     <div className="info-item">
                       <label>Facility:</label>
                       <span>{viewingAppointmentUpdates.facilityName}</span>
                     </div>
                   </div>
                 </div>

                 {/* Patient Notes */}
                 {viewingAppointmentUpdates.patientNotes && (
                   <div className="notes-section">
                     <h4><i className="fas fa-user"></i> Your Notes</h4>
                     <div className="notes-content">
                       <p>{viewingAppointmentUpdates.patientNotes}</p>
                       <small className="notes-timestamp">
                         Added when booking appointment
                       </small>
                     </div>
                   </div>
                 )}

                 {/* Facility Notes */}
                 {viewingAppointmentUpdates.facilityNotes && (
                   <div className="notes-section">
                     <h4><i className="fas fa-stethoscope"></i> Facility Notes</h4>
                     <div className="notes-content">
                       <p>{viewingAppointmentUpdates.facilityNotes}</p>
                       <small className="notes-timestamp">
                         Added by healthcare facility staff
                       </small>
                     </div>
                   </div>
                 )}

                 {/* Modification History */}
                 {viewingAppointmentUpdates.modificationHistory && viewingAppointmentUpdates.modificationHistory.length > 0 && (
                   <div className="modification-history-section">
                     <h4><i className="fas fa-history"></i> Update History</h4>
                     <div className="modification-timeline">
                       {viewingAppointmentUpdates.modificationHistory.map((modification: any, index: number) => {
                         // Skip initial creation entries
                         if (!modification.changes) return null
                         
                         const allChangesUndefined = Object.values(modification.changes).every((change: any) => {
                           return !change || change.to === undefined || change.to === null
                         })
                         
                         if (allChangesUndefined) return null
                         
                         const meaningfulChanges = Object.entries(modification.changes).filter(([field, change]: [string, any]) => {
                           return change && 
                                  change.to !== undefined && 
                                  change.from !== change.to &&
                                  change.to !== null
                         })
                         
                         if (meaningfulChanges.length === 0) return null
                         
                         return (
                           <div key={index} className="modification-entry">
                             <div className="modification-header">
                               <span className="modification-time">
                                 {new Date(modification.timestamp).toLocaleString()}
                               </span>
                               <span className="modification-author">
                                 Modified by {viewingAppointmentUpdates.facilityName || 'Healthcare Facility'}
                               </span>
                             </div>
                             <div className="changes-list">
                               {meaningfulChanges.map(([field, change]: [string, any]) => (
                                 <div key={field} className="change-item">
                                   <span className="change-field">{field.charAt(0).toUpperCase() + field.slice(1)}:</span>
                                   <span className="change-from">{formatTimeForDisplay(change.from) || '—'}</span>
                                   <i className="fas fa-arrow-right"></i>
                                   <span className="change-to">{formatTimeForDisplay(change.to)}</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )
                       })}
                     </div>
                   </div>
                 )}

                 {/* No Updates Message */}
                 {(!viewingAppointmentUpdates.facilityNotes && 
                   (!viewingAppointmentUpdates.modificationHistory || 
                    viewingAppointmentUpdates.modificationHistory.length === 0)) && (
                   <div className="no-updates-message">
                     <i className="fas fa-info-circle"></i>
                     <p>No updates or notes have been added to this appointment yet.</p>
                   </div>
                 )}
               </div>
             </div>
             <div className="modal-footer">
               <button className="btn-secondary" onClick={closeModal}>Close</button>
             </div>
           </div>
         </div>
       )}

       {/* Download Records Modal */}
       {showModal === 'downloadRecords' && (
         <div className="modal">
           <div className="modal-content">
             <div className="modal-header">
               <h3>Download Medical Records</h3>
               <button className="close-btn" onClick={closeModal}>
                 <i className="fas fa-times"></i>
               </button>
             </div>
             <div className="modal-body">
               <div className="records-list">
                 <div className="record-item">
                   <input type="checkbox" id="record1" />
                   <label htmlFor="record1">Lab Results - March 2024</label>
                 </div>
                 <div className="record-item">
                   <input type="checkbox" id="record2" />
                   <label htmlFor="record2">Prescription History</label>
                 </div>
                 <div className="record-item">
                   <input type="checkbox" id="record3" />
                   <label htmlFor="record3">Medical Reports</label>
                 </div>
               </div>
               <div className="form-group">
                 <label htmlFor="fileFormat">File Format</label>
                 <select id="fileFormat">
                   <option value="pdf">PDF</option>
                   <option value="csv">CSV</option>
                 </select>
               </div>
             </div>
             <div className="modal-footer">
               <button className="btn-secondary" onClick={closeModal}>Cancel</button>
               <button className="btn-primary">Download Selected</button>
             </div>
           </div>
         </div>
       )}
    </div>
  )
}

// Performance optimization: Memoize the component
const MemoizedPatientPortal = React.memo(PatientPortal)

export default MemoizedPatientPortal 