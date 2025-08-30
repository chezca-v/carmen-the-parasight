// HIPAA Compliance Type Definitions
// Defines all interfaces and types required for HIPAA-compliant healthcare data handling

export interface HIPAAComplianceConfig {
  // Data retention policies
  retentionPolicies: {
    patientRecords: number; // days
    auditLogs: number; // days
    consentRecords: number; // days
    deletedRecords: number; // days
  };
  
  // Encryption settings
  encryption: {
    algorithm: 'AES-256-GCM' | 'AES-256-CBC';
    keyRotationDays: number;
    requireEncryptionAtRest: boolean;
    requireEncryptionInTransit: boolean;
  };
  
  // Audit logging configuration
  auditLogging: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'comprehensive';
    retentionDays: number;
    realTimeAlerts: boolean;
  };
  
  // Consent management
  consentManagement: {
    requireExplicitConsent: boolean;
    consentExpirationDays: number;
    allowRevocation: boolean;
    requireReconsent: boolean;
  };
}

export interface PatientConsent {
  id: string;
  patientId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revokedReason?: string;
  
  // Consent details
  scope: ConsentScope;
  dataCategories: DataCategory[];
  thirdPartySharing: boolean;
  marketingConsent: boolean;
  researchConsent: boolean;
  
  // Legal compliance
  hipaaNoticeProvided: boolean;
  hipaaNoticeDate?: Date;
  patientSignature: string; // Encrypted signature hash
  witnessSignature?: string;
  
  // Audit trail
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  version: number;
}

export type ConsentType = 
  | 'treatment'
  | 'payment'
  | 'healthcare_operations'
  | 'marketing'
  | 'research'
  | 'third_party'
  | 'emergency';

export type ConsentStatus = 
  | 'pending'
  | 'granted'
  | 'expired'
  | 'revoked'
  | 'suspended';

export interface ConsentScope {
  facilities: string[]; // Facility IDs where consent applies
  providers: string[]; // Provider IDs where consent applies
  services: string[]; // Specific services covered
  timeLimit?: number; // Days until consent expires
  geographicScope: 'local' | 'regional' | 'national';
}

export interface DataCategory {
  category: string;
  description: string;
  examples: string[];
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  requiresExplicitConsent: boolean;
}

export interface HIPAAAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  userEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  
  // Action details
  actionType: 'create' | 'read' | 'update' | 'delete' | 'access' | 'export' | 'share';
  actionResult: 'success' | 'failure' | 'denied';
  actionReason?: string;
  
  // Data access details
  dataAccessed?: {
    fields: string[];
    recordCount: number;
    dataSensitivity: string;
  };
  
  // Security context
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  
  // Compliance tracking
  hipaaCompliant: boolean;
  complianceViolations?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Metadata
  correlationId: string;
  requestId: string;
  processingTime: number; // milliseconds
}

export type AuditAction = 
  | 'patient_record_access'
  | 'patient_record_modification'
  | 'consent_management'
  | 'data_export'
  | 'data_sharing'
  | 'user_authentication'
  | 'role_assignment'
  | 'system_configuration'
  | 'backup_restore'
  | 'data_deletion';

export interface HIPAAViolation {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  violationType: ViolationType;
  description: string;
  
  // Violation details
  userId?: string;
  userRole?: string;
  resourceType?: string;
  resourceId?: string;
  
  // Compliance impact
  hipaaSection: string;
  potentialPenalty: number;
  riskMitigation: string[];
  
  // Resolution
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  
  // Audit trail
  reportedBy: string;
  investigationNotes: string[];
  correctiveActions: string[];
}

export type ViolationType = 
  | 'unauthorized_access'
  | 'data_breach'
  | 'consent_violation'
  | 'retention_violation'
  | 'encryption_violation'
  | 'audit_failure'
  | 'access_control_failure'
  | 'data_disposal_violation';

export interface DataEncryptionMetadata {
  algorithm: string;
  keyId: string;
  keyVersion: number;
  encryptedAt: Date;
  iv: string; // Initialization vector
  tag?: string; // Authentication tag for GCM
  encryptedFields: string[];
  encryptionLevel: 'field' | 'record' | 'database';
}

export interface PatientDataAccessLog {
  id: string;
  patientId: string;
  accessTimestamp: Date;
  accessedBy: string;
  accessedByRole: string;
  accessType: 'view' | 'edit' | 'export' | 'share';
  
  // Data accessed
  dataFields: string[];
  recordCount: number;
  
  // Purpose and justification
  purpose: string;
  justification: string;
  consentVerified: boolean;
  consentId?: string;
  
  // Security context
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  
  // Compliance
  hipaaCompliant: boolean;
  riskAssessment: 'low' | 'medium' | 'high';
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionPeriod: number; // days
  retentionReason: string;
  legalBasis: string;
  disposalMethod: 'secure_deletion' | 'anonymization' | 'archival';
  disposalTrigger: 'time_based' | 'event_based' | 'consent_revocation';
  requiresAudit: boolean;
  lastReviewDate: Date;
  nextReviewDate: Date;
}

export interface HIPAAComplianceReport {
  id: string;
  reportDate: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  
  // Compliance metrics
  overallComplianceScore: number; // 0-100
  complianceStatus: 'compliant' | 'non_compliant' | 'at_risk';
  
  // Violations summary
  totalViolations: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  
  // Data access summary
  totalDataAccess: number;
  authorizedAccess: number;
  unauthorizedAccess: number;
  consentCompliance: number; // percentage
  
  // Recommendations
  recommendations: string[];
  priorityActions: string[];
  riskMitigation: string[];
  
  // Generated by
  generatedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
}



