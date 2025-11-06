import { UserAgent, Registerer, Inviter, Invitation, SessionState } from 'sip.js';
import { WebSocketInterface } from 'sip.js/lib/platform/web';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SipConfig, Conversation, Agent } from '../database/types';
import { DatabaseService } from './database';
import { ConversationService } from './conversation';

export interface SipCall {
  id: string;
  sessionId: string;
  agentId: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
  status: 'connecting' | 'connected' | 'ended' | 'failed';
  startTime?: Date;
  endTime?: Date;
  conversationId?: string;
  session?: any; // SIP.js session
}

export interface SipProviderConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  realm: string;
  transport: 'ws' | 'wss';
}

export class SipService extends EventEmitter {
  private userAgents: Map<string, UserAgent> = new Map();
  private registerers: Map<string, Registerer> = new Map();
  private activeCalls: Map<string, SipCall> = new Map();
  private agentConfigs: Map<string, SipConfig> = new Map();
  private databaseService: DatabaseService;
  private conversationService: ConversationService;

  constructor(databaseService: DatabaseService, conversationService: ConversationService) {
    super();
    this.databaseService = databaseService;
    this.conversationService = conversationService;
  }

  /**
   * Initialize SIP service and load agent configurations
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing SIP service...');
      
      // Load all SIP configurations from database
      await this.loadSipConfigurations();
      
      // Register all configured agents
      await this.registerAllAgents();
      
      logger.info('SIP service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SIP service:', error);
      throw error;
    }
  }

  /**
   * Load SIP configurations from database
   */
  private async loadSipConfigurations(): Promise<void> {
    try {
      const { data: sipConfigs, error } = await this.databaseService.supabase
        .from('sip_configs')
        .select('*');

      if (error) {
        throw error;
      }

      for (const config of sipConfigs || []) {
        this.agentConfigs.set(config.agent_id, config);
      }

      logger.info(`Loaded ${sipConfigs?.length || 0} SIP configurations`);
    } catch (error) {
      logger.error('Failed to load SIP configurations:', error);
      throw error;
    }
  }

  /**
   * Register all agents with their SIP providers
   */
  private async registerAllAgents(): Promise<void> {
    const registrationPromises = Array.from(this.agentConfigs.entries()).map(
      ([agentId, config]) => this.registerAgent(agentId, config)
    );

    await Promise.allSettled(registrationPromises);
  }

  /**
   * Register a single agent with SIP provider
   */
  async registerAgent(agentId: string, sipConfig: SipConfig): Promise<void> {
    try {
      logger.info(`Registering agent ${agentId} with SIP provider`);

      const providerConfig: SipProviderConfig = {
        host: sipConfig.provider_host,
        port: sipConfig.provider_port,
        username: sipConfig.username,
        password: this.decryptPassword(sipConfig.password_encrypted),
        realm: sipConfig.realm,
        transport: sipConfig.provider_port === 443 ? 'wss' : 'ws'
      };

      // Create WebSocket transport
      const server = `${providerConfig.transport}://${providerConfig.host}:${providerConfig.port}`;
      const socket = new WebSocket(server);
      const transport = new WebSocketInterface(socket);

      // Create UserAgent
      const userAgent = new UserAgent({
        uri: `sip:${providerConfig.username}@${providerConfig.realm}`,
        transportOptions: {
          server,
          connectionTimeout: 30000,
          maxReconnectionAttempts: 5,
          reconnectionTimeout: 10000
        },
        delegate: {
          onInvite: (invitation: Invitation) => {
            this.handleInboundCall(agentId, invitation);
          },
          onConnect: () => {
            logger.info(`Agent ${agentId} connected to SIP provider`);
          },
          onDisconnect: (error?: Error) => {
            logger.warn(`Agent ${agentId} disconnected from SIP provider:`, error?.message);
            this.handleDisconnection(agentId);
          }
        }
      });

      // Create Registerer
      const registerer = new Registerer(userAgent, {
        expires: 300, // 5 minutes
        extraHeaders: [`Contact: <sip:${providerConfig.username}@${providerConfig.host}>`]
      });

      // Store references
      this.userAgents.set(agentId, userAgent);
      this.registerers.set(agentId, registerer);

      // Start UserAgent and register
      await userAgent.start();
      await registerer.register();

      logger.info(`Agent ${agentId} registered successfully`);
      this.emit('agentRegistered', { agentId, sipConfig });

    } catch (error) {
      logger.error(`Failed to register agent ${agentId}:`, error);
      this.emit('registrationFailed', { agentId, error });
      throw error;
    }
  }

  /**
   * Unregister an agent from SIP provider
   */
  async unregisterAgent(agentId: string): Promise<void> {
    try {
      const registerer = this.registerers.get(agentId);
      const userAgent = this.userAgents.get(agentId);

      if (registerer) {
        await registerer.unregister();
        this.registerers.delete(agentId);
      }

      if (userAgent) {
        await userAgent.stop();
        this.userAgents.delete(agentId);
      }

      this.agentConfigs.delete(agentId);
      
      logger.info(`Agent ${agentId} unregistered successfully`);
      this.emit('agentUnregistered', { agentId });

    } catch (error) {
      logger.error(`Failed to unregister agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Handle inbound call invitation
   */
  private async handleInboundCall(agentId: string, invitation: Invitation): Promise<void> {
    const callId = uuidv4();
    const phoneNumber = this.extractPhoneNumber(invitation.request.from?.uri.user || '');
    
    logger.info(`Inbound call ${callId} from ${phoneNumber} for agent ${agentId}`);

    const call: SipCall = {
      id: callId,
      sessionId: invitation.id,
      agentId,
      phoneNumber,
      direction: 'inbound',
      status: 'connecting',
      startTime: new Date()
    };

    this.activeCalls.set(callId, call);

    try {
      // Accept the invitation
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });

      // Update call status
      call.status = 'connected';
      call.session = invitation;

      // Create conversation in database
      const conversation = await this.conversationService.createConversation({
        agent_id: agentId,
        channel: 'sip',
        phone_number: phoneNumber,
        metadata: {
          callId,
          sessionId: invitation.id,
          direction: 'inbound'
        }
      });

      call.conversationId = conversation.id;

      // Set up session event handlers
      this.setupSessionHandlers(call, invitation);

      logger.info(`Inbound call ${callId} connected successfully`);
      this.emit('callConnected', call);

    } catch (error) {
      logger.error(`Failed to handle inbound call ${callId}:`, error);
      call.status = 'failed';
      call.endTime = new Date();
      this.emit('callFailed', call);
    }
  }

  /**
   * Initiate outbound call
   */
  async makeOutboundCall(agentId: string, phoneNumber: string): Promise<SipCall> {
    const userAgent = this.userAgents.get(agentId);
    const sipConfig = this.agentConfigs.get(agentId);

    if (!userAgent || !sipConfig) {
      throw new Error(`Agent ${agentId} not registered or configured`);
    }

    const callId = uuidv4();
    const targetUri = `sip:${phoneNumber}@${sipConfig.realm}`;

    logger.info(`Initiating outbound call ${callId} to ${phoneNumber} for agent ${agentId}`);

    const call: SipCall = {
      id: callId,
      sessionId: '',
      agentId,
      phoneNumber,
      direction: 'outbound',
      status: 'connecting',
      startTime: new Date()
    };

    this.activeCalls.set(callId, call);

    try {
      // Create inviter
      const inviter = new Inviter(userAgent, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });

      call.sessionId = inviter.id;
      call.session = inviter;

      // Send INVITE
      await inviter.invite();

      // Wait for session to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Call timeout'));
        }, 30000);

        inviter.stateChange.addListener((state: SessionState) => {
          if (state === SessionState.Established) {
            clearTimeout(timeout);
            resolve();
          } else if (state === SessionState.Terminated) {
            clearTimeout(timeout);
            reject(new Error('Call terminated'));
          }
        });
      });

      // Update call status
      call.status = 'connected';

      // Create conversation in database
      const conversation = await this.conversationService.createConversation({
        agent_id: agentId,
        channel: 'sip',
        phone_number: phoneNumber,
        metadata: {
          callId,
          sessionId: inviter.id,
          direction: 'outbound'
        }
      });

      call.conversationId = conversation.id;

      // Set up session event handlers
      this.setupSessionHandlers(call, inviter);

      logger.info(`Outbound call ${callId} connected successfully`);
      this.emit('callConnected', call);

      return call;

    } catch (error) {
      logger.error(`Failed to make outbound call ${callId}:`, error);
      call.status = 'failed';
      call.endTime = new Date();
      this.activeCalls.delete(callId);
      this.emit('callFailed', call);
      throw error;
    }
  }

  /**
   * End a call
   */
  async endCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    try {
      if (call.session && call.status === 'connected') {
        await call.session.bye();
      }

      call.status = 'ended';
      call.endTime = new Date();

      // End conversation
      if (call.conversationId) {
        await this.conversationService.endConversation(call.conversationId);
      }

      this.activeCalls.delete(callId);
      
      logger.info(`Call ${callId} ended successfully`);
      this.emit('callEnded', call);

    } catch (error) {
      logger.error(`Failed to end call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Get active calls for an agent
   */
  getActiveCalls(agentId?: string): SipCall[] {
    const calls = Array.from(this.activeCalls.values());
    return agentId ? calls.filter(call => call.agentId === agentId) : calls;
  }

  /**
   * Get call by ID
   */
  getCall(callId: string): SipCall | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Update SIP configuration for an agent
   */
  async updateAgentConfig(agentId: string, sipConfig: SipConfig): Promise<void> {
    // Unregister existing configuration
    if (this.agentConfigs.has(agentId)) {
      await this.unregisterAgent(agentId);
    }

    // Register with new configuration
    this.agentConfigs.set(agentId, sipConfig);
    await this.registerAgent(agentId, sipConfig);
  }

  /**
   * Set up session event handlers
   */
  private setupSessionHandlers(call: SipCall, session: any): void {
    session.stateChange.addListener((state: SessionState) => {
      logger.debug(`Call ${call.id} state changed to ${state}`);
      
      if (state === SessionState.Terminated) {
        call.status = 'ended';
        call.endTime = new Date();
        this.activeCalls.delete(call.id);
        this.emit('callEnded', call);
      }
    });

    // Handle media streams for audio processing
    session.sessionDescriptionHandler?.peerConnection?.addEventListener('track', (event: RTCTrackEvent) => {
      if (event.track.kind === 'audio') {
        this.emit('audioTrack', { call, track: event.track });
      }
    });
  }

  /**
   * Handle disconnection from SIP provider
   */
  private async handleDisconnection(agentId: string): Promise<void> {
    logger.warn(`Agent ${agentId} disconnected, attempting reconnection...`);
    
    const sipConfig = this.agentConfigs.get(agentId);
    if (sipConfig) {
      // Attempt to reconnect after delay
      setTimeout(async () => {
        try {
          await this.registerAgent(agentId, sipConfig);
        } catch (error) {
          logger.error(`Failed to reconnect agent ${agentId}:`, error);
        }
      }, 5000);
    }
  }

  /**
   * Extract phone number from SIP URI
   */
  private extractPhoneNumber(sipUser: string): string {
    // Remove any SIP formatting and return clean phone number
    return sipUser.replace(/[^0-9+]/g, '');
  }

  /**
   * Decrypt password (placeholder - implement proper encryption)
   */
  private decryptPassword(encryptedPassword: string): string {
    // TODO: Implement proper password decryption
    // For now, assume passwords are base64 encoded
    try {
      return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
    } catch {
      return encryptedPassword; // Fallback to plain text
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up SIP service...');

    // End all active calls
    const endCallPromises = Array.from(this.activeCalls.keys()).map(callId => 
      this.endCall(callId).catch(error => 
        logger.error(`Failed to end call ${callId} during cleanup:`, error)
      )
    );

    await Promise.allSettled(endCallPromises);

    // Unregister all agents
    const unregisterPromises = Array.from(this.agentConfigs.keys()).map(agentId =>
      this.unregisterAgent(agentId).catch(error =>
        logger.error(`Failed to unregister agent ${agentId} during cleanup:`, error)
      )
    );

    await Promise.allSettled(unregisterPromises);

    logger.info('SIP service cleanup completed');
  }
}