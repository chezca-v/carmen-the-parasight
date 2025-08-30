import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtAuthService, AuthUser, UserSession } from '../services/jwt-auth.service';

interface AuthContextType {
  // User state
  user: AuthUser | null;
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Authentication methods
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signInWithGoogle: () => Promise<AuthUser>;
  signUp: (email: string, password: string, userData: Partial<AuthUser>) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  
  // Session management
  refreshSession: () => Promise<void>;
  isSessionValid: () => boolean;
  getSessionTimeRemaining: () => number;
  
  // Permission checks
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  canPerformAction: (resource: string, action: string) => boolean;
  hasFacilityAccess: (facilityId: string) => boolean;
  
  // User management
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  getCurrentUser: () => AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const currentUser = jwtAuthService.getCurrentUser();
        const currentSession = jwtAuthService.getCurrentSession();
        
        setUser(currentUser);
        setSession(currentSession);
        
        // Set up auth state listener
        const checkAuthState = () => {
          const currentUser = jwtAuthService.getCurrentUser();
          const currentSession = jwtAuthService.getCurrentSession();
          
          setUser(currentUser);
          setSession(currentSession);
        };
        
        // Check auth state every 30 seconds
        const interval = setInterval(checkAuthState, 30000);
        
        setIsLoading(false);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setIsLoading(false);
      }
    };

    return initializeAuth();
  }, []);

  // Authentication methods
  const signIn = async (email: string, password: string): Promise<AuthUser> => {
    try {
      const authUser = await jwtAuthService.signInWithEmail(email, password);
      setUser(authUser);
      
      const currentSession = jwtAuthService.getCurrentSession();
      setSession(currentSession);
      
      return authUser;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signInWithGoogle = async (): Promise<AuthUser> => {
    try {
      const authUser = await jwtAuthService.signInWithGoogle();
      setUser(authUser);
      
      const currentSession = jwtAuthService.getCurrentSession();
      setSession(currentSession);
      
      return authUser;
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<AuthUser>): Promise<AuthUser> => {
    try {
      const authUser = await jwtAuthService.createUser(email, password, userData);
      setUser(authUser);
      
      const currentSession = jwtAuthService.getCurrentSession();
      setSession(currentSession);
      
      return authUser;
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await jwtAuthService.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  // Session management
  const refreshSession = async (): Promise<void> => {
    try {
      await jwtAuthService.refreshSession();
      
      // Update state after refresh
      const currentUser = jwtAuthService.getCurrentUser();
      const currentSession = jwtAuthService.getCurrentSession();
      
      setUser(currentUser);
      setSession(currentSession);
    } catch (error) {
      console.error('Session refresh failed:', error);
      throw error;
    }
  };

  const isSessionValid = (): boolean => {
    return jwtAuthService.isSessionValid();
  };

  const getSessionTimeRemaining = (): number => {
    return jwtAuthService.getSessionTimeRemaining();
  };

  // Permission checks
  const hasRole = (role: string): boolean => {
    return jwtAuthService.hasRole(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return jwtAuthService.hasAnyRole(roles);
  };

  const hasPermission = (permission: string): boolean => {
    return jwtAuthService.hasPermission(permission);
  };

  const canPerformAction = (resource: string, action: string): boolean => {
    return jwtAuthService.canPerformAction(resource, action);
  };

  const hasFacilityAccess = (facilityId: string): boolean => {
    return jwtAuthService.hasFacilityAccess(facilityId);
  };

  // User management
  const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await jwtAuthService.updateUserPassword(currentPassword, newPassword);
    } catch (error) {
      console.error('Password update failed:', error);
      throw error;
    }
  };

  const getCurrentUser = (): AuthUser | null => {
    return jwtAuthService.getCurrentUser();
  };

  const contextValue: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user && !!session?.isActive,
    isLoading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    refreshSession,
    isSessionValid,
    getSessionTimeRemaining,
    hasRole,
    hasAnyRole,
    hasPermission,
    canPerformAction,
    hasFacilityAccess,
    updatePassword,
    getCurrentUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utility hooks for common auth checks
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
};

export const useHasRole = (role: string): boolean => {
  const { hasRole } = useAuth();
  return hasRole(role);
};

export const useHasAnyRole = (roles: string[]): boolean => {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(roles);
};

export const useHasPermission = (permission: string): boolean => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};

export const useCanPerformAction = (resource: string, action: string): boolean => {
  const { canPerformAction } = useAuth();
  return canPerformAction(resource, action);
};

export const useHasFacilityAccess = (facilityId: string): boolean => {
  const { hasFacilityAccess } = useAuth();
  return hasFacilityAccess(facilityId);
};

export default AuthContext;



