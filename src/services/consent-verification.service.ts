/**
 * Consent Verification Service for HIPAA Compliance
 * Ensures patient data is only accessible with proper consent verification
 */

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
  serverTimestamp
} from 'firebase/firestore';
import { 
  PatientConsent, 
  ConsentStatus, 
  ConsentType,
  DataCategory 
} from '../types/hipaa';

export interface ConsentVerificationRequest {
  patientId: string;
  requestingUserId: string;
  requestingUserRole: string;
  dataCategories: string[];
  purpose: string;
  facilityId?: string;
  providerId?: string;
  serviceType?: string;
  emergencyOverride?: boolean;
}

export interface ConsentVerificationResult {
  isConsentValid: boolean;
  consentId?: string;
  consentType: ConsentType;
  dataCategories: DataCategory[];
  expiresAt?: Date;
  restrictions?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  auditRequired: boolean;
  justification?: string;
}

export interface ConsentViolation {
  type: 'unauthorized_access' | 'consent_expired' | 'scope_violation' | 'purpose_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  patientId: string;
  requestingUserId: string;
  dataCategories: string[];
  timestamp: Date;
}

export class ConsentVerificationService {
  private static instance: ConsentVerificationService;
  private consentCache: Map<string, { consent: PatientConsent; expiresAt: number }> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ConsentVerificationService {
    if (!ConsentVerificationService.instance) {
      ConsentVerificationService.instance = new ConsentVerificationService();
    }
    return ConsentVerificationService.instance;
  }

  /**
   * Verify consent for data access
   */
  public async verifyConsent(request: ConsentVerificationRequest): Promise<ConsentVerificationResult> {
    try {
      console.log(`🔍 Verifying consent for patient ${request.patientId} by user ${request.requestingUserId}`);

      // Check for emergency override
      if (request.emergencyOverride) {
        return this.handleEmergencyAccess(request);
      }

      // Get active consents for the patient
      const activeConsents = await this.getActiveConsents(request.patientId);
      
      if (activeConsents.length === 0) {
        throw new Error('No active consent found for patient');
      }

      // Find the most appropriate consent
      const applicableConsent = this.findApplicableConsent(activeConsents, request);
      
      if (!applicableConsent) {
        throw new Error('No applicable consent found for requested data access');
      }

      // Verify consent scope and purpose
      const verificationResult = this.verifyConsentScope(applicableConsent, request);
      
      if (!verificationResult.isConsentValid) {
        // Log consent violation
        await this.logConsentViolation({
          type: 'scope_violation',
          severity: 'high',
          description: `Consent scope violation: ${verificationResult.justification}`,
          patientId: request.patientId,
          requestingUserId: request.requestingUserId,
          dataCategories: request.dataCategories,
          timestamp: new Date()
        });
      }

      // Cache the consent for future use
      this.cacheConsent(request.patientId, applicableConsent);

      return verificationResult;
    } catch (error) {
      console.error('❌ Consent verification failed:', error);
      
      // Log consent violation
      await this.logConsentViolation({
        type: 'unauthorized_access',
        severity: 'critical',
        description: `Consent verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        patientId: request.patientId,
        requestingUserId: request.requestingUserId,
        dataCategories: request.dataCategories,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Get active consents for a patient
   */
  private async getActiveConsents(patientId: string): Promise<PatientConsent[]> {
    try {
      // Check cache first
      const cached = this.consentCache.get(patientId);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`📋 Using cached consent for patient ${patientId}`);
        return [cached.consent];
      }

      // Query Firestore for active consents
      const consentsRef = collection(db, 'patient_consents');
      const consentsQuery = query(
        consentsRef,
        where('patientId', '==', patientId),
        where('status', '==', 'granted'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const consentsSnapshot = await getDocs(consentsQuery);
      const consents: PatientConsent[] = [];

      consentsSnapshot.forEach(doc => {
        const consentData = doc.data();
        const consent: PatientConsent = {
          ...consentData,
          createdAt: consentData.createdAt?.toDate() || new Date(),
          updatedAt: consentData.updatedAt?.toDate() || new Date(),
          grantedAt: consentData.grantedAt?.toDate() || new Date(),
          expiresAt: consentData.expiresAt?.toDate(),
          hipaaNoticeDate: consentData.hipaaNoticeDate?.toDate(),
          revokedAt: consentData.revokedAt?.toDate()
        } as PatientConsent;

        // Check if consent is still valid
        if (this.isConsentValid(consent)) {
          consents.push(consent);
        }
      });

      console.log(`📋 Found ${consents.length} active consents for patient ${patientId}`);
      return consents;
    } catch (error) {
      console.error('❌ Failed to get active consents:', error);
      throw new Error('Failed to retrieve patient consents');
    }
  }

  /**
   * Check if consent is still valid
   */
  private isConsentValid(consent: PatientConsent): boolean {
    const now = new Date();
    
    // Check if consent has expired
    if (consent.expiresAt && consent.expiresAt < now) {
      return false;
    }

    // Check if consent has been revoked
    if (consent.status === 'revoked') {
      return false;
    }

    // Check if consent is suspended
    if (consent.status === 'suspended') {
      return false;
    }

    return true;
  }

  /**
   * Find the most applicable consent for the request
   */
  private findApplicableConsent(consents: PatientConsent[], request: ConsentVerificationRequest): PatientConsent | null {
    // Sort consents by priority (most specific first)
    const sortedConsents = consents.sort((a, b) => {
      // Emergency consents have highest priority
      if (a.consentType === 'emergency' && b.consentType !== 'emergency') return -1;
      if (b.consentType === 'emergency' && a.consentType !== 'emergency') return 1;
      
      // Treatment consents have high priority
      if (a.consentType === 'treatment' && b.consentType !== 'treatment') return -1;
      if (b.consentType === 'treatment' && a.consentType !== 'treatment') return 1;
      
      // More recent consents have higher priority
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Find the first consent that covers the request
    for (const consent of sortedConsents) {
      if (this.consentCoversRequest(consent, request)) {
        return consent;
      }
    }

    return null;
  }

  /**
   * Check if a consent covers the requested access
   */
  private consentCoversRequest(consent: PatientConsent, request: ConsentVerificationRequest): boolean {
    // Check facility scope
    if (request.facilityId && consent.scope.facilities.length > 0) {
      if (!consent.scope.facilities.includes(request.facilityId)) {
        return false;
      }
    }

    // Check provider scope
    if (request.providerId && consent.scope.providers.length > 0) {
      if (!consent.scope.providers.includes(request.providerId)) {
        return false;
      }
    }

    // Check service scope
    if (request.serviceType && consent.scope.services.length > 0) {
      if (!consent.scope.services.includes(request.serviceType)) {
        return false;
      }
    }

    // Check data categories
    const requestedCategories = new Set(request.dataCategories);
    const consentedCategories = new Set(consent.dataCategories.map(cat => cat.category));
    
    for (const category of requestedCategories) {
      if (!consentedCategories.has(category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verify consent scope and purpose
   */
  private verifyConsentScope(consent: PatientConsent, request: ConsentVerificationRequest): ConsentVerificationResult {
    try {
      // Check if consent covers all requested data categories
      const requestedCategories = new Set(request.dataCategories);
      const consentedCategories = consent.dataCategories.filter(cat => 
        requestedCategories.has(cat.category)
      );

      // Check for high-risk data categories
      const highRiskCategories = consentedCategories.filter(cat => 
        cat.sensitivity === 'high' || cat.sensitivity === 'critical'
      );

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (highRiskCategories.some(cat => cat.sensitivity === 'critical')) {
        riskLevel = 'critical';
      } else if (highRiskCategories.some(cat => cat.sensitivity === 'high')) {
        riskLevel = 'high';
      } else if (consentedCategories.some(cat => cat.sensitivity === 'medium')) {
        riskLevel = 'medium';
      }

      // Check if audit is required
      const auditRequired = riskLevel === 'high' || riskLevel === 'critical' || 
                           request.dataCategories.length > 5;

      // Check for restrictions
      const restrictions: string[] = [];
      if (consent.scope.geographicScope === 'local' && request.facilityId) {
        // Additional verification might be needed for local-only consents
      }

      return {
        isConsentValid: true,
        consentId: consent.id,
        consentType: consent.consentType,
        dataCategories: consentedCategories,
        expiresAt: consent.expiresAt,
        restrictions,
        riskLevel,
        auditRequired,
        justification: 'Consent verified successfully'
      };
    } catch (error) {
      console.error('❌ Consent scope verification failed:', error);
      return {
        isConsentValid: false,
        consentType: 'treatment',
        dataCategories: [],
        riskLevel: 'critical',
        auditRequired: true,
        justification: `Consent scope verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle emergency access
   */
  private handleEmergencyAccess(request: ConsentVerificationRequest): ConsentVerificationResult {
    console.warn(`🚨 Emergency access requested for patient ${request.patientId}`);
    
    return {
      isConsentValid: true,
      consentType: 'emergency',
      dataCategories: request.dataCategories.map(cat => ({
        category: cat,
        description: 'Emergency access',
        examples: [],
        sensitivity: 'high',
        requiresExplicitConsent: false
      })),
      riskLevel: 'critical',
      auditRequired: true,
      justification: 'Emergency access granted - requires immediate audit review'
    };
  }

  /**
   * Cache consent for performance
   */
  private cacheConsent(patientId: string, consent: PatientConsent): void {
    const expiresAt = Date.now() + this.cacheExpiry;
    this.consentCache.set(patientId, { consent, expiresAt });
    
    // Clean up expired cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.consentCache.entries()) {
      if (value.expiresAt < now) {
        this.consentCache.delete(key);
      }
    }
  }

  /**
   * Log consent violations
   */
  private async logConsentViolation(violation: ConsentViolation): Promise<void> {
    try {
      // Store violation in Firestore
      const violationsRef = collection(db, 'consent_violations');
      await setDoc(doc(violationsRef), {
        ...violation,
        timestamp: serverTimestamp(),
        status: 'open',
        reviewed: false
      });

      console.error(`🚨 Consent violation logged: ${violation.type} - ${violation.description}`);
      
      // In production, this would trigger alerts and notifications
      if (violation.severity === 'critical' || violation.severity === 'high') {
        await this.triggerViolationAlert(violation);
      }
    } catch (error) {
      console.error('❌ Failed to log consent violation:', error);
    }
  }

  /**
   * Trigger violation alerts
   */
  private async triggerViolationAlert(violation: ConsentViolation): Promise<void> {
    try {
      // Store alert in Firestore
      const alertsRef = collection(db, 'security_alerts');
      await setDoc(doc(alertsRef), {
        type: 'consent_violation',
        severity: violation.severity,
        description: violation.description,
        patientId: violation.patientId,
        userId: violation.requestingUserId,
        timestamp: serverTimestamp(),
        status: 'active',
        acknowledged: false
      });

      console.warn(`🚨 Security alert triggered for consent violation: ${violation.type}`);
    } catch (error) {
      console.error('❌ Failed to trigger violation alert:', error);
    }
  }

  /**
   * Check if user has emergency access privileges
   */
  public async hasEmergencyAccess(userId: string): Promise<boolean> {
    try {
      // Query user roles and permissions
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      const roles = userData.roles || [];
      const permissions = userData.permissions || [];

      // Check for emergency access roles
      const emergencyRoles = ['emergency_physician', 'emergency_nurse', 'emergency_responder'];
      const hasEmergencyRole = emergencyRoles.some(role => roles.includes(role));

      // Check for emergency access permissions
      const hasEmergencyPermission = permissions.includes('emergency_access') || 
                                   permissions.includes('break_glass');

      return hasEmergencyRole || hasEmergencyPermission;
    } catch (error) {
      console.error('❌ Failed to check emergency access:', error);
      return false;
    }
  }

  /**
   * Revoke consent
   */
  public async revokeConsent(consentId: string, reason: string, revokedBy: string): Promise<void> {
    try {
      const consentRef = doc(db, 'patient_consents', consentId);
      
      await updateDoc(consentRef, {
        status: 'revoked' as ConsentStatus,
        revokedAt: serverTimestamp(),
        revokedBy,
        revokedReason: reason,
        updatedAt: serverTimestamp()
      });

      // Remove from cache
      for (const [key, value] of this.consentCache.entries()) {
        if (value.consent.id === consentId) {
          this.consentCache.delete(key);
          break;
        }
      }

      console.log(`✅ Consent ${consentId} revoked successfully`);
    } catch (error) {
      console.error('❌ Failed to revoke consent:', error);
      throw error;
    }
  }

  /**
   * Get consent summary for a patient
   */
  public async getConsentSummary(patientId: string): Promise<{
    activeConsents: number;
    expiredConsents: number;
    revokedConsents: number;
    lastConsentDate?: Date;
    nextExpiryDate?: Date;
  }> {
    try {
      const consentsRef = collection(db, 'patient_consents');
      const consentsQuery = query(
        consentsRef,
        where('patientId', '==', patientId)
      );

      const consentsSnapshot = await getDocs(consentsQuery);
      let activeConsents = 0;
      let expiredConsents = 0;
      let revokedConsents = 0;
      let lastConsentDate: Date | undefined;
      let nextExpiryDate: Date | undefined;

      consentsSnapshot.forEach(doc => {
        const consentData = doc.data();
        const status = consentData.status;
        const createdAt = consentData.createdAt?.toDate();
        const expiresAt = consentData.expiresAt?.toDate();

        if (status === 'granted') {
          activeConsents++;
          if (createdAt && (!lastConsentDate || createdAt > lastConsentDate)) {
            lastConsentDate = createdAt;
          }
          if (expiresAt && (!nextExpiryDate || expiresAt < nextExpiryDate)) {
            nextExpiryDate = expiresAt;
          }
        } else if (status === 'expired') {
          expiredConsents++;
        } else if (status === 'revoked') {
          revokedConsents++;
        }
      });

      return {
        activeConsents,
        expiredConsents,
        revokedConsents,
        lastConsentDate,
        nextExpiryDate
      };
    } catch (error) {
      console.error('❌ Failed to get consent summary:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const consentVerificationService = ConsentVerificationService.getInstance();

// Export utility functions
export const verifyConsent = (request: ConsentVerificationRequest) => 
  consentVerificationService.verifyConsent(request);
export const hasEmergencyAccess = (userId: string) => 
  consentVerificationService.hasEmergencyAccess(userId);
export const revokeConsent = (consentId: string, reason: string, revokedBy: string) => 
  consentVerificationService.revokeConsent(consentId, reason, revokedBy);
export const getConsentSummary = (patientId: string) => 
  consentVerificationService.getConsentSummary(patientId);
