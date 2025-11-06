import { Router, Request, Response } from 'express';
import { AgentService } from '../services/agent';
import { DatabaseService } from '../services/database';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../index';

const router = Router();
const dbService = new DatabaseService();
const agentService = new AgentService(dbService);

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/agents
 * Create a new agent
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agent = await agentService.createAgent(userId, req.body);
    
    logger.info(`Agent created: ${agent.id} by user: ${userId}`);
    res.status(201).json(agent);
  } catch (error) {
    logger.error('Failed to create agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to create agent';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/agents
 * Get all agents for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const agents = await agentService.getAgents(userId, limit, offset);
    res.json(agents);
  } catch (error) {
    logger.error('Failed to get agents:', error);
    const message = error instanceof Error ? error.message : 'Failed to get agents';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/agents/:id
 * Get a specific agent by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    const includeConfig = req.query.include_config === 'true';
    
    const agent = await agentService.getAgent(agentId, userId, includeConfig);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(agent);
  } catch (error) {
    logger.error('Failed to get agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to get agent';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/agents/:id
 * Update an agent
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const updatedAgent = await agentService.updateAgent(agentId, userId, req.body);
    
    logger.info(`Agent updated: ${agentId} by user: ${userId}`);
    res.json(updatedAgent);
  } catch (error) {
    logger.error('Failed to update agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to update agent';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    await agentService.deleteAgent(agentId, userId);
    
    logger.info(`Agent deleted: ${agentId} by user: ${userId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete agent:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete agent';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /api/agents/:id/knowledge-base/documents
 * Add a knowledge base document to an agent
 */
router.post('/:id/knowledge-base/documents', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const documentData = {
      ...req.body,
      agent_id: agentId
    };
    
    const document = await agentService.addKnowledgeBaseDocument(documentData, userId);
    
    logger.info(`Knowledge base document added to agent: ${agentId} by user: ${userId}`);
    res.status(201).json(document);
  } catch (error) {
    logger.error('Failed to add knowledge base document:', error);
    const message = error instanceof Error ? error.message : 'Failed to add knowledge base document';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

/**
 * GET /api/agents/:id/knowledge-base/documents
 * Get knowledge base documents for an agent
 */
router.get('/:id/knowledge-base/documents', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const documents = await agentService.getKnowledgeBaseDocuments(agentId, userId);
    res.json(documents);
  } catch (error) {
    logger.error('Failed to get knowledge base documents:', error);
    const message = error instanceof Error ? error.message : 'Failed to get knowledge base documents';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * DELETE /api/agents/knowledge-base/documents/:documentId
 * Delete a knowledge base document
 */
router.delete('/knowledge-base/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const documentId = req.params.documentId;
    
    await agentService.deleteKnowledgeBaseDocument(documentId, userId);
    
    logger.info(`Knowledge base document deleted: ${documentId} by user: ${userId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete knowledge base document:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete knowledge base document';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /api/agents/:id/widget-config
 * Create or update widget configuration for an agent
 */
router.post('/:id/widget-config', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const configData = {
      ...req.body,
      agent_id: agentId
    };
    
    const config = await agentService.upsertWidgetConfig(configData, userId);
    
    logger.info(`Widget config updated for agent: ${agentId} by user: ${userId}`);
    res.json(config);
  } catch (error) {
    logger.error('Failed to save widget config:', error);
    const message = error instanceof Error ? error.message : 'Failed to save widget config';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

/**
 * POST /api/agents/:id/sip-config
 * Create or update SIP configuration for an agent
 */
router.post('/:id/sip-config', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const configData = {
      ...req.body,
      agent_id: agentId
    };
    
    const config = await agentService.upsertSipConfig(configData, userId);
    
    logger.info(`SIP config updated for agent: ${agentId} by user: ${userId}`);
    res.json(config);
  } catch (error) {
    logger.error('Failed to save SIP config:', error);
    const message = error instanceof Error ? error.message : 'Failed to save SIP config';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

/**
 * GET /api/agents/:id/deployment-status
 * Get deployment status for an agent
 */
router.get('/:id/deployment-status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const status = await agentService.getDeploymentStatus(agentId, userId);
    res.json(status);
  } catch (error) {
    logger.error('Failed to get deployment status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get deployment status';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * GET /api/agents/:id/widget-code
 * Generate widget embed code for an agent
 */
router.get('/:id/widget-code', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agentId = req.params.id;
    
    const codeData = await agentService.generateWidgetCode(agentId, userId);
    res.json(codeData);
  } catch (error) {
    logger.error('Failed to generate widget code:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate widget code';
    
    if (message.includes('not found') || message.includes('access denied')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;