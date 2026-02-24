// src/features/chat/hooks/useChatWebSocket.ts
/**
 * Хук для обработки WebSocket сообщений чата.
 * Отвечает за: парсинг сообщений, обработку разных типов, TTS audio.
 */
import { useCallback, useState } from 'react';

import { API_BASE_URL, F5_TTS_SERVICE_URL } from '@/constants';
import { useTtsPlayer } from '@/context/TtsPlayerContext';
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
        username?: string;
        platform?: string;
    };
    audio_url?: string;
    volume?: number;
    tts_type?: string;
    text?: string;
    username?: string;
    platform?: string;
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
    onError
}: UseChatWebSocketOptions): UseChatWebSocketReturn {
    const { addToast } = useToast();
    const { addToQueue } = useTtsPlayer();
    const [lastJsonMessage, setLastJsonMessage] = useState<WebSocketMessage | null>(null);

    const getPlatformFilter = useCallback((): PlatformFilter => ({
        twitch: integrations?.twitch?.enabled ?? false,
        vk: integrations?.vk?.enabled ?? false
    }), [integrations]);

    const handleTtsAudio = useCallback((data: TtsAudioMessage) => {
        const audioData = data.data || data;
        const isTtsEnabled = (() => {
            if (typeof window === 'undefined') return true;
            const stored = window.localStorage.getItem('tts_enabled');
            if (stored === null) return true;
            return stored === 'true';
        })();

        if (!isTtsEnabled) {
            logger.debug('[TTS] Ignoring audio event because global TTS is disabled');
            return;
        }

        const platform = typeof audioData.platform === 'string' ? audioData.platform.toLowerCase() : null;
        if (platform && typeof window !== 'undefined') {
            const storedPlatforms = window.localStorage.getItem('tts_enabled_platforms');
            if (storedPlatforms) {
                try {
                    const enabledPlatforms = JSON.parse(storedPlatforms) as string[];
                    if (Array.isArray(enabledPlatforms) && enabledPlatforms.length > 0 && !enabledPlatforms.includes(platform)) {
                        logger.debug(`[TTS] Ignoring audio event for disabled platform: ${platform}`);
                        return;
                    }
                } catch (error) {
                    logger.warn('[TTS] Failed to parse enabled platforms from storage:', error);
                }
            }
        }

        if (!audioData.audio_url) {
            logger.warn('TTS audio event received but no audio_url provided');
            return;
        }

        try {
            let audioUrl = audioData.audio_url;

            // Convert relative URL to full URL
            if (audioUrl && !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
                if (audioUrl.startsWith('/audio/') && F5_TTS_SERVICE_URL) {
                    audioUrl = `${F5_TTS_SERVICE_URL}${audioUrl}`;
                } else if (audioUrl.startsWith('/')) {
                    audioUrl = `${API_BASE_URL}${audioUrl}`;
                } else if (F5_TTS_SERVICE_URL) {
                    audioUrl = `${F5_TTS_SERVICE_URL}/${audioUrl.replace(/^\/+/, '')}`;
                } else {
                    logger.warn(`[WARN] Audio URL is relative but could not convert: ${audioUrl}`);
                }
                logger.debug(`[LINK] Resolved audio URL: ${audioUrl}`);
            }

            // Add to TTS player queue
            addToQueue({
                text: audioData.text || 'TTS Message',
                audioUrl: audioUrl,
                volume: audioData.volume || 50,
                username: audioData.username,
                platform: audioData.platform
            });

            logger.info(`[OK] [TTS] Added to queue: ${audioData.text?.substring(0, 50) || 'TTS Message'}...`);
        } catch (err) {
            logger.error('Error adding TTS to queue:', err);
        }
    }, [addToQueue]);

    const handleWebSocketMessage = useCallback((data: WebSocketMessage): void => {
        setLastJsonMessage(data);
        const platformFilter = getPlatformFilter();

        // Log important message types
        if (data.type === 'chat_history' || data.type === 'error' || data.type === 'bot_status') {
            logger.debug('[CONNECT] [WS] Received:', data.type,
                data.type === 'chat_history' ? `(${(data as ChatHistoryMessage).messages?.length || 0} messages)` : '');
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
                    message: errorData.message
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
    }, [getPlatformFilter, onMessage, onHistoryLoaded, onBotStatusChange, onError, handleTtsAudio, addToast]);

    return {
        lastJsonMessage,
        handleWebSocketMessage
    };
}

export type { WebSocketMessage, ChatHistoryMessage, TtsAudioMessage, BotStatusMessage, ErrorMessage };
