import { DatabaseService } from './database';
import { EncryptionService } from './encryptionService';
import { AuditService, AuditAction } from './auditService';
import { logger } from '../utils/logger';

export interface DataRetentionPolicy {
  resourceType: string;
  retentionDays: number;
  autoDelete: boolean;
  encryptionRequired: boolean;
}

export interface PrivacyRequest {
  id: string;
  userId: string;
  requestType: 'export' | 'delete' | 'rectify';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  details: Record<string, any>;
}

export interface DataExportResult {
  userId: string;
  exportedAt: Date;
  data: {
    profile: any;
    agents: any[];
    conversations: any[];
    knowledgeBase: any[];
    auditLogs: any[];
  };
  encryptedBackup?: string;
}

export class PrivacyService {
  private dbService: DatabaseService;
  private encryptionService: EncryptionService;
  private auditService: AuditService;
  private retentionPolicies: DataRetentionPolicy[];

  constructor(
    dbService: DatabaseService,
    encryptionService: EncryptionService,
    auditService: AuditService
  ) {
    this.dbService = dbService;
    this.encryptionService = encryptionService;
    this.auditService = auditService;

    // Default data retention policies
    this.retentionPolicies = [
      {
        resourceType: 'conversations',
        retentionDays: 365, // 1 year
        autoDelete: true,
        encryptionRequired: true
      },
      {
        resourceType: 'messages',
        retentionDays: 365, // 1 year
        autoDelete: true,
        encryptionRequired: true
      },
      {
        resourceType: 'audit_logs',
        retentionDays: 2555, // 7 years for compliance
        autoDelete: true,
        encryptionRequired: false
      },
      {
        resourceType: 'knowledge_base_documents',
        retentionDays: 1095, // 3 years
        autoDelete: false,
        encryptionRequired: true
      },
      {
        resourceType: 'agents',
        retentionDays: -1, // Keep indefinitely unless user deletes
        autoDelete: false,
        encryptionRequired: false
      }
    ];
  }

  /**
   * Handle GDPR data export request
   */
  async exportUserData(userId: string, includeEncryptedBackup: boolean = false): Promise<DataExportResult> {
    try {
      logger.info(`Starting data export for user ${userId}`);

      // Get user profile
      const profile = await this.dbService.getUserById(userId);

      // Get user's agents
      const agents = await this.dbService.getAgentsByUserId(userId, 1000);

      // Get conversations for all user agents
      const conversations = [];
      for (const agent of agents) {
        const agentConversations = await this.dbService.getConversationsByAgentId(agent.id, 1000);
        conversations.push(...agentConversations);
      }

      // Get knowledge base data
      const knowledgeBase = [];
      for (const agent of agents) {
        const kb = await this.dbService.getKnowledgeBaseByAgentId(agent.id, ''); // Use service token
        knowledgeBase.push({
          agentId: agent.id,
          ...kb
        });
      }

      // Get audit logs (limited to user's own actions)
      const auditLogs = await this.auditService.getAuditLogs({
        userId,
        limit: 10000
      });

      const exportResult: DataExportResult = {
        userId,
        exportedAt: new Date(),
        data: {
          profile,
          agents,
          conversations,
          knowledgeBase,
          auditLogs
        }
      };

      // Create encrypted backup if requested
      if (includeEncryptedBackup) {
        const password = this.encryptionService.generatePassword(24);
        exportResult.encryptedBackup = this.encryptionService.createEncryptedBackup(
          exportResult.data,
          password
        );
        
        // Log the password securely (in production, this should be sent to user via secure channel)
        logger.info(`Encrypted backup created for user ${userId}. Password: ${password}`);
      }

      // Log the export
      await this.auditService.logEvent({
        user_id: userId,
        action: 'data_exported' as any,
        resource_type: 'privacy',
        details: {
          includeEncryptedBackup,
          recordCounts: {
            agents: agents.length,
            conversations: conversations.length,
            auditLogs: auditLogs.length
          }
        }
      });

      logger.info(`Data export completed for user ${userId}`);
      return exportResult;

    } catch (error) {
      logger.error(`Data export failed for user ${userId}:`, error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Handle GDPR data deletion request (Right to be Forgotten)
   */
  async deleteUserData(userId: string, preserveAuditTrail: boolean = true): Promise<void> {
    try {
      logger.info(`Starting data deletion for user ${userId}`);

      // Get user's agents first
      const agents = await this.dbService.getAgentsByUserId(userId, 1000);
      const agentIds = agents.map(a => a.id);

      // Delete conversations and messages
      for (const agentId of agentIds) {
        const conversations = await this.dbService.getConversationsByAgentId(agentId, 1000);
        
        for (const conversation of conversations) {
          // Delete messages first
          const messages = await this.dbService.getMessagesByConversationId(conversation.id);
          for (const message of messages) {
            await this.deleteMessage(message.id);
          }
          
          // Delete conversation
          await this.deleteConversation(conversation.id);
        }
      }

      // Delete knowledge base data
      for (const agentId of agentIds) {
        const documents = await this.dbService.getKnowledgeBaseDocuments(agentId);
        for (const doc of documents) {
          await this.dbService.deleteKnowledgeBaseDocument(doc.id);
        }
      }

      // Delete agents
      for (const agentId of agentIds) {
        await this.dbService.deleteAgent(agentId);
      }

      // Delete user profile
      await this.deleteUserProfile(userId);

      // Handle audit logs
      if (!preserveAuditTrail) {
        // Delete user's audit logs (not recommended for compliance)
        await this.deleteUserAuditLogs(userId);
      } else {
        // Anonymize audit logs instead
        await this.anonymizeUserAuditLogs(userId);
      }

      // Log the deletion
      await this.auditService.logEvent({
        user_id: preserveAuditTrail ? userId : undefined,
        action: 'data_deleted' as any,
        resource_type: 'privacy',
        details: {
          deletedUserId: userId,
          preserveAuditTrail,
          deletedCounts: {
            agents: agentIds.length
          }
        }
      });

      logger.info(`Data deletion completed for user ${userId}`);

    } catch (error) {
      logger.error(`Data deletion failed for user ${userId}:`, error);
      throw new Error('Failed to delete user data');
    }
  }

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies(): Promise<{
    deletedCounts: Record<string, number>;
    errors: string[];
  }> {
    const deletedCounts: Record<string, number> = {};
    const errors: string[] = [];

    logger.info('Starting data retention policy enforcement');

    for (const policy of this.retentionPolicies) {
      if (!policy.autoDelete || policy.retentionDays < 0) {
        continue;
      }

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        let deletedCount = 0;

        switch (policy.resourceType) {
          case 'conversations':
            deletedCount = await this.deleteOldConversations(cutoffDate);
            break;
          case 'messages':
            deletedCount = await this.deleteOldMessages(cutoffDate);
            break;
          case 'audit_logs':
            deletedCount = await this.auditService.cleanupOldLogs(policy.retentionDays);
            break;
          default:
            logger.warn(`Unknown resource type in retention policy: ${policy.resourceType}`);
        }

        deletedCounts[policy.resourceType] = deletedCount;

        if (deletedCount > 0) {
          logger.info(`Deleted ${deletedCount} old ${policy.resourceType} records`);
        }

      } catch (error) {
        const errorMsg = `Failed to apply retention policy for ${policy.resourceType}: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Log retention policy execution
    await this.auditService.logEvent({
      action: 'retention_policy_applied' as any,
      resource_type: 'privacy',
      details: {
        deletedCounts,
        errors: errors.length,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Data retention policy enforcement completed', { deletedCounts, errors: errors.length });

    return { deletedCounts, errors };
  }

  /**
   * Encrypt sensitive conversation data
   */
  async encryptConversationData(conversationId: string): Promise<void> {
    try {
      // Get conversation with messages
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Encrypt sensitive fields in messages
      if (conversation.messages) {
        for (const message of conversation.messages) {
          if (message.content && !this.isEncrypted(message.content)) {
            const encryptedContent = this.encryptionService.encryptField(
              message.content,
              'content',
              message.id
            );

            // Update message with encrypted content
            await this.updateMessageContent(message.id, encryptedContent);
          }

          // Encrypt transcription if present
          if (message.transcription && !this.isEncrypted(message.transcription)) {
            const encryptedTranscription = this.encryptionService.encryptField(
              message.transcription,
              'transcription',
              message.id
            );

            await this.updateMessageTranscription(message.id, encryptedTranscription);
          }
        }
      }

      // Encrypt phone number if present
      if (conversation.phone_number && !this.isEncrypted(conversation.phone_number)) {
        const encryptedPhone = this.encryptionService.encryptField(
          conversation.phone_number,
          'phone_number',
          conversation.id
        );

        await this.updateConversationPhone(conversation.id, encryptedPhone);
      }

      logger.info(`Encrypted sensitive data for conversation ${conversationId}`);

    } catch (error) {
      logger.error(`Failed to encrypt conversation data for ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive conversation data
   */
  async decryptConversationData(conversationId: string): Promise<void> {
    try {
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Decrypt messages
      if (conversation.messages) {
        for (const message of conversation.messages) {
          if (message.content && this.isEncrypted(message.content)) {
            const decryptedContent = this.encryptionService.decryptField(
              message.content,
              'content',
              message.id
            );

            await this.updateMessageContent(message.id, decryptedContent);
          }

          if (message.transcription && this.isEncrypted(message.transcription)) {
            const decryptedTranscription = this.encryptionService.decryptField(
              message.transcription,
              'transcription',
              message.id
            );

            await this.updateMessageTranscription(message.id, decryptedTranscription);
          }
        }
      }

      // Decrypt phone number
      if (conversation.phone_number && this.isEncrypted(conversation.phone_number)) {
        const decryptedPhone = this.encryptionService.decryptField(
          conversation.phone_number,
          'phone_number',
          conversation.id
        );

        await this.updateConversationPhone(conversation.id, decryptedPhone);
      }

      logger.info(`Decrypted sensitive data for conversation ${conversationId}`);

    } catch (error) {
      logger.error(`Failed to decrypt conversation data for ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Check if data appears to be encrypted
   */
  private isEncrypted(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return parsed.encrypted && parsed.iv;
    } catch {
      return false;
    }
  }

  /**
   * Delete old conversations
   */
  private async deleteOldConversations(cutoffDate: Date): Promise<number> {
    // This would need to be implemented with proper database queries
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Delete old messages
   */
  private async deleteOldMessages(cutoffDate: Date): Promise<number> {
    // This would need to be implemented with proper database queries
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Delete a specific message
   */
  private async deleteMessage(messageId: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Deleting message ${messageId}`);
  }

  /**
   * Delete a specific conversation
   */
  private async deleteConversation(conversationId: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Deleting conversation ${conversationId}`);
  }

  /**
   * Delete user profile
   */
  private async deleteUserProfile(userId: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Deleting user profile ${userId}`);
  }

  /**
   * Delete user audit logs
   */
  private async deleteUserAuditLogs(userId: string): Promise<void> {
    // Implementation would depend on audit service methods
    logger.debug(`Deleting audit logs for user ${userId}`);
  }

  /**
   * Anonymize user audit logs
   */
  private async anonymizeUserAuditLogs(userId: string): Promise<void> {
    // Replace user ID with anonymous identifier
    logger.debug(`Anonymizing audit logs for user ${userId}`);
  }

  /**
   * Update message content
   */
  private async updateMessageContent(messageId: string, content: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Updating message content for ${messageId}`);
  }

  /**
   * Update message transcription
   */
  private async updateMessageTranscription(messageId: string, transcription: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Updating message transcription for ${messageId}`);
  }

  /**
   * Update conversation phone number
   */
  private async updateConversationPhone(conversationId: string, phoneNumber: string): Promise<void> {
    // Implementation would depend on database service methods
    logger.debug(`Updating conversation phone for ${conversationId}`);
  }

  /**
   * Get retention policy for resource type
   */
  getRetentionPolicy(resourceType: string): DataRetentionPolicy | undefined {
    return this.retentionPolicies.find(p => p.resourceType === resourceType);
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policy: DataRetentionPolicy): void {
    const index = this.retentionPolicies.findIndex(p => p.resourceType === policy.resourceType);
    if (index >= 0) {
      this.retentionPolicies[index] = policy;
    } else {
      this.retentionPolicies.push(policy);
    }

    logger.info(`Updated retention policy for ${policy.resourceType}`, policy);
  }
}