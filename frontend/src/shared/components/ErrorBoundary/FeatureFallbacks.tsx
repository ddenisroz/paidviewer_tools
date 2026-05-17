import React from 'react';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

/**
 * Fallback UI components for critical features
 */

export const TtsFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                TTS временно недоступен
            </CardTitle>
            <CardDescription>Произошла ошибка при загрузке TTS системы</CardDescription>
        </CardHeader>
        <CardContent>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Попробовать снова
                </Button>
            )}
        </CardContent>
    </Card>
);

export const DropsFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Drops временно недоступны
            </CardTitle>
            <CardDescription>Произошла ошибка при загрузке системы дропов</CardDescription>
        </CardHeader>
        <CardContent>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Попробовать снова
                </Button>
            )}
        </CardContent>
    </Card>
);

export const YouTubeFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                YouTube плеер недоступен
            </CardTitle>
            <CardDescription>Произошла ошибка при загрузке YouTube интеграции</CardDescription>
        </CardHeader>
        <CardContent>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Попробовать снова
                </Button>
            )}
        </CardContent>
    </Card>
);

export const ChatFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ошибка чата</AlertTitle>
        <AlertDescription className="mt-2">
            <p>Не удалось загрузить чат</p>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm" className="mt-2">
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Попробовать снова
                </Button>
            )}
        </AlertDescription>
    </Alert>
);

export const PointsFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Система поинтов недоступна
            </CardTitle>
            <CardDescription>Произошла ошибка при загрузке системы поинтов</CardDescription>
        </CardHeader>
        <CardContent>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Попробовать снова
                </Button>
            )}
        </CardContent>
    </Card>
);

export const CommandsFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Команды недоступны
            </CardTitle>
            <CardDescription>Произошла ошибка при загрузке системы команд</CardDescription>
        </CardHeader>
        <CardContent>
            {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Попробовать снова
                </Button>
            )}
        </CardContent>
    </Card>
);
