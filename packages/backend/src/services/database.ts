import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../index';
import {
  Agent,
  User,
  Conversation,
  Message,
  KnowledgeBaseDocument,
  WidgetConfig,
  SipConfig,
  CreateAgentRequest,
  CreateConversationRequest,
  CreateMessageRequest,
  AgentWithConfig,
  ConversationWithMessages
} from '../database/types';

export class DatabaseService {
  private supabase: SupabaseClient;
  private serviceSupabase: SupabaseClient;

  constructor() {
    // Client for user-authenticated requests (with RLS)
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Service client for admin operations (bypasses RLS)
    this.serviceSupabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Get Supabase client with user context
   */
  getClientForUser(token: string): SupabaseClient {
    return createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
  }

  // User operations
  async createUser(userData: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data;
  }

  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get user:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data;
  }

  // Agent operations
  async createAgent(agentData: CreateAgentRequest & { user_id: string }): Promise<Agent> {
    const { data, error } = await this.supabase
      .from('agents')
      .insert(agentData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create agent:', error);
      throw new Error(`Failed to create agent: ${error.message}`);
    }

    return data;
  }

  async getAgentById(agentId: string, userId: string): Promise<Agent | null> {
    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get agent:', error);
      throw new Error(`Failed to get agent: ${error.message}`);
    }

    return data;
  }

  async getAgentsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<Agent[]> {
    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get agents:', error);
      throw new Error(`Failed to get agents: ${error.message}`);
    }

    return data || [];
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const { data, error } = await this.supabase
      .from('agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update agent:', error);
      throw new Error(`Failed to update agent: ${error.message}`);
    }

    return data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('agents')
      .delete()
      .eq('id', agentId);

    if (error) {
      logger.error('Failed to delete agent:', error);
      throw new Error(`Failed to delete agent: ${error.message}`);
    }
  }

  // Conversation operations
  async createConversation(conversationData: CreateConversationRequest): Promise<Conversation> {
    // Use service client for system-initiated conversations
    const { data, error } = await this.serviceSupabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  async getConversationById(conversationId: string, token?: string): Promise<ConversationWithMessages | null> {
    const client = token ? this.getClientForUser(token) : this.serviceSupabase;

    const { data, error } = await client
      .from('conversations')
      .select(`
        *,
        messages(*),
        agent:agents(*)
      `)
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get conversation:', error);
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return data;
  }

  async getConversationsByAgentId(agentId: string, limit: number = 50, offset: number = 0): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get conversations:', error);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return data || [];
  }

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
    const { data, error } = await this.serviceSupabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update conversation:', error);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return data;
  }

  // Message operations
  async createMessage(messageData: CreateMessageRequest): Promise<Message> {
    const { data, error } = await this.serviceSupabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create message:', error);
      throw new Error(`Failed to create message: ${error.message}`);
    }

    return data;
  }

  async getMessagesByConversationId(conversationId: string, limit: number = 100, offset: number = 0): Promise<Message[]> {
    const { data, error } = await this.serviceSupabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get messages:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }

    return data || [];
  }

  // Knowledge base operations
  async createKnowledgeBaseDocument(docData: Partial<KnowledgeBaseDocument>): Promise<KnowledgeBaseDocument> {
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .insert(docData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create knowledge base document:', error);
      throw new Error(`Failed to create knowledge base document: ${error.message}`);
    }

    return data;
  }

  async getKnowledgeBaseDocuments(agentId: string): Promise<KnowledgeBaseDocument[]> {
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get knowledge base documents:', error);
      throw new Error(`Failed to get knowledge base documents: ${error.message}`);
    }

    return data || [];
  }

  async getKnowledgeBaseUrls(agentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('knowledge_base_urls')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get knowledge base URLs:', error);
      throw new Error(`Failed to get knowledge base URLs: ${error.message}`);
    }

    return data || [];
  }

  async getKnowledgeBaseFaqs(agentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('knowledge_base_faqs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get knowledge base FAQs:', error);
      throw new Error(`Failed to get knowledge base FAQs: ${error.message}`);
    }

    return data || [];
  }

  async getKnowledgeBaseDocumentById(documentId: string): Promise<KnowledgeBaseDocument | null> {
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get knowledge base document:', error);
      throw new Error(`Failed to get knowledge base document: ${error.message}`);
    }

    return data;
  }

  async deleteKnowledgeBaseDocument(documentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('knowledge_base_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      logger.error('Failed to delete knowledge base document:', error);
      throw new Error(`Failed to delete knowledge base document: ${error.message}`);
    }
  }

  async getKnowledgeBaseByAgentId(agentId: string, token: string): Promise<{
    documents: KnowledgeBaseDocument[];
    urls: any[];
    faqs: any[];
  }> {
    const client = this.getClientForUser(token);

    const [docsResult, urlsResult, faqsResult] = await Promise.all([
      client.from('knowledge_base_documents').select('*').eq('agent_id', agentId),
      client.from('knowledge_base_urls').select('*').eq('agent_id', agentId),
      client.from('knowledge_base_faqs').select('*').eq('agent_id', agentId)
    ]);

    if (docsResult.error || urlsResult.error || faqsResult.error) {
      const error = docsResult.error || urlsResult.error || faqsResult.error;
      logger.error('Failed to get knowledge base:', error);
      throw new Error(`Failed to get knowledge base: ${error?.message}`);
    }

    return {
      documents: docsResult.data || [],
      urls: urlsResult.data || [],
      faqs: faqsResult.data || []
    };
  }

  // Widget configuration operations
  async getWidgetConfigByAgentId(agentId: string): Promise<WidgetConfig | null> {
    const { data, error } = await this.supabase
      .from('widget_configs')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get widget config:', error);
      throw new Error(`Failed to get widget config: ${error.message}`);
    }

    return data;
  }

  async createWidgetConfig(configData: Partial<WidgetConfig>): Promise<WidgetConfig> {
    const { data, error } = await this.supabase
      .from('widget_configs')
      .insert(configData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create widget config:', error);
      throw new Error(`Failed to create widget config: ${error.message}`);
    }

    return data;
  }

  async updateWidgetConfig(configId: string, configData: Partial<WidgetConfig>): Promise<WidgetConfig> {
    const { data, error } = await this.supabase
      .from('widget_configs')
      .update(configData)
      .eq('id', configId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update widget config:', error);
      throw new Error(`Failed to update widget config: ${error.message}`);
    }

    return data;
  }

  // SIP configuration operations
  async getSipConfigByAgentId(agentId: string): Promise<SipConfig | null> {
    const { data, error } = await this.supabase
      .from('sip_configs')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get SIP config:', error);
      throw new Error(`Failed to get SIP config: ${error.message}`);
    }

    return data;
  }

  async createSipConfig(configData: Partial<SipConfig>): Promise<SipConfig> {
    // Encrypt password before storing
    const dataToInsert = { ...configData };
    if (dataToInsert.password_encrypted) {
      // In production, use proper encryption
      dataToInsert.password_encrypted = Buffer.from(dataToInsert.password_encrypted).toString('base64');
    }

    const { data, error } = await this.supabase
      .from('sip_configs')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create SIP config:', error);
      throw new Error(`Failed to create SIP config: ${error.message}`);
    }

    return data;
  }

  async updateSipConfig(configId: string, configData: Partial<SipConfig>): Promise<SipConfig> {
    // Encrypt password before storing
    const dataToUpdate = { ...configData };
    if (dataToUpdate.password_encrypted) {
      // In production, use proper encryption
      dataToUpdate.password_encrypted = Buffer.from(dataToUpdate.password_encrypted).toString('base64');
    }

    const { data, error } = await this.supabase
      .from('sip_configs')
      .update(dataToUpdate)
      .eq('id', configId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update SIP config:', error);
      throw new Error(`Failed to update SIP config: ${error.message}`);
    }

    return data;
  }

  // Search and analytics operations
  async searchConversations(params: {
    userId: string;
    query: string;
    agentId?: string;
    channel?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<Conversation[]> {
    let query = this.supabase
      .from('conversations')
      .select(`
        *,
        agent:agents!inner(user_id)
      `)
      .eq('agent.user_id', params.userId)
      .order('started_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.agentId) {
      query = query.eq('agent_id', params.agentId);
    }

    if (params.channel) {
      query = query.eq('channel', params.channel);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    // For text search, we'll search in metadata for now
    // In production, you might want to use full-text search
    if (params.query) {
      query = query.ilike('metadata', `%${params.query}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to search conversations:', error);
      throw new Error(`Failed to search conversations: ${error.message}`);
    }

    return data || [];
  }

  async getConversationAnalytics(agentId: string, startDate?: Date, endDate?: Date): Promise<{
    totalConversations: number;
    activeConversations: number;
    averageDuration: number;
    averageMessages: number;
    channelBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  }> {
    try {
      let query = this.supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId);

      if (startDate) {
        query = query.gte('started_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('started_at', endDate.toISOString());
      }

      const { data: conversations, error } = await query;

      if (error) {
        logger.error('Failed to get conversation analytics:', error);
        throw new Error(`Failed to get conversation analytics: ${error.message}`);
      }

      const totalConversations = conversations?.length || 0;
      const activeConversations = conversations?.filter(c => c.status === 'active').length || 0;

      // Calculate average duration for ended conversations
      const endedConversations = conversations?.filter(c => c.ended_at) || [];
      const totalDuration = endedConversations.reduce((sum, conv) => {
        const start = new Date(conv.started_at);
        const end = new Date(conv.ended_at!);
        return sum + (end.getTime() - start.getTime());
      }, 0);
      const averageDuration = endedConversations.length > 0 ? totalDuration / endedConversations.length : 0;

      // Get message counts
      const messageCountsPromise = conversations?.map(async (conv) => {
        const { count } = await this.supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);
        return count || 0;
      }) || [];

      const messageCounts = await Promise.all(messageCountsPromise);
      const averageMessages = messageCounts.length > 0 ? 
        messageCounts.reduce((sum, count) => sum + count, 0) / messageCounts.length : 0;

      // Channel breakdown
      const channelBreakdown: Record<string, number> = {};
      conversations?.forEach(conv => {
        channelBreakdown[conv.channel] = (channelBreakdown[conv.channel] || 0) + 1;
      });

      // Status breakdown
      const statusBreakdown: Record<string, number> = {};
      conversations?.forEach(conv => {
        statusBreakdown[conv.status] = (statusBreakdown[conv.status] || 0) + 1;
      });

      return {
        totalConversations,
        activeConversations,
        averageDuration,
        averageMessages,
        channelBreakdown,
        statusBreakdown
      };
    } catch (error) {
      logger.error('Failed to get conversation analytics:', error);
      throw new Error(`Failed to get conversation analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Admin operations for conversation monitoring
  async getConversationsForUser(userId: string, filters: {
    agentId?: string;
    channel?: string;
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    limit: number;
    offset: number;
  }): Promise<ConversationWithMessages[]> {
    let query = this.supabase
      .from('conversations')
      .select(`
        *,
        messages(count),
        agent:agents!inner(id, name, user_id)
      `)
      .eq('agent.user_id', userId)
      .order('started_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }

    if (filters.channel) {
      query = query.eq('channel', filters.channel);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.startDate) {
      query = query.gte('started_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('started_at', filters.endDate.toISOString());
    }

    // For search, look in phone_number or metadata
    if (filters.search) {
      query = query.or(`phone_number.ilike.%${filters.search}%,metadata.cs.{"search":"${filters.search}"}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get conversations for user:', error);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return data || [];
  }

  async getConversationStats(userId: string, filters: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    averageDuration: number;
    channelBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    dailyStats: Array<{ date: string; conversations: number; messages: number }>;
  }> {
    let conversationQuery = this.supabase
      .from('conversations')
      .select(`
        *,
        agent:agents!inner(user_id)
      `)
      .eq('agent.user_id', userId);

    if (filters.agentId) {
      conversationQuery = conversationQuery.eq('agent_id', filters.agentId);
    }

    if (filters.startDate) {
      conversationQuery = conversationQuery.gte('started_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      conversationQuery = conversationQuery.lte('started_at', filters.endDate.toISOString());
    }

    const { data: conversations, error: convError } = await conversationQuery;

    if (convError) {
      logger.error('Failed to get conversation stats:', convError);
      throw new Error(`Failed to get conversation stats: ${convError.message}`);
    }

    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.status === 'active').length || 0;

    // Calculate average duration
    const endedConversations = conversations?.filter(c => c.ended_at) || [];
    const totalDuration = endedConversations.reduce((sum, conv) => {
      const start = new Date(conv.started_at);
      const end = new Date(conv.ended_at!);
      return sum + (end.getTime() - start.getTime());
    }, 0);
    const averageDuration = endedConversations.length > 0 ? totalDuration / endedConversations.length : 0;

    // Get total message count
    let messageQuery = this.supabase
      .from('messages')
      .select('id, conversation_id, created_at', { count: 'exact' })
      .in('conversation_id', conversations?.map(c => c.id) || []);

    const { count: totalMessages } = await messageQuery;

    // Channel and status breakdowns
    const channelBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};

    conversations?.forEach(conv => {
      channelBreakdown[conv.channel] = (channelBreakdown[conv.channel] || 0) + 1;
      statusBreakdown[conv.status] = (statusBreakdown[conv.status] || 0) + 1;
    });

    // Daily stats for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats: Array<{ date: string; conversations: number; messages: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayConversations = conversations?.filter(c => 
        c.started_at.startsWith(dateStr)
      ).length || 0;

      // This is a simplified approach - in production you'd want to optimize this query
      const { count: dayMessages } = await this.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${dateStr}T00:00:00`)
        .lt('created_at', `${dateStr}T23:59:59`)
        .in('conversation_id', conversations?.map(c => c.id) || []);

      dailyStats.push({
        date: dateStr,
        conversations: dayConversations,
        messages: dayMessages || 0
      });
    }

    return {
      totalConversations,
      activeConversations,
      totalMessages: totalMessages || 0,
      averageDuration,
      channelBreakdown,
      statusBreakdown,
      dailyStats
    };
  }

  async getOverviewAnalytics(userId: string, filters: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalAgents: number;
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    averageResponseTime: number;
    topPerformingAgents: Array<{
      agentId: string;
      agentName: string;
      conversationCount: number;
      averageDuration: number;
    }>;
  }> {
    // Get user's agents
    const { data: agents, error: agentsError } = await this.supabase
      .from('agents')
      .select('id, name')
      .eq('user_id', userId);

    if (agentsError) {
      throw new Error(`Failed to get agents: ${agentsError.message}`);
    }

    const totalAgents = agents?.length || 0;
    const agentIds = agents?.map(a => a.id) || [];

    if (agentIds.length === 0) {
      return {
        totalAgents: 0,
        totalConversations: 0,
        activeConversations: 0,
        totalMessages: 0,
        averageResponseTime: 0,
        topPerformingAgents: []
      };
    }

    // Get conversations for all agents
    let conversationQuery = this.supabase
      .from('conversations')
      .select('*')
      .in('agent_id', agentIds);

    if (filters.startDate) {
      conversationQuery = conversationQuery.gte('started_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      conversationQuery = conversationQuery.lte('started_at', filters.endDate.toISOString());
    }

    const { data: conversations, error: convError } = await conversationQuery;

    if (convError) {
      throw new Error(`Failed to get conversations: ${convError.message}`);
    }

    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.status === 'active').length || 0;

    // Get total messages
    const { count: totalMessages } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversations?.map(c => c.id) || []);

    // Calculate top performing agents
    const agentPerformance = await Promise.all(
      agents?.map(async (agent) => {
        const agentConversations = conversations?.filter(c => c.agent_id === agent.id) || [];
        const endedConversations = agentConversations.filter(c => c.ended_at);
        
        const totalDuration = endedConversations.reduce((sum, conv) => {
          const start = new Date(conv.started_at);
          const end = new Date(conv.ended_at!);
          return sum + (end.getTime() - start.getTime());
        }, 0);

        return {
          agentId: agent.id,
          agentName: agent.name,
          conversationCount: agentConversations.length,
          averageDuration: endedConversations.length > 0 ? totalDuration / endedConversations.length : 0
        };
      }) || []
    );

    const topPerformingAgents = agentPerformance
      .sort((a, b) => b.conversationCount - a.conversationCount)
      .slice(0, 5);

    return {
      totalAgents,
      totalConversations,
      activeConversations,
      totalMessages: totalMessages || 0,
      averageResponseTime: 0, // Would need to calculate from message timestamps
      topPerformingAgents
    };
  }

  async getPerformanceAnalytics(userId: string, filters: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    conversationSuccessRate: number;
    averageConversationDuration: number;
    averageMessagesPerConversation: number;
    transferRate: number;
    responseTimeMetrics: {
      average: number;
      median: number;
      p95: number;
    };
    satisfactionScore: number;
    hourlyDistribution: Array<{ hour: number; conversations: number }>;
  }> {
    let query = this.supabase
      .from('conversations')
      .select(`
        *,
        agent:agents!inner(user_id)
      `)
      .eq('agent.user_id', userId);

    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }

    if (filters.startDate) {
      query = query.gte('started_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('started_at', filters.endDate.toISOString());
    }

    const { data: conversations, error } = await query;

    if (error) {
      throw new Error(`Failed to get performance analytics: ${error.message}`);
    }

    const totalConversations = conversations?.length || 0;
    if (totalConversations === 0) {
      return {
        conversationSuccessRate: 0,
        averageConversationDuration: 0,
        averageMessagesPerConversation: 0,
        transferRate: 0,
        responseTimeMetrics: { average: 0, median: 0, p95: 0 },
        satisfactionScore: 0,
        hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({ hour: i, conversations: 0 }))
      };
    }

    // Calculate success rate (ended conversations vs transferred)
    const endedConversations = conversations?.filter(c => c.status === 'ended').length || 0;
    const transferredConversations = conversations?.filter(c => c.status === 'transferred').length || 0;
    const conversationSuccessRate = totalConversations > 0 ? 
      (endedConversations / (endedConversations + transferredConversations)) * 100 : 0;

    // Calculate average duration
    const conversationsWithDuration = conversations?.filter(c => c.ended_at) || [];
    const totalDuration = conversationsWithDuration.reduce((sum, conv) => {
      const start = new Date(conv.started_at);
      const end = new Date(conv.ended_at!);
      return sum + (end.getTime() - start.getTime());
    }, 0);
    const averageConversationDuration = conversationsWithDuration.length > 0 ? 
      totalDuration / conversationsWithDuration.length : 0;

    // Get message counts for each conversation
    const messageCountsPromise = conversations?.map(async (conv) => {
      const { count } = await this.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id);
      return count || 0;
    }) || [];

    const messageCounts = await Promise.all(messageCountsPromise);
    const averageMessagesPerConversation = messageCounts.length > 0 ? 
      messageCounts.reduce((sum, count) => sum + count, 0) / messageCounts.length : 0;

    // Transfer rate
    const transferRate = totalConversations > 0 ? 
      (transferredConversations / totalConversations) * 100 : 0;

    // Hourly distribution
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const count = conversations?.filter(c => {
        const startHour = new Date(c.started_at).getHours();
        return startHour === hour;
      }).length || 0;
      return { hour, conversations: count };
    });

    return {
      conversationSuccessRate,
      averageConversationDuration,
      averageMessagesPerConversation,
      transferRate,
      responseTimeMetrics: {
        average: 0, // Would need to calculate from message timestamps
        median: 0,
        p95: 0
      },
      satisfactionScore: 0, // Would need satisfaction data
      hourlyDistribution
    };
  }

  async getActiveConversations(userId: string): Promise<ConversationWithMessages[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select(`
        *,
        messages(id, role, content, created_at),
        agent:agents!inner(id, name, user_id)
      `)
      .eq('agent.user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('Failed to get active conversations:', error);
      throw new Error(`Failed to get active conversations: ${error.message}`);
    }

    return data || [];
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}