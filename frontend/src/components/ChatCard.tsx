// src/components/ChatCard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    MessageSquare, 
    Settings,
    Copy,
    RefreshCw,
    ArrowDown,
    Eye,
    EyeOff,
    ExternalLink
} from 'lucide-react';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ChatContextMenu from './ChatContextMenu';
import SwipeableMessage from './chat/SwipeableMessage';
import { ttsService } from '../services/api/services/ttsService';
import { chatService } from '../services/api/services/chatService';
import { getAllEmotesForChannel } from '../utils/emotes';
import { twitchBadgesService } from '../services/twitchBadges';
import ChatBoxSettingsModal from './ChatBoxSettingsModal';
import { logger } from '../utils/prodLogger';
import { useTimeout } from '../hooks/useTimeout';
import { CHAT_CONSTANTS } from '../constants/drops';
import type { ChatMessage } from '../types/chat';

interface Integrations {
    twitch?: {
        enabled: boolean;
        username?: string | null;
    };
    vk?: {
        enabled: boolean;
        username?: string | null;
    };
    donationalerts?: {
        enabled: boolean;
        username?: string | null;
    };
}

interface ChatCardProps {
    integrations: Integrations;
    isOnHomePage?: boolean;
}

interface TtsSettings {
    enabled_platforms: string[];
    global_enabled?: boolean;
}

interface PlatformVisibility {
    twitch: boolean;
    vk: boolean;
}

interface ObsSettings {
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    backgroundColor: string;
    backgroundImage: string;
    textColor: string;
    borderRadius: number;
    borderColor: string;
    borderWidth: number;
    messageBg: string;
    messageBorderRadius: number;
    messageMargin: number;
    messagePadding: number;
    maxMessages: number;
    showTimestamps: boolean;
    showPlatform: boolean;
    showUserRoles: boolean;
    animationDuration: number;
    animationType: string;
    platforms: {
        twitch: boolean;
        vk: boolean;
        combined: boolean;
    };
    platformFilter: 'twitch' | 'vk' | 'combined' | 'all';
    colors: {
        moderator: string;
        vip: string;
        subscriber: string;
        normal: string;
    };
}

interface ContextMenuState {
    x: number;
    y: number;
    message: ChatMessage;
}

interface EmotesState {
    channelEmotes: Map<string, any>;
    globalEmotes: Map<string, any>;
}

interface PrevIntegrationsRef {
    twitch: boolean;
    vk: boolean;
}

const ChatCard: React.FC<ChatCardProps> = ({ integrations, isOnHomePage = true }) => {
    const { user, isGuest } = useAuth();
    const { messages: chatMessages, isConnected, setMessages } = useChat();
    
    // Фильтрация сообщений + TTS настройки платформ
    const getInitialVisibility = (): PlatformVisibility => {
        try {
            const cached = localStorage.getItem('tts_platform_settings');
            if (cached) {
                const parsed = JSON.parse(cached);
                const enabledPlatforms = parsed.enabled_platforms || [];
                return {
                    twitch: enabledPlatforms.includes('twitch'),
                    vk: enabledPlatforms.includes('vk')
                };
            }
        } catch (e) {
            logger.error('Failed to parse cached platform settings:', e);
        }
        return { twitch: true, vk: true };
    };
    
    const initialVisibility = getInitialVisibility();
    const [twitchChatVisible, setTwitchChatVisible] = useState<boolean>(initialVisibility.twitch);
    const [vkChatVisible, setVkChatVisible] = useState<boolean>(initialVisibility.vk);
    
    // TTS настройки (для синхронизации с кнопками-шорткатами)
    const [ttsSettings, setTtsSettings] = useState<TtsSettings>({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    
    // Показывать кнопку прокрутки вниз
    const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
    
    // Видимость чата (для кнопки "Скрыть чат") - сохраняется в localStorage
    const [chatMessagesVisible, setChatMessagesVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('chatMessagesVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });
    
    // Сохраняем состояние видимости чата в localStorage при изменении
    useEffect(() => {
        localStorage.setItem('chatMessagesVisible', JSON.stringify(chatMessagesVisible));
    }, [chatMessagesVisible]);
    
    // State для отслеживания загрузки badges
    const [badgesLoaded, setBadgesLoaded] = useState<boolean>(false);
    
    // Ref для предотвращения повторной загрузки badges и истории
    const badgesLoadedRef = useRef<boolean>(false);
    const historyLoadedRef = useRef<boolean>(false);
    const prevIntegrationsRef = useRef<PrevIntegrationsRef>({ twitch: false, vk: false });
    
    // Загрузка TTS настроек и Twitch badges при монтировании и изменении зависимостей
    useEffect(() => {
        // 🧹 Очистка ВСЕХ старых localStorage значений (больше не используются)
        const obsoleteKeys = [
            'chatFilter_twitch',
            'chatFilter_vk',
            'token',
            'auth_token',
            'user_token'
        ];
        
        obsoleteKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                logger.log(`🧹 [CLEANUP] Removed obsolete localStorage key: ${key}`);
            }
        });
        
        logger.log('🧹 [CLEANUP] Finished cleaning up obsolete localStorage');
        
        const loadTtsSettings = async (): Promise<void> => {
            try {
                const response = await ttsService.getPlatformSettings();
                
                // Проверяем, что данные существуют
                if (!response?.data?.data) {
                    logger.warn('⚠️ [TTS SHORTCUT] No settings data received (backend may be unavailable)');
                    return;
                }
                
                const settings = response.data.data as TtsSettings;
                setTtsSettings(settings);
                logger.log('✅ [TTS SHORTCUT] Settings loaded:', settings);
                
                // Проверяем, что enabled_platforms существует
                if (!settings.enabled_platforms) {
                    logger.warn('⚠️ [TTS SHORTCUT] No enabled_platforms in settings');
                    return;
                }
                
                logger.log('✅ [TTS SHORTCUT] enabled_platforms:', settings.enabled_platforms);
                
                // 🔄 СИНХРОНИЗАЦИЯ: Обновляем видимость платформ на основе API
                const enabledPlatforms = settings.enabled_platforms || [];
                setTwitchChatVisible(enabledPlatforms.includes('twitch'));
                setVkChatVisible(enabledPlatforms.includes('vk'));
                
                // 🔄 Сохраняем в localStorage для быстрой инициализации
                try {
                    localStorage.setItem('tts_platform_settings', JSON.stringify(settings));
                } catch (e) {
                    logger.error('Failed to cache platform settings:', e);
                }
                
                logger.log('🔄 [TTS SHORTCUT] Synced visibility from API:', {
                    enabled_platforms: enabledPlatforms,
                    twitch: enabledPlatforms.includes('twitch'),
                    vk: enabledPlatforms.includes('vk')
                });
            } catch (error) {
                logger.warn('⚠️ [TTS SHORTCUT] Backend unavailable, using defaults:', error instanceof Error ? error.message : 'Unknown error');
            }
        };
        
        const loadBadges = async (): Promise<void> => {
            // Предотвращаем повторную загрузку
            if (badgesLoadedRef.current) {
                logger.log('⏭️ [BADGES] Already loaded, skipping...');
                setBadgesLoaded(true);
                return;
            }
            
            try {
                // Загружаем global badges
                await twitchBadgesService.loadGlobalBadges();
                logger.log('✅ [BADGES] Twitch global badges loaded');
                
                badgesLoadedRef.current = true;
                setBadgesLoaded(true);
            } catch (error: any) {
                logger.error('❌ [BADGES] Error loading badges:', error);
                const errorMessage = error.response?.data?.detail || error.message || 'Не удалось загрузить значки';
                toast.error(`Ошибка загрузки значков: ${errorMessage}`);
            }
        };
        
        // 🔄 Загружаем настройки сразу (без задержки) для правильной синхронизации
        loadTtsSettings();
        // Badges загружаем с небольшой задержкой чтобы не блокировать рендер
        setTimeout(() => {
            loadBadges();
        }, 50);
        
        // 🔄 Слушаем изменения TTS настроек из верхних переключателей
        const handleTtsSettingsChanged = async (event: CustomEvent<{ enabledPlatforms: string[] }>): Promise<void> => {
            const { enabledPlatforms } = event.detail;
            logger.log('🔄 [TTS SHORTCUT] Received settings update:', enabledPlatforms);
            
            // Обновляем видимость платформ сразу из события
            setTwitchChatVisible(enabledPlatforms.includes('twitch'));
            setVkChatVisible(enabledPlatforms.includes('vk'));
            setTtsSettings(prev => ({
                ...prev,
                enabled_platforms: enabledPlatforms
            }));
            
            // 🔄 Перезагружаем настройки из API для синхронизации
            try {
                const response = await ttsService.getPlatformSettings();
                const enabledPlatformsFromAPI = (response.data as unknown as TtsSettings).enabled_platforms || [];
                logger.log('🔄 [TTS SHORTCUT] Reloaded from API:', enabledPlatformsFromAPI);
                
                // Обновляем состояние из API
                setTwitchChatVisible(enabledPlatformsFromAPI.includes('twitch'));
                setVkChatVisible(enabledPlatformsFromAPI.includes('vk'));
                setTtsSettings(prev => ({
                    ...prev,
                    enabled_platforms: enabledPlatformsFromAPI
                }));
                
                // 🔄 Сохраняем в localStorage для быстрой инициализации
                try {
                    localStorage.setItem('tts_platform_settings', JSON.stringify(response.data));
                } catch (e) {
                    logger.error('Failed to cache platform settings:', e);
                }
            } catch (error) {
                logger.error('❌ [TTS SHORTCUT] Error reloading settings:', error);
            }
        };
        
        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        
        return () => {
            window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        };
    }, [user?.id]);
    
    // ✅ Загружаем channel badges когда integrations становятся доступными
    useEffect(() => {
        const loadChannelBadges = async (): Promise<void> => {
            logger.log('🔍 [BADGES] Checking channel badges conditions:', {
                badgesLoaded: badgesLoaded,
                twitchEnabled: integrations?.twitch?.enabled,
                twitchUsername: user?.twitch_username
            });
            
            if (!badgesLoaded) {
                logger.debug('⏭️ [BADGES] Global badges not loaded yet, skipping channel badges');
                return;
            }
            
            if (!integrations?.twitch?.enabled) {
                logger.debug('⏭️ [BADGES] Twitch integration not enabled, skipping channel badges');
                return;
            }
            
            if (!user?.twitch_username) {
                logger.debug('⏭️ [BADGES] Twitch username not available, skipping channel badges');
                return;
            }
            
            if (badgesLoadedRef.current) {
                logger.debug('⏭️ [BADGES] Channel badges already loaded, skipping...');
                return;
            }
            
            try {
                badgesLoadedRef.current = true;
                logger.log('📥 [BADGES] Loading channel badges for:', user.twitch_username);
                await twitchBadgesService.loadChannelBadges(user.twitch_username);
                logger.log('✅ [BADGES] Channel badges loaded (after integrations):', user.twitch_username);
            } catch (err) {
                badgesLoadedRef.current = false;
                logger.warn('⚠️ [BADGES] Failed to load channel badges:', err);
            }
        };
        
        if (integrations?.twitch?.enabled && user?.twitch_username && badgesLoaded) {
            logger.log('⏰ [BADGES] Scheduling channel badges load...');
            const timeoutId = setTimeout(() => {
                loadChannelBadges();
            }, 200);
            
            return () => clearTimeout(timeoutId);
        } else {
            logger.debug('⏭️ [BADGES] Conditions not met for channel badges:', {
                twitchEnabled: integrations?.twitch?.enabled,
                twitchUsername: user?.twitch_username,
                badgesLoaded: badgesLoaded
            });
        }
    }, [integrations?.twitch?.enabled, user?.twitch_username, badgesLoaded]);
    
    // Шорткат: Переключение TTS + фильтрации для Twitch
    const handleTwitchToggle = async (): Promise<void> => {
        const newVisible = !twitchChatVisible;
        
        setTwitchChatVisible(newVisible);
        
        try {
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('twitch');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('twitch');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            const response = await ttsService.savePlatformSettings({
                enabled_platforms: enabledPlatforms
            });
            
            const updatedSettings: TtsSettings = {
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);
            
            try {
                localStorage.setItem('tts_platform_settings', JSON.stringify(response.data || { enabled_platforms: enabledPlatforms }));
            } catch (e) {
                logger.error('Failed to cache platform settings:', e);
            }
            
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            logger.log(`🎮 [TTS SHORTCUT] Twitch ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`Twitch озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            logger.error('❌ [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Шорткат: Переключение TTS + фильтрации для VK
    const handleVkToggle = async (): Promise<void> => {
        const newVisible = !vkChatVisible;
        
        setVkChatVisible(newVisible);
        
        try {
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('vk');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('vk');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            const response = await ttsService.savePlatformSettings({
                enabled_platforms: enabledPlatforms
            });
            
            const updatedSettings: TtsSettings = {
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            };
            setTtsSettings(updatedSettings);
            
            try {
                localStorage.setItem('tts_platform_settings', JSON.stringify(response.data || { enabled_platforms: enabledPlatforms }));
            } catch (e) {
                logger.error('Failed to cache platform settings:', e);
            }
            
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            logger.log(`📺 [TTS SHORTCUT] VK ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`VK озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            logger.error('❌ [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Чат включен автоматически, если есть хотя бы одна интеграция или если это гость
    let twitchEnabled: boolean, vkEnabled: boolean;
    if (isGuest) {
        twitchEnabled = user?.platform === 'twitch';
        vkEnabled = user?.platform === 'vk';
    } else {
        twitchEnabled = integrations?.twitch?.enabled || false;
        vkEnabled = integrations?.vk?.enabled || false;
    }
    
    const twitchChatEnabled = twitchEnabled && isOnHomePage;
    const vkChatEnabled = vkEnabled && isOnHomePage;
    
    // Автоматическое объединение: если включены обе платформы, то показываем объединенный чат
    const combinedChat = twitchChatEnabled && vkChatEnabled;
    const [showObsSettings, setShowObsSettings] = useState<boolean>(false);
    const [showChatBoxModal, setShowChatBoxModal] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Контекстное меню
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [ttsBlockedUsers, setTtsBlockedUsers] = useState<Set<string>>(new Set());
    
    // 7TV смайлы
    const [emotes, setEmotes] = useState<EmotesState>({ channelEmotes: new Map(), globalEmotes: new Map() });
    
    // Настройки виджета для OBS
    const [obsSettings, setObsSettings] = useState<ObsSettings>({
        width: CHAT_CONSTANTS.DEFAULT_WIDTH,
        height: CHAT_CONSTANTS.DEFAULT_HEIGHT,
        fontSize: 14,
        fontFamily: 'var(--font-family-base)',
        fontWeight: 'normal',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backgroundImage: 'none',
        textColor: '#ffffff',
        borderRadius: 8,
        borderColor: '#333',
        borderWidth: 2,
        messageBg: 'rgba(255, 255, 255, 0.1)',
        messageBorderRadius: 4,
        messageMargin: 4,
        messagePadding: 8,
        maxMessages: 50,
        showTimestamps: false,
        showPlatform: true,
        showUserRoles: true,
        animationDuration: 0.3,
        animationType: 'slide-in',
        platforms: {
            twitch: true,
            vk: true,
            combined: true
        },
        platformFilter: 'combined',
        colors: {
            moderator: '#00ff00',
            vip: '#ff6b6b',
            subscriber: '#4ecdc4',
            normal: '#ffffff'
        }
    });

    // Фильтруем сообщения по включенным платформам и видимости
    const filteredMessages = useMemo(() => {
        if (!isOnHomePage) {
            return [];
        }
        
        return chatMessages.filter((msg: ChatMessage) => {
            if (msg.platform === 'twitch' && (!twitchChatEnabled || !twitchChatVisible)) {
                return false;
            }
            if (msg.platform === 'vk' && (!vkChatEnabled || !vkChatVisible)) {
                return false;
            }
            return true;
        }).slice(-50);
    }, [chatMessages, twitchChatEnabled, vkChatEnabled, twitchChatVisible, vkChatVisible, isOnHomePage]);

    // Ref для контейнера сообщений
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const hasSetInitialScroll = useRef<boolean>(false);

    // Callback ref для установки начальной позиции сразу после монтирования
    const setMessagesContainerRef = (node: HTMLDivElement | null): void => {
        messagesContainerRef.current = node;
        
        if (node && isOnHomePage && filteredMessages.length > 0 && !hasSetInitialScroll.current) {
            requestAnimationFrame(() => {
                if (node) {
                    node.scrollTop = node.scrollHeight;
                    requestAnimationFrame(() => {
                        if (node) {
                            node.scrollTop = node.scrollHeight;
                            hasSetInitialScroll.current = true;
                            logger.log('⬇️ [INITIAL] Set scroll position via callback ref');
                        }
                    });
                }
            });
        }
    };

    // Автоскролл к последнему сообщению
    const scrollToBottom = (): void => {
        const container = messagesContainerRef.current;
        if (container) {
            container.scrollTop = container.scrollHeight;
            requestAnimationFrame(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        }
    };

    // Проверка: пользователь внизу контейнера?
    const isUserAtBottom = (): boolean => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        
        const SCROLL_THRESHOLD = 150;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return distanceFromBottom < SCROLL_THRESHOLD;
    };
    
    // Обработчик скролла для показа/скрытия кнопки
    const handleScroll = (): void => {
        const atBottom = isUserAtBottom();
        setShowScrollButton(!atBottom);
    };

    // ✅ ПРАВИЛЬНАЯ ЛОГИКА: Чат сразу открывается внизу, без автоскролла
    const previousMessageCount = useRef<number>(0);
    const previousIsOnHomePage = useRef<boolean>(isOnHomePage);
    
    // ✅ 1. Устанавливаем начальную позицию после рендера (когда DOM готов)
    useEffect(() => {
        if (isOnHomePage && filteredMessages.length > 0 && !hasSetInitialScroll.current) {
            const container = messagesContainerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
                
                let lastScrollHeight = container.scrollHeight;
                let attempts = 0;
                const maxAttempts = 20;
                
                const checkAndSetScroll = (): void => {
                    if (!container) return;
                    
                    const currentScrollHeight = container.scrollHeight;
                    
                    if (currentScrollHeight !== lastScrollHeight && attempts < maxAttempts) {
                        lastScrollHeight = currentScrollHeight;
                        attempts++;
                        container.scrollTop = container.scrollHeight;
                        requestAnimationFrame(checkAndSetScroll);
                        return;
                    }
                    
                    container.scrollTop = container.scrollHeight;
                    hasSetInitialScroll.current = true;
                    previousMessageCount.current = filteredMessages.length;
                    logger.log(`⬇️ [INITIAL] Set scroll position (${attempts} attempts, height: ${container.scrollHeight})`);
                };
                
                requestAnimationFrame(() => {
                    checkAndSetScroll();
                });
            }
        }
        
        if (!isOnHomePage) {
            hasSetInitialScroll.current = false;
        }
    }, [isOnHomePage, filteredMessages.length]);
    
    // ✅ 2. Автопрокрутка при переключении на главную страницу
    useEffect(() => {
        if (isOnHomePage && !previousIsOnHomePage.current && filteredMessages.length > 0) {
            const container = messagesContainerRef.current;
            if (container) {
                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                });
            }
        }
        previousIsOnHomePage.current = isOnHomePage;
    }, [isOnHomePage, filteredMessages.length]);
    
    // ✅ 3. Автоматический скролл при новых сообщениях (только если пользователь внизу)
    useEffect(() => {
        if (!isOnHomePage || filteredMessages.length === 0) {
            previousMessageCount.current = filteredMessages.length;
            return;
        }
        
        if (!hasSetInitialScroll.current) {
            previousMessageCount.current = filteredMessages.length;
            return;
        }
        
        const messageCount = filteredMessages.length;
        const hasNewMessages = messageCount > previousMessageCount.current;
        
        if (hasNewMessages) {
            const container = messagesContainerRef.current;
            if (container) {
                requestAnimationFrame(() => {
                    const atBottom = isUserAtBottom();
                    if (atBottom || previousMessageCount.current === 0) {
                        scrollToBottom();
                        logger.log(`⬇️ [NEW_MSG] Scrolled to bottom (${messageCount} messages)`);
                    } else {
                        logger.log('🔍 [NEW_MSG] User scrolled up, skipping auto-scroll');
                    }
                    previousMessageCount.current = messageCount;
                });
            }
        } else {
            previousMessageCount.current = messageCount;
        }
    }, [filteredMessages.length, isOnHomePage]);

    // Загружаем список заблокированных пользователей TTS
    useEffect(() => {
        if (user?.id) {
            loadBlockedUsers();
        }
    }, [user]);

    // 🚀 ANTI-FLASH: Загружаем историю асинхронно без блокировки рендера
    useEffect(() => {
        const hasIntegrations = integrations?.twitch?.enabled || integrations?.vk?.enabled;
        const prevHasIntegrations = prevIntegrationsRef.current.twitch || prevIntegrationsRef.current.vk;
        
        const integrationsEnabled = (integrations?.twitch?.enabled && !prevIntegrationsRef.current.twitch) ||
                                     (integrations?.vk?.enabled && !prevIntegrationsRef.current.vk);
        
        prevIntegrationsRef.current = {
            twitch: integrations?.twitch?.enabled || false,
            vk: integrations?.vk?.enabled || false
        };
        
        if (!hasIntegrations) {
            if (historyLoadedRef.current) {
                logger.log('🧹 [CHAT] Integrations disabled, clearing messages');
                setMessages([]);
                historyLoadedRef.current = false;
            }
            return;
        }
        
        if (integrationsEnabled) {
            logger.log('🔄 [CHAT] Integrations enabled, resetting history flag and loading...');
            historyLoadedRef.current = false;
        }
        
        if (!historyLoadedRef.current && user?.id) {
            logger.log('📜 [CHAT] Loading history...');
            historyLoadedRef.current = true;
        } else if (historyLoadedRef.current) {
            logger.log('⏭️ [CHAT] History already loaded, skipping...');
        }
    }, [user?.id, integrations?.twitch?.enabled, integrations?.vk?.enabled, setMessages]);

    // 🚀 ANTI-FLASH: Загружаем историю с задержкой чтобы не блокировать первый рендер
    const shouldLoadHistory = !historyLoadedRef.current && user?.id;
    useTimeout(() => {
        if (shouldLoadHistory) {
            loadChatHistory();
        }
    }, shouldLoadHistory ? CHAT_CONSTANTS.RENDER_DELAY : null);

    // 🚀 ANTI-FLASH: Загружаем 7TV смайлы асинхронно
    useTimeout(() => {
        if (user?.twitch_username) {
            loadEmotes();
        }
    }, user?.twitch_username ? CHAT_CONSTANTS.EMOJI_LOAD_DELAY : null);

    const loadEmotes = async (): Promise<void> => {
        try {
            const emotesData = await getAllEmotesForChannel(user?.twitch_username || '');
            setEmotes(emotesData);
        } catch (error: any) {
            logger.error('Error loading emotes:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Не удалось загрузить эмодзи';
            toast.error(`Ошибка загрузки эмодзи: ${errorMessage}`);
        }
    };

    const loadChatHistory = async (): Promise<void> => {
        try {
            logger.log('📜 [CHAT] Loading chat history...');
            logger.log('📜 [CHAT] twitchEnabled:', integrations?.twitch?.enabled, 'user.twitch_username:', user?.twitch_username);
            logger.log('📜 [CHAT] vkEnabled:', integrations?.vk?.enabled, 'user.vk_username:', user?.vk_username);
            
            try {
                await twitchBadgesService.loadGlobalBadges();
                if (integrations?.twitch?.enabled && user?.twitch_username) {
                    try {
                        await twitchBadgesService.loadChannelBadges(user.twitch_username);
                        logger.log('✅ [CHAT] Channel badges loaded for:', user.twitch_username);
                    } catch (err) {
                        logger.warn('⚠️ [CHAT] Failed to load channel badges:', err);
                    }
                }
                setBadgesLoaded(true);
                logger.log('✅ [CHAT] Twitch badges loaded before history');
            } catch (error) {
                logger.warn('⚠️ [CHAT] Failed to load badges, continuing anyway:', error);
            }
            
            const limit = CHAT_CONSTANTS.MESSAGE_LIMIT;
            const historyMessages: ChatMessage[] = [];
            
            if (integrations?.twitch?.enabled && user?.twitch_username) {
                try {
                    logger.log('📜 [CHAT] Fetching Twitch history for:', user.twitch_username);
                    const response = await chatService.getChatHistory({
                        platform: 'twitch',
                        channel: user.twitch_username,
                        limit
                    });
                    
                    const data = response.data.data || response.data;
                    if (response.data.success && data.messages) {
                        logger.log(`✅ [CHAT] Loaded ${data.messages.length} Twitch messages`);
                        const messagesWithBadges = data.messages.filter((m: ChatMessage) => m.badges && Array.isArray(m.badges) && m.badges.length > 0);
                        logger.log(`🎖️ [CHAT HISTORY] Messages with badges: ${messagesWithBadges.length}/${data.messages.length}`);
                        if (messagesWithBadges.length > 0) {
                            logger.log('🎖️ [CHAT HISTORY] Sample badge message:', {
                                author: messagesWithBadges[0].author,
                                badges: messagesWithBadges[0].badges,
                                badgesType: typeof messagesWithBadges[0].badges
                            });
                        }
                        historyMessages.push(...(data.messages as ChatMessage[]));
                    } else {
                        logger.log('⚠️ [CHAT] No Twitch messages in response');
                    }
                } catch (error) {
                    logger.error('❌ Error loading Twitch history:', error);
                }
            } else {
                logger.log('⏭️ [CHAT] Skipping Twitch history (not enabled or no username)');
            }
            
            if (integrations?.vk?.enabled && user?.vk_username) {
                try {
                    logger.log('📜 [CHAT] Fetching VK history for:', user.vk_username);
                    const response = await chatService.getChatHistory({
                        platform: 'vk',
                        channel: user.vk_username,
                        limit
                    });
                    
                    const data = response.data.data || response.data;
                    if (response.data.success && data.messages) {
                        logger.log(`✅ [CHAT] Loaded ${data.messages.length} VK messages`);
                        historyMessages.push(...(data.messages as ChatMessage[]));
                    } else {
                        logger.log('⚠️ [CHAT] No VK messages in response');
                    }
                } catch (error) {
                    logger.error('❌ Error loading VK history:', error);
                }
            } else {
                logger.log('⏭️ [CHAT] Skipping VK history (not enabled or no username)');
            }
            
            if (historyMessages.length > 0) {
                historyMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                setMessages(historyMessages);
                logger.log(`✅ [CHAT] Loaded ${historyMessages.length} messages into chat`);
            } else {
                logger.log('📜 [CHAT] No history messages found');
            }
        } catch (error: any) {
            logger.error('❌ Error loading chat history:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Не удалось загрузить историю чата';
            toast.error(`Ошибка загрузки истории: ${errorMessage}`);
        }
    };

    const loadBlockedUsers = async (): Promise<void> => {
        try {
            logger.log('🔇 [CHAT] Loading muted users...');
            
            const response = await chatService.getMutedUsers();
            const data = response.data.data || response.data;
            
            if (response.data.success) {
                const blockedSet = new Set<string>();
                
                (data.blocked_users || []).forEach((u: { platform: string; username: string }) => {
                    blockedSet.add(`${u.platform}:${u.username.toLowerCase()}`);
                });
                
                logger.log(`🔇 [CHAT] Loaded ${blockedSet.size} muted users:`, Array.from(blockedSet));
                setTtsBlockedUsers(blockedSet);
            }
        } catch (error: any) {
            logger.error('Error loading blocked users:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Не удалось загрузить список заблокированных пользователей';
            toast.error(`Ошибка загрузки: ${errorMessage}`);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage): void => {
        e.preventDefault();
        e.stopPropagation();
        
        const x = e.clientX + 2;
        const y = e.clientY + 2;
        
        logger.log(`📍 [CONTEXT MENU] Opening menu:`, {
            x, y,
            clientX: e.clientX,
            clientY: e.clientY,
            user: msg.author_name || msg.author,
            viewport: { width: window.innerWidth, height: window.innerHeight }
        });
        
        setContextMenu({
            x,
            y,
            message: msg
        });
    };

    const handleContextMenuAction = async (action: string, msg: ChatMessage): Promise<void> => {
        const username = msg.author_name || msg.author;
        const platform = msg.platform;
        
        let channelName = msg.channel || msg.channel_name;
        if (!channelName) {
            channelName = platform === 'twitch' ? user?.twitch_username : user?.vk_username;
        }
        
        if (!channelName) {
            logger.error('Channel name not found:', { platform, user });
            toast.error('Канал не найден');
            return;
        }

        try {
            switch (action) {
                case 'block_tts':
                case 'unblock_tts': {
                    logger.log(`🔇 [CHAT MUTE] ${action} для ${username} (${platform})`);
                    
                    const response = await chatService.toggleMute({
                        username,
                        platform,
                        channel_name: channelName
                    });
                    
                    logger.log('🔇 [CHAT MUTE] Response:', response.data);
                    const data = response.data.data || response.data;
                    const resultAction = data?.action;
                    
                    if (resultAction === 'muted') {
                        setTtsBlockedUsers(prev => new Set(prev).add(`${platform}:${username.toLowerCase()}`));
                        toast.success(`🔇 ${username} заглушен в TTS`);
                    } else {
                        setTtsBlockedUsers(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(`${platform}:${username.toLowerCase()}`);
                            return newSet;
                        });
                        toast.success(`🔊 ${username} разглушен в TTS`);
                    }
                    break;
                }

                default:
                    logger.warn('Unknown action:', action);
                    break;
            }
        } catch (error: any) {
            logger.error('Error executing moderation action:', error);
            toast.error(error.response?.data?.detail || 'Ошибка выполнения действия');
        }
    };

    // Состояние для сгенерированного URL
    const [generatedObsUrl, setGeneratedObsUrl] = useState<string>('');
    const [hasExistingUrl, setHasExistingUrl] = useState<boolean>(false);

    // Генерация URL для OBS (один URL с автоматической фильтрацией)
    const generateObsUrl = (): string => {
        const baseUrl = window.location.origin;
        const params = new URLSearchParams({
            width: obsSettings.width.toString(),
            height: obsSettings.height.toString(),
            fontSize: obsSettings.fontSize.toString(),
            fontFamily: obsSettings.fontFamily,
            fontWeight: obsSettings.fontWeight,
            backgroundColor: obsSettings.backgroundColor,
            backgroundImage: obsSettings.backgroundImage,
            textColor: obsSettings.textColor,
            borderRadius: obsSettings.borderRadius.toString(),
            borderColor: obsSettings.borderColor,
            borderWidth: obsSettings.borderWidth.toString(),
            messageBg: obsSettings.messageBg,
            messageBorderRadius: obsSettings.messageBorderRadius.toString(),
            messageMargin: obsSettings.messageMargin.toString(),
            messagePadding: obsSettings.messagePadding.toString(),
            maxMessages: obsSettings.maxMessages.toString(),
            showTimestamps: obsSettings.showTimestamps.toString(),
            showPlatform: obsSettings.showPlatform.toString(),
            showUserRoles: obsSettings.showUserRoles.toString(),
            animationDuration: obsSettings.animationDuration.toString(),
            animationType: obsSettings.animationType,
            moderatorColor: obsSettings.colors.moderator,
            vipColor: obsSettings.colors.vip,
            subscriberColor: obsSettings.colors.subscriber,
            normalColor: obsSettings.colors.normal
        });
        
        if (twitchChatEnabled && vkChatEnabled) {
            params.set('platformFilter', 'combined');
        } else if (twitchChatEnabled) {
            params.set('platformFilter', 'twitch');
        } else if (vkChatEnabled) {
            params.set('platformFilter', 'vk');
        } else {
            params.set('platformFilter', 'all');
        }
        
        if (user && user.id) {
            params.set('userId', user.id.toString());
        }
        
        return `${baseUrl}/chat/obs?${params.toString()}`;
    };

    const handleGenerateObsUrl = (): void => {
        const url = generateObsUrl();
        setGeneratedObsUrl(url);
        setHasExistingUrl(true);
        logger.log('🔗 Generated OBS URL:', url);
    };

    const handleShowExistingUrl = (): void => {
        const url = generateObsUrl();
        setGeneratedObsUrl(url);
        setHasExistingUrl(true);
        logger.log('👁️ Showing existing URL:', url);
    };

    useEffect(() => {
        const hasObsSettings = Object.values(obsSettings).some(value => 
            value !== null && value !== undefined && value !== ''
        );
        setHasExistingUrl(hasObsSettings);
    }, [obsSettings]);

    useEffect(() => {
        if (generatedObsUrl) {
            const newUrl = generateObsUrl();
            if (newUrl !== generatedObsUrl) {
                setGeneratedObsUrl(newUrl);
                logger.log('🔄 URL auto-updated:', newUrl);
            }
        }
    }, [obsSettings, twitchChatEnabled, vkChatEnabled, generatedObsUrl, user]);

    const copyToClipboard = (text: string): void => {
        navigator.clipboard.writeText(text);
        toast.success('URL скопирован в буфер обмена');
    };

    // Экспортируем функции в глобальную область для доступа из отдельного окна чата
    useEffect(() => {
        (window as any).handleChatContextMenuAction = handleContextMenuAction;
        
        return () => {
            delete (window as any).handleChatContextMenuAction;
        };
    }, [handleContextMenuAction]);

    if (showObsSettings) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-6 w-6" />
                            Настройки виджета чата для OBS
                        </CardTitle>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => setShowObsSettings(false)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2"
                        >
                            ← Назад
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Размеры</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ширина (px)</Label>
                                <Input
                                    type="number"
                                    value={obsSettings.width}
                                    onChange={(e) => setObsSettings({ ...obsSettings, width: parseInt(e.target.value) || CHAT_CONSTANTS.DEFAULT_WIDTH })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Высота (px)</Label>
                                <Input
                                    type="number"
                                    value={obsSettings.height}
                                    onChange={(e) => setObsSettings({ ...obsSettings, height: parseInt(e.target.value) || CHAT_CONSTANTS.DEFAULT_HEIGHT })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Внешний вид</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Шрифт</Label>
                                <Select 
                                    value={obsSettings.fontFamily}
                                    onValueChange={(value: string) => setObsSettings({ ...obsSettings, fontFamily: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите шрифт" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Arial">Arial</SelectItem>
                                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                        <SelectItem value="Georgia">Georgia</SelectItem>
                                        <SelectItem value="Verdana">Verdana</SelectItem>
                                        <SelectItem value="Roboto">Roboto</SelectItem>
                                        <SelectItem value="Open Sans">Open Sans</SelectItem>
                                        <SelectItem value="Montserrat">Montserrat</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Размер шрифта</Label>
                                    <span className="text-sm text-muted-foreground">{obsSettings.fontSize}px</span>
                                </div>
                                <Slider
                                    value={[obsSettings.fontSize]}
                                    onValueChange={([value]) => setObsSettings({ ...obsSettings, fontSize: value })}
                                    max={24}
                                    min={10}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Цвет фона</Label>
                                <Input
                                    type="color"
                                    value={obsSettings.backgroundColor}
                                    onChange={(e) => setObsSettings({ ...obsSettings, backgroundColor: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Цвет текста</Label>
                                <Input
                                    type="color"
                                    value={obsSettings.textColor}
                                    onChange={(e) => setObsSettings({ ...obsSettings, textColor: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Скругление углов</Label>
                                    <span className="text-sm text-muted-foreground">{obsSettings.borderRadius}px</span>
                                </div>
                                <Slider
                                    value={[obsSettings.borderRadius]}
                                    onValueChange={([value]) => setObsSettings({ ...obsSettings, borderRadius: value })}
                                    max={20}
                                    min={0}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Ширина границы</Label>
                                    <span className="text-sm text-muted-foreground">{obsSettings.borderWidth}px</span>
                                </div>
                                <Slider
                                    value={[obsSettings.borderWidth]}
                                    onValueChange={([value]) => setObsSettings({ ...obsSettings, borderWidth: value })}
                                    max={10}
                                    min={0}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Сообщения</h3>
                        
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Максимум сообщений</Label>
                                <span className="text-sm text-muted-foreground">{obsSettings.maxMessages}</span>
                            </div>
                            <Slider
                                value={[obsSettings.maxMessages]}
                                onValueChange={([value]) => setObsSettings({ ...obsSettings, maxMessages: value })}
                                max={100}
                                min={10}
                                step={5}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Фильтр платформ</Label>
                            <Select 
                                value={obsSettings.platformFilter}
                                onValueChange={(value: 'twitch' | 'vk' | 'combined' | 'all') => setObsSettings({ ...obsSettings, platformFilter: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите фильтр" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="twitch">Только Twitch</SelectItem>
                                    <SelectItem value="vk">Только VK Live</SelectItem>
                                    <SelectItem value="combined">Объединенный</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="showTimestamps"
                                    checked={obsSettings.showTimestamps}
                                    onChange={(e) => setObsSettings({ ...obsSettings, showTimestamps: e.target.checked })}
                                    className="rounded"
                                />
                                <Label htmlFor="showTimestamps">Показывать время</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="showPlatform"
                                    checked={obsSettings.showPlatform}
                                    onChange={(e) => setObsSettings({ ...obsSettings, showPlatform: e.target.checked })}
                                    className="rounded"
                                />
                                <Label htmlFor="showPlatform">Показывать платформу</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="showUserRoles"
                                    checked={obsSettings.showUserRoles}
                                    onChange={(e) => setObsSettings({ ...obsSettings, showUserRoles: e.target.checked })}
                                    className="rounded"
                                />
                                <Label htmlFor="showUserRoles">Показывать роли</Label>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">URL для OBS</h3>
                        
                        <div className="space-y-2 p-3 border rounded-lg bg-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                <span className="font-medium text-sm">Универсальный чат</span>
                                <span className="text-xs text-muted-foreground">
                                    (автоматически фильтрует по включенным платформам)
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {!generatedObsUrl ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={hasExistingUrl ? handleShowExistingUrl : handleGenerateObsUrl}
                                    >
                                        {hasExistingUrl ? (
                                            <Eye className="h-3 w-3 mr-2" />
                                        ) : (
                                            <RefreshCw className="h-3 w-3 mr-2" />
                                        )}
                                        {hasExistingUrl ? 'Показать URL' : 'Сгенерировать URL'}
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(generatedObsUrl)}
                                        >
                                            <Copy className="h-3 w-3 mr-2" />
                                            Скопировать
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleGenerateObsUrl}
                                        >
                                            <RefreshCw className="h-3 w-3 mr-2" />
                                            Обновить URL
                                        </Button>
                                    </>
                                )}
                            </div>
                            {generatedObsUrl && (
                                <div className="text-xs text-muted-foreground break-all">
                                    {generatedObsUrl}
                                </div>
                            )}
                            {!generatedObsUrl && (
                                <div className="text-xs text-muted-foreground italic">
                                    Нажмите "Сгенерировать URL" чтобы создать ссылку с текущими настройками
                                </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                                <strong>Текущая фильтрация:</strong> {
                                    twitchChatEnabled && vkChatEnabled ? 'Объединенный чат (Twitch + VK Live)' :
                                    twitchChatEnabled ? 'Только Twitch' :
                                    vkChatEnabled ? 'Только VK Live' :
                                    'Все платформы'
                                }
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Основной режим чата
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" />
                        ChatBox
                    </CardTitle>
                    
                    <div className="flex items-center gap-2">
                        {twitchChatEnabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTwitchToggle}
                                className={`h-8 w-20 px-3 transition-all ${
                                    twitchChatVisible 
                                        ? 'bg-purple-800 hover:bg-purple-900 text-white border-purple-800' 
                                        : 'border-gray-400 text-gray-300 hover:border-gray-300 hover:bg-transparent'
                                }`}
                                title={twitchChatVisible ? 'Выключить TTS и скрыть сообщения Twitch' : 'Включить TTS и показать сообщения Twitch'}
                            >
                                <TwitchIcon className="h-4 w-4 mr-1" />
                                {twitchChatVisible ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        {vkChatEnabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleVkToggle}
                                className={`h-8 w-20 px-3 transition-all ${
                                    vkChatVisible 
                                        ? 'bg-rose-700 hover:bg-rose-800 text-white border-rose-700' 
                                        : 'border-gray-400 text-gray-300 hover:border-gray-300 hover:bg-transparent'
                                }`}
                                title={vkChatVisible ? 'Выключить TTS и скрыть сообщения VK' : 'Включить TTS и показать сообщения VK'}
                            >
                                <VKIcon className="h-4 w-4 mr-1" />
                                {vkChatVisible ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowChatBoxModal(true)}
                            title="Настройки ChatBox для OBS"
                            className="h-8 w-20 px-3 transition-all border-gray-400 text-gray-300 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10"
                        >
                            OBS
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const width = 600;
                                const height = 800;
                                const left = (window.screen.width / 2) - (width / 2);
                                const top = (window.screen.height / 2) - (height / 2);
                                window.open(
                                    '/chat-window',
                                    'ChatWindow',
                                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
                                );
                            }}
                            title="Открыть чат в отдельном окне"
                            className="h-8 px-3 transition-all border-gray-400 text-gray-300 hover:border-green-400 hover:text-green-400 hover:bg-green-400/10"
                        >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            В окне
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setChatMessagesVisible(!chatMessagesVisible)}
                            title={chatMessagesVisible ? 'Скрыть сообщения чата' : 'Показать сообщения чата'}
                            className={`h-8 w-8 p-0 transition-all ${
                                chatMessagesVisible 
                                    ? 'text-white border-gray-600 hover:bg-gray-800' 
                                    : 'text-gray-400 border-gray-600 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            {chatMessagesVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {chatMessagesVisible && (twitchChatEnabled || vkChatEnabled) && isOnHomePage ? (
                    <div className="relative">
                        <div 
                            ref={setMessagesContainerRef}
                            onScroll={handleScroll}
                            className="h-[400px] border rounded-lg bg-gray-900/40 overflow-y-auto p-4"
                        >
                            {filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="text-sm">Нет сообщений</p>
                                    <p className="text-xs mt-1">
                                        {isConnected ? 'Ожидание сообщений...' : 'Ожидание подключения...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col min-h-full">
                                    <div className="flex-grow" />
                                    <div className="space-y-0.5">
                                        {filteredMessages.map((msg) => (
                                            <SwipeableMessage
                                                key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author}`}
                                                message={msg}
                                                onSwipeAction={handleContextMenuAction}
                                            >
                                                <div
                                                    className="p-1"
                                                    onContextMenu={(e) => handleContextMenu(e, msg)}
                                                >
                                                    <div className="text-sm leading-relaxed">
                                                        {msg.platform === 'twitch' ? (
                                                            <TwitchIcon 
                                                                className="text-purple-400 inline-block align-text-bottom mr-1" 
                                                                style={{ width: '18px', height: '18px' }}
                                                            />
                                                        ) : (
                                                            <VKIcon 
                                                                className="text-red-400 inline-block align-text-bottom mr-1" 
                                                                style={{ width: '18px', height: '18px' }}
                                                            />
                                                        )}
                                                        
                                                        <span className="text-xs text-muted-foreground mr-1.5 timestamp">
                                                            {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </span>
                                                        
                                                        {msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0 && (
                                                            <>
                                                                {msg.badges.map((badge, idx) => {
                                                                    if (!badge || typeof badge !== 'string' || !badge.includes('/')) {
                                                                        logger.warn('Invalid badge format:', badge);
                                                                        return null;
                                                                    }
                                                                    
                                                                    const [badgeId, version] = badge.split('/');
                                                                    if (!badgeId || !version) {
                                                                        logger.warn('Badge missing id or version:', badge);
                                                                        return null;
                                                                    }
                                                                    
                                                                    const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                                                                    
                                                                    if (!badgeUrl) {
                                                                        if (badgesLoaded) {
                                                                            return null;
                                                                        } else {
                                                                            return (
                                                                                <span 
                                                                                    key={idx} 
                                                                                    className="inline-block align-text-bottom mr-0.5 w-[18px] h-[18px] bg-gray-600 rounded"
                                                                                    title={badge}
                                                                                />
                                                                            );
                                                                        }
                                                                    }
                                                                    
                                                                    return (
                                                                        <img 
                                                                            key={idx} 
                                                                            src={badgeUrl}
                                                                            alt={badgeId}
                                                                            title={badge}
                                                                            className="inline-block align-text-bottom mr-0.5"
                                                                            style={{ width: '18px', height: '18px' }}
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                            }}
                                                                        />
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                        
                                                        <span 
                                                            className={`font-medium cursor-pointer hover:underline ${
                                                                msg.platform === 'twitch' 
                                                                    ? 'text-purple-400' 
                                                                    : msg.platform === 'vk' 
                                                                        ? 'text-red-400' 
                                                                        : ''
                                                            }`}
                                                            style={
                                                                msg.platform === 'twitch' || msg.platform === 'vk'
                                                                    ? undefined
                                                                    : { color: msg.author_color || msg.color || '#ffffff' }
                                                            }
                                                            onClick={(e) => handleContextMenu(e, msg)}
                                                            title="Кликните для открытия меню действий"
                                                        >
                                                            {msg.author_name || msg.author || 'Unknown'}:
                                                        </span>{' '}
                                                        
                                                        <span className="break-words">
                                                            {msg.content || msg.message || 'Нет содержимого'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </SwipeableMessage>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {showScrollButton && (
                            <button
                                onClick={scrollToBottom}
                                className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-colors duration-200 z-10"
                                title="Промотать вниз"
                            >
                                <ArrowDown className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                ) : !chatMessagesVisible && isOnHomePage ? (
                    <div className="min-h-[200px] flex items-center justify-center">
                        <div className="text-center text-muted-foreground py-8">
                            <EyeOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Чат скрыт</p>
                            <p className="text-xs mt-2">Нажмите "Показать чат" для отображения сообщений</p>
                        </div>
                    </div>
                ) : !isOnHomePage ? (
                    <div className="min-h-[200px] flex items-center justify-center">
                        <div className="text-center text-muted-foreground py-8">
                            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Чат активен только на главной странице</p>
                            <p className="text-xs mt-2">Перейдите на главную для просмотра сообщений</p>
                        </div>
                    </div>
                ) : (
                    <div className="min-h-[200px] flex items-center justify-center">
                        <div className="text-center text-muted-foreground py-8">
                            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Чат будет активен автоматически при подключении платформ</p>
                        </div>
                    </div>
                )}

                {!twitchEnabled && !vkEnabled && (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Подключите Twitch или VK Live для использования чата</p>
                    </div>
                )}

                {contextMenu && (
                    <ChatContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        message={contextMenu.message}
                        onClose={() => setContextMenu(null)}
                        onAction={handleContextMenuAction}
                        isTtsBlocked={ttsBlockedUsers.has(`${contextMenu.message.platform}:${(contextMenu.message.author_name || contextMenu.message.author || '').toLowerCase()}`)}
                    />
                )}
            </CardContent>

            <ChatBoxSettingsModal
                isOpen={showChatBoxModal}
                onClose={() => setShowChatBoxModal(false)}
                onSave={() => {
                    // ✅ Toast уже показывается в ChatBoxSettingsModal.handleSave
                }}
            />
        </Card>
    );
};

export default ChatCard;


