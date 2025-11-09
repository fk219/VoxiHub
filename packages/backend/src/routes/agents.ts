import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { LLMIntegrationService } from '../services/llmIntegration';
import { FunctionRegistry } from '../services/functionRegistry';
import { TTSService } from '../services/tts';
import { STTService } from '../services/stt';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// No authentication required for MVP

interface AgentConfig {
  name: string;
  description?: string;
  personality_tone?: string;
  personality_instructions?: string;
  language?: string;
  stt_language?: string;
  voice_id?: string;
  tts_voice?: string;
  voice_model?: string;
  voice_speed?: number;
  tts_speed?: number;
  voice_temperature?: number;
  llm_provider?: string;
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
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Get all agents (no user filter)
    const agents = await dbService.getAllAgents();

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
    const dbService: DatabaseService = (req.app as any).get('dbService');

    const agent = await dbService.getAgentById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
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
    const config: AgentConfig = req.body;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Validate required fields
    if (!config.name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    // No authentication - use NULL for user_id (will be handled by database)
    // Create agent in database with all provided fields
    const agentData: any = {
      user_id: null as any, // No user required
      name: config.name,
      description: config.description,
      personality_tone: config.personality_tone || 'professional',
      personality_style: config.personality_instructions,
      personality_instructions: config.personality_instructions,
      response_time: config.response_delay || 1000,
      max_conversation_length: config.max_call_duration ? Math.floor(config.max_call_duration / 60000) : 50,
      escalation_triggers: config.end_call_phrases || ['goodbye', 'bye', 'thank you'],
      
      // LLM configuration
      llm_provider: config.llm_provider || 'openai',
      llm_model: config.llm_model || 'gpt-4-turbo-preview',
      llm_temperature: config.llm_temperature || 0.7,
      llm_max_tokens: config.llm_max_tokens || 1000,
      
      // TTS configuration
      tts_provider: config.tts_provider || 'groq',
      tts_voice: config.tts_voice || config.voice_id || 'Fritz-PlayAI',
      tts_speed: config.tts_speed || config.voice_speed || 1.0,
      
      // STT configuration
      stt_provider: config.stt_provider || 'groq',
      stt_language: config.stt_language || config.language || 'en',
      
      // Advanced features
      functions_enabled: config.functions_enabled !== undefined ? config.functions_enabled : true,
      knowledge_base_ids: config.knowledge_base_ids || [],
      interruption_sensitivity: config.interruption_sensitivity || 0.5,
      webhook_url: config.webhook_url || ''
    };

    const agent = await dbService.createAgent(agentData);

    logger.info('Agent created:', { agentId: agent.id, name: agent.name });

    res.status(201).json(agent);
  } catch (error) {
    logger.error('Failed to create agent:', error);
    console.error('Create agent error details:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * Update agent
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config: Partial<AgentConfig> = req.body;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Map frontend fields to database schema fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that are provided and exist in schema
    if (config.name !== undefined) updateData.name = config.name;
    if (config.description !== undefined) updateData.description = config.description;
    if (config.personality_tone !== undefined) updateData.personality_tone = config.personality_tone;
    if (config.personality_instructions !== undefined) {
      updateData.personality_style = config.personality_instructions;
      updateData.personality_instructions = config.personality_instructions;
    }
    if (config.response_delay !== undefined) updateData.response_time = config.response_delay;
    if (config.max_call_duration !== undefined) {
      updateData.max_conversation_length = Math.floor(config.max_call_duration / 60000);
    }
    if (config.end_call_phrases !== undefined) updateData.escalation_triggers = config.end_call_phrases;
    
    // Store LLM, TTS, STT, and other config in metadata or separate fields if they exist
    if (config.llm_provider !== undefined) updateData.llm_provider = config.llm_provider;
    if (config.llm_model !== undefined) updateData.llm_model = config.llm_model;
    if (config.llm_temperature !== undefined) updateData.llm_temperature = config.llm_temperature;
    if (config.llm_max_tokens !== undefined) updateData.llm_max_tokens = config.llm_max_tokens;
    if (config.tts_provider !== undefined) updateData.tts_provider = config.tts_provider;
    if (config.tts_voice !== undefined) updateData.tts_voice = config.tts_voice;
    if (config.voice_id !== undefined) updateData.tts_voice = config.voice_id; // Support both field names
    if (config.tts_speed !== undefined) updateData.tts_speed = config.tts_speed;
    if (config.voice_speed !== undefined) updateData.tts_speed = config.voice_speed; // Support both field names
    if (config.stt_provider !== undefined) updateData.stt_provider = config.stt_provider;
    if (config.stt_language !== undefined) updateData.stt_language = config.stt_language;
    if (config.language !== undefined) updateData.stt_language = config.language; // Support both field names
    if (config.functions_enabled !== undefined) updateData.functions_enabled = config.functions_enabled;
    if (config.knowledge_base_ids !== undefined) updateData.knowledge_base_ids = config.knowledge_base_ids;
    if (config.interruption_sensitivity !== undefined) updateData.interruption_sensitivity = config.interruption_sensitivity;
    if (config.webhook_url !== undefined) updateData.webhook_url = config.webhook_url;

    // Update agent
    const updatedAgent = await dbService.updateAgent(id, updateData);

    logger.info('Agent updated:', { agentId: id });

    res.json(updatedAgent);
  } catch (error) {
    logger.error('Failed to update agent:', error);
    console.error('Update agent error details:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * Delete agent
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
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
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Update status to published
    const updatedAgent = await dbService.updateAgent(id, {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Update status to draft
    const updatedAgent = await dbService.updateAgent(id, {
      status: 'draft',
      updated_at: new Date().toISOString()
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
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
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
        userId: 'test-user'
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
    const dbService: DatabaseService = (req.app as any).get('dbService');

    // Check if agent exists
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Create duplicate
    const { id: _id, created_at: _created, updated_at: _updated, ...agentData } = agent;
    const duplicate = await dbService.createAgent({
      ...agentData,
      name: `${agent.name} (Copy)`,
      status: 'draft',
      published_at: null
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
