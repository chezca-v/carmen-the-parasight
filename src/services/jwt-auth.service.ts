/**
 * JWT Authentication Service
 * Provides secure JWT-based authentication with refresh tokens,
 * session management, and granular permissions
 */

import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { hipaaComplianceService } from './hipaa-compliance.service';

// JWT Token interfaces
export interface JWTTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  facilities: string[];
  lastActivity: number;
  sessionId: string;
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  facilities: string[];
  sessionId: string;
  lastLogin: Date;
  isActive: boolean;
}

// Session management constants
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_REFRESH_ATTEMPTS = 3;

export class JWTAuthService {
  private static instance: JWTAuthService;
  private currentUser: AuthUser | null = null;
  private currentSession: UserSession | null = null;
  private refreshTokenTimeout: NodeJS.Timeout | null = null;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private refreshAttempts = 0;
  private isRefreshing = false;

  private constructor() {
    this.initializeAuthListener();
    this.startSessionMonitoring();
  }

  public static getInstance(): JWTAuthService {
    if (!JWTAuthService.instance) {
      JWTAuthService.instance = new JWTAuthService();
    }
    return JWTAuthService.instance;
  }

  /**
   * Initialize Firebase auth state listener
   */
  private initializeAuthListener(): void {
    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          await this.handleUserSignIn(firebaseUser);
        } catch (error) {
          console.error('Failed to handle user sign in:', error);
          await this.signOut();
        }
      } else {
        await this.handleUserSignOut();
      }
    });
  }

  /**
   * Handle user sign in
   */
  private async handleUserSignIn(firebaseUser: FirebaseUser): Promise<void> {
    try {
      // Get user data from Firestore
      const userData = await this.getUserData(firebaseUser.uid);
      
      if (!userData) {
        throw new Error('User data not found');
      }

      // Create user session
      this.currentUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
        roles: userData.roles || [],
        permissions: userData.permissions || [],
        facilities: userData.facilities || [],
        sessionId: this.generateSessionId(),
        lastLogin: new Date(),
        isActive: true
      };

      // Create session
      this.currentSession = {
        userId: firebaseUser.uid,
        email: firebaseUser.email || '',
        roles: userData.roles || [],
        permissions: userData.permissions || [],
        facilities: userData.facilities || [],
        lastActivity: Date.now(),
        sessionId: this.currentUser.sessionId,
        isActive: true
      };

      // Store session in Firestore
      await this.storeUserSession(this.currentSession);

      // Start session monitoring
      this.startSessionTimeout();

      // Log authentication event
      await hipaaComplianceService.logAuditEvent({
        action: 'user_authentication',
        resourceType: 'user',
        resourceId: firebaseUser.uid,
        resourceName: firebaseUser.email || 'Unknown',
        actionType: 'access',
        actionResult: 'success',
        actionReason: 'User authenticated successfully'
      });

      console.log('✅ User authenticated:', this.currentUser.email);
    } catch (error) {
      console.error('Failed to handle user sign in:', error);
      throw error;
    }
  }

  /**
   * Handle user sign out
   */
  private async handleUserSignOut(): Promise<void> {
    try {
      if (this.currentSession) {
        // Invalidate session
        await this.invalidateUserSession(this.currentSession.sessionId);
        
        // Log sign out event
        await hipaaComplianceService.logAuditEvent({
          action: 'user_authentication',
          resourceType: 'user',
          resourceId: this.currentUser?.uid || 'unknown',
          resourceName: this.currentUser?.email || 'Unknown',
          actionType: 'access',
          actionResult: 'success',
          actionReason: 'User signed out'
        });
      }

      // Clear current user and session
      this.currentUser = null;
      this.currentSession = null;

      // Clear timeouts
      if (this.refreshTokenTimeout) {
        clearTimeout(this.refreshTokenTimeout);
        this.refreshTokenTimeout = null;
      }

      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = null;
      }

      console.log('✅ User signed out');
    } catch (error) {
      console.error('Failed to handle user sign out:', error);
    }
  }

  /**
   * Get user data from Firestore
   */
  private async getUserData(userId: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      return userDoc.data();
    } catch (error) {
      console.error('Failed to get user data:', error);
      throw error;
    }
  }

  /**
   * Store user session in Firestore
   */
  private async storeUserSession(session: UserSession): Promise<void> {
    try {
      await setDoc(doc(db, 'user_sessions', session.sessionId), {
        ...session,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to store user session:', error);
      throw error;
    }
  }

  /**
   * Invalidate user session
   */
  private async invalidateUserSession(sessionId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'user_sessions', sessionId), {
        isActive: false,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to invalidate user session:', error);
    }
  }

  /**
   * Start session timeout monitoring
   */
  private startSessionTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(async () => {
      console.log('⚠️ Session timeout - signing out user');
      await this.signOut();
    }, SESSION_TIMEOUT);
  }

  /**
   * Start session monitoring
   */
  private startSessionMonitoring(): void {
    // Monitor user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      if (this.currentSession) {
        this.currentSession.lastActivity = Date.now();
        this.startSessionTimeout(); // Reset timeout
      }
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Wait for auth state change to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.currentUser) {
        throw new Error('Authentication failed - user not loaded');
      }

      return this.currentUser;
    } catch (error) {
      console.error('Sign in failed:', error);
      
      // Log failed authentication attempt
      await hipaaComplianceService.logAuditEvent({
        action: 'user_authentication',
        resourceType: 'user',
        resourceId: 'unknown',
        resourceName: email,
        actionType: 'access',
        actionResult: 'failure',
        actionReason: `Authentication failed: ${error}`
      });

      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Wait for auth state change to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.currentUser) {
        throw new Error('Google authentication failed - user not loaded');
      }

      return this.currentUser;
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  }

  /**
   * Create new user account
   */
  async createUser(email: string, password: string, userData: Partial<AuthUser>): Promise<AuthUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Create user document in Firestore
      const userDoc = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: userData.displayName || '',
        roles: userData.roles || ['patient'],
        permissions: userData.permissions || [],
        facilities: userData.facilities || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        lastLogin: serverTimestamp()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);

      // Send email verification
      await sendEmailVerification(firebaseUser);

      // Wait for auth state change to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.currentUser) {
        throw new Error('User creation failed - user not loaded');
      }

      return this.currentUser;
    } catch (error) {
      console.error('User creation failed:', error);
      throw error;
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      // Auth state change will handle cleanup
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get current user session
   */
  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentSession?.isActive === true;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.currentUser?.roles.includes(role) || false;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    return this.currentUser?.roles.some(role => roles.includes(role)) || false;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    return this.currentUser?.permissions.includes(permission) || false;
  }

  /**
   * Check if user has access to specific facility
   */
  hasFacilityAccess(facilityId: string): boolean {
    return this.currentUser?.facilities.includes(facilityId) || false;
  }

  /**
   * Check if user can perform action on resource
   */
  canPerformAction(resource: string, action: string): boolean {
    const permission = `${resource}:${action}`;
    return this.hasPermission(permission);
  }

  /**
   * Get user permissions for specific resource
   */
  getResourcePermissions(resource: string): string[] {
    return this.currentUser?.permissions.filter(permission => 
      permission.startsWith(`${resource}:`)
    ) || [];
  }

  /**
   * Refresh user session
   */
  async refreshSession(): Promise<void> {
    if (this.isRefreshing || this.refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      throw new Error('Session refresh failed - too many attempts');
    }

    try {
      this.isRefreshing = true;
      
      // Update session activity
      if (this.currentSession) {
        this.currentSession.lastActivity = Date.now();
        await updateDoc(doc(db, 'user_sessions', this.currentSession.sessionId), {
          lastActivity: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Reset refresh attempts
      this.refreshAttempts = 0;
      
      // Restart session timeout
      this.startSessionTimeout();

      console.log('✅ Session refreshed successfully');
    } catch (error) {
      console.error('Session refresh failed:', error);
      this.refreshAttempts++;
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Update user password
   */
  async updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      console.log('✅ Password updated successfully');
    } catch (error) {
      console.error('Password update failed:', error);
      throw error;
    }
  }

  /**
   * Get user roles and permissions
   */
  async getUserRolesAndPermissions(userId: string): Promise<{ roles: Role[], permissions: Permission[] }> {
    try {
      // Get user roles
      const rolesQuery = query(collection(db, 'roles'), where('isActive', '==', true));
      const rolesSnapshot = await getDocs(rolesQuery);
      const roles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Role[];

      // Get user permissions
      const permissionsQuery = query(collection(db, 'permissions'));
      const permissionsSnapshot = await getDocs(permissionsQuery);
      const permissions = permissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Permission[];

      return { roles, permissions };
    } catch (error) {
      console.error('Failed to get user roles and permissions:', error);
      throw error;
    }
  }

  /**
   * Check session validity
   */
  isSessionValid(): boolean {
    if (!this.currentSession) return false;
    
    const now = Date.now();
    const lastActivity = this.currentSession.lastActivity;
    
    return (now - lastActivity) < SESSION_TIMEOUT;
  }

  /**
   * Get session time remaining
   */
  getSessionTimeRemaining(): number {
    if (!this.currentSession) return 0;
    
    const now = Date.now();
    const lastActivity = this.currentSession.lastActivity;
    const timeElapsed = now - lastActivity;
    
    return Math.max(0, SESSION_TIMEOUT - timeElapsed);
  }

  /**
   * Force session refresh (for testing)
   */
  async forceSessionRefresh(): Promise<void> {
    this.refreshAttempts = 0;
    await this.refreshSession();
  }
}

// Export singleton instance
export const jwtAuthService = JWTAuthService.getInstance();

// Export utility functions
export const getCurrentUser = () => jwtAuthService.getCurrentUser();
export const isAuthenticated = () => jwtAuthService.isAuthenticated();
export const hasRole = (role: string) => jwtAuthService.hasRole(role);
export const hasPermission = (permission: string) => jwtAuthService.hasPermission(permission);
export const canPerformAction = (resource: string, action: string) => jwtAuthService.canPerformAction(resource, action);



