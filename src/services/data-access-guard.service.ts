/**
 * Data Access Guard Service for HIPAA Compliance
 * Prevents unauthorized access to patient data and ensures proper consent verification
 */

import { consentVerificationService, ConsentVerificationRequest, ConsentVerificationResult } from './consent-verification.service';
import { encryptionService } from './encryption.service';
import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

export interface DataAccessRequest {
  userId: string;
  userRole: string;
  patientId: string;
  dataCategories: string[];
  purpose: string;
  facilityId?: string;
  providerId?: string;
  serviceType?: string;
  emergencyOverride?: boolean;
  accessType: 'view' | 'edit' | 'export' | 'share';
  justification?: string;
}

export interface DataAccessResult {
  isAccessAllowed: boolean;
  consentVerified: boolean;
  dataAccessible: string[];
  dataRestricted: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  auditRequired: boolean;
  restrictions?: string[];
  error?: string;
}

export interface DataAccessLog {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  patientId: string;
  dataCategories: string[];
  purpose: string;
  accessType: string;
  isAccessAllowed: boolean;
  consentVerified: boolean;
  riskLevel: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  justification?: string;
}

export class DataAccessGuardService {
  private static instance: DataAccessGuardService;
  private accessCache: Map<string, { result: DataAccessResult; expiresAt: number }> = new Map();
  private cacheExpiry = 2 * 60 * 1000; // 2 minutes

  private constructor() {}

  public static getInstance(): DataAccessGuardService {
    if (!DataAccessGuardService.instance) {
      DataAccessGuardService.instance = new DataAccessGuardService();
    }
    return DataAccessGuardService.instance;
  }

  /**
   * Verify data access with consent and authorization
   */
  public async verifyDataAccess(request: DataAccessRequest): Promise<DataAccessResult> {
    try {
      console.log(`🔒 Verifying data access for patient ${request.patientId} by user ${request.userId}`);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.accessCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`📋 Using cached access result for patient ${request.patientId}`);
        return cached.result;
      }

      // Step 1: Verify user authorization
      const isAuthorized = await this.verifyUserAuthorization(request);
      if (!isAuthorized.isAuthorized) {
        const result: DataAccessResult = {
          isAccessAllowed: false,
          consentVerified: false,
          dataAccessible: [],
          dataRestricted: request.dataCategories,
          riskLevel: 'critical',
          auditRequired: true,
          error: `User not authorized: ${isAuthorized.reason}`
        };

        // Log unauthorized access attempt
        await this.logDataAccess({
          ...request,
          isAccessAllowed: false,
          consentVerified: false,
          riskLevel: 'critical'
        });

        return result;
      }

      // Step 2: Verify consent
      const consentRequest: ConsentVerificationRequest = {
        patientId: request.patientId,
        requestingUserId: request.userId,
        requestingUserRole: request.userRole,
        dataCategories: request.dataCategories,
        purpose: request.purpose,
        facilityId: request.facilityId,
        providerId: request.providerId,
        serviceType: request.serviceType,
        emergencyOverride: request.emergencyOverride
      };

      const consentResult = await consentVerificationService.verifyConsent(consentRequest);

      if (!consentResult.isConsentValid) {
        const result: DataAccessResult = {
          isAccessAllowed: false,
          consentVerified: false,
          dataAccessible: [],
          dataRestricted: request.dataCategories,
          riskLevel: 'critical',
          auditRequired: true,
          error: `Consent verification failed: ${consentResult.justification}`
        };

        // Log consent violation
        await this.logDataAccess({
          ...request,
          isAccessAllowed: false,
          consentVerified: false,
          riskLevel: 'critical'
        });

        return result;
      }

      // Step 3: Check data sensitivity and restrictions
      const dataRestrictions = this.checkDataRestrictions(request.dataCategories, consentResult);

      // Step 4: Determine final access result
      const result: DataAccessResult = {
        isAccessAllowed: dataRestrictions.allowed.length > 0,
        consentVerified: true,
        dataAccessible: dataRestrictions.allowed,
        dataRestricted: dataRestrictions.restricted,
        riskLevel: consentResult.riskLevel,
        auditRequired: consentResult.auditRequired || dataRestrictions.auditRequired,
        restrictions: dataRestrictions.restrictionReasons
      };

      // Cache the result
      this.accessCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheExpiry
      });

      // Log successful access
      await this.logDataAccess({
        ...request,
        isAccessAllowed: result.isAccessAllowed,
        consentVerified: true,
        riskLevel: result.riskLevel
      });

      console.log(`✅ Data access verified for patient ${request.patientId}`);
      return result;
    } catch (error) {
      console.error('❌ Data access verification failed:', error);
      
      const result: DataAccessResult = {
        isAccessAllowed: false,
        consentVerified: false,
        dataAccessible: [],
        dataRestricted: request.dataCategories,
        riskLevel: 'critical',
        auditRequired: true,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      // Log failed verification
      await this.logDataAccess({
        ...request,
        isAccessAllowed: false,
        consentVerified: false,
        riskLevel: 'critical'
      });

      return result;
    }
  }

  /**
   * Verify user authorization for data access
   */
  private async verifyUserAuthorization(request: DataAccessRequest): Promise<{ isAuthorized: boolean; reason?: string }> {
    try {
      // Get user document
      const userDoc = await getDoc(doc(db, 'users', request.userId));
      if (!userDoc.exists()) {
        return { isAuthorized: false, reason: 'User not found' };
      }

      const userData = userDoc.data();
      const roles = userData.roles || [];
      const permissions = userData.permissions || [];

      // Check if user is active
      if (!userData.isActive) {
        return { isAuthorized: false, reason: 'User account is inactive' };
      }

      // Check for emergency access
      if (request.emergencyOverride) {
        const hasEmergencyAccess = await consentVerificationService.hasEmergencyAccess(request.userId);
        if (!hasEmergencyAccess) {
          return { isAuthorized: false, reason: 'User does not have emergency access privileges' };
        }
        return { isAuthorized: true };
      }

      // Check role-based access
      const requiredRoles = this.getRequiredRoles(request.dataCategories, request.accessType);
      const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
      
      if (!hasRequiredRole) {
        return { isAuthorized: false, reason: 'User does not have required role for this data access' };
      }

      // Check permissions
      const requiredPermissions = this.getRequiredPermissions(request.dataCategories, request.accessType);
      const hasRequiredPermissions = requiredPermissions.every(permission => 
        permissions.includes(permission)
      );

      if (!hasRequiredPermissions) {
        return { isAuthorized: false, reason: 'User does not have required permissions for this data access' };
      }

      // Check facility access if specified
      if (request.facilityId) {
        const userFacilities = userData.facilities || [];
        if (!userFacilities.includes(request.facilityId)) {
          return { isAuthorized: false, reason: 'User does not have access to this facility' };
        }
      }

      return { isAuthorized: true };
    } catch (error) {
      console.error('❌ User authorization check failed:', error);
      return { isAuthorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Get required roles for data categories and access type
   */
  private getRequiredRoles(dataCategories: string[], accessType: string): string[] {
    const baseRoles = ['healthcare_provider', 'nurse', 'doctor', 'administrator'];
    
    // Add specific roles based on data categories
    if (dataCategories.includes('mental_health')) {
      baseRoles.push('psychiatrist', 'psychologist', 'mental_health_specialist');
    }
    
    if (dataCategories.includes('substance_abuse')) {
      baseRoles.push('addiction_specialist', 'substance_abuse_counselor');
    }
    
    if (dataCategories.includes('genetic_information')) {
      baseRoles.push('genetic_counselor', 'geneticist');
    }
    
    // Add roles based on access type
    if (accessType === 'export') {
      baseRoles.push('data_analyst', 'researcher');
    }
    
    if (accessType === 'share') {
      baseRoles.push('care_coordinator', 'case_manager');
    }
    
    return baseRoles;
  }

  /**
   * Get required permissions for data categories and access type
   */
  private getRequiredPermissions(dataCategories: string[], accessType: string): string[] {
    const basePermissions = ['patient_data_access'];
    
    // Add specific permissions based on data categories
    if (dataCategories.includes('mental_health')) {
      basePermissions.push('mental_health_data_access');
    }
    
    if (dataCategories.includes('substance_abuse')) {
      basePermissions.push('substance_abuse_data_access');
    }
    
    if (dataCategories.includes('genetic_information')) {
      basePermissions.push('genetic_data_access');
    }
    
    // Add permissions based on access type
    if (accessType === 'edit') {
      basePermissions.push('patient_data_modify');
    }
    
    if (accessType === 'export') {
      basePermissions.push('data_export');
    }
    
    if (accessType === 'share') {
      basePermissions.push('data_sharing');
    }
    
    return basePermissions;
  }

  /**
   * Check data restrictions based on sensitivity and access type
   */
  private checkDataRestrictions(dataCategories: string[], consentResult: ConsentVerificationResult): {
    allowed: string[];
    restricted: string[];
    auditRequired: boolean;
    restrictionReasons: string[];
  } {
    const allowed: string[] = [];
    const restricted: string[] = [];
    const restrictionReasons: string[] = [];
    let auditRequired = false;

    for (const category of dataCategories) {
      const consentedCategory = consentResult.dataCategories.find(cat => cat.category === category);
      
      if (!consentedCategory) {
        restricted.push(category);
        restrictionReasons.push(`No consent for category: ${category}`);
        continue;
      }

      // Check sensitivity level
      if (consentedCategory.sensitivity === 'critical') {
        restricted.push(category);
        restrictionReasons.push(`Critical sensitivity data requires special authorization: ${category}`);
        auditRequired = true;
        continue;
      }

      // Check if explicit consent is required
      if (consentedCategory.requiresExplicitConsent) {
        // Additional verification might be needed here
        auditRequired = true;
      }

      allowed.push(category);
    }

    return {
      allowed,
      restricted,
      auditRequired: auditRequired || consentResult.auditRequired,
      restrictionReasons
    };
  }

  /**
   * Generate cache key for access results
   */
  private generateCacheKey(request: DataAccessRequest): string {
    return `${request.userId}_${request.patientId}_${request.dataCategories.sort().join('_')}_${request.accessType}`;
  }

  /**
   * Log data access for audit purposes
   */
  private async logDataAccess(logData: Omit<DataAccessLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent' | 'sessionId'>): Promise<void> {
    try {
      const accessLog: DataAccessLog = {
        ...logData,
        id: `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId()
      };

      // Store in Firestore
      const accessLogsRef = collection(db, 'data_access_logs');
      await setDoc(doc(accessLogsRef), {
        ...accessLog,
        timestamp: serverTimestamp()
      });

      console.log(`📝 Data access logged: ${logData.isAccessAllowed ? 'ALLOWED' : 'DENIED'} for patient ${logData.patientId}`);
    } catch (error) {
      console.error('❌ Failed to log data access:', error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Get client IP address
   */
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api64.ipify.org?format=json');
      if (response.ok) {
        const data = await response.json();
        return data.ip || 'unknown';
      }
    } catch (error) {
      console.warn('Failed to get client IP:', error);
    }
    return 'unknown';
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    return sessionStorage.getItem('session_id') || 'unknown';
  }

  /**
   * Clear access cache
   */
  public clearCache(): void {
    this.accessCache.clear();
    console.log('🧹 Data access cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    const entries = Array.from(this.accessCache.keys());
    return {
      size: this.accessCache.size,
      entries
    };
  }
}

// Export singleton instance
export const dataAccessGuardService = DataAccessGuardService.getInstance();

// Export utility functions
export const verifyDataAccess = (request: DataAccessRequest) => 
  dataAccessGuardService.verifyDataAccess(request);
export const clearDataAccessCache = () => dataAccessGuardService.clearCache();
export const getDataAccessCacheStats = () => dataAccessGuardService.getCacheStats();
