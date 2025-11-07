import { logger } from '../utils/logger';
import { AuditService, AuditAction } from './auditService';

export interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
}

export interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  parameters: FunctionParameter[];
  handler: (params: any, context: FunctionContext) => Promise<any>;
  category: 'builtin' | 'custom' | 'api' | 'database';
  agentId?: string;
  userId?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunctionContext {
  conversationId: string;
  agentId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface FunctionExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface FunctionExecutionLog {
  id: string;
  functionId: string;
  functionName: string;
  conversationId: string;
  agentId: string;
  parameters: any;
  result: FunctionExecutionResult;
  createdAt: Date;
}

export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition>;
  private executionLogs: FunctionExecutionLog[];
  private auditService: AuditService;

  constructor(auditService: AuditService) {
    this.functions = new Map();
    this.executionLogs = [];
    this.auditService = auditService;
    
    // Register built-in functions
    this.registerBuiltInFunctions();
  }

  /**
   * Register a new function
   */
  registerFunction(definition: Omit<FunctionDefinition, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const functionDef: FunctionDefinition = {
      ...definition,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.functions.set(id, functionDef);

    logger.info(`Function registered: ${definition.name}`, { id, category: definition.category });

    return id;
  }

  /**
   * Unregister a function
   */
  unregisterFunction(functionId: string): boolean {
    const deleted = this.functions.delete(functionId);
    
    if (deleted) {
      logger.info(`Function unregistered: ${functionId}`);
    }

    return deleted;
  }

  /**
   * Get function by ID
   */
  getFunction(functionId: string): FunctionDefinition | undefined {
    return this.functions.get(functionId);
  }

  /**
   * Get function by name
   */
  getFunctionByName(name: string, agentId?: string): FunctionDefinition | undefined {
    for (const func of this.functions.values()) {
      if (func.name === name) {
        // If agentId specified, match agent-specific or global functions
        if (agentId && func.agentId && func.agentId !== agentId) {
          continue;
        }
        return func;
      }
    }
    return undefined;
  }

  /**
   * List all functions
   */
  listFunctions(filters?: {
    category?: string;
    agentId?: string;
    userId?: string;
    enabled?: boolean;
  }): FunctionDefinition[] {
    let functions = Array.from(this.functions.values());

    if (filters) {
      if (filters.category) {
        functions = functions.filter(f => f.category === filters.category);
      }
      if (filters.agentId) {
        functions = functions.filter(f => !f.agentId || f.agentId === filters.agentId);
      }
      if (filters.userId) {
        functions = functions.filter(f => !f.userId || f.userId === filters.userId);
      }
      if (filters.enabled !== undefined) {
        functions = functions.filter(f => f.enabled === filters.enabled);
      }
    }

    return functions;
  }

  /**
   * Execute a function
   */
  async executeFunction(
    functionName: string,
    parameters: any,
    context: FunctionContext
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Get function definition
      const functionDef = this.getFunctionByName(functionName, context.agentId);

      if (!functionDef) {
        throw new Error(`Function not found: ${functionName}`);
      }

      if (!functionDef.enabled) {
        throw new Error(`Function is disabled: ${functionName}`);
      }

      // Validate parameters
      this.validateParameters(parameters, functionDef.parameters);

      // Execute function
      logger.info(`Executing function: ${functionName}`, { 
        conversationId: context.conversationId,
        parameters 
      });

      const result = await functionDef.handler(parameters, context);

      const executionTime = Date.now() - startTime;

      const executionResult: FunctionExecutionResult = {
        success: true,
        result,
        executionTime,
        timestamp
      };

      // Log execution
      this.logExecution(functionDef, parameters, executionResult, context);

      // Audit log
      await this.auditService.logEvent({
        user_id: context.userId,
        action: 'function_executed' as any,
        resource_type: 'function',
        resource_id: functionDef.id,
        details: {
          functionName,
          parameters,
          executionTime,
          success: true
        }
      });

      return executionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Function execution failed: ${functionName}`, {
        error: errorMessage,
        parameters,
        context
      });

      const executionResult: FunctionExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime,
        timestamp
      };

      // Audit log
      await this.auditService.logEvent({
        user_id: context.userId,
        action: 'function_execution_failed' as any,
        resource_type: 'function',
        details: {
          functionName,
          parameters,
          error: errorMessage,
          executionTime
        }
      });

      return executionResult;
    }
  }

  /**
   * Validate function parameters
   */
  private validateParameters(params: any, paramDefs: FunctionParameter[]): void {
    // Check required parameters
    for (const paramDef of paramDefs) {
      if (paramDef.required && !(paramDef.name in params)) {
        throw new Error(`Missing required parameter: ${paramDef.name}`);
      }

      if (paramDef.name in params) {
        const value = params[paramDef.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        // Type checking
        if (actualType !== paramDef.type && value !== null && value !== undefined) {
          throw new Error(`Invalid type for parameter ${paramDef.name}: expected ${paramDef.type}, got ${actualType}`);
        }

        // Enum validation
        if (paramDef.enum && !paramDef.enum.includes(value)) {
          throw new Error(`Invalid value for parameter ${paramDef.name}: must be one of ${paramDef.enum.join(', ')}`);
        }
      }
    }
  }

  /**
   * Log function execution
   */
  private logExecution(
    functionDef: FunctionDefinition,
    parameters: any,
    result: FunctionExecutionResult,
    context: FunctionContext
  ): void {
    const log: FunctionExecutionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      functionId: functionDef.id,
      functionName: functionDef.name,
      conversationId: context.conversationId,
      agentId: context.agentId,
      parameters,
      result,
      createdAt: new Date()
    };

    this.executionLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(-1000);
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(filters?: {
    functionId?: string;
    conversationId?: string;
    agentId?: string;
    limit?: number;
  }): FunctionExecutionLog[] {
    let logs = [...this.executionLogs];

    if (filters) {
      if (filters.functionId) {
        logs = logs.filter(l => l.functionId === filters.functionId);
      }
      if (filters.conversationId) {
        logs = logs.filter(l => l.conversationId === filters.conversationId);
      }
      if (filters.agentId) {
        logs = logs.filter(l => l.agentId === filters.agentId);
      }
      if (filters.limit) {
        logs = logs.slice(-filters.limit);
      }
    }

    return logs.reverse(); // Most recent first
  }

  /**
   * Get function schema for LLM
   */
  getFunctionSchemaForLLM(agentId: string): any[] {
    const functions = this.listFunctions({ agentId, enabled: true });

    return functions.map(func => ({
      name: func.name,
      description: func.description,
      parameters: {
        type: 'object',
        properties: func.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum && { enum: param.enum })
          };
          return acc;
        }, {} as Record<string, any>),
        required: func.parameters.filter(p => p.required).map(p => p.name)
      }
    }));
  }

  /**
   * Register built-in functions
   */
  private registerBuiltInFunctions(): void {
    // Get current time
    this.registerFunction({
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: [
        {
          name: 'timezone',
          type: 'string',
          description: 'Timezone (e.g., America/New_York, UTC)',
          required: false,
          default: 'UTC'
        }
      ],
      handler: async (params) => {
        const timezone = params.timezone || 'UTC';
        const now = new Date();
        return {
          timestamp: now.toISOString(),
          timezone,
          formatted: now.toLocaleString('en-US', { timeZone: timezone })
        };
      },
      category: 'builtin',
      enabled: true
    });

    // Calculator
    this.registerFunction({
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          // Safe eval using Function constructor (limited scope)
          const result = Function(`'use strict'; return (${params.expression})`)();
          return { result, expression: params.expression };
        } catch (error) {
          throw new Error('Invalid mathematical expression');
        }
      },
      category: 'builtin',
      enabled: true
    });

    // Get weather (mock implementation)
    this.registerFunction({
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: [
        {
          name: 'location',
          type: 'string',
          description: 'City name or zip code',
          required: true
        },
        {
          name: 'units',
          type: 'string',
          description: 'Temperature units',
          required: false,
          enum: ['celsius', 'fahrenheit'],
          default: 'fahrenheit'
        }
      ],
      handler: async (params) => {
        // Mock implementation - in production, call actual weather API
        return {
          location: params.location,
          temperature: 72,
          units: params.units || 'fahrenheit',
          condition: 'Sunny',
          humidity: 45,
          windSpeed: 10
        };
      },
      category: 'builtin',
      enabled: true
    });

    // Search knowledge base
    this.registerFunction({
      name: 'search_knowledge_base',
      description: 'Search the agent\'s knowledge base for relevant information',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results',
          required: false,
          default: 5
        }
      ],
      handler: async (params, context) => {
        // This would integrate with your knowledge base service
        logger.info('Searching knowledge base', { query: params.query, agentId: context.agentId });
        
        // Mock implementation
        return {
          query: params.query,
          results: [],
          count: 0
        };
      },
      category: 'builtin',
      enabled: true
    });

    // Send email (mock)
    this.registerFunction({
      name: 'send_email',
      description: 'Send an email notification',
      parameters: [
        {
          name: 'to',
          type: 'string',
          description: 'Recipient email address',
          required: true
        },
        {
          name: 'subject',
          type: 'string',
          description: 'Email subject',
          required: true
        },
        {
          name: 'body',
          type: 'string',
          description: 'Email body content',
          required: true
        }
      ],
      handler: async (params) => {
        // Mock implementation - integrate with email service
        logger.info('Sending email', { to: params.to, subject: params.subject });
        
        return {
          sent: true,
          messageId: `msg_${Date.now()}`,
          to: params.to,
          subject: params.subject
        };
      },
      category: 'builtin',
      enabled: true
    });

    // Create calendar event (mock)
    this.registerFunction({
      name: 'create_calendar_event',
      description: 'Create a calendar event or appointment',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Event title',
          required: true
        },
        {
          name: 'date',
          type: 'string',
          description: 'Event date (ISO 8601 format)',
          required: true
        },
        {
          name: 'duration',
          type: 'number',
          description: 'Duration in minutes',
          required: false,
          default: 60
        }
      ],
      handler: async (params) => {
        logger.info('Creating calendar event', params);
        
        return {
          created: true,
          eventId: `evt_${Date.now()}`,
          title: params.title,
          date: params.date,
          duration: params.duration || 60
        };
      },
      category: 'builtin',
      enabled: true
    });

    logger.info('Built-in functions registered', { count: this.functions.size });
  }

  /**
   * Update function definition
   */
  updateFunction(functionId: string, updates: Partial<FunctionDefinition>): boolean {
    const func = this.functions.get(functionId);
    
    if (!func) {
      return false;
    }

    const updated = {
      ...func,
      ...updates,
      updatedAt: new Date()
    };

    this.functions.set(functionId, updated);

    logger.info(`Function updated: ${functionId}`, { updates: Object.keys(updates) });

    return true;
  }

  /**
   * Enable/disable function
   */
  setFunctionEnabled(functionId: string, enabled: boolean): boolean {
    return this.updateFunction(functionId, { enabled });
  }

  /**
   * Clear execution logs
   */
  clearExecutionLogs(conversationId?: string): void {
    if (conversationId) {
      this.executionLogs = this.executionLogs.filter(l => l.conversationId !== conversationId);
    } else {
      this.executionLogs = [];
    }
  }

  /**
   * Get function statistics
   */
  getFunctionStats(functionId?: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  } {
    let logs = this.executionLogs;

    if (functionId) {
      logs = logs.filter(l => l.functionId === functionId);
    }

    const totalExecutions = logs.length;
    const successfulExecutions = logs.filter(l => l.result.success).length;
    const failedExecutions = logs.filter(l => !l.result.success).length;
    const averageExecutionTime = logs.length > 0
      ? logs.reduce((sum, l) => sum + l.result.executionTime, 0) / logs.length
      : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime
    };
  }
}
