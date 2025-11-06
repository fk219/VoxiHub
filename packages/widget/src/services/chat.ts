export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'audio';
  metadata?: {
    confidence?: number;
    processingTime?: number;
  };
}

export interface ConversationContext {
  conversationId?: string;
  agentId: string;
  messages: Message[];
  metadata: {
    userAgent: string;
    sessionId: string;
    startTime: Date;
  };
}

export class ChatService {
  private apiUrl: string;
  private context: ConversationContext;
  private messageQueue: Message[] = [];
  private isProcessing = false;

  constructor(apiUrl: string, agentId: string) {
    this.apiUrl = apiUrl;
    this.context = {
      agentId,
      messages: [],
      metadata: {
        userAgent: navigator.userAgent,
        sessionId: this.generateSessionId(),
        startTime: new Date(),
      },
    };
  }

  async sendMessage(content: string): Promise<Message> {
    const userMessage: Message = {
      id: this.generateMessageId(),
      content,
      role: 'user',
      timestamp: new Date(),
      type: 'text',
    };

    this.context.messages.push(userMessage);
    this.messageQueue.push(userMessage);

    try {
      const response = await this.processMessage(userMessage);
      this.context.messages.push(response);
      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Return error message
      const errorMessage: Message = {
        id: this.generateMessageId(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        type: 'text',
      };
      
      this.context.messages.push(errorMessage);
      return errorMessage;
    }
  }

  private async processMessage(message: Message): Promise<Message> {
    if (this.isProcessing) {
      throw new Error('Already processing a message');
    }

    this.isProcessing = true;

    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.apiUrl}/api/conversations/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: this.context.conversationId,
          agentId: this.context.agentId,
          message: {
            content: message.content,
            type: message.type,
          },
          context: {
            sessionId: this.context.metadata.sessionId,
            userAgent: this.context.metadata.userAgent,
            messageHistory: this.context.messages.slice(-10), // Last 10 messages for context
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      // Update conversation ID if this is the first message
      if (!this.context.conversationId && data.conversationId) {
        this.context.conversationId = data.conversationId;
      }

      const assistantMessage: Message = {
        id: data.messageId || this.generateMessageId(),
        content: data.content || data.message,
        role: 'assistant',
        timestamp: new Date(),
        type: 'text',
        metadata: {
          processingTime,
          confidence: data.confidence,
        },
      };

      return assistantMessage;
    } finally {
      this.isProcessing = false;
    }
  }

  getMessages(): Message[] {
    return [...this.context.messages];
  }

  getConversationId(): string | undefined {
    return this.context.conversationId;
  }

  clearHistory(): void {
    this.context.messages = [];
    this.context.conversationId = undefined;
    this.messageQueue = [];
  }

  exportConversation(): ConversationContext {
    return JSON.parse(JSON.stringify(this.context));
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format message content for display
  formatMessage(content: string): string {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // Validate message content
  validateMessage(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (content.length > 4000) {
      return { isValid: false, error: 'Message is too long (max 4000 characters)' };
    }

    // Check for potentially harmful content (basic check)
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, error: 'Message contains invalid content' };
      }
    }

    return { isValid: true };
  }
}