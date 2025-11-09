import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { LangChainAgentService } from '../services/langchainAgent';
import { VectorStoreService } from '../services/vectorStore';
import { FunctionRegistry } from '../services/functionRegistry';
import { createGroqAudioService } from '../services/groqAudio';
import { logger } from '../utils/logger';
import multer from 'multer';

const router = Router();

// Initialize services
const vectorStore = new VectorStoreService();
const groqAudio = createGroqAudioService();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * Unified Chat Endpoint - Powered by LangChain
 * Automatically uses:
 * - Vector search for knowledge bases
 * - Tool calling for functions
 * - MCP tools integration
 * - Conversation memory
 */
router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, conversationHistory, streaming } = req.body;
    
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

    // Initialize LangChain service
    const langchainService = new LangChainAgentService(vectorStore, functionRegistry);

    // Configure agent with all capabilities
    const agentConfig = {
      agentId: agent.id,
      llmProvider: (agent.llm_provider || 'groq') as 'openai' | 'anthropic' | 'groq',
      llmModel: agent.llm_model,
      temperature: agent.llm_temperature || 0.7,
      knowledgeBaseIds: agent.knowledge_base_ids || [],
      enabledFunctions: agent.functions_enabled ? ['get_current_time', 'calculate'] : [],
      personalityInstructions: agent.personality_instructions || 'You are a helpful AI assistant.',
      streaming: streaming ?? false
    };

    const convId = conversationHistory?.[0]?.conversationId || `conv_${id}_${Date.now()}`;

    // Execute with LangChain
    if (streaming) {
      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await langchainService.executeAgent(
        agentConfig,
        message,
        convId,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ 
        chunk: '', 
        done: true, 
        response: result.response,
        latency: result.latency,
        conversationId: convId
      })}\n\n`);
      res.end();

    } else {
      // Non-streaming response
      const result = await langchainService.executeAgent(
        agentConfig,
        message,
        convId
      );

      logger.info('Agent chat completed', { 
        agentId: id, 
        latency: result.latency,
        hasKB: agentConfig.knowledgeBaseIds.length > 0,
        toolsEnabled: agentConfig.enabledFunctions.length > 0
      });

      res.json({
        success: true,
        response: result.response,
        latency: result.latency,
        conversationId: convId,
        timestamp: new Date().toISOString(),
        capabilities: {
          knowledgeBases: agentConfig.knowledgeBaseIds.length,
          tools: agentConfig.enabledFunctions.length,
          vectorSearch: agentConfig.knowledgeBaseIds.length > 0,
          memory: true
        }
      });
    }

  } catch (error) {
    logger.error('Chat failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process message'
    });
  }
});

/**
 * Voice Chat Endpoint - Ultra-low latency with Groq
 */
router.post('/:id/voice', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { conversationId } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Get agent
    const agent = await dbService.getAgentById(id) as any;
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const startTime = Date.now();

    // Step 1: STT - Convert audio to text (Groq Whisper - ultra fast)
    logger.info('Starting STT...', { agentId: id });
    const transcriptionResult = await groqAudio.transcribe(audioFile.buffer);
    const transcription = typeof transcriptionResult === 'string' ? transcriptionResult : transcriptionResult.text;
    const sttLatency = Date.now() - startTime;
    logger.info('STT completed', { latency: sttLatency, text: transcription });

    // Step 2: LangChain Agent - Process message
    const langchainService = new LangChainAgentService(vectorStore, functionRegistry);
    
    const agentConfig = {
      agentId: agent.id,
      llmProvider: 'groq' as const, // Always use Groq for voice (fastest)
      llmModel: agent.llm_model || 'llama-3.3-70b-versatile',
      temperature: agent.llm_temperature || 0.7,
      knowledgeBaseIds: agent.knowledge_base_ids || [],
      enabledFunctions: agent.functions_enabled ? ['get_current_time', 'calculate'] : [],
      personalityInstructions: agent.personality_instructions,
      streaming: false
    };

    const convId = conversationId || `voice_${id}_${Date.now()}`;
    
    const agentResult = await langchainService.executeAgent(
      agentConfig,
      transcription,
      convId
    );
    const agentLatency = Date.now() - startTime - sttLatency;

    // Step 3: TTS - Convert response to audio (Groq TTS - ultra fast)
    logger.info('Starting TTS...', { agentId: id });
    const audioResponse = await groqAudio.synthesize(agentResult.response);
    const ttsLatency = Date.now() - startTime - sttLatency - agentLatency;

    const totalLatency = Date.now() - startTime;

    logger.info('Voice chat completed', {
      agentId: id,
      totalLatency,
      sttLatency,
      agentLatency,
      ttsLatency
    });

    // Return audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Transcription', encodeURIComponent(transcription));
    res.setHeader('X-Response-Text', encodeURIComponent(agentResult.response));
    res.setHeader('X-Total-Latency', totalLatency.toString());
    res.setHeader('X-STT-Latency', sttLatency.toString());
    res.setHeader('X-Agent-Latency', agentLatency.toString());
    res.setHeader('X-TTS-Latency', ttsLatency.toString());
    res.send(audioResponse);

  } catch (error) {
    logger.error('Voice chat failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice'
    });
  }
});

/**
 * Get agent capabilities and statistics
 */
router.get('/:id/capabilities', async (req: Request, res: Response) => {
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
      name: agent.name,
      capabilities: {
        llmProvider: agent.llm_provider || 'groq',
        knowledgeBases: {
          count: (agent.knowledge_base_ids || []).length,
          ids: agent.knowledge_base_ids || [],
          stats: kbStats,
          vectorSearch: true
        },
        tools: {
          enabled: agent.functions_enabled || false,
          available: ['get_current_time', 'calculate', 'search_knowledge_base']
        },
        voice: {
          stt: 'groq-whisper',
          tts: 'groq-tts',
          supported: true
        },
        memory: {
          enabled: true,
          type: 'conversation-buffer'
        },
        streaming: {
          supported: true,
          realtime: true
        }
      },
      performance: {
        targetLatency: '< 2s',
        llmLatency: '< 1s (Groq)',
        vectorSearch: '< 100ms',
        voiceLatency: '< 3s (end-to-end)'
      }
    });

  } catch (error) {
    logger.error('Failed to get capabilities:', error);
    res.status(500).json({ error: 'Failed to get agent capabilities' });
  }
});

export default router;
