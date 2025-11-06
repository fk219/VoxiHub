import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission, Permission } from '../middleware/rbac';
import { PrivacyService } from '../services/privacyService';
import { EncryptionService } from '../services/encryptionService';
import { AuditService } from '../services/auditService';
import { DatabaseService } from '../services/database';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize services
const dbService = new DatabaseService();
const encryptionService = new EncryptionService();
const auditService = new AuditService(dbService);
const privacyService = new PrivacyService(dbService, encryptionService, auditService);

/**
 * GDPR Data Export - Right to Data Portability
 */
router.post('/export', 
  authenticateToken(auditService), 
  requirePermission(Permission.READ_AGENT),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { includeEncryptedBackup = false } = req.body;

      logger.info(`Data export requested by user ${userId}`);

      const exportResult = await privacyService.exportUserData(userId, includeEncryptedBackup);

      res.json({
        message: 'Data export completed successfully',
        exportedAt: exportResult.exportedAt,
        recordCounts: {
          agents: exportResult.data.agents.length,
          conversations: exportResult.data.conversations.length,
          auditLogs: exportResult.data.auditLogs.length
        },
        downloadUrl: `/api/privacy/download/${userId}`, // Would need to implement file storage
        hasEncryptedBackup: !!exportResult.encryptedBackup
      });

    } catch (error) {
      logger.error('Data export failed:', error);
      res.status(500).json({
        error: 'Failed to export data',
        code: 'EXPORT_FAILED'
      });
    }
  }
);

/**
 * GDPR Data Deletion - Right to be Forgotten
 */
router.post('/delete', 
  authenticateToken(auditService), 
  requirePermission(Permission.DELETE_AGENT),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { preserveAuditTrail = true, confirmationCode } = req.body;

      // In production, you'd want to require additional verification
      if (!confirmationCode || confirmationCode !== 'DELETE_MY_DATA') {
        return res.status(400).json({
          error: 'Confirmation code required',
          code: 'CONFIRMATION_REQUIRED'
        });
      }

      logger.info(`Data deletion requested by user ${userId}`);

      await privacyService.deleteUserData(userId, preserveAuditTrail);

      res.json({
        message: 'Data deletion completed successfully',
        deletedAt: new Date().toISOString(),
        preservedAuditTrail: preserveAuditTrail
      });

    } catch (error) {
      logger.error('Data deletion failed:', error);
      res.status(500).json({
        error: 'Failed to delete data',
        code: 'DELETION_FAILED'
      });
    }
  }
);

/**
 * Get user's data retention information
 */
router.get('/retention-info', 
  authenticateToken(auditService), 
  async (req, res) => {
    try {
      const policies = [
        privacyService.getRetentionPolicy('conversations'),
        privacyService.getRetentionPolicy('messages'),
        privacyService.getRetentionPolicy('audit_logs'),
        privacyService.getRetentionPolicy('knowledge_base_documents'),
        privacyService.getRetentionPolicy('agents')
      ].filter(Boolean);

      res.json({
        retentionPolicies: policies,
        userRights: [
          'Right to Access (Data Export)',
          'Right to Rectification (Data Correction)',
          'Right to Erasure (Right to be Forgotten)',
          'Right to Data Portability',
          'Right to Object to Processing'
        ],
        contactInfo: {
          email: process.env.PRIVACY_CONTACT_EMAIL || 'privacy@aiagent.com',
          address: process.env.PRIVACY_CONTACT_ADDRESS || 'Privacy Officer, AI Agent Platform'
        }
      });

    } catch (error) {
      logger.error('Failed to get retention info:', error);
      res.status(500).json({
        error: 'Failed to get retention information',
        code: 'RETENTION_INFO_FAILED'
      });
    }
  }
);

/**
 * Request data rectification
 */
router.post('/rectify', 
  authenticateToken(auditService), 
  requirePermission(Permission.UPDATE_AGENT),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { field, currentValue, newValue, reason } = req.body;

      if (!field || !newValue) {
        return res.status(400).json({
          error: 'Field and new value are required',
          code: 'INVALID_REQUEST'
        });
      }

      // Log the rectification request
      await auditService.logEvent({
        user_id: userId,
        action: 'data_rectification_requested' as any,
        resource_type: 'privacy',
        details: {
          field,
          currentValue: currentValue ? '[REDACTED]' : undefined,
          reason,
          requestedAt: new Date().toISOString()
        },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      // In a real implementation, this would create a workflow for manual review
      res.json({
        message: 'Data rectification request submitted',
        requestId: encryptionService.generateToken(16),
        status: 'pending_review',
        estimatedProcessingTime: '5-10 business days'
      });

    } catch (error) {
      logger.error('Data rectification request failed:', error);
      res.status(500).json({
        error: 'Failed to submit rectification request',
        code: 'RECTIFICATION_FAILED'
      });
    }
  }
);

/**
 * Get privacy dashboard data
 */
router.get('/dashboard', 
  authenticateToken(auditService), 
  async (req, res) => {
    try {
      const userId = req.user!.id;

      // Get user's data summary
      const agents = await dbService.getAgentsByUserId(userId, 1000);
      const agentIds = agents.map(a => a.id);

      let totalConversations = 0;
      let totalMessages = 0;

      for (const agentId of agentIds) {
        const conversations = await dbService.getConversationsByAgentId(agentId, 1000);
        totalConversations += conversations.length;

        for (const conversation of conversations) {
          const messages = await dbService.getMessagesByConversationId(conversation.id);
          totalMessages += messages.length;
        }
      }

      // Get recent privacy-related audit logs
      const recentPrivacyLogs = await auditService.getAuditLogs({
        userId,
        limit: 10
      });

      res.json({
        dataSummary: {
          agents: agents.length,
          conversations: totalConversations,
          messages: totalMessages,
          lastActivity: agents.length > 0 ? agents[0].updated_at : null
        },
        privacyRights: {
          canExport: true,
          canDelete: true,
          canRectify: true,
          lastExport: null, // Would track in database
          lastDeletion: null
        },
        recentActivity: recentPrivacyLogs.map(log => ({
          action: log.action,
          timestamp: log.timestamp,
          details: log.details
        })),
        retentionStatus: {
          conversationsRetainedDays: privacyService.getRetentionPolicy('conversations')?.retentionDays || 365,
          messagesRetainedDays: privacyService.getRetentionPolicy('messages')?.retentionDays || 365,
          nextCleanup: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
        }
      });

    } catch (error) {
      logger.error('Privacy dashboard failed:', error);
      res.status(500).json({
        error: 'Failed to load privacy dashboard',
        code: 'DASHBOARD_FAILED'
      });
    }
  }
);

/**
 * Admin endpoint to apply retention policies
 */
router.post('/admin/apply-retention', 
  authenticateToken(auditService), 
  requirePermission(Permission.SYSTEM_CONFIG),
  async (req, res) => {
    try {
      logger.info('Manual retention policy application requested');

      const result = await privacyService.applyRetentionPolicies();

      res.json({
        message: 'Retention policies applied successfully',
        deletedCounts: result.deletedCounts,
        errors: result.errors,
        appliedAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Retention policy application failed:', error);
      res.status(500).json({
        error: 'Failed to apply retention policies',
        code: 'RETENTION_APPLICATION_FAILED'
      });
    }
  }
);

/**
 * Admin endpoint to update retention policies
 */
router.put('/admin/retention-policy', 
  authenticateToken(auditService), 
  requirePermission(Permission.SYSTEM_CONFIG),
  async (req, res) => {
    try {
      const { resourceType, retentionDays, autoDelete, encryptionRequired } = req.body;

      if (!resourceType || retentionDays === undefined) {
        return res.status(400).json({
          error: 'Resource type and retention days are required',
          code: 'INVALID_REQUEST'
        });
      }

      const policy = {
        resourceType,
        retentionDays,
        autoDelete: autoDelete !== false,
        encryptionRequired: encryptionRequired !== false
      };

      privacyService.updateRetentionPolicy(policy);

      // Log the policy change
      await auditService.logEvent({
        user_id: req.user!.id,
        action: 'retention_policy_updated' as any,
        resource_type: 'privacy',
        details: policy,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        message: 'Retention policy updated successfully',
        policy
      });

    } catch (error) {
      logger.error('Retention policy update failed:', error);
      res.status(500).json({
        error: 'Failed to update retention policy',
        code: 'POLICY_UPDATE_FAILED'
      });
    }
  }
);

/**
 * Admin endpoint to encrypt conversation data
 */
router.post('/admin/encrypt-conversation/:conversationId', 
  authenticateToken(auditService), 
  requirePermission(Permission.SYSTEM_CONFIG),
  async (req, res) => {
    try {
      const { conversationId } = req.params;

      await privacyService.encryptConversationData(conversationId);

      // Log the encryption
      await auditService.logEvent({
        user_id: req.user!.id,
        action: 'data_encrypted' as any,
        resource_type: 'conversation',
        resource_id: conversationId,
        details: { encryptedAt: new Date().toISOString() },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        message: 'Conversation data encrypted successfully',
        conversationId,
        encryptedAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Conversation encryption failed:', error);
      res.status(500).json({
        error: 'Failed to encrypt conversation data',
        code: 'ENCRYPTION_FAILED'
      });
    }
  }
);

export default router;