import { Router, Request, Response } from 'express';
import multer from 'multer';
import { STTService, createSTTService } from '../services/stt';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../index';

const router = Router();
const sttService = createSTTService();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: sttService.getMaxFileSize(),
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check if file type is supported
    const isValidFormat = sttService.validateAudioFormat(file.originalname);
    
    if (!isValidFormat) {
      const error = new Error(`Unsupported audio format. Supported formats: ${sttService.getSupportedFormats().join(', ')}`);
      (error as any).code = 'INVALID_FORMAT';
      return cb(error);
    }
    
    cb(null, true);
  }
});

/**
 * POST /api/stt/transcribe
 * Transcribe audio file to text
 */
router.post('/transcribe', optionalAuth, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Audio file is required',
        code: 'MISSING_AUDIO_FILE'
      });
    }

    const options = {
      language: req.body.language,
      model: req.body.model,
      temperature: req.body.temperature ? parseFloat(req.body.temperature) : undefined,
      prompt: req.body.prompt,
      response_format: req.body.response_format || 'verbose_json',
      timestamp_granularities: req.body.timestamp_granularities ? 
        JSON.parse(req.body.timestamp_granularities) : undefined
    };

    logger.info(`STT transcription request: ${req.file.originalname}, size: ${req.file.size} bytes`);

    const result = await sttService.transcribe(req.file.buffer, options);

    logger.info(`STT transcription completed: ${result.text.length} characters`);

    res.json({
      success: true,
      result,
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    logger.error('STT transcription failed:', error);
    
    const message = error instanceof Error ? error.message : 'Transcription failed';
    const code = (error as any)?.code || 'TRANSCRIPTION_ERROR';
    
    if (message.includes('too large')) {
      res.status(413).json({ error: message, code: 'FILE_TOO_LARGE' });
    } else if (message.includes('Invalid STT options')) {
      res.status(400).json({ error: message, code: 'INVALID_OPTIONS' });
    } else if (code === 'INVALID_FORMAT') {
      res.status(400).json({ error: message, code });
    } else {
      res.status(500).json({ error: message, code });
    }
  }
});

/**
 * POST /api/stt/transcribe-stream
 * Transcribe audio stream to text (for real-time processing)
 */
router.post('/transcribe-stream', optionalAuth, async (req: Request, res: Response) => {
  try {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.startsWith('audio/')) {
      return res.status(400).json({ 
        error: 'Content-Type must be an audio format',
        code: 'INVALID_CONTENT_TYPE'
      });
    }

    const options = {
      language: req.headers['x-language'] as string,
      model: req.headers['x-model'] as string,
      temperature: req.headers['x-temperature'] ? 
        parseFloat(req.headers['x-temperature'] as string) : undefined,
      prompt: req.headers['x-prompt'] as string,
      response_format: (req.headers['x-response-format'] as string) || 'verbose_json'
    };

    logger.info(`STT stream transcription request: ${contentType}`);

    const result = await sttService.transcribeStream(req, options);

    logger.info(`STT stream transcription completed: ${result.text.length} characters`);

    res.json({
      success: true,
      result,
      metadata: {
        contentType
      }
    });
  } catch (error) {
    logger.error('STT stream transcription failed:', error);
    
    const message = error instanceof Error ? error.message : 'Stream transcription failed';
    const code = (error as any)?.code || 'STREAM_TRANSCRIPTION_ERROR';
    
    if (message.includes('Invalid STT options')) {
      res.status(400).json({ error: message, code: 'INVALID_OPTIONS' });
    } else {
      res.status(500).json({ error: message, code });
    }
  }
});

/**
 * GET /api/stt/formats
 * Get supported audio formats and limits
 */
router.get('/formats', (req: Request, res: Response) => {
  res.json({
    supported_formats: sttService.getSupportedFormats(),
    max_file_size: sttService.getMaxFileSize(),
    max_file_size_mb: Math.round(sttService.getMaxFileSize() / (1024 * 1024))
  });
});

/**
 * GET /api/stt/health
 * Check STT service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await sttService.healthCheck();
    
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
    logger.error('STT health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/stt/validate
 * Validate audio file without transcribing
 */
router.post('/validate', upload.single('audio'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Audio file is required',
        code: 'MISSING_AUDIO_FILE'
      });
    }

    const isValidFormat = sttService.validateAudioFormat(req.file.originalname);
    const isValidSize = sttService.validateAudioSize(req.file.size);

    if (!isValidFormat) {
      return res.status(400).json({
        valid: false,
        error: 'Unsupported audio format',
        code: 'INVALID_FORMAT',
        supported_formats: sttService.getSupportedFormats()
      });
    }

    if (!isValidSize) {
      return res.status(400).json({
        valid: false,
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        max_size: sttService.getMaxFileSize(),
        file_size: req.file.size
      });
    }

    res.json({
      valid: true,
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        format_supported: isValidFormat,
        size_valid: isValidSize
      }
    });
  } catch (error) {
    logger.error('STT validation failed:', error);
    const message = error instanceof Error ? error.message : 'Validation failed';
    res.status(500).json({ error: message, code: 'VALIDATION_ERROR' });
  }
});

// Error handling middleware for multer
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        max_size: sttService.getMaxFileSize()
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  if (error.code === 'INVALID_FORMAT') {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_FORMAT',
      supported_formats: sttService.getSupportedFormats()
    });
  }
  
  logger.error('STT route error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

export default router;