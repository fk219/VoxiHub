import express from 'express';
import { DeploymentService } from '../services/deploymentService';
import { DatabaseService } from '../services/database';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const dbService = new DatabaseService();
const deploymentService = new DeploymentService(dbService);

/**
 * Create a new deployment
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, agentId, config } = req.body;
    const userId = (req as any).user.id;

    // Validate required fields
    if (!type || !agentId || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate deployment type
    if (!['twilio', 'chat_widget', 'voice_widget'].includes(type)) {
      return res.status(400).json({ error: 'Invalid deployment type' });
    }

    // Verify agent ownership
    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create deployment
    const deployment = await deploymentService.createDeployment(
      { type, agentId, config },
      userId
    );

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Error creating deployment:', error);
    res.status(500).json({ 
      error: 'Failed to create deployment',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get deployments for an agent
 */
router.get('/agent/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = (req as any).user.id;

    // Verify agent ownership
    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deployments = await deploymentService.getAgentDeployments(agentId);
    res.json(deployments);
  } catch (error) {
    logger.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

/**
 * Get deployment by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const deployment = await deploymentService.getDeployment(id);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify agent ownership
    const agent = await dbService.getAgentById(deployment.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(deployment);
  } catch (error) {
    logger.error('Error fetching deployment:', error);
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
});

/**
 * Delete deployment
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const deployment = await deploymentService.getDeployment(id);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify agent ownership
    const agent = await dbService.getAgentById(deployment.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deploymentService.deleteDeployment(id);
    res.json({ message: 'Deployment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting deployment:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

/**
 * Update deployment status
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.id;

    if (!['active', 'inactive', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const deployment = await deploymentService.getDeployment(id);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify agent ownership
    const agent = await dbService.getAgentById(deployment.agent_id);
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deploymentService.updateDeploymentStatus(id, status);
    res.json({ message: 'Deployment status updated successfully' });
  } catch (error) {
    logger.error('Error updating deployment status:', error);
    res.status(500).json({ error: 'Failed to update deployment status' });
  }
});

/**
 * Twilio webhook handler
 */
router.post('/twilio/webhook/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const twilioData = req.body;

    logger.info('Twilio webhook received', {
      agentId,
      from: twilioData.From,
      to: twilioData.To,
      callSid: twilioData.CallSid
    });

    // Get agent configuration
    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).send('Agent not found');
    }

    // Generate TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! You've reached ${agent.name}. Please hold while I connect you.</Say>
  <Dial>
    <Stream url="wss://${process.env.API_BASE_URL?.replace('https://', '').replace('http://', '')}/api/deployments/twilio/stream/${agentId}" />
  </Dial>
</Response>`;

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling Twilio webhook:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Chat widget API endpoint
 */
router.post('/chat/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get agent
    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Process message through LLM
    // This would integrate with your existing LLM service
    const response = {
      message: `Echo from ${agent.name}: ${message}`,
      conversationId: conversationId || `conv_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error handling chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Voice widget API endpoint
 */
router.post('/voice/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { action } = req.body;

    // Get agent
    const agent = await dbService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (action === 'start') {
      // Initialize voice call
      const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        sessionId,
        wsUrl: `wss://${process.env.API_BASE_URL?.replace('https://', '').replace('http://', '')}/api/deployments/voice/stream/${agentId}/${sessionId}`,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    logger.error('Error handling voice request:', error);
    res.status(500).json({ error: 'Failed to process voice request' });
  }
});

export default router;
