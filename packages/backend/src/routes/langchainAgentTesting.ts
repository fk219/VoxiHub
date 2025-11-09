import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { LangChainAgentService } from '../services/langchainAgent';
import { VectorStoreService } from '../services/vectorStore';
import { MCPToolsService } from '../services/mcpTools';
import { FunctionRegistry } from '../services/functionRegistry';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const vectorStore = new VectorStoreService();
const mcpTools = new MCPToolsService();

/**
 * Chat with LangChain agent (optimized for low latency)
 */
router.post('/:id/langchain-chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, conversationId, streaming } = req.body;
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Get agent
    const agent = await dbService.getAgentById(id) as any;
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize LangChain agent service
    const langchainService = new LangChainAgentService(vectorStore, functionRegistry);

    // Configure agent
    const agentConfig = {
      agentId: agent.id,
      llmProvider: agent.llm_provider || 'groq', // Default to Groq for low latency
      llmModel: agent.llm_model,
      temperature: agent.llm_temperature || 0.7,
      knowledgeBaseIds: agent.knowledge_base_ids || [],
      enabledFunctions: agent.functions_enabled ? ['get_current_time', 'calculate', 'get_weather'] : [],
      personalityInstructions: agent.personality_instructions,
      streaming: streaming ?? false
    };

    const convId = conversationId || `conv_${Date.now()}`;

    // Execute agent
    if (streaming) {
      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      const result = await langchainService.executeAgent(
        agentConfig,
        message,
        convId,
        (chunk: string) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
        }
      );

      // Send final message
      res.write(`data: ${JSON.stringify({ 
        chunk: '', 
        done: true, 
        response: result.response,
        latency: result.latency 
      })}\n\n`);
      res.end();

    } else {
      // Non-streaming response
      const result = await langchainService.executeAgent(
        agentConfig,
        message,
        convId
      );

      logger.info('LangChain agent completed', { 
        agentId: id, 
        latency: result.latency,
        conversationId: convId
      });

      res.json({
        success: true,
        response: result.response,
        latency: result.latency,
        conversationId: convId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('LangChain agent failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process message'
    });
  }
});

/**
 * Voice chat with LangChain agent (ultra-low latency)
 */
router.post('/:id/langchain-voice', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { audioData, conversationId } = req.body;
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Get agent
    const agent = await dbService.getAgentById(id) as any;
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // TODO: Implement voice processing
    // 1. STT: Convert audio to text (using Groq Whisper - ultra fast)
    // 2. LangChain: Process with agent
    // 3. TTS: Convert response to audio (using Groq TTS - ultra fast)

    res.json({
      success: true,
      message: 'Voice processing not yet implemented',
      note: 'Will use Groq for STT and TTS for ultra-low latency'
    });

  } catch (error) {
    logger.error('Voice processing failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice'
    });
  }
});

/**
 * Get agent statistics
 */
router.get('/:id/langchain-stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const agent = await dbService.getAgentById(id) as any;
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get vector store stats
    const kbStats = (agent.knowledge_base_ids || []).map((kbId: string) => ({
      kbId,
      ...vectorStore.getStats(kbId)
    }));

    res.json({
      agentId: id,
      knowledgeBases: kbStats,
      cacheStatus: 'active',
      provider: agent.llm_provider || 'groq'
    });

  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
