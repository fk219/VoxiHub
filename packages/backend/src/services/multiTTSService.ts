import { logger } from '../utils/logger';
import OpenAI from 'openai';
import axios from 'axios';

export enum TTSProvider {
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  GOOGLE = 'google',
  AZURE = 'azure',
}

export interface TTSConfig {
  provider: TTSProvider;
  voice: string;
  model?: string;
  speed?: number;
  pitch?: number;
  apiKey?: string;
}

export interface TTSResponse {
  audio: Buffer;
  provider: TTSProvider;
  voice: string;
  duration?: number;
}

/**
 * Multi-TTS Service
 * Unified interface for multiple TTS providers
 */
export class MultiTTSService {
  private openai?: OpenAI;
  private defaultProvider: TTSProvider;
  private providerConfigs: Map<TTSProvider, Partial<TTSConfig>> = new Map();

  constructor(defaultProvider: TTSProvider = TTSProvider.OPENAI) {
    this.defaultProvider = defaultProvider;
    this.initializeProviders();
  }

  /**
   * Initialize TTS providers
   */
  private initializeProviders(): void {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.providerConfigs.set(TTSProvider.OPENAI, {
        provider: TTSProvider.OPENAI,
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
      });
      logger.info('OpenAI TTS provider initialized');
    }

    // Initialize ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
      this.providerConfigs.set(TTSProvider.ELEVENLABS, {
        provider: TTSProvider.ELEVENLABS,
        voice: 'EXAVITQu4vr4xnSDxMaL', // Default voice
        apiKey: process.env.ELEVENLABS_API_KEY,
      });
      logger.info('ElevenLabs TTS provider initialized');
    }

    // Initialize Google Cloud TTS
    if (process.env.GOOGLE_API_KEY) {
      this.providerConfigs.set(TTSProvider.GOOGLE, {
        provider: TTSProvider.GOOGLE,
        voice: 'en-US-Neural2-A',
        apiKey: process.env.GOOGLE_API_KEY,
      });
      logger.info('Google TTS provider initialized');
    }

    // Initialize Azure TTS
    if (process.env.AZURE_SPEECH_KEY) {
      this.providerConfigs.set(TTSProvider.AZURE, {
        provider: TTSProvider.AZURE,
        voice: 'en-US-JennyNeural',
        apiKey: process.env.AZURE_SPEECH_KEY,
      });
      logger.info('Azure TTS provider initialized');
    }
  }

  /**
   * Synthesize speech using specified provider
   */
  async synthesize(text: string, config?: Partial<TTSConfig>): Promise<TTSResponse> {
    const provider = config?.provider || this.defaultProvider;
    const providerConfig = this.providerConfigs.get(provider);

    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const finalConfig = { ...providerConfig, ...config } as TTSConfig;

    switch (provider) {
      case TTSProvider.OPENAI:
        return this.synthesizeOpenAI(text, finalConfig);
      case TTSProvider.ELEVENLABS:
        return this.synthesizeElevenLabs(text, finalConfig);
      case TTSProvider.GOOGLE:
        return this.synthesizeGoogle(text, finalConfig);
      case TTSProvider.AZURE:
        return this.synthesizeAzure(text, finalConfig);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Synthesize using OpenAI
   */
  private async synthesizeOpenAI(
    text: string,
    config: TTSConfig
  ): Promise<TTSResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const response = await this.openai.audio.speech.create({
        model: config.model || 'tts-1',
        voice: config.voice as any,
        input: text,
        speed: config.speed || 1.0,
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        provider: TTSProvider.OPENAI,
        voice: config.voice,
      };
    } catch (error) {
      logger.error('OpenAI TTS error:', error);
      throw error;
    }
  }

  /**
   * Synthesize using ElevenLabs
   */
  private async synthesizeElevenLabs(
    text: string,
    config: TTSConfig
  ): Promise<TTSResponse> {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.voice}`,
        {
          text,
          model_id: config.model || 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        },
        {
          headers: {
            'xi-api-key': config.apiKey || process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      return {
        audio: Buffer.from(response.data),
        provider: TTSProvider.ELEVENLABS,
        voice: config.voice,
      };
    } catch (error) {
      logger.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  /**
   * Synthesize using Google Cloud TTS
   */
  private async synthesizeGoogle(
    text: string,
    config: TTSConfig
  ): Promise<TTSResponse> {
    try {
      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${
          config.apiKey || process.env.GOOGLE_API_KEY
        }`,
        {
          input: { text },
          voice: {
            languageCode: config.voice.split('-').slice(0, 2).join('-'),
            name: config.voice,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: config.pitch || 0,
            speakingRate: config.speed || 1.0,
          },
        }
      );

      const audioContent = response.data.audioContent;
      const buffer = Buffer.from(audioContent, 'base64');

      return {
        audio: buffer,
        provider: TTSProvider.GOOGLE,
        voice: config.voice,
      };
    } catch (error) {
      logger.error('Google TTS error:', error);
      throw error;
    }
  }

  /**
   * Synthesize using Azure TTS
   */
  private async synthesizeAzure(
    text: string,
    config: TTSConfig
  ): Promise<TTSResponse> {
    try {
      const region = process.env.AZURE_SPEECH_REGION || 'eastus';
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice name='${config.voice}'>
            <prosody rate='${config.speed || 1.0}' pitch='${config.pitch || 0}%'>
              ${text}
            </prosody>
          </voice>
        </speak>
      `;

      const response = await axios.post(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            'Ocp-Apim-Subscription-Key':
              config.apiKey || process.env.AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          },
          responseType: 'arraybuffer',
        }
      );

      return {
        audio: Buffer.from(response.data),
        provider: TTSProvider.AZURE,
        voice: config.voice,
      };
    } catch (error) {
      logger.error('Azure TTS error:', error);
      throw error;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): TTSProvider[] {
    return Array.from(this.providerConfigs.keys());
  }

  /**
   * Get available voices for a provider
   */
  getAvailableVoices(provider: TTSProvider): string[] {
    switch (provider) {
      case TTSProvider.OPENAI:
        return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      case TTSProvider.ELEVENLABS:
        return [
          'EXAVITQu4vr4xnSDxMaL', // Sarah
          '21m00Tcm4TlvDq8ikWAM', // Rachel
          'AZnzlk1XvdvUeBnXmlld', // Domi
          'EXAVITQu4vr4xnSDxMaL', // Bella
        ];
      case TTSProvider.GOOGLE:
        return [
          'en-US-Neural2-A',
          'en-US-Neural2-C',
          'en-US-Neural2-D',
          'en-US-Neural2-E',
          'en-US-Neural2-F',
          'en-US-Neural2-G',
          'en-US-Neural2-H',
          'en-US-Neural2-I',
          'en-US-Neural2-J',
        ];
      case TTSProvider.AZURE:
        return [
          'en-US-JennyNeural',
          'en-US-GuyNeural',
          'en-US-AriaNeural',
          'en-US-DavisNeural',
          'en-US-AmberNeural',
          'en-US-AshleyNeural',
          'en-US-BrandonNeural',
          'en-US-ChristopherNeural',
          'en-US-CoraNeural',
          'en-US-ElizabethNeural',
        ];
      default:
        return [];
    }
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: TTSProvider): void {
    if (!this.providerConfigs.has(provider)) {
      throw new Error(`Provider ${provider} not configured`);
    }
    this.defaultProvider = provider;
    logger.info(`Default TTS provider set to ${provider}`);
  }

  /**
   * Get provider config
   */
  getProviderConfig(provider: TTSProvider): Partial<TTSConfig> | undefined {
    return this.providerConfigs.get(provider);
  }
}
