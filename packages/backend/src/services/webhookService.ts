import { DatabaseService } from './database';
import { AuditService, AuditAction } from './auditService';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';

export enum WebhookEvent {
  CALL_STARTED = 'call.started',
  CALL_ENDED = 'call.ended',
  CALL_FAILED = 'call.failed',
  CONVERSATION_UPDATED = 'conversation.updated',
  CONVERSATION_ENDED = 'conversation.ended',
  AGENT_DEPLOYED = 'agent.deployed',
  AGENT_UPDATED = 'agent.updated',
  FUNCTION_EXECUTED = 'function.executed',
  ERROR_OCCURRED = 'error.occurred',
}

export interface Webhook {
  id: string;
  user_id: string;
  agent_id?: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  retry_count: number;
  last_triggered_at?: Date;
  last_status?: number;
  last_error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  webhook_id: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  payload: any;
  status_code?: number;
  response_body?: string;
  error?: string;
  attempt_number: number;
  delivered_at?: Date;
  created_at: Date;
}

export class WebhookService {
  private dbService: DatabaseService;
  private auditService: AuditService;
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // Exponential backoff in ms

  constructor(dbService: DatabaseService, auditService: AuditService) {
    this.dbService = dbService;
    this.auditService = auditService;
  }

  /**
   * Register a new webhook
   */
  async createWebhook(data: {
    user_id: string;
    agent_id?: string;
    url: string;
    events: WebhookEvent[];
  }): Promise<Webhook> {
    try {
      // Generate webhook secret
      const secret = crypto.randomBytes(32).toString('hex');

      const webhook = await this.dbService.createWebhook({
        ...data,
        secret,
        enabled: true,
        retry_count: this.maxRetries,
      });

      await this.auditService.logEvent({
        user_id: data.user_id,
        action: AuditAction.WEBHOOK_CREATED,
        resource_type: 'webhook',
        resource_id: webhook.id,
        details: { url: data.url, events: data.events },
      });

      logger.info('Webhook created', { webhookId: webhook.id, userId: data.user_id });

      return webhook;
    } catch (error) {
      logger.error('Failed to create webhook:', error);
      throw error;
    }
  }

  /**
   * Trigger a webhook event
   */
  async triggerEvent(
    event: WebhookEvent,
    data: any,
    options?: {
      userId?: string;
      agentId?: string;
    }
  ): Promise<void> {
    try {
      // Find all webhooks that should receive this event
      const webhooks = await this.findWebhooksForEvent(event, options);

      logger.info('Triggering webhook event', {
        event,
        webhookCount: webhooks.length,
        agentId: options?.agentId,
      });

      // Trigger all webhooks in parallel
      await Promise.all(
        webhooks.map(webhook => this.deliverWebhook(webhook, event, data))
      );
    } catch (error) {
      logger.error('Failed to trigger webhook event:', error);
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(
    webhook: Webhook,
    event: WebhookEvent,
    data: any,
    attemptNumber: number = 1
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      webhook_id: webhook.id,
    };

    const signature = this.generateSignature(payload, webhook.secret);

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-ID': webhook.id,
          'User-Agent': 'VoxiHub-Webhooks/1.0',
        },
        timeout: 10000, // 10 second timeout
      });

      // Log successful delivery
      await this.logWebhookDelivery({
        webhook_id: webhook.id,
        event,
        payload,
        status_code: response.status,
        response_body: JSON.stringify(response.data).substring(0, 1000),
        attempt_number: attemptNumber,
        delivered_at: new Date(),
      });

      // Update webhook last triggered
      await this.dbService.updateWebhook(webhook.id, {
        last_triggered_at: new Date(),
        last_status: response.status,
        last_error: null,
      });

      logger.info('Webhook delivered successfully', {
        webhookId: webhook.id,
        event,
        statusCode: response.status,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message;
      const statusCode = error.response?.status;

      logger.error('Webhook delivery failed', {
        webhookId: webhook.id,
        event,
        attempt: attemptNumber,
        error: errorMessage,
      });

      // Log failed delivery
      await this.logWebhookDelivery({
        webhook_id: webhook.id,
        event,
        payload,
        status_code: statusCode,
        error: errorMessage,
        attempt_number: attemptNumber,
      });

      // Update webhook with error
      await this.dbService.updateWebhook(webhook.id, {
        last_triggered_at: new Date(),
        last_status: statusCode,
        last_error: errorMessage,
      });

      // Retry if not exceeded max retries
      if (attemptNumber < webhook.retry_count) {
        const delay = this.retryDelays[attemptNumber - 1] || 15000;
        logger.info('Scheduling webhook retry', {
          webhookId: webhook.id,
          attempt: attemptNumber + 1,
          delay,
        });

        setTimeout(() => {
          this.deliverWebhook(webhook, event, data, attemptNumber + 1);
        }, delay);
      } else {
        logger.warn('Webhook max retries exceeded', {
          webhookId: webhook.id,
          event,
        });
      }
    }
  }

  /**
   * Find webhooks that should receive an event
   */
  private async findWebhooksForEvent(
    event: WebhookEvent,
    options?: {
      userId?: string;
      agentId?: string;
    }
  ): Promise<Webhook[]> {
    const webhooks = await this.dbService.getWebhooks({
      enabled: true,
      agent_id: options?.agentId,
      user_id: options?.userId,
    });

    // Filter webhooks that are subscribed to this event
    return webhooks.filter(webhook => webhook.events.includes(event));
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Log webhook delivery attempt
   */
  private async logWebhookDelivery(log: Omit<WebhookDeliveryLog, 'id' | 'created_at'>): Promise<void> {
    try {
      await this.dbService.createWebhookLog(log);
    } catch (error) {
      logger.error('Failed to log webhook delivery:', error);
    }
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookLogs(webhookId: string, limit: number = 50): Promise<WebhookDeliveryLog[]> {
    try {
      return await this.dbService.getWebhookLogs(webhookId, limit);
    } catch (error) {
      logger.error('Failed to get webhook logs:', error);
      throw error;
    }
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string, userId: string): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
  }> {
    try {
      const webhook = await this.dbService.getWebhookById(webhookId);

      if (!webhook || webhook.user_id !== userId) {
        throw new Error('Webhook not found');
      }

      const testPayload: WebhookPayload = {
        event: WebhookEvent.CALL_STARTED,
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: 'This is a test webhook delivery',
        },
        webhook_id: webhook.id,
      };

      const signature = this.generateSignature(testPayload, webhook.secret);

      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test',
          'X-Webhook-ID': webhook.id,
          'User-Agent': 'VoxiHub-Webhooks/1.0',
        },
        timeout: 10000,
      });

      return {
        success: true,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        statusCode: error.response?.status,
        error: error.message,
      };
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    userId: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'enabled' | 'retry_count'>>
  ): Promise<Webhook> {
    try {
      const webhook = await this.dbService.getWebhookById(webhookId);

      if (!webhook || webhook.user_id !== userId) {
        throw new Error('Webhook not found');
      }

      const updatedWebhook = await this.dbService.updateWebhook(webhookId, updates);

      await this.auditService.logEvent({
        user_id: userId,
        action: AuditAction.WEBHOOK_UPDATED,
        resource_type: 'webhook',
        resource_id: webhookId,
        details: { updates: Object.keys(updates) },
      });

      return updatedWebhook;
    } catch (error) {
      logger.error('Failed to update webhook:', error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, userId: string): Promise<void> {
    try {
      const webhook = await this.dbService.getWebhookById(webhookId);

      if (!webhook || webhook.user_id !== userId) {
        throw new Error('Webhook not found');
      }

      await this.dbService.deleteWebhook(webhookId);

      await this.auditService.logEvent({
        user_id: userId,
        action: AuditAction.WEBHOOK_DELETED,
        resource_type: 'webhook',
        resource_id: webhookId,
        details: { url: webhook.url },
      });

      logger.info('Webhook deleted', { webhookId, userId });
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * List webhooks for a user
   */
  async listWebhooks(userId: string, agentId?: string): Promise<Webhook[]> {
    try {
      return await this.dbService.getWebhooks({
        user_id: userId,
        agent_id: agentId,
      });
    } catch (error) {
      logger.error('Failed to list webhooks:', error);
      throw error;
    }
  }
}
