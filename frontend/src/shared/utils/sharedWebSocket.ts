import { WS_BASE_URL } from '@/constants';
import { WEBSOCKET_CONSTANTS } from '@/constants/websocket';
import { getChatWebSocketToken } from '@/shared/utils/websocketAuth';
import Logger from '@/shared/utils/prodLogger';

type MessageHandler = (message: Record<string, unknown>) => void;
type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

class SharedWebSocketManager {
    private ws: WebSocket | null;
    private isLeader: boolean;
    private tabId: string;
    private channel: BroadcastChannel | null;
    private reconnectAttempts: number;
    private maxReconnectAttempts: number;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null;
    private messageHandlers: Set<MessageHandler>;
    private connectionStatusHandlers: Set<ConnectionStatusHandler>;
    private leaderHeartbeatInterval: ReturnType<typeof setInterval> | null;
    private leaderCheckInterval: ReturnType<typeof setInterval> | null;
    private wsHeartbeatInterval: ReturnType<typeof setInterval> | null;
    private lastLeaderHeartbeat: number;
    private lastWsHeartbeat: number;
    private leaderResponseReceived: boolean;
    public userId?: string | number;
    private logger: Logger;
    private connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'failed';

    constructor() {
        this.ws = null;
        this.isLeader = false;
        this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.channel = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = WEBSOCKET_CONSTANTS.RECONNECT.MAX_ATTEMPTS;
        this.reconnectTimeout = null;
        this.messageHandlers = new Set();
        this.connectionStatusHandlers = new Set();
        this.leaderHeartbeatInterval = null;
        this.leaderCheckInterval = null;
        this.wsHeartbeatInterval = null;
        this.lastLeaderHeartbeat = Date.now();
        this.lastWsHeartbeat = Date.now();
        this.leaderResponseReceived = false;
        this.connectionStatus = 'disconnected';
        this.logger = new Logger('SHARED_WS');
        this.logger.info(`[${this.tabId}] Tab initialized`);
    }

    init(userId: string | number): void {
        if (this.channel) {
            this.logger.warn(`[${this.tabId}] Already initialized`);
            return;
        }
        this.userId = userId;
        this.channel = new BroadcastChannel(`ws_chat_${userId}`);
        this.channel.onmessage = (event) => {
            this._handleChannelMessage(event.data as Record<string, unknown>);
        };
        this._electLeader();
        this.leaderCheckInterval = setInterval(() => {
            this._checkLeaderHealth();
        }, 3000);
        this.logger.info(`[${this.tabId}] BroadcastChannel initialized for user ${userId}`);
    }

    private _electLeader(): void {
        this.leaderResponseReceived = false;
        this.channel?.postMessage({ type: 'leader_ping', tabId: this.tabId });
        setTimeout(() => {
            if (!this.isLeader && !this.leaderResponseReceived) {
                this.logger.info(`[${this.tabId}] No leader response, becoming leader`);
                this._becomeLeader();
            }
        }, 200);
    }

    private _becomeLeader(): void {
        if (this.isLeader) return;
        this.isLeader = true;
        this.logger.info(`[${this.tabId}] [LEADER] Became LEADER - opening WebSocket`);
        this._connectWebSocket();

        // Leader heartbeat to other tabs (every 2 seconds)
        this.leaderHeartbeatInterval = setInterval(() => {
            this.channel?.postMessage({ type: 'leader_heartbeat', tabId: this.tabId, timestamp: Date.now() });
        }, 2000);

        this.channel?.postMessage({ type: 'leader_elected', tabId: this.tabId });
    }

    private _resignLeader(): void {
        if (!this.isLeader) return;
        this.isLeader = false;
        this.logger.info(`[${this.tabId}] Resigned as leader`);

        // Clear all intervals
        if (this.leaderHeartbeatInterval) {
            clearInterval(this.leaderHeartbeatInterval);
            this.leaderHeartbeatInterval = null;
        }
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
            this.wsHeartbeatInterval = null;
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.channel?.postMessage({ type: 'leader_resigned', tabId: this.tabId });
    }

    private _checkLeaderHealth(): void {
        if (this.isLeader) return;
        const timeSinceLastHeartbeat = Date.now() - this.lastLeaderHeartbeat;
        if (timeSinceLastHeartbeat > 8000) {
            this.leaderResponseReceived = false;
            this.channel?.postMessage({ type: 'leader_ping', tabId: this.tabId });
            setTimeout(() => {
                if (!this.leaderResponseReceived && !this.isLeader) {
                    this.logger.warn(
                        `[${this.tabId}] Leader seems dead (no heartbeat for ${timeSinceLastHeartbeat}ms), starting election`
                    );
                    this._electLeader();
                } else if (this.leaderResponseReceived) {
                    this.lastLeaderHeartbeat = Date.now();
                }
            }, 300);
        }
    }

    private _handleChannelMessage(data: Record<string, unknown>): void {
        const handlers: Record<string, (data: Record<string, unknown>) => void> = {
            leader_ping: () => this._onLeaderPing(),
            leader_pong: (d) => this._onLeaderPong(d),
            leader_heartbeat: (d) => this._onLeaderHeartbeat(d),
            leader_elected: (d) => this._onLeaderElected(d),
            leader_resigned: (d) => this._onLeaderResigned(d),
            ws_message: (d) => this._onWsMessage(d),
            ws_connected: (d) => this._onWsConnected(d),
            connection_status: (d) => this._onConnectionStatus(d),
            ws_connection_failed: (d) => this._onWsConnectionFailed(d),
        };

        const handler = handlers[data.type as string];
        if (handler) {
            handler(data);
        } else if (data.type !== 'state_reconciliation_required') {
            this.logger.debug?.(`[${this.tabId}] Unknown message type: ${data.type}`);
        }
    }

    private _onLeaderPing(): void {
        if (this.isLeader) {
            this.channel?.postMessage({ type: 'leader_pong', tabId: this.tabId });
        }
    }

    private _onLeaderPong(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this.lastLeaderHeartbeat = Date.now();
            this.leaderResponseReceived = true;
            this.logger.debug?.(`[${this.tabId}] Leader ${data.tabId} is active`);
        }
    }

    private _onLeaderHeartbeat(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this.lastLeaderHeartbeat = data.timestamp as number;
        }
    }

    private _onLeaderElected(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this.isLeader = false;
            this.lastLeaderHeartbeat = Date.now();
            this.logger.info(`[${this.tabId}] New leader elected: ${data.tabId}`);
        }
    }

    private _onLeaderResigned(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this.logger.info(`[${this.tabId}] Leader resigned, starting election`);
            setTimeout(() => this._electLeader(), 50);
        }
    }

    private _onWsMessage(data: Record<string, unknown>): void {
        if (!this.isLeader) {
            this._notifyHandlers(data.message as Record<string, unknown>);
        }
    }

    private _onWsConnected(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this._updateConnectionStatus('connected');
        }
    }

    private _onConnectionStatus(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this._updateConnectionStatus(data.status as 'connected' | 'disconnected' | 'reconnecting' | 'failed');
        }
    }

    private _onWsConnectionFailed(data: Record<string, unknown>): void {
        if (data.tabId !== this.tabId) {
            this.logger.error(`[${this.tabId}] Connection failed: ${data.message}`);
            this._updateConnectionStatus('failed');
        }
    }

    private async _connectWebSocket(): Promise<void> {
        if (!this.isLeader) {
            this.logger.warn(`[${this.tabId}] Not a leader, cannot connect WebSocket`);
            return;
        }
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            this.logger.debug?.(`[${this.tabId}] WebSocket already connecting/connected`);
            return;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsBaseUrl = WS_BASE_URL || `${protocol}//${window.location.host}`;
            const wsToken = await getChatWebSocketToken();
            const wsQuery = wsToken ? `?ws_token=${encodeURIComponent(wsToken)}` : '';
            const wsUrl = `${wsBaseUrl}/ws/chat/${this.userId}${wsQuery}`;

            this.logger.info(`[${this.tabId}] [CONNECT] Connecting WebSocket: ${wsUrl}`);
            this._updateConnectionStatus('reconnecting');

            this.ws = new WebSocket(wsUrl);
            this._setupWebSocketHandlers(this.ws);
        } catch (error) {
            this.logger.error(`[${this.tabId}] Failed to create WebSocket:`, error);
            this._updateConnectionStatus('failed');
        }
    }

    private _setupWebSocketHandlers(ws: WebSocket): void {
        ws.onopen = () => {
            this.logger.info(`[${this.tabId}] [OK] WebSocket connected`);
            this.reconnectAttempts = 0;
            this.lastWsHeartbeat = Date.now();
            this._updateConnectionStatus('connected');
            this._startWebSocketHeartbeat();
            this.channel?.postMessage({ type: 'ws_connected', tabId: this.tabId });
            this._reconcileState();
        };

        ws.onmessage = (event: MessageEvent<string>) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') {
                    this.lastWsHeartbeat = Date.now();
                    this.logger.debug?.(`[${this.tabId}] Received pong from server`);
                    return;
                }
                this.lastWsHeartbeat = Date.now();
                this._notifyHandlers(data);
                this.channel?.postMessage({ type: 'ws_message', message: data, tabId: this.tabId });
            } catch (error) {
                this.logger.error(`[${this.tabId}] Failed to parse message:`, error);
            }
        };

        ws.onerror = (error) => {
            this.logger.error(`[${this.tabId}] [ERROR] WebSocket error:`, error);
        };

        ws.onclose = () => {
            this.logger.warn(`[${this.tabId}] WebSocket closed`);
            this._stopWebSocketHeartbeat();
            this.ws = null;
            this._updateConnectionStatus('disconnected');
            this._handleWebSocketReconnection();
        };
    }

    private _handleWebSocketReconnection(): void {
        if (this.isLeader && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(
                WEBSOCKET_CONSTANTS.RECONNECT.INITIAL_DELAY *
                    Math.pow(WEBSOCKET_CONSTANTS.RECONNECT.BACKOFF_MULTIPLIER, this.reconnectAttempts),
                WEBSOCKET_CONSTANTS.RECONNECT.MAX_DELAY
            );
            this.reconnectAttempts++;
            this.logger.info(
                `[${this.tabId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            );

            this.reconnectTimeout = setTimeout(() => {
                if (this.isLeader) {
                    this._connectWebSocket();
                }
            }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error(`[${this.tabId}] Max reconnection attempts reached`);
            this._updateConnectionStatus('failed');
            this.channel?.postMessage({
                type: 'ws_connection_failed',
                tabId: this.tabId,
                message: 'Unable to connect to server. Please refresh the page.',
            });
        }
    }

    addMessageHandler(handler: MessageHandler): void {
        this.messageHandlers.add(handler);
    }

    removeMessageHandler(handler: MessageHandler): void {
        this.messageHandlers.delete(handler);
    }

    addConnectionStatusHandler(handler: ConnectionStatusHandler): void {
        this.connectionStatusHandlers.add(handler);
    }

    removeConnectionStatusHandler(handler: ConnectionStatusHandler): void {
        this.connectionStatusHandlers.delete(handler);
    }

    getConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'failed' {
        return this.connectionStatus;
    }

    private _updateConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting' | 'failed'): void {
        if (this.connectionStatus === status) {
            return;
        }
        this.connectionStatus = status;
        this.connectionStatusHandlers.forEach((handler) => {
            try {
                handler(status);
            } catch (error) {
                this.logger.error(`[${this.tabId}] Connection status handler error:`, error);
            }
        });

        // Broadcast status to other tabs
        this.channel?.postMessage({
            type: 'connection_status',
            status,
            tabId: this.tabId,
        });
    }

    private _notifyHandlers(message: Record<string, unknown>): void {
        this.messageHandlers.forEach((handler) => {
            try {
                handler(message);
            } catch (error) {
                this.logger.error(`[${this.tabId}] Handler error:`, error);
            }
        });
    }

    private _startWebSocketHeartbeat(): void {
        // Clear existing interval if any
        this._stopWebSocketHeartbeat();

        // Send ping every 30 seconds
        this.wsHeartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                    this.logger.debug?.(`[${this.tabId}] Sent ping to server`);

                    // Check if we received a response recently
                    const timeSinceLastHeartbeat = Date.now() - this.lastWsHeartbeat;
                    if (timeSinceLastHeartbeat > 60000) {
                        // 60 seconds without response
                        this.logger.warn(
                            `[${this.tabId}] No heartbeat response for ${timeSinceLastHeartbeat}ms, reconnecting...`
                        );
                        this.ws.close();
                    }
                } catch (error) {
                    this.logger.error(`[${this.tabId}] Failed to send ping:`, error);
                }
            }
        }, 30000); // 30 seconds
    }

    private _stopWebSocketHeartbeat(): void {
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
            this.wsHeartbeatInterval = null;
        }
    }

    private _reconcileState(): void {
        // Notify handlers that state should be reconciled
        this._notifyHandlers({
            type: 'state_reconciliation_required',
            timestamp: Date.now(),
        });

        this.logger.info(`[${this.tabId}] State reconciliation triggered`);
    }

    send(data: Record<string, unknown>): void {
        if (!this.isLeader) {
            this.logger.warn(`[${this.tabId}] Not a leader, cannot send message`);
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        } else {
            this.logger.warn(`[${this.tabId}] WebSocket not connected, cannot send message`);
        }
    }

    cleanup(): void {
        this.logger.info(`[${this.tabId}] Cleaning up...`);

        // Clear all intervals and timeouts
        if (this.leaderCheckInterval) {
            clearInterval(this.leaderCheckInterval);
            this.leaderCheckInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Resign as leader (this will also clear leader heartbeat and ws heartbeat)
        this._resignLeader();

        // Close broadcast channel
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }

        // Clear handlers
        this.messageHandlers.clear();
        this.connectionStatusHandlers.clear();
    }
}

let globalInstance: SharedWebSocketManager | null = null;

export const getSharedWebSocket = (userId: string | number): SharedWebSocketManager => {
    if (globalInstance && globalInstance.userId === userId) {
        return globalInstance;
    }
    if (globalInstance && globalInstance.userId !== userId) {
        globalInstance.cleanup();
        globalInstance = null;
    }
    if (!globalInstance) {
        globalInstance = new SharedWebSocketManager();
        globalInstance.init(userId);
    }
    return globalInstance;
};

export default getSharedWebSocket;
