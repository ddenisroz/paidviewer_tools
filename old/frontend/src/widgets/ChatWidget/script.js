import { logger } from '../../utils/prodLogger';

class ChatWidget {
    constructor() {
        this.config = null;
        this.ws = null;
        this.messageQueue = [];
        this.maxMessages = 50;
        this.isConnected = false;
        
        this.init();
    }
    
    async init() {
        try {
            // Загружаем конфигурацию
            this.config = await this.loadConfig();
            
            // Применяем настройки
            this.applyConfig();
            
            // Подключаемся к WebSocket
            this.connectWebSocket();
            
            // Запускаем обработку сообщений
            this.startMessageProcessor();
            
            // Добавляем тестовые сообщения для демонстрации
            this.addTestMessages();
            
        } catch (error) {
            // Ошибка инициализации виджета чата
        }
    }
    
    async loadConfig() {
        // Загружаем конфигурацию из URL параметров
        const urlParams = new URLSearchParams(window.location.search);
        const configId = urlParams.get('config') || 'default';
        const userId = urlParams.get('user');
        
        try {
            let url = `/api/widgets/chat/config/${configId}`;
            if (userId) {
                url += `?user_id=${userId}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.config;
            }
        } catch (error) {
            // Using default config');
        }
        
        return this.getDefaultConfig();
    }
    
    getDefaultConfig() {
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
            colors: {
                moderator: '#00ff00',
                vip: '#ff6b6b',
                subscriber: '#4ecdc4',
                normal: '#ffffff'
            }
        };
    }
    
    applyConfig() {
        const root = document.documentElement;
        const config = this.config;
        
        // Применяем CSS переменные
        root.style.setProperty('--widget-width', config.width + 'px');
        root.style.setProperty('--widget-height', config.height + 'px');
        root.style.setProperty('--background-color', config.backgroundColor);
        root.style.setProperty('--background-image', config.backgroundImage);
        root.style.setProperty('--border-radius', config.borderRadius + 'px');
        root.style.setProperty('--border-color', config.borderColor);
        root.style.setProperty('--border-width', config.borderWidth + 'px');
        root.style.setProperty('--message-bg', config.messageBg);
        root.style.setProperty('--message-border-radius', config.messageBorderRadius + 'px');
        root.style.setProperty('--message-margin', config.messageMargin + 'px');
        root.style.setProperty('--message-padding', config.messagePadding + 'px');
        root.style.setProperty('--font-family', config.fontFamily);
        root.style.setProperty('--font-size', config.fontSize + 'px');
        root.style.setProperty('--font-weight', config.fontWeight);
        root.style.setProperty('--text-color', config.textColor);
        root.style.setProperty('--animation-duration', config.animationDuration + 's');
        root.style.setProperty('--animation-type', config.animationType);
        root.style.setProperty('--moderator-color', config.colors.moderator);
        root.style.setProperty('--vip-color', config.colors.vip);
        root.style.setProperty('--subscriber-color', config.colors.subscriber);
        root.style.setProperty('--normal-color', config.colors.normal);
        
        this.maxMessages = config.maxMessages;
    }
    
    connectWebSocket() {
        // Получаем user_id из URL параметров
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user') || 'default';
        
        const wsUrl = `${this.config.wsUrl || window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host}/ws/chat-widget/${userId}`;
        if (wsUrl && !wsUrl.includes('null')) {
            this.ws = new WebSocket(wsUrl);
        } else {
            logger.warn('Invalid WebSocket URL:', wsUrl);
            return;
        }
        
        this.ws.onopen = () => {
            // Chat widget connected');
            this.isConnected = true;
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'chat_message') {
                    this.addMessage(data);
                }
            } catch (error) {
                // Ошибка парсинга WebSocket сообщения
            }
        };
        
        this.ws.onclose = () => {
            // Chat widget disconnected, reconnecting...');
            this.isConnected = false;
            setTimeout(() => this.connectWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            // WebSocket ошибка
        };
    }
    
    addMessage(data) {
        const message = {
            id: Date.now() + Math.random(),
            username: data.username,
            message: data.message,
            role: data.role || 'normal',
            timestamp: new Date(),
            platform: data.platform || 'twitch'
        };
        
        // Фильтруем сообщения по платформам
        if (!this.shouldShowMessage(message)) {
            return;
        }
        
        this.messageQueue.push(message);
        
        // Ограничиваем количество сообщений
        if (this.messageQueue.length > this.maxMessages) {
            this.messageQueue.shift();
        }
        
        this.renderMessage(message);
    }
    
    shouldShowMessage(message) {
        const platformFilter = this.config.platformFilter || 'combined';
        
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
    
    renderMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        
        messageElement.className = `chat-message ${message.role} ${this.config.animationType}`;
        messageElement.id = `message-${message.id}`;
        
        // Формируем содержимое сообщения
        let content = '';
        
        if (this.config.showUserRoles && message.role !== 'normal') {
            content += `<span class="role-badge">[${message.role.toUpperCase()}]</span> `;
        }
        
        // Добавляем индикатор платформы
        if (message.platform) {
            const platformIcon = message.platform === 'twitch' ? '🎮' : '🔵';
            content += `<span class="platform-indicator">${platformIcon}</span> `;
        }
        
        content += `<span class="username">${message.username}:</span> `;
        content += `<span class="message-text">${this.escapeHtml(message.message)}</span>`;
        
        if (this.config.showTimestamps) {
            const time = message.timestamp.toLocaleTimeString();
            content += ` <span class="timestamp">[${time}]</span>`;
        }
        
        messageElement.textContent = content;
        
        // Добавляем в контейнер
        messagesContainer.appendChild(messageElement);
        
        // Показываем анимацию
        setTimeout(() => {
            messageElement.classList.add('show');
        }, 10);
        
        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Удаляем старые сообщения
        this.cleanupOldMessages();
    }
    
    cleanupOldMessages() {
        const messages = document.querySelectorAll('.chat-message');
        if (messages.length > this.maxMessages) {
            const toRemove = messages.length - this.maxMessages;
            for (let i = 0; i < toRemove; i++) {
                messages[i].remove();
            }
        }
    }
    
    startMessageProcessor() {
        // Обработка очереди сообщений
        setInterval(() => {
            // Дополнительная логика обработки
        }, 1000);
    }
    
    addTestMessages() {
        // Добавляем тестовые сообщения только в режиме разработки
        if (this.config.debugMode) {
            const testMessages = [
                { username: 'StreamerBot', message: 'Добро пожаловать на стрим!', role: 'moderator' },
                { username: 'Viewer123', message: 'Привет всем! 👋', role: 'normal' },
                { username: 'VIP_User', message: 'Отличный контент!', role: 'vip' },
                { username: 'Subscriber', message: 'Спасибо за стрим!', role: 'subscriber' },
                { username: 'Moderator', message: 'Помните о правилах чата', role: 'moderator' }
            ];
            
            testMessages.forEach((msg, index) => {
                setTimeout(() => {
                    this.addMessage(msg);
                }, index * 2000);
            });
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Запускаем виджет
document.addEventListener('DOMContentLoaded', () => {
    new ChatWidget();
});
