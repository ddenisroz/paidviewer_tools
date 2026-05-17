/**
 * useStateReconciliation - Hook for reconciling state after WebSocket reconnection
 *
 * Fetches fresh state from backend when WebSocket reconnects
 * Invalidates stale queries and shows sync progress
 */
import { useCallback, useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/queries/queryKeys';
import { logger } from '@/shared/utils/prodLogger';
import { getSharedWebSocket } from '@/shared/utils/sharedWebSocket';

interface StateReconciliationOptions {
    /**
     * User ID for WebSocket connection
     */
    userId: string | number;

    /**
     * Whether to show toast notifications (default: true)
     */
    showNotifications?: boolean;

    /**
     * Queries to invalidate on reconnection
     * If not provided, invalidates all queries
     */
    queriesToInvalidate?: unknown[][];

    /**
     * Callback when reconciliation starts
     */
    onReconciliationStart?: () => void;

    /**
     * Callback when reconciliation completes
     */
    onReconciliationComplete?: () => void;

    /**
     * Callback when reconciliation fails
     */
    onReconciliationError?: (error: Error) => void;
}

export const useStateReconciliation = (options: StateReconciliationOptions) => {
    const {
        userId,
        showNotifications = true,
        queriesToInvalidate,
        onReconciliationStart,
        onReconciliationComplete,
        onReconciliationError,
    } = options;

    const queryClient = useQueryClient();
    const [isReconciling, setIsReconciling] = useState(false);
    const [lastReconciliation, setLastReconciliation] = useState<Date | null>(null);

    const reconcileState = useCallback(async () => {
        try {
            setIsReconciling(true);
            onReconciliationStart?.();

            logger.info('Starting state reconciliation...');

            if (showNotifications) {
                toast.info('Синхронизация состояния...', {
                    id: 'state-reconciliation',
                });
            }

            // Invalidate specified queries or all queries
            if (queriesToInvalidate && queriesToInvalidate.length > 0) {
                // Invalidate specific queries
                await Promise.all(queriesToInvalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
            } else {
                // Invalidate all queries
                await queryClient.invalidateQueries();
            }

            // Wait for queries to refetch
            await queryClient.refetchQueries();

            setLastReconciliation(new Date());
            onReconciliationComplete?.();

            logger.info('State reconciliation completed');

            if (showNotifications) {
                toast.success('Состояние синхронизировано', {
                    id: 'state-reconciliation',
                });
            }
        } catch (error) {
            logger.error('State reconciliation failed:', error);
            onReconciliationError?.(error as Error);

            if (showNotifications) {
                toast.error('Ошибка синхронизации состояния', {
                    id: 'state-reconciliation',
                });
            }
        } finally {
            setIsReconciling(false);
        }
    }, [
        queryClient,
        queriesToInvalidate,
        showNotifications,
        onReconciliationStart,
        onReconciliationComplete,
        onReconciliationError,
    ]);

    // Listen for WebSocket reconnection
    useEffect(() => {
        if (!userId) return;

        const ws = getSharedWebSocket(userId);

        const handleConnectionStatus = (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => {
            if (status === 'connected' && lastReconciliation) {
                // Only reconcile if we were previously connected
                // (not on initial connection)
                const timeSinceLastReconciliation = Date.now() - lastReconciliation.getTime();

                // Reconcile if more than 5 seconds since last reconciliation
                if (timeSinceLastReconciliation > 5000) {
                    logger.info('WebSocket reconnected, triggering state reconciliation');
                    reconcileState();
                }
            }
        };

        const handleStateReconciliationRequired = (message: Record<string, unknown>) => {
            if (message.type === 'state_reconciliation_required') {
                logger.info('State reconciliation requested by server');
                reconcileState();
            }
        };

        ws.addConnectionStatusHandler(handleConnectionStatus);
        ws.addMessageHandler(handleStateReconciliationRequired);

        return () => {
            ws.removeConnectionStatusHandler(handleConnectionStatus);
            ws.removeMessageHandler(handleStateReconciliationRequired);
        };
    }, [userId, reconcileState, lastReconciliation]);

    return {
        isReconciling,
        lastReconciliation,
        reconcileState,
    };
};

/**
 * Hook for critical queries that need immediate reconciliation
 */
export const useCriticalStateReconciliation = (userId: string | number) => {
    return useStateReconciliation({
        userId,
        showNotifications: true,
        queriesToInvalidate: [
            [...queryKeys.userSettings.settings()],
            [...queryKeys.tts.settings()],
            [...queryKeys.tts.status(null)],
            [...queryKeys.stream.twitchInfo()],
            [...queryKeys.stream.vkInfo()],
        ],
    });
};

/**
 * Example usage:
 *
 * // In App.tsx or a top-level component:
 * const { isReconciling, reconcileState } = useStateReconciliation({
 *   userId: user.id,
 *   showNotifications: true,
 *   onReconciliationComplete: () => {
 *     console.log('State reconciled successfully');
 *   }
 * });
 *
 * // Show reconciliation status:
 * {isReconciling && <div>Syncing...</div>}
 *
 * // Manual reconciliation:
 * <button onClick={reconcileState}>Sync Now</button>
 */
