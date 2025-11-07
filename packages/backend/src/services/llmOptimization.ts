import { logger } from '../utils/logger';
import OpenAI from 'openai';

export interface LLMOptimizationConfig {
  enableCaching?: boolean;
  enableStreaming?: boolean;
  maxCacheSize?: number;
  cacheTTL?: number;
  fastModel?: string;
  standardModel?: string;
}

export interface CachedResponse {
  response: string;
  timestamp: number;
  model: string;
}

/**
 * LLM Optimization Service
 * Provides prompt caching, streaming, and model selection for reduced latency
 */
export class LLMOptimizationService {
  private openai: OpenAI;
  private config: LLMOptimizationConfig;
  private cache: Map<string, CachedResponse> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: LLMOptimizationConfig = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.config = {
      enableCaching: config.enableCaching !== false,
      enableStreaming: config.enableStreaming !== false,
      maxCacheSize: config.maxCacheSize || 1000,
      cacheTTL: config.cacheTTL || 3600000, // 1 hour
      fastModel: config.fastModel || 'gpt-3.5-turbo',
      standardModel: config.standardModel || 'gpt-4-turbo-preview',
    };

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Generate response with optimization
   */
  async generateResponse(
    messages: any[],
    options: {
      useCache?: boolean;
      useFastModel?: boolean;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string | AsyncIterable<string>> {
    const {
      useCache = this.config.enableCaching,
      useFastModel = false,
      stream = this.config.enableStreaming,
      temperature = 0.7,
      maxTokens = 500,
    } = options;

    // Check cache if enabled
    if (useCache && !stream) {
      const cacheKey = this.generateCacheKey(messages);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL!) {
        this.cacheHits++;
        logger.debug('Cache hit for LLM response', { cacheKey });
        return cached.response;
      }
      this.cacheMisses++;
    }

    // Select model based on latency requirements
    const model = useFastModel ? this.config.fastModel! : this.config.standardModel!;

    const startTime = Date.now();

    try {
      if (stream) {
        // Streaming response for lower latency
        return this.streamResponse(messages, model, temperature, maxTokens);
      } else {
        // Standard response
        const response = await this.openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        const content = response.choices[0]?.message?.content || '';
        const latency = Date.now() - startTime;

        logger.debug('LLM response generated', {
          model,
          latency,
          tokens: response.usage?.total_tokens,
        });

        // Cache response if enabled
        if (useCache) {
          const cacheKey = this.generateCacheKey(messages);
          this.cache.set(cacheKey, {
            response: content,
            timestamp: Date.now(),
            model,
          });

          // Enforce cache size limit
          if (this.cache.size > this.config.maxCacheSize!) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }

        return content;
      }
    } catch (error) {
      logger.error('Error generating LLM response:', error);
      throw error;
    }
  }

  /**
   * Stream response for lower latency
   */
  private async *streamResponse(
    messages: any[],
    model: string,
    temperature: number,
    maxTokens: number
  ): AsyncIterable<string> {
    try {
      const stream = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('Error streaming LLM response:', error);
      throw error;
    }
  }

  /**
   * Generate cache key from messages
   */
  private generateCacheKey(messages: any[]): string {
    const key = JSON.stringify(messages);
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL!) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('LLM cache cleared');
  }

  /**
   * Optimize context by removing old messages
   */
  optimizeContext(
    messages: any[],
    maxMessages: number = 10,
    keepSystemMessage: boolean = true
  ): any[] {
    if (messages.length <= maxMessages) {
      return messages;
    }

    const systemMessages = keepSystemMessage
      ? messages.filter((m) => m.role === 'system')
      : [];
    const otherMessages = messages.filter((m) => m.role !== 'system');

    // Keep most recent messages
    const recentMessages = otherMessages.slice(-maxMessages + systemMessages.length);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Preload common responses into cache
   */
  async preloadCache(commonPrompts: Array<{ messages: any[]; response: string }>): Promise<void> {
    for (const prompt of commonPrompts) {
      const cacheKey = this.generateCacheKey(prompt.messages);
      this.cache.set(cacheKey, {
        response: prompt.response,
        timestamp: Date.now(),
        model: 'preloaded',
      });
    }
    logger.info(`Preloaded ${commonPrompts.length} responses into cache`);
  }
}
