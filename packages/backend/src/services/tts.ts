import OpenAI from 'openai';
import { Readable } from 'stream';
import { logger } from '../index';
import Joi from 'joi';

export interface TTSResult {
  audioBuffer: Buffer;
  format: string;
  duration?: number;
  size: number;
  metadata?: {
    voice: string;
    model: string;
    speed: number;
  };
}

export interface TTSProvider {
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  synthesizeStream(text: string, options?: TTSOptions): Promise<Readable>;
  getAvailableVoices(): Promise<string[]>;
  getSupportedFormats(): string[];
  getMaxTextLength(): number;
}

export interface TTSOptions {
  voice?: string;
  model?: string;
  speed?: number;
  format?: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

/**
 * OpenAI TTS Provider
 */
export class OpenAITTSProvider implements TTSProvider {
  private openai: OpenAI;
  private maxTextLength = 4096; // OpenAI TTS limit
  private supportedFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
  private availableVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    try {
      if (text.length > this.maxTextLength) {
        throw new Error(`Text too long. Maximum length is ${this.maxTextLength} characters`);
      }

      const response = await this.openai.audio.speech.create({
        model: options.model || 'tts-1',
        voice: (options.voice as any) || 'alloy',
        input: text,
        response_format: options.response_format || 'mp3',
        speed: options.speed || 1.0
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return {
        audioBuffer,
        format: options.response_format || 'mp3',
        size: audioBuffer.length,
        metadata: {
          voice: options.voice || 'alloy',
          model: options.model || 'tts-1',
          speed: options.speed || 1.0
        }
      };
    } catch (error) {
      logger.error('OpenAI TTS synthesis failed:', error);
      throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async synthesizeStream(text: string, options: TTSOptions = {}): Promise<Readable> {
    try {
      if (text.length > this.maxTextLength) {
        throw new Error(`Text too long. Maximum length is ${this.maxTextLength} characters`);
      }

      const response = await this.openai.audio.speech.create({
        model: options.model || 'tts-1',
        voice: (options.voice as any) || 'alloy',
        input: text,
        response_format: options.response_format || 'mp3',
        speed: options.speed || 1.0
      });

      // Convert the response to a readable stream
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      return Readable.from(audioBuffer);
    } catch (error) {
      logger.error('OpenAI TTS stream synthesis failed:', error);
      throw new Error(`TTS stream synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    return this.availableVoices;
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  getMaxTextLength(): number {
    return this.maxTextLength;
  }
}

/**
 * ElevenLabs TTS Provider (placeholder implementation)
 */
export class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string;
  private maxTextLength = 5000;
  private supportedFormats = ['mp3', 'wav', 'pcm'];
  private availableVoices: string[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    // This is a placeholder implementation
    // In a real implementation, you would integrate with ElevenLabs API
    throw new Error('ElevenLabs TTS provider not implemented yet');
  }

  async synthesizeStream(text: string, options: TTSOptions = {}): Promise<Readable> {
    throw new Error('ElevenLabs TTS stream provider not implemented yet');
  }

  async getAvailableVoices(): Promise<string[]> {
    // In real implementation, fetch from ElevenLabs API
    return ['voice1', 'voice2', 'voice3'];
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  getMaxTextLength(): number {
    return this.maxTextLength;
  }
}

/**
 * Mock TTS Provider for testing
 */
export class MockTTSProvider implements TTSProvider {
  private maxTextLength = 10000;
  private supportedFormats = ['mp3', 'wav', 'pcm'];
  private availableVoices = ['mock-voice-1', 'mock-voice-2', 'mock-voice-3'];

  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create a mock audio buffer (silence)
    const duration = Math.max(1, text.length / 10); // Rough estimate
    const sampleRate = 44100;
    const samples = Math.floor(duration * sampleRate);
    const audioBuffer = Buffer.alloc(samples * 2); // 16-bit audio
    
    return {
      audioBuffer,
      format: options.response_format || 'mp3',
      duration,
      size: audioBuffer.length,
      metadata: {
        voice: options.voice || 'mock-voice-1',
        model: options.model || 'mock-model',
        speed: options.speed || 1.0
      }
    };
  }

  async synthesizeStream(text: string, options: TTSOptions = {}): Promise<Readable> {
    const result = await this.synthesize(text, options);
    return Readable.from(result.audioBuffer);
  }

  async getAvailableVoices(): Promise<string[]> {
    return this.availableVoices;
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  getMaxTextLength(): number {
    return this.maxTextLength;
  }
}

/**
 * Main TTS Service with provider management and optimization
 */
export class TTSService {
  private primaryProvider: TTSProvider;
  private fallbackProvider?: TTSProvider;
  private retryAttempts = 2;
  private retryDelay = 1000; // 1 second

  constructor(primaryProvider: TTSProvider, fallbackProvider?: TTSProvider) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
  }

  // Validation schema
  private synthesizeOptionsSchema = Joi.object({
    voice: Joi.string().optional(),
    model: Joi.string().optional(),
    speed: Joi.number().min(0.25).max(4.0).optional(),
    format: Joi.string().optional(),
    response_format: Joi.string().valid('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm').optional()
  });

  /**
   * Synthesize text to speech with retry and fallback logic
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for TTS synthesis');
    }

    const { error, value } = this.synthesizeOptionsSchema.validate(options);
    if (error) {
      throw new Error(`Invalid TTS options: ${error.details[0].message}`);
    }

    let lastError: Error | null = null;

    // Try primary provider with retries
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.info(`TTS synthesis attempt ${attempt} with primary provider: ${text.substring(0, 50)}...`);
        const result = await this.primaryProvider.synthesize(text, value);
        logger.info(`TTS synthesis successful: ${result.size} bytes, format: ${result.format}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`TTS primary provider attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    // Try fallback provider if available
    if (this.fallbackProvider) {
      try {
        logger.info('Trying TTS fallback provider');
        const result = await this.fallbackProvider.synthesize(text, value);
        logger.info(`TTS fallback synthesis successful: ${result.size} bytes, format: ${result.format}`);
        return result;
      } catch (error) {
        logger.error('TTS fallback provider failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw new Error(`TTS synthesis failed after all attempts: ${lastError?.message}`);
  }

  /**
   * Synthesize text to speech stream
   */
  async synthesizeStream(text: string, options: TTSOptions = {}): Promise<Readable> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for TTS synthesis');
    }

    const { error, value } = this.synthesizeOptionsSchema.validate(options);
    if (error) {
      throw new Error(`Invalid TTS options: ${error.details[0].message}`);
    }

    let lastError: Error | null = null;

    // Try primary provider
    try {
      logger.info(`TTS stream synthesis with primary provider: ${text.substring(0, 50)}...`);
      const stream = await this.primaryProvider.synthesizeStream(text, value);
      logger.info('TTS stream synthesis successful');
      return stream;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      logger.warn('TTS primary provider stream failed:', lastError.message);
    }

    // Try fallback provider if available
    if (this.fallbackProvider) {
      try {
        logger.info('Trying TTS stream fallback provider');
        const stream = await this.fallbackProvider.synthesizeStream(text, value);
        logger.info('TTS stream fallback synthesis successful');
        return stream;
      } catch (error) {
        logger.error('TTS stream fallback provider failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw new Error(`TTS stream synthesis failed: ${lastError?.message}`);
  }

  /**
   * Split long text into chunks for processing
   */
  async synthesizeLongText(text: string, options: TTSOptions = {}): Promise<TTSResult[]> {
    const maxLength = this.primaryProvider.getMaxTextLength();
    
    if (text.length <= maxLength) {
      const result = await this.synthesize(text, options);
      return [result];
    }

    // Split text into sentences and group them into chunks
    const sentences = this.splitIntoSentences(text);
    const chunks = this.groupSentencesIntoChunks(sentences, maxLength);
    
    logger.info(`Splitting long text into ${chunks.length} chunks`);

    const results: TTSResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      logger.info(`Processing chunk ${i + 1}/${chunks.length}`);
      const result = await this.synthesize(chunks[i], options);
      results.push(result);
    }

    return results;
  }

  /**
   * Get available voices from primary provider
   */
  async getAvailableVoices(): Promise<string[]> {
    try {
      return await this.primaryProvider.getAvailableVoices();
    } catch (error) {
      logger.error('Failed to get available voices:', error);
      return [];
    }
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return this.primaryProvider.getSupportedFormats();
  }

  /**
   * Get maximum text length
   */
  getMaxTextLength(): number {
    return this.primaryProvider.getMaxTextLength();
  }

  /**
   * Validate text length
   */
  validateTextLength(text: string): boolean {
    return text.length <= this.getMaxTextLength();
  }

  /**
   * Optimize text for TTS (remove special characters, normalize, etc.)
   */
  optimizeTextForTTS(text: string): string {
    return text
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
      .trim();
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

    // Test primary provider with short text
    try {
      await this.primaryProvider.synthesize('Hello, this is a test.', { response_format: 'mp3' });
      results.primaryProvider = true;
    } catch (error) {
      logger.warn('TTS primary provider health check failed:', error);
      results.primaryProvider = false;
      results.status = 'degraded';
    }

    // Test fallback provider if available
    if (this.fallbackProvider) {
      try {
        await this.fallbackProvider.synthesize('Hello, this is a test.', { response_format: 'mp3' });
        results.fallbackProvider = true;
      } catch (error) {
        logger.warn('TTS fallback provider health check failed:', error);
        results.fallbackProvider = false;
        if (!results.primaryProvider) {
          results.status = 'unhealthy';
        }
      }
    }

    return results;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - in production, use a more sophisticated approach
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  }

  private groupSentencesIntoChunks(sentences: string[], maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create TTS service based on configuration
 */
export function createTTSService(): TTSService {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!openaiApiKey && !elevenLabsApiKey) {
    logger.warn('No TTS API keys found, using mock TTS provider');
    return new TTSService(new MockTTSProvider());
  }

  let primaryProvider: TTSProvider;
  let fallbackProvider: TTSProvider | undefined;

  if (openaiApiKey) {
    primaryProvider = new OpenAITTSProvider(openaiApiKey);
    fallbackProvider = new MockTTSProvider(); // Use mock as fallback
  } else if (elevenLabsApiKey) {
    primaryProvider = new ElevenLabsTTSProvider(elevenLabsApiKey);
    fallbackProvider = new MockTTSProvider();
  } else {
    primaryProvider = new MockTTSProvider();
  }
  
  return new TTSService(primaryProvider, fallbackProvider);
}