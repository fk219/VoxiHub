import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import OpenAI from 'openai';

export interface StreamingSTTConfig {
  language?: string;
  model?: string;
  enableVAD?: boolean;
  vadThreshold?: number;
  silenceTimeout?: number;
}

export interface TranscriptionChunk {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
}

/**
 * Streaming Speech-to-Text Service
 * Provides real-time transcription with Voice Activity Detection
 */
export class StreamingSTTService extends EventEmitter {
  private openai: OpenAI;
  private config: StreamingSTTConfig;
  private audioBuffer: Buffer[] = [];
  private isProcessing: boolean = false;
  private lastSpeechTime: number = 0;
  private silenceTimer?: NodeJS.Timeout;

  constructor(config: StreamingSTTConfig = {}) {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.config = {
      language: config.language || 'en',
      model: config.model || 'whisper-1',
      enableVAD: config.enableVAD !== false,
      vadThreshold: config.vadThreshold || 0.5,
      silenceTimeout: config.silenceTimeout || 1500, // 1.5 seconds
    };
  }

  /**
   * Process audio chunk for streaming transcription
   */
  async processAudioChunk(audioChunk: Buffer): Promise<void> {
    try {
      this.audioBuffer.push(audioChunk);
      this.lastSpeechTime = Date.now();

      // Clear existing silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }

      // Detect voice activity
      if (this.config.enableVAD) {
        const hasVoice = await this.detectVoiceActivity(audioChunk);
        
        if (!hasVoice) {
          // Start silence timer
          this.silenceTimer = setTimeout(() => {
            this.processBufferedAudio(true);
          }, this.config.silenceTimeout);
          return;
        }
      }

      // Process if buffer is large enough (e.g., 1 second of audio)
      const totalSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      if (totalSize >= 16000 * 2) { // 1 second at 16kHz, 16-bit
        await this.processBufferedAudio(false);
      }
    } catch (error) {
      logger.error('Error processing audio chunk:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process buffered audio for transcription
   */
  private async processBufferedAudio(isFinal: boolean): Promise<void> {
    if (this.isProcessing || this.audioBuffer.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Combine audio buffers
      const audioData = Buffer.concat(this.audioBuffer);
      
      // Convert to format suitable for Whisper API
      const audioFile = await this.bufferToFile(audioData);

      // Transcribe using Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.config.model!,
        language: this.config.language,
        response_format: 'verbose_json',
      });

      if (transcription.text && transcription.text.trim()) {
        const chunk: TranscriptionChunk = {
          text: transcription.text,
          isFinal,
          confidence: (transcription as any).confidence,
          timestamp: Date.now(),
        };

        this.emit('transcription', chunk);
        logger.debug('Transcription chunk:', chunk);
      }

      // Clear buffer if final
      if (isFinal) {
        this.audioBuffer = [];
      } else {
        // Keep last 0.5 seconds for context
        const keepSize = 16000; // 0.5 seconds
        const totalSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        if (totalSize > keepSize) {
          const removeSize = totalSize - keepSize;
          let removed = 0;
          while (removed < removeSize && this.audioBuffer.length > 0) {
            const buf = this.audioBuffer.shift()!;
            removed += buf.length;
          }
        }
      }
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Detect voice activity in audio chunk
   */
  private async detectVoiceActivity(audioChunk: Buffer): Promise<boolean> {
    try {
      // Simple energy-based VAD
      const samples = new Int16Array(
        audioChunk.buffer,
        audioChunk.byteOffset,
        audioChunk.length / 2
      );

      // Calculate RMS energy
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sum / samples.length);
      const normalizedEnergy = rms / 32768; // Normalize to 0-1

      return normalizedEnergy > this.config.vadThreshold!;
    } catch (error) {
      logger.error('Error detecting voice activity:', error);
      return true; // Assume voice activity on error
    }
  }

  /**
   * Convert buffer to file for Whisper API
   */
  private async bufferToFile(buffer: Buffer): Promise<File> {
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return new File([blob], 'audio.wav', { type: 'audio/wav' });
  }

  /**
   * Finalize transcription
   */
  async finalize(): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    await this.processBufferedAudio(true);
    this.emit('end');
  }

  /**
   * Reset the service
   */
  reset(): void {
    this.audioBuffer = [];
    this.isProcessing = false;
    this.lastSpeechTime = 0;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
  }
}
