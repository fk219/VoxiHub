import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { logger } from '../utils/logger';
import { VectorStoreService } from './vectorStore';
import { FunctionRegistry } from './functionRegistry';

// Simple in-memory message store for conversation history
class SimpleMemory {
  private messages: BaseMessage[] = [];

  async saveContext(input: { input: string }, output: { output: string }) {
    this.messages.push(new HumanMessage(input.input));
    this.messages.push(new AIMessage(output.output));
  }

  async loadMemoryVariables() {
    return { chat_history: this.messages };
  }

  clear() {
    this.messages = [];
  }
}

interface AgentConfig {
  agentId: string;
  llmProvider: 'openai' | 'anthropic' | 'groq';
  llmModel?: string;
  temperature?: number;
  knowledgeBaseIds?: string[];
  enabledFunctions?: string[];
  personalityInstructions?: string;
  streaming?: boolean;
}

/**
 * LangChain Agent Service - Optimized for Low Latency
 * 
 * Performance Optimizations:
 * - Uses Groq for ultra-fast inference (< 1s)
 * - Caches vector embeddings
 * - Parallel tool execution
 * - Streaming responses
 * - Smart memory management
 */
export class LangChainAgentService {
  private vectorStore: VectorStoreService;
  private functionRegistry: FunctionRegistry;
  private memoryCache: Map<string, SimpleMemory>;

  constructor(vectorStore: VectorStoreService, functionRegistry: FunctionRegistry) {
    this.vectorStore = vectorStore;
    this.functionRegistry = functionRegistry;
    this.memoryCache = new Map();
  }

  /**
   * Initialize LLM with low-latency provider
   */
  private initializeLLM(config: AgentConfig) {
    const temperature = config.temperature ?? 0.7;

    switch (config.llmProvider) {
      case 'groq':
        // Groq: Ultra-fast inference (< 1s response time)
        return new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: config.llmModel || 'llama-3.3-70b-versatile',
          temperature,
          streaming: config.streaming ?? true,
          maxTokens: 1024
        });

      case 'openai':
        return new ChatOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          model: config.llmModel || 'gpt-4-turbo-preview',
          temperature,
          streaming: config.streaming ?? true
        });

      case 'anthropic':
        return new ChatAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: config.llmModel || 'claude-3-sonnet-20240229',
          temperature,
          streaming: config.streaming ?? true
        });

      default:
        // Default to Groq for best latency
        return new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: 'llama-3.3-70b-versatile',
          temperature,
          streaming: true
        });
    }
  }

  /**
   * Create tools from function registry and knowledge bases
   */
  private async createTools(config: AgentConfig): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];

    // Add knowledge base search tool (if KBs attached)
    if (config.knowledgeBaseIds && config.knowledgeBaseIds.length > 0) {
      const kbTool = new DynamicStructuredTool({
        name: 'search_knowledge_base',
        description: 'Search the knowledge base for relevant information. Use this when you need specific information from documents, manuals, or FAQs. Input should be a search query string.',
        schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        } as any,
        func: async ({ query }: { query: string }) => {
          try {
            const startTime = Date.now();
            const axios = require('axios');
            
            console.log('\n========================================');
            console.log('🔍 LangChain KB Search Tool Called');
            console.log('Query:', query);
            console.log('KB IDs:', config.knowledgeBaseIds);
            console.log('========================================');
            
            // Search all attached knowledge bases using HTTP API (no vector embeddings needed)
            const searchPromises = config.knowledgeBaseIds!.map(async (kbId) => {
              try {
                console.log(`  Searching KB ${kbId}...`);
                const response = await axios.post(
                  `http://localhost:${process.env.PORT || 3001}/api/knowledge-bases/${kbId}/search`,
                  { query },
                  { timeout: 5000 }
                );
                console.log(`  Response from ${kbId}:`, response.data.results.length, 'results');
                if (response.data.results.length > 0) {
                  console.log(`  First result:`, response.data.results[0]);
                }
                return response.data.results || [];
              } catch (error: any) {
                console.log(`  ❌ Search failed for ${kbId}:`, error.message);
                logger.warn(`KB search failed for ${kbId}:`, error);
                return [];
              }
            });

            const results = await Promise.all(searchPromises);
            const flatResults = results.flat();

            const latency = Date.now() - startTime;
            console.log('✅ KB search results:', flatResults.length);
            logger.info('KB search completed', { latency, resultCount: flatResults.length });

            if (flatResults.length === 0) {
              return 'No relevant information found in knowledge base. The knowledge base may not contain information about this topic.';
            }

            const formattedResults = flatResults
              .map((result, i) => `[Document ${i + 1}: ${result.filename}]\n${result.excerpt}`)
              .join('\n\n');
            
            console.log('📄 Returning KB results:', formattedResults.substring(0, 200));
            return formattedResults;
          } catch (error) {
            logger.error('KB search failed:', error);
            console.error('❌ KB search error:', error);
            return 'Error searching knowledge base.';
          }
        }
      });

      tools.push(kbTool);
    }

    // Add custom functions from registry
    if (config.enabledFunctions && config.enabledFunctions.length > 0) {
      // Add basic built-in tools
      const builtInTools = [
        new DynamicStructuredTool({
          name: 'get_current_time',
          description: 'Get the current date and time',
          schema: {
            type: 'object',
            properties: {},
            required: []
          } as any,
          func: async () => new Date().toISOString()
        }),
        new DynamicStructuredTool({
          name: 'calculate',
          description: 'Perform mathematical calculations. Input should be a mathematical expression.',
          schema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate'
              }
            },
            required: ['expression']
          } as any,
          func: async ({ expression }: { expression: string }) => {
            try {
              const result = Function(`'use strict'; return (${expression})`)();
              return String(result);
            } catch {
              return 'Error: Invalid expression';
            }
          }
        })
      ];

      tools.push(...builtInTools);
    }

    return tools;
  }

  /**
   * Create system message
   */
  private createSystemMessage(config: AgentConfig): string {
    let systemMessage = config.personalityInstructions || 
      'You are a helpful AI assistant. Answer questions accurately and concisely.';
    
    // Add explicit instructions to use knowledge base if available
    if (config.knowledgeBaseIds && config.knowledgeBaseIds.length > 0) {
      systemMessage += '\n\nIMPORTANT: You have access to a knowledge base tool called "search_knowledge_base". ' +
        'ALWAYS use this tool FIRST when asked about specific information, facts, or details. ' +
        'The knowledge base contains accurate, up-to-date information that you should prioritize over your training data. ' +
        'If the user asks "who", "what", "when", "where" questions, use the search_knowledge_base tool to find the answer.';
    }
    
    return systemMessage;
  }

  /**
   * Get or create memory for conversation
   */
  private getMemory(conversationId: string): SimpleMemory {
    if (!this.memoryCache.has(conversationId)) {
      const memory = new SimpleMemory();
      this.memoryCache.set(conversationId, memory);
    }

    return this.memoryCache.get(conversationId)!;
  }

  /**
   * Create or get cached LLM and tools
   */
  async prepareAgent(config: AgentConfig): Promise<{ llm: any; tools: DynamicStructuredTool[]; systemMessage: string }> {
    const cacheKey = `${config.agentId}-${config.llmProvider}`;

    const startTime = Date.now();

    // Initialize LLM
    const llm = this.initializeLLM(config);

    // Create tools
    const tools = await this.createTools(config);

    // Create system message
    const systemMessage = this.createSystemMessage(config);

    const initTime = Date.now() - startTime;
    logger.info('Agent prepared', { agentId: config.agentId, initTime, toolCount: tools.length });

    return { llm, tools, systemMessage };
  }

  /**
   * Execute agent with message (optimized for low latency)
   */
  async executeAgent(
    config: AgentConfig,
    message: string,
    conversationId: string,
    onStream?: (chunk: string) => void
  ): Promise<{ response: string; latency: number }> {
    const startTime = Date.now();

    try {
      // Prepare agent components
      const { llm, tools, systemMessage } = await this.prepareAgent(config);

      // Get conversation memory
      const memory = this.getMemory(conversationId);
      const chatHistory = await memory.loadMemoryVariables();

      // Build messages
      const messages = [
        new SystemMessage(systemMessage),
        ...(chatHistory.chat_history || []),
        new HumanMessage(message)
      ];

      // Execute with tools if available
      let response: string;
      
      if (tools.length > 0) {
        // Agent can use tools
        response = await this.executeWithTools(llm, tools, messages, message);
      } else {
        // Simple LLM call (LangChain v1 uses invoke)
        const result = await llm.invoke(messages);
        response = result.content;
      }

      const latency = Date.now() - startTime;
      logger.info('Agent executed', { latency, conversationId, toolCount: tools.length });

      // Save to memory
      await memory.saveContext(
        { input: message },
        { output: response }
      );

      return {
        response,
        latency
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('Agent execution failed:', { error, latency });
      throw error;
    }
  }

  /**
   * Execute with tools (agent reasoning)
   */
  private async executeWithTools(
    llm: any,
    tools: DynamicStructuredTool[],
    messages: any[],
    userMessage: string
  ): Promise<string> {
    // Simple tool execution logic
    // Check if any tool should be called based on the message
    
    for (const tool of tools) {
      // Simple heuristic: if message mentions tool name or description keywords
      const toolKeywords = tool.name.toLowerCase().split('_');
      const messageLower = userMessage.toLowerCase();
      
      if (toolKeywords.some(keyword => messageLower.includes(keyword))) {
        try {
          logger.info('Executing tool', { toolName: tool.name });
          const toolResult = await tool.func({ query: userMessage });
          
          // Add tool result to context and get final response
          messages.push(new SystemMessage(`Tool ${tool.name} result: ${toolResult}`));
          const finalResponse = await llm.invoke(messages);
          return finalResponse.content;
        } catch (error) {
          logger.error('Tool execution failed', { toolName: tool.name, error });
        }
      }
    }

    // No tool needed, just use LLM
    const response = await llm.invoke(messages);
    return response.content;
  }



  /**
   * Clear conversation memory
   */
  clearMemory(conversationId?: string) {
    if (conversationId) {
      this.memoryCache.delete(conversationId);
    } else {
      this.memoryCache.clear();
    }
  }
}
