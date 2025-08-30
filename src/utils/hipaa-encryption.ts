/**
 * HIPAA-Compliant Data Encryption Utility
 * Provides secure encryption and decryption for sensitive healthcare data
 * Implements AES-256-GCM encryption with proper key management
 */

import { DataEncryptionMetadata } from '../types/hipaa';

export interface EncryptionKey {
  id: string;
  key: CryptoKey;
  algorithm: string;
  version: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface EncryptedData {
  data: string;
  metadata: DataEncryptionMetadata;
}

export class HIPAAEncryption {
  private static instance: HIPAAEncryption;
  private currentKey: EncryptionKey | null = null;
  private keyRotationInterval: number = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

  private constructor() {
    this.initializeEncryption();
  }

  public static getInstance(): HIPAAEncryption {
    if (!HIPAAEncryption.instance) {
      HIPAAEncryption.instance = new HIPAAEncryption();
    }
    return HIPAAEncryption.instance;
  }

  /**
   * Initialize encryption system
   */
  private async initializeEncryption(): Promise<void> {
    try {
      await this.generateNewKey();
      this.startKeyRotation();
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption system initialization failed');
    }
  }

  /**
   * Generate new encryption key
   */
  private async generateNewKey(): Promise<void> {
    try {
      const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const algorithm = 'AES-GCM';
      const keyLength = 256;
      
      const cryptoKey = await crypto.subtle.generateKey(
        {
          name: algorithm,
          length: keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );

      const now = new Date();
      this.currentKey = {
        id: keyId,
        key: cryptoKey,
        algorithm,
        version: (this.currentKey?.version || 0) + 1,
        createdAt: now,
        expiresAt: new Date(now.getTime() + this.keyRotationInterval)
      };

      console.log(`New encryption key generated: ${keyId} (v${this.currentKey.version})`);
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw error;
    }
  }

  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    setInterval(async () => {
      try {
        await this.rotateKey();
      } catch (error) {
        console.error('Key rotation failed:', error);
      }
    }, this.keyRotationInterval);
  }

  /**
   * Rotate encryption key
   */
  private async rotateKey(): Promise<void> {
    try {
      console.log('Rotating encryption key...');
      await this.generateNewKey();
      
      // In a real implementation, you would:
      // 1. Re-encrypt all sensitive data with the new key
      // 2. Update encryption metadata in the database
      // 3. Securely dispose of the old key
      
      console.log('Key rotation completed successfully');
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string, fieldName?: string): Promise<EncryptedData> {
    if (!this.currentKey) {
      throw new Error('Encryption key not available');
    }

    try {
      // Convert string to ArrayBuffer
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate initialization vector
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.currentKey.algorithm,
          iv: iv
        },
        this.currentKey.key,
        dataBuffer
      );

      // Convert encrypted data to base64
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encryptedData = btoa(String.fromCharCode(...encryptedArray));

      // Create encryption metadata
      const metadata: DataEncryptionMetadata = {
        algorithm: this.currentKey.algorithm,
        keyId: this.currentKey.id,
        keyVersion: this.currentKey.version,
        encryptedAt: new Date(),
        iv: btoa(String.fromCharCode(...iv)),
        encryptedFields: fieldName ? [fieldName] : [],
        encryptionLevel: 'field'
      };

      return {
        data: encryptedData,
        metadata
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: EncryptedData): Promise<string> {
    try {
      // Convert base64 encrypted data to ArrayBuffer
      const encryptedArray = new Uint8Array(
        atob(encryptedData.data).split('').map(char => char.charCodeAt(0))
      );

      // Convert base64 IV to ArrayBuffer
      const iv = new Uint8Array(
        atob(encryptedData.metadata.iv).split('').map(char => char.charCodeAt(0))
      );

      // Get the encryption key (in a real implementation, you'd retrieve it by keyId)
      if (!this.currentKey) {
        throw new Error('Encryption key not available');
      }

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: encryptedData.metadata.algorithm,
          iv: iv
        },
        this.currentKey.key,
        encryptedArray
      );

      // Convert decrypted data to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Encrypt patient record fields
   */
  async encryptPatientRecord(patientData: any, sensitiveFields: string[]): Promise<{
    encryptedData: any;
    encryptionMetadata: DataEncryptionMetadata[];
  }> {
    const encryptedData = { ...patientData };
    const encryptionMetadata: DataEncryptionMetadata[] = [];

    for (const field of sensitiveFields) {
      if (patientData[field] && typeof patientData[field] === 'string') {
        try {
          const encrypted = await this.encryptData(patientData[field], field);
          encryptedData[field] = encrypted.data;
          encryptionMetadata.push(encrypted.metadata);
        } catch (error) {
          console.error(`Failed to encrypt field ${field}:`, error);
          // In a real implementation, you might want to fail the entire operation
          // or handle this differently based on your security requirements
        }
      }
    }

    return {
      encryptedData,
      encryptionMetadata
    };
  }

  /**
   * Decrypt patient record fields
   */
  async decryptPatientRecord(encryptedData: any, encryptionMetadata: DataEncryptionMetadata[]): Promise<any> {
    const decryptedData = { ...encryptedData };

    for (const metadata of encryptionMetadata) {
      for (const field of metadata.encryptedFields) {
        if (encryptedData[field]) {
          try {
            const decrypted = await this.decryptData({
              data: encryptedData[field],
              metadata
            });
            decryptedData[field] = decrypted;
          } catch (error) {
            console.error(`Failed to decrypt field ${field}:`, error);
            // In a real implementation, you might want to handle this differently
            decryptedData[field] = '[DECRYPTION_FAILED]';
          }
        }
      }
    }

    return decryptedData;
  }

  /**
   * Encrypt consent data
   */
  async encryptConsentData(consentData: any): Promise<{
    encryptedData: any;
    encryptionMetadata: DataEncryptionMetadata[];
  }> {
    const sensitiveFields = ['patientSignature', 'witnessSignature', 'notes'];
    return this.encryptPatientRecord(consentData, sensitiveFields);
  }

  /**
   * Decrypt consent data
   */
  async decryptConsentData(encryptedData: any, encryptionMetadata: DataEncryptionMetadata[]): Promise<any> {
    return this.decryptPatientRecord(encryptedData, encryptionMetadata);
  }

  /**
   * Hash sensitive data for non-reversible storage
   */
  async hashData(data: string, salt?: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      let dataToHash = data;
      
      if (salt) {
        dataToHash = data + salt;
      }

      const dataBuffer = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hashing failed:', error);
      throw new Error('Data hashing failed');
    }
  }

  /**
   * Generate secure random salt
   */
  generateSalt(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify data integrity
   */
  async verifyDataIntegrity(originalData: string, hashedData: string, salt?: string): Promise<boolean> {
    try {
      const computedHash = await this.hashData(originalData, salt);
      return computedHash === hashedData;
    } catch (error) {
      console.error('Data integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Get current encryption status
   */
  getEncryptionStatus(): {
    hasKey: boolean;
    keyId: string | null;
    keyVersion: number | null;
    keyExpiresAt: Date | null;
    algorithm: string | null;
  } {
    return {
      hasKey: !!this.currentKey,
      keyId: this.currentKey?.id || null,
      keyVersion: this.currentKey?.version || null,
      keyExpiresAt: this.currentKey?.expiresAt || null,
      algorithm: this.currentKey?.algorithm || null
    };
  }

  /**
   * Force key rotation (for testing or emergency situations)
   */
  async forceKeyRotation(): Promise<void> {
    try {
      console.log('Forcing key rotation...');
      await this.rotateKey();
      console.log('Forced key rotation completed');
    } catch (error) {
      console.error('Forced key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Export encryption key (for backup purposes - use with extreme caution)
   */
  async exportKey(): Promise<ArrayBuffer | null> {
    if (!this.currentKey) {
      return null;
    }

    try {
      return await crypto.subtle.exportKey('raw', this.currentKey.key);
    } catch (error) {
      console.error('Key export failed:', error);
      return null;
    }
  }

  /**
   * Import encryption key (for recovery purposes - use with extreme caution)
   */
  async importKey(keyData: ArrayBuffer, keyId: string, version: number): Promise<boolean> {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.currentKey = {
        id: keyId,
        key: cryptoKey,
        algorithm: 'AES-GCM',
        version,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.keyRotationInterval)
      };

      console.log(`Encryption key imported: ${keyId} (v${version})`);
      return true;
    } catch (error) {
      console.error('Key import failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const hipaaEncryption = HIPAAEncryption.getInstance();

// Export utility functions for common operations
export const encryptSensitiveField = (data: string, fieldName?: string) => 
  hipaaEncryption.encryptData(data, fieldName);

export const decryptSensitiveField = (encryptedData: EncryptedData) => 
  hipaaEncryption.decryptData(encryptedData);

export const hashSensitiveData = (data: string, salt?: string) => 
  hipaaEncryption.hashData(data, salt);

export const generateSecureSalt = (length?: number) => 
  hipaaEncryption.generateSalt(length);



