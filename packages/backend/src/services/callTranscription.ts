import { EventEmitter } from 'events';
import { STTService } from './stt';
import { DatabaseService } from './database';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface TranscriptionSegment {
  startTime: number;
  endTime: number;
  speaker: 'caller' | 'agent';
  text: string;
  confidence: number;
}

export interface CallTranscript {
  callId: string;
  conversationId: string;
  segments: TranscriptionSegment[];
  duration: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudioSegment {
  audioData: Buffer;
  timestamp: number;
  speaker: 'caller' | 'agent';
  duration: number;
}

/**
 * Call Transcription Service handles real-time and batch transcription of calls
 */
export class CallTranscriptionService extends EventEmitter {
  private sttService: STTService;
  private databaseService: DatabaseService;
  private activeTranscriptions: Map<string, CallTranscript> = new Map();
  private audioBuffers: Map<string, AudioSegment[]> = new Map();
  private transcriptionQueue: Map<string, AudioSegment[]> = new Map();
  private processingInterval?: NodeJS.Timeout;

  constructor(sttService: STTService, databaseService: DatabaseService) {
    super();
    this.sttService = sttService;
    this.databaseService = databaseService;
  }

  /**
   * Initialize transcription service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing call transcription service...');
    
    // Start transcription processing loop
    this.startTranscriptionProcessing();
    
    logger.info('Call transcription service initialized');
  }

  /**
   * Start transcription for a call
   */
  async startTranscription(callId: string, conversationId: string): Promise<void> {
    try {
      logger.info(`Starting transcription for call ${callId}`);

      const transcript: CallTranscript = {
        callId,
        conversationId,
        segments: [],
        duration: 0,
        wordCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.activeTranscriptions.set(callId, transcript);
      this.audioBuffers.set(callId, []);
      this.transcriptionQueue.set(callId, []);

      this.emit('transcriptionStarted', { callId, conversationId });

    } catch (error) {
      logger.error(`Failed to start transcription for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Add audio segment for transcription
   */
  async addAudioSegment(
    callId: string, 
    audioData: Buffer, 
    speaker: 'caller' | 'agent',
    timestamp?: number
  ): Promise<void> {
    const audioBuffer = this.audioBuffers.get(callId);
    const transcriptionQueue = this.transcriptionQueue.get(callId);

    if (!audioBuffer || !transcriptionQueue) {
      logger.warn(`No active transcription for call ${callId}`);
      return;
    }

    const segment: AudioSegment = {
      audioData,
      timestamp: timestamp || Date.now(),
      speaker,
      duration: this.estimateAudioDuration(audioData)
    };

    // Add to audio buffer for recording
    audioBuffer.push(segment);

    // Add to transcription queue for processing
    transcriptionQueue.push(segment);

    // Process immediately if queue is getting large
    if (transcriptionQueue.length >= 5) {
      await this.processTranscriptionQueue(callId);
    }
  }

  /**
   * Process transcription queue for a call
   */
  private async processTranscriptionQueue(callId: string): Promise<void> {
    const queue = this.transcriptionQueue.get(callId);
    const transcript = this.activeTranscriptions.get(callId);

    if (!queue || !transcript || queue.length === 0) {
      return;
    }

    try {
      // Process segments in batches
      const segmentsToProcess = queue.splice(0, 5); // Process up to 5 segments at once
      
      for (const segment of segmentsToProcess) {
        await this.transcribeAudioSegment(callId, segment);
      }

    } catch (error) {
      logger.error(`Failed to process transcription queue for call ${callId}:`, error);
    }
  }

  /**
   * Transcribe individual audio segment
   */
  private async transcribeAudioSegment(callId: string, segment: AudioSegment): Promise<void> {
    const transcript = this.activeTranscriptions.get(callId);
    if (!transcript) return;

    try {
      // Skip very short audio segments
      if (segment.duration < 500) { // Less than 500ms
        return;
      }

      // Transcribe audio
      const result = await this.sttService.transcribeAudio(segment.audioData, {
        format: 'wav',
        sampleRate: 8000
      });

      if (!result.text.trim()) {
        return; // Empty transcription
      }

      // Create transcription segment
      const transcriptionSegment: TranscriptionSegment = {
        startTime: segment.timestamp - transcript.createdAt.getTime(),
        endTime: segment.timestamp - transcript.createdAt.getTime() + segment.duration,
        speaker: segment.speaker,
        text: result.text,
        confidence: result.confidence || 0.8
      };

      // Add to transcript
      transcript.segments.push(transcriptionSegment);
      transcript.wordCount += result.text.split(' ').length;
      transcript.updatedAt = new Date();

      logger.debug(`Transcribed segment for call ${callId}: "${result.text}"`);
      
      // Emit real-time transcription event
      this.emit('segmentTranscribed', {
        callId,
        segment: transcriptionSegment
      });

      // Save to database periodically
      if (transcript.segments.length % 10 === 0) {
        await this.saveTranscriptToDatabase(transcript);
      }

    } catch (error) {
      logger.error(`Failed to transcribe audio segment for call ${callId}:`, error);
    }
  }

  /**
   * End transcription for a call
   */
  async endTranscription(callId: string): Promise<CallTranscript | undefined> {
    const transcript = this.activeTranscriptions.get(callId);
    const audioBuffer = this.audioBuffers.get(callId);
    const transcriptionQueue = this.transcriptionQueue.get(callId);

    if (!transcript) {
      logger.warn(`No active transcription for call ${callId}`);
      return undefined;
    }

    try {
      logger.info(`Ending transcription for call ${callId}`);

      // Process any remaining segments in queue
      if (transcriptionQueue && transcriptionQueue.length > 0) {
        await this.processTranscriptionQueue(callId);
      }

      // Calculate final duration
      if (transcript.segments.length > 0) {
        const lastSegment = transcript.segments[transcript.segments.length - 1];
        transcript.duration = lastSegment.endTime;
      }

      // Save final transcript to database
      await this.saveTranscriptToDatabase(transcript);

      // Save audio recording if available
      if (audioBuffer && audioBuffer.length > 0) {
        await this.saveAudioRecording(callId, audioBuffer);
      }

      // Clean up
      this.activeTranscriptions.delete(callId);
      this.audioBuffers.delete(callId);
      this.transcriptionQueue.delete(callId);

      logger.info(`Transcription completed for call ${callId}: ${transcript.segments.length} segments, ${transcript.wordCount} words`);
      
      this.emit('transcriptionCompleted', {
        callId,
        transcript
      });

      return transcript;

    } catch (error) {
      logger.error(`Failed to end transcription for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time transcript for a call
   */
  getTranscript(callId: string): CallTranscript | undefined {
    return this.activeTranscriptions.get(callId);
  }

  /**
   * Get transcript from database
   */
  async getStoredTranscript(callId: string): Promise<CallTranscript | null> {
    try {
      // TODO: Implement database query for stored transcripts
      // This would query a call_transcripts table
      logger.debug(`Retrieving stored transcript for call ${callId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to retrieve stored transcript for call ${callId}:`, error);
      return null;
    }
  }

  /**
   * Search transcripts by text
   */
  async searchTranscripts(query: string, userId: string): Promise<CallTranscript[]> {
    try {
      // TODO: Implement full-text search on transcripts
      logger.debug(`Searching transcripts for: "${query}"`);
      return [];
    } catch (error) {
      logger.error(`Failed to search transcripts:`, error);
      return [];
    }
  }

  /**
   * Generate transcript summary
   */
  async generateTranscriptSummary(callId: string): Promise<string> {
    const transcript = this.activeTranscriptions.get(callId) || 
                     await this.getStoredTranscript(callId);

    if (!transcript || transcript.segments.length === 0) {
      return 'No transcript available';
    }

    try {
      // Combine all text segments
      const fullText = transcript.segments
        .map(segment => `${segment.speaker}: ${segment.text}`)
        .join('\n');

      // TODO: Use LLM to generate summary
      // For now, return basic statistics
      const callerSegments = transcript.segments.filter(s => s.speaker === 'caller');
      const agentSegments = transcript.segments.filter(s => s.speaker === 'agent');

      return `Call Summary:
Duration: ${Math.round(transcript.duration / 1000)}s
Total segments: ${transcript.segments.length}
Caller segments: ${callerSegments.length}
Agent segments: ${agentSegments.length}
Word count: ${transcript.wordCount}`;

    } catch (error) {
      logger.error(`Failed to generate transcript summary for call ${callId}:`, error);
      return 'Failed to generate summary';
    }
  }

  /**
   * Export transcript to various formats
   */
  async exportTranscript(callId: string, format: 'txt' | 'json' | 'srt'): Promise<string> {
    const transcript = this.activeTranscriptions.get(callId) || 
                     await this.getStoredTranscript(callId);

    if (!transcript) {
      throw new Error(`Transcript not found for call ${callId}`);
    }

    switch (format) {
      case 'txt':
        return this.exportAsText(transcript);
      case 'json':
        return JSON.stringify(transcript, null, 2);
      case 'srt':
        return this.exportAsSRT(transcript);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export transcript as plain text
   */
  private exportAsText(transcript: CallTranscript): string {
    const header = `Call Transcript - ${transcript.callId}\n` +
                  `Date: ${transcript.createdAt.toISOString()}\n` +
                  `Duration: ${Math.round(transcript.duration / 1000)}s\n` +
                  `Word Count: ${transcript.wordCount}\n\n`;

    const content = transcript.segments
      .map(segment => {
        const timestamp = this.formatTimestamp(segment.startTime);
        return `[${timestamp}] ${segment.speaker.toUpperCase()}: ${segment.text}`;
      })
      .join('\n');

    return header + content;
  }

  /**
   * Export transcript as SRT subtitle format
   */
  private exportAsSRT(transcript: CallTranscript): string {
    return transcript.segments
      .map((segment, index) => {
        const startTime = this.formatSRTTimestamp(segment.startTime);
        const endTime = this.formatSRTTimestamp(segment.endTime);
        
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.speaker.toUpperCase()}: ${segment.text}\n`;
      })
      .join('\n');
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format timestamp for SRT format
   */
  private formatSRTTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Estimate audio duration from buffer size
   */
  private estimateAudioDuration(audioData: Buffer): number {
    // Rough estimation: 8kHz, 16-bit, mono = 16000 bytes per second
    const bytesPerSecond = 16000;
    return (audioData.length / bytesPerSecond) * 1000; // Return in milliseconds
  }

  /**
   * Save transcript to database
   */
  private async saveTranscriptToDatabase(transcript: CallTranscript): Promise<void> {
    try {
      // TODO: Implement database storage for transcripts
      // This would involve creating a call_transcripts table
      logger.debug(`Saving transcript to database for call ${transcript.callId}`);
    } catch (error) {
      logger.error(`Failed to save transcript to database:`, error);
    }
  }

  /**
   * Save audio recording to storage
   */
  private async saveAudioRecording(callId: string, audioSegments: AudioSegment[]): Promise<void> {
    try {
      logger.info(`Saving audio recording for call ${callId}`);

      // Create recordings directory if it doesn't exist
      const recordingsDir = path.join(process.cwd(), 'recordings');
      await fs.mkdir(recordingsDir, { recursive: true });

      // Combine audio segments
      const combinedAudio = Buffer.concat(audioSegments.map(segment => segment.audioData));

      // Save to file
      const filename = `${callId}_${Date.now()}.wav`;
      const filepath = path.join(recordingsDir, filename);
      
      await fs.writeFile(filepath, combinedAudio);

      logger.info(`Audio recording saved: ${filepath}`);

      // TODO: Upload to cloud storage (S3, etc.)
      // TODO: Store recording metadata in database

    } catch (error) {
      logger.error(`Failed to save audio recording for call ${callId}:`, error);
    }
  }

  /**
   * Start transcription processing loop
   */
  private startTranscriptionProcessing(): void {
    this.processingInterval = setInterval(async () => {
      // Process transcription queues for all active calls
      const callIds = Array.from(this.transcriptionQueue.keys());
      
      for (const callId of callIds) {
        try {
          await this.processTranscriptionQueue(callId);
        } catch (error) {
          logger.error(`Failed to process transcription queue for call ${callId}:`, error);
        }
      }
    }, 2000); // Process every 2 seconds
  }

  /**
   * Get active transcriptions
   */
  getActiveTranscriptions(): CallTranscript[] {
    return Array.from(this.activeTranscriptions.values());
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up call transcription service...');

    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // End all active transcriptions
    const endPromises = Array.from(this.activeTranscriptions.keys()).map(callId =>
      this.endTranscription(callId).catch(error =>
        logger.error(`Failed to end transcription for call ${callId}:`, error)
      )
    );

    await Promise.allSettled(endPromises);

    logger.info('Call transcription service cleanup completed');
  }
}