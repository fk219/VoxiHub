import express from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { WebhookService, WebhookEvent } from '../../../services/webhookService';
import { DatabaseService } from '../../../services/database';
import { AuditService } from '../../../services/auditService';
import { logger } from '../../../utils/logger';

const router = express.Router();
const dbService = new DatabaseService();
const auditService = new AuditService(dbService);
const webhookService = new WebhookService(dbService, auditService);

/**
 * @swagger
 * /api/v1/webhooks:
 *   get:
 *     summary: List all webhooks for the authenticated user
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: agent_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of webhooks
 */
router.get('/', authenticateToken(auditService), async (req, res) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const webhooks = await webhookService.listWebhooks(req.user!.id, agentId);

    // Don't return the secret
    const sanitizedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      agent_id: webhook.agent_id,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      retry_count: webhook.retry_count,
      last_triggered_at: webhook.last_triggered_at,
      last_status: webhook.last_status,
      last_error: webhook.last_error,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
    }));

    res.json({ data: sanitizedWebhooks });
  } catch (error) {
    logger.error('Failed to list webhooks:', error);
    res.status(500).json({
      error: 'Failed to list webhooks',
      code: 'WEBHOOKS_LIST_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *               agent_id:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Webhook created
 */
router.post('/', authenticateToken(auditService), async (req, res) => {
  try {
    const { url, agent_id, events } = req.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'URL and events are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL',
      });
    }

    // Validate events
    const validEvents = Object.values(WebhookEvent);
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        error: 'Invalid webhook events',
        code: 'INVALID_EVENTS',
        invalid_events: invalidEvents,
        valid_events: validEvents,
      });
    }

    const webhook = await webhookService.createWebhook({
      user_id: req.user!.id,
      agent_id,
      url,
      events,
    });

    res.status(201).json({
      data: {
        id: webhook.id,
        agent_id: webhook.agent_id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Return secret only on creation
        enabled: webhook.enabled,
        retry_count: webhook.retry_count,
        created_at: webhook.created_at,
      },
      message: 'Webhook created successfully. Save the secret securely - it will not be shown again.',
    });
  } catch (error) {
    logger.error('Failed to create webhook:', error);
    res.status(500).json({
      error: 'Failed to create webhook',
      code: 'WEBHOOK_CREATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/{id}:
 *   patch:
 *     summary: Update a webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook updated
 */
router.patch('/:id', authenticateToken(auditService), async (req, res) => {
  try {
    const { url, events, enabled, retry_count } = req.body;

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          error: 'Invalid URL format',
          code: 'INVALID_URL',
        });
      }
    }

    // Validate events if provided
    if (events) {
      const validEvents = Object.values(WebhookEvent);
      const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          error: 'Invalid webhook events',
          code: 'INVALID_EVENTS',
          invalid_events: invalidEvents,
        });
      }
    }

    const updatedWebhook = await webhookService.updateWebhook(req.params.id, req.user!.id, {
      url,
      events,
      enabled,
      retry_count,
    });

    res.json({
      data: {
        id: updatedWebhook.id,
        agent_id: updatedWebhook.agent_id,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        enabled: updatedWebhook.enabled,
        retry_count: updatedWebhook.retry_count,
        updated_at: updatedWebhook.updated_at,
      },
    });
  } catch (error) {
    logger.error('Failed to update webhook:', error);
    res.status(500).json({
      error: 'Failed to update webhook',
      code: 'WEBHOOK_UPDATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Webhook deleted
 */
router.delete('/:id', authenticateToken(auditService), async (req, res) => {
  try {
    await webhookService.deleteWebhook(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete webhook:', error);
    res.status(500).json({
      error: 'Failed to delete webhook',
      code: 'WEBHOOK_DELETE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/{id}/test:
 *   post:
 *     summary: Test webhook delivery
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test result
 */
router.post('/:id/test', authenticateToken(auditService), async (req, res) => {
  try {
    const result = await webhookService.testWebhook(req.params.id, req.user!.id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook test successful',
        status_code: result.statusCode,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook test failed',
        status_code: result.statusCode,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Failed to test webhook:', error);
    res.status(500).json({
      error: 'Failed to test webhook',
      code: 'WEBHOOK_TEST_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/{id}/logs:
 *   get:
 *     summary: Get webhook delivery logs
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Webhook delivery logs
 */
router.get('/:id/logs', authenticateToken(auditService), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await webhookService.getWebhookLogs(req.params.id, limit);

    res.json({ data: logs });
  } catch (error) {
    logger.error('Failed to get webhook logs:', error);
    res.status(500).json({
      error: 'Failed to get webhook logs',
      code: 'WEBHOOK_LOGS_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/webhooks/events:
 *   get:
 *     summary: Get list of available webhook events
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: List of webhook events
 */
router.get('/events', async (req, res) => {
  const events = Object.values(WebhookEvent).map(event => ({
    name: event,
    description: getEventDescription(event),
  }));

  res.json({ data: events });
});

function getEventDescription(event: WebhookEvent): string {
  const descriptions: Record<WebhookEvent, string> = {
    [WebhookEvent.CALL_STARTED]: 'Triggered when a call is initiated',
    [WebhookEvent.CALL_ENDED]: 'Triggered when a call ends normally',
    [WebhookEvent.CALL_FAILED]: 'Triggered when a call fails',
    [WebhookEvent.CONVERSATION_UPDATED]: 'Triggered when a conversation is updated',
    [WebhookEvent.CONVERSATION_ENDED]: 'Triggered when a conversation ends',
    [WebhookEvent.AGENT_DEPLOYED]: 'Triggered when an agent is deployed',
    [WebhookEvent.AGENT_UPDATED]: 'Triggered when an agent is updated',
    [WebhookEvent.FUNCTION_EXECUTED]: 'Triggered when a function is executed',
    [WebhookEvent.ERROR_OCCURRED]: 'Triggered when an error occurs',
  };

  return descriptions[event] || 'No description available';
}

export default router;
