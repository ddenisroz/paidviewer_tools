/**
 * Task 6.5: Connection Status Component
 *
 * Displays WebSocket connection status and sync progress to the user
 */

import React from 'react';

import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

import { useWebSocketStateSync } from '@/shared/hooks/useWebSocketStateSync';

export const ConnectionStatus: React.FC = () => {
    const { syncStatus, isReconnecting, isFailed } = useWebSocketStateSync();

    // Determine state
    let icon = <Wifi className="w-5 h-5" />;
    let colorClass = 'bg-green-500/80 hover:bg-green-500';
    let text = 'Online';

    if (isReconnecting) {
        icon = <RefreshCw className="w-4 h-4 animate-spin" />;
        colorClass = 'bg-yellow-500/80 hover:bg-yellow-500';
        text = 'Reconnecting...';
    } else if (isFailed) {
        icon = <WifiOff className="w-5 h-5" />;
        colorClass = 'bg-red-500/80 hover:bg-red-500';
        text = 'Connection Failed';
    } else if (syncStatus === 'syncing') {
        icon = <RefreshCw className="w-4 h-4 animate-spin" />;
        colorClass = 'bg-blue-500/80 hover:bg-blue-500';
        text = 'Syncing...';
    } else if (syncStatus === 'error') {
        icon = <AlertCircle className="w-5 h-5" />;
        colorClass = 'bg-orange-500/80 hover:bg-orange-500';
        text = 'Sync Error';
    } else if (syncStatus === 'synced') {
        // Connected & Synced
        icon = <Wifi className="w-4 h-4" />;
        colorClass = 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/30';
        text = 'Connected';
    } else {
        // Default connected but idle
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 group">
            <div
                className={`
          flex items-center gap-2 px-2 py-2 rounded-full transition-all duration-300 ease-in-out
      cursor-help shadow-sm
          w-8 h-8 group-hover:w-auto group-hover:px-3 overflow-hidden
          ${colorClass}
        `}
                title={text}
            >
                <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">{icon}</div>
                <span className="text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75 max-w-0 group-hover:max-w-[200px]">
                    {text}
                </span>
            </div>
        </div>
    );
};
