import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { MultiLLMService, LLMProvider } from '../services/multiLLMService';
import { FunctionRegistry } from '../services/functionRegistry';
import { createGroqAudioService } from '../services/groqAudio';
import { logger } from '../utils/logger';
import multer from 'multer';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit (Groq free tier)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

// Initialize Groq Audio Service (provides both STT and TTS for free!)
const groqAudio = createGroqAudioService();

/**
 * Chat test endpoint - send text message and get text response
 */
router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, conversationHistory } = req.body;
    
    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Get agent (with knowledge_base_ids support)
    const agent = await dbService.getAgentById(id) as any;
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize Multi-LLM service with Groq as default
    const llmService = new MultiLLMService(LLMProvider.GROQ);

    // Build conversation history
    const history = conversationHistory || [];
    history.push({ role: 'user', content: message });

    // Create messages for Groq - convert 'agent' role to 'assistant'
    const messages = history.map(msg => ({
      role: (msg.role === 'agent' ? 'assistant' : msg.role) as 'system' | 'user' | 'assistant',
      content: msg.content
    }));

    // Search knowledge bases if attached
    let knowledgeContext = '';
    console.log('\n🔍 CHECKING KNOWLEDGE BASES...');
    console.log('Agent KB IDs:', agent.knowledge_base_ids);
    console.log('Has KBs:', agent.knowledge_base_ids && agent.knowledge_base_ids.length > 0);
    
    if (agent.knowledge_base_ids && agent.knowledge_base_ids.length > 0) {
      console.log('📚 Searching', agent.knowledge_base_ids.length, 'knowledge bases for:', message);
      
      try {
        // Search all attached knowledge bases
        const searchPromises = agent.knowledge_base_ids.map(async (kbId) => {
          console.log('  Searching KB:', kbId);
          try {
            const axios = require('axios');
            const searchResponse = await axios.post(
              `http://localhost:${process.env.PORT || 3001}/api/knowledge-bases/${kbId}/search`,
              { query: message }
            );
            console.log('  Results from', kbId, ':', searchResponse.data.results.length);
            return searchResponse.data.results || [];
          } catch (error: any) {
            console.log('  ❌ Search failed for', kbId, ':', error.message);
            logger.warn(`Failed to search knowledge base ${kbId}:`, error);
            return [];
          }
        });

        const allResults = await Promise.all(searchPromises);
        const flatResults = allResults.flat();

        console.log('📊 Total results found:', flatResults.length);

        if (flatResults.length > 0) {
          knowledgeContext = '\n\nRelevant information from knowledge base:\n' +
            flatResults.map(r => `- ${r.excerpt}`).join('\n');
          
          console.log('✅ Knowledge context created:', knowledgeContext.substring(0, 200));
          
          logger.info('Knowledge base search results:', { 
            resultCount: flatResults.length,
            kbCount: agent.knowledge_base_ids.length 
          });
        } else {
          console.log('⚠️  No results found in knowledge bases');
        }
      } catch (error) {
        console.log('❌ Knowledge base search error:', error);
        logger.error('Knowledge base search failed:', error);
      }
    } else {
      console.log('⚠️  Agent has NO knowledge bases attached');
    }

    // Add system message with agent personality and knowledge context
    let systemMessage = agent.personality_instructions || 'You are a helpful AI assistant.';
    if (knowledgeContext) {
      systemMessage = 'KNOWLEDGE BASE INFORMATION (USE THIS FIRST):' + knowledgeContext + '\n\n' +
        'Your role: ' + (agent.personality_instructions || 'You are a helpful AI assistant.') + '\n\n' +
        'CRITICAL INSTRUCTIONS:\n' +
        '1. ALWAYS check the knowledge base information above FIRST before answering\n' +
        '2. If the knowledge base has the answer, use it EXACTLY as written\n' +
        '3. DO NOT make up, invent, or hallucinate information\n' +
        '4. If the answer is not in the knowledge base, say "I don\'t have that information in my knowledge base"';
    }
    
    messages.unshift({
      role: 'system',
      content: systemMessage
    });

    logger.info('Sending messages to Groq:', { 
      messageCount: messages.length,
      roles: messages.map(m => m.role),
      hasKnowledgeContext: !!knowledgeContext,
      systemMessage: messages[0]?.content?.substring(0, 200) + '...'
    });
    
    // Debug: Log the full system message if knowledge context exists
    if (knowledgeContext) {
      console.log('\n=== KNOWLEDGE BASE CONTEXT ===');
      console.log(knowledgeContext);
      console.log('\n=== FULL SYSTEM MESSAGE ===');
      console.log(messages[0]?.content);
      console.log('==============================\n');
    }

    // Generate response using Groq (free provider)
    const response = await llmService.generateCompletion(messages, {
      provider: LLMProvider.GROQ,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      maxTokens: 1024
    });

    logger.info('Chat test completed:', { agentId: id, messageLength: message.length });

    res.json({
      success: true,
      response: response.content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Chat test failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process chat message'
    });
  }
});

/**
 * Voice test endpoint - send audio and get audio response
 */
router.post('/:id/voice', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const dbService: DatabaseService = (req.app as any).get('dbService');
    const functionRegistry: FunctionRegistry = (req.app as any).get('functionRegistry');

    // Get agent
    const agent = await dbService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    logger.info('Processing voice input:', { 
      agentId: id, 
      audioSize: audioFile.size,
      mimeType: audioFile.mimetype 
    });

    // Check if Groq Audio is available
    if (!groqAudio) {
      return res.status(503).json({ 
        error: 'Voice testing is not available. Groq API key is required.' 
      });
    }

    // Step 1: Transcribe audio to text using Groq Whisper (STT)
    const transcription = await groqAudio.transcribe(audioFile.buffer, {
      language: 'en',
      model: 'whisper-large-v3-turbo' // Fast model
    });

    logger.info('Groq transcription completed:', { text: transcription.text });

    // Step 2: Generate response using Groq LLM
    const llmService = new MultiLLMService(LLMProvider.GROQ);
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    // Add system message with agent personality
    if (agent.personality_instructions) {
      messages.push({
        role: 'system',
        content: agent.personality_instructions
      });
    }
    
    // Add user message
    messages.push({
      role: 'user',
      content: transcription.text
    });

    const llmResponse = await llmService.generateCompletion(messages, {
      provider: LLMProvider.GROQ,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      maxTokens: 1024
    });

    logger.info('Groq LLM response generated:', { responseLength: llmResponse.content.length });

    // Step 3: Convert response text to speech using Groq PlayAI (TTS)
    const ttsResult = await groqAudio.synthesize(llmResponse.content, {
      voice: 'Fritz-PlayAI', // Natural male voice
      model: 'playai-tts',
      responseFormat: 'mp3'
    });

    logger.info('TTS synthesis completed:', { audioSize: ttsResult.size });

    // Send audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': ttsResult.size,
      'X-Transcript': Buffer.from(transcription.text).toString('base64'),
      'X-Response-Text': Buffer.from(llmResponse.content).toString('base64')
    });

    res.send(ttsResult.audioBuffer);
  } catch (error) {
    logger.error('Voice test failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice input'
    });
  }
});

/**
 * Text-to-speech endpoint - convert text to audio using Groq PlayAI
 */
router.post('/:id/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!groqAudio) {
      return res.status(503).json({ 
        error: 'TTS is not available. Groq API key is required.' 
      });
    }

    logger.info('Groq TTS request:', { textLength: text.length, voice });

    const ttsResult = await groqAudio.synthesize(text, {
      voice: voice || 'Fritz-PlayAI',
      model: 'playai-tts',
      responseFormat: 'mp3'
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': ttsResult.size
    });

    res.send(ttsResult.audioBuffer);
  } catch (error) {
    logger.error('Groq TTS failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to synthesize speech'
    });
  }
});

/**
 * Speech-to-text endpoint - convert audio to text using Groq Whisper
 */
router.post('/:id/stt', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    if (!groqAudio) {
      return res.status(503).json({ 
        error: 'STT is not available. Groq API key is required.' 
      });
    }

    logger.info('Groq STT request:', { audioSize: audioFile.size, mimeType: audioFile.mimetype });

    const transcription = await groqAudio.transcribe(audioFile.buffer, {
      language: 'en',
      model: 'whisper-large-v3-turbo'
    });

    res.json({
      success: true,
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration
    });
  } catch (error) {
    logger.error('STT failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transcribe audio'
    });
  }
});

export default router;
