import { EventEmitter } from 'events';
import { SipService, SipCall } from './sip';
import { ConversationService } from './conversation';
import { STTService } from './stt';
import { TTSService } from './tts';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';
import { Agent, SipConfig } from '../database/types';

export interface CallCampaign {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  phoneNumbers: string[];
  message?: string;
  scheduledAt?: Date;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';
  maxRetries: number;
  retryDelay: number; // minutes
  callTimeout: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  completedCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface OutboundCall {
  id: string;
  campaignId: string;
  agentId: string;
  phoneNumber: string;
  status: 'pending' | 'calling' | 'connected' | 'completed' | 'failed' | 'no_answer' | 'busy';
  attempts: number;
  maxRetries: number;
  scheduledAt: Date;
  lastAttemptAt?: Date;
  connectedAt?: Date;
  endedAt?: Date;
  duration?: number;
  outcome?: 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail' | 'completed';
  notes?: string;
  conversationId?: string;
  sipCallId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallOutcome {
  callId: string;
  outcome: OutboundCall['outcome'];
  duration: number;
  notes?: string;
  conversationSummary?: string;
  nextAction?: 'retry' | 'complete' | 'escalate';
  retryAt?: Date;
}

/**
 * Outbound Call Service manages call campaigns and outbound calling
 */
export class OutboundCallService extends EventEmitter {
  private sipService: SipService;
  private conversationService: ConversationService;
  private sttService: STTService;
  private ttsService: TTSService;
  private databaseService: DatabaseService;
  
  private activeCampaigns: Map<string, CallCampaign> = new Map();
  private activeOutboundCalls: Map<string, OutboundCall> = new Map();
  private callQueue: OutboundCall[] = [];
  private processingInterval?: NodeJS.Timeout;
  private retryInterval?: NodeJS.Timeout;

  constructor(
    sipService: SipService,
    conversationService: ConversationService,
    sttService: STTService,
    ttsService: TTSService,
    databaseService: DatabaseService
  ) {
    super();
    this.sipService = sipService;
    this.conversationService = conversationService;
    this.sttService = sttService;
    this.ttsService = ttsService;
    this.databaseService = databaseService;
  }

  /**
   * Initialize outbound call service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing outbound call service...');
    
    // Load active campaigns from database
    await this.loadActiveCampaigns();
    
    // Start call processing
    this.startCallProcessing();
    
    // Start retry processing
    this.startRetryProcessing();
    
    logger.info('Outbound call service initialized');
  }

  /**
   * Create call campaign
   */
  async createCampaign(campaignData: {
    agentId: string;
    name: string;
    description?: string;
    phoneNumbers: string[];
    message?: string;
    scheduledAt?: Date;
    maxRetries?: number;
    retryDelay?: number;
    callTimeout?: number;
  }): Promise<CallCampaign> {
    try {
      const campaign: CallCampaign = {
        id: this.generateId(),
        agentId: campaignData.agentId,
        name: campaignData.name,
        description: campaignData.description,
        phoneNumbers: campaignData.phoneNumbers,
        message: campaignData.message,
        scheduledAt: campaignData.scheduledAt,
        status: 'pending',
        maxRetries: campaignData.maxRetries || 3,
        retryDelay: campaignData.retryDelay || 60, // 1 hour
        callTimeout: campaignData.callTimeout || 300, // 5 minutes
        createdAt: new Date(),
        updatedAt: new Date(),
        completedCalls: 0,
        successfulCalls: 0,
        failedCalls: 0
      };

      // Store campaign in database
      await this.storeCampaign(campaign);

      // Create outbound calls for each phone number
      await this.createOutboundCalls(campaign);

      this.activeCampaigns.set(campaign.id, campaign);

      logger.info(`Created campaign ${campaign.id} with ${campaign.phoneNumbers.length} calls`);
      this.emit('campaignCreated', campaign);

      return campaign;

    } catch (error) {
      logger.error('Failed to create campaign:', error);
      throw error;
    }
  }

  /**
   * Start campaign
   */
  async startCampaign(campaignId: string): Promise<void> {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    try {
      campaign.status = 'active';
      campaign.updatedAt = new Date();

      await this.updateCampaign(campaign);

      // Add calls to queue if scheduled time has passed
      const now = new Date();
      if (!campaign.scheduledAt || campaign.scheduledAt <= now) {
        await this.queueCampaignCalls(campaignId);
      }

      logger.info(`Started campaign ${campaignId}`);
      this.emit('campaignStarted', campaign);

    } catch (error) {
      logger.error(`Failed to start campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    try {
      campaign.status = 'paused';
      campaign.updatedAt = new Date();

      await this.updateCampaign(campaign);

      // Remove pending calls from queue
      this.callQueue = this.callQueue.filter(call => call.campaignId !== campaignId);

      logger.info(`Paused campaign ${campaignId}`);
      this.emit('campaignPaused', campaign);

    } catch (error) {
      logger.error(`Failed to pause campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel campaign
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    try {
      campaign.status = 'cancelled';
      campaign.updatedAt = new Date();

      await this.updateCampaign(campaign);

      // Remove all calls from queue
      this.callQueue = this.callQueue.filter(call => call.campaignId !== campaignId);

      // End any active calls for this campaign
      const activeCalls = Array.from(this.activeOutboundCalls.values())
        .filter(call => call.campaignId === campaignId);

      for (const call of activeCalls) {
        if (call.sipCallId) {
          await this.sipService.endCall(call.sipCallId);
        }
      }

      logger.info(`Cancelled campaign ${campaignId}`);
      this.emit('campaignCancelled', campaign);

    } catch (error) {
      logger.error(`Failed to cancel campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Make single outbound call
   */
  async makeOutboundCall(agentId: string, phoneNumber: string, message?: string): Promise<OutboundCall> {
    try {
      const outboundCall: OutboundCall = {
        id: this.generateId(),
        campaignId: 'single_call',
        agentId,
        phoneNumber,
        status: 'pending',
        attempts: 0,
        maxRetries: 1,
        scheduledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store call in database
      await this.storeOutboundCall(outboundCall);

      // Add to active calls
      this.activeOutboundCalls.set(outboundCall.id, outboundCall);

      // Initiate call immediately
      await this.initiateCall(outboundCall, message);

      return outboundCall;

    } catch (error) {
      logger.error(`Failed to make outbound call to ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Create outbound calls for campaign
   */
  private async createOutboundCalls(campaign: CallCampaign): Promise<void> {
    const calls: OutboundCall[] = campaign.phoneNumbers.map(phoneNumber => ({
      id: this.generateId(),
      campaignId: campaign.id,
      agentId: campaign.agentId,
      phoneNumber,
      status: 'pending',
      attempts: 0,
      maxRetries: campaign.maxRetries,
      scheduledAt: campaign.scheduledAt || new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Store calls in database
    for (const call of calls) {
      await this.storeOutboundCall(call);
      this.activeOutboundCalls.set(call.id, call);
    }
  }

  /**
   * Queue campaign calls for processing
   */
  private async queueCampaignCalls(campaignId: string): Promise<void> {
    const pendingCalls = Array.from(this.activeOutboundCalls.values())
      .filter(call => 
        call.campaignId === campaignId && 
        call.status === 'pending' &&
        call.scheduledAt <= new Date()
      );

    this.callQueue.push(...pendingCalls);
    
    logger.info(`Queued ${pendingCalls.length} calls for campaign ${campaignId}`);
  }

  /**
   * Initiate outbound call
   */
  private async initiateCall(outboundCall: OutboundCall, customMessage?: string): Promise<void> {
    try {
      logger.info(`Initiating outbound call ${outboundCall.id} to ${outboundCall.phoneNumber}`);

      outboundCall.status = 'calling';
      outboundCall.attempts += 1;
      outboundCall.lastAttemptAt = new Date();
      outboundCall.updatedAt = new Date();

      await this.updateOutboundCall(outboundCall);

      // Make SIP call
      const sipCall = await this.sipService.makeOutboundCall(
        outboundCall.agentId,
        outboundCall.phoneNumber
      );

      outboundCall.sipCallId = sipCall.id;

      // Set up call monitoring
      this.setupOutboundCallMonitoring(outboundCall, sipCall, customMessage);

      this.emit('outboundCallInitiated', outboundCall);

    } catch (error) {
      logger.error(`Failed to initiate outbound call ${outboundCall.id}:`, error);
      
      // Mark call as failed
      await this.handleCallFailure(outboundCall, 'failed', error.message);
    }
  }

  /**
   * Set up monitoring for outbound call
   */
  private setupOutboundCallMonitoring(
    outboundCall: OutboundCall, 
    sipCall: SipCall, 
    customMessage?: string
  ): void {
    // Monitor call connection
    const connectionTimeout = setTimeout(async () => {
      if (outboundCall.status === 'calling') {
        logger.warn(`Outbound call ${outboundCall.id} connection timeout`);
        await this.handleCallFailure(outboundCall, 'no_answer', 'Connection timeout');
      }
    }, 30000); // 30 seconds

    // Monitor for call connection
    const checkConnection = setInterval(async () => {
      const currentSipCall = this.sipService.getCall(sipCall.id);
      
      if (!currentSipCall) {
        clearInterval(checkConnection);
        clearTimeout(connectionTimeout);
        return;
      }

      if (currentSipCall.status === 'connected' && outboundCall.status === 'calling') {
        clearTimeout(connectionTimeout);
        clearInterval(checkConnection);
        
        outboundCall.status = 'connected';
        outboundCall.connectedAt = new Date();
        outboundCall.conversationId = currentSipCall.conversationId;
        
        await this.updateOutboundCall(outboundCall);
        await this.handleCallConnected(outboundCall, customMessage);
        
      } else if (currentSipCall.status === 'ended' || currentSipCall.status === 'failed') {
        clearTimeout(connectionTimeout);
        clearInterval(checkConnection);
        
        await this.handleCallEnded(outboundCall, currentSipCall);
      }
    }, 1000);
  }

  /**
   * Handle call connected
   */
  private async handleCallConnected(outboundCall: OutboundCall, customMessage?: string): Promise<void> {
    try {
      logger.info(`Outbound call ${outboundCall.id} connected`);

      // Get agent and campaign information
      const campaign = this.activeCampaigns.get(outboundCall.campaignId);
      const message = customMessage || campaign?.message || this.getDefaultOutboundMessage();

      // Send initial message
      if (outboundCall.conversationId) {
        await this.conversationService.addMessage({
          conversation_id: outboundCall.conversationId,
          role: 'agent',
          content: message,
          type: 'text',
          metadata: { isOutboundGreeting: true }
        });

        // Convert to speech and play
        const audioBuffer = await this.ttsService.synthesizeSpeech(message, {
          voice: 'alloy',
          format: 'wav',
          sampleRate: 8000
        });

        // TODO: Play audio to call
        logger.debug(`Playing outbound message to call ${outboundCall.id}`);
      }

      this.emit('outboundCallConnected', outboundCall);

    } catch (error) {
      logger.error(`Failed to handle connected outbound call ${outboundCall.id}:`, error);
    }
  }

  /**
   * Handle call ended
   */
  private async handleCallEnded(outboundCall: OutboundCall, sipCall: SipCall): Promise<void> {
    try {
      logger.info(`Outbound call ${outboundCall.id} ended`);

      outboundCall.status = 'completed';
      outboundCall.endedAt = new Date();
      
      if (outboundCall.connectedAt) {
        outboundCall.duration = outboundCall.endedAt.getTime() - outboundCall.connectedAt.getTime();
        outboundCall.outcome = 'completed';
      } else {
        outboundCall.outcome = 'no_answer';
      }

      await this.updateOutboundCall(outboundCall);

      // Update campaign statistics
      await this.updateCampaignStats(outboundCall.campaignId, outboundCall.outcome);

      // Remove from active calls
      this.activeOutboundCalls.delete(outboundCall.id);

      this.emit('outboundCallEnded', outboundCall);

    } catch (error) {
      logger.error(`Failed to handle ended outbound call ${outboundCall.id}:`, error);
    }
  }

  /**
   * Handle call failure
   */
  private async handleCallFailure(
    outboundCall: OutboundCall, 
    outcome: OutboundCall['outcome'], 
    reason: string
  ): Promise<void> {
    try {
      logger.warn(`Outbound call ${outboundCall.id} failed: ${reason}`);

      outboundCall.outcome = outcome;
      outboundCall.notes = reason;
      outboundCall.endedAt = new Date();

      // Check if we should retry
      if (outboundCall.attempts < outboundCall.maxRetries && 
          (outcome === 'no_answer' || outcome === 'busy')) {
        
        // Schedule retry
        const campaign = this.activeCampaigns.get(outboundCall.campaignId);
        const retryDelay = campaign?.retryDelay || 60; // minutes
        
        outboundCall.status = 'pending';
        outboundCall.scheduledAt = new Date(Date.now() + retryDelay * 60 * 1000);
        
        logger.info(`Scheduling retry for call ${outboundCall.id} in ${retryDelay} minutes`);
        
      } else {
        // No more retries
        outboundCall.status = 'failed';
        
        // Remove from active calls
        this.activeOutboundCalls.delete(outboundCall.id);
      }

      await this.updateOutboundCall(outboundCall);

      // Update campaign statistics
      if (outboundCall.status === 'failed') {
        await this.updateCampaignStats(outboundCall.campaignId, outcome);
      }

      this.emit('outboundCallFailed', { call: outboundCall, reason });

    } catch (error) {
      logger.error(`Failed to handle call failure for ${outboundCall.id}:`, error);
    }
  }

  /**
   * Get default outbound message
   */
  private getDefaultOutboundMessage(): string {
    return "Hello! This is an automated call from our AI assistant. I'm calling to follow up with you. How are you doing today?";
  }

  /**
   * Update campaign statistics
   */
  private async updateCampaignStats(campaignId: string, outcome?: OutboundCall['outcome']): Promise<void> {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign || campaignId === 'single_call') return;

    try {
      campaign.completedCalls += 1;
      
      if (outcome === 'completed' || outcome === 'answered') {
        campaign.successfulCalls += 1;
      } else if (outcome === 'failed' || outcome === 'no_answer' || outcome === 'busy') {
        campaign.failedCalls += 1;
      }

      // Check if campaign is complete
      const totalCalls = campaign.phoneNumbers.length;
      if (campaign.completedCalls >= totalCalls) {
        campaign.status = 'completed';
        logger.info(`Campaign ${campaignId} completed: ${campaign.successfulCalls}/${totalCalls} successful`);
        this.emit('campaignCompleted', campaign);
      }

      campaign.updatedAt = new Date();
      await this.updateCampaign(campaign);

    } catch (error) {
      logger.error(`Failed to update campaign stats for ${campaignId}:`, error);
    }
  }

  /**
   * Start call processing loop
   */
  private startCallProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.callQueue.length === 0) return;

      // Process one call at a time to avoid overwhelming the system
      const call = this.callQueue.shift();
      if (!call) return;

      try {
        // Check if campaign is still active
        const campaign = this.activeCampaigns.get(call.campaignId);
        if (campaign && campaign.status === 'active') {
          await this.initiateCall(call);
        }
      } catch (error) {
        logger.error(`Failed to process call ${call.id}:`, error);
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Start retry processing loop
   */
  private startRetryProcessing(): void {
    this.retryInterval = setInterval(async () => {
      const now = new Date();
      
      // Find calls ready for retry
      const retryableCalls = Array.from(this.activeOutboundCalls.values())
        .filter(call => 
          call.status === 'pending' &&
          call.attempts > 0 &&
          call.scheduledAt <= now
        );

      // Add to queue
      this.callQueue.push(...retryableCalls);
      
      if (retryableCalls.length > 0) {
        logger.info(`Queued ${retryableCalls.length} calls for retry`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Load active campaigns from database
   */
  private async loadActiveCampaigns(): Promise<void> {
    try {
      // TODO: Load campaigns from database
      logger.debug('Loading active campaigns from database');
    } catch (error) {
      logger.error('Failed to load active campaigns:', error);
    }
  }

  /**
   * Store campaign in database
   */
  private async storeCampaign(campaign: CallCampaign): Promise<void> {
    try {
      // TODO: Store campaign in database
      logger.debug(`Storing campaign ${campaign.id} in database`);
    } catch (error) {
      logger.error(`Failed to store campaign ${campaign.id}:`, error);
      throw error;
    }
  }

  /**
   * Update campaign in database
   */
  private async updateCampaign(campaign: CallCampaign): Promise<void> {
    try {
      // TODO: Update campaign in database
      logger.debug(`Updating campaign ${campaign.id} in database`);
    } catch (error) {
      logger.error(`Failed to update campaign ${campaign.id}:`, error);
      throw error;
    }
  }

  /**
   * Store outbound call in database
   */
  private async storeOutboundCall(call: OutboundCall): Promise<void> {
    try {
      // TODO: Store outbound call in database
      logger.debug(`Storing outbound call ${call.id} in database`);
    } catch (error) {
      logger.error(`Failed to store outbound call ${call.id}:`, error);
      throw error;
    }
  }

  /**
   * Update outbound call in database
   */
  private async updateOutboundCall(call: OutboundCall): Promise<void> {
    try {
      // TODO: Update outbound call in database
      logger.debug(`Updating outbound call ${call.id} in database`);
    } catch (error) {
      logger.error(`Failed to update outbound call ${call.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): CallCampaign | undefined {
    return this.activeCampaigns.get(campaignId);
  }

  /**
   * Get all active campaigns
   */
  getActiveCampaigns(): CallCampaign[] {
    return Array.from(this.activeCampaigns.values());
  }

  /**
   * Get outbound call by ID
   */
  getOutboundCall(callId: string): OutboundCall | undefined {
    return this.activeOutboundCalls.get(callId);
  }

  /**
   * Get active outbound calls
   */
  getActiveOutboundCalls(): OutboundCall[] {
    return Array.from(this.activeOutboundCalls.values());
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(campaignId: string): {
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    pendingCalls: number;
    successRate: number;
  } | null {
    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) return null;

    const pendingCalls = Array.from(this.activeOutboundCalls.values())
      .filter(call => call.campaignId === campaignId && call.status === 'pending').length;

    const totalCalls = campaign.phoneNumbers.length;
    const successRate = totalCalls > 0 ? (campaign.successfulCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      completedCalls: campaign.completedCalls,
      successfulCalls: campaign.successfulCalls,
      failedCalls: campaign.failedCalls,
      pendingCalls,
      successRate
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up outbound call service...');

    // Stop processing loops
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }

    // Cancel all active campaigns
    const cancelPromises = Array.from(this.activeCampaigns.keys()).map(campaignId =>
      this.cancelCampaign(campaignId).catch(error =>
        logger.error(`Failed to cancel campaign ${campaignId}:`, error)
      )
    );

    await Promise.allSettled(cancelPromises);

    logger.info('Outbound call service cleanup completed');
  }
}