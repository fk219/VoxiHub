export interface VoiceConfig {
  sttEndpoint?: string;
  ttsEndpoint?: string;
  vadThreshold?: number;
  vadDelay?: number;
  audioConstraints?: MediaStreamConstraints['audio'];
  pushToTalk?: boolean;
  continuousListening?: boolean;
}

export interface VoiceActivityEvent {
  type: 'start' | 'end';
  timestamp: Date;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface SynthesisResult {
  audioUrl: string;
  duration: number;
  text: string;
}

export class VoiceService {
  private config: VoiceConfig;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: number | null = null;
  private isRecording = false;
  private isListening = false;
  private audioChunks: Blob[] = [];
  private onVoiceActivity: ((event: VoiceActivityEvent) => void) | null = null;
  private onTranscription: ((result: TranscriptionResult) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  constructor(config: VoiceConfig = {}) {
    this.config = {
      vadThreshold: 0.01,
      vadDelay: 1000,
      pushToTalk: false,
      continuousListening: true,
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
      ...config,
    };
  }

  async initialize(): Promise<void> {
    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints,
      });

      // Set up audio context for voice activity detection
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Set up media recorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      // Start voice activity detection if continuous listening is enabled
      if (this.config.continuousListening && !this.config.pushToTalk) {
        this.startVoiceActivityDetection();
      }

    } catch (error) {
      this.handleError(new Error(`Failed to initialize voice service: ${error}`));
    }
  }

  startRecording(): void {
    if (!this.mediaRecorder || this.isRecording) return;

    this.audioChunks = [];
    this.isRecording = true;
    this.mediaRecorder.start();
    
    this.onVoiceActivity?.({
      type: 'start',
      timestamp: new Date(),
    });
  }

  stopRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) return;

    this.isRecording = false;
    this.mediaRecorder.stop();
    
    this.onVoiceActivity?.({
      type: 'end',
      timestamp: new Date(),
    });
  }

  startListening(): void {
    if (this.isListening) return;
    
    this.isListening = true;
    
    if (this.config.pushToTalk) {
      this.startRecording();
    } else if (this.config.continuousListening) {
      this.startVoiceActivityDetection();
    }
  }

  stopListening(): void {
    if (!this.isListening) return;
    
    this.isListening = false;
    this.stopVoiceActivityDetection();
    
    if (this.isRecording) {
      this.stopRecording();
    }
  }

  private startVoiceActivityDetection(): void {
    if (!this.analyser || this.vadTimer) return;

    const detectVoiceActivity = () => {
      if (!this.analyser || !this.isListening) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedVolume = average / 255;

      if (normalizedVolume > (this.config.vadThreshold || 0.01)) {
        if (!this.isRecording) {
          this.startRecording();
        }
      } else if (this.isRecording) {
        // Stop recording after delay if no voice activity
        setTimeout(() => {
          if (this.isRecording && normalizedVolume <= (this.config.vadThreshold || 0.01)) {
            this.stopRecording();
          }
        }, this.config.vadDelay || 1000);
      }

      this.vadTimer = requestAnimationFrame(detectVoiceActivity);
    };

    detectVoiceActivity();
  }

  private stopVoiceActivityDetection(): void {
    if (this.vadTimer) {
      cancelAnimationFrame(this.vadTimer);
      this.vadTimer = null;
    }
  }

  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.getSupportedMimeType() 
      });
      
      // Send to STT service
      const transcription = await this.transcribeAudio(audioBlob);
      
      if (transcription.text.trim()) {
        this.onTranscription?.(transcription);
      }
      
    } catch (error) {
      this.handleError(new Error(`Failed to process recording: ${error}`));
    }
    
    this.audioChunks = [];
  }

  private async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    if (!this.config.sttEndpoint) {
      // Fallback for demo purposes
      return {
        text: 'Voice input received (STT not configured)',
        confidence: 0.5,
        isFinal: true,
        timestamp: new Date(),
      };
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', 'en-US');

    const response = await fetch(this.config.sttEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`STT request failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      text: result.text || result.transcript || '',
      confidence: result.confidence || 0.8,
      isFinal: result.is_final !== false,
      timestamp: new Date(),
    };
  }

  async synthesizeSpeech(text: string): Promise<SynthesisResult> {
    if (!this.config.ttsEndpoint) {
      // Return a placeholder for demo purposes
      return {
        audioUrl: '',
        duration: 0,
        text,
      };
    }

    const response = await fetch(this.config.ttsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: 'default',
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      audioUrl: result.audio_url || result.url,
      duration: result.duration || 0,
      text,
    };
  }

  async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Failed to play audio'));
      
      audio.play().catch(reject);
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  private handleError(error: Error): void {
    console.error('Voice service error:', error);
    this.onError?.(error);
  }

  // Event handlers
  setOnVoiceActivity(handler: (event: VoiceActivityEvent) => void): void {
    this.onVoiceActivity = handler;
  }

  setOnTranscription(handler: (result: TranscriptionResult) => void): void {
    this.onTranscription = handler;
  }

  setOnError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  // Getters
  get isInitialized(): boolean {
    return this.mediaStream !== null && this.mediaRecorder !== null;
  }

  get isRecordingActive(): boolean {
    return this.isRecording;
  }

  get isListeningActive(): boolean {
    return this.isListening;
  }

  get hasPermission(): boolean {
    return this.mediaStream !== null;
  }

  // Cleanup
  destroy(): void {
    this.stopListening();
    this.stopVoiceActivityDetection();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mediaRecorder = null;
    this.analyser = null;
    this.audioChunks = [];
  }

  // Configuration updates
  updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Permission check
  static async checkPermissions(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted';
    } catch {
      // Fallback: try to access microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }
}