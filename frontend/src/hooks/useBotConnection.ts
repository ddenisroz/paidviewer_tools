// src/hooks/useBotConnection.ts
/**
 * Хук для управления подключением бота к каналам.
 * Отвечает за: connect/disconnect, статус бота, React Query mutations.
 */
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '../components/ui/toast';
import { useBotStatus, useConnectBot, useDisconnectBot } from '../queries/chat/chatQueries';
import { logger } from '../utils/prodLogger';

type BotStatusType = 'connected' | 'disconnected';

interface UseBotConnectionOptions {
    isAuthenticated: boolean;
    isCheckingAuth?: boolean;
}

interface UseBotConnectionReturn {
    botStatus: BotStatusType;
    setBotStatus: (status: BotStatusType) => void;
    connectBotToChannels: (platforms?: string[]) => Promise<void>;
    disconnectBotFromChannels: () => Promise<void>;
    getBotConnectionStatus: () => Promise<{ status: BotStatusType; [key: string]: unknown }>;
}

export function useBotConnection({ 
    isAuthenticated, 
    isCheckingAuth = false 
}: UseBotConnectionOptions): UseBotConnectionReturn {
    const { addToast } = useToast();
    const [botStatus, setBotStatus] = useState<BotStatusType>('disconnected');

    // React Query for bot status
    const { data: botStatusData, error: botStatusError, refetch: refetchBotStatus } = useBotStatus({
        enabled: !!isAuthenticated,
        refetchInterval: 30000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // Update status from query data
    useEffect(() => {
        if (botStatusData) {
            const statusResponse = (botStatusData as { data?: { connected?: boolean } })?.data || 
                                   botStatusData as { connected?: boolean };
            setBotStatus(statusResponse.connected ? 'connected' : 'disconnected');
        }
    }, [botStatusData]);

    // Handle query errors
    useEffect(() => {
        if (botStatusError) {
            logger.error('Error getting bot status:', botStatusError);
            setBotStatus('disconnected');
        }
    }, [botStatusError]);

    // Connect mutation
    const connectBotMutation = useConnectBot({
        onSuccess: (response: unknown) => {
            const responseData = response as { data?: { success?: boolean } };
            if (responseData.data?.success) {
                setBotStatus('connected');
                addToast({
                    type: 'success',
                    title: 'Бот подключен',
                    message: 'Бот успешно подключен'
                });
            }
        },
        onError: (error) => {
            logger.error('Error connecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка подключения',
                message: 'Не удалось подключить бота к каналам'
            });
        },
    });

    // Disconnect mutation
    const disconnectBotMutation = useDisconnectBot({
        onSuccess: (response: unknown) => {
            const responseData = response as { data?: { success?: boolean } };
            if (responseData.data?.success) {
                setBotStatus('disconnected');
                addToast({
                    type: 'success',
                    title: 'Бот отключен',
                    message: 'Бот успешно отключен от всех каналов'
                });
            }
        },
        onError: (error) => {
            logger.error('Error disconnecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка отключения',
                message: 'Не удалось отключить бота от каналов'
            });
        },
    });

    const connectBotToChannels = useCallback(async (_platforms: string[] = []): Promise<void> => {
        if (!isAuthenticated) return;
        connectBotMutation.mutate();
    }, [isAuthenticated, connectBotMutation]);

    const disconnectBotFromChannels = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) return;
        disconnectBotMutation.mutate();
    }, [isAuthenticated, disconnectBotMutation]);

    const getBotConnectionStatus = useCallback(async (): Promise<{ status: BotStatusType; [key: string]: unknown }> => {
        if (!isAuthenticated) return { status: 'disconnected' };
        
        const result = await refetchBotStatus();
        const statusResponse = (result.data as { data?: Record<string, unknown> })?.data || 
                               result.data as unknown as Record<string, unknown>;
        
        if (statusResponse && typeof statusResponse === 'object' && 'connected' in statusResponse && statusResponse.connected) {
            setBotStatus('connected');
            return { status: 'connected', ...(statusResponse as Record<string, unknown>) };
        } else {
            setBotStatus('disconnected');
            return { status: 'disconnected', ...(statusResponse as Record<string, unknown> || {}) };
        }
    }, [isAuthenticated, refetchBotStatus]);

    // Initial status check
    useEffect(() => {
        if (isAuthenticated && !isCheckingAuth) {
            getBotConnectionStatus();
        }
    }, [isAuthenticated, isCheckingAuth, getBotConnectionStatus]);

    return {
        botStatus,
        setBotStatus,
        connectBotToChannels,
        disconnectBotFromChannels,
        getBotConnectionStatus
    };
}

export type { BotStatusType };
