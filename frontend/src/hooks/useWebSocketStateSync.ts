/**
 * Task 6.5: WebSocket State Synchronization Hook
 * 
 * Handles state reconciliation when WebSocket reconnects
 * Invalidates React Query caches to fetch fresh data from backend
 */

import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import Logger from '../utils/prodLogger';
import getSharedWebSocket from '../utils/sharedWebSocket';

const logger = new Logger('WS_STATE_SYNC');

export const useWebSocketStateSync = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');

  useEffect(() => {
    if (!user?.id) return;

    const ws = getSharedWebSocket(user.id);

    // Handle state reconciliation messages
    const handleStateReconciliation = async (message: Record<string, unknown>) => {
      if (message.type === 'state_reconciliation_required') {
        logger.info('State reconciliation triggered - invalidating all queries');
        setSyncStatus('syncing');

        try {
          // Invalidate all queries to fetch fresh data
          await queryClient.invalidateQueries();
          
          // Wait a bit for queries to refetch
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setSyncStatus('synced');
          logger.info('State reconciliation complete');
          
          // Reset status after 2 seconds
          setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (error) {
          logger.error('State reconciliation failed:', error);
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
      }
    };

    // Handle connection status changes
    const handleConnectionStatus = (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => {
      logger.info(`Connection status changed: ${status}`);
      setConnectionStatus(status);
      
      // Show user-friendly notifications
      if (status === 'connected') {
        // Connection restored - trigger reconciliation
        handleStateReconciliation({ type: 'state_reconciliation_required' });
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
