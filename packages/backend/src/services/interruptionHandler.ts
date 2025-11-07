import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { StreamingSTTService } from './streamingSTT';
import { StreamingTTSService } from './streamingTTS';

export interface InterruptionConfig {
  enableBargeIn?: boolean;
  interruptionThreshold?: number;
  cooldownPeriod?: number;
}

export interface InterruptionEvent {
  type: 'user_speaking' | 'user_interrupted' | 'agent_interrupted';
  timestamp: number;
  confidence?: number;
}

/**
 * Interruption Handler Service
 * Manages barge-in and interruption detection for voice conversations
 */
export class InterruptionHandler extends EventEmitter {
  private config: InterruptionConfig;
  private sttService: StreamingSTTService;
  private ttsService: StreamingTTSService;
  private isAgentSpeaking: boolean = false;
  private lastInterruptionTime: number = 0;
  private interruptionBuffer: string[] = [];

  constructor(
    sttService: StreamingSTTService,
    ttsService: StreamingTTSService,
    config: InterruptionConfig = {}
  ) {
    super();
    this.sttService = sttService;
    this.ttsService = ttsService;
    this.config = {
      enableBargeIn: config.enableBargeIn !== false,
      interruptionThreshold: config.interruptionThreshold || 0.7,
      cooldownPeriod: config.cooldownPeriod || 1000, // 1 second
    };

    this.setupListeners();
  }

  /**
   * Setup event listeners
   */
  private setupListeners(): void {
    // Listen for transcription events
    this.sttService.on('transcription', (chunk) => {
      this.handleTranscription(chunk);
    });

    // Listen for TTS events
    this.ttsService.on('start', () => {
      this.isAgentSpeaking = true;
      this.emit('agent_speaking_start');
    });

    this.ttsService.on('end', () => {
      this.isAgentSpeaking = false;
      this.emit('agent_speaking_end');
    });

    this.ttsService.on('cancelled', () => {
      this.isAgentSpeaking = false;
      this.emit('agent_interrupted');
    });
  }

  /**
   * Handle transcription and detect interruptions
   */
  private handleTranscription(chunk: any): void {
    const now = Date.now();

    // Check if user is speaking while agent is speaking
    if (this.isAgentSpeaking && this.config.enableBargeIn) {
      // Check cooldown period
      if (now - this.lastInterruptionTime < this.config.cooldownPeriod!) {
        return;
      }

      // Check if transcription confidence is high enough
      const confidence = chunk.confidence || 1.0;
      if (confidence >= this.config.interruptionThreshold!) {
        this.handleInterruption(chunk.text);
      }
    }

    // Emit user speaking event
    if (chunk.text && chunk.text.trim()) {
      const event: InterruptionEvent = {
        type: 'user_speaking',
        timestamp: now,
        confidence: chunk.confidence,
      };
      this.emit('user_speaking', event);
    }
  }

  /**
   * Handle interruption
   */
  private handleInterruption(text: string): void {
    const now = Date.now();
    this.lastInterruptionTime = now;

    logger.info('User interruption detected', { text });

    // Cancel current TTS
    if (this.ttsService.isActive()) {
      this.ttsService.cancel();
    }

    // Store interrupted text
    this.interruptionBuffer.push(text);

    // Emit interruption event
    const event: InterruptionEvent = {
      type: 'user_interrupted',
      timestamp: now,
    };
    this.emit('interruption', event);
  }

  /**
   * Get buffered interruption text
   */
  getInterruptionBuffer(): string[] {
    return [...this.interruptionBuffer];
  }

  /**
   * Clear interruption buffer
   */
  clearInterruptionBuffer(): void {
    this.interruptionBuffer = [];
  }

  /**
   * Enable/disable barge-in
   */
  setBargeInEnabled(enabled: boolean): void {
    this.config.enableBargeIn = enabled;
    logger.info('Barge-in', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Check if agent is currently speaking
   */
  isAgentCurrentlySpeaking(): boolean {
    return this.isAgentSpeaking;
  }

  /**
   * Force stop agent speaking
   */
  stopAgentSpeaking(): void {
    if (this.isAgentSpeaking) {
      this.ttsService.cancel();
    }
  }

  /**
   * Reset handler state
   */
  reset(): void {
    this.isAgentSpeaking = false;
    this.lastInterruptionTime = 0;
    this.interruptionBuffer = [];
  }
}
