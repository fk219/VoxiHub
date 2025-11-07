import { logger } from '../utils/logger';
import OpenAI from 'openai';
import axios from 'axios';
import FormData from 'form-data';

export enum STTProvider {
  OPENAI = 'openai',
  GOOGLE = 'google',
  AZURE = 'azure',
  DEEPGRAM = 'deepgram',
}

export interface STTConfig {
  provider: STTProvider;
  language?: string;
  model?: string;
  apiKey?: string;
}

export interface STTResponse {
  text: string;
  provider: STTProvider;
  confidence?: number;
  duration?: number;
  language?: string;
}

/**
 * Multi-STT Service
 * Unified interface for multiple STT providers
 */
export class MultiSTTService {
  private openai?: OpenAI;
  private defaultProvider: STTProvider;
  private providerConfigs: Map<STTProvider, Partial<STTConfig>> = new Map();

  constructor(defaultProvider: STTProvider = STTProvider.OPENAI) {
    this.defaultProvider = defaultProvider;
    this.initializeProviders();
  }

  /**
   * Initialize STT providers
   */
  private initializeProviders(): void {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.providerConfigs.set(STTProvider.OPENAI, {
        provider: STTProvider.OPENAI,
        model: 'whisper-1',
        language: 'en',
      });
      logger.info('OpenAI STT provider initialized');
    }

    // Initialize Google Cloud Speech-to-Text
    if (process.env.GOOGLE_API_KEY) {
      this.providerConfigs.set(STTProvider.GOOGLE, {
        provider: STTProvider.GOOGLE,
        language: 'en-US',
        apiKey: process.env.GOOGLE_API_KEY,
      });
      logger.info('Google STT provider initialized');
    }

    // Initialize Azure Speech
    if (process.env.AZURE_SPEECH_KEY) {
      this.providerConfigs.set(STTProvider.AZURE, {
        provider: STTProvider.AZURE,
        language: 'en-US',
        apiKey: process.env.AZURE_SPEECH_KEY,
      });
      logger.info('Azure STT provider initialized');
    }

    // Initialize Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
      this.providerConfigs.set(STTProvider.DEEPGRAM, {
        provider: STTProvider.DEEPGRAM,
        model: 'nova-2',
        language: 'en',
        apiKey: process.env.DEEPGRAM_API_KEY,
      });
      logger.info('Deepgram STT provider initialized');
    }
  }

  /**
   * Transcribe audio using specified provider
   */
  async transcribe(
    audioBuffer: Buffer,
    config?: Partial<STTConfig>
  ): Promise<STTResponse> {
    const provider = config?.provider || this.defaultProvider;
    const providerConfig = this.providerConfigs.get(provider);

    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const finalConfig = { ...providerConfig, ...config } as STTConfig;

    switch (provider) {
      case STTProvider.OPENAI:
        return this.transcribeOpenAI(audioBuffer, finalConfig);
      case STTProvider.GOOGLE:
        return this.transcribeGoogle(audioBuffer, finalConfig);
      case STTProvider.AZURE:
        return this.transcribeAzure(audioBuffer, finalConfig);
      case STTProvider.DEEPGRAM:
        return this.transcribeDeepgram(audioBuffer, finalConfig);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Transcribe using OpenAI Whisper
   */
  private async transcribeOpenAI(
    audioBuffer: Buffer,
    config: STTConfig
  ): Promise<STTResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      // Convert buffer to File
      const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: config.model || 'whisper-1',
        language: config.language,
        response_format: 'verbose_json',
      });

      return {
        text: response.text,
        provider: STTProvider.OPENAI,
        language: response.language,
        duration: response.duration,
      };
    } catch (error) {
      logger.error('OpenAI STT error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   */
  private async transcribeGoogle(
    audioBuffer: Buffer,
    config: STTConfig
  ): Promise<STTResponse> {
    try {
      const audioContent = audioBuffer.toString('base64');

      const response = await axios.post(
        `https://speech.googleapis.com/v1/speech:recognize?key=${
          config.apiKey || process.env.GOOGLE_API_KEY
        }`,
        {
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: config.language || 'en-US',
            enableAutomaticPunctuation: true,
          },
          audio: {
            content: audioContent,
          },
        }
      );

      const result = response.data.results?.[0];
      const alternative = result?.alternatives?.[0];

      return {
        text: alternative?.transcript || '',
        provider: STTProvider.GOOGLE,
        confidence: alternative?.confidence,
        language: config.language,
      };
    } catch (error) {
      logger.error('Google STT error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Azure Speech
   */
  private async transcribeAzure(
    audioBuffer: Buffer,
    config: STTConfig
  ): Promise<STTResponse> {
    try {
      const region = process.env.AZURE_SPEECH_REGION || 'eastus';

      const response = await axios.post(
        `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${
          config.language || 'en-US'
        }`,
        audioBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key':
              config.apiKey || process.env.AZURE_SPEECH_KEY,
            'Content-Type': 'audio/wav',
          },
        }
      );

      return {
        text: response.data.DisplayText || '',
        provider: STTProvider.AZURE,
        confidence: response.data.NBest?.[0]?.Confidence,
        language: config.language,
      };
    } catch (error) {
      logger.error('Azure STT error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Deepgram
   */
  private async transcribeDeepgram(
    audioBuffer: Buffer,
    config: STTConfig
  ): Promise<STTResponse> {
    try {
      const response = await axios.post(
        `https://api.deepgram.com/v1/listen?model=${config.model || 'nova-2'}&language=${
          config.language || 'en'
        }&punctuate=true`,
        audioBuffer,
        {
          headers: {
            Authorization: `Token ${config.apiKey || process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/wav',
          },
        }
      );

      const result = response.data.results?.channels?.[0]?.alternatives?.[0];

      return {
        text: result?.transcript || '',
        provider: STTProvider.DEEPGRAM,
        confidence: result?.confidence,
        language: config.language,
      };
    } catch (error) {
      logger.error('Deepgram STT error:', error);
      throw error;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): STTProvider[] {
    return Array.from(this.providerConfigs.keys());
  }

  /**
   * Get supported languages for a provider
   */
  getSupportedLanguages(provider: STTProvider): string[] {
    switch (provider) {
      case STTProvider.OPENAI:
        return [
          'en',
          'es',
          'fr',
          'de',
          'it',
          'pt',
          'nl',
          'pl',
          'ru',
          'ja',
          'ko',
          'zh',
          'ar',
          'hi',
        ];
      case STTProvider.GOOGLE:
        return [
          'en-US',
          'en-GB',
          'es-ES',
          'fr-FR',
          'de-DE',
          'it-IT',
          'pt-BR',
          'nl-NL',
          'pl-PL',
          'ru-RU',
          'ja-JP',
          'ko-KR',
          'zh-CN',
          'ar-SA',
          'hi-IN',
        ];
      case STTProvider.AZURE:
        return [
          'en-US',
          'en-GB',
          'es-ES',
          'fr-FR',
          'de-DE',
          'it-IT',
          'pt-BR',
          'nl-NL',
          'pl-PL',
          'ru-RU',
          'ja-JP',
          'ko-KR',
          'zh-CN',
          'ar-SA',
          'hi-IN',
        ];
      case STTProvider.DEEPGRAM:
        return [
          'en',
          'es',
          'fr',
          'de',
          'it',
          'pt',
          'nl',
          'pl',
          'ru',
          'ja',
          'ko',
          'zh',
          'ar',
          'hi',
        ];
      default:
        return [];
    }
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: STTProvider): void {
    if (!this.providerConfigs.has(provider)) {
      throw new Error(`Provider ${provider} not configured`);
    }
    this.defaultProvider = provider;
    logger.info(`Default STT provider set to ${provider}`);
  }

  /**
   * Get provider config
   */
  getProviderConfig(provider: STTProvider): Partial<STTConfig> | undefined {
    return this.providerConfigs.get(provider);
  }
}
