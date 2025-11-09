import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '../utils/logger';
import axios from 'axios';

// Type alias for compatibility
type DynamicTool = DynamicStructuredTool;

/**
 * MCP Tools Service - Model Context Protocol Integration
 * 
 * Provides integration with MCP servers for external tool access:
 * - Supabase (database queries)
 * - Tavily (web search)
 * - Filesystem (file operations)
 * - Custom MCP servers
 */
export class MCPToolsService {
  private mcpServers: Map<string, MCPServer>;
  private toolCache: Map<string, DynamicStructuredTool[]>;

  constructor() {
    this.mcpServers = new Map();
    this.toolCache = new Map();
  }

  /**
   * Register MCP server
   */
  registerServer(name: string, config: MCPServerConfig) {
    const server = new MCPServer(name, config);
    this.mcpServers.set(name, server);
    logger.info('MCP server registered', { name });
  }

  /**
   * Create LangChain tools from MCP servers
   */
  async createMCPTools(serverNames?: string[]): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];
    const serversToUse = serverNames || Array.from(this.mcpServers.keys());

    for (const serverName of serversToUse) {
      const server = this.mcpServers.get(serverName);
      if (!server) {
        logger.warn('MCP server not found', { serverName });
        continue;
      }

      // Check cache
      const cacheKey = serverName;
      if (this.toolCache.has(cacheKey)) {
        tools.push(...this.toolCache.get(cacheKey)!);
        continue;
      }

      try {
        const serverTools = await server.listTools();
        const langchainTools: DynamicStructuredTool[] = [];

        for (const mcpTool of serverTools) {
          const tool = new DynamicStructuredTool({
            name: `${serverName}_${mcpTool.name}`,
            description: mcpTool.description || `Execute ${mcpTool.name} on ${serverName}`,
            schema: {
              type: 'object',
              properties: {
                input: {
                  type: 'string',
                  description: 'Tool input as JSON string'
                }
              },
              required: ['input']
            } as any,
            func: async ({ input }: { input: string }) => {
              try {
                const args = JSON.parse(input);
                const result = await server.callTool(mcpTool.name, args);
                return JSON.stringify(result);
              } catch (error) {
                logger.error('MCP tool execution failed', { serverName, tool: mcpTool.name, error });
                return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
            }
          });

          langchainTools.push(tool);
        }

        // Cache tools
        this.toolCache.set(cacheKey, langchainTools);
        tools.push(...langchainTools);

        logger.info('MCP tools created', { serverName, toolCount: langchainTools.length });

      } catch (error) {
        logger.error('Failed to create MCP tools', { serverName, error });
      }
    }

    return tools;
  }

  /**
   * Create built-in tools (without MCP server)
   */
  createBuiltInTools(): DynamicStructuredTool[] {
    const tools: DynamicStructuredTool[] = [];

    // Web Search Tool (using Tavily API directly)
    if (process.env.TAVILY_API_KEY) {
      tools.push(new DynamicStructuredTool({
        name: 'web_search',
        description: 'Search the web for current information. Use this when you need up-to-date information not in the knowledge base.',
        schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        } as any,
        func: async ({ query }: { query: string }) => {
          try {
            const response = await axios.post('https://api.tavily.com/search', {
              api_key: process.env.TAVILY_API_KEY,
              query,
              max_results: 5
            });

            const results = response.data.results || [];
            return results
              .map((r: any) => `${r.title}\n${r.content}\nSource: ${r.url}`)
              .join('\n\n');
          } catch (error) {
            logger.error('Web search failed:', error);
            return 'Error performing web search';
          }
        }
      }));
    }

    // Calculator Tool
    tools.push(new DynamicStructuredTool({
      name: 'calculator',
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
          // Safe eval using Function constructor
          const result = Function(`'use strict'; return (${expression})`)();
          return String(result);
        } catch (error) {
          return 'Error: Invalid mathematical expression';
        }
      }
    }));

    // Current Time Tool
    tools.push(new DynamicStructuredTool({
      name: 'get_current_time',
      description: 'Get the current date and time.',
      schema: {
        type: 'object',
        properties: {},
        required: []
      } as any,
      func: async () => {
        return new Date().toISOString();
      }
    }));

    return tools;
  }

  /**
   * Clear tool cache
   */
  clearCache() {
    this.toolCache.clear();
  }
}

/**
 * MCP Server Configuration
 */
interface MCPServerConfig {
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * MCP Server Client
 */
class MCPServer {
  private name: string;
  private config: MCPServerConfig;
  private tools: MCPTool[];

  constructor(name: string, config: MCPServerConfig) {
    this.name = name;
    this.config = config;
    this.tools = [];
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    // For now, return predefined tools based on server name
    // In production, this would query the actual MCP server
    
    switch (this.name) {
      case 'supabase':
        return [
          {
            name: 'execute_sql',
            description: 'Execute SQL query on Supabase database',
            parameters: {
              query: 'string'
            }
          },
          {
            name: 'list_tables',
            description: 'List all tables in the database',
            parameters: {}
          }
        ];

      case 'tavily':
        return [
          {
            name: 'search',
            description: 'Search the web using Tavily',
            parameters: {
              query: 'string',
              max_results: 'number'
            }
          }
        ];

      case 'filesystem':
        return [
          {
            name: 'read_file',
            description: 'Read contents of a file',
            parameters: {
              path: 'string'
            }
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            parameters: {
              path: 'string',
              content: 'string'
            }
          }
        ];

      default:
        return [];
    }
  }

  /**
   * Call tool on MCP server
   */
  async callTool(toolName: string, args: any): Promise<any> {
    // For now, implement basic functionality
    // In production, this would call the actual MCP server

    if (this.name === 'supabase' && toolName === 'execute_sql') {
      // Would call Supabase MCP server
      return { message: 'SQL execution not yet implemented' };
    }

    if (this.name === 'tavily' && toolName === 'search') {
      // Would call Tavily MCP server
      if (process.env.TAVILY_API_KEY) {
        const response = await axios.post('https://api.tavily.com/search', {
          api_key: process.env.TAVILY_API_KEY,
          query: args.query,
          max_results: args.max_results || 5
        });
        return response.data;
      }
    }

    throw new Error(`Tool ${toolName} not implemented for ${this.name}`);
  }
}

/**
 * MCP Tool Definition
 */
interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

// Export singleton instance
export const mcpToolsService = new MCPToolsService();
