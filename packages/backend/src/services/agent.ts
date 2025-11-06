import { DatabaseService } from './database';
import { 
  Agent, 
  CreateAgentRequest, 
  UpdateAgentRequest, 
  AgentWithConfig,
  CreateKnowledgeBaseDocumentRequest,
  KnowledgeBaseDocument,
  CreateWidgetConfigRequest,
  CreateSipConfigRequest,
  WidgetConfig,
  SipConfig
} from '../database/types';
import Joi from 'joi';

export class AgentService {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  // Validation schemas
  private createAgentSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    personality_tone: Joi.string().valid('professional', 'friendly', 'casual', 'formal').default('professional'),
    personality_style: Joi.string().max(500).optional(),
    personality_instructions: Joi.string().max(2000).optional(),
    response_time: Joi.number().min(100).max(10000).default(1000),
    max_conversation_length: Joi.number().min(1).max(100).default(20),
    escalation_triggers: Joi.array().items(Joi.string()).default([])
  });

  private updateAgentSchema = Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    personality_tone: Joi.string().valid('professional', 'friendly', 'casual', 'formal').optional(),
    personality_style: Joi.string().max(500).optional(),
    personality_instructions: Joi.string().max(2000).optional(),
    response_time: Joi.number().min(100).max(10000).optional(),
    max_conversation_length: Joi.number().min(1).max(100).optional(),
    escalation_triggers: Joi.array().items(Joi.string()).optional()
  });

  private knowledgeBaseDocumentSchema = Joi.object({
    agent_id: Joi.string().uuid().required(),
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    file_url: Joi.string().uri().optional(),
    file_type: Joi.string().max(50).optional(),
    file_size: Joi.number().min(0).optional()
  });

  /**
   * Create a new agent
   */
  async createAgent(userId: string, agentData: CreateAgentRequest): Promise<Agent> {
    // Validate input
    const { error, value } = this.createAgentSchema.validate(agentData);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      const agent = await this.dbService.createAgent({
        ...value,
        user_id: userId
      });
      return agent;
    } catch (error) {
      throw new Error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent by ID with optional configuration details
   */
  async getAgent(agentId: string, userId: string, includeConfig: boolean = false): Promise<AgentWithConfig | null> {
    try {
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        return null;
      }

      if (!includeConfig) {
        return agent;
      }

      // Fetch additional configuration data
      const [widgetConfig, sipConfig, documents, urls, faqs] = await Promise.all([
        this.dbService.getWidgetConfigByAgentId(agentId),
        this.dbService.getSipConfigByAgentId(agentId),
        this.dbService.getKnowledgeBaseDocuments(agentId),
        this.dbService.getKnowledgeBaseUrls(agentId),
        this.dbService.getKnowledgeBaseFaqs(agentId)
      ]);

      return {
        ...agent,
        widget_config: widgetConfig || undefined,
        sip_config: sipConfig || undefined,
        knowledge_base_documents: documents,
        knowledge_base_urls: urls,
        knowledge_base_faqs: faqs
      };
    } catch (error) {
      throw new Error(`Failed to get agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all agents for a user
   */
  async getAgents(userId: string, limit: number = 50, offset: number = 0): Promise<Agent[]> {
    try {
      return await this.dbService.getAgentsByUserId(userId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to get agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an agent
   */
  async updateAgent(agentId: string, userId: string, updateData: UpdateAgentRequest): Promise<Agent> {
    // Validate input
    const { error, value } = this.updateAgentSchema.validate(updateData);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Check if agent exists and belongs to user
      const existingAgent = await this.dbService.getAgentById(agentId, userId);
      if (!existingAgent) {
        throw new Error('Agent not found or access denied');
      }

      const updatedAgent = await this.dbService.updateAgent(agentId, value);
      return updatedAgent;
    } catch (error) {
      throw new Error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      // Check if agent exists and belongs to user
      const existingAgent = await this.dbService.getAgentById(agentId, userId);
      if (!existingAgent) {
        throw new Error('Agent not found or access denied');
      }

      await this.dbService.deleteAgent(agentId);
    } catch (error) {
      throw new Error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add knowledge base document
   */
  async addKnowledgeBaseDocument(documentData: CreateKnowledgeBaseDocumentRequest, userId: string): Promise<KnowledgeBaseDocument> {
    // Validate input
    const { error, value } = this.knowledgeBaseDocumentSchema.validate(documentData);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(value.agent_id, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      const document = await this.dbService.createKnowledgeBaseDocument(value);
      return document;
    } catch (error) {
      throw new Error(`Failed to add knowledge base document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get knowledge base documents for an agent
   */
  async getKnowledgeBaseDocuments(agentId: string, userId: string): Promise<KnowledgeBaseDocument[]> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      return await this.dbService.getKnowledgeBaseDocuments(agentId);
    } catch (error) {
      throw new Error(`Failed to get knowledge base documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete knowledge base document
   */
  async deleteKnowledgeBaseDocument(documentId: string, userId: string): Promise<void> {
    try {
      // Get document to verify ownership through agent
      const document = await this.dbService.getKnowledgeBaseDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(document.agent_id, userId);
      if (!agent) {
        throw new Error('Access denied');
      }

      await this.dbService.deleteKnowledgeBaseDocument(documentId);
    } catch (error) {
      throw new Error(`Failed to delete knowledge base document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update widget configuration
   */
  async upsertWidgetConfig(configData: CreateWidgetConfigRequest, userId: string): Promise<WidgetConfig> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(configData.agent_id, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      // Check if config already exists
      const existingConfig = await this.dbService.getWidgetConfigByAgentId(configData.agent_id);
      
      if (existingConfig) {
        return await this.dbService.updateWidgetConfig(existingConfig.id, configData);
      } else {
        return await this.dbService.createWidgetConfig(configData);
      }
    } catch (error) {
      throw new Error(`Failed to save widget configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update SIP configuration
   */
  async upsertSipConfig(configData: CreateSipConfigRequest, userId: string): Promise<SipConfig> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(configData.agent_id, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      // Check if config already exists
      const existingConfig = await this.dbService.getSipConfigByAgentId(configData.agent_id);
      
      if (existingConfig) {
        return await this.dbService.updateSipConfig(existingConfig.id, configData);
      } else {
        return await this.dbService.createSipConfig(configData);
      }
    } catch (error) {
      throw new Error(`Failed to save SIP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deployment status for an agent
   */
  async getDeploymentStatus(agentId: string, userId: string): Promise<{
    widget: { status: 'active' | 'inactive' | 'error', lastDeployed?: string, error?: string }
    sip: { status: 'active' | 'inactive' | 'error', lastDeployed?: string, error?: string }
  }> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      // Get widget and SIP configurations
      const widgetConfig = await this.dbService.getWidgetConfigByAgentId(agentId);
      const sipConfig = await this.dbService.getSipConfigByAgentId(agentId);

      // For now, return basic status based on configuration existence
      // In a real implementation, this would check actual deployment status
      return {
        widget: {
          status: widgetConfig ? 'active' : 'inactive',
          lastDeployed: widgetConfig?.updated_at
        },
        sip: {
          status: sipConfig ? 'active' : 'inactive',
          lastDeployed: sipConfig?.updated_at
        }
      };
    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate widget embed code
   */
  async generateWidgetCode(agentId: string, userId: string): Promise<{ embedCode: string, scriptUrl: string }> {
    try {
      // Verify agent belongs to user
      const agent = await this.dbService.getAgentById(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found or access denied');
      }

      // Get widget configuration
      const widgetConfig = await this.dbService.getWidgetConfigByAgentId(agentId);
      
      const scriptUrl = `${process.env.CDN_URL || 'https://cdn.aiagent.com'}/widget.js`;
      
      const embedCode = `<script src="${scriptUrl}" 
        data-agent-id="${agentId}"${widgetConfig ? `
        data-theme="${widgetConfig.theme}"
        data-primary-color="${widgetConfig.primary_color}"
        data-position="${widgetConfig.position}"
        data-size="${widgetConfig.size}"
        data-auto-open="${widgetConfig.auto_open}"
        data-voice-enabled="${widgetConfig.voice_enabled}"
        data-push-to-talk="${widgetConfig.push_to_talk}"` : ''}>
</script>`;

      return {
        embedCode,
        scriptUrl
      };
    } catch (error) {
      throw new Error(`Failed to generate widget code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}