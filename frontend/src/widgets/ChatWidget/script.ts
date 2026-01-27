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

  private getPlatformIconHtml(platform: Platform): string {
    const twitchSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.149 0L0 4.774v16.452h5.71v3.226h4.774l4.774-4.774h3.816l6.657-6.657V0H2.149zm20.573 12.131-3.816 3.816h-3.816l-3.816 3.816v-3.816H6.71V2.926h16.222v9.205zm-5.71-6.425h2.387v5.71h-2.387V5.706zm-4.774 0h2.387v5.71h-2.387V5.706z"/></svg>`;
    const vkSvg = `<svg viewBox="2 2 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M6 9.12c0-2.352 0-3.528.457-4.427a4.2 4.2 0 0 1 1.836-1.836C9.192 2.4 10.368 2.4 12.72 2.4h.624c2.89 0 4.334 0 5.438.563a5.16 5.16 0 0 1 2.256 2.255c.562 1.104.562 2.548.562 5.438v2.688c0 2.89 0 4.334-.562 5.438a5.16 5.16 0 0 1-2.256 2.256c-1.104.562-2.548.562-5.438.562h-.624c-2.352 0-3.528 0-4.427-.457a4.2 4.2 0 0 1-1.836-1.836C6 18.408 6 17.232 6 14.88V9.12Zm10.328 1.165c.947.566 1.42.848 1.58 1.214.14.32.14.684 0 1.002-.16.367-.633.649-1.58 1.214l-2.506 1.497c-.99.591-1.484.887-1.891.848a1.248 1.248 0 0 1-.89-.504C10.8 15.226 10.8 14.649 10.8 13.496v-2.992c0-1.152 0-1.728.242-2.059.19-.25.478-.41.89-.504.407-.039.9.257 1.89.848l2.506 1.496Z" clip-rule="evenodd"/></svg>`;
    const icon = platform === 'twitch' ? twitchSvg : vkSvg;
    const platformClass = platform === 'twitch' ? 'twitch' : 'vk';
    const title = platform === 'twitch' ? 'Twitch' : 'VK Live';
    return `<span class="platform-icon ${platformClass}" title="${title}">${icon}</span>`;
  }

  private getRoleBadgeHtml(role: string): string {
    const normalized = role.toLowerCase();
    const icons: Record<string, string> = {
      broadcaster: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.9 3.1 1.1-6.5L2.5 8.9 9 8z"/></svg>`,
      moderator: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.4 9.7-8 10-4.6-.3-8-5-8-10V6l8-4z"/></svg>`,
      vip: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1L22 9.2l-5 4.9 1.2 6.9L12 17l-6.2 4 1.2-6.9-5-4.9 7.1-1.1z"/></svg>`,
      subscriber: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 10-8 10-8-10z"/></svg>`
    };

    const labels: Record<string, string> = {
      broadcaster: '???????',
      moderator: '???',
      vip: 'VIP',
      subscriber: 'SUB'
    };

    const icon = icons[normalized];
    if (!icon) {
      return `<span class="role-badge">${role.toUpperCase()}</span>`;
    }

    return `<span class="role-badge role-${normalized}" title="${labels[normalized]}">${icon}<span>${labels[normalized]}</span></span>`;
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
      content += this.getRoleBadgeHtml(message.role);
    }
    if (message.platform) {
      content += this.getPlatformIconHtml(message.platform);
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


