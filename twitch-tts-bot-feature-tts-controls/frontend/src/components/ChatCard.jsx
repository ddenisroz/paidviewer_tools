// src/components/ChatCard.jsx
import React, { useState, useEffect, useRef } from 'react';
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
    Download
} from 'lucide-react';
import { VKIcon } from './PlatformIcons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ChatContextMenu from './ChatContextMenu';
import { microservicesAPI } from '../services/microservices';
import { getAllEmotesForChannel } from '../utils/emotes';
import MessageContent from './MessageContent';

const ChatCard = ({ integrations }) => {
    const { user } = useAuth();
    const { messages: chatMessages, isConnected } = useChat();
    
    const [twitchChatEnabled, setTwitchChatEnabled] = useState(false);
    const [vkChatEnabled, setVkChatEnabled] = useState(false);
    const [combinedChat, setCombinedChat] = useState(false);
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

    const twitchEnabled = integrations?.twitch?.enabled;
    const vkEnabled = integrations?.vk?.enabled;

    // Фильтруем сообщения по настройкам виджета
    const filteredMessages = chatMessages.filter(msg => {
        const platformFilter = obsSettings.platformFilter || 'combined';
        
        switch (platformFilter) {
            case 'twitch':
                return msg.platform === 'twitch';
            case 'vk':
                return msg.platform === 'vk';
            case 'combined':
            default:
                return true;
        }
    }).slice(-50); // Ограничиваем последними 50 сообщениями

    // Логирование для отладки
    useEffect(() => {
        // 💬 ChatCard - Total messages:', chatMessages.length, 'Filtered:', filteredMessages.length);
        // 💬 ChatCard - Messages array:', chatMessages.slice(0, 3));
    }, [chatMessages, filteredMessages]);

    // Автоскролл к последнему сообщению (только для отдельного окна)
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Загружаем список заблокированных пользователей TTS
    useEffect(() => {
        if (user?.id) {
            loadBlockedUsers();
        }
    }, [user]);

    // Загружаем 7TV смайлы
    useEffect(() => {
        if (user?.twitch_name) {
            loadEmotes();
        }
    }, [user?.twitch_name]);

    const loadEmotes = async () => {
        try {
            // 🎭 Loading 7TV emotes for channel:', user.twitch_name);
            const emotesData = await getAllEmotesForChannel(user.twitch_name);
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
                    <title>Чат - ${user?.twitch_name || 'Streamer'}</title>
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
                
                messagesContainer.innerHTML = '';
                // Используем chatMessages вместо filteredMessages для отдельного окна
                const messagesToShow = newWindow.chatData.messages;
                if (messagesToShow.length === 0) {
                    messagesContainer.innerHTML = '<div class="empty"><div>💬</div><div>Нет сообщений</div></div>';
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

                        messageDiv.innerHTML = `
                            <span class="timestamp">${timestamp}</span>
                            <span class="platform-icon">${platformIcon}</span>
                            <span class="username" style="color: ${msg.author_color || '#ffffff'}">${username}:</span>
                            <span class="content">${processedContent.includes('<img') ? processedContent : content}</span>
                        `;
                        
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

    const loadBlockedUsers = async () => {
        try {
            const twitchChannel = user?.twitch_name;
            const vkChannel = user?.vk_username;
            
            const blockedSet = new Set();
            
            if (twitchChannel) {
                const response = await microservicesAPI.get('/api/moderation/tts/blocked', {
                    params: { channel_name: twitchChannel, platform: 'twitch' }
                });
                if (response.data.success) {
                    response.data.blocked_users.forEach(u => {
                        blockedSet.add(`twitch:${u.username.toLowerCase()}`);
                    });
                }
            }
            
            if (vkChannel) {
                const response = await microservicesAPI.get('/api/moderation/tts/blocked', {
                    params: { channel_name: vkChannel, platform: 'vk' }
                });
                if (response.data.success) {
                    response.data.blocked_users.forEach(u => {
                        blockedSet.add(`vk:${u.username.toLowerCase()}`);
                    });
                }
            }
            
            setTtsBlockedUsers(blockedSet);
        } catch (error) {
            console.error('Error loading blocked users:', error);
        }
    };

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            message: msg
        });
    };

    const handleContextMenuAction = async (action, msg) => {
        const username = msg.author_name || msg.author;
        const platform = msg.platform;
        
        // Получаем имя канала из сообщения или из пользователя
        let channelName = msg.channel;
        if (!channelName) {
            channelName = platform === 'twitch' ? user?.twitch_name : user?.vk_username;
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
                    await microservicesAPI.post('/api/moderation/tts/block', {
                        username,
                        platform,
                        channel_name: channelName
                    });
                    toast.success(`${username} заблокирован для TTS`);
                    setTtsBlockedUsers(prev => new Set(prev).add(`${platform}:${username.toLowerCase()}`));
                    break;

                case 'unblock_tts':
                    await microservicesAPI.post('/api/moderation/tts/unblock', {
                        username,
                        platform,
                        channel_name: channelName
                    });
                    toast.success(`${username} разблокирован для TTS`);
                    setTtsBlockedUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(`${platform}:${username.toLowerCase()}`);
                        return newSet;
                    });
                    break;

                case 'timeout_10m':
                    await microservicesAPI.post('/api/moderation/timeout', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        duration: 600,
                        reason: 'Таймаут через чат'
                    });
                    toast.success(`${username} получил таймаут на 10 минут`);
                    break;

                case 'timeout_1h':
                    await microservicesAPI.post('/api/moderation/timeout', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        duration: 3600,
                        reason: 'Таймаут через чат'
                    });
                    toast.success(`${username} получил таймаут на 1 час`);
                    break;

                case 'ban':
                    await microservicesAPI.post('/api/moderation/ban', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        reason: 'Бан через чат'
                    });
                    toast.success(`${username} забанен`);
                    break;

                case 'add_moderator':
                    await microservicesAPI.post('/api/moderation/role', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        role: 'moderator',
                        action: 'add'
                    });
                    toast.success(`${username} назначен модератором`);
                    break;

                case 'remove_moderator':
                    await microservicesAPI.post('/api/moderation/role', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        role: 'moderator',
                        action: 'remove'
                    });
                    toast.success(`${username} снят с модератора`);
                    break;

                case 'add_vip':
                    await microservicesAPI.post('/api/moderation/role', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        role: 'vip',
                        action: 'add'
                    });
                    toast.success(`${username} назначен VIP`);
                    break;

                case 'remove_vip':
                    await microservicesAPI.post('/api/moderation/role', {
                        username,
                        user_id: msg.author_id,
                        platform,
                        channel_name: channelName,
                        role: 'vip',
                        action: 'remove'
                    });
                    toast.success(`${username} снят с VIP`);
                    break;

                default:
                    console.warn('Unknown action:', action);
            }
        } catch (error) {
            console.error('Error executing moderation action:', error);
            toast.error(error.response?.data?.detail || 'Ошибка выполнения действия');
        }
    };

    // Генерация URL для OBS
    const generateObsUrl = (platform) => {
        const baseUrl = window.location.origin;
        const params = new URLSearchParams({
            platform,
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
            platformFilter: obsSettings.platformFilter,
            // Цвета ролей
            moderatorColor: obsSettings.colors.moderator,
            vipColor: obsSettings.colors.vip,
            subscriberColor: obsSettings.colors.subscriber,
            normalColor: obsSettings.colors.normal
        });
        
        if (combinedChat) {
            params.set('combined', 'true');
        }
        
        return `${baseUrl}/chat/obs?${params.toString()}`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('URL скопирован в буфер обмена');
    };

    const downloadHtml = (platform) => {
        const url = generateObsUrl(platform);
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Overlay</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: transparent;
            font-family: ${obsSettings.fontFamily};
            font-size: ${obsSettings.fontSize};
            color: ${obsSettings.textColor};
        }
        .chat-container {
            padding: 10px;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div class="chat-container" id="chat">
        <p>Загрузка чата...</p>
    </div>
    <script>
        // WebSocket подключение к чату
        const ws = new WebSocket('${url.replace('http', 'ws')}');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Обработка сообщений
            // data
        };
    </script>
</body>
</html>
`;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${platform}-chat-overlay.html`;
        link.click();
        toast.success('HTML файл скачан');
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
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowObsSettings(false)}
                        >
                            <X className="h-4 w-4" />
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
                        
                        {/* Twitch */}
                        {twitchEnabled && (
                            <div className="space-y-2 p-3 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Twitch className="h-4 w-4 text-purple-500" />
                                    <span className="font-medium text-sm">Twitch</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(generateObsUrl('twitch'))}
                                    >
                                        <Copy className="h-3 w-3 mr-2" />
                                        Копировать URL
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => downloadHtml('twitch')}
                                    >
                                        <Download className="h-3 w-3 mr-2" />
                                        Скачать HTML
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground break-all">
                                    {generateObsUrl('twitch')}
                                </div>
                            </div>
                        )}

                        {/* VK Live */}
                        {vkEnabled && (
                            <div className="space-y-2 p-3 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <VKIcon className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium text-sm">VK Live</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(generateObsUrl('vk'))}
                                    >
                                        <Copy className="h-3 w-3 mr-2" />
                                        Копировать URL
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => downloadHtml('vk')}
                                    >
                                        <Download className="h-3 w-3 mr-2" />
                                        Скачать HTML
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground break-all">
                                    {generateObsUrl('vk')}
                                </div>
                            </div>
                        )}

                        {/* Объединенный */}
                        {twitchEnabled && vkEnabled && (
                            <div className="space-y-2 p-3 border rounded-lg bg-green-500/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Merge className="h-4 w-4 text-green-500" />
                                    <span className="font-medium text-sm">Объединенный чат</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(generateObsUrl('combined'))}
                                    >
                                        <Copy className="h-3 w-3 mr-2" />
                                        Копировать URL
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => downloadHtml('combined')}
                                    >
                                        <Download className="h-3 w-3 mr-2" />
                                        Скачать HTML
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground break-all">
                                    {generateObsUrl('combined')}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Основной режим чата
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" />
                        ChatBox
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {/* Кнопки-переключатели в заголовке */}
                        {twitchEnabled && (
                            <Button
                                variant={twitchChatEnabled ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTwitchChatEnabled(!twitchChatEnabled)}
                                className={`h-8 px-3 transition-all ${
                                    twitchChatEnabled 
                                        ? 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500' 
                                        : 'border-purple-300 text-purple-600 hover:border-purple-500 hover:bg-transparent'
                                }`}
                            >
                                <Twitch className="h-3 w-3 mr-1" />
                                {twitchChatEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        {vkEnabled && (
                            <Button
                                variant={vkChatEnabled ? "default" : "outline"}
                                size="sm"
                                onClick={() => setVkChatEnabled(!vkChatEnabled)}
                                className={`h-8 px-3 transition-all ${
                                    vkChatEnabled 
                                        ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500' 
                                        : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-transparent'
                                }`}
                            >
                                <VKIcon className="h-3 w-3 mr-1" />
                                {vkChatEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        {twitchEnabled && vkEnabled && (
                            <Button
                                variant={combinedChat ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCombinedChat(!combinedChat)}
                                className={`h-8 px-3 transition-all ${
                                    combinedChat 
                                        ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                                        : 'border-green-300 text-green-600 hover:border-green-500 hover:bg-transparent'
                                }`}
                            >
                                <Merge className="h-3 w-3 mr-1" />
                                {combinedChat ? 'ВКЛ' : 'ВЫКЛ'}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowObsSettings(true)}
                            title="Настройки виджета OBS"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Отображение сообщений или кнопка открытия чата */}
                {(twitchChatEnabled || vkChatEnabled) ? (
                    <div className="space-y-4">
                        {/* Область сообщений */}
                        <div className="h-[300px] border rounded-lg bg-muted/5 overflow-hidden p-4 flex flex-col-reverse">
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
                                    {filteredMessages.slice(-50).reverse().map((msg, index) => (
                                        <div
                                            key={`${msg.id || index}-${msg.timestamp}`}
                                            className="flex items-start gap-1.5 p-1 rounded hover:bg-muted/50 transition-colors"
                                            onContextMenu={(e) => handleContextMenu(e, msg)}
                                        >
                                            <div className="flex-shrink-0 mt-0.5">
                                                {msg.platform === 'twitch' ? (
                                                    <Twitch className="w-3.5 h-3.5 text-purple-500" />
                                                ) : (
                                                    <VKIcon className="w-3.5 h-3.5 text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(msg.timestamp * 1000).toLocaleTimeString('ru-RU', { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </span>
                                                    <span 
                                                        className="font-medium text-sm cursor-pointer hover:underline"
                                                        style={{ color: msg.author_color || '#ffffff' }}
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
                                    ))}
                                    </div>
                                )}
                        </div>
                        
                        {/* Кнопка открытия отдельного окна */}
                        <div className="flex justify-center mt-2">
                            <Button 
                                onClick={openChatWindow}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <MessageSquare className="h-4 w-4" />
                                Открыть в отдельном окне
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="min-h-[200px] flex items-center justify-center">
                        <div className="text-center text-muted-foreground py-8">
                            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Включите хотя бы один чат для отображения сообщений</p>
                            {user?.id && <p className="text-xs mt-2">Пользователь: {user.username || user.twitch_name || user.vk_name}</p>}
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
