import { Router, Request, Response } from 'express';
import { TTSService, createTTSService } from '../services/tts';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();
const ttsService = createTTSService();

// Validation schemas
const synthesizeSchema = Joi.object({
  text: Joi.string().min(1).max(ttsService.getMaxTextLength()).required(),
  voice: Joi.string().optional(),
  model: Joi.string().optional(),
  speed: Joi.number().min(0.25).max(4.0).optional(),
  response_format: Joi.string().valid('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm').optional()
});

/**
 * POST /api/tts/synthesize
 * Convert text to speech
 */
router.post('/synthesize', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = synthesizeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: `Validation error: ${error.details[0].message}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const { text, ...options } = value;

    logger.info(`TTS synthesis request: ${text.length} characters`);

    const result = await ttsService.synthesize(text, options);

    logger.info(`TTS synthesis completed: ${result.size} bytes, format: ${result.format}`);

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': `audio/${result.format}`,
      'Content-Length': result.size.toString(),
      'Content-Disposition': `attachment; filename="speech.${result.format}"`
    });

    res.send(result.audioBuffer);
  } catch (error) {
    logger.error('TTS synthesis failed:', error);
    
    const message = error instanceof Error ? error.message : 'TTS synthesis failed';
    
    if (message.includes('too long')) {
      res.status(413).json({ 
        error: message, 
        code: 'TEXT_TOO_LONG',
        max_length: ttsService.getMaxTextLength()
      });
    } else if (message.includes('Invalid TTS options')) {
      res.status(400).json({ error: message, code: 'INVALID_OPTIONS' });
    } else {
      res.status(500).json({ error: message, code: 'SYNTHESIS_ERROR' });
    }
  }
});

/**
 * POST /api/tts/synthesize-json
 * Convert text to speech and return JSON response with base64 audio
 */
router.post('/synthesize-json', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = synthesizeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: `Validation error: ${error.details[0].message}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const { text, ...options } = value;

    logger.info(`TTS synthesis JSON request: ${text.length} characters`);

    const result = await ttsService.synthesize(text, options);

    logger.info(`TTS synthesis JSON completed: ${result.size} bytes, format: ${result.format}`);

    res.json({
      success: true,
      audio: result.audioBuffer.toString('base64'),
      format: result.format,
      size: result.size,
      duration: result.duration,
      metadata: result.metadata
    });
  } catch (error) {
    logger.error('TTS synthesis JSON failed:', error);
    
    const message = error instanceof Error ? error.message : 'TTS synthesis failed';
    
    if (message.includes('too long')) {
      res.status(413).json({ 
        error: message, 
        code: 'TEXT_TOO_LONG',
        max_length: ttsService.getMaxTextLength()
      });
    } else if (message.includes('Invalid TTS options')) {
      res.status(400).json({ error: message, code: 'INVALID_OPTIONS' });
    } else {
      res.status(500).json({ error: message, code: 'SYNTHESIS_ERROR' });
    }
  }
});

/**
 * POST /api/tts/synthesize-stream
 * Convert text to speech and stream the audio
 */
router.post('/synthesize-stream', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = synthesizeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: `Validation error: ${error.details[0].message}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const { text, ...options } = value;
    const format = options.response_format || 'mp3';

    logger.info(`TTS stream synthesis request: ${text.length} characters`);

    const audioStream = await ttsService.synthesizeStream(text, options);

    // Set appropriate headers for streaming audio
    res.set({
      'Content-Type': `audio/${format}`,
      'Transfer-Encoding': 'chunked',
      'Content-Disposition': `attachment; filename="speech.${format}"`
    });

    audioStream.pipe(res);

    audioStream.on('end', () => {
      logger.info('TTS stream synthesis completed');
    });

    audioStream.on('error', (error) => {
      logger.error('TTS stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error', code: 'STREAM_ERROR' });
      }
    });
  } catch (error) {
    logger.error('TTS stream synthesis failed:', error);
    
    const message = error instanceof Error ? error.message : 'TTS stream synthesis failed';
    
    if (message.includes('too long')) {
      res.status(413).json({ 
        error: message, 
        code: 'TEXT_TOO_LONG',
        max_length: ttsService.getMaxTextLength()
      });
    } else if (message.includes('Invalid TTS options')) {
      res.status(400).json({ error: message, code: 'INVALID_OPTIONS' });
    } else {
      res.status(500).json({ error: message, code: 'STREAM_SYNTHESIS_ERROR' });
    }
  }
});

/**
 * POST /api/tts/synthesize-long
 * Convert long text to speech (splits into chunks)
 */
router.post('/synthesize-long', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { text, ...options } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    logger.info(`TTS long synthesis request: ${text.length} characters`);

    const results = await ttsService.synthesizeLongText(text, options);

    logger.info(`TTS long synthesis completed: ${results.length} chunks`);

    // Combine all audio buffers
    const combinedBuffer = Buffer.concat(results.map(r => r.audioBuffer));
    const format = results[0]?.format || 'mp3';

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': `audio/${format}`,
      'Content-Length': combinedBuffer.length.toString(),
      'Content-Disposition': `attachment; filename="long-speech.${format}"`
    });

    res.send(combinedBuffer);
  } catch (error) {
    logger.error('TTS long synthesis failed:', error);
    
    const message = error instanceof Error ? error.message : 'TTS long synthesis failed';
    res.status(500).json({ error: message, code: 'LONG_SYNTHESIS_ERROR' });
  }
});

/**
 * GET /api/tts/voices
 * Get available voices
 */
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const voices = await ttsService.getAvailableVoices();
    
    res.json({
      voices,
      count: voices.length
    });
  } catch (error) {
    logger.error('Failed to get TTS voices:', error);
    res.status(500).json({ 
      error: 'Failed to get available voices',
      code: 'VOICES_ERROR'
    });
  }
});

/**
 * GET /api/tts/formats
 * Get supported audio formats and limits
 */
router.get('/formats', (req: Request, res: Response) => {
  res.json({
    supported_formats: ttsService.getSupportedFormats(),
    max_text_length: ttsService.getMaxTextLength()
  });
});

/**
 * POST /api/tts/optimize
 * Optimize text for TTS synthesis
 */
router.post('/optimize', (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    const optimizedText = ttsService.optimizeTextForTTS(text);
    const isValidLength = ttsService.validateTextLength(optimizedText);

    res.json({
      original_text: text,
      optimized_text: optimizedText,
      original_length: text.length,
      optimized_length: optimizedText.length,
      is_valid_length: isValidLength,
      max_length: ttsService.getMaxTextLength()
    });
  } catch (error) {
    logger.error('TTS text optimization failed:', error);
    res.status(500).json({ 
      error: 'Text optimization failed',
      code: 'OPTIMIZATION_ERROR'
    });
  }
});

/**
 * POST /api/tts/validate
 * Validate text for TTS synthesis
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { text, voice, model, speed, response_format } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        valid: false,
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    // Validate text length
    const isValidLength = ttsService.validateTextLength(text);
    if (!isValidLength) {
      return res.status(400).json({
        valid: false,
        error: 'Text too long',
        code: 'TEXT_TOO_LONG',
        text_length: text.length,
        max_length: ttsService.getMaxTextLength()
      });
    }

    // Validate options
    const { error } = synthesizeSchema.validate({ text, voice, model, speed, response_format });
    if (error) {
      return res.status(400).json({
        valid: false,
        error: `Validation error: ${error.details[0].message}`,
        code: 'INVALID_OPTIONS'
      });
    }

    res.json({
      valid: true,
      text_length: text.length,
      max_length: ttsService.getMaxTextLength(),
      estimated_duration: Math.max(1, text.length / 10) // Rough estimate
    });
  } catch (error) {
    logger.error('TTS validation failed:', error);
    res.status(500).json({ 
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
});

/**
 * GET /api/tts/health
 * Check TTS service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await ttsService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      providers: {
        primary: health.primaryProvider,
        fallback: health.fallbackProvider
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('TTS health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;