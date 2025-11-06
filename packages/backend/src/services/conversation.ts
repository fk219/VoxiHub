import { DatabaseService } from './database';
import { 
  Conversation, 
  Message, 
  CreateConversationRequest, 
  CreateMessageRequest,
  ConversationWithMessages,
  ConversationStatus,
  ChannelType
} from '../database/types';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import Joi from 'joi';

export interface ConversationContext {
  userId?: string;
  agentId: string;
  sessionId: string;
  lastActivity: Date;
  messageCount: number;
  metadata: Record<string, any>;
}

export class ConversationService {
  private dbService: DatabaseService;
  private redis: RedisClientType;

  constructor(dbService: DatabaseService, redis: RedisClientType) {
    this.dbService = dbService;
    this.redis = redis;
  }

  // Validation schemas
  private createConversationSchema = Joi.object({
    agent_id: Joi.string().uuid().required(),
    channel: Joi.string().valid('widget', 'sip').required(),
    phone_number: Joi.string().optional(),
    metadata: Joi.object().default({})
  });

  private createMessageSchema = Joi.object({
    conversation_id: Joi.string().uuid().required(),
    role: Joi.string().valid('user', 'agent').required(),
    content: Joi.string().min(1).required(),
    type: Joi.string().valid('text', 'audio').default('text'),
    audio_url: Joi.string().uri().optional(),
    transcription: Joi.string().optional(),
    metadata: Joi.object().default({})
  });

  /**
   * Start a new conversation session
   */
  async startConversation(conversationData: CreateConversationRequest, userId?: string): Promise<Conversation> {
    // Validate input
    const { error, value } = this.createConversationSchema.validate(conversationData);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Create conversation in database
      const conversation = await this.dbService.createConversation({
        ...value,
        user_id: userId,
        status: 'active' as ConversationStatus,
        context: {},
        started_at: new Date().toISOString()
      });

      // Initialize conversation context in Redis
      const contextKey = `conversation:${conversation.id}:context`;
      const context: ConversationContext = {
        userId,
        agentId: value.agent_id,
        sessionId: conversation.id,
        lastActivity: new Date(),
        messageCount: 0,
        metadata: value.metadata || {}
      };

      await this.redis.setEx(contextKey, 3600, JSON.stringify(context)); // 1 hour TTL

      return conversation;
    } catch (error) {
      throw new Error(`Failed to start conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation by ID with messages
   */
  async getConversation(conversationId: string, userId?: string): Promise<ConversationWithMessages | null> {
    try {
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        return null;
      }

      // Check access permissions if userId is provided
      if (userId && conversation.user_id !== userId) {
        return null;
      }

      return conversation;
    } catch (error) {
      throw new Error(`Failed to get conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversations for an agent
   */
  async getConversationsByAgent(agentId: string, userId: string, limit: number = 50, offset: number = 0): Promise<Conversation[]> {
    try {
      // First verify the agent belongs to the user
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      return await this.dbService.getConversationsByAgentId(agentId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to get conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(messageData: CreateMessageRequest): Promise<Message> {
    // Validate input
    const { error, value } = this.createMessageSchema.validate(messageData);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Check if conversation exists and is active
      const conversation = await this.dbService.getConversationById(value.conversation_id);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.status !== 'active') {
        throw new Error('Cannot add message to inactive conversation');
      }

      // Create message in database
      const message = await this.dbService.createMessage(value);

      // Update conversation context in Redis
      await this.updateConversationContext(value.conversation_id, {
        lastActivity: new Date(),
        messageCount: 1 // Will be incremented
      });

      // Update conversation last activity in database
      await this.dbService.updateConversation(value.conversation_id, {
        updated_at: new Date().toISOString()
      });

      return message;
    } catch (error) {
      throw new Error(`Failed to add message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, userId?: string, limit: number = 100, offset: number = 0): Promise<Message[]> {
    try {
      // Verify access to conversation
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userId && conversation.user_id !== userId) {
        throw new Error('Access denied');
      }

      return await this.dbService.getMessagesByConversationId(conversationId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, userId?: string): Promise<Conversation> {
    try {
      // Verify access to conversation
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userId && conversation.user_id !== userId) {
        throw new Error('Access denied');
      }

      // Update conversation status
      const updatedConversation = await this.dbService.updateConversation(conversationId, {
        status: 'ended' as ConversationStatus,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Clean up Redis context
      const contextKey = `conversation:${conversationId}:context`;
      await this.redis.del(contextKey);

      return updatedConversation;
    } catch (error) {
      throw new Error(`Failed to end conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transfer conversation to human agent
   */
  async transferConversation(conversationId: string, transferReason?: string, userId?: string): Promise<Conversation> {
    try {
      // Verify access to conversation
      const conversation = await this.dbService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (userId && conversation.user_id !== userId) {
        throw new Error('Access denied');
      }

      // Update conversation status and metadata
      const metadata = {
        ...conversation.metadata,
        transfer_reason: transferReason,
        transferred_at: new Date().toISOString()
      };

      const updatedConversation = await this.dbService.updateConversation(conversationId, {
        status: 'transferred' as ConversationStatus,
        metadata,
        updated_at: new Date().toISOString()
      });

      // Update Redis context
      await this.updateConversationContext(conversationId, {
        metadata: { ...metadata, status: 'transferred' }
      });

      return updatedConversation;
    } catch (error) {
      throw new Error(`Failed to transfer conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation context from Redis
   */
  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    try {
      const contextKey = `conversation:${conversationId}:context`;
      const contextData = await this.redis.get(contextKey);
      
      if (!contextData) {
        return null;
      }

      const context = JSON.parse(contextData) as ConversationContext;
      context.lastActivity = new Date(context.lastActivity);
      
      return context;
    } catch (error) {
      throw new Error(`Failed to get conversation context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update conversation context in Redis
   */
  async updateConversationContext(conversationId: string, updates: Partial<ConversationContext>): Promise<void> {
    try {
      const contextKey = `conversation:${conversationId}:context`;
      const existingContext = await this.getConversationContext(conversationId);
      
      if (!existingContext) {
        throw new Error('Conversation context not found');
      }

      const updatedContext: ConversationContext = {
        ...existingContext,
        ...updates,
        lastActivity: updates.lastActivity || new Date()
      };

      // Increment message count if provided
      if (updates.messageCount) {
        updatedContext.messageCount += updates.messageCount;
      }

      await this.redis.setEx(contextKey, 3600, JSON.stringify(updatedContext)); // Extend TTL
    } catch (error) {
      throw new Error(`Failed to update conversation context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search conversations by content or metadata
   */
  async searchConversations(
    userId: string,
    query: string,
    agentId?: string,
    channel?: ChannelType,
    status?: ConversationStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<Conversation[]> {
    try {
      return await this.dbService.searchConversations({
        userId,
        query,
        agentId,
        channel,
        status,
        limit,
        offset
      });
    } catch (error) {
      throw new Error(`Failed to search conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation analytics for an agent
   */
  async getConversationAnalytics(agentId: string, userId: string, startDate?: Date, endDate?: Date): Promise<{
    totalConversations: number;
    activeConversations: number;
    averageDuration: number;
    averageMessages: number;
    channelBreakdown: Record<ChannelType, number>;
    statusBreakdown: Record<ConversationStatus, number>;
  }> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      return await this.dbService.getConversationAnalytics(agentId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get conversation analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired conversation contexts
   */
  async cleanupExpiredContexts(): Promise<void> {
    try {
      // This would typically be run as a background job
      const pattern = 'conversation:*:context';
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      throw new Error(`Failed to cleanup expired contexts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}