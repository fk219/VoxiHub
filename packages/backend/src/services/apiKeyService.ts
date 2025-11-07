import { DatabaseService } from './database';
import { AuditService, AuditAction } from './auditService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at?: Date;
  expires_at?: Date;
  rate_limit?: number;
  usage_quota?: number;
  usage_count: number;
  enabled: boolean;
  scopes: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateApiKeyRequest {
  user_id: string;
  name: string;
  expires_in_days?: number;
  rate_limit?: number;
  usage_quota?: number;
  scopes?: string[];
}

export class ApiKeyService {
  private dbService: DatabaseService;
  private auditService: AuditService;

  constructor(dbService: DatabaseService, auditService: AuditService) {
    this.dbService = dbService;
    this.auditService = auditService;
  }

  /**
   * Generate a new API key
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<{ apiKey: ApiKey; plainKey: string }> {
    try {
      // Generate random API key
      const plainKey = `vx_${crypto.randomBytes(32).toString('hex')}`;
      const keyPrefix = plainKey.substring(0, 10);
      const keyHash = this.hashKey(plainKey);

      // Calculate expiration date
      let expiresAt: Date | undefined;
      if (request.expires_in_days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + request.expires_in_days);
      }

      // Create API key in database
      const apiKey = await this.dbService.createApiKey({
        user_id: request.user_id,
        name: request.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        expires_at: expiresAt,
        rate_limit: request.rate_limit,
        usage_quota: request.usage_quota,
        scopes: request.scopes || ['*'],
        enabled: true,
      });

      // Log API key creation
      await this.auditService.logEvent({
        user_id: request.user_id,
        action: AuditAction.API_KEY_CREATED,
        resource_type: 'api_key',
        resource_id: apiKey.id,
        details: { name: request.name, key_prefix: keyPrefix },
      });

      logger.info('API key created', { userId: request.user_id, keyId: apiKey.id });

      return { apiKey, plainKey };
    } catch (error) {
      logger.error('Failed to create API key:', error);
      throw error;
    }
  }

  /**
   * Validate and authenticate an API key
   */
  async validateApiKey(plainKey: string): Promise<ApiKey | null> {
    try {
      const keyHash = this.hashKey(plainKey);
      const keyPrefix = plainKey.substring(0, 10);

      // Find API key by prefix and hash
      const apiKey = await this.dbService.getApiKeyByHash(keyHash);

      if (!apiKey) {
        return null;
      }

      // Check if key is enabled
      if (!apiKey.enabled) {
        logger.warn('Attempted to use disabled API key', { keyId: apiKey.id });
        return null;
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date() > apiKey.expires_at) {
        logger.warn('Attempted to use expired API key', { keyId: apiKey.id });
        return null;
      }

      // Check usage quota
      if (apiKey.usage_quota && apiKey.usage_count >= apiKey.usage_quota) {
        logger.warn('API key usage quota exceeded', { keyId: apiKey.id });
        return null;
      }

      // Update last used timestamp and usage count
      await this.dbService.updateApiKeyUsage(apiKey.id);

      return apiKey;
    } catch (error) {
      logger.error('Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    try {
      return await this.dbService.getApiKeysByUserId(userId);
    } catch (error) {
      logger.error('Failed to list API keys:', error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    try {
      const apiKey = await this.dbService.getApiKeyById(keyId);

      if (!apiKey || apiKey.user_id !== userId) {
        throw new Error('API key not found');
      }

      await this.dbService.updateApiKey(keyId, { enabled: false });

      await this.auditService.logEvent({
        user_id: userId,
        action: AuditAction.API_KEY_REVOKED,
        resource_type: 'api_key',
        resource_id: keyId,
        details: { name: apiKey.name },
      });

      logger.info('API key revoked', { userId, keyId });
    } catch (error) {
      logger.error('Failed to revoke API key:', error);
      throw error;
    }
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(keyId: string, userId: string): Promise<void> {
    try {
      const apiKey = await this.dbService.getApiKeyById(keyId);

      if (!apiKey || apiKey.user_id !== userId) {
        throw new Error('API key not found');
      }

      await this.dbService.deleteApiKey(keyId);

      await this.auditService.logEvent({
        user_id: userId,
        action: AuditAction.API_KEY_DELETED,
        resource_type: 'api_key',
        resource_id: keyId,
        details: { name: apiKey.name },
      });

      logger.info('API key deleted', { userId, keyId });
    } catch (error) {
      logger.error('Failed to delete API key:', error);
      throw error;
    }
  }

  /**
   * Update API key settings
   */
  async updateApiKey(
    keyId: string,
    userId: string,
    updates: Partial<Pick<ApiKey, 'name' | 'rate_limit' | 'usage_quota' | 'scopes'>>
  ): Promise<ApiKey> {
    try {
      const apiKey = await this.dbService.getApiKeyById(keyId);

      if (!apiKey || apiKey.user_id !== userId) {
        throw new Error('API key not found');
      }

      const updatedKey = await this.dbService.updateApiKey(keyId, updates);

      await this.auditService.logEvent({
        user_id: userId,
        action: AuditAction.API_KEY_UPDATED,
        resource_type: 'api_key',
        resource_id: keyId,
        details: { updates: Object.keys(updates) },
      });

      logger.info('API key updated', { userId, keyId });

      return updatedKey;
    } catch (error) {
      logger.error('Failed to update API key:', error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyStats(keyId: string, userId: string): Promise<{
    totalRequests: number;
    requestsToday: number;
    requestsThisMonth: number;
    lastUsed?: Date;
    quotaRemaining?: number;
  }> {
    try {
      const apiKey = await this.dbService.getApiKeyById(keyId);

      if (!apiKey || apiKey.user_id !== userId) {
        throw new Error('API key not found');
      }

      const stats = await this.dbService.getApiKeyUsageStats(keyId);

      return {
        totalRequests: apiKey.usage_count,
        requestsToday: stats.requestsToday,
        requestsThisMonth: stats.requestsThisMonth,
        lastUsed: apiKey.last_used_at,
        quotaRemaining: apiKey.usage_quota ? apiKey.usage_quota - apiKey.usage_count : undefined,
      };
    } catch (error) {
      logger.error('Failed to get API key stats:', error);
      throw error;
    }
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(plainKey: string): string {
    return crypto.createHash('sha256').update(plainKey).digest('hex');
  }
}
