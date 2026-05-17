import React, { Component, ErrorInfo, ReactNode } from 'react';

import { AlertCircle, Home, RefreshCw } from 'lucide-react';

import { handleBoundaryError } from '@/shared/utils/errorUtils';
import { logger } from '@/shared/utils/prodLogger';

import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * AppErrorBoundary - глобальный error boundary для всего приложения
 * Ловит критические ошибки, которые могут сломать всё приложение
 */
class AppErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(_error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        logger.error('[CRITICAL] [AppErrorBoundary] Critical application error:', error);
        logger.error('[CRITICAL] [AppErrorBoundary] Error info:', errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // Use centralized error handler
        handleBoundaryError(error, errorInfo);

        // Send to error tracking service
        this.reportError(error, errorInfo);
    }

    reportError = async (error: Error, errorInfo: ErrorInfo): Promise<void> => {
        try {
            // Send error to backend for logging
            await fetch('/api/errors/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'react_error',
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                }),
            }).catch(() => {
                // Silently fail if error reporting fails
                logger.warn('[AppErrorBoundary] Failed to report error to backend');
            });
        } catch {
            // Ignore errors in error reporting
        }
    };

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const { error, errorInfo } = this.state;
            const isDevelopment = import.meta.env.DEV;

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="w-full max-w-2xl">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-6 w-6 text-destructive" />
                                <CardTitle>Критическая ошибка приложения</CardTitle>
                            </div>
                            <CardDescription>
                                Произошла непредвиденная ошибка. Приложение не может продолжить работу.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button onClick={this.handleReload} variant="default">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Перезагрузить страницу
                                </Button>
                                <Button onClick={this.handleGoHome} variant="outline">
                                    <Home className="mr-2 h-4 w-4" />
                                    На главную
                                </Button>
                            </div>

                            {isDevelopment && error && (
                                <details className="mt-4 p-4 bg-muted rounded-lg text-sm">
                                    <summary className="cursor-pointer font-medium mb-2">
                                        Детали ошибки (dev mode)
                                    </summary>

                                    <div className="space-y-2 mt-2">
                                        <div>
                                            <strong className="text-destructive">Error:</strong>
                                            <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs">
                                                {error.toString()}
                                            </pre>
                                        </div>

                                        {error.stack && (
                                            <div>
                                                <strong className="text-destructive">Stack:</strong>
                                                <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs whitespace-pre-wrap">
                                                    {error.stack}
                                                </pre>
                                            </div>
                                        )}

                                        {errorInfo && (
                                            <div>
                                                <strong className="text-destructive">Component Stack:</strong>
                                                <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs whitespace-pre-wrap">
                                                    {errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                                <p>Если проблема повторяется:</p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Очистите кэш браузера (Ctrl+Shift+Delete)</li>
                                    <li>Попробуйте другой браузер</li>
                                    <li>Свяжитесь с поддержкой</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
