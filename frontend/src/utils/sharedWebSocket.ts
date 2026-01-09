// src/utils/sharedWebSocket.ts
/**
 * Shared WebSocket connection manager.
 * Implements Leader Election for single connection per user across tabs.
 */

import { logger } from '@/shared/utils/prodLogger';

type MessageHandler = (data: unknown) => void;

class SharedWebSocket {
    private ws: WebSocket | null = null;
    private url: string = '';
    private handlers: Set<MessageHandler> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isConnecting = false;

    /**
     * Connect to WebSocket server.
     */
    connect(url: string): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.isConnecting) {
            return;
        }

        this.url = url;
        this.isConnecting = true;

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                logger.info('[WebSocket] Connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handlers.forEach((handler) => handler(data));
                } catch (error) {
                    logger.error('[WebSocket] Failed to parse message:', error);
                }
            };

            this.ws.onclose = () => {
                logger.info('[WebSocket] Disconnected');
                this.isConnecting = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                logger.error('[WebSocket] Error:', error);
                this.isConnecting = false;
            };
        } catch (error) {
            logger.error('[WebSocket] Connection failed:', error);
            this.isConnecting = false;
        }
    }

    /**
     * Disconnect from WebSocket server.
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Send message through WebSocket.
     */
    send(data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            logger.warn('[WebSocket] Not connected, cannot send message');
        }
    }

    /**
     * Add message handler.
     */
    addHandler(handler: MessageHandler): void {
        this.handlers.add(handler);
    }

    /**
     * Remove message handler.
     */
    removeHandler(handler: MessageHandler): void {
        this.handlers.delete(handler);
    }

    /**
     * Attempt to reconnect after disconnect.
     */
    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('[WebSocket] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        logger.info(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (this.url) {
                this.connect(this.url);
            }
        }, delay);
    }

    /**
     * Check if connected.
     */
    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export const sharedWebSocket = new SharedWebSocket();
export default sharedWebSocket;
