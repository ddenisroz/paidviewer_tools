/**
 * Sync Progress Indicator - Shows progress during state reconciliation
 *
 * Displays a progress bar or spinner when syncing state with backend
 */
import React from 'react';

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAppTime } from '@/shared/utils/dateTime';

import { Progress } from './progress';

interface SyncProgressIndicatorProps {
    isReconciling: boolean;
    lastReconciliation?: Date | null;
    error?: Error | null;
    className?: string;
    variant?: 'inline' | 'banner' | 'toast';
}

export const SyncProgressIndicator: React.FC<SyncProgressIndicatorProps> = ({
    isReconciling,
    lastReconciliation,
    error,
    className,
    variant = 'inline',
}) => {
    if (!isReconciling && !error) {
        return null;
    }

    if (variant === 'banner') {
        return (
            <div
                className={cn(
                    'flex items-center justify-between gap-4 rounded-lg border px-4 py-3',
                    isReconciling && 'border-blue-500/20 bg-blue-500/10',
                    error && 'border-red-500/20 bg-red-500/10',
                    className
                )}
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-3">
                    {isReconciling && (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
                            <div>
                                <p className="text-sm font-medium text-blue-200">Синхронизация состояния...</p>
                                <p className="text-xs text-blue-300">Обновление данных с сервера</p>
                            </div>
                        </>
                    )}
                    {error && (
                        <>
                            <AlertCircle className="h-5 w-5 text-red-300" />
                            <div>
                                <p className="text-sm font-medium text-red-200">Ошибка синхронизации</p>
                                <p className="text-xs text-red-300">
                                    {error.message || 'Не удалось синхронизировать данные'}
                                </p>
                            </div>
                        </>
                    )}
                </div>
                {lastReconciliation && !isReconciling && !error && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span>Синхронизировано {formatAppTime(lastReconciliation)}</span>
                    </div>
                )}
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 text-sm',
                    isReconciling && 'text-blue-300',
                    error && 'text-red-300',
                    className
                )}
                role="status"
                aria-live="polite"
            >
                {isReconciling && (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Синхронизация...</span>
                    </>
                )}
                {error && (
                    <>
                        <AlertCircle className="h-4 w-4" />
                        <span>Ошибка синхронизации</span>
                    </>
                )}
            </div>
        );
    }

    // Toast variant (minimal)
    return (
        <div className={cn('flex items-center gap-2', className)} role="status" aria-live="polite">
            {isReconciling && (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Синхронизация...</span>
                </>
            )}
        </div>
    );
};

/**
 * Sync Progress Bar - Shows indeterminate progress during sync
 */
export const SyncProgressBar: React.FC<{
    isReconciling: boolean;
    className?: string;
}> = ({ isReconciling, className }) => {
    if (!isReconciling) {
        return null;
    }

    return (
        <div className={cn('w-full', className)}>
            <Progress value={undefined} className="h-1" />
            <p className="mt-2 text-center text-xs text-muted-foreground">Синхронизация данных...</p>
        </div>
    );
};

/**
 * Manual Sync Button - Allows user to trigger manual reconciliation
 */
export const ManualSyncButton: React.FC<{
    onSync: () => void;
    isReconciling: boolean;
    lastReconciliation?: Date | null;
    className?: string;
}> = ({ onSync, isReconciling, lastReconciliation, className }) => {
    return (
        <button
            onClick={onSync}
            disabled={isReconciling}
            className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                'border border-border bg-background/50 hover:bg-background/70',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-200',
                className
            )}
            aria-label="Синхронизировать данные"
        >
            <RefreshCw className={cn('h-4 w-4', isReconciling && 'animate-spin')} />
            <span>{isReconciling ? 'Синхронизация...' : 'Синхронизировать'}</span>
            {lastReconciliation && !isReconciling && (
                <span className="text-xs text-muted-foreground">
                    ({formatAppTime(lastReconciliation)})
                </span>
            )}
        </button>
    );
};

/**
 * Example usage:
 *
 * const { isReconciling, lastReconciliation, reconcileState } = useStateReconciliation({
 *   userId: user.id
 * });
 *
 * // Banner variant (prominent):
 * <SyncProgressIndicator
 *   isReconciling={isReconciling}
 *   lastReconciliation={lastReconciliation}
 *   variant="banner"
 * />
 *
 * // Inline variant (subtle):
 * <SyncProgressIndicator
 *   isReconciling={isReconciling}
 *   variant="inline"
 * />
 *
 * // Manual sync button:
 * <ManualSyncButton
 *   onSync={reconcileState}
 *   isReconciling={isReconciling}
 *   lastReconciliation={lastReconciliation}
 * />
 */
