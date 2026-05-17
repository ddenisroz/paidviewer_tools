import { logger } from '@/shared/utils/prodLogger';

type Handler = (data?: Record<string, unknown>) => void;

declare global {
    interface Window {
        WidgetWebSocket: typeof WidgetWebSocket;
    }
}

class WidgetWebSocket {
    private url: string;
    private options: { reconnectInterval: number; maxReconnectAttempts: number };
    private ws: WebSocket | null;
    private reconnectAttempts: number;
    private isConnected: boolean;
    private messageHandlers: Map<string, Handler[]>;

    constructor(url: string, options: Partial<{ reconnectInterval: number; maxReconnectAttempts: number }> = {}) {
        this.url = url;
        this.options = { reconnectInterval: 5000, maxReconnectAttempts: 10, ...options };
        this.ws = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.connect();
    }

    private connect(): void {
        try {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
            };
            this.ws.onmessage = (event: MessageEvent<string>) => {
                try {
                    const data = JSON.parse(event.data);
                    this.emit('message', data);
                } catch (error) {
                    logger.error('Error parsing WebSocket message:', error);
                }
            };
            this.ws.onclose = () => {
                this.isConnected = false;
                this.emit('disconnected');
                this.handleReconnect();
            };
            this.ws.onerror = (error: Event) => {
                logger.error('WebSocket error:', error);
                this.emit('error', { error: error.type });
            };
        } catch (error) {
            logger.error('Error creating WebSocket:', error);
            this.handleReconnect();
        }
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.connect();
            }, this.options.reconnectInterval);
        } else {
            logger.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
        }
    }

    public send(data: Record<string, unknown>): boolean {
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

    public on(event: string, handler: Handler): void {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            handlers.push(handler);
        }
    }

    public off(event: string, handler: Handler): void {
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    private emit(event: string, data?: Record<string, unknown>): void {
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error('Error in event handler:', error);
                }
            });
        }
    }

    public close(): void {
        if (this.ws) {
            this.ws.close();
        }
    }
}

window.WidgetWebSocket = WidgetWebSocket;

export default WidgetWebSocket;
