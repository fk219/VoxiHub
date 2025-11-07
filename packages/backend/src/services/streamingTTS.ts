import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { Readable } from 'stream';

export interface StreamingTTSConfig {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: string;
  speed?: number;
  chunkSize?: number;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  isLast: boolean;
}

/**
 * Streaming Text-to-Speech Service
 * Provides real-time audio generation with chunked delivery
 */
export class StreamingTTSService extends EventEmitter {
  private openai: OpenAI;
  private config: StreamingTTSConfig;
  private currentStream?: Readable;
  private isStreaming: boolean = false;

  constructor(config: StreamingTTSConfig = {}) {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.config = {
      voice: config.voice || 'alloy',
      model: config.model || 'tts-1',
      speed: config.speed || 1.0,
      chunkSize: config.chunkSize || 4096,
    };
  }

  /**
   * Stream text to speech
   */
  async streamText(text: string): Promise<void> {
    if (this.isStreaming) {
      logger.warn('Already streaming, cancelling previous stream');
      this.cancel();
    }

    this.isStreaming = true;
    this.emit('start');

    try {
      // Create streaming TTS request
      const response = await this.openai.audio.speech.create({
        model: this.config.model!,
        voice: this.config.voice!,
        input: text,
        speed: this.config.speed,
        response_format: 'mp3',
      });

      // Convert response to readable stream
      const stream = response.body as unknown as Readable;
      this.currentStream = stream;

      let chunkCount = 0;
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        chunkCount++;

        // Emit chunk when we have enough data
        if (chunks.reduce((sum, c) => sum + c.length, 0) >= this.config.chunkSize!) {
          const audioChunk: AudioChunk = {
            data: Buffer.concat(chunks),
            timestamp: Date.now(),
            isLast: false,
          };
          this.emit('audio', audioChunk);
          chunks.length = 0; // Clear chunks
        }
      });

      stream.on('end', () => {
        // Emit remaining chunks
        if (chunks.length > 0) {
          const audioChunk: AudioChunk = {
            data: Buffer.concat(chunks),
            timestamp: Date.now(),
            isLast: true,
          };
          this.emit('audio', audioChunk);
        }

        this.isStreaming = false;
        this.currentStream = undefined;
        this.emit('end');
        logger.debug(`TTS streaming completed, ${chunkCount} chunks processed`);
      });

      stream.on('error', (error) => {
        logger.error('TTS streaming error:', error);
        this.isStreaming = false;
        this.currentStream = undefined;
        this.emit('error', error);
      });
    } catch (error) {
      logger.error('Error starting TTS stream:', error);
      this.isStreaming = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stream text with sentence-by-sentence processing
   * Reduces latency by starting audio playback before full text is processed
   */
  async streamTextBySentence(text: string): Promise<void> {
    const sentences = this.splitIntoSentences(text);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      await this.streamText(sentence);

      // Wait for current stream to finish before starting next
      await new Promise<void>((resolve) => {
        const checkStream = () => {
          if (!this.isStreaming) {
            resolve();
          } else {
            setTimeout(checkStream, 100);
          }
        };
        checkStream();
      });
    }
  }

  /**
   * Split text into sentences for streaming
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries
    return text
      .split(/([.!?]+\s+)/)
      .reduce((acc: string[], part, i, arr) => {
        if (i % 2 === 0) {
          const sentence = part + (arr[i + 1] || '');
          if (sentence.trim()) {
            acc.push(sentence);
          }
        }
        return acc;
      }, []);
  }

  /**
   * Cancel current streaming
   */
  cancel(): void {
    if (this.currentStream) {
      this.currentStream.destroy();
      this.currentStream = undefined;
    }
    this.isStreaming = false;
    this.emit('cancelled');
    logger.debug('TTS streaming cancelled');
  }

  /**
   * Check if currently streaming
   */
  isActive(): boolean {
    return this.isStreaming;
  }
}
