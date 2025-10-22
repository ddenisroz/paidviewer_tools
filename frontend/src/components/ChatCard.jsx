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
    Twitch,
    MessageCircle,
    Copy,
    RefreshCw,
    Eye,
    ExternalLink
} from 'lucide-react';
import { VKIcon } from './PlatformIcons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ChatContextMenu from './ChatContextMenu';
import SwipeableMessage from './chat/SwipeableMessage';
import { microservicesAPI } from '../services/microservices';
import { getAllEmotesForChannel } from '../utils/emotes';
import MessageContent from './MessageContent';

const ChatCard = ({ integrations, isOnHomePage = true }) => {
    const { user, isGuest } = useAuth();
    const { messages: chatMessages, isConnected, setMessages } = useChat();
    
    // Автоматическое включение при наличии интеграций
    const [twitchChatVisible, setTwitchChatVisible] = useState(() => {
        // Загружаем из localStorage или используем дефолт true
        const saved = localStorage.getItem('chatFilter_twitch');
        return saved !== null ? saved === 'true' : true;
    });
    const [vkChatVisible, setVkChatVisible] = useState(() => {
        // Загружаем из localStorage или используем дефолт true
        const saved = localStorage.getItem('chatFilter_vk');
        return saved !== null ? saved === 'true' : true;
    });
    
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
    const messagesEndRef = useRef(null);
    
    // Контекстное меню
    const [contextMenu, setContextMenu] = useState(null);
    const [ttsBlockedUsers, setTtsBlockedUsers] = useState(new Set());
    
    // Отдельное окно чата
    const [chatWindow, setChatWindow] = useState(null);
    
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

    // Сохраняем настройки фильтров в localStorage
    useEffect(() => {
        localStorage.setItem('chatFilter_twitch', twitchChatVisible.toString());
    }, [twitchChatVisible]);
    
    useEffect(() => {
        localStorage.setItem('chatFilter_vk', vkChatVisible.toString());
    }, [vkChatVisible]);

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

    // Автоскролл к последнему сообщению
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Автоматический скролл при новых сообщениях (отключен, т.к. новые сообщения вверху)
    // useEffect(() => {
    //     if (filteredMessages.length > 0) {
    //         scrollToBottom();
    //     }
    // }, [filteredMessages.length]);

    // Загружаем список заблокированных пользователей TTS
    useEffect(() => {
        if (user?.id) {
            loadBlockedUsers();
        }
    }, [user]);

    // Загружаем историю сообщений при монтировании
    useEffect(() => {
        if (user?.id && (integrations?.twitch?.enabled || integrations?.vk?.enabled)) {
            loadChatHistory();
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

    const openChatWindow = () => {
        if (chatWindow && !chatWindow.closed) {
            chatWindow.focus();
            return;
        }

        const newWindow = window.open(
            '',
            'chatWindow',
            'width=800,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
        );

        if (newWindow) {
            newWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ru">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Чат - ${user?.twitch_username || 'Streamer'}</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            background: #1a1a1a;
                            color: #ffffff;
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                        }
                        .header {
                            background: #2d2d2d;
                            padding: 12px 16px;
                            border-bottom: 1px solid #404040;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 18px;
                            font-weight: 600;
                        }
                        .status-info {
                            display: flex;
                            flex-direction: column;
                            align-items: flex-end;
                            gap: 4px;
                        }
                        .connection-status {
                            color: #888;
                            font-size: 12px;
                        }
                        .connection-status.connected {
                            color: #4ade80;
                        }
                        .message-count {
                            background: #404040;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 12px;
                        }
                        .messages {
                            flex: 1;
                            overflow-y: auto;
                            padding: 16px;
                            background: #1a1a1a;
                        }
                        .message {
                            display: flex;
                            gap: 8px;
                            margin-bottom: 8px;
                            padding: 4px 8px;
                            border-radius: 4px;
                        }
                        .message:hover {
                            background: rgba(255, 255, 255, 0.05);
                        }
                        .timestamp {
                            color: #888;
                            font-size: 11px;
                            white-space: nowrap;
                        }
                        .platform-icon {
                            width: 16px;
                            height: 16px;
                            margin-top: 2px;
                        }
                        .username {
                            font-weight: 600;
                            white-space: nowrap;
                        }
                        .content {
                            flex: 1;
                            word-break: break-word;
                        }
                        .content img {
                            display: inline-block;
                            width: 24px;
                            height: 24px;
                            vertical-align: middle;
                            margin: 0 2px;
                        }
                        .empty {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 100%;
                            color: #888;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>💬 Чат</h1>
                        <div class="status-info">
                            <div class="connection-status" id="connectionStatus">Ожидание подключения...</div>
                            <div class="message-count" id="messageCount">0 сообщений</div>
                        </div>
                    </div>
                    <div class="messages" id="messages">
                        <div class="empty">
                            <div>💬</div>
                            <div>Нет сообщений</div>
                        </div>
                    </div>
                </body>
                </html>
            `);

            newWindow.document.close();
            setChatWindow(newWindow);

            // Обработчики событий
            const messagesContainer = newWindow.document.getElementById('messages');
            const messageCount = newWindow.document.getElementById('messageCount');
            const connectionStatus = newWindow.document.getElementById('connectionStatus');

            // Функция для обработки смайлов (копия из emotes.js)
            const processEmotes = (message, channelEmotes = new Map(), globalEmotes = new Map()) => {
                if (!message || typeof message !== 'string') {
                    return message;
                }

                // Объединяем канальные и глобальные смайлы
                const allEmotes = new Map([...channelEmotes, ...globalEmotes]);
                
                // Создаем регулярное выражение для поиска смайлов
                const emoteNames = Array.from(allEmotes.keys()).map(name => 
                    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                ).join('|');
                
                if (emoteNames.length === 0) {
                    return message;
                }

                const emoteRegex = new RegExp(`\\b(${emoteNames})\\b`, 'gi');
                
                return message.replace(emoteRegex, (match) => {
                    const emoteName = match.toLowerCase();
                    const emote = allEmotes.get(emoteName) || allEmotes.get(match);
                    
                    if (emote) {
                        return `<img src="${emote.url}" alt="${emote.name}" class="inline-block w-6 h-6 align-middle" title="${emote.name}" />`;
                    }
                    
                    return match;
                });
            };

            // Создаем глобальные данные для отдельного окна
            newWindow.chatData = {
                messages: [],
                emotes: { channelEmotes: new Map(), globalEmotes: new Map() },
                isConnected: false
            };
            
            const updateMessages = () => {
                // Обновляем данные из родительского окна
                newWindow.chatData.messages = chatMessages.slice(-50);
                newWindow.chatData.emotes = emotes;
                newWindow.chatData.isConnected = isConnected;
                
                messagesContainer.textContent = '';
                // Фильтруем сообщения для отдельного окна с учетом видимости платформ
                const messagesToShow = newWindow.chatData.messages.filter(msg => {
                    // Фильтр по платформам с учетом видимости
                    if (msg.platform === 'twitch' && (!twitchChatEnabled || !twitchChatVisible)) {
                        return false;
                    }
                    if (msg.platform === 'vk' && (!vkChatEnabled || !vkChatVisible)) {
                        return false;
                    }
                    return true;
                }).slice(-50); // Лимит 50 сообщений
                if (messagesToShow.length === 0) {
                    const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty';
                const iconDiv = document.createElement('div');
                iconDiv.textContent = '💬';
                const textDiv = document.createElement('div');
                textDiv.textContent = 'Нет сообщений';
                emptyDiv.appendChild(iconDiv);
                emptyDiv.appendChild(textDiv);
                messagesContainer.appendChild(emptyDiv);
                } else {
                    messagesToShow.forEach(msg => {
                        const messageDiv = newWindow.document.createElement('div');
                        messageDiv.className = 'message';
                        
                        const platformIcon = msg.platform === 'twitch' 
                            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>'
                            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#0077FF"><path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.625-3.504-1.686-1.565-1.765-1.602-.313-3.486 1.329-1.728 2.421-3.315 2.421-4.308 0-.897-.481-1.236-1.296-1.236h-3.233c-.612 0-.883.317-1.146.854-.311.635-1.111 2.088-1.785 2.88-.674.792-1.065.974-1.343.974-.311 0-.554-.26-.554-.668V5.31c0-.863-.26-1.236-1.003-1.236H8.937c-.311 0-.554.26-.554.668 0 .88 1.234 1.082 1.362 3.486v5.27c0 1.154-.208 1.363-.485 1.363-.885 0-3.038-3.018-4.317-6.456-.253-.63-.506-.891-1.126-.891H1.584c-.725 0-.87.345-.87.725 0 .955 1.382 6.013 3.233 9.495 1.225 2.311 2.951 3.567 5.164 3.567z"/></svg>';
                        const username = msg.author_name || msg.author || 'Unknown';
                        const content = msg.content || msg.message || '';
                        const timestamp = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });

                        // Обрабатываем смайлы
                        const processedContent = processEmotes(content, newWindow.chatData.emotes.channelEmotes, newWindow.chatData.emotes.globalEmotes);

                        // Создаем элементы безопасно
                        const timestampSpan = newWindow.document.createElement('span');
                        timestampSpan.className = 'timestamp';
                        timestampSpan.textContent = timestamp;
                        
                        const platformIconSpan = newWindow.document.createElement('span');
                        platformIconSpan.className = 'platform-icon';
                        platformIconSpan.innerHTML = platformIcon;
                        
                        const usernameSpan = newWindow.document.createElement('span');
                        usernameSpan.className = 'username';
                        usernameSpan.style.color = msg.author_color || '#ffffff';
                        usernameSpan.textContent = `${username}:`;
                        
                        const contentSpan = newWindow.document.createElement('span');
                        contentSpan.className = 'content';
                        // Используем innerHTML для отображения смайлов
                        if (processedContent && processedContent.includes('<img')) {
                            contentSpan.innerHTML = processedContent;
                        } else {
                            contentSpan.textContent = content;
                        }
                        
                        messageDiv.appendChild(timestampSpan);
                        messageDiv.appendChild(platformIconSpan);
                        messageDiv.appendChild(usernameSpan);
                        messageDiv.appendChild(contentSpan);
                        
                        // Добавляем обработчик правого клика для контекстного меню
                        messageDiv.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            // Создаем простое контекстное меню
                            const contextMenu = newWindow.document.createElement('div');
                            contextMenu.style.cssText = `
                                position: fixed;
                                left: ${e.clientX}px;
                                top: ${e.clientY}px;
                                background: #2d2d2d;
                                border: 1px solid #555;
                                border-radius: 4px;
                                padding: 8px 0;
                                z-index: 1000;
                                min-width: 150px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            `;
                            
                            const menuItem = newWindow.document.createElement('div');
                            menuItem.style.cssText = `
                                padding: 8px 16px;
                                color: white;
                                cursor: pointer;
                                font-size: 14px;
                            `;
                            menuItem.textContent = 'Заблокировать TTS';
                            menuItem.addEventListener('click', async () => {
                                // Вызываем функцию блокировки TTS через window.opener
                                try {
                                    if (window.opener && window.opener.handleChatContextMenuAction) {
                                        await window.opener.handleChatContextMenuAction('block_tts', msg);
                                    } else {
                                        console.error('Parent window function not available');
                                    }
                                } catch (error) {
                                    console.error('Error calling context menu action:', error);
                                }
                                contextMenu.remove();
                            });
                            
                            contextMenu.appendChild(menuItem);
                            newWindow.document.body.appendChild(contextMenu);
                            
                            // Удаляем меню при клике вне его
                            const removeMenu = (e) => {
                                if (!contextMenu.contains(e.target)) {
                                    contextMenu.remove();
                                    newWindow.document.removeEventListener('click', removeMenu);
                                }
                            };
                            setTimeout(() => {
                                newWindow.document.addEventListener('click', removeMenu);
                            }, 100);
                        });
                        
                        messagesContainer.appendChild(messageDiv);
                    });
                }
                
                messageCount.textContent = `${messagesToShow.length} сообщений`;
                // Скроллим только в отдельном окне
                if (newWindow && !newWindow.closed) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            };

            // Обновляем сообщения и статус подключения при изменении
            const updateInterval = setInterval(() => {
                updateMessages();
                // Обновляем статус подключения
                if (isConnected) {
                    connectionStatus.textContent = 'Подключено';
                    connectionStatus.className = 'connection-status connected';
                } else {
                    connectionStatus.textContent = 'Ожидание подключения...';
                    connectionStatus.className = 'connection-status';
                }
            }, 1000);

            // Очистка при закрытии окна
            newWindow.addEventListener('beforeunload', () => {
                clearInterval(updateInterval);
                setChatWindow(null);
            });

            // Начальное обновление
            updateMessages();
        }
    };

    const loadChatHistory = async () => {
        try {
            console.log('📜 [CHAT] Loading chat history...');
            
            const limit = 500; // Загружаем последние 500 сообщений из env
            const historyMessages = [];
            
            // Загружаем историю для Twitch
            if (twitchChatEnabled && user?.twitch_username) {
                try {
                    const response = await microservicesAPI.get(`/api/chat/history`, {
                        params: {
                            platform: 'twitch',
                            channel: user.twitch_username,
                            limit
                        }
                    });
                    
                    if (response.data.success && response.data.messages) {
                        console.log(`📜 [CHAT] Loaded ${response.data.messages.length} Twitch messages`);
                        historyMessages.push(...response.data.messages);
                    }
                } catch (error) {
                    console.error('❌ Error loading Twitch history:', error);
                }
            }
            
            // Загружаем историю для VK
            if (vkChatEnabled && user?.vk_username) {
                try {
                    const response = await microservicesAPI.get(`/api/chat/history`, {
                        params: {
                            platform: 'vk',
                            channel: user.vk_username,
                            limit
                        }
                    });
                    
                    if (response.data.success && response.data.messages) {
                        console.log(`📜 [CHAT] Loaded ${response.data.messages.length} VK messages`);
                        historyMessages.push(...response.data.messages);
                    }
                } catch (error) {
                    console.error('❌ Error loading VK history:', error);
                }
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
        
        // Получаем координаты элемента ника (а не клика)
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        
        // Позиционируем меню под ником (слева)
        const x = rect.left; // Начало ника
        const y = rect.bottom + 4; // Под ником + 4px отступ
        
        console.log(`📍 [CONTEXT MENU] Opening below nickname: x=${x}, y=${y}, for user: ${msg.author_name || msg.author}`);
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
                                onClick={() => setTwitchChatVisible(!twitchChatVisible)}
                                className={`h-8 w-20 px-3 transition-all ${
                                    twitchChatVisible 
                                        ? 'bg-purple-800 hover:bg-purple-900 text-white border-purple-800' 
                                        : 'border-gray-400 text-gray-300 hover:border-gray-300 hover:bg-transparent'
                                }`}
                                title={twitchChatVisible ? 'Скрыть Twitch сообщения' : 'Показать Twitch сообщения'}
                            >
                                <Twitch className="h-3 w-3 mr-1" />
                                {twitchChatVisible ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        {vkChatEnabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setVkChatVisible(!vkChatVisible)}
                                className={`h-8 w-20 px-3 transition-all ${
                                    vkChatVisible 
                                        ? 'bg-blue-400 hover:bg-blue-500 text-white border-blue-400' 
                                        : 'border-gray-400 text-gray-300 hover:border-gray-300 hover:bg-transparent'
                                }`}
                                title={vkChatVisible ? 'Скрыть VK Live сообщения' : 'Показать VK Live сообщения'}
                            >
                                <VKIcon className="h-3 w-3 mr-1" />
                                {vkChatVisible ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowObsSettings(true)}
                            title="Настройки виджета OBS"
                            className="h-8 w-20 px-3 transition-all border-gray-400 text-gray-300 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10"
                        >
                            OBS
                        </Button>
                        {(twitchChatEnabled || vkChatEnabled) && isOnHomePage && (
                            <Button 
                                onClick={openChatWindow}
                                variant="outline"
                                size="sm"
                                className="h-8 w-20 px-2 gap-1 transition-all border-gray-400 text-gray-300 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10"
                                title="Открыть чат в отдельном окне"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="text-xs">Окно</span>
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">

                {/* Отображение сообщений (автоматически включено при наличии интеграций) */}
                {(twitchChatEnabled || vkChatEnabled) && isOnHomePage ? (
                    <div>
                        {/* Область сообщений - увеличена высота */}
                        <div className="h-[400px] border rounded-lg bg-muted/5 overflow-y-auto p-4 flex flex-col-reverse">
                            {filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="text-sm">Нет сообщений</p>
                                    <p className="text-xs mt-1">
                                        {isConnected ? 'Ожидание сообщений...' : 'Ожидание подключения...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {filteredMessages.slice(-100).reverse().map((msg, index) => (
                                        <SwipeableMessage
                                            key={`${msg.id || index}-${msg.timestamp}`}
                                            message={msg}
                                            onSwipeAction={handleContextMenuAction}
                                        >
                                            <div
                                                className="flex items-start gap-1.5 p-1 rounded hover:bg-muted/50 transition-colors"
                                                onContextMenu={(e) => handleContextMenu(e, msg)}
                                            >
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {msg.platform === 'twitch' ? (
                                                        <Twitch className="w-3.5 h-3.5 text-purple-400" />
                                                    ) : (
                                                        <VKIcon className="w-3.5 h-3.5 text-red-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </span>
                                                        <span 
                                                            className={`font-medium text-sm cursor-pointer hover:underline ${
                                                                msg.platform === 'twitch' 
                                                                    ? 'text-purple-400' 
                                                                    : msg.platform === 'vk' 
                                                                        ? 'text-red-400' 
                                                                        : ''
                                                            }`}
                                                            style={
                                                                msg.platform === 'twitch' || msg.platform === 'vk'
                                                                    ? undefined // Используем Tailwind класс для платформ
                                                                    : { color: msg.author_color || '#ffffff' } // Fallback для других платформ
                                                            }
                                                            onClick={(e) => handleContextMenu(e, msg)}
                                                            title="Кликните для открытия меню действий"
                                                        >
                                                            {msg.author_name || msg.author || 'Unknown'}:
                                                        </span>
                                                        <span className="text-sm break-words">
                                                            {msg.content || msg.message || 'Нет содержимого'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </SwipeableMessage>
                                    ))}
                                    <div ref={messagesEndRef} />
                                    </div>
                                )}
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
                            {user?.id && <p className="text-xs mt-2">Пользователь: {user.username || user.twitch_username || user.vk_username}</p>}
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

        </Card>
    );
};

export default ChatCard;