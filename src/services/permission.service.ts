/**
 * Permission Management Service
 * Provides comprehensive role-based access control (RBAC) with granular permissions
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  onSnapshot,
  writeBatch,
  runTransaction,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { hipaaComplianceService } from './hipaa-compliance.service';

// Permission system interfaces
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  priority: number; // Higher number = higher priority
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  conditions?: Record<string, any>;
}

export interface ResourceAccess {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

// Predefined permissions for healthcare system
export const HEALTHCARE_PERMISSIONS = {
  // Patient data permissions
  PATIENT_READ: 'patient:read',
  PATIENT_CREATE: 'patient:create',
  PATIENT_UPDATE: 'patient:update',
  PATIENT_DELETE: 'patient:delete',
  PATIENT_EXPORT: 'patient:export',
  
  // Medical records permissions
  MEDICAL_RECORD_READ: 'medical_record:read',
  MEDICAL_RECORD_CREATE: 'medical_record:create',
  MEDICAL_RECORD_UPDATE: 'medical_record:update',
  MEDICAL_RECORD_DELETE: 'medical_record:delete',
  
  // Appointment permissions
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_CREATE: 'appointment:create',
  APPOINTMENT_UPDATE: 'appointment:update',
  APPOINTMENT_CANCEL: 'appointment:cancel',
  
  // Consent permissions
  CONSENT_READ: 'consent:read',
  CONSENT_CREATE: 'consent:create',
  CONSENT_UPDATE: 'consent:update',
  CONSENT_REVOKE: 'consent:revoke',
  
  // Facility permissions
  FACILITY_READ: 'facility:read',
  FACILITY_CREATE: 'facility:create',
  FACILITY_UPDATE: 'facility:update',
  FACILITY_DELETE: 'facility:delete',
  
  // User management permissions
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ROLE_ASSIGN: 'user:role_assign',
  
  // System permissions
  SYSTEM_CONFIG_READ: 'system_config:read',
  SYSTEM_CONFIG_UPDATE: 'system_config:update',
  AUDIT_LOG_READ: 'audit_log:read',
  COMPLIANCE_REPORT_READ: 'compliance_report:read'
};

// Predefined roles for healthcare system
export const HEALTHCARE_ROLES = {
  SYSTEM_ADMIN: {
    name: 'system_admin',
    description: 'System Administrator with full access',
    permissions: Object.values(HEALTHCARE_PERMISSIONS),
    priority: 100
  },
  
  COMPLIANCE_OFFICER: {
    name: 'compliance_officer',
    description: 'HIPAA Compliance Officer',
    permissions: [
      HEALTHCARE_PERMISSIONS.AUDIT_LOG_READ,
      HEALTHCARE_PERMISSIONS.COMPLIANCE_REPORT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_UPDATE,
      HEALTHCARE_PERMISSIONS.PATIENT_READ
    ],
    priority: 90
  },
  
  FACILITY_ADMIN: {
    name: 'facility_admin',
    description: 'Healthcare Facility Administrator',
    permissions: [
      HEALTHCARE_PERMISSIONS.FACILITY_READ,
      HEALTHCARE_PERMISSIONS.FACILITY_UPDATE,
      HEALTHCARE_PERMISSIONS.USER_READ,
      HEALTHCARE_PERMISSIONS.USER_CREATE,
      HEALTHCARE_PERMISSIONS.USER_UPDATE,
      HEALTHCARE_PERMISSIONS.USER_ROLE_ASSIGN,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_CREATE,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_UPDATE
    ],
    priority: 80
  },
  
  DOCTOR: {
    name: 'doctor',
    description: 'Healthcare Provider (Doctor)',
    permissions: [
      HEALTHCARE_PERMISSIONS.PATIENT_READ,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_READ,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_CREATE,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_UPDATE,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_CREATE,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_UPDATE,
      HEALTHCARE_PERMISSIONS.CONSENT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_CREATE
    ],
    priority: 70
  },
  
  NURSE: {
    name: 'nurse',
    description: 'Healthcare Provider (Nurse)',
    permissions: [
      HEALTHCARE_PERMISSIONS.PATIENT_READ,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_READ,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_UPDATE,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_UPDATE,
      HEALTHCARE_PERMISSIONS.CONSENT_READ
    ],
    priority: 60
  },
  
  CLINIC_STAFF: {
    name: 'clinic_staff',
    description: 'Clinic Support Staff',
    permissions: [
      HEALTHCARE_PERMISSIONS.PATIENT_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_CREATE,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_UPDATE,
      HEALTHCARE_PERMISSIONS.CONSENT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_CREATE
    ],
    priority: 50
  },
  
  PATIENT: {
    name: 'patient',
    description: 'Patient User',
    permissions: [
      HEALTHCARE_PERMISSIONS.PATIENT_READ,
      HEALTHCARE_PERMISSIONS.MEDICAL_RECORD_READ,
      HEALTHCARE_PERMISSIONS.APPOINTMENT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_READ,
      HEALTHCARE_PERMISSIONS.CONSENT_UPDATE
    ],
    priority: 10
  }
};

export class PermissionService {
  private static instance: PermissionService;
  private permissionCache: Map<string, Permission> = new Map();
  private roleCache: Map<string, Role> = new Map();
  private userRoleCache: Map<string, string[]> = new Map();

  private constructor() {
    this.initializePermissions();
  }

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Initialize default permissions and roles
   */
  private async initializePermissions(): Promise<void> {
    try {
      // Check if permissions already exist
      const permissionsQuery = query(collection(db, 'permissions'));
      const permissionsSnapshot = await getDocs(permissionsQuery);
      
      if (permissionsSnapshot.empty) {
        await this.createDefaultPermissions();
      }
      
      // Check if roles already exist
      const rolesQuery = query(collection(db, 'roles'));
      const rolesSnapshot = await getDocs(rolesQuery);
      
      if (rolesSnapshot.empty) {
        await this.createDefaultRoles();
      }
      
      // Load permissions and roles into cache
      await this.loadPermissionsIntoCache();
      await this.loadRolesIntoCache();
      
    } catch (error) {
      console.error('Failed to initialize permissions:', error);
    }
  }

  /**
   * Create default permissions
   */
  private async createDefaultPermissions(): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const [key, permission] of Object.entries(HEALTHCARE_PERMISSIONS)) {
        const permissionDoc = {
          id: permission,
          name: key,
          description: `Permission to ${permission.split(':')[1]} ${permission.split(':')[0]}`,
          resource: permission.split(':')[0],
          action: permission.split(':')[1],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const permissionRef = doc(collection(db, 'permissions'), permission);
        batch.set(permissionRef, permissionDoc);
      }
      
      await batch.commit();
      console.log('✅ Default permissions created successfully');
    } catch (error) {
      console.error('Failed to create default permissions:', error);
      throw error;
    }
  }

  /**
   * Create default roles
   */
  private async createDefaultRoles(): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const [key, role] of Object.entries(HEALTHCARE_ROLES)) {
        const roleDoc = {
          id: role.name,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isActive: true,
          priority: role.priority,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const roleRef = doc(collection(db, 'roles'), role.name);
        batch.set(roleRef, roleDoc);
      }
      
      await batch.commit();
      console.log('✅ Default roles created successfully');
    } catch (error) {
      console.error('Failed to create default roles:', error);
      throw error;
    }
  }

  /**
   * Load permissions into cache
   */
  private async loadPermissionsIntoCache(): Promise<void> {
    try {
      const permissionsQuery = query(collection(db, 'permissions'), where('isActive', '==', true));
      const permissionsSnapshot = await getDocs(permissionsQuery);
      
      permissionsSnapshot.forEach(doc => {
        const permission = doc.data() as Permission;
        this.permissionCache.set(permission.id, permission);
      });
      
      console.log(`✅ Loaded ${this.permissionCache.size} permissions into cache`);
    } catch (error) {
      console.error('Failed to load permissions into cache:', error);
    }
  }

  /**
   * Load roles into cache
   */
  private async loadRolesIntoCache(): Promise<void> {
    try {
      const rolesQuery = query(collection(db, 'roles'), where('isActive', '==', true));
      const rolesSnapshot = await getDocs(rolesQuery);
      
      rolesSnapshot.forEach(doc => {
        const role = doc.data() as Role;
        this.roleCache.set(role.id, role);
      });
      
      console.log(`✅ Loaded ${this.roleCache.size} roles into cache`);
    } catch (error) {
      console.error('Failed to load roles into cache:', error);
    }
  }

  /**
   * Check if user has specific permission
   */
  async checkPermission(userId: string, permission: string, context?: Record<string, any>): Promise<PermissionCheck> {
    try {
      // Get user roles
      const userRoles = await this.getUserRoles(userId);
      
      if (userRoles.length === 0) {
        return { hasPermission: false, reason: 'User has no roles assigned' };
      }
      
      // Check each role for the permission
      for (const roleId of userRoles) {
        const role = this.roleCache.get(roleId);
        
        if (role && role.isActive && role.permissions.includes(permission)) {
          // Check conditions if any
          const permissionObj = this.permissionCache.get(permission);
          if (permissionObj?.conditions && context) {
            const conditionsMet = this.evaluateConditions(permissionObj.conditions, context);
            if (!conditionsMet) {
              continue; // Try next role
            }
          }
          
          return { 
            hasPermission: true, 
            conditions: permissionObj?.conditions 
          };
        }
      }
      
      return { hasPermission: false, reason: 'Permission not found in user roles' };
    } catch (error) {
      console.error('Permission check failed:', error);
      return { hasPermission: false, reason: 'Permission check failed' };
    }
  }

  /**
   * Check if user can perform action on resource
   */
  async canPerformAction(userId: string, resource: string, action: string, context?: Record<string, any>): Promise<PermissionCheck> {
    const permission = `${resource}:${action}`;
    return this.checkPermission(userId, permission, context);
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      // Check cache first
      if (this.userRoleCache.has(userId)) {
        return this.userRoleCache.get(userId) || [];
      }
      
      // Query database
      const userRolesQuery = query(
        collection(db, 'user_roles'), 
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const userRolesSnapshot = await getDocs(userRolesQuery);
      const roles = userRolesSnapshot.docs.map(doc => doc.data().roleId);
      
      // Cache the result
      this.userRoleCache.set(userId, roles);
      
      return roles;
    } catch (error) {
      console.error('Failed to get user roles:', error);
      return [];
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const userRoles = await this.getUserRoles(userId);
      const permissions = new Set<string>();
      
      for (const roleId of userRoles) {
        const role = this.roleCache.get(roleId);
        if (role && role.isActive) {
          role.permissions.forEach(permission => permissions.add(permission));
        }
      }
      
      return Array.from(permissions);
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string, expiresAt?: Date): Promise<void> {
    try {
      // Verify role exists
      const role = this.roleCache.get(roleId);
      if (!role || !role.isActive) {
        throw new Error('Invalid or inactive role');
      }
      
      // Create user role assignment
      const userRole: UserRole = {
        userId,
        roleId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        isActive: true
      };
      
      const userRoleId = `${userId}_${roleId}`;
      await setDoc(doc(db, 'user_roles', userRoleId), {
        ...userRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Clear user role cache
      this.userRoleCache.delete(userId);
      
      // Log role assignment
      await hipaaComplianceService.logAuditEvent({
        action: 'role_assignment',
        resourceType: 'user_role',
        resourceId: userRoleId,
        resourceName: `Role ${roleId} assigned to user ${userId}`,
        actionType: 'create',
        actionResult: 'success',
        actionReason: `Role assignment by ${assignedBy}`
      });
      
      console.log(`✅ Role ${roleId} assigned to user ${userId}`);
    } catch (error) {
      console.error('Failed to assign role to user:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string, removedBy: string): Promise<void> {
    try {
      const userRoleId = `${userId}_${roleId}`;
      
      await updateDoc(doc(db, 'user_roles', userRoleId), {
        isActive: false,
        removedBy,
        removedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Clear user role cache
      this.userRoleCache.delete(userId);
      
      // Log role removal
      await hipaaComplianceService.logAuditEvent({
        action: 'role_assignment',
        resourceType: 'user_role',
        resourceId: userRoleId,
        resourceName: `Role ${roleId} removed from user ${userId}`,
        actionType: 'update',
        actionResult: 'success',
        actionReason: `Role removal by ${removedBy}`
      });
      
      console.log(`✅ Role ${roleId} removed from user ${userId}`);
    } catch (error) {
      console.error('Failed to remove role from user:', error);
      throw error;
    }
  }

  /**
   * Create new permission
   */
  async createPermission(permission: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const permissionId = `${permission.resource}:${permission.action}`;
      
      await setDoc(doc(db, 'permissions', permissionId), {
        ...permission,
        id: permissionId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update cache
      this.permissionCache.set(permissionId, {
        ...permission,
        id: permissionId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Permission ${permissionId} created successfully`);
      return permissionId;
    } catch (error) {
      console.error('Failed to create permission:', error);
      throw error;
    }
  }

  /**
   * Create new role
   */
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const roleId = role.name;
      
      await setDoc(doc(db, 'roles', roleId), {
        ...role,
        id: roleId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update cache
      this.roleCache.set(roleId, {
        ...role,
        id: roleId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Role ${roleId} created successfully`);
      return roleId;
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    try {
      for (const [key, expectedValue] of Object.entries(conditions)) {
        const actualValue = context[key];
        
        if (actualValue === undefined) {
          return false;
        }
        
        if (typeof expectedValue === 'function') {
          if (!expectedValue(actualValue)) {
            return false;
          }
        } else if (actualValue !== expectedValue) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to evaluate conditions:', error);
      return false;
    }
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissionCache.values());
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roleCache.values());
  }

  /**
   * Check if permission exists
   */
  permissionExists(permissionId: string): boolean {
    return this.permissionCache.has(permissionId);
  }

  /**
   * Check if role exists
   */
  roleExists(roleId: string): boolean {
    return this.roleCache.has(roleId);
  }

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<void> {
    this.permissionCache.clear();
    this.roleCache.clear();
    this.userRoleCache.clear();
    
    await this.loadPermissionsIntoCache();
    await this.loadRolesIntoCache();
    
    console.log('✅ Permission cache refreshed');
  }
}

// Export singleton instance
export const permissionService = PermissionService.getInstance();

// Export utility functions
export const checkPermission = (userId: string, permission: string, context?: Record<string, any>) => 
  permissionService.checkPermission(userId, permission, context);

export const canPerformAction = (userId: string, resource: string, action: string, context?: Record<string, any>) => 
  permissionService.canPerformAction(userId, resource, action, context);

export const getUserRoles = (userId: string) => permissionService.getUserRoles(userId);
export const getUserPermissions = (userId: string) => permissionService.getUserPermissions(userId);



