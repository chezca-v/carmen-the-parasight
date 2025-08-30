import React, { useState, useEffect, useCallback } from 'react';
import { 
  PatientConsent, 
  ConsentType, 
  ConsentStatus, 
  DataCategory,
  ConsentScope 
} from '../types/hipaa';
import { hipaaComplianceService } from '../services/hipaa-compliance.service';
import { auth } from '../config/firebase';
import { User } from 'firebase/auth';

interface PatientConsentManagerProps {
  patientId: string;
  patientName: string;
  onConsentChange?: (consentId: string, status: ConsentStatus) => void;
  readOnly?: boolean;
}

const PatientConsentManager: React.FC<PatientConsentManagerProps> = ({
  patientId,
  patientName,
  onConsentChange,
  readOnly = false
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<PatientConsent | null>(null);
  const [formData, setFormData] = useState({
    consentType: 'treatment' as ConsentType,
    dataCategories: [] as string[],
    thirdPartySharing: false,
    marketingConsent: false,
    researchConsent: false,
    facilities: [] as string[],
    providers: [] as string[],
    services: [] as string[],
    timeLimit: 365,
    geographicScope: 'local' as 'local' | 'regional' | 'national'
  });

  // Predefined data categories for healthcare
  const dataCategories: DataCategory[] = [
    {
      category: 'demographic',
      description: 'Basic patient information',
      examples: ['Name', 'Date of birth', 'Address', 'Phone number'],
      sensitivity: 'low',
      requiresExplicitConsent: false
    },
    {
      category: 'medical_history',
      description: 'Medical history and conditions',
      examples: ['Diagnoses', 'Medications', 'Allergies', 'Family history'],
      sensitivity: 'high',
      requiresExplicitConsent: true
    },
    {
      category: 'treatment_plans',
      description: 'Current and past treatment plans',
      examples: ['Medications', 'Procedures', 'Therapies', 'Follow-up care'],
      sensitivity: 'high',
      requiresExplicitConsent: true
    },
    {
      category: 'lab_results',
      description: 'Laboratory test results',
      examples: ['Blood tests', 'Imaging', 'Pathology', 'Vital signs'],
      sensitivity: 'medium',
      requiresExplicitConsent: true
    },
    {
      category: 'billing',
      description: 'Financial and insurance information',
      examples: ['Insurance details', 'Payment history', 'Claims', 'Costs'],
      sensitivity: 'medium',
      requiresExplicitConsent: false
    }
  ];

  // Predefined consent types
  const consentTypes: { value: ConsentType; label: string; description: string }[] = [
    {
      value: 'treatment',
      label: 'Treatment',
      description: 'Consent for medical treatment and procedures'
    },
    {
      value: 'payment',
      label: 'Payment',
      description: 'Consent for billing and insurance processing'
    },
    {
      value: 'healthcare_operations',
      label: 'Healthcare Operations',
      description: 'Consent for quality improvement and administrative activities'
    },
    {
      value: 'marketing',
      label: 'Marketing',
      description: 'Consent for marketing communications and promotions'
    },
    {
      value: 'research',
      label: 'Research',
      description: 'Consent for participation in research studies'
    },
    {
      value: 'third_party',
      label: 'Third Party Sharing',
      description: 'Consent for sharing data with external organizations'
    }
  ];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        loadConsents();
      }
    });

    return () => unsubscribe();
  }, [patientId]);

  const loadConsents = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, you would fetch consents from the service
      // For now, we'll simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load consents:', error);
      setLoading(false);
    }
  }, [patientId]);

  const handleCreateConsent = async () => {
    try {
      if (!currentUser) {
        alert('You must be logged in to create consent');
        return;
      }

      const consentData = {
        patientId,
        consentType: formData.consentType,
        status: 'pending' as ConsentStatus,
        grantedAt: new Date(),
        scope: {
          facilities: formData.facilities,
          providers: formData.providers,
          services: formData.services,
          timeLimit: formData.timeLimit,
          geographicScope: formData.geographicScope
        } as ConsentScope,
        dataCategories: formData.dataCategories.map(cat => ({
          category: cat,
          description: dataCategories.find(dc => dc.category === cat)?.description || '',
          examples: dataCategories.find(dc => dc.category === cat)?.examples || [],
          sensitivity: dataCategories.find(dc => dc.category === cat)?.sensitivity || 'low',
          requiresExplicitConsent: dataCategories.find(dc => dc.category === cat)?.requiresExplicitConsent || false
        })),
        thirdPartySharing: formData.thirdPartySharing,
        marketingConsent: formData.marketingConsent,
        researchConsent: formData.researchConsent,
        hipaaNoticeProvided: true,
        hipaaNoticeDate: new Date(),
        patientSignature: 'patient_signature_hash', // In real app, this would be captured
        createdBy: currentUser.uid
      };

      const consentId = await hipaaComplianceService.createPatientConsent(consentData);
      
      // Reset form and close
      setShowConsentForm(false);
      setFormData({
        consentType: 'treatment',
        dataCategories: [],
        thirdPartySharing: false,
        marketingConsent: false,
        researchConsent: false,
        facilities: [],
        providers: [],
        services: [],
        timeLimit: 365,
        geographicScope: 'local'
      });

      // Reload consents
      await loadConsents();

      if (onConsentChange) {
        onConsentChange(consentId, 'pending');
      }

      alert('Consent created successfully');
    } catch (error) {
      console.error('Failed to create consent:', error);
      alert('Failed to create consent. Please try again.');
    }
  };

  const handleRevokeConsent = async (consentId: string) => {
    try {
      const reason = prompt('Please provide a reason for revoking this consent:');
      if (!reason) return;

      await hipaaComplianceService.revokePatientConsent(
        consentId, 
        reason, 
        currentUser?.uid || 'system'
      );

      // Reload consents
      await loadConsents();

      if (onConsentChange) {
        onConsentChange(consentId, 'revoked');
      }

      alert('Consent revoked successfully');
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      alert('Failed to revoke consent. Please try again.');
    }
  };

  const handleEditConsent = (consent: PatientConsent) => {
    setSelectedConsent(consent);
    setFormData({
      consentType: consent.consentType,
      dataCategories: consent.dataCategories.map(dc => dc.category),
      thirdPartySharing: consent.thirdPartySharing,
      marketingConsent: consent.marketingConsent,
      researchConsent: consent.researchConsent,
      facilities: consent.scope.facilities,
      providers: consent.scope.providers,
      services: consent.scope.services,
      timeLimit: consent.scope.timeLimit || 365,
      geographicScope: consent.scope.geographicScope
    });
    setShowConsentForm(true);
  };

  const getConsentStatusColor = (status: ConsentStatus): string => {
    switch (status) {
      case 'granted': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'revoked': return 'text-gray-600 bg-gray-100';
      case 'suspended': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConsentStatusIcon = (status: ConsentStatus): string => {
    switch (status) {
      case 'granted': return '✅';
      case 'pending': return '⏳';
      case 'expired': return '⏰';
      case 'revoked': return '❌';
      case 'suspended': return '⏸️';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading consents...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient Consent Management</h2>
          <p className="text-gray-600 mt-1">Manage HIPAA-compliant consent for {patientName}</p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowConsentForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <span className="mr-2">+</span>
            New Consent
          </button>
        )}
      </div>

      {/* Consent List */}
      <div className="space-y-4 mb-6">
        {consents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <p>No consents found for this patient</p>
            <p className="text-sm">Create a new consent to get started</p>
          </div>
        ) : (
          consents.map((consent) => (
            <div key={consent.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConsentStatusColor(consent.status)}`}>
                      {getConsentStatusIcon(consent.status)} {consent.status}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      Version {consent.version}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 capitalize">
                    {consent.consentType.replace('_', ' ')} Consent
                  </h3>
                  
                  <div className="text-sm text-gray-600 mt-1">
                    <p>Granted: {consent.grantedAt.toLocaleDateString()}</p>
                    {consent.expiresAt && (
                      <p>Expires: {consent.expiresAt.toLocaleDateString()}</p>
                    )}
                    {consent.revokedAt && (
                      <p className="text-red-600">Revoked: {consent.revokedAt.toLocaleDateString()}</p>
                    )}
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Data Categories:</h4>
                    <div className="flex flex-wrap gap-1">
                      {consent.dataCategories.map((dc, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {dc.category}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <p>Third Party Sharing: {consent.thirdPartySharing ? 'Yes' : 'No'}</p>
                    <p>Marketing: {consent.marketingConsent ? 'Yes' : 'No'}</p>
                    <p>Research: {consent.researchConsent ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {!readOnly && consent.status === 'granted' && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleEditConsent(consent)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRevokeConsent(consent.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Consent Form Modal */}
      {showConsentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {selectedConsent ? 'Edit Consent' : 'New Consent'}
              </h3>
              <button
                onClick={() => {
                  setShowConsentForm(false);
                  setSelectedConsent(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateConsent(); }}>
              <div className="space-y-4">
                {/* Consent Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Consent Type *
                  </label>
                  <select
                    value={formData.consentType}
                    onChange={(e) => setFormData({ ...formData, consentType: e.target.value as ConsentType })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {consentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Categories *
                  </label>
                  <div className="space-y-2">
                    {dataCategories.map((category) => (
                      <label key={category.category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.dataCategories.includes(category.category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                dataCategories: [...formData.dataCategories, category.category]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                dataCategories: formData.dataCategories.filter(c => c !== category.category)
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          <strong>{category.category}</strong> - {category.description}
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            category.sensitivity === 'critical' ? 'bg-red-100 text-red-800' :
                            category.sensitivity === 'high' ? 'bg-orange-100 text-orange-800' :
                            category.sensitivity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {category.sensitivity} sensitivity
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Additional Consents */}
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.thirdPartySharing}
                      onChange={(e) => setFormData({ ...formData, thirdPartySharing: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Allow sharing with third-party organizations</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.marketingConsent}
                      onChange={(e) => setFormData({ ...formData, marketingConsent: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Allow marketing communications</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.researchConsent}
                      onChange={(e) => setFormData({ ...formData, researchConsent: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Allow participation in research studies</span>
                  </label>
                </div>

                {/* Time Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Consent Duration (days)
                  </label>
                  <input
                    type="number"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 365 })}
                    min="1"
                    max="3650"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum 10 years (3650 days)
                  </p>
                </div>

                {/* Geographic Scope */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geographic Scope
                  </label>
                  <select
                    value={formData.geographicScope}
                    onChange={(e) => setFormData({ ...formData, geographicScope: e.target.value as 'local' | 'regional' | 'national' })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="local">Local (City/County)</option>
                    <option value="regional">Regional (State/Province)</option>
                    <option value="national">National</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowConsentForm(false);
                    setSelectedConsent(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {selectedConsent ? 'Update Consent' : 'Create Consent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientConsentManager;



