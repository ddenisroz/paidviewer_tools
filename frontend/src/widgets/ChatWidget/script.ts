import { logger } from '@/shared/utils/prodLogger';

type ChatRole = 'broadcaster' | 'moderator' | 'vip' | 'subscriber' | 'normal';
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

const resolveWidgetTimeZone = (): string => {
    try {
        return window.localStorage.getItem('app.timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
};

const formatWidgetTime = (value: Date): string =>
    new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: resolveWidgetTimeZone(),
    }).format(value);

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
        this.maxMessages = Number.isFinite(config.maxMessages)
            ? Math.min(Math.max(Math.trunc(config.maxMessages), 1), 500)
            : 50;
    }

    private connectWebSocket(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = encodeURIComponent(urlParams.get('user') || 'default');
        const fallbackBase =
            window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
        let base = this.config?.wsUrl || fallbackBase;
        try {
            const parsed = new URL(base);
            if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
                base = fallbackBase;
            }
        } catch {
            base = fallbackBase;
        }
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

    private createSvgIcon(
        viewBox: string,
        pathD: string,
        options?: { fillRule?: 'evenodd' | 'nonzero'; clipRule?: 'evenodd' | 'nonzero' }
    ): SVGSVGElement {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', pathD);
        if (options?.fillRule) path.setAttribute('fill-rule', options.fillRule);
        if (options?.clipRule) path.setAttribute('clip-rule', options.clipRule);
        svg.appendChild(path);
        return svg;
    }

    private createPlatformIconElement(platform: Platform): HTMLSpanElement {
        const iconWrapper = document.createElement('span');
        iconWrapper.className = `platform-icon ${platform === 'twitch' ? 'twitch' : 'vk'}`;
        iconWrapper.title = platform === 'twitch' ? 'Twitch' : 'VK Live';
        const svg =
            platform === 'twitch'
                ? this.createSvgIcon(
                      '0 0 24 24',
                      'M2.149 0L0 4.774v16.452h5.71v3.226h4.774l4.774-4.774h3.816l6.657-6.657V0H2.149zm20.573 12.131-3.816 3.816h-3.816l-3.816 3.816v-3.816H6.71V2.926h16.222v9.205zm-5.71-6.425h2.387v5.71h-2.387V5.706zm-4.774 0h2.387v5.71h-2.387V5.706z'
                  )
                : this.createSvgIcon(
                      '2 2 20 20',
                      'M6 9.12c0-2.352 0-3.528.457-4.427a4.2 4.2 0 0 1 1.836-1.836C9.192 2.4 10.368 2.4 12.72 2.4h.624c2.89 0 4.334 0 5.438.563a5.16 5.16 0 0 1 2.256 2.255c.562 1.104.562 2.548.562 5.438v2.688c0 2.89 0 4.334-.562 5.438a5.16 5.16 0 0 1-2.256 2.256c-1.104.562-2.548.562-5.438.562h-.624c-2.352 0-3.528 0-4.427-.457a4.2 4.2 0 0 1-1.836-1.836C6 18.408 6 17.232 6 14.88V9.12Zm10.328 1.165c.947.566 1.42.848 1.58 1.214.14.32.14.684 0 1.002-.16.367-.633.649-1.58 1.214l-2.506 1.497c-.99.591-1.484.887-1.891.848a1.248 1.248 0 0 1-.89-.504C10.8 15.226 10.8 14.649 10.8 13.496v-2.992c0-1.152 0-1.728.242-2.059.19-.25.478-.41.89-.504.407-.039.9.257 1.89.848l2.506 1.496Z',
                      { fillRule: 'evenodd', clipRule: 'evenodd' }
                  );
        iconWrapper.appendChild(svg);
        return iconWrapper;
    }

    private createRoleBadgeElement(role: string): HTMLSpanElement {
        const normalized = role.toLowerCase();
        const icons: Record<string, { viewBox: string; path: string }> = {
            broadcaster: {
                viewBox: '0 0 24 24',
                path: 'M12 2l3 6 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.9 3.1 1.1-6.5L2.5 8.9 9 8z',
            },
            moderator: { viewBox: '0 0 24 24', path: 'M12 2l8 4v6c0 5-3.4 9.7-8 10-4.6-.3-8-5-8-10V6l8-4z' },
            vip: {
                viewBox: '0 0 24 24',
                path: 'M12 2l2.9 6.1L22 9.2l-5 4.9 1.2 6.9L12 17l-6.2 4 1.2-6.9-5-4.9 7.1-1.1z',
            },
            subscriber: { viewBox: '0 0 24 24', path: 'M12 2l8 10-8 10-8-10z' },
        };

        const labels: Record<string, string> = {
            broadcaster: 'Стример',
            moderator: 'Мод',
            vip: 'VIP',
            subscriber: 'SUB',
        };

        const badge = document.createElement('span');
        badge.className = icons[normalized] ? `role-badge role-${normalized}` : 'role-badge';
        const labelText = labels[normalized] || role.toUpperCase();
        badge.title = labelText;

        const icon = icons[normalized];
        if (icon) {
            badge.appendChild(this.createSvgIcon(icon.viewBox, icon.path));
            const label = document.createElement('span');
            label.textContent = labelText;
            badge.appendChild(label);
            return badge;
        }

        badge.textContent = labelText;
        return badge;
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
        const safeRole = ['normal', 'broadcaster', 'moderator', 'vip', 'subscriber'].includes(message.role)
            ? message.role
            : 'normal';
        const safeAnimationType = ['slide', 'fade', 'none'].includes(this.config?.animationType || '')
            ? this.config?.animationType
            : 'fade';
        messageElement.className = `chat-message ${safeRole} ${safeAnimationType}`;
        messageElement.id = `message-${message.id}`;
        if (this.config?.showUserRoles && message.role !== 'normal') {
            messageElement.appendChild(this.createRoleBadgeElement(message.role));
        }
        if (message.platform) {
            messageElement.appendChild(this.createPlatformIconElement(message.platform));
        }

        const usernameElement = document.createElement('span');
        usernameElement.className = 'username';
        usernameElement.textContent = `${message.username}:`;
        messageElement.appendChild(usernameElement);
        messageElement.appendChild(document.createTextNode(' '));

        const messageTextElement = document.createElement('span');
        messageTextElement.className = 'message-text';
        messageTextElement.textContent = message.message;
        messageElement.appendChild(messageTextElement);

        if (this.config?.showTimestamps) {
            const timeElement = document.createElement('span');
            timeElement.className = 'timestamp';
            timeElement.textContent = ` [${formatWidgetTime(message.timestamp)}]`;
            messageElement.appendChild(timeElement);
        }
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
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatWidget();
});
