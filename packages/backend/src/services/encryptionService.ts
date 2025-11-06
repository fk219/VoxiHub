import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag?: string;
  salt?: string;
}

export class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;

  constructor() {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16, // 128 bits
      saltLength: 32 // 256 bits
    };

    // Initialize master key from environment or generate one
    const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      // Generate a new master key (should be stored securely in production)
      this.masterKey = crypto.randomBytes(this.config.keyLength);
      logger.warn('No ENCRYPTION_MASTER_KEY found, generated new key. Store this securely:', 
        this.masterKey.toString('hex'));
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string, additionalData?: string): EncryptedData {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.config.algorithm, this.masterKey);
      cipher.setAAD(Buffer.from(additionalData || '', 'utf8'));

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };

    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData, additionalData?: string): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = encryptedData.tag ? Buffer.from(encryptedData.tag, 'hex') : undefined;

      // Create decipher
      const decipher = crypto.createDecipher(this.config.algorithm, this.masterKey);
      
      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, 'utf8'));
      }
      
      if (tag) {
        decipher.setAuthTag(tag);
      }

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt data with password-based key derivation
   */
  encryptWithPassword(plaintext: string, password: string): EncryptedData {
    try {
      // Generate random salt
      const salt = crypto.randomBytes(this.config.saltLength);
      
      // Derive key from password
      const key = crypto.pbkdf2Sync(password, salt, 100000, this.config.keyLength, 'sha256');
      
      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipherGCM(this.config.algorithm, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex')
      };

    } catch (error) {
      logger.error('Password-based encryption failed:', error);
      throw new Error('Failed to encrypt data with password');
    }
  }

  /**
   * Decrypt data with password-based key derivation
   */
  decryptWithPassword(encryptedData: EncryptedData, password: string): string {
    try {
      if (!encryptedData.salt) {
        throw new Error('Salt is required for password-based decryption');
      }

      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag!, 'hex');

      // Derive key from password
      const key = crypto.pbkdf2Sync(password, salt, 100000, this.config.keyLength, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipherGCM(this.config.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('Password-based decryption failed:', error);
      throw new Error('Failed to decrypt data with password');
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(this.config.saltLength);
      const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha256');

      return {
        hash: hash.toString('hex'),
        salt: saltBuffer.toString('hex')
      };

    } catch (error) {
      logger.error('Hashing failed:', error);
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hash(data, salt);
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));

    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random password
   */
  generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Encrypt file content
   */
  encryptFile(fileBuffer: Buffer): EncryptedData {
    try {
      const plaintext = fileBuffer.toString('base64');
      return this.encrypt(plaintext);

    } catch (error) {
      logger.error('File encryption failed:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file content
   */
  decryptFile(encryptedData: EncryptedData): Buffer {
    try {
      const decryptedBase64 = this.decrypt(encryptedData);
      return Buffer.from(decryptedBase64, 'base64');

    } catch (error) {
      logger.error('File decryption failed:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * Encrypt database field
   */
  encryptField(value: string, fieldName: string, recordId: string): string {
    try {
      const additionalData = `${fieldName}:${recordId}`;
      const encrypted = this.encrypt(value, additionalData);
      
      // Return as JSON string for database storage
      return JSON.stringify(encrypted);

    } catch (error) {
      logger.error('Field encryption failed:', error);
      throw new Error('Failed to encrypt database field');
    }
  }

  /**
   * Decrypt database field
   */
  decryptField(encryptedValue: string, fieldName: string, recordId: string): string {
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedValue);
      const additionalData = `${fieldName}:${recordId}`;
      
      return this.decrypt(encryptedData, additionalData);

    } catch (error) {
      logger.error('Field decryption failed:', error);
      throw new Error('Failed to decrypt database field');
    }
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      crypto.randomFillSync(buffer);
      buffer.fill(0);
    }
  }

  /**
   * Create encrypted backup of data
   */
  createEncryptedBackup(data: any, password: string): string {
    try {
      const jsonData = JSON.stringify(data);
      const encrypted = this.encryptWithPassword(jsonData, password);
      
      return JSON.stringify({
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: encrypted
      });

    } catch (error) {
      logger.error('Backup encryption failed:', error);
      throw new Error('Failed to create encrypted backup');
    }
  }

  /**
   * Restore from encrypted backup
   */
  restoreFromEncryptedBackup(backupData: string, password: string): any {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup format');
      }

      const decryptedJson = this.decryptWithPassword(backup.data, password);
      return JSON.parse(decryptedJson);

    } catch (error) {
      logger.error('Backup decryption failed:', error);
      throw new Error('Failed to restore from encrypted backup');
    }
  }
}