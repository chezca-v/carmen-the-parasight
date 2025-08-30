import React, { useState, useEffect } from 'react';
import { jwtAuthService } from '../services/jwt-auth.service';
import { permissionService, PermissionCheck } from '../services/permission.service';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredResource?: string;
  requiredAction?: string;
  requiredRoles?: string[];
  requiredFacility?: string;
  fallback?: React.ReactNode;
  onAccessDenied?: (reason: string) => void;
  context?: Record<string, any>;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  requiredResource,
  requiredAction,
  requiredRoles,
  requiredFacility,
  fallback,
  onAccessDenied,
  context = {}
}) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessReason, setAccessReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [requiredPermission, requiredResource, requiredAction, requiredRoles, requiredFacility, context]);

  const checkAccess = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated
      if (!jwtAuthService.isAuthenticated()) {
        setHasAccess(false);
        setAccessReason('User not authenticated');
        onAccessDenied?.('User not authenticated');
        return;
      }

      const currentUser = jwtAuthService.getCurrentUser();
      if (!currentUser) {
        setHasAccess(false);
        setAccessReason('User data not available');
        onAccessDenied?.('User data not available');
        return;
      }

      // Check required roles
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => 
          currentUser.roles.includes(role)
        );
        
        if (!hasRequiredRole) {
          setHasAccess(false);
          setAccessReason(`Required role not found. Required: ${requiredRoles.join(', ')}. User has: ${currentUser.roles.join(', ')}`);
          onAccessDenied?.(`Required role not found: ${requiredRoles.join(', ')}`);
          return;
        }
      }

      // Check required facility access
      if (requiredFacility) {
        if (!currentUser.facilities.includes(requiredFacility)) {
          setHasAccess(false);
          setAccessReason(`Access to facility ${requiredFacility} not granted`);
          onAccessDenied?.(`Access to facility ${requiredFacility} not granted`);
          return;
        }
      }

      // Check required permission
      if (requiredPermission) {
        const permissionCheck = await permissionService.checkPermission(
          currentUser.uid,
          requiredPermission,
          context
        );
        
        if (!permissionCheck.hasPermission) {
          setHasAccess(false);
          setAccessReason(permissionCheck.reason || 'Permission check failed');
          onAccessDenied?.(permissionCheck.reason || 'Permission check failed');
          return;
        }
      }

      // Check resource-action permission
      if (requiredResource && requiredAction) {
        const actionCheck = await permissionService.canPerformAction(
          currentUser.uid,
          requiredResource,
          requiredAction,
          context
        );
        
        if (!actionCheck.hasPermission) {
          setHasAccess(false);
          setAccessReason(actionCheck.reason || 'Action not permitted');
          onAccessDenied?.(actionCheck.reason || 'Action not permitted');
          return;
        }
      }

      // All checks passed
      setHasAccess(true);
      setAccessReason('Access granted');
      
    } catch (error) {
      console.error('Permission check failed:', error);
      setHasAccess(false);
      setAccessReason('Permission check failed');
      onAccessDenied?.('Permission check failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Checking permissions...</span>
      </div>
    );
  }

  // Show fallback or access denied message
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-red-400">🚫</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Access Denied
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {accessReason}
            </p>
            <div className="mt-3">
              <button
                onClick={checkAccess}
                className="text-sm text-red-600 hover:text-red-500 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Access granted
  return <>{children}</>;
};

// Higher-order component for permission-based routing
export const withPermission = <P extends object>(
  Component: React.ComponentType<P>,
  permissionProps: Omit<PermissionGuardProps, 'children'>
) => {
  return (props: P) => (
    <PermissionGuard {...permissionProps}>
      <Component {...props} />
    </PermissionGuard>
  );
};

// Utility components for common permission checks
export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export const DoctorOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['doctor', 'admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export const NurseOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['nurse', 'doctor', 'admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export const PatientOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['patient', 'doctor', 'nurse', 'admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export const ComplianceOfficerOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['compliance_officer', 'admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export const FacilityAdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionGuard requiredRoles={['facility_admin', 'admin', 'system_admin']}>
    {children}
  </PermissionGuard>
);

export default PermissionGuard;



