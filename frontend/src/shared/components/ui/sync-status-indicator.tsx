/**
 * Sync Status Indicator - Shows synchronization status between frontend and backend
 *
 * Displays visual feedback when:
 * - Data is being saved (syncing)
 * - Data is successfully synced
 * - Data is out of sync (error)
 */
/* eslint-disable react-refresh/only-export-components */
import React from 'react';

import { AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
    status: SyncStatus;
    message?: string;
    className?: string;
    showLabel?: boolean;
}

const statusConfig = {
    idle: {
        icon: null,
        label: '',
        className: 'text-muted-foreground',
    },
    syncing: {
        icon: Loader2,
        label: 'Сохранение...',
        className: 'text-blue-500 animate-spin',
    },
    synced: {
        icon: CheckCircle2,
        label: 'Сохранено',
        className: 'text-green-500',
    },
    error: {
        icon: AlertCircle,
        label: 'Ошибка синхронизации',
        className: 'text-red-500',
    },
    offline: {
        icon: WifiOff,
        label: 'Нет соединения',
        className: 'text-orange-500',
    },
};

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
    status,
    message,
    className,
    showLabel = true,
}) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    if (status === 'idle') {
        return null;
    }

    return (
        <div
            className={cn('flex items-center gap-2 text-sm transition-all duration-200', className)}
            role="status"
            aria-live="polite"
        >
            {Icon && <Icon className={cn('h-4 w-4', config.className)} />}
            {showLabel && <span className={config.className}>{message || config.label}</span>}
        </div>
    );
};

/**
 * Compact version for inline display
 */
export const SyncStatusBadge: React.FC<SyncStatusIndicatorProps> = ({ status, message, className }) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    if (status === 'idle') {
        return null;
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                status === 'syncing' && 'bg-blue-50 text-blue-700',
                status === 'synced' && 'bg-green-50 text-green-700',
                status === 'error' && 'bg-red-50 text-red-700',
                status === 'offline' && 'bg-orange-50 text-orange-700',
                className
            )}
            role="status"
            aria-live="polite"
        >
            {Icon && <Icon className={cn('h-3 w-3', config.className)} />}
            <span>{message || config.label}</span>
        </div>
    );
};

/**
 * Hook to manage sync status with auto-hide
 */
export const useSyncStatus = (autoHideDelay = 2000) => {
    const [status, setStatus] = React.useState<SyncStatus>('idle');
    const [message, setMessage] = React.useState<string | undefined>();
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const updateStatus = React.useCallback(
        (newStatus: SyncStatus, newMessage?: string) => {
            setStatus(newStatus);
            setMessage(newMessage);

            // Auto-hide success status after delay
            if (newStatus === 'synced' && autoHideDelay > 0) {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                    setStatus('idle');
                    setMessage(undefined);
                }, autoHideDelay);
            }
        },
        [autoHideDelay]
    );

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        status,
        message,
        updateStatus,
    };
};
