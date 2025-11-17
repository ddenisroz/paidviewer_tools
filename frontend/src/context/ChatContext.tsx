// src/context/ChatContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useReducer, useMemo, ReactNode } from 'react';
import { API_BASE_URL } from '../constants';
import { TTS_SERVICE_URL } from '../constants';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/toast';
import { useIntegrations } from './IntegrationsContext';
import { useAudioPriority } from './AudioPriorityContext';
import { useTtsPlayer } from './TtsPlayerContext';
import useSharedWebSocket from '../hooks/useSharedWebSocket';
import { logger } from '../utils/prodLogger';
import { useBotStatus, useConnectBot, useDisconnectBot } from '../queries/chat/chatQueries';
import { chatService } from '../services/api/services/chatService';
import type { ChatMessage } from '../types/chat';

type BotStatusType = 'connected' | 'disconnected';

interface WebSocketMessage {
    type: string;
    [key: string]: any;
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

type MessagesAction = 
    | { type: 'ADD_MESSAGE'; payload: ChatMessage }
    | { type: 'CLEAR_MESSAGES' }
    | { type: 'SET_MESSAGES'; payload: ChatMessage[] };

const messagesReducer = (state: ChatMessage[], action: MessagesAction): ChatMessage[] => {
    const maxMessages = parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10);
    
    switch (action.type) {
        case 'ADD_MESSAGE': {
            const isDuplicate = state.some(msg => 
                msg.id === action.payload.id || 
                (msg.timestamp === action.payload.timestamp && 
                 msg.author === action.payload.author && 
                 (msg.content === action.payload.content || msg.message === action.payload.message))
            );
            
            if (isDuplicate) {
                return state;
            }
            
            const newMessages = [...state, action.payload].slice(-maxMessages);
            return newMessages;
        }
            
        case 'CLEAR_MESSAGES':
            return [];
            
        case 'SET_MESSAGES':
            return action.payload.slice(-maxMessages);
            
        default:
            return state;
    }
};

interface ChatContextValue {
    messages: ChatMessage[];
    lastJsonMessage: WebSocketMessage | null;
    isConnected: boolean;
    botStatus: BotStatusType;
    error: string | null;
    sendMessage: (message: string, platforms?: string[]) => void;
    connectBotToChannels: (platforms?: string[]) => Promise<void>;
    disconnectBotFromChannels: () => Promise<void>;
    getBotConnectionStatus: () => Promise<{ status: BotStatusType; [key: string]: any }>;
    clearMessages: () => void;
    setMessages: (messages: ChatMessage[]) => void;
    playTTS: (text: string, voice?: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const useChat = (): ChatContextValue => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

interface ChatProviderProps {
    children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
    const { user, isAuthenticated, isGuest, isCheckingAuth } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { addToast } = useToast();
    const { requestAudioFocus, releaseAudioFocus } = useAudioPriority();
    const { addToQueue } = useTtsPlayer();
    
    const loadMessagesFromStorage = (): ChatMessage[] => {
        try {
            const maxMessages = parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '500', 10);
            const stored = localStorage.getItem('chat_messages');
            if (stored) {
                const parsed = JSON.parse(stored) as ChatMessage[];
                return parsed.slice(-maxMessages);
            }
        } catch (error) {
            logger.error('Error loading messages from storage:', error);
        }
        return [];
    };
    
    const [messages, dispatchMessages] = useReducer(messagesReducer, [], loadMessagesFromStorage);
    const historyLoadedRef = useRef<boolean>(false);
    const [lastJsonMessage, setLastJsonMessage] = useState<WebSocketMessage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [botStatus, setBotStatus] = useState<BotStatusType>('disconnected');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    
    const audioContext = useRef<AudioContext | null>(null);
    const audioUnlocked = useRef<boolean>(false);
    const autoplayToastShown = useRef<boolean>(false);
    
    useEffect(() => {
        const unlockAudioContext = async (): Promise<void> => {
            if (!audioUnlocked.current) {
                audioUnlocked.current = true;
                logger.info('✅ User interaction detected - audio unlocked');
                
                document.removeEventListener('click', unlockAudioContext);
                document.removeEventListener('touchstart', unlockAudioContext);
                document.removeEventListener('keydown', unlockAudioContext);
                
                if (audioContext.current && audioContext.current.state === 'suspended') {
                    try {
                        await audioContext.current.resume();
                        logger.info('🔊 AudioContext resumed after user gesture');
                    } catch (err: any) {
                        logger.debug('AudioContext resume failed:', err.message);
                    }
                }
            }
        };
        
        document.addEventListener('click', unlockAudioContext);
        document.addEventListener('touchstart', unlockAudioContext);
        document.addEventListener('keydown', unlockAudioContext);
        
        return () => {
            document.removeEventListener('click', unlockAudioContext);
            document.removeEventListener('touchstart', unlockAudioContext);
            document.removeEventListener('keydown', unlockAudioContext);
        };
    }, []);
    
    const baseUrl = API_BASE_URL;
    const userId: number | string | undefined = isGuest ? (user as any)?.session_id : user?.id;
    
    useEffect(() => {
        const loadChatHistory = async (): Promise<void> => {
            if (!isAuthenticated && !isGuest) return;
            if (integrationsLoading) return;
            
            if (historyLoadedRef.current) {
                logger.debug('📜 History already loaded, skipping...');
                return;
            }
            
            const maxWaitTime = 2000;
            const checkInterval = 100;
            let elapsedTime = 0;
            
            while (elapsedTime < maxWaitTime && !historyLoadedRef.current) {
                if (isConnected) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                elapsedTime += checkInterval;
            }
            
            if (historyLoadedRef.current) {
                logger.debug('📜 History already loaded via WebSocket, skipping API load...');
                return;
            }
            
            try {
                logger.info('📜 Loading chat history from API (WebSocket fallback)...');
                const response = await chatService.getChatHistory({
                    limit: parseInt(import.meta.env.VITE_CHAT_MAX_MESSAGES || '200', 10)
                });
                
                if ((response.data as any).success && (response.data as any).messages && (response.data as any).messages.length > 0) {
                    const twitchEnabled = integrations?.twitch?.enabled ?? true;
                    const vkEnabled = integrations?.vk?.enabled ?? true;
                    
                    const filteredMessages = ((response.data as any).messages as ChatMessage[]).filter(msg => {
                        if (integrationsLoading || !integrations) return true;
                        
                        if (msg.platform === 'twitch' && !twitchEnabled) return false;
                        if (msg.platform === 'vk' && !vkEnabled) return false;
                        return true;
                    });
                    
                    const filteredCount = (response.data as any).messages.length - filteredMessages.length;
                    if (filteredCount > 0) {
                        logger.debug(`📜 Filtered ${filteredCount} messages from unconnected platforms`);
                    }
                    
                    if (filteredMessages.length > 0) {
                        logger.info(`📜 Loaded ${filteredMessages.length} messages from history (API fallback)`);
                        dispatchMessages({ type: 'SET_MESSAGES', payload: filteredMessages });
                        historyLoadedRef.current = true;
                    } else {
                        logger.debug('📜 No messages after filtering');
                    }
                } else {
                    logger.debug('📜 No messages in history response');
                }
            } catch (error) {
                logger.error('Failed to load chat history:', error);
            }
        };
        
        loadChatHistory();
    }, [isAuthenticated, isGuest, integrationsLoading, isConnected, integrations]);
    
    const handleWebSocketMessage = useCallback((data: WebSocketMessage): void => {
        setLastJsonMessage(data);
        
        if (data.type === 'chat_history' || data.type === 'error' || data.type === 'bot_status') {
            logger.debug('🔌 [WS] Received:', data.type, data.type === 'chat_history' ? `(${(data as ChatHistoryMessage).messages?.length || 0} messages)` : '');
        }
        
        if (data.type === 'message' || data.type === 'chat_message') {
            const twitchEnabled = integrations?.twitch?.enabled || false;
            const vkEnabled = integrations?.vk?.enabled || false;
            
            if ((data as any).platform === 'twitch' && !twitchEnabled) return;
            if ((data as any).platform === 'vk' && !vkEnabled) return;
            
            dispatchMessages({ type: 'ADD_MESSAGE', payload: data as unknown as ChatMessage });
        } else if (data.type === 'chat_history') {
            const historyData = data as ChatHistoryMessage;
            if (historyData.messages && Array.isArray(historyData.messages)) {
                const twitchEnabled = integrations?.twitch?.enabled || false;
                const vkEnabled = integrations?.vk?.enabled || false;
                
                const filteredMessages = historyData.messages.filter(msg => {
                    if (msg.platform === 'twitch' && !twitchEnabled) return false;
                    if (msg.platform === 'vk' && !vkEnabled) return false;
                    return true;
                });
                
                const filteredCount = historyData.messages.length - filteredMessages.length;
                if (filteredCount > 0) {
                    logger.debug(`📜 [WS] Filtered ${filteredCount} messages from unconnected platforms`);
                }
                
                if (filteredMessages.length > 0) {
                    logger.info(`📜 Loaded ${filteredMessages.length} messages from WebSocket history`);
                    dispatchMessages({ type: 'SET_MESSAGES', payload: filteredMessages });
                    historyLoadedRef.current = true;
                } else {
                    logger.debug('📜 [WS] No messages after filtering by connected platforms');
                }
            } else {
                logger.warn('⚠️ [WS] chat_history received but messages is not an array');
            }
        } else if (data.type === 'bot_status') {
            setBotStatus((data as BotStatusMessage).status);
        } else if (data.type === 'tts_audio') {
            const audioData = (data as TtsAudioMessage).data || data as TtsAudioMessage;
            if (audioData.audio_url) {
                try {
                    let audioUrl = audioData.audio_url;
                    if (audioUrl && !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
                        if (audioUrl.startsWith('/audio/') && TTS_SERVICE_URL) {
                            audioUrl = `${TTS_SERVICE_URL}${audioUrl}`;
                            logger.debug(`🔗 Converted relative audio URL to full URL: ${audioUrl}`);
                        } else {
                            logger.warn(`⚠️ Audio URL is relative but could not convert: ${audioUrl} (TTS_SERVICE_URL: ${TTS_SERVICE_URL})`);
                        }
                    }
                    
                    // Add to TTS player queue instead of playing directly
                    addToQueue({
                        text: audioData.text || 'TTS Message',
                        audioUrl: audioUrl,
                        volume: audioData.volume || 50,
                        username: audioData.username,
                        platform: audioData.platform
                    });
                    
                    logger.info(`✅ [TTS] Added to queue: ${audioData.text?.substring(0, 50) || 'TTS Message'}...`);
                    
                } catch (err) {
                    logger.error('Error adding TTS to queue:', err);
                }
            } else {
                logger.warn('TTS audio event received but no audio_url provided');
            }
        } else if (data.type === 'error') {
            const errorData = data as ErrorMessage;
            setError(errorData.message);
            addToast({ 
                type: 'error', 
                title: 'Ошибка чата', 
                message: errorData.message 
            });
        } else if (data.type === 'ping' || data.type === 'pong') {
            return;
        } else if (data.type === 'chatbox_settings_updated') {
            return;
        } else {
            logger.debug('Unknown message type:', data.type);
        }
    }, [addToast, integrations]);
    
    const { send: wsSendMessage } = useSharedWebSocket(userId, handleWebSocketMessage);
    
    useEffect(() => {
        if (userId && (isAuthenticated || isGuest)) {
            setIsConnected(true);
        } else {
            setIsConnected(false);
        }
    }, [userId, isAuthenticated, isGuest]);
    
    useEffect(() => {
        if (messages.length > 0) {
            logger.debug('Messages updated:', messages.length, 'total messages');
            try {
                localStorage.setItem('chat_messages', JSON.stringify(messages));
            } catch (error) {
                logger.error('Error saving messages to storage:', error);
            }
        }
    }, [messages]);

    const playTTS = useCallback((text: string, voice: string = 'default'): void => {
        try {
            const audio = new Audio();
            audio.src = `${API_BASE_URL}/api/tts/speak?text=${encodeURIComponent(text)}&voice=${voice}`;
            
            audio.onloadeddata = () => {
                logger.debug('TTS audio loaded, playing...');
                audio.play().catch(err => {
                    logger.error('Error playing TTS audio:', err);
                });
            };
            
            audio.onerror = () => {
                logger.error('Error loading TTS audio');
                addToast({
                    type: 'error',
                    title: 'Ошибка TTS',
                    message: 'Не удалось загрузить аудио для озвучки'
                });
            };
            
            audio.load();
        } catch (error) {
            logger.error("Error creating TTS audio:", error);
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось создать аудио объект для TTS'
            });
        }
    }, [addToast]);

    const sendMessage = useCallback((message: string, platforms: string[] = []): void => {
        if (!isConnected) {
            throw new Error('WebSocket not connected');
        }

        if (!message || !message.trim()) {
            throw new Error('Message cannot be empty');
        }

        if (!platforms || platforms.length === 0) {
            throw new Error('No platforms specified');
        }

        wsSendMessage({
            type: 'send_message',
            message: message.trim(),
            platforms: platforms
        });
    }, [isConnected, wsSendMessage]);

    const connectBotMutation = useConnectBot({
        onSuccess: (response: any) => {
            if (response.data?.success) {
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

    const disconnectBotMutation = useDisconnectBot({
        onSuccess: (response: any) => {
            if (response.data?.success) {
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

    const connectBotToChannels = useCallback(async (platforms: string[] = []): Promise<void> => {
        if (!isAuthenticated) return;
        connectBotMutation.mutate();
    }, [isAuthenticated, connectBotMutation]);

    const disconnectBotFromChannels = useCallback(async (): Promise<void> => {
        if (!isAuthenticated) return;
        disconnectBotMutation.mutate();
    }, [isAuthenticated, disconnectBotMutation]);

    const { data: botStatusData, error: botStatusError, refetch: refetchBotStatus } = useBotStatus({
        enabled: !!isAuthenticated, // Преобразуем boolean | null в boolean
        refetchInterval: 30000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
    
    // React Query v5: onSuccess/onError moved to useEffect
    useEffect(() => {
        if (botStatusData) {
            const statusResponse = botStatusData?.data || botStatusData;
            if (statusResponse.connected) {
                setBotStatus('connected');
            } else {
                setBotStatus('disconnected');
            }
        }
    }, [botStatusData]);
    
    useEffect(() => {
        if (botStatusError) {
            logger.error('Error getting bot status:', botStatusError);
            setBotStatus('disconnected');
        }
    }, [botStatusError]);

    const getBotConnectionStatus = useCallback(async (): Promise<{ status: BotStatusType; [key: string]: any }> => {
        if (!isAuthenticated) return { status: 'disconnected' };
        const result = await refetchBotStatus();
        const statusResponse = result.data?.data || result.data;
        if (statusResponse?.connected) {
            setBotStatus('connected');
            return { status: 'connected', ...statusResponse };
        } else {
            setBotStatus('disconnected');
            return { status: 'disconnected', ...statusResponse };
        }
    }, [isAuthenticated, refetchBotStatus]);

    const clearMessages = useCallback((): void => {
        dispatchMessages({ type: 'CLEAR_MESSAGES' });
    }, []);

    const setMessages = useCallback((newMessages: ChatMessage[]): void => {
        dispatchMessages({ type: 'SET_MESSAGES', payload: newMessages });
    }, []);

    useEffect(() => {
        if (isAuthenticated && !isCheckingAuth) {
            getBotConnectionStatus();
        }
    }, [isAuthenticated, isCheckingAuth, getBotConnectionStatus]);

    useEffect(() => {
        if (!isAuthenticated) {
            dispatchMessages({ type: 'CLEAR_MESSAGES' });
        }
    }, [isAuthenticated]);

    const value = useMemo<ChatContextValue>(() => {
        // Проверка baseUrl после всех хуков (правило React Hooks)
        if (!baseUrl) {
            logger.error('VITE_BOT_SERVICE_URL environment variable is required');
            return {
                messages: [],
                lastJsonMessage: null,
                isConnected: false,
                botStatus: 'disconnected' as BotStatusType,
                error: 'Ошибка конфигурации: отсутствует URL сервиса',
                sendMessage: () => {},
                connectBotToChannels: async () => {},
                disconnectBotFromChannels: async () => {},
                getBotConnectionStatus: async () => ({ status: 'disconnected' as BotStatusType }),
                clearMessages: () => {},
                setMessages: () => {},
                playTTS: () => {}
            };
        }
        
        return {
            messages,
            lastJsonMessage,
            isConnected,
            botStatus,
            error,
            sendMessage,
            connectBotToChannels,
            disconnectBotFromChannels,
            getBotConnectionStatus,
            clearMessages,
            setMessages,
            playTTS
        };
    }, [baseUrl, messages, lastJsonMessage, isConnected, botStatus, error, sendMessage, connectBotToChannels, disconnectBotFromChannels, getBotConnectionStatus, clearMessages, setMessages, playTTS]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

