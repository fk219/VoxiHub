import { logger } from '../utils/logger';
import twilio from 'twilio';
import { DatabaseService } from './database';

export interface DeploymentConfig {
  type: 'twilio' | 'chat_widget' | 'voice_widget';
  agentId: string;
  config: TwilioConfig | ChatWidgetConfig | VoiceWidgetConfig;
}

export interface TwilioConfig {
  phoneNumber?: string;
  webhookUrl?: string;
  recordCalls?: boolean;
  transcribeVoicemail?: boolean;
}

export interface ChatWidgetConfig {
  websiteUrl: string;
  widgetPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  welcomeMessage: string;
  placeholder: string;
  showAvatar: boolean;
  allowFileUpload: boolean;
}

export interface VoiceWidgetConfig {
  websiteUrl: string;
  buttonText: string;
  buttonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  allowMute: boolean;
  showDuration: boolean;
  maxCallDuration: number;
}

export interface Deployment {
  id: string;
  agent_id: string;
  type: 'twilio' | 'chat_widget' | 'voice_widget';
  status: 'active' | 'inactive' | 'error';
  config: any;
  webhook_url?: string;
  embed_code?: string;
  phone_number?: string;
  created_at: Date;
  updated_at: Date;
}

export class DeploymentService {
  private twilioClient: twilio.Twilio | null = null;
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
    
    // Initialize Twilio if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  /**
   * Create a new deployment
   */
  async createDeployment(deploymentConfig: DeploymentConfig, userId: string): Promise<Deployment> {
    try {
      let deployment: Partial<Deployment> = {
        agent_id: deploymentConfig.agentId,
        type: deploymentConfig.type,
        config: deploymentConfig.config,
        status: 'inactive',
        created_at: new Date(),
        updated_at: new Date()
      };

      switch (deploymentConfig.type) {
        case 'twilio':
          deployment = await this.setupTwilioDeployment(deployment, deploymentConfig.config as TwilioConfig);
          break;
        case 'chat_widget':
          deployment = await this.setupChatWidgetDeployment(deployment, deploymentConfig.config as ChatWidgetConfig);
          break;
        case 'voice_widget':
          deployment = await this.setupVoiceWidgetDeployment(deployment, deploymentConfig.config as VoiceWidgetConfig);
          break;
      }

      // Save to database
      const savedDeployment = await this.dbService.createDeployment(deployment);
      
      logger.info('Deployment created', {
        deploymentId: savedDeployment.id,
        type: deploymentConfig.type,
        agentId: deploymentConfig.agentId
      });

      return savedDeployment;
    } catch (error) {
      logger.error('Failed to create deployment:', error);
      throw error;
    }
  }

  /**
   * Setup Twilio deployment
   */
  private async setupTwilioDeployment(
    deployment: Partial<Deployment>,
    config: TwilioConfig
  ): Promise<Partial<Deployment>> {
    if (!this.twilioClient) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      let phoneNumber = config.phoneNumber;
      
      // If no phone number provided, try to get an available one
      if (!phoneNumber) {
        const availableNumbers = await this.twilioClient.availablePhoneNumbers('US')
          .local
          .list({ limit: 1 });
        
        if (availableNumbers.length === 0) {
          throw new Error('No available phone numbers');
        }
        
        // Purchase the phone number
        const purchasedNumber = await this.twilioClient.incomingPhoneNumbers
          .create({ phoneNumber: availableNumbers[0].phoneNumber });
        
        phoneNumber = purchasedNumber.phoneNumber;
      }

      // Set up webhook URL
      const webhookUrl = `${process.env.API_BASE_URL}/api/deployments/twilio/webhook/${deployment.agent_id}`;
      
      // Configure the phone number with webhook
      const numbers = await this.twilioClient.incomingPhoneNumbers
        .list({ phoneNumber });
      
      if (numbers.length > 0) {
        await this.twilioClient.incomingPhoneNumbers(numbers[0].sid)
          .update({
            voiceUrl: webhookUrl,
            voiceMethod: 'POST',
            smsUrl: webhookUrl,
            smsMethod: 'POST'
          });
      }

      deployment.phone_number = phoneNumber;
      deployment.webhook_url = webhookUrl;
      deployment.status = 'active';

      logger.info('Twilio deployment configured', {
        phoneNumber,
        webhookUrl
      });

      return deployment;
    } catch (error) {
      logger.error('Failed to setup Twilio deployment:', error);
      deployment.status = 'error';
      throw error;
    }
  }

  /**
   * Setup Chat Widget deployment
   */
  private async setupChatWidgetDeployment(
    deployment: Partial<Deployment>,
    config: ChatWidgetConfig
  ): Promise<Partial<Deployment>> {
    try {
      const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const apiEndpoint = `${process.env.API_BASE_URL}/api/deployments/chat/${deployment.agent_id}`;
      
      // Generate embed code
      const embedCode = this.generateChatWidgetEmbedCode(widgetId, apiEndpoint, config);
      
      deployment.embed_code = embedCode;
      deployment.status = 'active';

      logger.info('Chat widget deployment configured', {
        widgetId,
        websiteUrl: config.websiteUrl
      });

      return deployment;
    } catch (error) {
      logger.error('Failed to setup chat widget deployment:', error);
      deployment.status = 'error';
      throw error;
    }
  }

  /**
   * Setup Voice Widget deployment
   */
  private async setupVoiceWidgetDeployment(
    deployment: Partial<Deployment>,
    config: VoiceWidgetConfig
  ): Promise<Partial<Deployment>> {
    try {
      const widgetId = `voice_widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const apiEndpoint = `${process.env.API_BASE_URL}/api/deployments/voice/${deployment.agent_id}`;
      
      // Generate embed code
      const embedCode = this.generateVoiceWidgetEmbedCode(widgetId, apiEndpoint, config);
      
      deployment.embed_code = embedCode;
      deployment.status = 'active';

      logger.info('Voice widget deployment configured', {
        widgetId,
        websiteUrl: config.websiteUrl
      });

      return deployment;
    } catch (error) {
      logger.error('Failed to setup voice widget deployment:', error);
      deployment.status = 'error';
      throw error;
    }
  }

  /**
   * Generate chat widget embed code
   */
  private generateChatWidgetEmbedCode(widgetId: string, apiEndpoint: string, config: ChatWidgetConfig): string {
    return `<!-- VoxiHub Chat Widget -->
<div id="${widgetId}"></div>
<script>
  (function() {
    var config = ${JSON.stringify({
      widgetId,
      apiEndpoint,
      position: config.widgetPosition,
      primaryColor: config.primaryColor,
      welcomeMessage: config.welcomeMessage,
      placeholder: config.placeholder,
      showAvatar: config.showAvatar,
      allowFileUpload: config.allowFileUpload
    }, null, 2)};
    
    var script = document.createElement('script');
    script.src = '${process.env.CDN_URL || process.env.API_BASE_URL}/widgets/chat.js';
    script.async = true;
    script.onload = function() {
      if (window.VoxiHubChat) {
        window.VoxiHubChat.init(config);
      }
    };
    document.body.appendChild(script);
    
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '${process.env.CDN_URL || process.env.API_BASE_URL}/widgets/chat.css';
    document.head.appendChild(style);
  })();
</script>`;
  }

  /**
   * Generate voice widget embed code
   */
  private generateVoiceWidgetEmbedCode(widgetId: string, apiEndpoint: string, config: VoiceWidgetConfig): string {
    return `<!-- VoxiHub Voice Widget -->
<div id="${widgetId}"></div>
<script>
  (function() {
    var config = ${JSON.stringify({
      widgetId,
      apiEndpoint,
      buttonText: config.buttonText,
      position: config.buttonPosition,
      primaryColor: config.primaryColor,
      allowMute: config.allowMute,
      showDuration: config.showDuration,
      maxCallDuration: config.maxCallDuration
    }, null, 2)};
    
    var script = document.createElement('script');
    script.src = '${process.env.CDN_URL || process.env.API_BASE_URL}/widgets/voice.js';
    script.async = true;
    script.onload = function() {
      if (window.VoxiHubVoice) {
        window.VoxiHubVoice.init(config);
      }
    };
    document.body.appendChild(script);
    
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '${process.env.CDN_URL || process.env.API_BASE_URL}/widgets/voice.css';
    document.head.appendChild(style);
  })();
</script>`;
  }

  /**
   * Get deployments for an agent
   */
  async getAgentDeployments(agentId: string): Promise<Deployment[]> {
    try {
      return await this.dbService.getDeploymentsByAgent(agentId);
    } catch (error) {
      logger.error('Failed to get agent deployments:', error);
      return [];
    }
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    try {
      return await this.dbService.getDeploymentById(deploymentId);
    } catch (error) {
      logger.error('Failed to get deployment:', error);
      return null;
    }
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    try {
      const deployment = await this.dbService.getDeploymentById(deploymentId);
      
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Clean up Twilio resources if applicable
      if (deployment.type === 'twilio' && deployment.phone_number && this.twilioClient) {
        try {
          const numbers = await this.twilioClient.incomingPhoneNumbers
            .list({ phoneNumber: deployment.phone_number });
          
          if (numbers.length > 0) {
            await this.twilioClient.incomingPhoneNumbers(numbers[0].sid).remove();
          }
        } catch (error) {
          logger.error('Failed to release Twilio phone number:', error);
        }
      }

      await this.dbService.deleteDeployment(deploymentId);
      
      logger.info('Deployment deleted', { deploymentId });
    } catch (error) {
      logger.error('Failed to delete deployment:', error);
      throw error;
    }
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(deploymentId: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
    try {
      await this.dbService.updateDeployment(deploymentId, { status, updated_at: new Date() });
      logger.info('Deployment status updated', { deploymentId, status });
    } catch (error) {
      logger.error('Failed to update deployment status:', error);
      throw error;
    }
  }
}
