import OpenAI from 'openai';
import { FunctionRegistry, FunctionContext } from './functionRegistry';
import { KnowledgeBaseSearchService } from './knowledgeBaseSearch';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  functionsEnabled: boolean;
}

export interface LLMResponse {
  content: string;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  finishReason: 'stop' | 'function_call' | 'length' | 'content_filter';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMIntegrationService {
  private openai: OpenAI;
  private functionRegistry: FunctionRegistry;
  private kbSearchService: KnowledgeBaseSearchService | null = null;

  constructor(functionRegistry: FunctionRegistry, dbService?: DatabaseService) {
    this.functionRegistry = functionRegistry;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    
    // Initialize KB search if database service provided
    if (dbService) {
      this.kbSearchService = new KnowledgeBaseSearchService(dbService);
    }
  }

  /**
   * Generate LLM response with function calling and knowledge base support
   */
  async generateResponse(
    messages: LLMMessage[],
    config: LLMConfig,
    context: FunctionContext,
    knowledgeBaseIds?: string[]
  ): Promise<LLMResponse> {
    try {
      // Search knowledge bases if provided
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && this.kbSearchService) {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        
        if (lastUserMessage) {
          const kbResults = await this.kbSearchService.searchKnowledgeBases(
            knowledgeBaseIds,
            lastUserMessage.content,
            5
          );

          if (kbResults.length > 0) {
            const kbContext = this.kbSearchService.formatResultsForContext(kbResults);
            
            // Add knowledge base context to system message
            const systemMessageIndex = messages.findIndex(m => m.role === 'system');
            if (systemMessageIndex >= 0) {
              messages[systemMessageIndex].content += `\n\n${kbContext}`;
            } else {
              messages.unshift({
                role: 'system',
                content: kbContext
              });
            }

            logger.info('Added knowledge base context', {
              resultsCount: kbResults.length,
              agentId: context.agentId
            });
          }
        }
      }

      // Get available functions for this agent
      const functions = config.functionsEnabled
        ? this.functionRegistry.getFunctionSchemaForLLM(context.agentId)
        : [];

      logger.info('Generating LLM response', {
        agentId: context.agentId,
        messageCount: messages.length,
        functionsAvailable: functions.length,
        knowledgeBasesUsed: knowledgeBaseIds?.length || 0
      });

      // Prepare OpenAI request
      const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
        model: config.model || 'gpt-4',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name }),
          ...(msg.function_call && { function_call: msg.function_call })
        })) as any,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 1000
      };

      // Add functions if available
      if (functions.length > 0) {
        requestParams.functions = functions as any;
        requestParams.function_call = 'auto';
      }

      // Call OpenAI API
      const response = await this.openai.chat.completions.create(requestParams);
      const choice = response.choices[0];

      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      // Handle function call
      if (choice.message.function_call) {
        const functionCall = choice.message.function_call;
        
        logger.info('LLM requested function call', {
          functionName: functionCall.name,
          arguments: functionCall.arguments
        });

        try {
          // Parse function arguments
          const args = JSON.parse(functionCall.arguments || '{}');
          
          // Execute function
          const functionResult = await this.functionRegistry.executeFunction(
            functionCall.name,
            args,
            context
          );

          // Add function result to conversation
          const updatedMessages: LLMMessage[] = [
            ...messages,
            {
              role: 'assistant',
              content: '',
              function_call: {
                name: functionCall.name,
                arguments: functionCall.arguments || '{}'
              }
            },
            {
              role: 'function',
              name: functionCall.name,
              content: JSON.stringify(functionResult.success ? functionResult.result : { error: functionResult.error })
            }
          ];

          // Generate follow-up response with function result
          return await this.generateResponse(updatedMessages, config, context);

        } catch (error) {
          logger.error('Function execution failed in LLM flow:', error);
          
          // Add error to conversation and continue
          const errorMessage = error instanceof Error ? error.message : 'Function execution failed';
          const updatedMessages: LLMMessage[] = [
            ...messages,
            {
              role: 'assistant',
              content: '',
              function_call: {
                name: functionCall.name,
                arguments: functionCall.arguments || '{}'
              }
            },
            {
              role: 'function',
              name: functionCall.name,
              content: JSON.stringify({ error: errorMessage })
            }
          ];

          return await this.generateResponse(updatedMessages, config, context);
        }
      }

      // Regular response (no function call)
      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason as any,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined
      };

    } catch (error) {
      logger.error('LLM generation failed:', error);
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate system prompt with function instructions
   */
  generateSystemPrompt(agentConfig: any, functionsEnabled: boolean): string {
    let prompt = `You are ${agentConfig.name}, an AI voice assistant.`;
    
    if (agentConfig.description) {
      prompt += ` ${agentConfig.description}`;
    }

    if (agentConfig.personality_tone) {
      prompt += ` Your tone should be ${agentConfig.personality_tone}.`;
    }

    if (agentConfig.personality_instructions) {
      prompt += ` ${agentConfig.personality_instructions}`;
    }

    if (functionsEnabled) {
      prompt += ` You have access to various functions that can help you provide better assistance. Use them when appropriate to get real-time information, perform calculations, or take actions on behalf of the user.`;
    }

    return prompt;
  }

  /**
   * Convert conversation history to LLM messages
   */
  convertConversationToMessages(
    conversation: Array<{ role: string; content: string; function_call?: any; name?: string }>,
    agentConfig: any,
    functionsEnabled: boolean = true
  ): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // Add system message
    messages.push({
      role: 'system',
      content: this.generateSystemPrompt(agentConfig, functionsEnabled)
    });

    // Add conversation messages
    for (const message of conversation) {
      if (message.role === 'user' || message.role === 'assistant' || message.role === 'function') {
        messages.push({
          role: message.role as any,
          content: message.content,
          ...(message.function_call && { function_call: message.function_call }),
          ...(message.name && { name: message.name })
        });
      }
    }

    return messages;
  }

  /**
   * Validate LLM configuration
   */
  validateConfig(config: Partial<LLMConfig>): LLMConfig {
    return {
      model: config.model || 'gpt-4',
      temperature: Math.max(0, Math.min(2, config.temperature || 0.7)),
      maxTokens: Math.max(1, Math.min(4000, config.maxTokens || 1000)),
      functionsEnabled: config.functionsEnabled !== false
    };
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'gpt-4',
      'gpt-4-turbo-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost estimate
   */
  calculateCostEstimate(
    usage: { promptTokens: number; completionTokens: number },
    model: string
  ): number {
    // Pricing as of 2024 (per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    
    const inputCost = (usage.promptTokens / 1000) * modelPricing.input;
    const outputCost = (usage.completionTokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}
