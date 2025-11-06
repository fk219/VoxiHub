import { EventEmitter } from 'events';
import { SipCall } from './sip';
import { ConversationService } from './conversation';
import { STTService } from './stt';
import { TTSService } from './tts';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';
import { Agent, SipConfig, Conversation } from '../database/types';

export interface InboundCallSession {
  call: SipCall;
  agent: Agent;
  sipConfig: SipConfig;
  conversation: Conversation;
  isRecording: boolean;
  recordingUrl?: string;
  audioBuffer: Buffer[];
  lastSpeechTime: Date;
  isProcessingSpeech: boolean;
  transferRequested: boolean;
}

export interface CallRecording {
  callId: string;
  conversationId: string;
  audioUrl: string;
  transcriptUrl?: string;
  duration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Inbound Call Handler manages incoming SIP calls
 */
export class InboundCallHandler extends EventEmitter {
  private conversationService: ConversationService;
  private sttService: STTService;
  private ttsService: TTSService;
  private databaseService: DatabaseService;
  private activeSessions: Map<string, InboundCallSession> = new Map();
  private speechDetectionInterval?: NodeJS.Timeout;

  constructor(
    conversationService: ConversationService,
    sttService: STTService,
    ttsService: TTSService,
    databaseService: DatabaseService
  ) {
    super();
    this.conversationService = conversationService;
    this.sttService = sttService;
    this.ttsService = ttsService;
    this.databaseService = databaseService;
  }

  /**
   * Initialize inbound call handler
   */
  async initialize(): Promise<void> {
    logger.info('Initializing inbound call handler...');
    
    // Start speech detection loop
    this.startSpeechDetection();
    
    logger.info('Inbound call handler initialized');
  }

  /**
   * Handle incoming call
   */
  async handleIncomingCall(call: SipCall): Promise<void> {
    try {
      logger.info(`Handling incoming call ${call.id} from ${call.phoneNumber}`);

      // Find agent configuration for the called number
      const { agent, sipConfig } = await this.findAgentForCall(call);
      
      if (!agent || !sipConfig) {
        logger.warn(`No agent configuration found for call ${call.id}`);
        await this.rejectCall(call, 'No agent available');
        return;
      }

      // Create conversation
      const conversation = await this.conversationService.createConversation({
        agent_id: agent.id,
        channel: 'sip',
        phone_number: call.phoneNumber,
        metadata: {
          callId: call.id,
          sessionId: call.sessionId,
          direction: call.direction,
          calledNumber: this.extractCalledNumber(call)
        }
      });

      // Create call session
      const session: InboundCallSession = {
        call,
        agent,
        sipConfig,
        conversation,
        isRecording: sipConfig.record_calls,
        audioBuffer: [],
        lastSpeechTime: new Date(),
        isProcessingSpeech: false,
        transferRequested: false
      };

      this.activeSessions.set(call.id, session);

      // Start call recording if enabled
      if (session.isRecording) {
        await this.startCallRecording(session);
      }

      // Send initial greeting
      await this.sendInitialGreeting(session);

      // Set up call monitoring
      this.setupCallMonitoring(session);

      logger.info(`Incoming call ${call.id} handled successfully`);
      this.emit('callHandled', session);

    } catch (error) {
      logger.error(`Failed to handle incoming call ${call.id}:`, error);
      await this.rejectCall(call, 'Internal error');
      this.emit('callHandlingFailed', { call, error });
    }
  }

  /**
   * Find agent configuration for incoming call
   */
  private async findAgentForCall(call: SipCall): Promise<{ agent?: Agent; sipConfig?: SipConfig }> {
    try {
      // Extract called number from call metadata
      const calledNumber = this.extractCalledNumber(call);
      
      // Find SIP configuration that handles this number
      const { data: sipConfigs, error } = await this.databaseService.supabase
        .from('sip_configs')
        .select(`
          *,
          agents (*)
        `)
        .contains('inbound_numbers', [calledNumber]);

      if (error) {
        logger.error('Failed to query SIP configurations:', error);
        return {};
      }

      if (!sipConfigs || sipConfigs.length === 0) {
        // Try to find a default configuration (first available)
        const { data: defaultConfigs, error: defaultError } = await this.databaseService.supabase
          .from('sip_configs')
          .select(`
            *,
            agents (*)
          `)
          .limit(1);

        if (defaultError || !defaultConfigs || defaultConfigs.length === 0) {
          return {};
        }

        return {
          agent: defaultConfigs[0].agents,
          sipConfig: defaultConfigs[0]
        };
      }

      // Return the first matching configuration
      return {
        agent: sipConfigs[0].agents,
        sipConfig: sipConfigs[0]
      };

    } catch (error) {
      logger.error('Failed to find agent for call:', error);
      return {};
    }
  }

  /**
   * Extract called number from call
   */
  private extractCalledNumber(call: SipCall): string {
    // TODO: Extract from SIP headers or call metadata
    // For now, return a placeholder
    return call.metadata?.calledNumber || '+1234567890';
  }

  /**
   * Reject incoming call
   */
  private async rejectCall(call: SipCall, reason: string): Promise<void> {
    try {
      logger.info(`Rejecting call ${call.id}: ${reason}`);
      
      // TODO: Send SIP BUSY or DECLINE response
      // This would be handled by the SIP service
      
      this.emit('callRejected', { call, reason });
    } catch (error) {
      logger.error(`Failed to reject call ${call.id}:`, error);
    }
  }

  /**
   * Start call recording
   */
  private async startCallRecording(session: InboundCallSession): Promise<void> {
    try {
      logger.info(`Starting call recording for ${session.call.id}`);
      
      // TODO: Implement actual call recording
      // This would involve:
      // 1. Setting up audio capture from SIP session
      // 2. Saving audio to file or streaming service
      // 3. Generating recording URL
      
      session.recordingUrl = `recordings/${session.call.id}_${Date.now()}.wav`;
      
      logger.debug(`Call recording started: ${session.recordingUrl}`);
    } catch (error) {
      logger.error(`Failed to start call recording for ${session.call.id}:`, error);
    }
  }

  /**
   * Send initial greeting
   */
  private async sendInitialGreeting(session: InboundCallSession): Promise<void> {
    try {
      const greeting = this.generateGreeting(session.agent);
      
      // Convert greeting to speech
      const audioBuffer = await this.ttsService.synthesizeSpeech(greeting, {
        voice: 'alloy',
        format: 'wav',
        sampleRate: 8000 // Telephony standard
      });

      // Play greeting to caller
      await this.playAudioToCall(session, audioBuffer);

      // Add greeting message to conversation
      await this.conversationService.addMessage({
        conversation_id: session.conversation.id,
        role: 'agent',
        content: greeting,
        type: 'text',
        metadata: { isGreeting: true }
      });

      logger.info(`Initial greeting sent for call ${session.call.id}`);

    } catch (error) {
      logger.error(`Failed to send initial greeting for call ${session.call.id}:`, error);
    }
  }

  /**
   * Generate greeting message
   */
  private generateGreeting(agent: Agent): string {
    const timeOfDay = this.getTimeOfDay();
    return `Good ${timeOfDay}! Thank you for calling. This is ${agent.name}. How can I help you today?`;
  }

  /**
   * Get time of day for greeting
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Set up call monitoring
   */
  private setupCallMonitoring(session: InboundCallSession): void {
    // Monitor call duration
    const maxDuration = session.sipConfig.max_call_duration * 1000; // Convert to milliseconds
    
    setTimeout(() => {
      if (this.activeSessions.has(session.call.id)) {
        logger.info(`Call ${session.call.id} reached maximum duration, ending call`);
        this.endCall(session.call.id, 'Maximum duration reached');
      }
    }, maxDuration);

    // Monitor for silence (no speech activity)
    const silenceTimeout = 30000; // 30 seconds
    
    const checkSilence = () => {
      const timeSinceLastSpeech = Date.now() - session.lastSpeechTime.getTime();
      if (timeSinceLastSpeech > silenceTimeout && !session.isProcessingSpeech) {
        logger.info(`Call ${session.call.id} has been silent for too long, prompting caller`);
        this.promptCaller(session);
      }
    };

    // Check for silence every 10 seconds
    const silenceInterval = setInterval(checkSilence, 10000);
    
    // Clean up interval when call ends
    session.call.metadata = { ...session.call.metadata, silenceInterval };
  }

  /**
   * Prompt caller during silence
   */
  private async promptCaller(session: InboundCallSession): Promise<void> {
    try {
      const prompt = "I'm still here. Is there anything else I can help you with?";
      
      const audioBuffer = await this.ttsService.synthesizeSpeech(prompt, {
        voice: 'alloy',
        format: 'wav',
        sampleRate: 8000
      });

      await this.playAudioToCall(session, audioBuffer);

      // Add prompt to conversation
      await this.conversationService.addMessage({
        conversation_id: session.conversation.id,
        role: 'agent',
        content: prompt,
        type: 'text',
        metadata: { isPrompt: true }
      });

      // Reset last speech time
      session.lastSpeechTime = new Date();

    } catch (error) {
      logger.error(`Failed to prompt caller for ${session.call.id}:`, error);
    }
  }

  /**
   * Process incoming audio from call
   */
  async processIncomingAudio(callId: string, audioData: Buffer): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) {
      logger.warn(`No session found for call ${callId}`);
      return;
    }

    // Add to recording buffer
    if (session.isRecording) {
      session.audioBuffer.push(audioData);
    }

    // Update last speech time
    session.lastSpeechTime = new Date();

    // Skip if already processing speech
    if (session.isProcessingSpeech) {
      return;
    }

    session.isProcessingSpeech = true;

    try {
      // Convert speech to text
      const transcription = await this.sttService.transcribeAudio(audioData, {
        format: 'wav',
        sampleRate: 8000
      });

      if (!transcription.text.trim()) {
        return; // Empty transcription
      }

      logger.info(`Transcribed speech for call ${callId}: "${transcription.text}"`);

      // Add user message to conversation
      await this.conversationService.addMessage({
        conversation_id: session.conversation.id,
        role: 'user',
        content: transcription.text,
        type: 'text',
        metadata: {
          confidence: transcription.confidence,
          processingTime: transcription.processingTime
        }
      });

      // Check for transfer keywords
      if (this.shouldTransferCall(transcription.text, session)) {
        await this.initiateCallTransfer(session);
        return;
      }

      // Process conversation and generate response
      const response = await this.conversationService.processMessage(
        session.conversation.id,
        transcription.text
      );

      // Convert response to speech
      const audioBuffer = await this.ttsService.synthesizeSpeech(response.content, {
        voice: 'alloy',
        format: 'wav',
        sampleRate: 8000
      });

      // Play response to caller
      await this.playAudioToCall(session, audioBuffer);

      // Add agent response to conversation
      await this.conversationService.addMessage({
        conversation_id: session.conversation.id,
        role: 'agent',
        content: response.content,
        type: 'text',
        metadata: response.metadata
      });

    } catch (error) {
      logger.error(`Failed to process incoming audio for call ${callId}:`, error);
      
      // Send error response
      try {
        const errorMessage = "I'm sorry, I didn't catch that. Could you please repeat?";
        const audioBuffer = await this.ttsService.synthesizeSpeech(errorMessage, {
          voice: 'alloy',
          format: 'wav',
          sampleRate: 8000
        });
        await this.playAudioToCall(session, audioBuffer);
      } catch (errorResponseError) {
        logger.error(`Failed to send error response for call ${callId}:`, errorResponseError);
      }
    } finally {
      session.isProcessingSpeech = false;
    }
  }

  /**
   * Check if call should be transferred
   */
  private shouldTransferCall(text: string, session: InboundCallSession): boolean {
    if (!session.sipConfig.transfer_enabled || session.transferRequested) {
      return false;
    }

    const transferKeywords = [
      'human agent',
      'speak to a person',
      'transfer me',
      'real person',
      'customer service',
      'representative',
      'supervisor'
    ];

    const lowerText = text.toLowerCase();
    return transferKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Initiate call transfer
   */
  private async initiateCallTransfer(session: InboundCallSession): Promise<void> {
    try {
      session.transferRequested = true;
      
      const transferMessage = "I'll transfer you to a human agent. Please hold on.";
      
      const audioBuffer = await this.ttsService.synthesizeSpeech(transferMessage, {
        voice: 'alloy',
        format: 'wav',
        sampleRate: 8000
      });

      await this.playAudioToCall(session, audioBuffer);

      // Add transfer message to conversation
      await this.conversationService.addMessage({
        conversation_id: session.conversation.id,
        role: 'agent',
        content: transferMessage,
        type: 'text',
        metadata: { isTransfer: true }
      });

      // TODO: Implement actual call transfer using SIP REFER
      const transferNumber = session.sipConfig.transfer_number;
      if (transferNumber) {
        logger.info(`Transferring call ${session.call.id} to ${transferNumber}`);
        // This would be handled by the SIP service
        this.emit('callTransferRequested', { session, transferNumber });
      } else {
        logger.warn(`No transfer number configured for agent ${session.agent.id}`);
      }

    } catch (error) {
      logger.error(`Failed to initiate call transfer for ${session.call.id}:`, error);
    }
  }

  /**
   * Play audio to call
   */
  private async playAudioToCall(session: InboundCallSession, audioBuffer: Buffer): Promise<void> {
    try {
      // TODO: Implement actual audio playback to SIP session
      // This would involve sending audio data to the SIP session's audio stream
      logger.debug(`Playing audio to call ${session.call.id}`);
      
      // Emit event for audio playback
      this.emit('audioPlayback', { session, audioBuffer });
      
    } catch (error) {
      logger.error(`Failed to play audio to call ${session.call.id}:`, error);
      throw error;
    }
  }

  /**
   * End call
   */
  async endCall(callId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) {
      logger.warn(`No session found for call ${callId}`);
      return;
    }

    try {
      logger.info(`Ending call ${callId}${reason ? `: ${reason}` : ''}`);

      // Stop call recording
      if (session.isRecording) {
        await this.stopCallRecording(session);
      }

      // End conversation
      await this.conversationService.endConversation(session.conversation.id);

      // Clean up monitoring intervals
      if (session.call.metadata?.silenceInterval) {
        clearInterval(session.call.metadata.silenceInterval);
      }

      // Remove session
      this.activeSessions.delete(callId);

      logger.info(`Call ${callId} ended successfully`);
      this.emit('callEnded', { session, reason });

    } catch (error) {
      logger.error(`Failed to end call ${callId}:`, error);
    }
  }

  /**
   * Stop call recording
   */
  private async stopCallRecording(session: InboundCallSession): Promise<void> {
    try {
      if (!session.recordingUrl || session.audioBuffer.length === 0) {
        return;
      }

      logger.info(`Stopping call recording for ${session.call.id}`);

      // TODO: Implement actual recording finalization
      // This would involve:
      // 1. Combining audio buffers
      // 2. Saving to file or cloud storage
      // 3. Generating transcription
      // 4. Storing recording metadata

      const recording: CallRecording = {
        callId: session.call.id,
        conversationId: session.conversation.id,
        audioUrl: session.recordingUrl,
        duration: Date.now() - session.call.startTime!.getTime(),
        startTime: session.call.startTime!,
        endTime: new Date()
      };

      // Store recording metadata in database
      await this.storeRecordingMetadata(recording);

      logger.info(`Call recording saved: ${session.recordingUrl}`);

    } catch (error) {
      logger.error(`Failed to stop call recording for ${session.call.id}:`, error);
    }
  }

  /**
   * Store recording metadata in database
   */
  private async storeRecordingMetadata(recording: CallRecording): Promise<void> {
    try {
      // TODO: Create call_recordings table and store metadata
      logger.debug(`Storing recording metadata for call ${recording.callId}`);
    } catch (error) {
      logger.error('Failed to store recording metadata:', error);
    }
  }

  /**
   * Start speech detection loop
   */
  private startSpeechDetection(): void {
    this.speechDetectionInterval = setInterval(() => {
      // TODO: Implement voice activity detection
      // This would monitor audio streams for speech activity
    }, 100);
  }

  /**
   * Get active call sessions
   */
  getActiveSessions(): InboundCallSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session by call ID
   */
  getSession(callId: string): InboundCallSession | undefined {
    return this.activeSessions.get(callId);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up inbound call handler...');

    // Stop speech detection
    if (this.speechDetectionInterval) {
      clearInterval(this.speechDetectionInterval);
    }

    // End all active calls
    const endCallPromises = Array.from(this.activeSessions.keys()).map(callId =>
      this.endCall(callId, 'Service shutdown').catch(error =>
        logger.error(`Failed to end call ${callId} during cleanup:`, error)
      )
    );

    await Promise.allSettled(endCallPromises);

    logger.info('Inbound call handler cleanup completed');
  }
}