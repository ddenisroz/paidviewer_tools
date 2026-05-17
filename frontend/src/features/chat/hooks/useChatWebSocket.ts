// src/features/chat/hooks/useChatWebSocket.ts
/**
 * Хук для обработки WebSocket сообщений чата.
 * Отвечает за: парсинг сообщений, обработку разных типов, TTS audio.
 */
import { useCallback, useState } from 'react';

import { useToast } from '@/shared/components/ui/toast';
import { logger } from '@/shared/utils/prodLogger';

import type { PlatformFilter } from './useChatMessages';
import type { BotStatusType } from '@/features/admin/hooks/useBotConnection';
import type { ChatMessage } from '@/types/chat';

// WebSocket message types
interface WebSocketMessage {
    type: string;
    [key: string]: unknown;
}

interface ChatHistoryMessage extends WebSocketMessage {
    type: 'chat_history';
    messages: ChatMessage[];
}

interface TtsAudioMessage extends WebSocketMessage {
    type: 'tts_audio';
    data?: {
        audio_url: string;
        volume?: number;
        tts_type?: string;
        text?: string;
        spoken_text?: string;
        original_text?: string;
        username?: string;
        platform?: string;
        trace_id?: string;
        source_message_id?: string;
    };
    audio_url?: string;
    volume?: number;
    tts_type?: string;
    text?: string;
    spoken_text?: string;
    original_text?: string;
    username?: string;
    platform?: string;
    trace_id?: string;
    source_message_id?: string;
}

interface BotStatusMessage extends WebSocketMessage {
    type: 'bot_status';
    status: BotStatusType;
}

interface ErrorMessage extends WebSocketMessage {
    type: 'error';
    message: string;
}

interface IntegrationsState {
    twitch?: { enabled?: boolean };
    vk?: { enabled?: boolean };
}

interface UseChatWebSocketOptions {
    integrations: IntegrationsState | null;
    onMessage: (message: ChatMessage, platformFilter?: PlatformFilter) => void;
    onHistoryLoaded: (messages: ChatMessage[], platformFilter?: PlatformFilter) => void;
    onBotStatusChange: (status: BotStatusType) => void;
    onError: (error: string) => void;
}

interface UseChatWebSocketReturn {
    lastJsonMessage: WebSocketMessage | null;
    handleWebSocketMessage: (data: WebSocketMessage) => void;
}

export function useChatWebSocket({
    integrations,
    onMessage,
    onHistoryLoaded,
    onBotStatusChange,
    onError,
}: UseChatWebSocketOptions): UseChatWebSocketReturn {
    const { addToast } = useToast();
    const [lastJsonMessage, setLastJsonMessage] = useState<WebSocketMessage | null>(null);

    const getPlatformFilter = useCallback(
        (): PlatformFilter => ({
            twitch: integrations?.twitch?.enabled ?? false,
            vk: integrations?.vk?.enabled ?? false,
        }),
        [integrations]
    );

    const handleTtsAudio = useCallback((data: TtsAudioMessage) => {
        const audioData = data.data || data;
        logger.debug('[TTS] Shared chat websocket received audio event', {
            platform: audioData.platform,
            username: audioData.username,
            trace_id: audioData.trace_id,
            source_message_id: audioData.source_message_id,
            spoken_text: audioData.spoken_text || audioData.text,
            original_text: audioData.original_text,
            has_audio_url: Boolean(audioData.audio_url),
        });
    }, []);

    const handleWebSocketMessage = useCallback(
        (data: WebSocketMessage): void => {
            setLastJsonMessage(data);
            const platformFilter = getPlatformFilter();

            // Log important message types
            if (data.type === 'chat_history' || data.type === 'error' || data.type === 'bot_status') {
                logger.debug(
                    '[CONNECT] [WS] Received:',
                    data.type,
                    data.type === 'chat_history'
                        ? `(${(data as ChatHistoryMessage).messages?.length || 0} messages)`
                        : ''
                );
            }

            switch (data.type) {
                case 'message':
                case 'chat_message': {
                    const messageData = data as unknown as ChatMessage;
                    onMessage(messageData, platformFilter);
                    break;
                }

                case 'chat_history': {
                    const historyData = data as ChatHistoryMessage;
                    if (historyData.messages && Array.isArray(historyData.messages)) {
                        logger.info(`[CHAT] Loaded ${historyData.messages.length} messages from WebSocket history`);
                        onHistoryLoaded(historyData.messages, platformFilter);
                    } else {
                        logger.warn('[WARN] [WS] chat_history received but messages is not an array');
                    }
                    break;
                }

                case 'bot_status': {
                    onBotStatusChange((data as BotStatusMessage).status);
                    break;
                }

                case 'tts_audio': {
                    handleTtsAudio(data as TtsAudioMessage);
                    break;
                }

                case 'error': {
                    const errorData = data as ErrorMessage;
                    onError(errorData.message);
                    addToast({
                        type: 'error',
                        title: 'Ошибка чата',
                        message: errorData.message,
                    });
                    break;
                }

                case 'ping':
                case 'pong':
                case 'chatbox_settings_updated':
                case 'state_reconciliation_required':
                    // Ignore these message types (handled elsewhere or not needed here)
                    break;

                default:
                    logger.debug('Unknown message type:', data.type);
            }
        },
        [getPlatformFilter, onMessage, onHistoryLoaded, onBotStatusChange, onError, handleTtsAudio, addToast]
    );

    return {
        lastJsonMessage,
        handleWebSocketMessage,
    };
}

export type { WebSocketMessage, ChatHistoryMessage, TtsAudioMessage, BotStatusMessage, ErrorMessage };
