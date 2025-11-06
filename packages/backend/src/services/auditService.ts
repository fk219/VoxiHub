import { DatabaseService } from './database';
import { logger } from '../utils/logger';

export enum AuditAction {
  // Authentication actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_RESET = 'password_reset',
  
  // Agent actions
  AGENT_CREATED = 'agent_created',
  AGENT_UPDATED = 'agent_updated',
  AGENT_DELETED = 'agent_deleted',
  AGENT_DEPLOYED = 'agent_deployed',
  
  // Conversation actions
  CONVERSATION_STARTED = 'conversation_started',
  CONVERSATION_ENDED = 'conversation_ended',
  MESSAGE_SENT = 'message_sent',
  
  // Configuration actions
  SIP_CONFIG_UPDATED = 'sip_config_updated',
  WIDGET_CONFIG_UPDATED = 'widget_config_updated',
  KNOWLEDGE_BASE_UPDATED = 'knowledge_base_updated',
  
  // Admin actions
  USER_ROLE_CHANGED = 'user_role_changed',
  SYSTEM_CONFIG_CHANGED = 'system_config_changed',
  
  // Security actions
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access'
}

export interface AuditLogEntry {
  id?: string;
  user_id?: string;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
  session_id?: string;
}

export class AuditService {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  /**
   * Log an audit event
   */
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date()
      };

      // Store in database
      await this.storeAuditLog(auditEntry);

      // Also log to application logger for immediate visibility
      logger.info('Audit event', {
        action: entry.action,
        userId: entry.user_id,
        resourceType: entry.resource_type,
        resourceId: entry.resource_id,
        ipAddress: entry.ip_address,
        details: entry.details
      });

    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    action: AuditAction.LOGIN | AuditAction.LOGOUT | AuditAction.LOGIN_FAILED | AuditAction.PASSWORD_RESET,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      user_id: userId,
      action,
      resource_type: 'authentication',
      details,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log agent-related events
   */
  async logAgentEvent(
    action: AuditAction.AGENT_CREATED | AuditAction.AGENT_UPDATED | AuditAction.AGENT_DELETED | AuditAction.AGENT_DEPLOYED,
    userId: string,
    agentId: string,
    ipAddress?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      user_id: userId,
      action,
      resource_type: 'agent',
      resource_id: agentId,
      details,
      ip_address: ipAddress
    });
  }

  /**
   * Log conversation events
   */
  async logConversationEvent(
    action: AuditAction.CONVERSATION_STARTED | AuditAction.CONVERSATION_ENDED | AuditAction.MESSAGE_SENT,
    conversationId: string,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      user_id: userId,
      action,
      resource_type: 'conversation',
      resource_id: conversationId,
      details
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigEvent(
    action: AuditAction.SIP_CONFIG_UPDATED | AuditAction.WIDGET_CONFIG_UPDATED | AuditAction.KNOWLEDGE_BASE_UPDATED,
    userId: string,
    resourceId: string,
    ipAddress?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      user_id: userId,
      action,
      resource_type: action.includes('sip') ? 'sip_config' : 
                    action.includes('widget') ? 'widget_config' : 'knowledge_base',
      resource_id: resourceId,
      details,
      ip_address: ipAddress
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    action: AuditAction.SUSPICIOUS_ACTIVITY | AuditAction.RATE_LIMIT_EXCEEDED | AuditAction.UNAUTHORIZED_ACCESS,
    ipAddress?: string,
    userAgent?: string,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      user_id: userId,
      action,
      resource_type: 'security',
      details,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      return await this.queryAuditLogs(filters);
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByResourceType: Record<string, number>;
    securityEvents: number;
    failedLogins: number;
  }> {
    try {
      const logs = await this.queryAuditLogs({
        ...filters,
        limit: 10000 // Get more data for stats
      });

      const stats = {
        totalEvents: logs.length,
        eventsByAction: {} as Record<string, number>,
        eventsByResourceType: {} as Record<string, number>,
        securityEvents: 0,
        failedLogins: 0
      };

      logs.forEach(log => {
        // Count by action
        stats.eventsByAction[log.action] = (stats.eventsByAction[log.action] || 0) + 1;

        // Count by resource type
        if (log.resource_type) {
          stats.eventsByResourceType[log.resource_type] = 
            (stats.eventsByResourceType[log.resource_type] || 0) + 1;
        }

        // Count security events
        if (log.resource_type === 'security') {
          stats.securityEvents++;
        }

        // Count failed logins
        if (log.action === AuditAction.LOGIN_FAILED) {
          stats.failedLogins++;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get audit stats:', error);
      throw new Error('Failed to retrieve audit statistics');
    }
  }

  /**
   * Store audit log in database
   */
  private async storeAuditLog(entry: AuditLogEntry): Promise<void> {
    // Use service client to bypass RLS for audit logs
    const { error } = await (this.dbService as any).serviceSupabase
      .from('audit_logs')
      .insert({
        user_id: entry.user_id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        details: entry.details,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        session_id: entry.session_id,
        created_at: entry.timestamp.toISOString()
      });

    if (error) {
      logger.error('Failed to store audit log:', error);
      throw error;
    }
  }

  /**
   * Query audit logs from database
   */
  private async queryAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    let query = (this.dbService as any).serviceSupabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      details: row.details,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      session_id: row.session_id,
      timestamp: new Date(row.created_at)
    }));
  }

  /**
   * Clean up old audit logs (for compliance with data retention policies)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { count, error } = await (this.dbService as any).serviceSupabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      logger.info(`Cleaned up ${count} old audit log entries`);
      return count || 0;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }
}