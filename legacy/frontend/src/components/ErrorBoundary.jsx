import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { logger } from '../utils/prodLogger';

/**
 * ErrorBoundary - компонент для отлова React ошибок
 * Предотвращает White Screen of Death
 * 
 * Использование:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Обновляем state чтобы показать fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Логируем ошибку
    logger.error('🚨 [ErrorBoundary] React error caught:', error);
    logger.error('🚨 [ErrorBoundary] Error info:', errorInfo);
    
    // Сохраняем детали для отображения
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Отправить в error reporting service (Sentry, LogRocket, etc.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: { react: { componentStack: errorInfo.componentStack } }
    //   });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Что-то пошло не так</CardTitle>
              </div>
              <CardDescription>
                Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернуться на главную.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Действия */}
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Перезагрузить страницу
                </Button>
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="mr-2 h-4 w-4" />
                  На главную
                </Button>
              </div>

              {/* Детали ошибки (только в dev режиме) */}
              {isDevelopment && error && (
                <details className="mt-4 p-4 bg-muted rounded-lg text-sm">
                  <summary className="cursor-pointer font-medium mb-2">
                    Детали ошибки (только для разработчиков)
                  </summary>
                  
                  <div className="space-y-2 mt-2">
                    <div>
                      <strong className="text-destructive">Ошибка:</strong>
                      <pre className="mt-1 p-2 bg-background rounded overflow-x-auto text-xs">
                        {error.toString()}
                      </pre>
                    </div>
                    
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

              {/* Помощь */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>Если проблема повторяется:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Очистите кэш браузера (Ctrl+Shift+Delete)</li>
                  <li>Попробуйте другой браузер</li>
                  <li>Свяжитесь с поддержкой через раздел "Поддержка"</li>
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

/**
 * Функциональная обёртка для удобства
 * Позволяет использовать с fallback prop
 */
export const withErrorBoundary = (Component, fallback) => {
  return (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;

