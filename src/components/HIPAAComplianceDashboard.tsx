import React, { useState, useEffect } from 'react';
import { hipaaComplianceService } from '../services/hipaa-compliance.service';
import { auth } from '../config/firebase';

const HIPAAComplianceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [complianceScore, setComplianceScore] = useState(0);
  const [violations, setViolations] = useState(0);
  const [auditEvents, setAuditEvents] = useState(0);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
      
      const report = await hipaaComplianceService.generateComplianceReport(startDate, endDate);
      setComplianceScore(report.overallComplianceScore);
      setViolations(report.totalViolations);
      setAuditEvents(report.totalDataAccess || 0);
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading compliance data...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">HIPAA Compliance Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Compliance Score</p>
              <p className="text-3xl font-bold text-blue-900">{complianceScore}%</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Violations</p>
              <p className="text-3xl font-bold text-red-900">{violations}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Audit Events</p>
              <p className="text-3xl font-bold text-green-900">{auditEvents}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={loadComplianceData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default HIPAAComplianceDashboard;
