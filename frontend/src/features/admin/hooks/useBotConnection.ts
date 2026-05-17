import { useCallback, useEffect, useState } from 'react';

import { useBotStatus, useConnectBot, useDisconnectBot } from '@/queries/chat/chatQueries';
import { useToast } from '@/shared/components/ui/toast';
import { logger } from '@/shared/utils/prodLogger';

type BotStatusType = 'connected' | 'disconnected';

interface PlatformBotStatus {
    connected?: boolean;
    ready?: boolean;
    reason?: string | null;
    action?: string | null;
    bot_oauth?: {
        configured?: boolean;
        expired?: boolean;
        login?: string | null;
        auth_path?: string | null;
    };
}

interface BotStatusPayload {
    connected?: boolean;
    ready?: boolean;
    success?: boolean;
    code?: string;
    message?: string;
    action?: string | null;
    twitch?: PlatformBotStatus;
    vk?: PlatformBotStatus;
    status?: BotStatusPayload;
    data?: BotStatusPayload;
}

interface UseBotConnectionOptions {
    isAuthenticated: boolean;
    isCheckingAuth?: boolean;
    pollingInterval?: number | false;
    pollingEnabled?: boolean;
}

interface UseBotConnectionReturn {
    botStatus: BotStatusType;
    setBotStatus: (status: BotStatusType) => void;
    connectBotToChannels: (platforms?: string[]) => Promise<void>;
    disconnectBotFromChannels: () => Promise<void>;
    getBotConnectionStatus: () => Promise<{ status: BotStatusType; [key: string]: unknown }>;
}

const getPayload = (response: unknown): BotStatusPayload => {
    const payload = response as BotStatusPayload | undefined;
    return payload?.data ?? payload ?? {};
};

const getStatusPayload = (response: unknown): BotStatusPayload => {
    const payload = getPayload(response);
    return payload.status ?? payload;
};

const getStatusFromPayload = (payload: BotStatusPayload): BotStatusType => {
    return payload.connected && payload.ready !== false ? 'connected' : 'disconnected';
};

const getBotMessage = (payload: BotStatusPayload): string => {
    if (payload.message) return payload.message;

    const problem = payload.twitch?.reason ?? payload.vk?.reason ?? payload.code;
    const messages: Record<string, string> = {
        platform_not_connected: 'Сначала подключите Twitch или VK Live.',
        bot_oauth_missing: 'Нужно подключить отдельную авторизацию бота.',
        bot_oauth_expired: 'Авторизация бота истекла, подключите ее заново.',
        bot_runtime_offline: 'Сервис бота сейчас не запущен.',
        channel_not_joined: 'Бот еще не присоединился к каналу.',
        channel_missing: 'У интеграции нет имени канала.',
        bot_not_ready: 'Бот пока не готов к работе с чатом.',
    };

    return problem ? (messages[problem] ?? messages.bot_not_ready) : messages.bot_not_ready;
};

export function useBotConnection({
    isAuthenticated,
    isCheckingAuth = false,
    pollingInterval,
    pollingEnabled,
}: UseBotConnectionOptions): UseBotConnectionReturn {
    const { addToast } = useToast();
    const [botStatus, setBotStatus] = useState<BotStatusType>('disconnected');

    const shouldPoll = pollingEnabled ?? true;
    const resolvedInterval = shouldPoll ? (pollingInterval ?? 30000) : false;

    const {
        data: botStatusData,
        error: botStatusError,
        refetch: refetchBotStatus,
    } = useBotStatus({
        enabled: !!isAuthenticated,
        refetchInterval: resolvedInterval,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (botStatusData) {
            setBotStatus(getStatusFromPayload(getStatusPayload(botStatusData)));
        }
    }, [botStatusData]);

    useEffect(() => {
        if (botStatusError) {
            logger.error('Error getting bot status:', botStatusError);
            setBotStatus('disconnected');
        }
    }, [botStatusError]);

    const connectBotMutation = useConnectBot({
        onSuccess: (response: unknown) => {
            const payload = getPayload(response);
            const statusPayload = getStatusPayload(response);

            if (payload.success === false) {
                setBotStatus('disconnected');
                addToast({
                    type: 'warning',
                    title: 'Бот не готов',
                    message: getBotMessage({ ...statusPayload, ...payload }),
                });
                return;
            }

            const nextStatus = getStatusFromPayload(statusPayload);
            setBotStatus(nextStatus);
            addToast({
                type: nextStatus === 'connected' ? 'success' : 'warning',
                title: nextStatus === 'connected' ? 'Бот подключен' : 'Бот запускается',
                message: payload.message ?? getBotMessage(statusPayload),
            });
        },
        onError: (error) => {
            logger.error('Error connecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка подключения',
                message: 'Не удалось подключить бота к каналам',
            });
        },
    });

    const disconnectBotMutation = useDisconnectBot({
        onSuccess: (response: unknown) => {
            const payload = getPayload(response);
            if (payload.success !== false) {
                setBotStatus('disconnected');
                addToast({
                    type: 'success',
                    title: 'Бот отключен',
                    message: payload.message ?? 'Бот отключен от каналов',
                });
            }
        },
        onError: (error) => {
            logger.error('Error disconnecting bot:', error);
            addToast({
                type: 'error',
                title: 'Ошибка отключения',
                message: 'Не удалось отключить бота от каналов',
            });
        },
    });

    const connectBotToChannels = useCallback(
        async (_platforms: string[] = []): Promise<void> => {
            if (!isAuthenticated) return;
            connectBotMutation.mutate();
        },
        [isAuthenticated, connectBotMutation]
    );

    const disconnectBotFromChannels = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) return;
        disconnectBotMutation.mutate();
    }, [isAuthenticated, disconnectBotMutation]);

    const getBotConnectionStatus = useCallback(async (): Promise<{ status: BotStatusType; [key: string]: unknown }> => {
        if (!isAuthenticated) return { status: 'disconnected' };

        const result = await refetchBotStatus();
        const payload = getStatusPayload(result.data);
        const nextStatus = getStatusFromPayload(payload);

        setBotStatus(nextStatus);
        return { status: nextStatus, ...(payload as Record<string, unknown>) };
    }, [isAuthenticated, refetchBotStatus]);

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
        getBotConnectionStatus,
    };
}

export type { BotStatusType };
