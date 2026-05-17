/**
 * Task 6.5: WebSocket State Synchronization Hook
 *
 * Handles state reconciliation when WebSocket reconnects
 * Invalidates React Query caches to fetch fresh data from backend
 */

import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/queries';
import Logger from '@/shared/utils/prodLogger';
import getSharedWebSocket from '@/shared/utils/sharedWebSocket';

const logger = new Logger('WS_STATE_SYNC');

export const useWebSocketStateSync = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>(
        'disconnected'
    );
    const lastLoggedStatusRef = useRef<'connected' | 'disconnected' | 'reconnecting' | 'failed' | null>(null);
    const lastLogAtRef = useRef<number>(0);

    // Dedupe mechanism to prevent multiple reconciliation triggers
    const isReconcilingRef = useRef(false);
    const reconcileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastReconcileAtRef = useRef<number>(0);
    const reconcileMinIntervalMs = 10_000;

    // ANTI-DOUBLE-FETCH: Запоминаем время монтирования компонента
    // Если WebSocket подключается сразу после загрузки страницы,
    // мы не хотим делать повторный запрос данных, так как они только что были загружены
    const mountTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!user?.id) return;

        const ws = getSharedWebSocket(user.id);

        // Debounced state reconciliation to batch multiple triggers
        const triggerReconciliation = () => {
            // Clear any pending trigger
            if (reconcileTimeoutRef.current) {
                clearTimeout(reconcileTimeoutRef.current);
            }

            // Debounce by 100ms to batch multiple triggers
            reconcileTimeoutRef.current = setTimeout(async () => {
                // Skip if already reconciling
                if (isReconcilingRef.current) {
                    logger.debug('Skipping reconciliation - already in progress');
                    return;
                }

                // ANTI-DOUBLE-FETCH: Проверяем, сколько времени прошло с загрузки
                const timeSinceMount = Date.now() - mountTimeRef.current;
                if (timeSinceMount < 5000) {
                    logger.info(`[SKIP] State reconciliation skipped - app just loaded (${timeSinceMount}ms)`);
                    setSyncStatus('synced'); // Считаем что все ок
                    return;
                }

                const now = Date.now();
                const sinceLastReconcile = now - lastReconcileAtRef.current;
                if (sinceLastReconcile < reconcileMinIntervalMs) {
                    logger.debug(`[SKIP] State reconciliation throttled (${sinceLastReconcile}ms since last)`);
                    return;
                }

                isReconcilingRef.current = true;
                lastReconcileAtRef.current = now;
                logger.info('State reconciliation triggered - invalidating critical queries');
                setSyncStatus('syncing');

                try {
                    // Invalidate only critical query groups (avoid global refetch storms)
                    const criticalKeys = [
                        queryKeys.userSettings.all,
                        queryKeys.stream.all,
                        queryKeys.youtube.all,
                        queryKeys.tts.all,
                        queryKeys.chat.status(),
                        queryKeys.drops.all,
                        queryKeys.integrations.all,
                    ];

                    await Promise.all(
                        criticalKeys.map((queryKey) =>
                            queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
                        )
                    );

                    // Wait a bit for queries to refetch
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    setSyncStatus('synced');
                    logger.info(`State reconciliation complete ${user.id}`);

                    // Reset status after 2 seconds
                    setTimeout(() => setSyncStatus('idle'), 2000);
                } catch (error) {
                    logger.error('State reconciliation failed:', error);
                    setSyncStatus('error');
                    setTimeout(() => setSyncStatus('idle'), 3000);
                } finally {
                    isReconcilingRef.current = false;
                }
            }, 100);
        };

        // Handle state reconciliation messages from WebSocket
        const handleStateReconciliation = (message: Record<string, unknown>) => {
            if (message.type === 'state_reconciliation_required') {
                triggerReconciliation();
            }
        };

        // Handle connection status changes
        const handleConnectionStatus = (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => {
            const now = Date.now();
            const lastStatus = lastLoggedStatusRef.current;
            const shouldLog =
                status !== lastStatus &&
                (now - lastLogAtRef.current > 1500 || status === 'failed' || status === 'disconnected');
            if (shouldLog) {
                logger.info(`Connection status changed: ${status}`);
                lastLoggedStatusRef.current = status;
                lastLogAtRef.current = now;
            }
            setConnectionStatus(status);

            // Connection restored - trigger reconciliation (debounced)
            if (status === 'connected') {
                triggerReconciliation();
            } else if (status === 'failed') {
                logger.error('Connection failed - please refresh the page');
            }
        };

        // Add handlers
        ws.addMessageHandler(handleStateReconciliation);
        ws.addConnectionStatusHandler(handleConnectionStatus);

        // Get initial connection status
        setConnectionStatus(ws.getConnectionStatus());

        // Cleanup
        return () => {
            ws.removeMessageHandler(handleStateReconciliation);
            ws.removeConnectionStatusHandler(handleConnectionStatus);
            if (reconcileTimeoutRef.current) {
                clearTimeout(reconcileTimeoutRef.current);
            }
        };
    }, [user?.id, queryClient]);

    return {
        syncStatus,
        connectionStatus,
        isSyncing: syncStatus === 'syncing',
        isConnected: connectionStatus === 'connected',
        isReconnecting: connectionStatus === 'reconnecting',
        isFailed: connectionStatus === 'failed',
    };
};
