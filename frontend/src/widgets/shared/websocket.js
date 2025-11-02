import { logger } from '../../utils/prodLogger';

/**
 * Общий WebSocket клиент для виджетов
 */
class WidgetWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            ...options
        };
        this.ws = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.messageHandlers = new Map();
        
        this.connect();
    }
    
    connect() {
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                // WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.emit('message', data);
                } catch (error) {
                    logger.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                // WebSocket disconnected');
                this.isConnected = false;
                this.emit('disconnected');
                this.handleReconnect();
            };
            
            this.ws.onerror = (error) => {
                logger.error('WebSocket error:', error);
                this.emit('error', error);
            };
            
        } catch (error) {
            logger.error('Error creating WebSocket:', error);
            this.handleReconnect();
        }
    }
    
    handleReconnect() {
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Reconnecting...
            
            setTimeout(() => {
                this.connect();
            }, this.options.reconnectInterval);
        } else {
            logger.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
        }
    }
    
    send(data) {
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify(data));
                return true;
            } catch (error) {
                logger.error('Error sending message:', error);
                return false;
            }
        } else {
            logger.warn('WebSocket not connected');
            return false;
        }
    }
    
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error('Error in event handler:', error);
                }
            });
        }
    }
    
    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Экспортируем для использования в виджетах
window.WidgetWebSocket = WidgetWebSocket;
