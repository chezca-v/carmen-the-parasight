// Organization Management Service
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';

import { 
    getAuth,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';

import { db, auth } from './config.js';
import authService, { USER_ROLES } from './auth-service.js';

/**
 * Organization Service Class
 * Handles B2B functionality for hospitals, clinics, and healthcare organizations
 */
class OrganizationService {
    constructor() {
        this.currentOrganization = null;
        this.organizationListeners = [];
    }

    /**
     * Register a new organization
     * @param {Object} organizationData - Organization registration data
     * @param {Object} adminData - Admin user data
     */
    async registerOrganization(organizationData, adminData) {
        try {
            // Validate organization data
            this.validateOrganizationData(organizationData);
            this.validateAdminData(adminData);

            // Create organization document
            const organizationRef = doc(collection(db, 'organizations'));
            const organizationId = organizationRef.id;

            const orgData = {
                id: organizationId,
                name: organizationData.name,
                type: organizationData.type, // 'hospital', 'clinic', 'practice', 'other'
                description: organizationData.description || '',
                address: {
                    street: organizationData.address.street,
                    city: organizationData.address.city,
                    state: organizationData.address.state,
                    zipCode: organizationData.address.zipCode,
                    country: organizationData.address.country || 'US'
                },
                contact: {
                    email: organizationData.contact.email,
                    phone: organizationData.contact.phone,
                    website: organizationData.contact.website || ''
                },
                license: {
                    number: organizationData.license?.number || '',
                    state: organizationData.license?.state || '',
                    expirationDate: organizationData.license?.expirationDate || null
                },
                settings: {
                    allowPatientRegistration: organizationData.settings?.allowPatientRegistration ?? true,
                    requireApproval: organizationData.settings?.requireApproval ?? false,
                    timezone: organizationData.settings?.timezone || 'America/New_York'
                },
                subscription: {
                    plan: 'trial', // 'trial', 'basic', 'professional', 'enterprise'
                    status: 'active',
                    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days trial
                },
                stats: {
                    totalStaff: 0,
                    totalPatients: 0,
                    totalAppointments: 0
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isActive: true
            };

            await setDoc(organizationRef, orgData);

            // Create admin user account
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                adminData.email, 
                adminData.password
            );

            // Send email verification
            await sendEmailVerification(userCredential.user);

            // Create admin user document
            const adminUserData = {
                uid: userCredential.user.uid,
                email: adminData.email,
                displayName: `${adminData.firstName} ${adminData.lastName}`,
                role: USER_ROLES.ORGANIZATION_ADMIN,
                organizationId: organizationId,
                personalInfo: {
                    firstName: adminData.firstName,
                    lastName: adminData.lastName,
                    title: adminData.title || '',
                    department: adminData.department || '',
                    phone: adminData.phone || ''
                },
                permissions: {
                    canManageStaff: true,
                    canManagePatients: true,
                    canManageSettings: true,
                    canViewReports: true,
                    canManageBilling: true
                },
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                isActive: true,
                emailVerified: false
            };

            await setDoc(doc(db, 'users', userCredential.user.uid), adminUserData);

            // Update organization with admin info
            await updateDoc(organizationRef, {
                adminUserId: userCredential.user.uid,
                'stats.totalStaff': 1
            });

            // Sign out the newly created admin (they need to verify email first)
            await signOut(auth);

            return {
                organizationId,
                adminUserId: userCredential.user.uid,
                message: 'Organization registered successfully. Please check your email to verify your account.'
            };

        } catch (error) {
            console.error('Organization registration error:', error);
            throw error;
        }
    }

    /**
     * Invite staff member to organization
     * @param {string} organizationId - Organization ID
     * @param {Object} staffData - Staff member data
     */
    async inviteStaffMember(organizationId, staffData) {
        try {
            // Check if current user has permission
            if (!authService.hasPermission('manage_staff')) {
                throw new Error('Insufficient permissions to invite staff');
            }

            // Validate staff data
            this.validateStaffData(staffData);

            // Check if organization exists
            const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
            if (!orgDoc.exists()) {
                throw new Error('Organization not found');
            }

            // Create staff invitation
            const invitationRef = doc(collection(db, 'staff_invitations'));
            const invitationData = {
                id: invitationRef.id,
                organizationId,
                organizationName: orgDoc.data().name,
                email: staffData.email,
                role: staffData.role,
                firstName: staffData.firstName,
                lastName: staffData.lastName,
                title: staffData.title || '',
                department: staffData.department || '',
                permissions: staffData.permissions || this.getDefaultPermissions(staffData.role),
                invitedBy: authService.getCurrentUser().uid,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                status: 'pending'
            };

            await setDoc(invitationRef, invitationData);

            // TODO: Send invitation email
            console.log('Staff invitation created:', invitationData);

            return invitationData;

        } catch (error) {
            console.error('Staff invitation error:', error);
            throw error;
        }
    }

    /**
     * Accept staff invitation
     * @param {string} invitationId - Invitation ID
     * @param {string} password - New user password
     */
    async acceptStaffInvitation(invitationId, password) {
        try {
            // Get invitation
            const invitationDoc = await getDoc(doc(db, 'staff_invitations', invitationId));
            if (!invitationDoc.exists()) {
                throw new Error('Invitation not found');
            }

            const invitationData = invitationDoc.data();

            // Check if invitation is still valid
            if (invitationData.status !== 'pending') {
                throw new Error('Invitation has already been used or expired');
            }

            if (new Date() > invitationData.expiresAt.toDate()) {
                throw new Error('Invitation has expired');
            }

            // Create user account
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                invitationData.email, 
                password
            );

            // Send email verification
            await sendEmailVerification(userCredential.user);

            // Create user document
            const userData = {
                uid: userCredential.user.uid,
                email: invitationData.email,
                displayName: `${invitationData.firstName} ${invitationData.lastName}`,
                role: invitationData.role,
                organizationId: invitationData.organizationId,
                personalInfo: {
                    firstName: invitationData.firstName,
                    lastName: invitationData.lastName,
                    title: invitationData.title,
                    department: invitationData.department
                },
                permissions: invitationData.permissions,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                isActive: true,
                emailVerified: false
            };

            await setDoc(doc(db, 'users', userCredential.user.uid), userData);

            // Update invitation status
            await updateDoc(doc(db, 'staff_invitations', invitationId), {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                userId: userCredential.user.uid
            });

            // Update organization staff count
            const orgRef = doc(db, 'organizations', invitationData.organizationId);
            await updateDoc(orgRef, {
                'stats.totalStaff': arrayUnion(userCredential.user.uid)
            });

            // Sign out (user needs to verify email first)
            await signOut(auth);

            return {
                userId: userCredential.user.uid,
                message: 'Staff account created successfully. Please check your email to verify your account.'
            };

        } catch (error) {
            console.error('Staff invitation acceptance error:', error);
            throw error;
        }
    }

    /**
     * Assign patient to organization
     * @param {string} organizationId - Organization ID
     * @param {string} patientId - Patient ID
     */
    async assignPatientToOrganization(organizationId, patientId) {
        try {
            // Check permissions
            if (!authService.hasPermission('manage_organization')) {
                throw new Error('Insufficient permissions to assign patients');
            }

            // Update patient document
            await updateDoc(doc(db, 'patients', patientId), {
                organizationId: organizationId,
                assignedAt: serverTimestamp()
            });

            // Update organization patient count
            await updateDoc(doc(db, 'organizations', organizationId), {
                'stats.totalPatients': arrayUnion(patientId)
            });

            return true;

        } catch (error) {
            console.error('Patient assignment error:', error);
            throw error;
        }
    }

    /**
     * Get organization data
     * @param {string} organizationId - Organization ID
     */
    async getOrganization(organizationId) {
        try {
            const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
            if (!orgDoc.exists()) {
                throw new Error('Organization not found');
            }
            return orgDoc.data();
        } catch (error) {
            console.error('Get organization error:', error);
            throw error;
        }
    }

    /**
     * Get organization staff
     * @param {string} organizationId - Organization ID
     */
    async getOrganizationStaff(organizationId) {
        try {
            const staffQuery = query(
                collection(db, 'users'),
                where('organizationId', '==', organizationId),
                where('isActive', '==', true)
            );

            const staffSnapshot = await getDocs(staffQuery);
            return staffSnapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Get organization staff error:', error);
            throw error;
        }
    }

    /**
     * Get organization patients
     * @param {string} organizationId - Organization ID
     */
    async getOrganizationPatients(organizationId) {
        try {
            const patientsQuery = query(
                collection(db, 'patients'),
                where('organizationId', '==', organizationId),
                where('isActive', '==', true)
            );

            const patientsSnapshot = await getDocs(patientsQuery);
            return patientsSnapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Get organization patients error:', error);
            throw error;
        }
    }

    /**
     * Validate organization data
     */
    validateOrganizationData(data) {
        if (!data.name || data.name.trim().length < 2) {
            throw new Error('Organization name is required and must be at least 2 characters');
        }
        
        if (!data.type || !['hospital', 'clinic', 'practice', 'other'].includes(data.type)) {
            throw new Error('Valid organization type is required');
        }
        
        if (!data.address || !data.address.street || !data.address.city) {
            throw new Error('Complete address is required');
        }
        
        if (!data.contact || !data.contact.email || !data.contact.phone) {
            throw new Error('Contact email and phone are required');
        }
    }

    /**
     * Validate admin data
     */
    validateAdminData(data) {
        if (!data.firstName || !data.lastName) {
            throw new Error('First name and last name are required');
        }
        
        if (!data.email || !data.email.includes('@')) {
            throw new Error('Valid email is required');
        }
        
        if (!data.password || data.password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
    }

    /**
     * Validate staff data
     */
    validateStaffData(data) {
        if (!data.firstName || !data.lastName) {
            throw new Error('First name and last name are required');
        }
        
        if (!data.email || !data.email.includes('@')) {
            throw new Error('Valid email is required');
        }
        
        if (!data.role || !Object.values(USER_ROLES).includes(data.role)) {
            throw new Error('Valid role is required');
        }
    }

    /**
     * Get default permissions for role
     */
    getDefaultPermissions(role) {
        const defaultPermissions = {
            [USER_ROLES.DOCTOR]: {
                canManageStaff: false,
                canManagePatients: true,
                canManageSettings: false,
                canViewReports: true,
                canManageBilling: false
            },
            [USER_ROLES.NURSE]: {
                canManageStaff: false,
                canManagePatients: true,
                canManageSettings: false,
                canViewReports: false,
                canManageBilling: false
            },
            [USER_ROLES.CLINIC_STAFF]: {
                canManageStaff: false,
                canManagePatients: false,
                canManageSettings: false,
                canViewReports: false,
                canManageBilling: false
            },
            [USER_ROLES.ORGANIZATION_MEMBER]: {
                canManageStaff: false,
                canManagePatients: false,
                canManageSettings: false,
                canViewReports: false,
                canManageBilling: false
            }
        };

        return defaultPermissions[role] || {};
    }
}

// Create and export singleton instance
const organizationService = new OrganizationService();
export default organizationService;
export { USER_ROLES }; 