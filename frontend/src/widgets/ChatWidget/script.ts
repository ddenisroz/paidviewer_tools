import { logger } from '@/shared/utils/prodLogger';

type ChatRole = 'moderator' | 'vip' | 'subscriber' | 'normal';
type Platform = 'twitch' | 'vk';

interface ChatConfig {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
  messageBg: string;
  messageBorderRadius: number;
  messageMargin: number;
  messagePadding: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  animationDuration: number;
  animationType: string;
  maxMessages: number;
  showTimestamps: boolean;
  showUserRoles: boolean;
  colors: { moderator: string; vip: string; subscriber: string; normal: string };
  debugMode?: boolean;
  platformFilter?: 'twitch' | 'vk' | 'combined';
  wsUrl?: string;
}

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  role: ChatRole;
  timestamp: Date;
  platform: Platform;
}

class ChatWidget {
  private config: ChatConfig | null;
  private ws: WebSocket | null;
  private messageQueue: ChatMessage[];
  private maxMessages: number;
  private isConnected: boolean;

  constructor() {
    this.config = null;
    this.ws = null;
    this.messageQueue = [];
    this.maxMessages = 50;
    this.isConnected = false;
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.config = await this.loadConfig();
      this.applyConfig();
      this.connectWebSocket();
      this.startMessageProcessor();
      this.addTestMessages();
    } catch {
      // init error
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  private async loadConfig(): Promise<ChatConfig> {
    const urlParams = new URLSearchParams(window.location.search);
    const configId = urlParams.get('config') || 'default';
    const userId = urlParams.get('user');
    try {
      let url = `/api/widgets/chat/config/${configId}`;
      if (userId) url += `?user_id=${userId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return (data.config || data) as ChatConfig;
      }
    } catch {
      // fallback to default
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): ChatConfig {
    return {
      width: 400,
      height: 300,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backgroundImage: 'none',
      borderRadius: 8,
      borderColor: '#333',
      borderWidth: 2,
      messageBg: 'rgba(255, 255, 255, 0.1)',
      messageBorderRadius: 4,
      messageMargin: 4,
      messagePadding: 8,
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fontWeight: 'normal',
      textColor: '#ffffff',
      animationDuration: 0.3,
      animationType: 'slide-in',
      maxMessages: 50,
      showTimestamps: false,
      showUserRoles: true,
      colors: { moderator: '#00ff00', vip: '#ff6b6b', subscriber: '#4ecdc4', normal: '#ffffff' },
      platformFilter: 'combined',
    };
  }

  private applyConfig(): void {
    if (!this.config) return;
    const root = document.documentElement;
    const config = this.config;
    root.style.setProperty('--widget-width', `${config.width}px`);
    root.style.setProperty('--widget-height', `${config.height}px`);
    root.style.setProperty('--background-color', config.backgroundColor);
    root.style.setProperty('--background-image', config.backgroundImage);
    root.style.setProperty('--border-radius', `${config.borderRadius}px`);
    root.style.setProperty('--border-color', config.borderColor);
    root.style.setProperty('--border-width', `${config.borderWidth}px`);
    root.style.setProperty('--message-bg', config.messageBg);
    root.style.setProperty('--message-border-radius', `${config.messageBorderRadius}px`);
    root.style.setProperty('--message-margin', `${config.messageMargin}px`);
    root.style.setProperty('--message-padding', `${config.messagePadding}px`);
    root.style.setProperty('--font-family', config.fontFamily);
    root.style.setProperty('--font-size', `${config.fontSize}px`);
    root.style.setProperty('--font-weight', config.fontWeight);
    root.style.setProperty('--text-color', config.textColor);
    root.style.setProperty('--animation-duration', `${config.animationDuration}s`);
    root.style.setProperty('--animation-type', config.animationType);
    root.style.setProperty('--moderator-color', config.colors.moderator);
    root.style.setProperty('--vip-color', config.colors.vip);
    root.style.setProperty('--subscriber-color', config.colors.subscriber);
    root.style.setProperty('--normal-color', config.colors.normal);
    this.maxMessages = config.maxMessages;
  }

  private connectWebSocket(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user') || 'default';
    const base = this.config?.wsUrl || (window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`);
    const wsUrl = `${base}/ws/chat-widget/${userId}`;
    if (!wsUrl || wsUrl.includes('null')) {
      logger.warn('Invalid WebSocket URL:', wsUrl);
      return;
    }
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      this.isConnected = true;
    };
    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message') {
          this.addMessage(data);
        }
      } catch {
        // parse error
      }
    };
    this.ws.onclose = () => {
      this.isConnected = false;
      setTimeout(() => this.connectWebSocket(), 5000);
    };
    this.ws.onerror = () => {
      // ws error
    };
  }

  private addMessage(data: Record<string, unknown>): void {
    const message: ChatMessage = {
      id: Date.now() + Math.random(),
      username: String(data.username || 'Unknown'),
      message: String(data.message || ''),
      role: (data.role || 'normal') as ChatRole,
      timestamp: new Date(),
      platform: (data.platform || 'twitch') as Platform,
    };
    if (!this.shouldShowMessage(message)) return;
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxMessages) {
      this.messageQueue.shift();
    }
    this.renderMessage(message);
  }

  private shouldShowMessage(message: ChatMessage): boolean {
    const platformFilter = this.config?.platformFilter || 'combined';
    switch (platformFilter) {
      case 'twitch':
        return message.platform === 'twitch';
      case 'vk':
        return message.platform === 'vk';
      case 'combined':
      default:
        return true;
    }
  }

  private renderMessage(message: ChatMessage): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${message.role} ${this.config?.animationType}`;
    messageElement.id = `message-${message.id}`;
    let content = '';
    if (this.config?.showUserRoles && message.role !== 'normal') {
      content += `<span class="role-badge">[${message.role.toUpperCase()}]</span> `;
    }
    if (message.platform) {
      const platformIcon = message.platform === 'twitch' ? '[GAME]' : '[VK]';
      content += `<span class="platform-indicator">${platformIcon}</span> `;
    }
    content += `<span class="username">${this.escapeHtml(message.username)}:</span> `;
    content += `<span class="message-text">${this.escapeHtml(message.message)}</span>`;
    if (this.config?.showTimestamps) {
      const time = message.timestamp.toLocaleTimeString();
      content += ` <span class="timestamp">[${time}]</span>`;
    }
    messageElement.innerHTML = content;
    messagesContainer.appendChild(messageElement);
    setTimeout(() => {
      messageElement.classList.add('show');
    }, 10);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.cleanupOldMessages();
  }

  private cleanupOldMessages(): void {
    const messages = document.querySelectorAll('.chat-message');
    if (messages.length > this.maxMessages) {
      const toRemove = messages.length - this.maxMessages;
      for (let i = 0; i < toRemove; i++) {
        messages[i].remove();
      }
    }
  }

  private startMessageProcessor(): void {
    setInterval(() => {
      // processing hook
    }, 1000);
  }

  private addTestMessages(): void {
    if (this.config?.debugMode) {
      const testMessages = [
        { username: 'StreamerBot', message: 'Добро пожаловать на стрим!', role: 'moderator' },
        { username: 'Viewer123', message: 'Привет всем! [BYE]', role: 'normal' },
        { username: 'VIP_User', message: 'Отличный контент!', role: 'vip' },
        { username: 'Subscriber', message: 'Спасибо за стрим!', role: 'subscriber' },
        { username: 'Moderator', message: 'Помните о правилах чата', role: 'moderator' },
      ];
      testMessages.forEach((msg, index) => {
        setTimeout(() => {
          this.addMessage(msg);
        }, index * 2000);
      });
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatWidget();
});


