// src/components/common/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        
        // Логирование ошибки
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <Card className="border-red-500/50 bg-red-900/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            Произошла ошибка
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-red-300">
                                Что-то пошло не так. Попробуйте обновить страницу или обратитесь к администратору.
                            </p>
                            
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                                        Детали ошибки (только в режиме разработки)
                                    </summary>
                                    <pre className="mt-2 text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-auto">
                                        {this.state.error.toString()}
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}
                            
                            <div className="flex gap-2">
                                <Button
                                    onClick={this.handleRetry}
                                    variant="outline"
                                    className="text-red-400 border-red-500 hover:bg-red-500/20"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Попробовать снова
                                </Button>
                                
                                <Button
                                    onClick={() => window.location.reload()}
                                    variant="outline"
                                >
                                    Обновить страницу
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

