import { logger } from '../utils/logger';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  GROQ = 'groq',
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Multi-LLM Service
 * Unified interface for multiple LLM providers
 */
export class MultiLLMService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private groq?: Groq;
  private defaultProvider: LLMProvider;
  private providerConfigs: Map<LLMProvider, LLMConfig> = new Map();

  constructor(defaultProvider: LLMProvider = LLMProvider.OPENAI) {
    this.defaultProvider = defaultProvider;
    this.initializeProviders();
  }

  /**
   * Initialize LLM providers
   */
  private initializeProviders(): void {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.providerConfigs.set(LLMProvider.OPENAI, {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4-turbo-preview',
        temperature: 0.7,
        maxTokens: 1000,
      });
      logger.info('OpenAI provider initialized');
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      this.providerConfigs.set(LLMProvider.ANTHROPIC, {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 1000,
      });
      logger.info('Anthropic provider initialized');
    }

    // Google Gemini would be initialized here
    if (process.env.GOOGLE_API_KEY) {
      this.providerConfigs.set(LLMProvider.GOOGLE, {
        provider: LLMProvider.GOOGLE,
        model: 'gemini-pro',
        temperature: 0.7,
        maxTokens: 1000,
      });
      logger.info('Google provider initialized');
    }

    // Initialize Groq
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });
      this.providerConfigs.set(LLMProvider.GROQ, {
        provider: LLMProvider.GROQ,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        maxTokens: 8192,
      });
      logger.info('Groq provider initialized');
    }
  }

  /**
   * Generate completion using specified provider
   */
  async generateCompletion(
    messages: LLMMessage[],
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const provider = config?.provider || this.defaultProvider;
    const providerConfig = this.providerConfigs.get(provider);

    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const finalConfig = { ...providerConfig, ...config };

    switch (provider) {
      case LLMProvider.OPENAI:
        return this.generateOpenAI(messages, finalConfig);
      case LLMProvider.ANTHROPIC:
        return this.generateAnthropic(messages, finalConfig);
      case LLMProvider.GOOGLE:
        return this.generateGoogle(messages, finalConfig);
      case LLMProvider.GROQ:
        return this.generateGroq(messages, finalConfig);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Generate completion using OpenAI
   */
  private async generateOpenAI(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.model,
        messages: messages as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        provider: LLMProvider.OPENAI,
        model: config.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('OpenAI generation error:', error);
      throw error;
    }
  }

  /**
   * Generate completion using Anthropic
   */
  private async generateAnthropic(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic not initialized');
    }

    try {
      // Convert messages format for Anthropic
      const systemMessage = messages.find((m) => m.role === 'system');
      const conversationMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response = await this.anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens || 1000,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: conversationMessages,
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        content,
        provider: LLMProvider.ANTHROPIC,
        model: config.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      logger.error('Anthropic generation error:', error);
      throw error;
    }
  }

  /**
   * Generate completion using Google Gemini
   */
  private async generateGoogle(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Google Gemini implementation would go here
    // For now, throw not implemented
    throw new Error('Google Gemini provider not yet implemented');
  }

  /**
   * Generate completion using Groq
   */
  private async generateGroq(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.groq) {
      throw new Error('Groq not initialized');
    }

    try {
      const response = await this.groq.chat.completions.create({
        model: config.model,
        messages: messages as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        provider: LLMProvider.GROQ,
        model: config.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('Groq generation error:', error);
      throw error;
    }
  }

  /**
   * Stream completion (for real-time responses)
   */
  async *streamCompletion(
    messages: LLMMessage[],
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    const provider = config?.provider || this.defaultProvider;

    switch (provider) {
      case LLMProvider.OPENAI:
        yield* this.streamOpenAI(messages, config);
        break;
      case LLMProvider.ANTHROPIC:
        yield* this.streamAnthropic(messages, config);
        break;
      case LLMProvider.GROQ:
        yield* this.streamGroq(messages, config);
        break;
      default:
        throw new Error(`Streaming not supported for provider: ${provider}`);
    }
  }

  /**
   * Stream OpenAI completion
   */
  private async *streamOpenAI(
    messages: LLMMessage[],
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const providerConfig = this.providerConfigs.get(LLMProvider.OPENAI)!;
    const finalConfig = { ...providerConfig, ...config };

    const stream = await this.openai.chat.completions.create({
      model: finalConfig.model,
      messages: messages as any,
      temperature: finalConfig.temperature,
      max_tokens: finalConfig.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Stream Anthropic completion
   */
  private async *streamAnthropic(
    messages: LLMMessage[],
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic not initialized');
    }

    const providerConfig = this.providerConfigs.get(LLMProvider.ANTHROPIC)!;
    const finalConfig = { ...providerConfig, ...config };

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = await this.anthropic.messages.stream({
      model: finalConfig.model,
      max_tokens: finalConfig.maxTokens || 1000,
      temperature: finalConfig.temperature,
      system: systemMessage?.content,
      messages: conversationMessages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providerConfigs.keys());
  }

  /**
   * Get provider config
   */
  getProviderConfig(provider: LLMProvider): LLMConfig | undefined {
    return this.providerConfigs.get(provider);
  }

  /**
   * Update provider config
   */
  updateProviderConfig(provider: LLMProvider, config: Partial<LLMConfig>): void {
    const existing = this.providerConfigs.get(provider);
    if (existing) {
      this.providerConfigs.set(provider, { ...existing, ...config });
    }
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: LLMProvider): void {
    if (!this.providerConfigs.has(provider)) {
      throw new Error(`Provider ${provider} not configured`);
    }
    this.defaultProvider = provider;
    logger.info(`Default LLM provider set to ${provider}`);
  }

  /**
   * Stream Groq completion
   */
  private async *streamGroq(
    messages: LLMMessage[],
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    if (!this.groq) {
      throw new Error('Groq not initialized');
    }

    const providerConfig = this.providerConfigs.get(LLMProvider.GROQ)!;
    const finalConfig = { ...providerConfig, ...config };

    const stream = await this.groq.chat.completions.create({
      model: finalConfig.model,
      messages: messages as any,
      temperature: finalConfig.temperature,
      max_tokens: finalConfig.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: LLMProvider): string[] {
    switch (provider) {
      case LLMProvider.OPENAI:
        return [
          'gpt-4-turbo-preview',
          'gpt-4',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
        ];
      case LLMProvider.ANTHROPIC:
        return [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
          'claude-2.1',
          'claude-2.0',
        ];
      case LLMProvider.GOOGLE:
        return ['gemini-pro', 'gemini-pro-vision'];
      case LLMProvider.GROQ:
        return [
          'llama-3.3-70b-versatile',
          'llama-3.1-70b-versatile',
          'llama-3.1-8b-instant',
          'llama3-70b-8192',
          'llama3-8b-8192',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
          'gemma-7b-it',
        ];
      default:
        return [];
    }
  }
}
