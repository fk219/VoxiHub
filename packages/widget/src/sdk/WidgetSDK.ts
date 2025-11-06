import { AIWidget, WidgetConfig } from '../index';

export interface SDKConfig {
  apiUrl?: string;
  debug?: boolean;
  version?: string;
}

export interface AnalyticsEvent {
  type: 'widget_loaded' | 'widget_opened' | 'widget_closed' | 'message_sent' | 'message_received' | 'voice_used' | 'error_occurred';
  timestamp: Date;
  data?: any;
  sessionId: string;
  agentId: string;
  userId?: string;
}

export interface DeploymentConfig {
  agentId: string;
  widgetConfig: WidgetConfig;
  embedCode: string;
  scriptUrl: string;
  previewUrl: string;
  analytics: {
    enabled: boolean;
    trackingId?: string;
  };
}

export class WidgetSDK {
  private static instance: WidgetSDK | null = null;
  private config: SDKConfig;
  private widgets: Map<string, AIWidget> = new Map();
  private analytics: AnalyticsEvent[] = [];
  private sessionId: string;
  private debug: boolean;

  private constructor(config: SDKConfig = {}) {
    this.config = {
      debug: false,
      version: '1.0.0',
      ...config,
    };
    
    this.debug = this.config.debug || false;
    this.sessionId = this.generateSessionId();
    
    this.log('WidgetSDK initialized', this.config);
  }

  static getInstance(config?: SDKConfig): WidgetSDK {
    if (!WidgetSDK.instance) {
      WidgetSDK.instance = new WidgetSDK(config);
    }
    return WidgetSDK.instance;
  }

  // Widget Management
  async createWidget(widgetId: string, config: WidgetConfig): Promise<AIWidget> {
    if (this.widgets.has(widgetId)) {
      throw new Error(`Widget with ID '${widgetId}' already exists`);
    }

    const widget = new AIWidget(config);
    await widget.init();
    
    this.widgets.set(widgetId, widget);
    this.trackEvent('widget_loaded', { widgetId, config });
    
    this.log(`Widget '${widgetId}' created`, config);
    return widget;
  }

  getWidget(widgetId: string): AIWidget | undefined {
    return this.widgets.get(widgetId);
  }

  destroyWidget(widgetId: string): boolean {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      widget.destroy();
      this.widgets.delete(widgetId);
      this.log(`Widget '${widgetId}' destroyed`);
      return true;
    }
    return false;
  }

  getAllWidgets(): Map<string, AIWidget> {
    return new Map(this.widgets);
  }

  // Deployment Generation
  generateDeploymentConfig(agentId: string, widgetConfig: WidgetConfig): DeploymentConfig {
    const baseUrl = this.config.apiUrl || 'https://cdn.aiagent.com';
    const scriptUrl = `${baseUrl}/widget.js`;
    
    const embedCode = this.generateEmbedCode(agentId, widgetConfig, scriptUrl);
    const previewUrl = this.generatePreviewUrl(agentId, widgetConfig);

    return {
      agentId,
      widgetConfig,
      embedCode,
      scriptUrl,
      previewUrl,
      analytics: {
        enabled: true,
        trackingId: `widget_${agentId}`,
      },
    };
  }

  private generateEmbedCode(agentId: string, config: WidgetConfig, scriptUrl: string): string {
    const attributes = [
      `data-agent-id="${agentId}"`,
      config.apiUrl ? `data-api-url="${config.apiUrl}"` : '',
      config.theme ? `data-theme="${config.theme}"` : '',
      config.position ? `data-position="${config.position}"` : '',
      config.size ? `data-size="${config.size}"` : '',
      config.autoOpen ? `data-auto-open="${config.autoOpen}"` : '',
      config.voiceEnabled !== undefined ? `data-voice-enabled="${config.voiceEnabled}"` : '',
      config.greeting ? `data-greeting="${config.greeting}"` : '',
      config.placeholder ? `data-placeholder="${config.placeholder}"` : '',
      config.zIndex ? `data-z-index="${config.zIndex}"` : '',
      config.branding?.companyName ? `data-company-name="${config.branding.companyName}"` : '',
      config.branding?.logo ? `data-logo="${config.branding.logo}"` : '',
      config.branding?.showPoweredBy !== undefined ? `data-show-powered-by="${config.branding.showPoweredBy}"` : '',
      config.customTheme?.primaryColor ? `data-primary-color="${config.customTheme.primaryColor}"` : '',
    ].filter(attr => attr.length > 0);

    return `<!-- AI Widget Embed Code -->
<script src="${scriptUrl}" ${attributes.join(' ')}></script>
<!-- End AI Widget -->`;
  }

  private generatePreviewUrl(agentId: string, config: WidgetConfig): string {
    const baseUrl = this.config.apiUrl || 'https://preview.aiagent.com';
    const params = new URLSearchParams({
      agent: agentId,
      theme: config.theme || 'light',
      position: config.position || 'bottom-right',
      size: config.size || 'medium',
      voice: config.voiceEnabled ? 'true' : 'false',
    });

    return `${baseUrl}/preview?${params.toString()}`;
  }

  // Cross-Origin Communication
  setupCrossOriginMessaging(): void {
    window.addEventListener('message', (event) => {
      // Validate origin for security
      if (!this.isValidOrigin(event.origin)) {
        this.log('Rejected message from invalid origin:', event.origin);
        return;
      }

      const { type, data, widgetId } = event.data;
      
      switch (type) {
        case 'widget_command':
          this.handleWidgetCommand(widgetId, data);
          break;
        case 'widget_query':
          this.handleWidgetQuery(widgetId, data, event);
          break;
        case 'analytics_event':
          this.handleAnalyticsEvent(data);
          break;
        default:
          this.log('Unknown message type:', type);
      }
    });
  }

  private isValidOrigin(origin: string): boolean {
    // In production, this should check against a whitelist of allowed origins
    const allowedOrigins = [
      'https://aiagent.com',
      'https://app.aiagent.com',
      'https://cdn.aiagent.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ];

    return allowedOrigins.includes(origin) || origin === window.location.origin;
  }

  private handleWidgetCommand(widgetId: string, command: any): void {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    switch (command.action) {
      case 'show':
        widget.show();
        break;
      case 'hide':
        widget.hide();
        break;
      case 'toggle':
        widget.toggle();
        break;
      case 'send_message':
        widget.sendMessageProgrammatically(command.message);
        break;
      case 'clear_conversation':
        widget.clearConversation();
        break;
      case 'update_config':
        widget.updateConfig(command.config);
        break;
    }
  }

  private handleWidgetQuery(widgetId: string, query: any, event: MessageEvent): void {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    let response: any = null;

    switch (query.type) {
      case 'get_conversation_history':
        response = widget.getConversationHistory();
        break;
      case 'get_widget_state':
        response = {
          isOpen: (widget as any).isOpen,
          isProcessing: (widget as any).isProcessing,
          voiceEnabled: (widget as any).config.voiceEnabled,
        };
        break;
    }

    // Send response back
    if (event.source) {
      event.source.postMessage({
        type: 'widget_query_response',
        queryId: query.id,
        data: response,
      }, { targetOrigin: event.origin });
    }
  }

  private handleAnalyticsEvent(eventData: AnalyticsEvent): void {
    this.trackEvent(eventData.type, eventData.data);
  }

  // Analytics
  private trackEvent(type: AnalyticsEvent['type'], data?: any): void {
    const event: AnalyticsEvent = {
      type,
      timestamp: new Date(),
      data,
      sessionId: this.sessionId,
      agentId: data?.agentId || 'unknown',
      userId: data?.userId,
    };

    this.analytics.push(event);
    this.log('Analytics event:', event);

    // Send to analytics endpoint if configured
    if (this.config.apiUrl) {
      this.sendAnalyticsEvent(event);
    }
  }

  private async sendAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      this.log('Failed to send analytics event:', error);
    }
  }

  getAnalytics(): AnalyticsEvent[] {
    return [...this.analytics];
  }

  clearAnalytics(): void {
    this.analytics = [];
  }

  // Utility Methods
  private generateSessionId(): string {
    return `sdk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[WidgetSDK]', ...args);
    }
  }

  // Public API Methods
  public enableDebug(): void {
    this.debug = true;
    this.config.debug = true;
  }

  public disableDebug(): void {
    this.debug = false;
    this.config.debug = false;
  }

  public getVersion(): string {
    return this.config.version || '1.0.0';
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  // Widget Factory Methods
  static async createEmbeddedWidget(config: WidgetConfig): Promise<AIWidget> {
    const sdk = WidgetSDK.getInstance();
    const widgetId = `widget_${Date.now()}`;
    return await sdk.createWidget(widgetId, config);
  }

  static generateEmbedCode(agentId: string, config: WidgetConfig, options?: { scriptUrl?: string }): string {
    const sdk = WidgetSDK.getInstance();
    const deploymentConfig = sdk.generateDeploymentConfig(agentId, config);
    
    if (options?.scriptUrl) {
      return sdk.generateEmbedCode(agentId, config, options.scriptUrl);
    }
    
    return deploymentConfig.embedCode;
  }

  // Integration Testing
  static async testIntegration(config: WidgetConfig): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Test required configuration
    if (!config.agentId) {
      errors.push('Agent ID is required');
    }

    // Test API connectivity
    if (config.apiUrl) {
      try {
        const response = await fetch(`${config.apiUrl}/api/health`);
        if (!response.ok) {
          warnings.push('API endpoint is not responding correctly');
        }
      } catch {
        warnings.push('Cannot connect to API endpoint');
      }
    } else {
      warnings.push('No API URL configured - widget will work in demo mode');
    }

    // Test voice capabilities
    if (config.voiceEnabled) {
      try {
        const hasPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
        hasPermission.getTracks().forEach(track => track.stop());
      } catch {
        warnings.push('Microphone access may not be available');
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }
}