import express from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { ApiKeyService } from '../../../services/apiKeyService';
import { DatabaseService } from '../../../services/database';
import { AuditService } from '../../../services/auditService';
import { logger } from '../../../utils/logger';

const router = express.Router();
const dbService = new DatabaseService();
const auditService = new AuditService(dbService);
const apiKeyService = new ApiKeyService(dbService, auditService);

/**
 * @swagger
 * /api/v1/api-keys:
 *   get:
 *     summary: List all API keys for the authenticated user
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 */
router.get('/', authenticateToken(auditService), async (req, res) => {
  try {
    const apiKeys = await apiKeyService.listApiKeys(req.user!.id);

    // Don't return the key hash
    const sanitizedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      rate_limit: key.rate_limit,
      usage_quota: key.usage_quota,
      usage_count: key.usage_count,
      enabled: key.enabled,
      scopes: key.scopes,
      created_at: key.created_at,
    }));

    res.json({ data: sanitizedKeys });
  } catch (error) {
    logger.error('Failed to list API keys:', error);
    res.status(500).json({
      error: 'Failed to list API keys',
      code: 'API_KEYS_LIST_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     summary: Create a new API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               expires_in_days:
 *                 type: number
 *               rate_limit:
 *                 type: number
 *               usage_quota:
 *                 type: number
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: API key created (key is only shown once)
 */
router.post('/', authenticateToken(auditService), async (req, res) => {
  try {
    const { name, expires_in_days, rate_limit, usage_quota, scopes } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const { apiKey, plainKey } = await apiKeyService.createApiKey({
      user_id: req.user!.id,
      name,
      expires_in_days,
      rate_limit,
      usage_quota,
      scopes,
    });

    res.status(201).json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey, // Only returned once!
        key_prefix: apiKey.key_prefix,
        expires_at: apiKey.expires_at,
        rate_limit: apiKey.rate_limit,
        usage_quota: apiKey.usage_quota,
        scopes: apiKey.scopes,
        created_at: apiKey.created_at,
      },
      message: 'API key created successfully. Save this key securely - it will not be shown again.',
    });
  } catch (error) {
    logger.error('Failed to create API key:', error);
    res.status(500).json({
      error: 'Failed to create API key',
      code: 'API_KEY_CREATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/api-keys/{id}:
 *   patch:
 *     summary: Update an API key
 *     tags: [API Keys]
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
 *         description: API key updated
 */
router.patch('/:id', authenticateToken(auditService), async (req, res) => {
  try {
    const { name, rate_limit, usage_quota, scopes } = req.body;

    const updatedKey = await apiKeyService.updateApiKey(req.params.id, req.user!.id, {
      name,
      rate_limit,
      usage_quota,
      scopes,
    });

    res.json({
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        key_prefix: updatedKey.key_prefix,
        rate_limit: updatedKey.rate_limit,
        usage_quota: updatedKey.usage_quota,
        scopes: updatedKey.scopes,
        updated_at: updatedKey.updated_at,
      },
    });
  } catch (error) {
    logger.error('Failed to update API key:', error);
    res.status(500).json({
      error: 'Failed to update API key',
      code: 'API_KEY_UPDATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     tags: [API Keys]
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
 *         description: API key revoked
 */
router.post('/:id/revoke', authenticateToken(auditService), async (req, res) => {
  try {
    await apiKeyService.revokeApiKey(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    logger.error('Failed to revoke API key:', error);
    res.status(500).json({
      error: 'Failed to revoke API key',
      code: 'API_KEY_REVOKE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     tags: [API Keys]
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
 *         description: API key deleted
 */
router.delete('/:id', authenticateToken(auditService), async (req, res) => {
  try {
    await apiKeyService.deleteApiKey(req.params.id, req.user!.id);

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete API key:', error);
    res.status(500).json({
      error: 'Failed to delete API key',
      code: 'API_KEY_DELETE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/api-keys/{id}/stats:
 *   get:
 *     summary: Get API key usage statistics
 *     tags: [API Keys]
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
 *         description: API key statistics
 */
router.get('/:id/stats', authenticateToken(auditService), async (req, res) => {
  try {
    const stats = await apiKeyService.getApiKeyStats(req.params.id, req.user!.id);

    res.json({ data: stats });
  } catch (error) {
    logger.error('Failed to get API key stats:', error);
    res.status(500).json({
      error: 'Failed to get API key stats',
      code: 'API_KEY_STATS_FAILED',
    });
  }
});

export default router;
