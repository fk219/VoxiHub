import OpenAI from 'openai';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import Joi from 'joi';

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface STTProvider {
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult>;
  transcribeStream(audioStream: Readable, options?: STTOptions): Promise<STTResult>;
  getSupportedFormats(): string[];
  getMaxFileSize(): number;
}

export interface STTOptions {
  language?: string;
  model?: string;
  temperature?: number;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  timestamp_granularities?: Array<'word' | 'segment'>;
}

/**
 * OpenAI Whisper STT Provider
 */
export class OpenAISTTProvider implements STTProvider {
  private openai: OpenAI;
  private maxFileSize = 25 * 1024 * 1024; // 25MB limit for OpenAI Whisper
  private supportedFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<STTResult> {
    try {
      if (audioBuffer.length > this.maxFileSize) {
        throw new Error(`Audio file too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`);
      }

      // Create a readable stream from buffer
      const audioStream = Readable.from(audioBuffer);
      
      // Set filename with appropriate extension
      (audioStream as any).path = 'audio.wav';

      const response = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: options.model || 'whisper-1',
        language: options.language,
        prompt: options.prompt,
        response_format: options.response_format || 'verbose_json',
        temperature: options.temperature || 0,
        timestamp_granularities: options.timestamp_granularities
      });

      if (typeof response === 'string') {
        return { text: response };
      }

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments?.map(segment => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        }))
      };
    } catch (error) {
      logger.error('OpenAI STT transcription failed:', error);
      throw new Error(`STT transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribeStream(audioStream: Readable, options: STTOptions = {}): Promise<STTResult> {
    try {
      // Set filename for the stream
      (audioStream as any).path = 'audio.wav';

      const response = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: options.model || 'whisper-1',
        language: options.language,
        prompt: options.prompt,
        response_format: options.response_format || 'verbose_json',
        temperature: options.temperature || 0,
        timestamp_granularities: options.timestamp_granularities
      });

      if (typeof response === 'string') {
        return { text: response };
      }

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments?.map(segment => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        }))
      };
    } catch (error) {
      logger.error('OpenAI STT stream transcription failed:', error);
      throw new Error(`STT stream transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }
}

/**
 * Mock STT Provider for testing
 */
export class MockSTTProvider implements STTProvider {
  private maxFileSize = 100 * 1024 * 1024; // 100MB
  private supportedFormats = ['wav', 'mp3', 'mp4', 'webm'];

  async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<STTResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      text: 'This is a mock transcription result.',
      confidence: 0.95,
      language: options.language || 'en',
      duration: 2.5
    };
  }

  async transcribeStream(audioStream: Readable, options: STTOptions = {}): Promise<STTResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return {
      text: 'This is a mock stream transcription result.',
      confidence: 0.92,
      language: options.language || 'en',
      duration: 3.0
    };
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }
}

/**
 * Main STT Service with provider management and fallback
 */
export class STTService {
  private primaryProvider: STTProvider;
  private fallbackProvider?: STTProvider;
  private retryAttempts = 2;
  private retryDelay = 1000; // 1 second

  constructor(primaryProvider: STTProvider, fallbackProvider?: STTProvider) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
  }

  // Validation schema
  private transcribeOptionsSchema = Joi.object({
    language: Joi.string().length(2).optional(),
    model: Joi.string().optional(),
    temperature: Joi.number().min(0).max(1).optional(),
    prompt: Joi.string().max(244).optional(),
    response_format: Joi.string().valid('json', 'text', 'srt', 'verbose_json', 'vtt').optional(),
    timestamp_granularities: Joi.array().items(Joi.string().valid('word', 'segment')).optional()
  });

  /**
   * Transcribe audio buffer with retry and fallback logic
   */
  async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<STTResult> {
    // Validate options
    const { error, value } = this.transcribeOptionsSchema.validate(options);
    if (error) {
      throw new Error(`Invalid STT options: ${error.details[0].message}`);
    }

    let lastError: Error | null = null;

    // Try primary provider with retries
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.info(`STT transcription attempt ${attempt} with primary provider`);
        const result = await this.primaryProvider.transcribe(audioBuffer, value);
        logger.info(`STT transcription successful: ${result.text.substring(0, 100)}...`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`STT primary provider attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    // Try fallback provider if available
    if (this.fallbackProvider) {
      try {
        logger.info('Trying STT fallback provider');
        const result = await this.fallbackProvider.transcribe(audioBuffer, value);
        logger.info(`STT fallback transcription successful: ${result.text.substring(0, 100)}...`);
        return result;
      } catch (error) {
        logger.error('STT fallback provider failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw new Error(`STT transcription failed after all attempts: ${lastError?.message}`);
  }

  /**
   * Transcribe audio stream with retry and fallback logic
   */
  async transcribeStream(audioStream: Readable, options: STTOptions = {}): Promise<STTResult> {
    // Validate options
    const { error, value } = this.transcribeOptionsSchema.validate(options);
    if (error) {
      throw new Error(`Invalid STT options: ${error.details[0].message}`);
    }

    let lastError: Error | null = null;

    // Try primary provider
    try {
      logger.info('STT stream transcription with primary provider');
      const result = await this.primaryProvider.transcribeStream(audioStream, value);
      logger.info(`STT stream transcription successful: ${result.text.substring(0, 100)}...`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      logger.warn('STT primary provider stream failed:', lastError.message);
    }

    // Try fallback provider if available
    if (this.fallbackProvider) {
      try {
        logger.info('Trying STT stream fallback provider');
        const result = await this.fallbackProvider.transcribeStream(audioStream, value);
        logger.info(`STT stream fallback transcription successful: ${result.text.substring(0, 100)}...`);
        return result;
      } catch (error) {
        logger.error('STT stream fallback provider failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw new Error(`STT stream transcription failed: ${lastError?.message}`);
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return this.primaryProvider.getSupportedFormats();
  }

  /**
   * Get maximum file size
   */
  getMaxFileSize(): number {
    return this.primaryProvider.getMaxFileSize();
  }

  /**
   * Validate audio format
   */
  validateAudioFormat(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? this.getSupportedFormats().includes(extension) : false;
  }

  /**
   * Validate audio file size
   */
  validateAudioSize(size: number): boolean {
    return size <= this.getMaxFileSize();
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    primaryProvider: boolean;
    fallbackProvider?: boolean;
  }> {
    const results = {
      status: 'healthy' as const,
      primaryProvider: false,
      fallbackProvider: undefined as boolean | undefined
    };

    // Test primary provider with a small mock audio buffer
    try {
      const mockBuffer = Buffer.alloc(1024); // Small buffer for testing
      await this.primaryProvider.transcribe(mockBuffer, { response_format: 'text' });
      results.primaryProvider = true;
    } catch (error) {
      logger.warn('STT primary provider health check failed:', error);
      results.primaryProvider = false;
      results.status = 'degraded';
    }

    // Test fallback provider if available
    if (this.fallbackProvider) {
      try {
        const mockBuffer = Buffer.alloc(1024);
        await this.fallbackProvider.transcribe(mockBuffer, { response_format: 'text' });
        results.fallbackProvider = true;
      } catch (error) {
        logger.warn('STT fallback provider health check failed:', error);
        results.fallbackProvider = false;
        if (!results.primaryProvider) {
          results.status = 'unhealthy';
        }
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create STT service based on configuration
 */
export function createSTTService(): STTService {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    logger.warn('OpenAI API key not found, using mock STT provider');
    return new STTService(new MockSTTProvider());
  }

  const primaryProvider = new OpenAISTTProvider(openaiApiKey);
  const fallbackProvider = new MockSTTProvider(); // Use mock as fallback
  
  return new STTService(primaryProvider, fallbackProvider);
}