import { logger } from '../utils/prodLogger';

/**
 * WebSocket service for real-time updates
 */

class WebSocketService {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1 second
        this.listeners = new Map();
        this.isConnected = false;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            
            // Подписываемся на обновления TTS и чата
            this.subscribe('tts');
            this.subscribe('chat');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                logger.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = (event) => {
            this.isConnected = false;
            this.emit('disconnected');
            
            // Автоматическое переподключение
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
            }
        };
        
        this.ws.onerror = (error) => {
            logger.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    handleMessage(data) {
        const { type, data: messageData } = data;
        
        switch (type) {
            case 'tts_status':
                this.emit('tts_status', messageData);
                break;
            case 'tts_progress':
                this.emit('tts_progress', messageData);
                break;
            case 'chat_message':
                this.emit('chat_message', messageData);
                break;
            case 'pong':
                this.emit('pong');
                break;
            case 'tts_error':
                this.emit('tts_error', messageData);
                break;
            case 'session_conflict':
                this.emit('session_conflict', messageData);
                break;
            default:
                // Unknown WebSocket message type
        }
    }

    subscribe(type) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: `subscribe_${type}`
            }));
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            logger.warn('WebSocket not connected, cannot send message');
        }
    }

    ping() {
        this.send({ type: 'ping' });
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error('Error in WebSocket event callback:', error);
                }
            });
        }
    }

    // Keep-alive ping
    startKeepAlive(interval = 30000) {
        this.keepAliveInterval = setInterval(() => {
            if (this.isConnected) {
                this.ping();
            }
        }, interval);
    }

    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }
}

// Создаем единственный экземпляр
const websocketService = new WebSocketService();

export default websocketService;
