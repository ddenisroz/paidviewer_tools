import { useEffect, useRef } from 'react';

import { WEBSOCKET_CONSTANTS } from '@/constants/websocket';
import { getWebSocketBaseUrl } from '@/shared/utils/urlUtils';

type OverlayMessageHandler = (message: Record<string, unknown>) => void;

export function useChatOverlayWebSocket(token: string | null, onMessage: OverlayMessageHandler): void {
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        const cleanedToken = token?.trim() ?? '';
        if (!cleanedToken) return;

        let ws: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        let reconnectAttempts = 0;
        let lastHeartbeatAt = Date.now();
        let closedByHook = false;

        const stopHeartbeat = () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        };

        const scheduleReconnect = () => {
            if (closedByHook || reconnectAttempts >= WEBSOCKET_CONSTANTS.RECONNECT.MAX_ATTEMPTS) {
                return;
            }

            const delay = Math.min(
                WEBSOCKET_CONSTANTS.RECONNECT.INITIAL_DELAY *
                    Math.pow(WEBSOCKET_CONSTANTS.RECONNECT.BACKOFF_MULTIPLIER, reconnectAttempts),
                WEBSOCKET_CONSTANTS.RECONNECT.MAX_DELAY
            );
            reconnectAttempts += 1;
            reconnectTimer = setTimeout(connect, delay);
        };

        const startHeartbeat = () => {
            stopHeartbeat();
            heartbeatTimer = setInterval(() => {
                if (!ws || ws.readyState !== WebSocket.OPEN) return;

                if (Date.now() - lastHeartbeatAt > 60000) {
                    ws.close();
                    return;
                }

                ws.send(JSON.stringify({ type: 'ping' }));
            }, 30000);
        };

        function connect() {
            if (closedByHook) return;

            const wsUrl = `${getWebSocketBaseUrl()}/ws/chat-overlay/${encodeURIComponent(cleanedToken)}`;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                reconnectAttempts = 0;
                lastHeartbeatAt = Date.now();
                startHeartbeat();
            };

            ws.onmessage = (event: MessageEvent<string>) => {
                try {
                    const payload = JSON.parse(event.data) as Record<string, unknown>;
                    if (payload.type === 'pong') {
                        lastHeartbeatAt = Date.now();
                        return;
                    }
                    lastHeartbeatAt = Date.now();
                    onMessageRef.current(payload);
                } catch {
                    // Ignore malformed frames; the overlay should stay transparent in OBS.
                }
            };

            ws.onclose = () => {
                stopHeartbeat();
                scheduleReconnect();
            };

            ws.onerror = () => {
                ws?.close();
            };
        }

        connect();

        return () => {
            closedByHook = true;
            stopHeartbeat();
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
        };
    }, [token]);
}
