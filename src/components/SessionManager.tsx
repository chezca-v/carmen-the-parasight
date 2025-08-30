import React, { useState, useEffect, useCallback } from 'react';
import { jwtAuthService } from '../services/jwt-auth.service';

interface SessionManagerProps {
  children: React.ReactNode;
  warningThreshold?: number; // minutes before session expires
  onSessionExpired?: () => void;
  onSessionWarning?: () => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  children,
  warningThreshold = 5, // 5 minutes before expiry
  onSessionExpired,
  onSessionWarning
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check session status periodically
  useEffect(() => {
    const checkSession = () => {
      if (!jwtAuthService.isAuthenticated()) {
        return;
      }

      const remaining = jwtAuthService.getSessionTimeRemaining();
      const warningTime = warningThreshold * 60 * 1000; // Convert to milliseconds

      if (remaining <= 0) {
        // Session expired
        handleSessionExpired();
      } else if (remaining <= warningTime && !showWarning) {
        // Show warning
        setShowWarning(true);
        setTimeRemaining(remaining);
        onSessionWarning?.();
      } else if (remaining > warningTime) {
        // Clear warning if session was refreshed
        setShowWarning(false);
      }

      setTimeRemaining(remaining);
    };

    // Check immediately
    checkSession();

    // Check every 30 seconds
    const interval = setInterval(checkSession, 30000);

    return () => clearInterval(interval);
  }, [warningThreshold, showWarning, onSessionWarning]);

  // Update time remaining display
  useEffect(() => {
    if (!showWarning) return;

    const updateTime = () => {
      const remaining = jwtAuthService.getSessionTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        handleSessionExpired();
      }
    };

    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  const handleSessionExpired = useCallback(() => {
    setShowWarning(false);
    onSessionExpired?.();
    
    // Sign out user
    jwtAuthService.signOut();
  }, [onSessionExpired]);

  const handleRefreshSession = async () => {
    try {
      setIsRefreshing(true);
      await jwtAuthService.refreshSession();
      
      // Hide warning after successful refresh
      setShowWarning(false);
      console.log('✅ Session refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // If refresh fails, session might be invalid
      handleSessionExpired();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExtendSession = async () => {
    try {
      setIsRefreshing(true);
      await jwtAuthService.refreshSession();
      setShowWarning(false);
      console.log('✅ Session extended successfully');
    } catch (error) {
      console.error('Failed to extend session:', error);
      handleSessionExpired();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!jwtAuthService.isAuthenticated()) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      
      {/* Session Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Session Expiring Soon
                </h3>
                <p className="text-sm text-gray-500">
                  Your session will expire in {formatTime(timeRemaining)}
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-400">ℹ️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    For security reasons, your session will automatically expire due to inactivity. 
                    You can extend your session to continue working.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleExtendSession}
                disabled={isRefreshing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {isRefreshing ? 'Extending...' : 'Extend Session'}
              </button>
              
              <button
                onClick={handleRefreshSession}
                disabled={isRefreshing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
              </button>
            </div>

            <div className="mt-3 text-center">
              <button
                onClick={handleSessionExpired}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Sign out now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionManager;



