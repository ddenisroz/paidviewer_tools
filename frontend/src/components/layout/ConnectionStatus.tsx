/**
 * Task 6.5: Connection Status Component
 * 
 * Displays WebSocket connection status and sync progress to the user
 */

import React from 'react';
import { useWebSocketStateSync } from '../../hooks/useWebSocketStateSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { syncStatus, connectionStatus, isSyncing, isConnected, isReconnecting, isFailed } = useWebSocketStateSync();

  // Don't show anything when connected and not syncing
  if (isConnected && syncStatus === 'idle') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Reconnecting */}
      {isReconnecting && (
        <div className="flex items-center gap-2 bg-yellow-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Reconnecting...</span>
        </div>
      )}

      {/* Connection Failed */}
      {isFailed && (
        <div className="flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <WifiOff className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Connection Failed</span>
            <span className="text-xs opacity-90">Please refresh the page</span>
          </div>
        </div>
      )}

      {/* Syncing State */}
      {isSyncing && (
        <div className="flex items-center gap-2 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Syncing state...</span>
        </div>
      )}

      {/* Synced */}
      {syncStatus === 'synced' && (
        <div className="flex items-center gap-2 bg-green-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Connected & Synced</span>
        </div>
      )}

      {/* Sync Error */}
      {syncStatus === 'error' && (
        <div className="flex items-center gap-2 bg-orange-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Sync failed - retrying...</span>
        </div>
      )}
    </div>
  );
};
