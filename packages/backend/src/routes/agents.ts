import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { LLMIntegrationService } from '../services/llmIntegration';
import { FunctionRegistry } from '../services/functionRegistry';
import { TTSService } from '../services/tts';
import { STTService } from '../services/stt';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication
router.use(authenticateToken);

interface AgentConfig {
  name: string;
  description?: string;
  personality_tone?: string;
  personality_instructions?: string;
  language?: string;
  voice_id?: string;
  voice_model?: string;
  voice_speed?: number;
  voice_temperature?: number;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  functions_enabled?: boolean;
  knowledge_base_ids?: string[];
  webhook_url?: string;
  stt_provider?: string;
  tts_provider?: string;
  interruption_sensitivity?: number;
  response_delay?: number;
  end_call_phrases?: string[];
  max_call_duration?: number;
}

/**
 * Get all agents for user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const agents = await dbService.getAgentsByUserId(userId);

    res.json(agents);
  } catch (error) {
    logger.error('Failed to get agents:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

/**
 * Get agent by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const agent = await dbService.getAgentById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(agent);
  } catch (error) {
    logger.error('Failed to get agent:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * Create new agent
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const config: AgentConfig = req.body;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Validate required fields
    if (!config.name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    // Create agent in database
    const agent = await dbService.createAgent({
      user_id: userId,
      name: config.name,
      description: config.description,
      personality_tone: config.personality_tone,
      personality_instructions: config.personality_instructions,
      language: config.language || 'en-US',
      voice_id: config.voice_id,
      voice_model: config.voice_model || 'eleven_turbo_v2',
      voice_speed: config.voice_speed || 1.0,
      voice_temperature: config.voice_temperature || 0.7,
      llm_model: config.llm_model || 'gpt-4',
      llm_temperature: config.llm_temperature || 0.7,
      llm_max_tokens: config.llm_max_tokens || 1000,
      functions_enabled: config.functions_enabled !== false,
      knowledge_base_ids: config.knowledge_base_ids || [],
      webhook_url: config.webhook_url,
      stt_provider: config.stt_provider || 'openai',
      tts_provider: config.tts_provider || 'elevenlabs',
      interruption_sensitivity: config.interruption_sensitivity || 0.5,
      response_delay: config.response_delay || 0,
      end_call_phrases: config.end_call_phrases || ['goodbye', 'bye', 'thank you'],
      max_call_duration: config.max_call_duration || 3600000, // 1 hour
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('Agent created:', { agentId: agent.id, name: agent.name });

    res.status(201).json(agent);
  } catch (error) {
    logger.error('Failed to create agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * Update agent
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const updates: Partial<AgentConfig> = req.body;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update agent
    const updatedAgent = await dbService.updateAgent(id, {
      ...updates,
      updated_at: new Date()
    });

    logger.info('Agent updated:', { agentId: id });

    res.json(updatedAgent);
  } catch (error) {
    logger.error('Failed to update agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * Delete agent
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbService.deleteAgent(id);

    logger.info('Agent deleted:', { agentId: id });

    res.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    logger.error('Failed to delete agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

/**
 * Publish agent (make it active)
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate agent configuration
    if (!agent.voice_id) {
      return res.status(400).json({ error: 'Voice configuration required' });
    }
    if (!agent.llm_model) {
      return res.status(400).json({ error: 'LLM configuration required' });
    }

    // Update status to published
    const updatedAgent = await dbService.updateAgent(id, {
      status: 'published',
      published_at: new Date(),
      updated_at: new Date()
    });

    logger.info('Agent published:', { agentId: id });

    res.json(updatedAgent);
  } catch (error) {
    logger.error('Failed to publish agent:', error);
    res.status(500).json({ error: 'Failed to publish agent' });
  }
});

/**
 * Unpublish agent
 */
router.post('/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update status to draft
    const updatedAgent = await dbService.updateAgent(id, {
      status: 'draft',
      updated_at: new Date()
    });

    logger.info('Agent unpublished:', { agentId: id });

    res.json(updatedAgent);
  } catch (error) {
    logger.error('Failed to unpublish agent:', error);
    res.status(500).json({ error: 'Failed to unpublish agent' });
  }
});

/**
 * Test agent with a message
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = (req as any).user?.id;
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize LLM service
    const llmService = new LLMIntegrationService(functionRegistry);

    // Create conversation context
    const conversationId = `test_${Date.now()}`;
    const messages = llmService.convertConversationToMessages(
      [{ role: 'user', content: message }],
      agent,
      agent.functions_enabled
    );

    // Generate response
    const config = llmService.validateConfig({
      model: agent.llm_model,
      temperature: agent.llm_temperature,
      maxTokens: agent.llm_max_tokens,
      functionsEnabled: agent.functions_enabled
    });

    const response = await llmService.generateResponse(
      messages,
      config,
      {
        conversationId,
        agentId: id,
        userId
      }
    );

    logger.info('Agent test completed:', { agentId: id, messageLength: message.length });

    res.json({
      success: true,
      response: response.content,
      finishReason: response.finishReason,
      usage: response.usage,
      functionCall: response.functionCall
    });
  } catch (error) {
    logger.error('Failed to test agent:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test agent'
    });
  }
});

/**
 * Duplicate agent
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create duplicate
    const duplicate = await dbService.createAgent({
      ...agent,
      id: undefined,
      name: `${agent.name} (Copy)`,
      status: 'draft',
      published_at: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info('Agent duplicated:', { originalId: id, duplicateId: duplicate.id });

    res.status(201).json(duplicate);
  } catch (error) {
    logger.error('Failed to duplicate agent:', error);
    res.status(500).json({ error: 'Failed to duplicate agent' });
  }
});

/**
 * Get agent statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check ownership
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get statistics (implement based on your needs)
    const stats = {
      totalConversations: 0,
      totalMessages: 0,
      averageResponseTime: 0,
      successRate: 0,
      lastUsed: null
    };

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get agent stats:', error);
    res.status(500).json({ error: 'Failed to get agent stats' });
  }
});

export default router;
