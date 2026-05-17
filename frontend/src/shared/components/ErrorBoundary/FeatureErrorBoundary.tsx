import React, { Component, ErrorInfo, ReactNode } from 'react';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { handleBoundaryError } from '@/shared/utils/errorUtils';
import { logger } from '@/shared/utils/prodLogger';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

interface Props {
    children: ReactNode;
    featureName: string;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * FeatureErrorBoundary - error boundary для критических компонентов
 * Используется для TTS, Drops, YouTube и других важных фич
 * Позволяет изолировать ошибки без поломки всей страницы
 */
class FeatureErrorBoundary extends Component<Props, State> {
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
        const { featureName } = this.props;
        logger.error(`[WARN] [FeatureErrorBoundary] Error in feature "${featureName}":`, error);
        logger.error('[WARN] [FeatureErrorBoundary] Component stack:', errorInfo.componentStack);

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
                    type: 'feature_error',
                    feature: this.props.featureName,
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

    render(): ReactNode {
        if (this.state.hasError) {
            const { featureName, fallback } = this.props;
            const { error } = this.state;
            const isDevelopment = import.meta.env.DEV;

            // Use custom fallback if provided
            if (fallback) {
                return fallback;
            }

            // Default fallback UI
            return (
                <Alert variant="destructive" className="my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ошибка в компоненте "{featureName}"</AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                        <p>Этот компонент временно недоступен из-за ошибки.</p>
                        <Button onClick={this.handleReset} variant="outline" size="sm" className="mt-2">
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Попробовать снова
                        </Button>

                        {isDevelopment && error && (
                            <details className="mt-3 text-xs">
                                <summary className="cursor-pointer">Детали ошибки</summary>
                                <pre className="mt-2 p-2 bg-background rounded overflow-x-auto whitespace-pre-wrap">
                                    {error.toString()}
                                </pre>
                            </details>
                        )}
                    </AlertDescription>
                </Alert>
            );
        }

        return this.props.children;
    }
}

export default FeatureErrorBoundary;
