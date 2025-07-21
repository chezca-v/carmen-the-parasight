// Patient Portal JavaScript - Healthcare Patient Dashboard

// Import required services
import authService from '../services/auth-service.js';
import { getCurrentPatientData, getPatientData } from '../services/firestoredb.js';

class PatientPortal {
    constructor() {
        this.currentSection = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.calendarEventListeners = new Map(); // Track calendar event listeners
        this.patientData = null;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        try {
            // Close any lingering authentication popups
            this.closeAuthPopups();
            
            // Check for any pending errors from sign-in process
            this.checkPendingErrors();
            
            await this.loadUserData();
            this.setupEventListeners();
            this.setupCalendar();
            this.setupFormHandlers();
            this.setupTabHandlers();
            this.setupModalHandlers();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleError(error);
        }
    }

    closeAuthPopups() {
        try {
            console.log('🔧 Checking for open auth popups...');
            
            // Close any Firebase auth popups that might still be open
            // This handles cases where the popup doesn't close automatically
            if (window.opener) {
                // If this window was opened as a popup, close it
                console.log('Closing auth popup window (this window is a popup)');
                window.close();
                return;
            }
            
            // Try to close any child popup windows
            if (typeof window.authPopup !== 'undefined' && window.authPopup && !window.authPopup.closed) {
                console.log('Closing lingering auth popup (window.authPopup)');
                window.authPopup.close();
                window.authPopup = null;
            }
            
            // Close auth service popup if available
            if (authService && typeof authService.closeAuthPopup === 'function') {
                authService.closeAuthPopup();
            }
            
            // Send message to close any auth popups (in case they're listening)
            try {
                if (window.postMessage) {
                    window.postMessage({ type: 'CLOSE_AUTH_POPUP' }, window.location.origin);
                }
            } catch (e) {
                // Ignore postMessage errors
            }
            
            // Clear any auth-related flags
            if (window.isProcessingGoogleAuth) {
                window.isProcessingGoogleAuth = false;
            }
            
            // More aggressive popup cleanup - check for any popups in a few seconds
            setTimeout(() => {
                this.aggressivePopupCleanup();
            }, 2000);
            
            console.log('✅ Auth popup cleanup completed');
        } catch (error) {
            console.warn('⚠️ Error during auth popup cleanup:', error);
        }
    }

    aggressivePopupCleanup() {
        try {
            // Check all open windows and close ones that look like auth popups
            if (typeof window.authPopup !== 'undefined' && window.authPopup && !window.authPopup.closed) {
                console.log('🚨 Aggressively closing auth popup');
                window.authPopup.close();
                window.authPopup = null;
            }
            
            // Look for any global popup references
            const popupVars = ['authPopup', 'googleAuthPopup', 'firebasePopup', '_popupWindow'];
            popupVars.forEach(varName => {
                if (window[varName] && typeof window[varName].close === 'function' && !window[varName].closed) {
                    console.log(`🚨 Closing popup: ${varName}`);
                    window[varName].close();
                    window[varName] = null;
                }
            });
            
            console.log('✅ Aggressive popup cleanup completed');
        } catch (error) {
            console.warn('⚠️ Error during aggressive popup cleanup:', error);
        }
    }

    checkPendingErrors() {
        // Check for Firestore rules error
        const firestoreError = sessionStorage.getItem('firestore_rules_error');
        if (firestoreError) {
            console.warn('⚠️ Firestore rules issue detected:', firestoreError);
            sessionStorage.removeItem('firestore_rules_error');
            
            // Show user-friendly warning
            this.showNotification(
                'Your profile information may not be fully loaded due to configuration issues. Please contact support if you experience any problems.',
                'warning'
            );
        }
        
        // Check for patient document creation error
        const patientDocError = sessionStorage.getItem('pending_patient_doc_error');
        if (patientDocError) {
            console.warn('⚠️ Patient document creation issue:', patientDocError);
            sessionStorage.removeItem('pending_patient_doc_error');
            
            // This is handled gracefully in loadUserData, so just log it
        }
    }

    async loadUserData() {
        try {
            console.log('Loading user data...');
            this.showLoading('Loading patient information...');
            
            // Wait for auth state to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get current user
            const user = authService.getCurrentUser();
            
            if (!user) {
                console.log('No user found, auth guard will handle redirect');
                return;
            }

            console.log('User authenticated:', user.email);

            // Load patient data from Firestore
            let patientData = null;
            try {
                console.log('Loading patient data from Firestore...');
                patientData = await getPatientData(user.uid);
                
                // If no patient data exists, create it
                if (!patientData) {
                    console.log('No patient data found, creating new patient document...');
                    try {
                        const { createPatientDocument } = await import('../services/firestoredb.js');
                        await createPatientDocument(user, {
                            personalInfo: {
                                firstName: user.displayName ? user.displayName.split(' ')[0] : '',
                                lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
                                fullName: user.displayName || user.email.split('@')[0]
                            }
                        });
                        
                        patientData = await getPatientData(user.uid);
                        console.log('Patient document created successfully');
                    } catch (createError) {
                        console.warn('Could not create patient document:', createError);
                    }
                }
            } catch (error) {
                console.warn('Could not load patient data from Firestore:', error);
            }

            this.displayUserInfo(user, patientData);
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading user data:', error);
            this.hideLoading();
            
            // Fallback to basic user info
            const user = authService.getCurrentUser();
            if (user) {
                this.displayUserInfo(user, null);
            } else {
                this.displayFallbackUserInfo();
            }
        }
    }

    displayUserInfo(user, patientData) {
        try {
            this.patientData = patientData; // Store patient data for later use

            // Get user's name
            let firstName = '';
            let lastName = '';
            let fullName = '';

            if (patientData && patientData.personalInfo) {
                firstName = patientData.personalInfo.firstName || '';
                lastName = patientData.personalInfo.lastName || '';
                fullName = patientData.personalInfo.fullName || '';
            }

            // Fallback to Auth displayName
            if (!fullName && user.displayName) {
                const nameParts = user.displayName.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
                fullName = user.displayName;
            }

            // Final fallback to email
            if (!fullName) {
                fullName = user.email.split('@')[0];
                firstName = fullName;
            }

            // Update UI elements
            this.updateUserElements(firstName, lastName, fullName, user.email, patientData);

            // Check if profile is complete and show modal if not
            if (patientData && patientData.profileComplete === false) {
                this.showNotification('Welcome! Please complete your profile to continue.', 'info');
                // Use a short delay to ensure the UI is ready before showing the modal
                setTimeout(() => this.openEditProfileModal(), 500);
            }

        } catch (error) {
            console.error('Error displaying user info:', error);
            this.displayFallbackUserInfo();
        }
    }

    updateUserElements(firstName, lastName, fullName, email, patientData) {
        // Update patient name in header
        const patientNameElement = document.getElementById('patientName');
        if (patientNameElement) {
            patientNameElement.textContent = firstName;
        }

        const patientDisplayNameElement = document.getElementById('patientDisplayName');
        if (patientDisplayNameElement) {
            patientDisplayNameElement.textContent = firstName;
        }

        // Update profile information
        const elements = {
            fullName: fullName,
            emailAddress: email,
            phoneNumber: patientData?.personalInfo?.phone || 'Not provided',
            dateOfBirth: patientData?.personalInfo?.dateOfBirth || 'Not provided',
            bio: patientData?.personalInfo?.bio || 'Patient'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                    element.textContent = value;
            }
        });

        // Calculate and display age if DOB is available
        if (patientData?.personalInfo?.dateOfBirth) {
            const age = this.calculateAge(patientData.personalInfo.dateOfBirth);
            const ageElement = document.getElementById('age');
            if (ageElement) {
                ageElement.textContent = age;
            }
        }

        // Update profile name with gender tag
        const profileNameElement = document.querySelector('.profile-name');
        if (profileNameElement) {
            const genderTag = profileNameElement.querySelector('.gender-tag');
            const genderText = genderTag ? genderTag.outerHTML : '(Patient)';
            profileNameElement.innerHTML = `${fullName} <span class="gender-tag">${genderText}</span>`;
        }
        
        // Update user avatar initials
        const userAvatarElements = document.querySelectorAll('.user-avatar span, .profile-avatar-placeholder span');
        userAvatarElements.forEach(element => {
            const initials = this.getInitials(firstName, lastName, fullName);
            element.textContent = initials;
        });
    }

    getInitials(firstName, lastName, fullName) {
        if (firstName && lastName) {
            return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
        } else if (fullName) {
            const nameParts = fullName.split(' ');
            if (nameParts.length >= 2) {
                return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
                    } else {
                return fullName.charAt(0).toUpperCase();
            }
        }
        return 'U';
    }

    calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    }

    displayFallbackUserInfo() {
        const patientNameElement = document.getElementById('patientName');
        if (patientNameElement) {
            patientNameElement.textContent = 'Patient';
        }

        const patientDisplayNameElement = document.getElementById('patientDisplayName');
        if (patientDisplayNameElement) {
            patientDisplayNameElement.textContent = 'Patient';
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                
                if (section === 'logout') {
                    this.handleLogout();
                } else if (section) {
                    this.switchSection(section);
                }
            });
        });

        // Calendar navigation
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousMonth());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextMonth());
        }

        // Action buttons in quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionType = this.getActionType(e.currentTarget);
                this.handleAction(actionType, e.currentTarget);
            });
        });

        // Action buttons in other sections (like appointments list)
        document.querySelectorAll('.btn-primary, .btn-outline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionType = this.getActionType(e.currentTarget);
                if (actionType !== 'unknown') {
                    this.handleAction(actionType, e.currentTarget);
                }
            });
        });

        // General buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleButtonClick(e.target);
            });
        });

        const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
        if (uploadDocumentBtn) {
            uploadDocumentBtn.addEventListener('click', () => this.handleUploadDocument());
        }

        const documentUploadInput = document.getElementById('documentUploadInput');
        if (documentUploadInput) {
            documentUploadInput.addEventListener('change', (e) => this.handleFileSelected(e.target.files));
        }

        // FAQ interactions
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', () => {
                const faqItem = question.closest('.faq-item');
                if (faqItem) {
                    faqItem.classList.toggle('expanded');
                }
            });
        });

        // Help categories
        document.querySelectorAll('.help-category').forEach(category => {
            category.addEventListener('click', () => {
                const categoryName = category.querySelector('h3');
                if (categoryName) {
                    this.showNotification(`Opening help for: ${categoryName.textContent}`);
                }
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
        
        // Global modal handler via event delegation
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const closeButton = target.closest('[data-action="close"]');

            if (closeButton) {
                e.preventDefault();
                const modalToClose = closeButton.closest('.modal');
                if (modalToClose) {
                    this.closeModal(modalToClose);
                }
                return;
            }

            if (target.classList.contains('modal')) {
                this.closeModal(target);
            }
        });
    }

    switchSection(sectionName) {
        if (sectionName === this.currentSection) return;

        // Hide current section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show new section
        const newSection = document.getElementById(`${sectionName}-section`);
        if (newSection) {
            newSection.classList.add('active');
        }

        // Update navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
        const navLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (navLink && navLink.parentNode) {
            navLink.parentNode.classList.add('active');
        }

        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    setupTabHandlers() {
        // Update tab click handlers
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabContainer = e.target.closest('.profile-tabs');
                if (!tabContainer) return;

                // Remove active class from all tabs
                tabContainer.querySelectorAll('.tab-button').forEach(t => {
                    t.classList.remove('active');
                });

                // Add active class to clicked tab
                e.target.classList.add('active');

                // Hide all tab content
                tabContainer.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // Show selected tab content
                const tabId = e.target.getAttribute('data-tab');
                const selectedContent = tabContainer.querySelector(`#${tabId}-tab`);
                if (selectedContent) {
                    selectedContent.classList.add('active');
                }

                // Load tab-specific data if needed
                this.loadTabContent(tabId);
            });
        });

        // Setup document filters
        document.querySelectorAll('.document-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all filter buttons
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');

                const filter = e.target.getAttribute('data-filter');
                this.filterDocuments(filter);
            });
        });

        // Setup consultation filters
        const consultationFilter = document.getElementById('consultationFilter');
        if (consultationFilter) {
            consultationFilter.addEventListener('change', (e) => {
                this.filterConsultations(e.target.value);
            });
        }

        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filterConsultationsByDate(e.target.value);
            });
        }
    }

    loadTabContent(tabId) {
        switch (tabId) {
            case 'consultation-history':
                this.loadConsultationHistory();
                break;
            case 'patient-documents':
                this.loadPatientDocuments();
                break;
            case 'general':
                this.loadGeneralProfile();
                break;
        }
    }

    filterDocuments(filter) {
        const documents = document.querySelectorAll('.document-item');
        documents.forEach(doc => {
            if (filter === 'all' || doc.getAttribute('data-type') === filter) {
                doc.style.display = 'flex';
            } else {
                doc.style.display = 'none';
            }
        });
    }

    filterConsultations(status) {
        const consultations = document.querySelectorAll('.consultation-item');
        consultations.forEach(consultation => {
            const statusElement = consultation.querySelector('.status');
            if (!statusElement) return;

            const consultationStatus = statusElement.textContent.toLowerCase();
            if (status === 'all' || consultationStatus === status) {
                consultation.style.display = 'flex';
            } else {
                consultation.style.display = 'none';
            }
        });
    }

    filterConsultationsByDate(date) {
        if (!date) return;

        const consultations = document.querySelectorAll('.consultation-item');
        const selectedDate = new Date(date);
        
        consultations.forEach(consultation => {
            const dateElement = consultation.querySelector('.consultation-date .date');
            if (!dateElement) return;

            const consultationDate = new Date(dateElement.textContent);
            if (consultationDate.toDateString() === selectedDate.toDateString()) {
                consultation.style.display = 'flex';
            } else {
                consultation.style.display = 'none';
            }
        });
    }

    loadConsultationHistory() {
        // In a real application, this would fetch consultation data from the backend
        console.log('Loading consultation history...');
    }

    loadPatientDocuments() {
        // In a real application, this would fetch document data from the backend
        console.log('Loading patient documents...');
    }

    loadGeneralProfile() {
        // In a real application, this would fetch profile data from the backend
        console.log('Loading general profile...');
    }

    setupCalendar() {
        this.updateCalendarDisplay();
    }

    updateCalendarDisplay() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const monthDisplay = document.querySelector('.current-month');
        if (monthDisplay) {
            monthDisplay.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }

        this.generateCalendarDays();
    }

    generateCalendarDays() {
        const calendarGrid = document.getElementById('calendarDays');
        if (!calendarGrid) return;

        this.cleanupCalendarEventListeners();
        calendarGrid.innerHTML = '';

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const startDate = new Date(firstDay);
        
        // Adjust to start from Sunday
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dayElement = this.createCalendarDay(currentDate);
            calendarGrid.appendChild(dayElement);
        }
    }

    createCalendarDay(date) {
        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day');
        
        const isCurrentMonth = date.getMonth() === this.currentMonth;
        const isToday = this.isToday(date);
        
        if (!isCurrentMonth) {
            dayElement.classList.add('prev-month');
        }
        
        if (isToday) {
            dayElement.classList.add('today');
        }

        const dayNumber = document.createElement('span');
        dayNumber.classList.add('day-number');
        dayNumber.textContent = date.getDate();

        // Add appointment indicators for sample dates
        if (isCurrentMonth && (date.getDate() === 22 || date.getDate() === 25)) {
            const indicator = document.createElement('div');
            indicator.classList.add('appointment-indicator');
            dayElement.appendChild(indicator);
        }

        dayElement.appendChild(dayNumber);

        const clickHandler = () => {
            this.selectCalendarDay(date, dayElement);
        };
        
        dayElement.addEventListener('click', clickHandler);
        this.calendarEventListeners.set(dayElement, clickHandler);

        return dayElement;
    }

    cleanupCalendarEventListeners() {
        this.calendarEventListeners.forEach((handler, element) => {
            element.removeEventListener('click', handler);
        });
        this.calendarEventListeners.clear();
    }

    selectCalendarDay(date, element) {
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });

        element.classList.add('selected');
        this.showDayDetails(date);
    }

    showDayDetails(date) {
        console.log('Selected date:', date);
        this.showNotification(`Selected: ${date.toDateString()}`);
    }

    previousMonth() {
                this.currentMonth--;
                if (this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
        this.updateCalendarDisplay();
        }

    nextMonth() {
                this.currentMonth++;
                if (this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
        this.updateCalendarDisplay();
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getActionType(element) {
        // Get the text from the button or its child span if it exists
        const buttonText = (element.querySelector('span')?.textContent || element.textContent).trim().toLowerCase();
        // Get the icon class if it exists
        const iconClass = element.querySelector('i')?.className.toLowerCase() || '';


        console.log('Button text:', buttonText);
        console.log('Icon class:', iconClass);

        // Check both button text and icon class
        if (buttonText.includes('book appointment') || buttonText.includes('book follow-up')) {
            return 'book-appointment';
        } else if (buttonText.includes('video consultation') || iconClass.includes('video')) {
            return 'join-video';
        } else if (buttonText.includes('refill prescription') || buttonText.includes('refill')) {
            return 'refill-prescription';
        } else if (buttonText.includes('download records')) {
            return 'download-records';
        } else if (buttonText.includes('download') || iconClass.includes('download')) {
            return 'download-document';
        } else if (buttonText.includes('view report')) {
            return 'view-report';
        } else if (buttonText.includes('view') || iconClass.includes('eye')) {
            return 'view-document';
        }
        
        console.log('No action type matched');
        return 'unknown';
    }

    handleAction(actionType, element) {
        console.log('Action triggered:', actionType);
        
        switch (actionType) {
            case 'book-appointment':
                console.log('Opening book appointment modal');
                this.openModal('bookAppointmentModal');
                break;
            case 'join-video':
                console.log('Opening video consultation modal');
                this.openModal('videoConsultationModal');
                break;
            case 'refill-prescription':
                console.log('Opening prescription refill modal');
                this.openModal('prescriptionRefillModal');
                break;
            case 'download-records':
                console.log('Opening download records modal');
                this.openModal('downloadRecordsModal');
                break;
            case 'view-report': {
                const reportTitle = element.closest('.consultation-item')?.querySelector('h4')?.textContent;
                this.showNotification(`Opening report for ${reportTitle || 'consultation'}...`);
                // In a real app, you would fetch and display the report
                break;
            }
            case 'download-document': {
                const docTitle = element.closest('.document-item')?.querySelector('h4')?.textContent;
                this.showNotification(`Downloading ${docTitle || 'document'}...`);
                // In a real app, you would initiate a file download
                break;
            }
            case 'view-document': {
                const docTitle = element.closest('.document-item')?.querySelector('h4')?.textContent;
                this.showNotification(`Viewing ${docTitle || 'document'}...`);
                // In a real app, you would open the document in a viewer or new tab
                break;
            }
            default:
                console.log('Unknown action type:', actionType);
                this.showNotification('Action not recognized');
        }
    }

    setupModalHandlers() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            console.log('Setting up handlers for modal:', modal.id);
            
            // Handle all close buttons (both X and Cancel)
            const closeButtons = modal.querySelectorAll('[data-action="close"]');
            closeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Close button clicked');
                    this.closeModal(modal);
                });
            });

            // Click outside modal to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    console.log('Clicked outside modal');
                    this.closeModal(modal);
                }
            });

            // Setup form submission handlers
            switch (modal.id) {
                case 'bookAppointmentModal':
                    console.log('Setting up appointment form handlers');
                    this.setupAppointmentForm(modal);
                    break;
                case 'videoConsultationModal':
                    console.log('Setting up video consultation handlers');
                    this.setupVideoConsultation(modal);
                    break;
                case 'prescriptionRefillModal':
                    console.log('Setting up prescription refill handlers');
                    this.setupPrescriptionRefill(modal);
                    break;
                case 'downloadRecordsModal':
                    console.log('Setting up download records handlers');
                    this.setupDownloadRecords(modal);
                    break;
            }
        });
    }

    closeModal(modalElement) {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            // Setup form-specific logic if any
            this.setupFormHandlersForModal(modal);
        }
    }

    setupAppointmentForm(modal) {
        const saveBtn = modal.querySelector('#saveAppointment');
        const form = modal.querySelector('#appointmentForm');

        if (saveBtn && form) {
            saveBtn.onclick = async (e) => {
                e.preventDefault();
                if (form.checkValidity()) {
                    this.showLoading('Booking appointment...');
                    
                    // Simulate API call
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    this.hideLoading();
                    this.showNotification('Appointment booked successfully!', 'success');
                    this.closeModal(modal);
                } else {
                    this.showNotification('Please fill in all required fields', 'error');
                }
            };
        }
    }

    setupVideoConsultation(modal) {
        const startBtn = modal.querySelector('#startConsultation');
        if (startBtn) {
            startBtn.onclick = async () => {
                this.showLoading('Joining consultation...');
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                this.hideLoading();
                this.showNotification('Joining video consultation...', 'success');
                this.closeModal(modal);
                
                // Here you would typically redirect to the video consultation page
                // window.location.href = '/video-consultation';
            };
        }
    }

    setupPrescriptionRefill(modal) {
        const submitBtn = modal.querySelector('#submitRefill');
        const form = modal.querySelector('#refillForm');

        if (submitBtn && form) {
            submitBtn.onclick = async (e) => {
                e.preventDefault();
                if (form.checkValidity()) {
                    this.showLoading('Processing refill request...');
                    
                    // Simulate API call
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    this.hideLoading();
                    this.showNotification('Prescription refill request submitted!', 'success');
                    this.closeModal(modal);
                } else {
                    this.showNotification('Please fill in all required fields', 'error');
                }
            };
        }
    }

    setupDownloadRecords(modal) {
        const downloadBtn = modal.querySelector('#startDownload');
        if (downloadBtn) {
            downloadBtn.onclick = async () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
                if (checkboxes.length === 0) {
                    this.showNotification('Please select at least one record', 'warning');
                    return;
                }

                this.showLoading('Preparing download...');
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                this.hideLoading();
                this.showNotification('Records downloaded successfully!', 'success');
                this.closeModal(modal);
            };
        }
    }

    handleUploadDocument() {
        document.getElementById('documentUploadInput').click();
    }

    handleFileSelected(files) {
        if (files.length > 0) {
            const file = files[0];
            console.log('Selected file:', file.name);
            this.showNotification(`Uploading ${file.name}...`, 'info');
            // Here you would typically handle the file upload process
            setTimeout(() => {
                this.showNotification(`${file.name} uploaded successfully!`, 'success');
            }, 1500);
        }
    }

    handleButtonClick(element) {
        const btnId = element.id;

        if (btnId === 'editProfileBtn') {
            this.openModal('editProfileModal');
        } else if (btnId === 'saveProfile') {
            this.saveProfile();
        } else if (btnId === 'cancelEdit' || btnId === 'closeModal') {
             const modal = element.closest('.modal');
             if(modal) this.closeModal(modal);
        } else if (element.textContent.trim().toLowerCase().includes('change')) {
            this.showNotification('Password change functionality coming soon!');
        }
    }

    setupFormHandlers() {
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleToggleChange(e.target);
            });
        });
    }

    handleToggleChange(toggle) {
        const isChecked = toggle.checked;
        const toggleType = toggle.id;
        
        if (toggleType === 'notificationsToggle') {
            this.showNotification(`Notifications ${isChecked ? 'enabled' : 'disabled'}`, 'success');
        }
    }

    setupFormHandlersForModal(modal) {
        switch (modal.id) {
            case 'bookAppointmentModal':
                this.setupAppointmentForm(modal);
                break;
            case 'videoConsultationModal':
                this.setupVideoConsultation(modal);
                break;
            case 'prescriptionRefillModal':
                this.setupPrescriptionRefill(modal);
                break;
            case 'downloadRecordsModal':
                this.setupDownloadRecords(modal);
                break;
        }
    }

    openEditProfileModal() {
        this.openModal('editProfileModal');
        this.populateEditForm();
        this.setupProfileValidation();
    }

    closeEditProfileModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            this.closeModal(modal);
        }
    }

    populateEditForm() {
        const elements = {
            editFullName: 'fullName',
            editDateOfBirth: 'dateOfBirth',
            editPhoneNumber: 'phoneNumber',
            editEmailAddress: 'emailAddress',
            editBio: 'bio'
        };

        Object.entries(elements).forEach(([formId, displayId]) => {
            const formElement = document.getElementById(formId);
            const displayElement = document.getElementById(displayId);
            
            if (formElement && displayElement) {
                const value = displayElement.textContent;
                if (value && value !== '--/--/----' && value !== 'Loading...' && value !== 'Not provided') {
                    formElement.value = value;
                }
            }
        });
    }

    setupProfileValidation() {
        const form = document.getElementById('profileForm');
        const saveBtn = document.getElementById('saveProfile');
        const inputs = form.querySelectorAll('input, textarea');
        
        // Add validation classes and aria attributes
        inputs.forEach(input => {
            input.setAttribute('aria-required', 'true');
            
            // Add validation event listeners
            input.addEventListener('input', () => {
                this.validateInput(input);
                this.updateSaveButtonState();
            });

            input.addEventListener('blur', () => {
                this.validateInput(input);
            });
        });

        // Phone number formatting
        const phoneInput = document.getElementById('editPhoneNumber');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 0) {
                    if (value.length <= 3) {
                        value = value;
                    } else if (value.length <= 6) {
                        value = value.slice(0, 3) + '-' + value.slice(3);
                    } else {
                        value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10);
                    }
                }
                e.target.value = value;
            });
        }

        // Date of birth validation and formatting
        const dobInput = document.getElementById('editDateOfBirth');
        if (dobInput) {
            dobInput.setAttribute('max', this.getMaxDate());
            dobInput.addEventListener('change', () => {
                this.validateDateOfBirth(dobInput);
            });
        }

        // Email validation
        const emailInput = document.getElementById('editEmailAddress');
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                this.validateEmail(emailInput);
            });
        }

        // Bio character count
        const bioInput = document.getElementById('editBio');
        if (bioInput) {
            const maxLength = 500;
            bioInput.setAttribute('maxlength', maxLength);
            
            const charCount = document.createElement('div');
            charCount.className = 'char-count';
            charCount.style.cssText = 'text-align: right; font-size: 0.8em; color: #666;';
            bioInput.parentNode.appendChild(charCount);
            
            const updateCharCount = () => {
                const remaining = maxLength - bioInput.value.length;
                charCount.textContent = `${remaining} characters remaining`;
                charCount.style.color = remaining < 50 ? '#dc2626' : '#666';
            };
            
            bioInput.addEventListener('input', updateCharCount);
            updateCharCount();
        }
    }

    validateInput(input) {
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (input.id) {
            case 'editFullName':
                if (value.length < 2) {
                    isValid = false;
                    errorMessage = 'Name must be at least 2 characters long';
                } else if (!/^[a-zA-Z\s-']+$/.test(value)) {
                    isValid = false;
                    errorMessage = 'Name can only contain letters, spaces, hyphens, and apostrophes';
                }
                break;
            case 'editPhoneNumber':
                if (!/^\d{3}-\d{3}-\d{4}$/.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid phone number (e.g., 123-456-7890)';
                }
                break;
            case 'editEmailAddress':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
            case 'editBio':
                if (value.length > 500) {
                    isValid = false;
                    errorMessage = 'Bio must not exceed 500 characters';
                }
                break;
        }

        this.updateInputValidationUI(input, isValid, errorMessage);
        return isValid;
    }

    updateInputValidationUI(input, isValid, errorMessage) {
        const errorElement = this.getOrCreateErrorElement(input);
        
        if (!isValid) {
            input.classList.add('invalid');
            input.classList.remove('valid');
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
            errorElement.style.display = 'none';
        }
    }

    getOrCreateErrorElement(input) {
        const errorId = `${input.id}-error`;
        let errorElement = document.getElementById(errorId);
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = errorId;
            errorElement.className = 'error-message';
            errorElement.style.cssText = 'color: #dc2626; font-size: 0.8em; margin-top: 4px; display: none;';
            input.parentNode.appendChild(errorElement);
        }
        
        return errorElement;
    }

    validateDateOfBirth(input) {
        const value = input.value;
        const date = new Date(value);
        const today = new Date();
        const minDate = new Date();
        minDate.setFullYear(today.getFullYear() - 120); // Maximum age 120 years
        
        let isValid = true;
        let errorMessage = '';

        if (!value) {
            isValid = false;
            errorMessage = 'Date of birth is required';
        } else if (date > today) {
            isValid = false;
            errorMessage = 'Date of birth cannot be in the future';
        } else if (date < minDate) {
            isValid = false;
            errorMessage = 'Please enter a valid date of birth';
        }

        this.updateInputValidationUI(input, isValid, errorMessage);
        return isValid;
    }

    validateEmail(input) {
        const value = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailRegex.test(value);
        
        this.updateInputValidationUI(input, isValid, isValid ? '' : 'Please enter a valid email address');
        return isValid;
    }

    getMaxDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    updateSaveButtonState() {
        const form = document.getElementById('profileForm');
        const saveBtn = document.getElementById('saveProfile');
        const inputs = form.querySelectorAll('input, textarea');
        
        let isValid = true;
        inputs.forEach(input => {
            if (input.classList.contains('invalid') || !input.value.trim()) {
                isValid = false;
            }
        });

        saveBtn.disabled = !isValid;
        saveBtn.style.opacity = isValid ? '1' : '0.5';
    }

    async saveProfile() {
        const form = document.getElementById('profileForm');
        if (!form) {
            this.showNotification('Form not found!', 'error');
            return;
        }

        // Validate all inputs
        const inputs = form.querySelectorAll('input, textarea');
        let isValid = true;
        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });

        if (!isValid) {
            this.showNotification('Please fix the errors before saving', 'error');
            return;
        }

        try {
            this.showLoading('Saving profile changes...');

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Prepare profile data
            const profileData = {
                personalInfo: {
                    firstName: data.editFullName.split(' ')[0],
                    lastName: data.editFullName.split(' ').slice(1).join(' '),
                    fullName: data.editFullName,
                    dateOfBirth: data.editDateOfBirth,
                    phone: data.editPhoneNumber,
                    email: data.editEmailAddress,
                    bio: data.editBio
                },
                profileComplete: true,
                lastUpdated: new Date().toISOString()
            };

            // In a real app, you would save to backend here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            // Update local state
            this.patientData = {
                ...this.patientData,
                ...profileData
            };

            // Update UI
            this.updateProfileDisplay(data);
            this.closeEditProfileModal();
            this.showNotification('Profile updated successfully!', 'success');

            // Refresh profile section
            this.loadTabContent('general');

        } catch (error) {
            console.error('Error saving profile:', error);
            this.showNotification('Failed to save profile changes. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateProfileDisplay(data) {
        // Update basic profile information
        const elements = {
            fullName: data.editFullName || '',
            dateOfBirth: data.editDateOfBirth || '',
            phoneNumber: data.editPhoneNumber || '',
            emailAddress: data.editEmailAddress || '',
            bio: data.editBio || ''
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) {
                element.textContent = value;
            }
        });

        // Update age if date of birth was changed
        if (data.editDateOfBirth) {
            const age = this.calculateAge(data.editDateOfBirth);
            const ageElement = document.getElementById('age');
            if (ageElement) {
                ageElement.textContent = age;
            }
        }

        // Update name in header and other locations
        if (data.editFullName) {
            const firstName = data.editFullName.split(' ')[0];
            
            // Update all instances of the user's name
            const nameElements = {
                patientName: firstName,
                patientDisplayName: firstName,
                'profile-name': `${data.editFullName} <span class="gender-tag">(Patient)</span>`
            };

            Object.entries(nameElements).forEach(([id, value]) => {
                const element = document.getElementById(id) || document.querySelector(`.${id}`);
                if (element) {
                    element.innerHTML = value;
                }
            });

            // Update avatar initials
            const initials = this.getInitials(
                data.editFullName.split(' ')[0],
                data.editFullName.split(' ').slice(1).join(' '),
                data.editFullName
            );

            document.querySelectorAll('.user-avatar span, .profile-avatar-placeholder span')
                .forEach(element => {
                    element.textContent = initials;
                });
        }
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                console.log('Loading dashboard data...');
                break;
            case 'calendar':
                console.log('Loading calendar data...');
                this.updateCalendarDisplay();
                break;
            case 'profile':
                console.log('Loading profile data...');
                break;
            case 'help':
                console.log('Loading help data...');
                break;
        }
    }

    showLoading(message = 'Loading...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingMessage = document.getElementById('loadingMessage');
        
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                // Show loading notification
                this.showNotification('Logging out...', 'info');
                
                // Disable logout button to prevent multiple clicks
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.disabled = true;
                    logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Logging out...</span>';
                }
                
                // Import and call auth service logout
                const authServiceModule = await import('../services/auth-service.js');
                const authService = authServiceModule.default;
                
                // Call proper logout method
                await authService.logout();
                
                // Clear any cached data
                authService.forceClearAuthState();
                
                // Show success message
                this.showNotification('Logged out successfully. Redirecting...', 'success');
                
                // Redirect after delay
                setTimeout(() => {
                    window.location.href = '/public/patientSign-in.html';
                }, 1500);
                
            } catch (error) {
                console.error('Logout error:', error);
                
                // Reset logout button state
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.disabled = false;
                    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Logout</span>';
                }
                
                // Show error notification
                this.showNotification('Logout failed. Please try again.', 'error');
            }
        }
    }

    handleError(error) {
        console.error('Patient Portal Error:', error);
        this.showNotification('An error occurred. Please try again.', 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        });

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10b981';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f59e0b';
                break;
            default:
                notification.style.backgroundColor = '#0ea5e9';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// Initialize patient portal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const patientPortal = new PatientPortal();
    
    // Make patient portal globally accessible for debugging
    window.patientPortal = patientPortal;
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        if (window.patientPortal) {
            window.patientPortal.loadSectionData(window.patientPortal.currentSection);
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.patientPortal) {
        window.patientPortal.updateCalendarDisplay();
    }
}); 