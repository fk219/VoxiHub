import Groq from 'groq-sdk';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

/**
 * Groq Audio Service
 * Provides both STT (Whisper) and TTS (PlayAI) using Groq API
 */
export class GroqAudioService {
  private groq: Groq;

  constructor(apiKey: string) {
    this.groq = new Groq({ apiKey });
  }

  /**
   * Speech-to-Text using Groq Whisper
   */
  async transcribe(audioBuffer: Buffer, options?: {
    language?: string;
    model?: string;
  }): Promise<{
    text: string;
    language?: string;
    duration?: number;
  }> {
    try {
      // Create a Blob from buffer for Groq API
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const audioFile = new File([blob], 'audio.wav', { type: 'audio/wav' });

      const response: any = await this.groq.audio.transcriptions.create({
        file: audioFile as any,
        model: options?.model || 'whisper-large-v3-turbo', // Faster model
        language: options?.language || 'en',
        response_format: 'verbose_json'
      });

      logger.info('Groq STT transcription completed:', { 
        textLength: response.text?.length || 0 
      });

      return {
        text: response.text || '',
        language: response.language || 'en',
        duration: response.duration || 0
      };
    } catch (error) {
      logger.error('Groq STT failed:', error);
      throw new Error(`Groq transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Text-to-Speech using Groq PlayAI
   */
  async synthesize(text: string, options?: {
    voice?: string;
    model?: string;
    responseFormat?: 'mp3' | 'wav' | 'flac' | 'ogg' | 'mulaw';
  }): Promise<{
    audioBuffer: Buffer;
    format: string;
    size: number;
  }> {
    try {
      const response = await this.groq.audio.speech.create({
        model: options?.model || 'playai-tts',
        voice: options?.voice || 'Fritz-PlayAI', // Default voice
        input: text,
        response_format: options?.responseFormat || 'mp3'
      });

      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      logger.info('Groq TTS synthesis completed:', { 
        size: audioBuffer.length,
        format: options?.responseFormat || 'mp3'
      });

      return {
        audioBuffer,
        format: options?.responseFormat || 'mp3',
        size: audioBuffer.length
      };
    } catch (error) {
      logger.error('Groq TTS failed:', error);
      throw new Error(`Groq TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available voices for TTS
   */
  getAvailableVoices(): string[] {
    return [
      // English voices
      'Arista-PlayAI',
      'Atlas-PlayAI',
      'Basil-PlayAI',
      'Briggs-PlayAI',
      'Calum-PlayAI',
      'Celeste-PlayAI',
      'Cheyenne-PlayAI',
      'Chip-PlayAI',
      'Cillian-PlayAI',
      'Deedee-PlayAI',
      'Fritz-PlayAI',
      'Gail-PlayAI',
      'Indigo-PlayAI',
      'Mamaw-PlayAI',
      'Mason-PlayAI',
      'Mikail-PlayAI',
      'Mitch-PlayAI',
      'Quinn-PlayAI',
      'Thunder-PlayAI'
    ];
  }

  /**
   * Get available STT models
   */
  getAvailableSTTModels(): string[] {
    return [
      'whisper-large-v3',
      'whisper-large-v3-turbo'
    ];
  }

  /**
   * Get available TTS models
   */
  getAvailableTTSModels(): string[] {
    return [
      'playai-tts',
      'playai-tts-arabic'
    ];
  }
}

/**
 * Factory function to create Groq Audio service
 */
export function createGroqAudioService(): GroqAudioService | null {
  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    logger.warn('Groq API key not found');
    return null;
  }

  return new GroqAudioService(groqApiKey);
}
