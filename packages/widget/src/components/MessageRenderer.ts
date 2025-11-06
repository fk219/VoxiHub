import { Message } from '../services/chat';

export class MessageRenderer {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  renderMessage(message: Message): HTMLElement {
    const messageElement = document.createElement('div');
    messageElement.className = `ai-widget-message ai-widget-message-${message.role}`;
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-timestamp', message.timestamp.toISOString());

    // Create message content
    const contentElement = document.createElement('div');
    contentElement.className = 'ai-widget-message-content';
    
    if (message.type === 'text') {
      contentElement.innerHTML = this.formatTextContent(message.content);
    } else if (message.type === 'audio') {
      contentElement.appendChild(this.createAudioElement(message));
    }

    messageElement.appendChild(contentElement);

    // Add timestamp
    const timestampElement = document.createElement('div');
    timestampElement.className = 'ai-widget-message-timestamp';
    timestampElement.textContent = this.formatTimestamp(message.timestamp);
    messageElement.appendChild(timestampElement);

    // Add status indicator for user messages
    if (message.role === 'user') {
      const statusElement = document.createElement('div');
      statusElement.className = 'ai-widget-message-status';
      statusElement.innerHTML = '✓';
      messageElement.appendChild(statusElement);
    }

    return messageElement;
  }

  private formatTextContent(content: string): string {
    // Sanitize and format content
    let formatted = this.sanitizeHTML(content);
    
    // Apply basic markdown-like formatting
    formatted = formatted
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    // Convert URLs to links
    formatted = this.linkifyUrls(formatted);

    return formatted;
  }

  private createAudioElement(message: Message): HTMLElement {
    const audioContainer = document.createElement('div');
    audioContainer.className = 'ai-widget-audio-message';

    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    audioElement.preload = 'metadata';
    
    // In a real implementation, this would be the audio URL from the message
    // audioElement.src = message.audioUrl;
    
    const transcriptElement = document.createElement('div');
    transcriptElement.className = 'ai-widget-audio-transcript';
    transcriptElement.textContent = message.content;

    audioContainer.appendChild(audioElement);
    audioContainer.appendChild(transcriptElement);

    return audioContainer;
  }

  private sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  private linkifyUrls(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  private formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  renderTypingIndicator(): HTMLElement {
    const typingElement = document.createElement('div');
    typingElement.className = 'ai-widget-typing';
    typingElement.id = 'ai-widget-typing';
    
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'ai-widget-typing-dots';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'ai-widget-typing-dot';
      dotsContainer.appendChild(dot);
    }
    
    typingElement.appendChild(dotsContainer);
    
    const textElement = document.createElement('span');
    textElement.className = 'ai-widget-typing-text';
    textElement.textContent = 'AI is typing...';
    typingElement.appendChild(textElement);

    return typingElement;
  }

  renderErrorMessage(error: string): HTMLElement {
    const errorElement = document.createElement('div');
    errorElement.className = 'ai-widget-message ai-widget-message-error';
    
    const iconElement = document.createElement('span');
    iconElement.className = 'ai-widget-error-icon';
    iconElement.innerHTML = '⚠️';
    
    const textElement = document.createElement('span');
    textElement.className = 'ai-widget-error-text';
    textElement.textContent = error;
    
    errorElement.appendChild(iconElement);
    errorElement.appendChild(textElement);
    
    return errorElement;
  }

  scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  scrollToMessage(messageId: string): void {
    const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  highlightMessage(messageId: string, duration: number = 2000): void {
    const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
    if (messageElement) {
      messageElement.classList.add('ai-widget-message-highlighted');
      setTimeout(() => {
        messageElement.classList.remove('ai-widget-message-highlighted');
      }, duration);
    }
  }

  clearMessages(): void {
    this.container.innerHTML = '';
  }

  getMessageCount(): number {
    return this.container.querySelectorAll('.ai-widget-message').length;
  }
}