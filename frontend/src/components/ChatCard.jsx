// src/components/ChatCard.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    MessageSquare, 
    Settings,
    X,
    Merge,
    MessageCircle,
    Copy,
    RefreshCw,
    ArrowDown,
    Eye,
    EyeOff,
    ExternalLink
} from 'lucide-react';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ChatContextMenu from './ChatContextMenu';
import SwipeableMessage from './chat/SwipeableMessage';
import { microservicesAPI } from '../services/microservices';
import { getAllEmotesForChannel } from '../utils/emotes';
import { twitchBadgesService } from '../services/twitchBadges';
import MessageContent from './MessageContent';
import ChatBoxSettingsModal from './ChatBoxSettingsModal';

const ChatCard = ({ integrations, isOnHomePage = true }) => {
    const { user, isGuest } = useAuth();
    const { messages: chatMessages, isConnected, setMessages } = useChat();
    
    // Фильтрация сообщений + TTS настройки платформ
    // ❌ УБРАНО: больше НЕ загружаем из localStorage, только из API
    const [twitchChatVisible, setTwitchChatVisible] = useState(true);  // Дефолтные значения
    const [vkChatVisible, setVkChatVisible] = useState(true);  // Будут обновлены из API
    
    // TTS настройки (для синхронизации с кнопками-шорткатами)
    const [ttsSettings, setTtsSettings] = useState({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });
    
    // Показывать кнопку прокрутки вниз
    const [showScrollButton, setShowScrollButton] = useState(false);
    
    // Видимость чата (для кнопки "Скрыть чат") - сохраняется в localStorage
    const [chatMessagesVisible, setChatMessagesVisible] = useState(() => {
        const saved = localStorage.getItem('chatMessagesVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });
    
    // Сохраняем состояние видимости чата в localStorage при изменении
    useEffect(() => {
        localStorage.setItem('chatMessagesVisible', JSON.stringify(chatMessagesVisible));
    }, [chatMessagesVisible]);
    
    // State для отслеживания загрузки badges
    const [badgesLoaded, setBadgesLoaded] = useState(false);
    
    // Ref для предотвращения повторной загрузки badges и истории
    const badgesLoadedRef = useRef(false);
    const historyLoadedRef = useRef(false);
    
    // Загрузка TTS настроек и Twitch badges при монтировании (только 1 раз)
    useEffect(() => {
        // 🧹 Очистка ВСЕХ старых localStorage значений (больше не используются)
        const obsoleteKeys = [
            'chatFilter_twitch',
            'chatFilter_vk',
            'token',  // Старый Bearer token (заменён на cookies)
            'auth_token',  // Возможные старые ключи
            'user_token'
        ];
        
        obsoleteKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                console.log(`🧹 [CLEANUP] Removed obsolete localStorage key: ${key}`);
            }
        });
        
        console.log('🧹 [CLEANUP] Finished cleaning up obsolete localStorage');
        
        const loadTtsSettings = async () => {
            try {
                const response = await microservicesAPI.get('/api/tts/platform-settings', {
                    params: { _t: Date.now() }  // Cache-busting достаточно
                });
                setTtsSettings(response.data);
                console.log('✅ [TTS SHORTCUT] Settings loaded:', response.data);
                console.log('✅ [TTS SHORTCUT] enabled_platforms:', response.data.enabled_platforms);
                
                // 🔄 СИНХРОНИЗАЦИЯ: Обновляем видимость платформ на основе API (не localStorage)
                const enabledPlatforms = response.data.enabled_platforms || [];
                setTwitchChatVisible(enabledPlatforms.includes('twitch'));
                setVkChatVisible(enabledPlatforms.includes('vk'));
                console.log('🔄 [TTS SHORTCUT] Synced visibility from API:', {
                    enabled_platforms: enabledPlatforms,
                    twitch: enabledPlatforms.includes('twitch'),
                    vk: enabledPlatforms.includes('vk')
                });
            } catch (error) {
                console.error('❌ [TTS SHORTCUT] Error loading settings:', error);
            }
        };
        const loadBadges = async () => {
            // Предотвращаем повторную загрузку
            if (badgesLoadedRef.current) {
                console.log('⏭️ [BADGES] Already loaded, skipping...');
                return;
            }
            
            try {
                await twitchBadgesService.loadGlobalBadges();
                console.log('✅ [BADGES] Twitch badges loaded');
                badgesLoadedRef.current = true;
                setBadgesLoaded(true); // Триггерим ре-рендер
            } catch (error) {
                console.error('❌ [BADGES] Error loading badges:', error);
            }
        };
        loadTtsSettings();
        loadBadges();
        
        // 🔄 Слушаем изменения TTS настроек из верхних переключателей
        const handleTtsSettingsChanged = (event) => {
            const { enabledPlatforms } = event.detail;
            console.log('🔄 [TTS SHORTCUT] Received settings update:', enabledPlatforms);
            setTwitchChatVisible(enabledPlatforms.includes('twitch'));
            setVkChatVisible(enabledPlatforms.includes('vk'));
            setTtsSettings(prev => ({
                ...prev,
                enabled_platforms: enabledPlatforms
            }));
        };
        
        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged);
        
        return () => {
            window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged);
        };
    }, []);
    
    // Шорткат: Переключение TTS + фильтрации для Twitch
    const handleTwitchToggle = async () => {
        const newVisible = !twitchChatVisible;
        
        // 1. Переключаем фильтрацию в ChatBox
        setTwitchChatVisible(newVisible);
        // ❌ УБРАНО: больше НЕ сохраняем в localStorage
        
        // 2. Переключаем TTS для платформы
        try {
            // Проверяем что ttsSettings.enabled_platforms существует и является массивом
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('twitch');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('twitch');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            await microservicesAPI.post('/api/tts/platform-settings', {
                enabled_platforms: enabledPlatforms
            });
            
            setTtsSettings({
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            });
            
            // 🔄 Отправляем событие для синхронизации с верхними переключателями
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            console.log(`🎮 [TTS SHORTCUT] Twitch ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`Twitch озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            console.error('❌ [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Шорткат: Переключение TTS + фильтрации для VK
    const handleVkToggle = async () => {
        const newVisible = !vkChatVisible;
        
        // 1. Переключаем фильтрацию в ChatBox
        setVkChatVisible(newVisible);
        // ❌ УБРАНО: больше НЕ сохраняем в localStorage
        
        // 2. Переключаем TTS для платформы
        try {
            // Проверяем что ttsSettings.enabled_platforms существует и является массивом
            const enabledPlatforms = Array.isArray(ttsSettings?.enabled_platforms) 
                ? [...ttsSettings.enabled_platforms] 
                : [];
            
            const index = enabledPlatforms.indexOf('vk');
            
            if (newVisible && index === -1) {
                enabledPlatforms.push('vk');
            } else if (!newVisible && index > -1) {
                enabledPlatforms.splice(index, 1);
            }
            
            await microservicesAPI.post('/api/tts/platform-settings', {
                enabled_platforms: enabledPlatforms
            });
            
            setTtsSettings({
                ...ttsSettings,
                enabled_platforms: enabledPlatforms
            });
            
            // 🔄 Отправляем событие для синхронизации с верхними переключателями
            window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                detail: { enabledPlatforms: enabledPlatforms }
            }));
            
            console.log(`📺 [TTS SHORTCUT] VK ${newVisible ? 'включен' : 'выключен'}`);
            toast.success(`VK озвучка ${newVisible ? 'включена' : 'выключена'}`);
        } catch (error) {
            console.error('❌ [TTS SHORTCUT] Error saving:', error);
            toast.error('Ошибка сохранения настроек TTS');
        }
    };
    
    // Чат включен автоматически, если есть хотя бы одна интеграция или если это гость
    let twitchEnabled, vkEnabled;
    if (isGuest) {
        // Для гостей показываем чат только той платформы, к которой подключен гость
        twitchEnabled = user?.platform === 'twitch';
        vkEnabled = user?.platform === 'vk';
    } else {
        // Для обычных пользователей используем интеграции
        twitchEnabled = integrations?.twitch?.enabled;
        vkEnabled = integrations?.vk?.enabled;
    }
    
    const twitchChatEnabled = twitchEnabled && isOnHomePage;
    const vkChatEnabled = vkEnabled && isOnHomePage;
    
    // Автоматическое объединение: если включены обе платформы, то показываем объединенный чат
    const combinedChat = twitchChatEnabled && vkChatEnabled;
    const [showObsSettings, setShowObsSettings] = useState(false);
    const [showChatBoxModal, setShowChatBoxModal] = useState(false);
    const messagesEndRef = useRef(null);
    
    // Контекстное меню
    const [contextMenu, setContextMenu] = useState(null);
    const [ttsBlockedUsers, setTtsBlockedUsers] = useState(new Set());
    
    // 7TV смайлы
    const [emotes, setEmotes] = useState({ channelEmotes: new Map(), globalEmotes: new Map() });
    
    // Настройки виджета для OBS
    const [obsSettings, setObsSettings] = useState({
        // Размеры
        width: 400,
        height: 300,
        
        // Внешний вид
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backgroundImage: 'none',
        textColor: '#ffffff',
        borderRadius: 8,
        borderColor: '#333',
        borderWidth: 2,
        
        // Сообщения
        messageBg: 'rgba(255, 255, 255, 0.1)',
        messageBorderRadius: 4,
        messageMargin: 4,
        messagePadding: 8,
        maxMessages: 50,
        showTimestamps: false,
        showPlatform: true,
        showUserRoles: true,
        
        // Анимации
        animationDuration: 0.3,
        animationType: 'slide-in',
        
        // Платформы
        platforms: {
            twitch: true,
            vk: true,
            combined: true
        },
        platformFilter: 'combined',
        
        // Цвета ролей
        colors: {
            moderator: '#00ff00',
            vip: '#ff6b6b',
            subscriber: '#4ecdc4',
            normal: '#ffffff'
        }
    });

    // ❌ УБРАНО: больше НЕ сохраняем в localStorage, используем только API

    // Фильтруем сообщения по включенным платформам и видимости
    const filteredMessages = useMemo(() => {
        // Если не на главной странице - не показываем сообщения
        if (!isOnHomePage) {
            return [];
        }
        
        return chatMessages.filter(msg => {
            // Фильтр по платформам
            if (msg.platform === 'twitch' && (!twitchChatEnabled || !twitchChatVisible)) {
                return false;
            }
            if (msg.platform === 'vk' && (!vkChatEnabled || !vkChatVisible)) {
                return false;
            }
            return true;
        }).slice(-50); // Ограничиваем последними 50 сообщениями
    }, [chatMessages, twitchChatEnabled, vkChatEnabled, twitchChatVisible, vkChatVisible, isOnHomePage]);

    // Логирование для отладки
    useEffect(() => {
        // 💬 ChatCard - Total messages:', chatMessages.length, 'Filtered:', filteredMessages.length);
        // 💬 ChatCard - Messages array:', chatMessages.slice(0, 3));
    }, [chatMessages, filteredMessages]);

    // Ref для контейнера сообщений
    const messagesContainerRef = useRef(null);

    // Автоскролл к последнему сообщению
    const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (container) {
            // Используем scrollTop вместо scrollIntoView - НЕ скроллит страницу!
            container.scrollTop = container.scrollHeight;
        }
    };

    // Проверка: пользователь внизу контейнера?
    const isUserAtBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        
        const threshold = 150; // 150px от низа = считаем что внизу (увеличено для компенсации отступов)
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return distanceFromBottom < threshold;
    };
    
    // Обработчик скролла для показа/скрытия кнопки
    const handleScroll = () => {
        const atBottom = isUserAtBottom();
        setShowScrollButton(!atBottom);
    };

    // Автоматический скролл при ПЕРВОЙ загрузке (показываем новые сообщения)
    const hasScrolledOnLoad = useRef(false);
    useEffect(() => {
        if (chatMessages.length > 0 && !hasScrolledOnLoad.current) {
            // При первой загрузке ВСЕГДА скроллим вниз (мгновенно)
            setTimeout(() => {
                const container = messagesContainerRef.current;
                if (container) {
                    // Используем scrollTop - НЕ вызывает скролл страницы!
                    container.scrollTop = container.scrollHeight;
                    console.log('⬇️ Auto-scrolled to bottom on initial load');
                }
            }, 100);
            hasScrolledOnLoad.current = true;
        }
    }, [chatMessages.length]);
    
    // Автоматический скролл при новых сообщениях (только если пользователь внизу)
    const lastMessageId = filteredMessages.length > 0 ? filteredMessages[filteredMessages.length - 1]?.id : null;
    useEffect(() => {
        if (filteredMessages.length > 0 && hasScrolledOnLoad.current && lastMessageId) {
            // Проверяем позицию скролла ПОСЛЕ рендера
            // Используем requestAnimationFrame для гарантированного ожидания рендера
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const atBottom = isUserAtBottom();
                    console.log('🔍 [AUTOSCROLL] Check:', { atBottom, lastMessageId: String(lastMessageId).substring(0, 20) });
                    if (atBottom) {
                        scrollToBottom();
                        console.log('⬇️ [AUTOSCROLL] Scrolling to bottom');
                    }
                }, 0);
            });
        }
    }, [lastMessageId]); // Следим только за последним сообщением

    // Загружаем список заблокированных пользователей TTS
    useEffect(() => {
        if (user?.id) {
            loadBlockedUsers();
        }
    }, [user]);

    // Загружаем историю сообщений при монтировании (только 1 раз)
    useEffect(() => {
        // Предотвращаем повторную загрузку
        if (historyLoadedRef.current) {
            console.log('⏭️ [CHAT] History already loaded, skipping...');
            return;
        }
        
        if (user?.id && (integrations?.twitch?.enabled || integrations?.vk?.enabled)) {
            loadChatHistory();
            historyLoadedRef.current = true;
        }
    }, [user?.id, integrations?.twitch?.enabled, integrations?.vk?.enabled]);

    // Загружаем 7TV смайлы
    useEffect(() => {
        if (user?.twitch_username) {
            loadEmotes();
        }
    }, [user?.twitch_username]);

    const loadEmotes = async () => {
        try {
            // 🎭 Loading 7TV emotes for channel:', user.twitch_username);
            const emotesData = await getAllEmotesForChannel(user.twitch_username);
            // 🎭 Loaded emotes:', emotesData);
            setEmotes(emotesData);
        } catch (error) {
            console.error('Error loading emotes:', error);
        }
    };

    const loadChatHistory = async () => {
        try {
            console.log('📜 [CHAT] Loading chat history...');
            console.log('📜 [CHAT] twitchEnabled:', integrations?.twitch?.enabled, 'user.twitch_username:', user?.twitch_username);
            console.log('📜 [CHAT] vkEnabled:', integrations?.vk?.enabled, 'user.vk_username:', user?.vk_username);
            
            // Убеждаемся что badges загружены ДО загрузки истории
            try {
                await twitchBadgesService.loadGlobalBadges();
                setBadgesLoaded(true); // Устанавливаем СРАЗУ чтобы badges рендерились
                console.log('✅ [CHAT] Twitch badges loaded before history');
                                } catch (error) {
                console.warn('⚠️ [CHAT] Failed to load badges, continuing anyway:', error);
            }
            
            const limit = 500; // Загружаем последние 500 сообщений из env
            const historyMessages = [];
            
            // Загружаем историю для Twitch (не проверяем isOnHomePage - это для отображения, а не для загрузки)
            if (integrations?.twitch?.enabled && user?.twitch_username) {
                try {
                    console.log('📜 [CHAT] Fetching Twitch history for:', user.twitch_username);
                    const response = await microservicesAPI.get(`/api/chat/history`, {
                        params: {
                            platform: 'twitch',
                            channel: user.twitch_username,
                            limit
                        }
                    });
                    
                    if (response.data.success && response.data.messages) {
                        console.log(`✅ [CHAT] Loaded ${response.data.messages.length} Twitch messages`);
                        // Отладка: проверяем первое сообщение на badges
                        if (response.data.messages[0]) {
                            console.log('🎖️ [CHAT HISTORY] First message badges:', response.data.messages[0].badges, 'type:', typeof response.data.messages[0].badges);
                            console.log('🎖️ [CHAT HISTORY] First message role:', response.data.messages[0].role);
                        }
                        historyMessages.push(...response.data.messages);
                    } else {
                        console.log('⚠️ [CHAT] No Twitch messages in response');
                    }
                } catch (error) {
                    console.error('❌ Error loading Twitch history:', error);
                }
            } else {
                console.log('⏭️ [CHAT] Skipping Twitch history (not enabled or no username)');
            }
            
            // Загружаем историю для VK
            if (integrations?.vk?.enabled && user?.vk_username) {
                try {
                    console.log('📜 [CHAT] Fetching VK history for:', user.vk_username);
                    const response = await microservicesAPI.get(`/api/chat/history`, {
                        params: {
                            platform: 'vk',
                            channel: user.vk_username,
                            limit
                        }
                    });
                    
                    if (response.data.success && response.data.messages) {
                        console.log(`✅ [CHAT] Loaded ${response.data.messages.length} VK messages`);
                        historyMessages.push(...response.data.messages);
                    } else {
                        console.log('⚠️ [CHAT] No VK messages in response');
                    }
                } catch (error) {
                    console.error('❌ Error loading VK history:', error);
                }
            } else {
                console.log('⏭️ [CHAT] Skipping VK history (not enabled or no username)');
            }
            
            // Устанавливаем загруженные сообщения в состояние чата
            if (historyMessages.length > 0) {
                // Сортируем по timestamp (старые в начале)
                historyMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // Обновляем состояние чата историческими сообщениями
                setMessages(historyMessages);
                console.log(`✅ [CHAT] Loaded ${historyMessages.length} messages into chat`);
            } else {
                console.log('📜 [CHAT] No history messages found');
            }
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
        }
    };

    const loadBlockedUsers = async () => {
        try {
            console.log('🔇 [CHAT] Loading muted users...');
            
            // Используем единый endpoint для обеих платформ
            const response = await microservicesAPI.get('/api/moderation/muted-users');
            
            if (response.data.success) {
                const blockedSet = new Set();
                
                response.data.blocked_users.forEach(u => {
                    blockedSet.add(`${u.platform}:${u.username.toLowerCase()}`);
                });
                
                console.log(`🔇 [CHAT] Loaded ${blockedSet.size} muted users:`, Array.from(blockedSet));
                setTtsBlockedUsers(blockedSet);
            }
        } catch (error) {
            console.error('Error loading blocked users:', error);
        }
    };

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Используем координаты клика мыши + небольшой сдвиг, чтобы курсор не перекрывал меню
        const x = e.clientX + 2;
        const y = e.clientY + 2;
        
        console.log(`📍 [CONTEXT MENU] Opening menu:`, {
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

    const handleContextMenuAction = async (action, msg) => {
        const username = msg.author_name || msg.author;
        const platform = msg.platform;
        
        // Получаем имя канала из сообщения или из пользователя
        let channelName = msg.channel;
        if (!channelName) {
            channelName = platform === 'twitch' ? user?.twitch_username : user?.vk_username;
        }
        
        // Context menu action:', { action, username, platform, channelName, msg });
        
        if (!channelName) {
            console.error('Channel name not found:', { platform, user });
            toast.error('Канал не найден');
            return;
        }

        try {
        switch (action) {
            case 'block_tts':
            case 'unblock_tts': {
                console.log(`🔇 [CHAT MUTE] ${action} для ${username} (${platform})`);
                    
                const response = await microservicesAPI.post('/api/moderation/toggle-mute', {
                    username,
                    platform,
                    channel_name: channelName,
                    duration_seconds: 0,  // Не применяем платформенный мут
                    reason: action === 'block_tts' ? 'Заглушен в TTS' : undefined
                });
                
                console.log('🔇 [CHAT MUTE] Response:', response.data);
                
                const resultAction = response.data?.action;  // 'muted' или 'unmuted'
                
                // Обновляем локальный state
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
                console.warn('Unknown action:', action);
                break;
            }
        } catch (error) {
            console.error('Error executing moderation action:', error);
            toast.error(error.response?.data?.detail || 'Ошибка выполнения действия');
        }
    };

    // Состояние для сгенерированного URL
    const [generatedObsUrl, setGeneratedObsUrl] = useState('');
    const [hasExistingUrl, setHasExistingUrl] = useState(false);

    // Генерация URL для OBS (один URL с автоматической фильтрацией)
    const generateObsUrl = () => {
        const baseUrl = window.location.origin;
        const params = new URLSearchParams({
            width: obsSettings.width,
            height: obsSettings.height,
            fontSize: obsSettings.fontSize,
            fontFamily: obsSettings.fontFamily,
            fontWeight: obsSettings.fontWeight,
            backgroundColor: obsSettings.backgroundColor,
            backgroundImage: obsSettings.backgroundImage,
            textColor: obsSettings.textColor,
            borderRadius: obsSettings.borderRadius,
            borderColor: obsSettings.borderColor,
            borderWidth: obsSettings.borderWidth,
            messageBg: obsSettings.messageBg,
            messageBorderRadius: obsSettings.messageBorderRadius,
            messageMargin: obsSettings.messageMargin,
            messagePadding: obsSettings.messagePadding,
            maxMessages: obsSettings.maxMessages,
            showTimestamps: obsSettings.showTimestamps,
            showPlatform: obsSettings.showPlatform,
            showUserRoles: obsSettings.showUserRoles,
            animationDuration: obsSettings.animationDuration,
            animationType: obsSettings.animationType,
            // Цвета ролей
            moderatorColor: obsSettings.colors.moderator,
            vipColor: obsSettings.colors.vip,
            subscriberColor: obsSettings.colors.subscriber,
            normalColor: obsSettings.colors.normal
        });
        
        // Автоматическая фильтрация на основе включенных платформ
        if (twitchChatEnabled && vkChatEnabled) {
            // Если включены обе платформы - показываем все сообщения
            params.set('platformFilter', 'combined');
        } else if (twitchChatEnabled) {
            // Если включен только Twitch
            params.set('platformFilter', 'twitch');
        } else if (vkChatEnabled) {
            // Если включен только VK
            params.set('platformFilter', 'vk');
        } else {
            // Если ничего не включено - показываем все (пустой фильтр)
            params.set('platformFilter', 'all');
        }
        
        // Добавляем ID пользователя для получения его личного чата
        if (user && user.id) {
            params.set('userId', user.id.toString());
        }
        
        return `${baseUrl}/chat/obs?${params.toString()}`;
    };

    // Функция для генерации и отображения URL
    const handleGenerateObsUrl = () => {
        const url = generateObsUrl();
        setGeneratedObsUrl(url);
        setHasExistingUrl(true);
        console.log('🔗 Generated OBS URL:', url);
    };

    // Функция для показа существующего URL
    const handleShowExistingUrl = () => {
        const url = generateObsUrl();
        setGeneratedObsUrl(url);
        setHasExistingUrl(true);
        console.log('👁️ Showing existing URL:', url);
    };

    // Проверяем, есть ли уже сохраненные настройки OBS (значит URL уже был сгенерирован)
    useEffect(() => {
        const hasObsSettings = Object.values(obsSettings).some(value => 
            value !== null && value !== undefined && value !== ''
        );
        setHasExistingUrl(hasObsSettings);
    }, [obsSettings]);

    // Автоматически обновляем URL при изменении настроек (если URL уже был сгенерирован)
    useEffect(() => {
        if (generatedObsUrl) {
            const newUrl = generateObsUrl();
            if (newUrl !== generatedObsUrl) {
                setGeneratedObsUrl(newUrl);
                console.log('🔄 URL auto-updated:', newUrl);
            }
        }
    }, [obsSettings, twitchChatEnabled, vkChatEnabled, generatedObsUrl, user]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('URL скопирован в буфер обмена');
    };


    // Экспортируем функции в глобальную область для доступа из отдельного окна чата
    React.useEffect(() => {
        window.handleChatContextMenuAction = handleContextMenuAction;
        
        return () => {
            // Очищаем при размонтировании
            delete window.handleChatContextMenuAction;
        };
    }, [handleContextMenuAction]);

    if (showObsSettings) {
        // Режим настроек виджета OBS
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
                    {/* Размеры */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Размеры</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ширина (px)</Label>
                                <Input
                                    type="number"
                                    value={obsSettings.width}
                                    onChange={(e) => setObsSettings({ ...obsSettings, width: parseInt(e.target.value) || 400 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Высота (px)</Label>
                                <Input
                                    type="number"
                                    value={obsSettings.height}
                                    onChange={(e) => setObsSettings({ ...obsSettings, height: parseInt(e.target.value) || 300 })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Внешний вид */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Внешний вид</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Шрифт</Label>
                                <Select 
                                    value={obsSettings.fontFamily}
                                    onValueChange={(value) => setObsSettings({ ...obsSettings, fontFamily: value })}
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

                    {/* Сообщения */}
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
                                onValueChange={(value) => setObsSettings({ ...obsSettings, platformFilter: value })}
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
                                <Switch
                                    id="showTimestamps"
                                    checked={obsSettings.showTimestamps}
                                    onCheckedChange={(checked) => setObsSettings({ ...obsSettings, showTimestamps: checked })}
                                />
                                <Label htmlFor="showTimestamps">Показывать время</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="showPlatform"
                                    checked={obsSettings.showPlatform}
                                    onCheckedChange={(checked) => setObsSettings({ ...obsSettings, showPlatform: checked })}
                                />
                                <Label htmlFor="showPlatform">Показывать платформу</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="showUserRoles"
                                    checked={obsSettings.showUserRoles}
                                    onCheckedChange={(checked) => setObsSettings({ ...obsSettings, showUserRoles: checked })}
                                />
                                <Label htmlFor="showUserRoles">Показывать роли</Label>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* URL для OBS */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">URL для OBS</h3>
                        
                        {/* Универсальный URL с автоматической фильтрацией */}
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
                {/* Одна строка: заголовок слева, кнопки справа */}
                <div className="flex items-center justify-between gap-2">
                    {/* Заголовок слева */}
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" />
                        ChatBox
                    </CardTitle>
                    
                    {/* Все кнопки справа */}
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

                {/* Отображение сообщений (автоматически включено при наличии интеграций) */}
                {chatMessagesVisible && (twitchChatEnabled || vkChatEnabled) && isOnHomePage ? (
                    <div className="relative">
                        {/* Область сообщений - увеличена высота */}
                        <div 
                            ref={messagesContainerRef}
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
                                    {/* Пустой элемент чтобы прижать сообщения к низу */}
                                    <div className="flex-grow" />
                                    {/* Сообщения */}
                                <div className="space-y-0.5">
                                        {filteredMessages.map((msg) => (
                                        <SwipeableMessage
                                            key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author}`}
                                            message={msg}
                                            onSwipeAction={handleContextMenuAction}
                                        >
                                            <div
                                                className={`p-1`}
                                                onContextMenu={(e) => handleContextMenu(e, msg)}
                                            >
                                                <div className="text-sm leading-relaxed">
                                                        {/* Иконка платформы */}
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
                                                        
                                                        <span className="text-xs text-muted-foreground mr-1.5">
                                                            {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </span>
                                                        
                                                        {/* Badges (значки Twitch) - только если badges загружены */}
                                                        {badgesLoaded && msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0 && (
                                                            <>
                                                                {msg.badges.map((badge, idx) => {
                                                                    const [badgeId, version] = badge.split('/');
                                                                    const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                                                                    
                                                                    // Пропускаем badge если URL не найден
                                                                    if (!badgeUrl) return null;
                                                                    
                                                                    return (
                                                                        <img 
                                                                            key={idx} 
                                                                            src={badgeUrl}
                                                                            alt={badgeId}
                                                                            title={badge}
                                                                            className="inline-block align-text-bottom mr-0.5"
                                                                            style={{ width: '18px', height: '18px' }}
                                                                            onError={(e) => {
                                                                                // Скрываем badge если не загрузился
                                                                                e.target.style.display = 'none';
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
                                                                    : { color: msg.author_color || '#ffffff' }
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
                        
                        {/* Кнопка прокрутки вниз */}
                        {showScrollButton && (
                            <button
                                onClick={scrollToBottom}
                                className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 z-10"
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

                {/* Если платформы не подключены */}
                {!twitchEnabled && !vkEnabled && (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Подключите Twitch или VK Live для использования чата</p>
                    </div>
                )}

                {/* Контекстное меню */}
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

            {/* ChatBox Settings Modal */}
            <ChatBoxSettingsModal
                isOpen={showChatBoxModal}
                onClose={() => setShowChatBoxModal(false)}
                onSave={() => {
                    // ✅ Toast уже показывается в ChatBoxSettingsModal.handleSave
                    // Не дублируем уведомления
                }}
            />

        </Card>
    );
};

export default ChatCard;