/**
 * ErrorState - Универсальное состояние ошибки
 *
 * Используется для отображения ошибок с возможностью повтора
 */

import React from 'react';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

export interface ErrorStateProps {
    title?: string;
    message: string;
    error?: Error | unknown;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
    showDetails?: boolean;
}

export function ErrorState({
    title = 'Произошла ошибка',
    message,
    error,
    onRetry,
    retryLabel = 'Повторить',
    className,
    showDetails = false,
}: ErrorStateProps) {
    const errorDetails = error instanceof Error ? error.message : String(error);

    return (
        <div className={cn('flex flex-col items-center justify-center p-8', className)}>
            <Alert variant="destructive" className="max-w-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription className="mt-2">
                    <p className="mb-4">{message}</p>

                    {showDetails && errorDetails && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-sm opacity-80 hover:opacity-100">
                                Технические детали
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-900/50 p-2 rounded overflow-x-auto">
                                {errorDetails}
                            </pre>
                        </details>
                    )}

                    {onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {retryLabel}
                        </Button>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    );
}
