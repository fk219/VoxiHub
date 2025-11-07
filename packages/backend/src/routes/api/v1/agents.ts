import express from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { requirePermission, Permission } from '../../../middleware/rbac';
import { DatabaseService } from '../../../services/database';
import { AuditService, AuditAction } from '../../../services/auditService';
import { logger } from '../../../utils/logger';

const router = express.Router();
const dbService = new DatabaseService();
const auditService = new AuditService(dbService);

/**
 * @swagger
 * /api/v1/agents:
 *   get:
 *     summary: List all agents
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of agents
 *       401:
 *         description: Unauthorized
 */
router.get('/', 
  authenticateToken(auditService),
  requirePermission(Permission.READ_AGENT),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const agents = await dbService.getAgentsByUserId(req.user!.id, limit, offset);

      res.json({
        data: agents,
        meta: {
          limit,
          offset,
          total: agents.length
        }
      });
    } catch (error) {
      logger.error('Failed to list agents:', error);
      res.status(500).json({
        error: 'Failed to list agents',
        code: 'AGENTS_LIST_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [Agents]
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
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */
router.get('/:id',
  authenticateToken(auditService),
  requirePermission(Permission.READ_AGENT),
  async (req, res) => {
    try {
      const agent = await dbService.getAgentById(req.params.id, req.user!.id);

      if (!agent) {
        return res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
      }

      res.json({ data: agent });
    } catch (error) {
      logger.error('Failed to get agent:', error);
      res.status(500).json({
        error: 'Failed to get agent',
        code: 'AGENT_GET_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
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
 *               description:
 *                 type: string
 *               personality_tone:
 *                 type: string
 *                 enum: [professional, friendly, casual, formal]
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Invalid input
 */
router.post('/',
  authenticateToken(auditService),
  requirePermission(Permission.CREATE_AGENT),
  async (req, res) => {
    try {
      const { name, description, personality_tone, personality_style, personality_instructions } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Name is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const agent = await dbService.createAgent({
        user_id: req.user!.id,
        name,
        description,
        personality_tone: personality_tone || 'professional',
        personality_style,
        personality_instructions
      });

      await auditService.logAgentEvent(
        AuditAction.AGENT_CREATED,
        req.user!.id,
        agent.id,
        req.ip,
        { name, personality_tone }
      );

      res.status(201).json({ data: agent });
    } catch (error) {
      logger.error('Failed to create agent:', error);
      res.status(500).json({
        error: 'Failed to create agent',
        code: 'AGENT_CREATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   put:
 *     summary: Update an agent
 *     tags: [Agents]
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
 *         description: Agent updated
 *       404:
 *         description: Agent not found
 */
router.put('/:id',
  authenticateToken(auditService),
  requirePermission(Permission.UPDATE_AGENT),
  async (req, res) => {
    try {
      const agent = await dbService.getAgentById(req.params.id, req.user!.id);

      if (!agent) {
        return res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
      }

      const updatedAgent = await dbService.updateAgent(req.params.id, req.body);

      await auditService.logAgentEvent(
        AuditAction.AGENT_UPDATED,
        req.user!.id,
        agent.id,
        req.ip,
        { updates: Object.keys(req.body) }
      );

      res.json({ data: updatedAgent });
    } catch (error) {
      logger.error('Failed to update agent:', error);
      res.status(500).json({
        error: 'Failed to update agent',
        code: 'AGENT_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
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
 *         description: Agent deleted
 *       404:
 *         description: Agent not found
 */
router.delete('/:id',
  authenticateToken(auditService),
  requirePermission(Permission.DELETE_AGENT),
  async (req, res) => {
    try {
      const agent = await dbService.getAgentById(req.params.id, req.user!.id);

      if (!agent) {
        return res.status(404).json({
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        });
      }

      await dbService.deleteAgent(req.params.id);

      await auditService.logAgentEvent(
        AuditAction.AGENT_DELETED,
        req.user!.id,
        agent.id,
        req.ip,
        { name: agent.name }
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete agent:', error);
      res.status(500).json({
        error: 'Failed to delete agent',
        code: 'AGENT_DELETE_FAILED'
      });
    }
  }
);

export default router;
