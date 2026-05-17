import React, { Component, ErrorInfo, ReactNode } from 'react';

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

import { handleBoundaryError } from '@/shared/utils/errorUtils';
import { logger } from '@/shared/utils/prodLogger';

import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface Props {
    children: ReactNode;
    routeName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * RouteErrorBoundary - error boundary для отдельных роутов
 * Позволяет изолировать ошибки на уровне страниц
 */
class RouteErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(_error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const { routeName } = this.props;
        logger.error(`[ERROR] [RouteErrorBoundary] Error in route ${routeName || 'unknown'}:`, error);
        logger.error('[ERROR] [RouteErrorBoundary] Component stack:', errorInfo.componentStack);

        this.setState({ error });

        // Use centralized error handler
        handleBoundaryError(error, errorInfo);

        // Report to backend
        this.reportError(error, errorInfo);
    }

    reportError = async (error: Error, errorInfo: ErrorInfo): Promise<void> => {
        try {
            await fetch('/api/errors/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'route_error',
                    route: this.props.routeName || 'unknown',
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                }),
            }).catch(() => {});
        } catch {
            // Ignore
        }
    };

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    handleGoBack = (): void => {
        window.history.back();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const { error } = this.state;
            const { routeName } = this.props;
            const isDevelopment = import.meta.env.DEV;

            return (
                <div className="min-h-[60vh] flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                <CardTitle className="text-lg">Ошибка загрузки страницы</CardTitle>
                            </div>
                            <CardDescription>
                                {routeName
                                    ? `Не удалось загрузить страницу "${routeName}"`
                                    : 'Не удалось загрузить страницу'}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button onClick={this.handleReset} variant="default" size="sm">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Попробовать снова
                                </Button>
                                <Button onClick={this.handleGoBack} variant="outline" size="sm">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Назад
                                </Button>
                            </div>

                            {isDevelopment && error && (
                                <details className="mt-4 p-3 bg-muted rounded text-xs">
                                    <summary className="cursor-pointer font-medium">Детали ошибки</summary>
                                    <pre className="mt-2 p-2 bg-background rounded overflow-x-auto whitespace-pre-wrap">
                                        {error.toString()}
                                    </pre>
                                </details>
                            )}
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default RouteErrorBoundary;
