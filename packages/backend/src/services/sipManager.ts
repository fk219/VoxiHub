import { EventEmitter } from 'events';
import { SipService, SipCall } from './sip';
import { ConversationService } from './conversation';
import { STTService } from './stt';
import { TTSService } from './tts';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';

export interface CallSession {
  call: SipCall;
  audioStream?: MediaStream;
  isProcessingAudio: boolean;
  lastActivity: Date;
}

/**
 * SIP Manager coordinates SIP calls with conversation processing
 */
export class SipManager extends EventEmitter {
  private sipService: SipService;
  private conversationService: ConversationService;
  private sttService: STTService;
  private ttsService: TTSService;
  private databaseService: DatabaseService;
  private callSessions: Map<string, CallSession> = new Map();
  private audioProcessingInterval?: NodeJS.Timeout;

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

    this.setupEventHandlers();
  }

  /**
   * Initialize SIP manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing SIP manager...');
      
      // Initialize SIP service
      await this.sipService.initialize();
      
      // Start audio processing loop
      this.startAudioProcessing();
      
      logger.info('SIP manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SIP manager:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for SIP service
   */
  private setupEventHandlers(): void {
    // Handle call connected
    this.sipService.on('callConnected', (call: SipCall) => {
      this.handleCallConnected(call);
    });

    // Handle call ended
    this.sipService.on('callEnded', (call: SipCall) => {
      this.handleCallEnded(call);
    });

    // Handle call failed
    this.sipService.on('callFailed', (call: SipCall) => {
      this.handleCallFailed(call);
    });

    // Handle audio track
    this.sipService.on('audioTrack', ({ call, track }) => {
      this.handleAudioTrack(call, track);
    });

    // Handle agent registration events
    this.sipService.on('agentRegistered', ({ agentId }) => {
      logger.info(`SIP agent ${agentId} registered successfully`);
    });

    this.sipService.on('registrationFailed', ({ agentId, error }) => {
      logger.error(`SIP agent ${agentId} registration failed:`, error);
    });
  }

  /**
   * Handle call connected event
   */
  private async handleCallConnected(call: SipCall): Promise<void> {
    try {
      logger.info(`Managing connected call ${call.id}`);

      const session: CallSession = {
        call,
        isProcessingAudio: false,
        lastActivity: new Date()
      };

      this.callSessions.set(call.id, session);

      // Send initial greeting if configured
      await this.sendInitialGreeting(call);

      this.emit('callSessionStarted', session);

    } catch (error) {
      logger.error(`Failed to handle connected call ${call.id}:`, error);
    }
  }

  /**
   * Handle call ended event
   */
  private handleCallEnded(call: SipCall): void {
    logger.info(`Call ${call.id} ended, cleaning up session`);
    
    const session = this.callSessions.get(call.id);
    if (session) {
      this.callSessions.delete(call.id);
      this.emit('callSessionEnded', session);
    }
  }

  /**
   * Handle call failed event
   */
  private handleCallFailed(call: SipCall): void {
    logger.warn(`Call ${call.id} failed`);
    
    const session = this.callSessions.get(call.id);
    if (session) {
      this.callSessions.delete(call.id);
      this.emit('callSessionFailed', session);
    }
  }

  /**
   * Handle audio track from SIP session
   */
  private handleAudioTrack(call: SipCall, track: MediaStreamTrack): void {
    const session = this.callSessions.get(call.id);
    if (!session) {
      logger.warn(`No session found for call ${call.id}`);
      return;
    }

    // Create media stream from track
    const stream = new MediaStream([track]);
    session.audioStream = stream;

    logger.debug(`Audio track received for call ${call.id}`);
  }

  /**
   * Send initial greeting to caller
   */
  private async sendInitialGreeting(call: SipCall): Promise<void> {
    try {
      // Get agent configuration
      const { data: agent, error } = await this.databaseService.supabase
        .from('agents')
        .select('*')
        .eq('id', call.agentId)
        .single();

      if (error || !agent) {
        logger.warn(`Could not load agent ${call.agentId} for greeting`);
        return;
      }

      // Generate greeting message
      const greeting = `Hello! You've reached ${agent.name}. How can I help you today?`;

      // Convert to speech and play
      await this.speakToCall(call.id, greeting);

      // Log greeting message
      if (call.conversationId) {
        await this.conversationService.addMessage({
          conversation_id: call.conversationId,
          role: 'agent',
          content: greeting,
          type: 'text',
          metadata: { isGreeting: true }
        });
      }

    } catch (error) {
      logger.error(`Failed to send initial greeting for call ${call.id}:`, error);
    }
  }

  /**
   * Process speech input from call
   */
  async processSpeechInput(callId: string, audioData: Buffer): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session) {
      logger.warn(`No session found for call ${callId}`);
      return;
    }

    if (session.isProcessingAudio) {
      logger.debug(`Already processing audio for call ${callId}, skipping`);
      return;
    }

    session.isProcessingAudio = true;
    session.lastActivity = new Date();

    try {
      // Convert speech to text
      const transcription = await this.sttService.transcribeAudio(audioData, {
        format: 'wav',
        sampleRate: 8000 // Typical for telephony
      });

      if (!transcription.text.trim()) {
        logger.debug(`Empty transcription for call ${callId}`);
        return;
      }

      logger.info(`Transcribed speech for call ${callId}: "${transcription.text}"`);

      // Add user message to conversation
      if (session.call.conversationId) {
        await this.conversationService.addMessage({
          conversation_id: session.call.conversationId,
          role: 'user',
          content: transcription.text,
          type: 'text',
          metadata: { 
            confidence: transcription.confidence,
            processingTime: transcription.processingTime
          }
        });

        // Process conversation and generate response
        const response = await this.conversationService.processMessage(
          session.call.conversationId,
          transcription.text
        );

        // Convert response to speech and play
        await this.speakToCall(callId, response.content);

        // Add agent response to conversation
        await this.conversationService.addMessage({
          conversation_id: session.call.conversationId,
          role: 'agent',
          content: response.content,
          type: 'text',
          metadata: response.metadata
        });
      }

    } catch (error) {
      logger.error(`Failed to process speech input for call ${callId}:`, error);
      
      // Send error response to caller
      try {
        await this.speakToCall(callId, "I'm sorry, I didn't catch that. Could you please repeat?");
      } catch (speakError) {
        logger.error(`Failed to send error response for call ${callId}:`, speakError);
      }
    } finally {
      session.isProcessingAudio = false;
    }
  }

  /**
   * Convert text to speech and play to call
   */
  private async speakToCall(callId: string, text: string): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session) {
      logger.warn(`No session found for call ${callId}`);
      return;
    }

    try {
      // Generate speech audio
      const audioBuffer = await this.ttsService.synthesizeSpeech(text, {
        voice: 'alloy', // Default voice
        format: 'wav',
        sampleRate: 8000 // Telephony standard
      });

      // TODO: Implement audio playback to SIP session
      // This would require integration with the SIP session's audio stream
      logger.debug(`Generated speech audio for call ${callId}: "${text}"`);

    } catch (error) {
      logger.error(`Failed to speak to call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Start audio processing loop
   */
  private startAudioProcessing(): void {
    this.audioProcessingInterval = setInterval(() => {
      this.processAudioStreams();
    }, 100); // Process every 100ms
  }

  /**
   * Process audio streams from active calls
   */
  private processAudioStreams(): void {
    for (const [callId, session] of this.callSessions.entries()) {
      if (session.audioStream && !session.isProcessingAudio) {
        // TODO: Implement real-time audio processing
        // This would involve:
        // 1. Reading audio chunks from the stream
        // 2. Detecting voice activity
        // 3. Buffering audio until silence is detected
        // 4. Processing complete utterances
        
        // For now, just update last activity
        session.lastActivity = new Date();
      }
    }
  }

  /**
   * Transfer call to human agent
   */
  async transferCall(callId: string, transferNumber?: string): Promise<void> {
    const session = this.callSessions.get(callId);
    if (!session) {
      throw new Error(`Call ${callId} not found`);
    }

    try {
      // Get SIP configuration for transfer number
      const { data: sipConfig, error } = await this.databaseService.supabase
        .from('sip_configs')
        .select('transfer_number, transfer_enabled')
        .eq('agent_id', session.call.agentId)
        .single();

      if (error || !sipConfig?.transfer_enabled) {
        throw new Error('Call transfer not enabled for this agent');
      }

      const targetNumber = transferNumber || sipConfig.transfer_number;
      if (!targetNumber) {
        throw new Error('No transfer number configured');
      }

      // Announce transfer to caller
      await this.speakToCall(callId, "Please hold while I transfer you to a human agent.");

      // TODO: Implement actual SIP call transfer
      // This would involve SIP REFER method
      logger.info(`Transferring call ${callId} to ${targetNumber}`);

      // Update conversation with transfer note
      if (session.call.conversationId) {
        await this.conversationService.addMessage({
          conversation_id: session.call.conversationId,
          role: 'agent',
          content: `Call transferred to ${targetNumber}`,
          type: 'text',
          metadata: { isTransfer: true, transferNumber: targetNumber }
        });

        // End conversation
        await this.conversationService.endConversation(session.call.conversationId);
      }

    } catch (error) {
      logger.error(`Failed to transfer call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Get active call sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.callSessions.values());
  }

  /**
   * Get call session by ID
   */
  getSession(callId: string): CallSession | undefined {
    return this.callSessions.get(callId);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up SIP manager...');

    // Stop audio processing
    if (this.audioProcessingInterval) {
      clearInterval(this.audioProcessingInterval);
    }

    // Clear all sessions
    this.callSessions.clear();

    // Cleanup SIP service
    await this.sipService.cleanup();

    logger.info('SIP manager cleanup completed');
  }
}