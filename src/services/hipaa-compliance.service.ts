import { 
  PatientConsent, 
  HIPAAAuditLog, 
  HIPAAViolation, 
  DataEncryptionMetadata,
  PatientDataAccessLog,
  HIPAAComplianceConfig,
  ConsentType,
  ConsentStatus,
  AuditAction,
  ViolationType
} from '../types/hipaa';
import { auth, db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';

/**
 * HIPAA Compliance Service
 * Handles all HIPAA compliance requirements including:
 * - Patient consent management
 * - Audit logging
 * - Data encryption
 * - Violation tracking
 * - Compliance reporting
 */
export class HIPAAComplianceService {
  private static instance: HIPAAComplianceService;
  private currentUser: User | null = null;
  private auditQueue: HIPAAAuditLog[] = [];
  private isProcessingAuditQueue = false;
  private config: HIPAAComplianceConfig;

  private constructor() {
    try {
      // Check if Firebase is available
      if (!db || !auth) {
        console.log('HIPAA service: Firebase not available, service will be limited');
        this.config = this.getDefaultConfig();
        return;
      }

      // Check if we're in a development environment or if user has proper permissions
      if (process.env.NODE_ENV === 'development') {
        console.log('HIPAA service: Development mode, initializing with limited functionality');
        this.config = this.getDefaultConfig();
        this.initializeAuthListener();
        this.startAuditQueueProcessor();
      } else {
        // In production, be more conservative
        console.log('HIPAA service: Production mode, checking permissions before initialization');
        this.config = this.getDefaultConfig();
        // Only initialize auth listener, don't start processors yet
        this.initializeAuthListener();
      }
    } catch (error) {
      console.log('HIPAA service: Failed to initialize:', error);
      this.config = this.getDefaultConfig();
    }
  }

  public static getInstance(): HIPAAComplianceService {
    if (!HIPAAComplianceService.instance) {
      HIPAAComplianceService.instance = new HIPAAComplianceService();
    }
    return HIPAAComplianceService.instance;
  }

  /**
   * Initialize authentication listener
   */
  private initializeAuthListener(): void {
    try {
      if (!auth) {
        console.log('HIPAA service: Firebase auth not available');
        return;
      }

      onAuthStateChanged(auth, (user) => {
        this.currentUser = user;
        if (user) {
          this.logAuditEvent({
            action: 'user_authentication',
            resourceType: 'user',
            resourceId: user.uid,
            resourceName: user.email || 'Unknown',
            actionType: 'access',
            actionResult: 'success',
            actionReason: 'User authenticated'
          });
        }
      });
    } catch (error) {
      console.log('HIPAA service: Failed to initialize auth listener:', error);
    }
  }

  /**
   * Get default HIPAA configuration
   */
  private getDefaultConfig(): HIPAAComplianceConfig {
    return {
      retentionPolicies: {
        patientRecords: 2555, // 7 years
        auditLogs: 2555, // 7 years
        consentRecords: 2555, // 7 years
        deletedRecords: 365 // 1 year
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        requireEncryptionAtRest: true,
        requireEncryptionInTransit: true
      },
      auditLogging: {
        enabled: true,
        logLevel: 'comprehensive',
        retentionDays: 2555,
        realTimeAlerts: true
      },
      consentManagement: {
        requireExplicitConsent: true,
        consentExpirationDays: 365,
        allowRevocation: true,
        requireReconsent: true
      }
    };
  }

  // ==================== CONSENT MANAGEMENT ====================

  /**
   * Create new patient consent
   */
  async createPatientConsent(consentData: Omit<PatientConsent, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    try {
      const consentId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const consent: PatientConsent = {
        ...consentData,
        id: consentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // Encrypt sensitive consent data
      const encryptedConsent = await this.encryptConsentData(consent);
      
      // Store in Firestore
      await setDoc(doc(db, 'patient_consents', consentId), {
        ...encryptedConsent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Log consent creation
      await this.logAuditEvent({
        action: 'consent_management',
        resourceType: 'patient_consent',
        resourceId: consentId,
        resourceName: `Consent for ${consentData.patientId}`,
        actionType: 'create',
        actionResult: 'success',
        actionReason: 'New patient consent created'
      });

      return consentId;
    } catch (error) {
      await this.handleComplianceViolation({
        violationType: 'consent_violation',
        severity: 'high',
        description: `Failed to create patient consent: ${error}`,
        hipaaSection: '164.520 - Notice of Privacy Practices'
      });
      throw error;
    }
  }

  /**
   * Get patient consent by ID
   */
  async getPatientConsent(consentId: string): Promise<PatientConsent | null> {
    try {
      const consentDoc = await getDoc(doc(db, 'patient_consents', consentId));
      
      if (!consentDoc.exists()) {
        return null;
      }

      const consentData = consentDoc.data();
      
      // Decrypt sensitive consent data
      const decryptedConsent = await this.decryptConsentData(consentData);
      
      // Log consent access
      await this.logAuditEvent({
        action: 'consent_management',
        resourceType: 'patient_consent',
        resourceId: consentId,
        resourceName: `Consent ${consentId}`,
        actionType: 'read',
        actionResult: 'success',
        actionReason: 'Consent accessed for review'
      });

      return decryptedConsent as PatientConsent;
    } catch (error) {
      await this.handleComplianceViolation({
        violationType: 'consent_violation',
        severity: 'medium',
        description: `Failed to retrieve patient consent: ${error}`,
        hipaaSection: '164.520 - Notice of Privacy Practices'
      });
      throw error;
    }
  }

  /**
   * Update patient consent
   */
  async updatePatientConsent(consentId: string, updates: Partial<PatientConsent>): Promise<void> {
    try {
      const consentRef = doc(db, 'patient_consents', consentId);
      const currentConsent = await getDoc(consentRef);
      
      if (!currentConsent.exists()) {
        throw new Error('Consent not found');
      }

      const currentData = currentConsent.data();
      const updatedConsent = {
        ...currentData,
        ...updates,
        updatedAt: new Date(),
        version: (currentData.version || 1) + 1
      };

      // Encrypt updated consent data
      const encryptedConsent = await this.encryptConsentData(updatedConsent);
      
      await updateDoc(consentRef, {
        ...encryptedConsent,
        updatedAt: serverTimestamp()
      });

      // Log consent update
      await this.logAuditEvent({
        action: 'consent_management',
        resourceType: 'patient_consent',
        resourceId: consentId,
        resourceName: `Consent ${consentId}`,
        actionType: 'update',
        actionResult: 'success',
        actionReason: 'Patient consent updated'
      });
    } catch (error) {
      await this.handleComplianceViolation({
        violationType: 'consent_violation',
        severity: 'medium',
        description: `Failed to update patient consent: ${error}`,
        hipaaSection: '164.520 - Notice of Privacy Practices'
      });
      throw error;
    }
  }

  /**
   * Revoke patient consent
   */
  async revokePatientConsent(consentId: string, reason: string, revokedBy: string): Promise<void> {
    try {
      const consentRef = doc(db, 'patient_consents', consentId);
      
      await updateDoc(consentRef, {
        status: 'revoked' as ConsentStatus,
        revokedAt: serverTimestamp(),
        revokedBy,
        revokedReason: reason,
        updatedAt: serverTimestamp()
      });

      // Log consent revocation
      await this.logAuditEvent({
        action: 'consent_management',
        resourceType: 'patient_consent',
        resourceId: consentId,
        resourceName: `Consent ${consentId}`,
        actionType: 'update',
        actionResult: 'success',
        actionReason: `Consent revoked: ${reason}`
      });
    } catch (error) {
      await this.handleComplianceViolation({
        violationType: 'consent_violation',
        severity: 'high',
        description: `Failed to revoke patient consent: ${error}`,
        hipaaSection: '164.520 - Notice of Privacy Practices'
      });
      throw error;
    }
  }

  // ==================== AUDIT LOGGING ====================

  /**
   * Log audit event
   */
  async logAuditEvent(auditData: Omit<HIPAAAuditLog, 'id' | 'timestamp' | 'userId' | 'userRole' | 'userEmail' | 'ipAddress' | 'userAgent' | 'sessionId' | 'correlationId' | 'requestId' | 'processingTime'>): Promise<void> {
    try {
      // Check if user is authenticated and has permission
      if (!this.currentUser?.uid) {
        console.log('HIPAA audit: User not authenticated, skipping audit log');
        return;
      }

      // Check if Firebase is available and user has write permissions
      if (!db) {
        console.log('HIPAA audit: Firebase not available, skipping audit log');
        return;
      }

      // Check if audit logging is enabled
      if (!this.config.auditLogging.enabled) {
        return;
      }

      // Only log critical events when not fully authenticated
      if (!this.currentUser.emailVerified && auditData.actionType !== 'critical') {
        console.log('HIPAA audit: User not fully verified, skipping non-critical audit log');
        return;
      }

      // Check if we're ready to process audits
      if (!this.isReady()) {
        console.log('HIPAA audit: Service not ready, skipping audit log');
        return;
      }

      const auditLog: HIPAAAuditLog = {
        ...auditData,
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: this.currentUser?.uid || 'anonymous',
        userRole: this.currentUser?.email || 'unknown',
        userEmail: this.currentUser?.email || 'unknown',
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId(),
        correlationId: this.generateCorrelationId(),
        requestId: this.generateRequestId(),
        processingTime: 0
      };

      // Add to queue for batch processing
      this.auditQueue.push(auditLog);

      // Process queue if not already processing
      if (!this.isProcessingAuditQueue) {
        this.processAuditQueue();
      }
    } catch (error) {
      console.warn('Failed to log audit event:', error);
      // Don't throw error to prevent breaking the main application flow
    }
  }

  /**
   * Process audit queue in batches
   */
  private async processAuditQueue(): Promise<void> {
    if (this.isProcessingAuditQueue || this.auditQueue.length === 0) {
      return;
    }

    // Check if Firebase is available
    if (!db) {
      console.log('HIPAA service: Firebase not available, skipping audit processing');
      return;
    }

    // Check if user is properly authenticated
    if (!this.currentUser?.uid || !this.currentUser?.emailVerified) {
      console.log('HIPAA service: User not properly authenticated, skipping audit processing');
      // Clear the queue to prevent accumulation
      this.auditQueue.length = 0;
      return;
    }

    // Do not perform a test write; instead attempt the batch commit below and
    // handle any permission errors gracefully to avoid noisy 400 errors.

    this.isProcessingAuditQueue = true;
    const batchSize = 500; // Firestore batch limit

    try {
      const batch = writeBatch(db);
      const batchToProcess = this.auditQueue.splice(0, batchSize);

      for (const auditLog of batchToProcess) {
        const auditRef = doc(collection(db, 'hipaa_audit_logs'));
        const payload = this.sanitizeForFirestore({
          ...auditLog,
          timestamp: serverTimestamp()
        });
        batch.set(auditRef, payload);
      }

      await batch.commit();

      // Process remaining items if any
      if (this.auditQueue.length > 0) {
        setTimeout(() => this.processAuditQueue(), 100);
      }
    } catch (error: any) {
      // Common case: permission errors or network issues. Avoid spamming the
      // console with low-signal logs and drain the queue to prevent retries.
      const message = (error && (error.message || error.code)) || 'unknown error';
      if (message && typeof message === 'string' && message.toLowerCase().includes('permission')) {
        console.log('HIPAA service: Firestore permission denied; clearing audit queue.');
      } else {
        console.warn('HIPAA service: Failed to process audit queue, clearing pending items:', message);
      }
      // Clear any items we attempted to process to avoid tight retry loops
      this.auditQueue.length = 0;
    } finally {
      this.isProcessingAuditQueue = false;
    }
  }

  /**
   * Start audit queue processor
   */
  private startAuditQueueProcessor(): void {
    try {
      if (!db) {
        console.log('HIPAA service: Firebase not available, audit processor disabled');
        return;
      }

      // Process queue every 5 seconds if there are items
      setInterval(() => {
        if (this.auditQueue.length > 0 && !this.isProcessingAuditQueue) {
          this.processAuditQueue();
        }
      }, 5000);
    } catch (error) {
      console.log('HIPAA service: Failed to start audit processor:', error);
    }
  }

  /**
   * Manually start audit processor (call this when you're sure user has permissions)
   */
  public startAuditProcessor(): void {
    if (this.currentUser?.uid && this.currentUser?.emailVerified) {
      console.log('HIPAA service: Starting audit processor for authenticated user');
      this.startAuditQueueProcessor();
    } else {
      console.log('HIPAA service: Cannot start audit processor - user not properly authenticated');
    }
  }

  /**
   * Check if service is ready to process audits
   */
  public isReady(): boolean {
    return !!(this.currentUser?.uid && this.currentUser?.emailVerified && db);
  }

  /**
   * Clear audit queue (useful when permissions are revoked)
   */
  public clearAuditQueue(): void {
    this.auditQueue.length = 0;
    this.isProcessingAuditQueue = false;
    console.log('HIPAA service: Audit queue cleared');
  }

  /**
   * Disable audit logging temporarily
   */
  public disableAuditLogging(): void {
    this.config.auditLogging.enabled = false;
    this.clearAuditQueue();
    console.log('HIPAA service: Audit logging disabled');
  }

  /**
   * Enable audit logging
   */
  public enableAuditLogging(): void {
    this.config.auditLogging.enabled = true;
    console.log('HIPAA service: Audit logging enabled');
  }

  // ==================== COMPLIANCE VIOLATIONS ====================

  /**
   * Handle compliance violation
   */
  async handleComplianceViolation(violationData: Omit<HIPAAViolation, 'id' | 'timestamp' | 'reportedBy' | 'investigationNotes' | 'correctiveActions'>): Promise<string> {
    try {
      const violationId = `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const violation: HIPAAViolation = {
        ...violationData,
        id: violationId,
        timestamp: new Date(),
        reportedBy: this.currentUser?.uid || 'system',
        investigationNotes: [],
        correctiveActions: []
      };

      // Store violation
      await setDoc(doc(db, 'hipaa_violations', violationId), {
        ...violation,
        timestamp: serverTimestamp()
      });

      // Log violation
      await this.logAuditEvent({
        action: 'system_configuration',
        resourceType: 'compliance_violation',
        resourceId: violationId,
        resourceName: `HIPAA Violation: ${violationData.violationType}`,
        actionType: 'create',
        actionResult: 'success',
        actionReason: 'Compliance violation detected and logged'
      });

      // Send real-time alert if configured
      if (this.config.auditLogging.realTimeAlerts && violationData.severity === 'critical') {
        await this.sendViolationAlert(violation);
      }

      return violationId;
    } catch (error) {
      console.error('Failed to handle compliance violation:', error);
      throw error;
    }
  }

  // ==================== DATA ENCRYPTION ====================

  /**
   * Encrypt consent data
   */
  private async encryptConsentData(consent: PatientConsent): Promise<any> {
    // In a real implementation, this would use proper encryption
    // For now, we'll simulate encryption by hashing sensitive fields
    const sensitiveFields = ['patientSignature', 'witnessSignature'];
    
    const encryptedConsent = { ...consent };
    
    for (const field of sensitiveFields) {
      if (encryptedConsent[field]) {
        encryptedConsent[field] = await this.hashData(encryptedConsent[field]);
      }
    }

    return encryptedConsent;
  }

  /**
   * Decrypt consent data
   */
  private async decryptConsentData(encryptedData: any): Promise<any> {
    // In a real implementation, this would decrypt the data
    // For now, we'll return the data as-is since we're only hashing
    return encryptedData;
  }

  /**
   * Hash sensitive data
   */
  private async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get client IP address
   */
  private async getClientIP(): Promise<string> {
    try {
      // Try to get IP from a CSP-compliant service first
      const response = await fetch('https://api64.ipify.org?format=json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.ip || 'unknown';
      }
    } catch (error) {
      console.warn('Failed to get IP from primary service:', error);
    }

    try {
      // Fallback to a different service that might be CSP-compliant
      const response = await fetch('https://httpbin.org/ip', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.origin || 'unknown';
      }
    } catch (error) {
      console.warn('Failed to get IP from fallback service:', error);
    }

    // Final fallback - return a placeholder
    return 'unknown';
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    return sessionStorage.getItem('session_id') || 'unknown';
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Remove undefined values recursively to satisfy Firestore constraints
   */
  private sanitizeForFirestore(value: any): any {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      const sanitizedArray = value
        .map((item) => this.sanitizeForFirestore(item))
        .filter((item) => item !== undefined);
      return sanitizedArray;
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const sanitized = this.sanitizeForFirestore(v);
      if (sanitized !== undefined) {
        result[k] = sanitized;
      }
    }
    return result;
  }

  /**
   * Send violation alert
   */
  private async sendViolationAlert(violation: HIPAAViolation): Promise<void> {
    // In a real implementation, this would send alerts via email, Slack, etc.
    console.warn('CRITICAL HIPAA VIOLATION DETECTED:', violation);
    
    // You could integrate with services like:
    // - SendGrid for email alerts
    // - Slack webhooks for team notifications
    // - PagerDuty for on-call alerts
  }

  // ==================== PUBLIC INTERFACE ====================

  /**
   * Get HIPAA configuration
   */
  getConfig(): HIPAAComplianceConfig {
    return this.config;
  }

  /**
   * Update HIPAA configuration
   */
  async updateConfig(newConfig: Partial<HIPAAComplianceConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Log configuration change
    await this.logAuditEvent({
      action: 'system_configuration',
      resourceType: 'hipaa_config',
      resourceId: 'config',
      resourceName: 'HIPAA Configuration',
      actionType: 'update',
      actionResult: 'success',
      actionReason: 'HIPAA configuration updated'
    });
  }

  /**
   * Check if user has consent for specific data access
   */
  async checkDataAccessConsent(patientId: string, dataCategory: string, purpose: string): Promise<boolean> {
    try {
      const consentsQuery = query(
        collection(db, 'patient_consents'),
        where('patientId', '==', patientId),
        where('status', '==', 'granted'),
        where('dataCategories', 'array-contains', dataCategory)
      );

      const consentDocs = await getDocs(consentsQuery);
      
      if (consentDocs.empty) {
        return false;
      }

      // Check if consent is still valid
      const now = new Date();
      for (const consentDoc of consentDocs.docs) {
        const consent = consentDoc.data();
        if (!consent.expiresAt || new Date(consent.expiresAt.toDate()) > now) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to check data access consent:', error);
      return false;
    }
  }

  /**
   * Generate HIPAA compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Query audit logs for the period
      const auditQuery = query(
        collection(db, 'hipaa_audit_logs'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const auditDocs = await getDocs(auditQuery);
      
      // Query violations for the period
      const violationsQuery = query(
        collection(db, 'hipaa_violations'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const violationDocs = await getDocs(violationsQuery);

      // Calculate compliance metrics
      const totalAuditEvents = auditDocs.size;
      const totalViolations = violationDocs.size;
      const criticalViolations = violationDocs.docs.filter(doc => doc.data().severity === 'critical').length;
      const highViolations = violationDocs.docs.filter(doc => doc.data().severity === 'high').length;

      const complianceScore = Math.max(0, 100 - (totalViolations * 10) - (criticalViolations * 20) - (highViolations * 10));

      return {
        reportDate: new Date(),
        reportPeriod: { startDate, endDate },
        overallComplianceScore: complianceScore,
        complianceStatus: complianceScore >= 80 ? 'compliant' : complianceScore >= 60 ? 'at_risk' : 'non_compliant',
        totalViolations,
        criticalViolations,
        highViolations,
        recommendations: this.generateRecommendations(totalViolations, criticalViolations, highViolations)
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(totalViolations: number, criticalViolations: number, highViolations: number): string[] {
    const recommendations: string[] = [];

    if (criticalViolations > 0) {
      recommendations.push('Immediate action required: Investigate and resolve all critical violations');
    }

    if (highViolations > 0) {
      recommendations.push('High priority: Address high-severity violations within 24 hours');
    }

    if (totalViolations > 10) {
      recommendations.push('Review and strengthen access controls and monitoring procedures');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current compliance practices and continue monitoring');
    }

    return recommendations;
  }
}

// Export singleton instance
export const hipaaComplianceService = HIPAAComplianceService.getInstance();
