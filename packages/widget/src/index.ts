// AI Widget Entry Point
import { ChatService, Message } from './services/chat';
import { MessageRenderer } from './components/MessageRenderer';
import { VoiceService, VoiceConfig, TranscriptionResult } from './services/voice';
import { WidgetSDK } from './sdk/WidgetSDK';

// Re-export types for external use
export type { Message } from './services/chat';
export type { VoiceConfig, TranscriptionResult } from './services/voice';

// Export SDK and deployment utilities
export { WidgetSDK } from './sdk/WidgetSDK';
export { DeploymentHelper } from './deployment/DeploymentHelper';
export type { AnalyticsEvent, DeploymentConfig } from './sdk/WidgetSDK';
export type { DeploymentOptions, IntegrationGuide } from './deployment/DeploymentHelper';

export interface WidgetTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  shadowColor: string;
  headerBackground: string;
  headerText: string;
  userMessageBackground: string;
  userMessageText: string;
  botMessageBackground: string;
  botMessageText: string;
}

export interface WidgetBranding {
  logo?: string;
  companyName: string;
  showPoweredBy: boolean;
  customCSS?: string;
}

export interface WidgetConfig {
  agentId: string;
  apiUrl?: string;
  theme?: 'light' | 'dark' | 'custom';
  customTheme?: Partial<WidgetTheme>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'small' | 'medium' | 'large';
  autoOpen?: boolean;
  voiceEnabled?: boolean;
  greeting?: string;
  placeholder?: string;
  branding?: WidgetBranding;
  zIndex?: number;
  mobileBreakpoint?: number;
}

export class AIWidget {
  private config: WidgetConfig;
  private container: HTMLElement | null = null;
  private isOpen = false;
  private theme: WidgetTheme;
  private isMobile = false;
  private resizeObserver: ResizeObserver | null = null;
  private chatService: ChatService | null = null;
  private messageRenderer: MessageRenderer | null = null;
  private voiceService: VoiceService | null = null;
  private isProcessing = false;
  private isVoiceRecording = false;
  private voicePermissionGranted = false;

  constructor(config: WidgetConfig) {
    this.config = {
      apiUrl: 'http://localhost:3001',
      theme: 'light',
      position: 'bottom-right',
      size: 'medium',
      autoOpen: false,
      voiceEnabled: true,
      greeting: 'Hello! How can I help you today?',
      placeholder: 'Type your message...',
      zIndex: 10000,
      mobileBreakpoint: 768,
      branding: {
        companyName: 'AI Assistant',
        showPoweredBy: true,
      },
      ...config
    };

    this.theme = this.getTheme();
    this.checkMobile();
  }

  async init(): Promise<void> {
    this.createContainer();
    this.attachStyles();
    this.bindEvents();
    this.setupResponsive();
    await this.initializeServices();
    
    // Track widget initialization
    this.trackEvent('widget_loaded', {
      agentId: this.config.agentId,
      theme: this.config.theme,
      position: this.config.position,
      voiceEnabled: this.config.voiceEnabled,
    });
    
    if (this.config.autoOpen) {
      this.show();
    }
  }

  private async initializeServices(): Promise<void> {
    if (!this.config.apiUrl) {
      console.warn('AI Widget: No API URL provided, chat functionality will be limited');
    } else {
      this.chatService = new ChatService(this.config.apiUrl, this.config.agentId);
    }
    
    const messagesContainer = document.getElementById('ai-widget-messages');
    if (messagesContainer) {
      this.messageRenderer = new MessageRenderer(messagesContainer);
    }

    // Initialize voice service if enabled
    if (this.config.voiceEnabled) {
      await this.initializeVoiceService();
    }
  }

  private async initializeVoiceService(): Promise<void> {
    try {
      // Check for voice permission
      this.voicePermissionGranted = await VoiceService.checkPermissions();
      
      const voiceConfig: VoiceConfig = {
        sttEndpoint: this.config.apiUrl ? `${this.config.apiUrl}/api/stt` : undefined,
        ttsEndpoint: this.config.apiUrl ? `${this.config.apiUrl}/api/tts` : undefined,
        pushToTalk: false, // Default to continuous listening
        continuousListening: true,
        vadThreshold: 0.01,
        vadDelay: 1500,
      };

      this.voiceService = new VoiceService(voiceConfig);
      
      // Set up event handlers
      this.voiceService.setOnVoiceActivity((event) => {
        this.handleVoiceActivity(event);
      });

      this.voiceService.setOnTranscription((result) => {
        this.handleTranscription(result);
      });

      this.voiceService.setOnError((error) => {
        console.error('Voice service error:', error);
        this.showErrorMessage(`Voice error: ${error.message}`);
      });

      // Initialize if permission is already granted
      if (this.voicePermissionGranted) {
        await this.voiceService.initialize();
      }

    } catch (error) {
      console.error('Failed to initialize voice service:', error);
      this.config.voiceEnabled = false;
      this.updateVoiceButtonState();
    }
  }

  private getTheme(): WidgetTheme {
    const themes: Record<string, WidgetTheme> = {
      light: {
        primaryColor: '#3b82f6',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        borderColor: '#e5e7eb',
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        headerBackground: '#3b82f6',
        headerText: '#ffffff',
        userMessageBackground: '#3b82f6',
        userMessageText: '#ffffff',
        botMessageBackground: '#f3f4f6',
        botMessageText: '#374151',
      },
      dark: {
        primaryColor: '#3b82f6',
        backgroundColor: '#1f2937',
        textColor: '#f9fafb',
        borderColor: '#374151',
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        headerBackground: '#3b82f6',
        headerText: '#ffffff',
        userMessageBackground: '#3b82f6',
        userMessageText: '#ffffff',
        botMessageBackground: '#374151',
        botMessageText: '#f9fafb',
      }
    };

    const baseTheme = themes[this.config.theme || 'light'] || themes.light;
    return { ...baseTheme, ...this.config.customTheme };
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= (this.config.mobileBreakpoint || 768);
  }

  private setupResponsive(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const wasMobile = this.isMobile;
      this.checkMobile();
      
      if (wasMobile !== this.isMobile) {
        this.updateLayout();
      }
    });

    this.resizeObserver.observe(document.body);

    window.addEventListener('resize', () => {
      this.checkMobile();
      this.updateLayout();
    });
  }

  private updateLayout(): void {
    if (!this.container) return;

    const chat = this.container.querySelector('.ai-widget-chat') as HTMLElement;
    if (chat) {
      if (this.isMobile) {
        chat.style.position = 'fixed';
        chat.style.top = '0';
        chat.style.left = '0';
        chat.style.right = '0';
        chat.style.bottom = '0';
        chat.style.width = '100%';
        chat.style.height = '100%';
        chat.style.borderRadius = '0';
      } else {
        this.resetChatPosition(chat);
      }
    }
  }

  private resetChatPosition(chat: HTMLElement): void {
    const sizes = {
      small: { width: '300px', height: '400px' },
      medium: { width: '350px', height: '500px' },
      large: { width: '400px', height: '600px' }
    };

    const size = sizes[this.config.size || 'medium'];
    
    chat.style.position = 'absolute';
    chat.style.width = size.width;
    chat.style.height = size.height;
    chat.style.borderRadius = '12px';
    
    // Reset position based on config
    const position = this.config.position || 'bottom-right';
    if (position.includes('bottom')) {
      chat.style.bottom = '70px';
      chat.style.top = 'auto';
    } else {
      chat.style.top = '70px';
      chat.style.bottom = 'auto';
    }
    
    if (position.includes('right')) {
      chat.style.right = '0';
      chat.style.left = 'auto';
    } else {
      chat.style.left = '0';
      chat.style.right = 'auto';
    }
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'ai-widget-container';
    this.container.className = `ai-widget ai-widget-${this.config.position} ai-widget-${this.config.size}`;
    
    const logoHtml = this.config.branding?.logo 
      ? `<img src="${this.config.branding.logo}" alt="Logo" class="ai-widget-logo" />`
      : '';

    const poweredByHtml = this.config.branding?.showPoweredBy 
      ? '<div class="ai-widget-powered-by">Powered by AI Agent Platform</div>'
      : '';

    this.container.innerHTML = `
      <div class="ai-widget-button" id="ai-widget-button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
        </svg>
      </div>
      <div class="ai-widget-chat" id="ai-widget-chat" style="display: none;">
        <div class="ai-widget-header">
          ${logoHtml}
          <div class="ai-widget-header-content">
            <h3>${this.config.branding?.companyName || 'AI Assistant'}</h3>
            <div class="ai-widget-status">Online</div>
          </div>
          <button class="ai-widget-close" id="ai-widget-close">×</button>
        </div>
        <div class="ai-widget-messages" id="ai-widget-messages">
          <div class="ai-widget-message ai-widget-message-bot">
            ${this.config.greeting || 'Hello! How can I help you today?'}
          </div>
        </div>
        <div class="ai-widget-input-container">
          <div class="ai-widget-input">
            <input type="text" placeholder="${this.config.placeholder || 'Type your message...'}" id="ai-widget-input">
            ${this.config.voiceEnabled ? '<button class="ai-widget-voice-btn" id="ai-widget-voice" title="Voice input">🎤</button>' : ''}
            <button id="ai-widget-send" title="Send message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          ${poweredByHtml}
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
  }

  private attachStyles(): void {
    const style = document.createElement('style');
    style.id = 'ai-widget-styles';
    style.textContent = this.generateCSS();
    document.head.appendChild(style);

    // Add custom CSS if provided
    if (this.config.branding?.customCSS) {
      const customStyle = document.createElement('style');
      customStyle.id = 'ai-widget-custom-styles';
      customStyle.textContent = this.config.branding.customCSS;
      document.head.appendChild(customStyle);
    }
  }

  private generateCSS(): string {
    const buttonSizes = {
      small: '50px',
      medium: '60px',
      large: '70px'
    };

    const buttonSize = buttonSizes[this.config.size || 'medium'];

    return `
      .ai-widget {
        position: fixed;
        z-index: ${this.config.zIndex || 10000};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: ${this.theme.textColor};
      }
      
      .ai-widget * {
        box-sizing: border-box;
      }
      
      .ai-widget-bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .ai-widget-bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .ai-widget-top-right {
        top: 20px;
        right: 20px;
      }
      
      .ai-widget-top-left {
        top: 20px;
        left: 20px;
      }
      
      .ai-widget-button {
        width: ${buttonSize};
        height: ${buttonSize};
        border-radius: 50%;
        background: linear-gradient(135deg, ${this.theme.primaryColor}, ${this.theme.primaryColor}dd);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 20px ${this.theme.shadowColor};
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: none;
        outline: none;
      }
      
      .ai-widget-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 25px ${this.theme.shadowColor};
      }
      
      .ai-widget-button:active {
        transform: scale(0.95);
      }
      
      .ai-widget-chat {
        position: absolute;
        background: ${this.theme.backgroundColor};
        border-radius: 12px;
        box-shadow: 0 10px 40px ${this.theme.shadowColor};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid ${this.theme.borderColor};
        animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .ai-widget-header {
        background: ${this.theme.headerBackground};
        color: ${this.theme.headerText};
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid ${this.theme.borderColor};
      }
      
      .ai-widget-logo {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }
      
      .ai-widget-header-content {
        flex: 1;
      }
      
      .ai-widget-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .ai-widget-status {
        font-size: 12px;
        opacity: 0.8;
        margin-top: 2px;
      }
      
      .ai-widget-close {
        background: none;
        border: none;
        color: ${this.theme.headerText};
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .ai-widget-close:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      
      .ai-widget-messages {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        scroll-behavior: smooth;
      }
      
      .ai-widget-messages::-webkit-scrollbar {
        width: 4px;
      }
      
      .ai-widget-messages::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .ai-widget-messages::-webkit-scrollbar-thumb {
        background: ${this.theme.borderColor};
        border-radius: 2px;
      }
      
      .ai-widget-message {
        margin-bottom: 12px;
        padding: 10px 14px;
        border-radius: 18px;
        max-width: 85%;
        word-wrap: break-word;
        animation: messageSlide 0.3s ease-out;
      }
      
      @keyframes messageSlide {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .ai-widget-message-bot {
        background: ${this.theme.botMessageBackground};
        color: ${this.theme.botMessageText};
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      
      .ai-widget-message-user {
        background: ${this.theme.userMessageBackground};
        color: ${this.theme.userMessageText};
        align-self: flex-end;
        margin-left: auto;
        border-bottom-right-radius: 4px;
      }
      
      .ai-widget-input-container {
        border-top: 1px solid ${this.theme.borderColor};
        background: ${this.theme.backgroundColor};
      }
      
      .ai-widget-input {
        padding: 16px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .ai-widget-input input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid ${this.theme.borderColor};
        border-radius: 20px;
        outline: none;
        background: ${this.theme.backgroundColor};
        color: ${this.theme.textColor};
        font-size: 14px;
        transition: border-color 0.2s;
      }
      
      .ai-widget-input input:focus {
        border-color: ${this.theme.primaryColor};
      }
      
      .ai-widget-input input::placeholder {
        color: ${this.theme.textColor}80;
      }
      
      .ai-widget-voice-btn {
        padding: 8px;
        background: none;
        border: 1px solid ${this.theme.borderColor};
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .ai-widget-voice-btn:hover {
        background: ${this.theme.primaryColor}10;
        border-color: ${this.theme.primaryColor};
      }
      
      .ai-widget-voice-btn.recording {
        background: #ef4444;
        border-color: #ef4444;
        color: white;
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      .ai-widget-input button#ai-widget-send {
        padding: 8px;
        background: ${this.theme.primaryColor};
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .ai-widget-input button#ai-widget-send:hover {
        background: ${this.theme.primaryColor}dd;
        transform: scale(1.05);
      }
      
      .ai-widget-input button#ai-widget-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      .ai-widget-powered-by {
        text-align: center;
        font-size: 11px;
        color: ${this.theme.textColor}60;
        padding: 8px 16px 12px;
      }
      
      .ai-widget-typing {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: ${this.theme.botMessageBackground};
        color: ${this.theme.botMessageText};
        border-radius: 18px;
        border-bottom-left-radius: 4px;
        max-width: 85%;
        margin-bottom: 12px;
      }
      
      .ai-widget-typing-dots {
        display: flex;
        gap: 4px;
      }
      
      .ai-widget-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.4;
        animation: typingDot 1.4s infinite;
      }
      
      .ai-widget-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .ai-widget-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      .ai-widget-typing-text {
        font-size: 12px;
        opacity: 0.8;
      }
      
      @keyframes typingDot {
        0%, 60%, 100% { opacity: 0.4; }
        30% { opacity: 1; }
      }
      
      .ai-widget-message-error {
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 90%;
      }
      
      .ai-widget-error-icon {
        font-size: 16px;
      }
      
      .ai-widget-error-text {
        font-size: 13px;
      }
      
      .ai-widget-message-highlighted {
        animation: messageHighlight 2s ease-out;
      }
      
      @keyframes messageHighlight {
        0% { background-color: ${this.theme.primaryColor}20; }
        100% { background-color: transparent; }
      }
      
      .ai-widget-message-timestamp {
        font-size: 10px;
        opacity: 0.6;
        margin-top: 4px;
        text-align: right;
      }
      
      .ai-widget-message-user .ai-widget-message-timestamp {
        text-align: left;
      }
      
      .ai-widget-message-status {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 2px;
        text-align: right;
      }
      
      .ai-widget-message-content {
        word-wrap: break-word;
        line-height: 1.4;
      }
      
      .ai-widget-message-content strong {
        font-weight: 600;
      }
      
      .ai-widget-message-content em {
        font-style: italic;
      }
      
      .ai-widget-message-content code {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
      }
      
      .ai-widget-message-content a {
        color: ${this.theme.primaryColor};
        text-decoration: underline;
      }
      
      .ai-widget-audio-message {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .ai-widget-audio-transcript {
        font-size: 12px;
        opacity: 0.8;
        font-style: italic;
      }
      
      .ai-widget-message-success {
        background: #d1fae5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 90%;
      }
      
      .ai-widget-success-icon {
        font-size: 16px;
      }
      
      .ai-widget-success-text {
        font-size: 13px;
      }
      
      .ai-widget-voice-indicator {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 16px;
        height: 16px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 1s infinite;
        display: none;
      }
      
      .ai-widget-voice-btn.recording .ai-widget-voice-indicator {
        display: block;
      }
      
      .ai-widget-voice-waveform {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-left: 8px;
      }
      
      .ai-widget-voice-bar {
        width: 2px;
        background: currentColor;
        border-radius: 1px;
        animation: voiceWave 1s infinite ease-in-out;
      }
      
      .ai-widget-voice-bar:nth-child(1) { height: 8px; animation-delay: 0s; }
      .ai-widget-voice-bar:nth-child(2) { height: 12px; animation-delay: 0.1s; }
      .ai-widget-voice-bar:nth-child(3) { height: 16px; animation-delay: 0.2s; }
      .ai-widget-voice-bar:nth-child(4) { height: 12px; animation-delay: 0.3s; }
      .ai-widget-voice-bar:nth-child(5) { height: 8px; animation-delay: 0.4s; }
      
      @keyframes voiceWave {
        0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
        50% { transform: scaleY(1); opacity: 1; }
      }
      
      .ai-widget-voice-permission {
        text-align: center;
        padding: 20px;
        color: ${this.theme.textColor}80;
      }
      
      .ai-widget-voice-permission button {
        background: ${this.theme.primaryColor};
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 10px;
        font-size: 14px;
      }
      
      .ai-widget-voice-permission button:hover {
        background: ${this.theme.primaryColor}dd;
      }
      
      /* Voice activity visualization */
      .ai-widget-recording .ai-widget-voice-btn {
        position: relative;
        overflow: visible;
      }
      
      .ai-widget-recording .ai-widget-voice-btn::after {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px solid #ef4444;
        border-radius: 50%;
        animation: recordingPulse 1.5s infinite;
      }
      
      @keyframes recordingPulse {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        100% {
          transform: scale(1.3);
          opacity: 0;
        }
      }
      
      /* Dark theme adjustments for voice elements */
      ${this.config.theme === 'dark' ? `
        .ai-widget-message-success {
          background: #064e3b;
          color: #a7f3d0;
          border-color: #065f46;
        }
        
        .ai-widget-voice-permission {
          color: ${this.theme.textColor}60;
        }
      ` : ''}
      
      /* Mobile Responsive */
      @media (max-width: ${this.config.mobileBreakpoint || 768}px) {
        .ai-widget-chat {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 0 !important;
          max-width: none !important;
          max-height: none !important;
        }
        
        .ai-widget-button {
          width: 56px;
          height: 56px;
        }
        
        .ai-widget-messages {
          padding: 12px;
        }
        
        .ai-widget-input {
          padding: 12px;
        }
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .ai-widget-chat {
          border: 2px solid ${this.theme.textColor};
        }
        
        .ai-widget-message {
          border: 1px solid currentColor;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .ai-widget-button,
        .ai-widget-message,
        .ai-widget-chat {
          animation: none;
          transition: none;
        }
      }
    `;
  }

  private bindEvents(): void {
    const button = document.getElementById('ai-widget-button');
    const close = document.getElementById('ai-widget-close');
    const input = document.getElementById('ai-widget-input') as HTMLInputElement;
    const send = document.getElementById('ai-widget-send');
    const voice = document.getElementById('ai-widget-voice');

    button?.addEventListener('click', () => this.toggle());
    close?.addEventListener('click', () => this.hide());
    send?.addEventListener('click', () => this.sendMessage());
    voice?.addEventListener('click', () => this.toggleVoiceRecording());
    
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize input for multiline support
    input?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      target.style.height = 'auto';
      target.style.height = Math.min(target.scrollHeight, 100) + 'px';
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ESC to close widget
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
      
      // Ctrl/Cmd + K to clear conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && this.isOpen) {
        e.preventDefault();
        this.clearConversation();
      }

      // Space bar for push-to-talk (when widget is focused)
      if (e.code === 'Space' && this.isOpen && this.config.voiceEnabled) {
        const activeElement = document.activeElement;
        const input = document.getElementById('ai-widget-input');
        
        // Only activate push-to-talk if not typing in input
        if (activeElement !== input) {
          e.preventDefault();
          if (!this.isVoiceRecording) {
            this.toggleVoiceRecording();
          }
        }
      }
    });

    // Release space bar to stop recording
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.isVoiceRecording && this.isOpen) {
        const activeElement = document.activeElement;
        const input = document.getElementById('ai-widget-input');
        
        if (activeElement !== input) {
          e.preventDefault();
          this.toggleVoiceRecording();
        }
      }
    });
  }

  show(): void {
    const chat = document.getElementById('ai-widget-chat');
    if (chat) {
      chat.style.display = 'flex';
      this.isOpen = true;
      this.updateLayout();
      
      // Track widget opened
      this.trackEvent('widget_opened', { agentId: this.config.agentId });
      
      // Focus input when opened
      setTimeout(() => {
        const input = document.getElementById('ai-widget-input') as HTMLInputElement;
        input?.focus();
      }, 100);
    }
  }

  hide(): void {
    const chat = document.getElementById('ai-widget-chat');
    if (chat) {
      chat.style.display = 'none';
      this.isOpen = false;
      
      // Track widget closed
      this.trackEvent('widget_closed', { agentId: this.config.agentId });
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.container) {
      this.container.remove();
    }
    
    // Clean up services
    this.chatService = null;
    this.messageRenderer = null;
    
    if (this.voiceService) {
      this.voiceService.destroy();
      this.voiceService = null;
    }
    
    // Remove styles
    const styles = document.getElementById('ai-widget-styles');
    const customStyles = document.getElementById('ai-widget-custom-styles');
    styles?.remove();
    customStyles?.remove();
  }

  updateConfig(newConfig: Partial<WidgetConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.theme = this.getTheme();
    
    // Re-render if container exists
    if (this.container) {
      this.container.remove();
      const styles = document.getElementById('ai-widget-styles');
      styles?.remove();
      
      this.createContainer();
      this.attachStyles();
      this.bindEvents();
      this.updateLayout();
    }
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('ai-widget-input') as HTMLInputElement;
    const sendButton = document.getElementById('ai-widget-send') as HTMLButtonElement;
    
    if (!input || !input.value.trim() || this.isProcessing) return;

    const messageContent = input.value.trim();
    
    // Validate message
    if (this.chatService) {
      const validation = this.chatService.validateMessage(messageContent);
      if (!validation.isValid) {
        this.showErrorMessage(validation.error || 'Invalid message');
        return;
      }
    }

    // Clear input and disable send button
    input.value = '';
    sendButton.disabled = true;
    this.isProcessing = true;

    try {
      // Add user message to UI
      const userMessage: Message = {
        id: this.generateMessageId(),
        content: messageContent,
        role: 'user',
        timestamp: new Date(),
        type: 'text',
      };

      this.addMessageToUI(userMessage);
      
      // Track message sent
      this.trackEvent('message_sent', {
        messageLength: messageContent.length,
        messageType: 'text',
      });

      // Show typing indicator
      this.showTypingIndicator();

      // Send message through chat service
      if (this.chatService) {
        const response = await this.chatService.sendMessage(messageContent);
        this.hideTypingIndicator();
        this.addMessageToUI(response);
        
        // Track message received
        this.trackEvent('message_received', {
          responseLength: response.content.length,
          processingTime: response.metadata?.processingTime,
        });
      } else {
        // Fallback for when no API is available
        setTimeout(() => {
          this.hideTypingIndicator();
          const fallbackResponse: Message = {
            id: this.generateMessageId(),
            content: 'Thank you for your message. This is a demo response since no API is configured.',
            role: 'assistant',
            timestamp: new Date(),
            type: 'text',
          };
          this.addMessageToUI(fallbackResponse);
        }, 1500);
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.showErrorMessage('Failed to send message. Please try again.');
      console.error('Error sending message:', error);
    } finally {
      sendButton.disabled = false;
      this.isProcessing = false;
      input.focus();
    }
  }

  private addMessageToUI(message: Message): void {
    if (!this.messageRenderer) {
      // Fallback to simple message rendering
      this.addSimpleMessage(message.content, message.role);
      return;
    }

    const messagesContainer = document.getElementById('ai-widget-messages');
    if (!messagesContainer) return;

    const messageElement = this.messageRenderer.renderMessage(message);
    messagesContainer.appendChild(messageElement);
    this.messageRenderer.scrollToBottom();
  }

  private addSimpleMessage(content: string, role: 'user' | 'assistant'): void {
    const messages = document.getElementById('ai-widget-messages');
    if (!messages) return;

    const messageElement = document.createElement('div');
    messageElement.className = `ai-widget-message ai-widget-message-${role}`;
    messageElement.textContent = content;
    
    messages.appendChild(messageElement);
    this.scrollToBottom();
  }

  private showTypingIndicator(): void {
    const messages = document.getElementById('ai-widget-messages');
    if (!messages) return;

    // Remove existing typing indicator
    this.hideTypingIndicator();

    let typingElement: HTMLElement;
    
    if (this.messageRenderer) {
      typingElement = this.messageRenderer.renderTypingIndicator();
    } else {
      // Fallback typing indicator
      typingElement = document.createElement('div');
      typingElement.className = 'ai-widget-typing';
      typingElement.id = 'ai-widget-typing';
      typingElement.innerHTML = `
        <div class="ai-widget-typing-dots">
          <div class="ai-widget-typing-dot"></div>
          <div class="ai-widget-typing-dot"></div>
          <div class="ai-widget-typing-dot"></div>
        </div>
      `;
    }
    
    messages.appendChild(typingElement);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const typingElement = document.getElementById('ai-widget-typing');
    typingElement?.remove();
  }

  private showErrorMessage(error: string): void {
    const messages = document.getElementById('ai-widget-messages');
    if (!messages) return;

    let errorElement: HTMLElement;
    
    if (this.messageRenderer) {
      errorElement = this.messageRenderer.renderErrorMessage(error);
    } else {
      errorElement = document.createElement('div');
      errorElement.className = 'ai-widget-message ai-widget-message-error';
      errorElement.textContent = `Error: ${error}`;
    }
    
    messages.appendChild(errorElement);
    this.scrollToBottom();

    // Auto-remove error message after 5 seconds
    setTimeout(() => {
      errorElement.remove();
    }, 5000);
  }

  private scrollToBottom(): void {
    const messages = document.getElementById('ai-widget-messages');
    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external control
  public sendMessageProgrammatically(content: string): Promise<void> {
    const input = document.getElementById('ai-widget-input') as HTMLInputElement;
    if (input) {
      input.value = content;
      return this.sendMessage();
    }
    return Promise.resolve();
  }

  public clearConversation(): void {
    if (this.chatService) {
      this.chatService.clearHistory();
    }
    
    if (this.messageRenderer) {
      this.messageRenderer.clearMessages();
    } else {
      const messages = document.getElementById('ai-widget-messages');
      if (messages) {
        messages.innerHTML = `
          <div class="ai-widget-message ai-widget-message-assistant">
            ${this.config.greeting || 'Hello! How can I help you today?'}
          </div>
        `;
      }
    }
  }

  public getConversationHistory(): Message[] {
    return this.chatService?.getMessages() || [];
  }

  private handleVoiceActivity(event: any): void {
    const voiceButton = document.getElementById('ai-widget-voice') as HTMLButtonElement;
    if (!voiceButton) return;

    if (event.type === 'start') {
      this.isVoiceRecording = true;
      voiceButton.classList.add('recording');
      voiceButton.innerHTML = '🔴';
      voiceButton.title = 'Recording... (Click to stop)';
    } else {
      this.isVoiceRecording = false;
      voiceButton.classList.remove('recording');
      voiceButton.innerHTML = '🎤';
      voiceButton.title = 'Voice input';
    }
  }

  private async handleTranscription(result: TranscriptionResult): Promise<void> {
    if (!result.text.trim()) return;

    // Add transcribed text to input field
    const input = document.getElementById('ai-widget-input') as HTMLInputElement;
    if (input) {
      input.value = result.text;
      
      // Auto-send if confidence is high enough
      if (result.confidence > 0.7) {
        await this.sendMessage();
      }
    }
  }

  private async toggleVoiceRecording(): Promise<void> {
    if (!this.voiceService) {
      await this.requestVoicePermission();
      return;
    }

    if (!this.voiceService.isInitialized) {
      await this.requestVoicePermission();
      return;
    }

    if (this.isVoiceRecording) {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening();
      // Track voice usage
      this.trackEvent('voice_used', { action: 'start_recording' });
    }
  }

  private async requestVoicePermission(): Promise<void> {
    try {
      if (!this.voiceService) return;

      await this.voiceService.initialize();
      this.voicePermissionGranted = true;
      this.updateVoiceButtonState();
      
      // Show success message
      this.showSuccessMessage('Voice input enabled! You can now speak to the assistant.');
      
    } catch (error) {
      console.error('Voice permission denied:', error);
      this.showErrorMessage('Voice permission denied. Please enable microphone access to use voice input.');
      this.voicePermissionGranted = false;
      this.updateVoiceButtonState();
    }
  }

  private updateVoiceButtonState(): void {
    const voiceButton = document.getElementById('ai-widget-voice') as HTMLButtonElement;
    if (!voiceButton) return;

    if (!this.config.voiceEnabled) {
      voiceButton.style.display = 'none';
      return;
    }

    voiceButton.style.display = 'flex';
    
    if (!this.voicePermissionGranted) {
      voiceButton.innerHTML = '🎤';
      voiceButton.title = 'Click to enable voice input';
      voiceButton.classList.remove('recording');
    } else if (this.isVoiceRecording) {
      voiceButton.innerHTML = '🔴';
      voiceButton.title = 'Recording... (Click to stop)';
      voiceButton.classList.add('recording');
    } else {
      voiceButton.innerHTML = '🎤';
      voiceButton.title = 'Click to start voice input';
      voiceButton.classList.remove('recording');
    }
  }

  private showSuccessMessage(message: string): void {
    const messages = document.getElementById('ai-widget-messages');
    if (!messages) return;

    const successElement = document.createElement('div');
    successElement.className = 'ai-widget-message ai-widget-message-success';
    successElement.innerHTML = `
      <span class="ai-widget-success-icon">✅</span>
      <span class="ai-widget-success-text">${message}</span>
    `;
    
    messages.appendChild(successElement);
    this.scrollToBottom();

    // Auto-remove success message after 3 seconds
    setTimeout(() => {
      successElement.remove();
    }, 3000);
  }

  // Voice-related public methods
  public async enableVoice(): Promise<void> {
    this.config.voiceEnabled = true;
    await this.initializeVoiceService();
    this.updateVoiceButtonState();
  }

  public disableVoice(): void {
    this.config.voiceEnabled = false;
    if (this.voiceService) {
      this.voiceService.destroy();
      this.voiceService = null;
    }
    this.updateVoiceButtonState();
  }

  public async speakResponse(text: string): Promise<void> {
    if (!this.voiceService || !this.voiceService.isInitialized) return;

    try {
      const synthesis = await this.voiceService.synthesizeSpeech(text);
      if (synthesis.audioUrl) {
        await this.voiceService.playAudio(synthesis.audioUrl);
      }
    } catch (error) {
      console.error('Failed to speak response:', error);
    }
  }

  private trackEvent(type: string, data?: any): void {
    try {
      if (window.AIWidgetSDK) {
        // Use SDK's analytics tracking
        (window.AIWidgetSDK as any).trackEvent(type, {
          ...data,
          agentId: this.config.agentId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
}

// Global initialization
declare global {
  interface Window {
    AIWidget: typeof AIWidget;
    AIWidgetSDK: WidgetSDK;
  }
}

window.AIWidget = AIWidget;

// Initialize SDK
const sdk = WidgetSDK.getInstance({
  debug: new URLSearchParams(window.location.search).has('debug'),
  version: '1.0.0',
});

window.AIWidgetSDK = sdk;

// Set up cross-origin messaging
sdk.setupCrossOriginMessaging();

// Auto-initialize if data attributes are present
document.addEventListener('DOMContentLoaded', async () => {
  const scripts = document.querySelectorAll('script[data-agent-id]');
  
  for (const script of scripts) {
    const agentId = script.getAttribute('data-agent-id');
    if (agentId) {
      const config: WidgetConfig = {
        agentId,
        apiUrl: script.getAttribute('data-api-url') || undefined,
        theme: script.getAttribute('data-theme') as any || 'light',
        position: script.getAttribute('data-position') as any || 'bottom-right',
        size: script.getAttribute('data-size') as any || 'medium',
        autoOpen: script.getAttribute('data-auto-open') === 'true',
        voiceEnabled: script.getAttribute('data-voice-enabled') !== 'false',
        greeting: script.getAttribute('data-greeting') || undefined,
        placeholder: script.getAttribute('data-placeholder') || undefined,
        zIndex: script.getAttribute('data-z-index') ? parseInt(script.getAttribute('data-z-index')!) : undefined,
        branding: {
          companyName: script.getAttribute('data-company-name') || 'AI Assistant',
          logo: script.getAttribute('data-logo') || undefined,
          showPoweredBy: script.getAttribute('data-show-powered-by') !== 'false',
        },
        customTheme: script.getAttribute('data-primary-color') ? {
          primaryColor: script.getAttribute('data-primary-color')!,
          headerBackground: script.getAttribute('data-primary-color')!,
          userMessageBackground: script.getAttribute('data-primary-color')!,
        } : undefined,
      };
      
      const widget = new AIWidget(config);
      await widget.init();
    }
  }
});

export default AIWidget;