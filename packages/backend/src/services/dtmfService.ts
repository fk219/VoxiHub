import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface DTMFConfig {
  timeout?: number;
  maxDigits?: number;
  terminators?: string[];
  interDigitTimeout?: number;
}

export interface DTMFInput {
  digit: string;
  timestamp: number;
  duration?: number;
}

export interface DTMFSequence {
  digits: string;
  timestamp: number;
  complete: boolean;
}

/**
 * DTMF Service
 * Handles DTMF tone detection and processing
 */
export class DTMFService extends EventEmitter {
  private config: DTMFConfig;
  private currentSequence: string = '';
  private lastDigitTime: number = 0;
  private sequenceTimer?: NodeJS.Timeout;

  constructor(config: DTMFConfig = {}) {
    super();
    this.config = {
      timeout: config.timeout || 5000, // 5 seconds
      maxDigits: config.maxDigits || 20,
      terminators: config.terminators || ['#'],
      interDigitTimeout: config.interDigitTimeout || 3000, // 3 seconds
    };
  }

  /**
   * Process DTMF digit
   */
  processDTMF(digit: string, duration?: number): void {
    const now = Date.now();

    // Validate digit
    if (!this.isValidDTMF(digit)) {
      logger.warn('Invalid DTMF digit:', digit);
      return;
    }

    // Clear inter-digit timeout
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
    }

    // Emit digit event
    const input: DTMFInput = {
      digit,
      timestamp: now,
      duration,
    };
    this.emit('digit', input);

    // Check if terminator
    if (this.config.terminators!.includes(digit)) {
      this.completeSequence();
      return;
    }

    // Add to sequence
    this.currentSequence += digit;
    this.lastDigitTime = now;

    logger.debug('DTMF digit received', { digit, sequence: this.currentSequence });

    // Check max digits
    if (this.currentSequence.length >= this.config.maxDigits!) {
      this.completeSequence();
      return;
    }

    // Set inter-digit timeout
    this.sequenceTimer = setTimeout(() => {
      this.completeSequence();
    }, this.config.interDigitTimeout);
  }

  /**
   * Complete current sequence
   */
  private completeSequence(): void {
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = undefined;
    }

    if (this.currentSequence) {
      const sequence: DTMFSequence = {
        digits: this.currentSequence,
        timestamp: Date.now(),
        complete: true,
      };

      this.emit('sequence', sequence);
      logger.info('DTMF sequence completed', { sequence: this.currentSequence });

      this.currentSequence = '';
      this.lastDigitTime = 0;
    }
  }

  /**
   * Validate DTMF digit
   */
  private isValidDTMF(digit: string): boolean {
    return /^[0-9*#ABCD]$/.test(digit);
  }

  /**
   * Get current sequence
   */
  getCurrentSequence(): string {
    return this.currentSequence;
  }

  /**
   * Clear current sequence
   */
  clearSequence(): void {
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = undefined;
    }
    this.currentSequence = '';
    this.lastDigitTime = 0;
    this.emit('cleared');
  }

  /**
   * Reset service
   */
  reset(): void {
    this.clearSequence();
  }
}
