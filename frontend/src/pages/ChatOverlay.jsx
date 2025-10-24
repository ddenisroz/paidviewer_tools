// src/pages/ChatOverlay.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { botService } from '../services/microservices';
import MessageContent from '../components/MessageContent';
import { twitchBadgesService } from '../services/twitchBadges';

const ChatOverlay = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [settings, setSettings] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // CSS для горизонтального скролла
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .horizontal-chat-scroll::-webkit-scrollbar {
                height: 8px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 4px;
            }
            .horizontal-chat-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            .horizontal-chat-scroll {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);
    const [error, setError] = useState(null);
    const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting', 'connected', 'reconnecting', 'error'
    const [contextMenu, setContextMenu] = useState(null); // {x, y, username, platform}
    const [channelName, setChannelName] = useState(null); // Имя канала для API запросов
    const [lastAddedMessageId, setLastAddedMessageId] = useState(null); // ID последнего добавленного сообщения для анимации
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const processedMessageIds = useRef(new Set()); // Для защиты от race condition
    const reconnectAttempts = useRef(0); // Счетчик попыток переподключения
    const reconnectTimeout = useRef(null); // Таймер переподключения
    
    // ВАЖНО: все хуки должны быть В НАЧАЛЕ, ПЕРЕД условными return!
    // Функция для получения стиля сообщения (с анимацией или без)
    const getMessageStyle = (msg) => {
        const messageId = msg.id || `${msg.timestamp}-${msg.author || msg.author_name}-${msg.message}`;
        const isNewMessage = messageId === lastAddedMessageId;
        
        const baseStyle = {
            borderRadius: `${settings?.border_radius || 8}px`
        };
        
        // Анимация применяется только к последнему добавленному сообщению
        if (isNewMessage) {
            const animationType = settings?.animation_type || 'fade';
            const animationDuration = settings?.animation_duration || 300;
            
            console.log(`🎬 [ANIMATION] Applying ${animationType} (${animationDuration}ms) to message:`, msg.message?.substring(0, 30));
            
            const animationName = 
                animationType === 'fade' ? 'fadeIn' :
                animationType === 'slide-right' ? 'slideRight' :
                animationType === 'slide-left' ? 'slideLeft' :
                animationType === 'scale' ? 'scale' :
                animationType === 'bounce' ? 'bounce' :
                'fadeIn';
            
            return {
                ...baseStyle,
                animation: `${animationName} ${animationDuration}ms ease-out`
            };
        }
        
        return baseStyle;
    };
    
    // Загрузка настроек ChatBox по токену
    useEffect(() => {
        if (!token) {
            setError('Токен не указан в URL');
            setLoading(false);
            return;
        }
        
        loadSettings();
    }, [token]);
    
    const loadSettings = async () => {
        try {
            const response = await botService.get(`/api/chatbox/settings/by-token/${token}`);
            
            // ✅ Нормализуем данные - убеждаемся что числа это числа
            const normalizedSettings = {
                ...response.data,
                font_size: parseInt(response.data.font_size) || 16,
                text_stroke_width: parseInt(response.data.text_stroke_width) || 0,
                background_opacity: parseFloat(response.data.background_opacity) ?? 0.5,
                max_messages: parseInt(response.data.max_messages) || 20,
                message_spacing: parseInt(response.data.message_spacing) || 4,
                animation_type: response.data.animation_type || 'fade',
                animation_duration: parseInt(response.data.animation_duration) || 300,
                chat_direction: response.data.chat_direction || 'vertical'  // Нормализуем chat_direction
            };
            
            console.log(`✅ [SETTINGS] Animation: ${normalizedSettings.animation_type} (${normalizedSettings.animation_duration}ms)`);
            console.log(`✅ [SETTINGS] Chat direction: ${normalizedSettings.chat_direction}`);
            
            setSettings(normalizedSettings);
            
            // Загружаем Twitch badges
            await twitchBadgesService.loadGlobalBadges();
            
            // Подключаемся к WebSocket после загрузки настроек
            connectWebSocket(normalizedSettings.user_id);
        } catch (error) {
            console.error('❌ Error loading ChatBox settings:', error);
            console.error('Full error:', error.response?.data || error.message);
            setError(`Ошибка загрузки настроек: ${error.response?.data?.detail || error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const connectWebSocket = (userId) => {
        // Очищаем предыдущий таймер
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
        
        // Ограничение на попытки переподключения
        const MAX_RECONNECT_ATTEMPTS = 10;
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            console.error(`❌ Max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}), giving up`);
            setWsStatus('error');
            return;
        }
        
        const wsUrl = `ws://localhost:8000/ws/chat/${userId}`;
        setWsStatus('connecting');
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            setWsStatus('connected');
            reconnectAttempts.current = 0; // Сброс счетчика при успешном подключении
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'message' || data.type === 'chat_message') {
                    // Проверяем в ref СРАЗУ (защита от race condition при множественных WebSocket)
                    const messageId = data.id || `${data.timestamp}-${data.author}-${data.message}`;
                    
                    if (processedMessageIds.current.has(messageId)) {
                        return;
                    }
                    
                    // Добавляем в ref СРАЗУ
                    processedMessageIds.current.add(messageId);
                    
                    // Устанавливаем ID последнего сообщения для анимации
                    setLastAddedMessageId(messageId);
                    
                    // Сбрасываем после окончания анимации (берем длительность из настроек + 100ms запаса)
                    const animationDuration = (settings?.animation_duration || 300) + 100;
                    setTimeout(() => {
                        setLastAddedMessageId(null);
                    }, animationDuration);
                    
                    setMessages(prev => {
                        // Дополнительная проверка в state (на всякий случай)
                        const isDuplicate = prev.some(msg => 
                            msg.id === data.id || 
                            (msg.timestamp === data.timestamp && 
                             msg.author === data.author && 
                             msg.message === data.message)
                        );
                        
                        if (isDuplicate) {
                            return prev;
                        }
                        
                        const newMessages = [...prev, data];
                        const maxMessages = settings?.max_messages || 20;
                        const result = newMessages.slice(-maxMessages);
                        
                        // Очищаем ref от старых ID (оставляем только последние maxMessages)
                        if (processedMessageIds.current.size > maxMessages * 2) {
                            const recentIds = new Set(result.map(msg => 
                                msg.id || `${msg.timestamp}-${msg.author}-${msg.message}`
                            ));
                            processedMessageIds.current = recentIds;
                        }
                        
                        return result;
                    });
                } else if (data.type === 'chat_history') {
                    console.log(`📜 Loaded ${data.messages?.length || 0} messages from WebSocket history`);
                    
                    // Проверяем первое сообщение для дебага
                    if (data.messages && data.messages.length > 0) {
                        const sample = data.messages[0];
                        console.log('📜 Sample history message:', sample);
                        console.log('📜 Has badges?', 'badges' in sample, 'Value:', sample.badges);
                        console.log('📜 Has role?', 'role' in sample, 'Value:', sample.role);
                    }
                    
                    const historyLength = data.messages?.length || 0;
                    const maxMessages = settings?.max_messages || 50;
                    
                    // Удаляем дубликаты из истории
                    const uniqueMessages = [];
                    const seenIds = new Set();
                    
                    for (const msg of (data.messages || [])) {
                        const uniqueKey = msg.id || `${msg.timestamp}-${msg.author}-${msg.message}`;
                        if (!seenIds.has(uniqueKey)) {
                            seenIds.add(uniqueKey);
                            uniqueMessages.push(msg);
                        }
                    }
                    
                    setMessages(uniqueMessages);
                    
                    // Инициализируем ref с ID из истории
                    processedMessageIds.current = new Set(uniqueMessages.map(msg => 
                        msg.id || `${msg.timestamp}-${msg.author}-${msg.message}`
                    ));
                    
                    // Мгновенный скролл вниз после загрузки истории
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
                    }, 100);
                }
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            setWsStatus('error');
        };
        
        ws.onclose = () => {
            setWsStatus('reconnecting');
            reconnectAttempts.current += 1;
            
            // Exponential backoff: 3s, 6s, 12s, 24s, ...
            const baseDelay = 3000;
            const maxDelay = 30000; // Максимум 30 секунд
            const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current - 1), maxDelay);
            
            reconnectTimeout.current = setTimeout(() => {
                connectWebSocket(userId);
            }, delay);
        };
        
        wsRef.current = ws;
    };
    
    // Автопрокрутка к последнему сообщению
    useEffect(() => {
        if (messagesEndRef.current) {
            // В горизонтальном режиме прокручиваем вправо, в вертикальном - вниз
            messagesEndRef.current.scrollIntoView({ 
                behavior: 'smooth',
                block: settings?.chat_direction === 'horizontal' ? 'nearest' : 'end',
                inline: settings?.chat_direction === 'horizontal' ? 'end' : 'nearest'
            });
        }
    }, [messages, settings?.chat_direction]);
    
    // Cleanup WebSocket и таймеров
    useEffect(() => {
        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);
    
    // Закрытие контекстного меню при клике вне его
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);
    
    // ChatOverlay работает без авторизации (через JWT token в URL)
    // channelName не нужен для overlay
    
    if (loading) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>⏳</div>
                <div style={{ fontSize: '18px' }}>Загрузка настроек ChatBox...</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Токен: {token?.slice(0, 8)}...</div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                padding: '20px',
                textAlign: 'center',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>❌</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Ошибка загрузки настроек</div>
                <div style={{ fontSize: '14px', maxWidth: '600px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                    {error}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Откройте консоль (F12) для деталей</div>
            </div>
        );
    }
    
    if (!settings) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                color: '#2d3436',
                fontFamily: 'Inter, sans-serif',
                padding: '20px',
                textAlign: 'center',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px' }}>⚠️</div>
                <div style={{ fontSize: '18px' }}>Настройки не найдены</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Токен: {token}</div>
            </div>
        );
    }
    
    // Применяем настройки к контейнеру
    const containerStyle = {
        width: '100vw',
        height: '100vh',
        padding: '16px',
        fontFamily: settings.font_family,
        fontSize: `${settings.font_size}px`,
        fontWeight: settings.font_weight,
        color: settings.text_color,
        // Прозрачность фона через rgba (можно полностью убрать фон)
        backgroundColor: (() => {
            const hex = settings.background_color || '#000000';
            const opacity = settings.background_opacity ?? 0.8;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        })(),
        overflow: 'hidden' // Скрываем скролл контейнера, чтобы работал внутренний
    };
    
    const getMessageSpacing = (index) => {
        // В горизонтальном режиме используем gap, поэтому marginTop не нужен
        if (settings?.chat_direction === 'horizontal') {
            return {};
        }
        return {
            marginTop: index > 0 ? `${settings?.message_spacing || 4}px` : '0'
        };
    };
    
    // Обрезание сообщения до N слов для горизонтального чата
    const truncateWords = (text, maxWords = 6) => {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        if (words.length <= maxWords) return text;
        return words.slice(0, maxWords).join(' ') + '...';
    };
    
    // Обработчик клика на никнейм
    const handleNicknameClick = (e, username, platform) => {
        e.preventDefault();
        e.stopPropagation();
        
        const x = e.clientX + 5;
        const y = e.clientY + 5;
        
        setContextMenu({ x, y, username, platform });
    };
    
    // Статусы подключения для индикатора
    const statusConfig = {
        connecting: { emoji: '🔌', text: 'Подключение...', color: '#FFA500' },
        connected: { emoji: '✅', text: 'Подключено', color: '#00C851' },
        reconnecting: { emoji: '🔄', text: 'Переподключение...', color: '#FFBB33' },
        error: { emoji: '❌', text: 'Ошибка подключения', color: '#FF4444' }
    };
    
    const currentStatus = statusConfig[wsStatus] || statusConfig.connecting;
    
    return (
        <>
            <style>
                {`
                    /* КРУТЫЕ АНИМАЦИИ ДЛЯ CHATOVERLAY */
                    
                    @keyframes fadeIn {
                        0% {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes slideRight {
                        0% {
                            opacity: 0;
                            transform: translateX(-40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes slideLeft {
                        0% {
                            opacity: 0;
                            transform: translateX(40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(-5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes scale {
                        0% {
                            opacity: 0;
                            transform: scale(0.7) rotate(-3deg);
                        }
                        50% {
                            transform: scale(1.05) rotate(1deg);
                        }
                        100% {
                            opacity: 1;
                            transform: scale(1) rotate(0deg);
                        }
                    }
                    
                    @keyframes bounce {
                        0% {
                            opacity: 0;
                            transform: translateY(30px) scale(0.8);
                        }
                        40% {
                            opacity: 1;
                            transform: translateY(-10px) scale(1.05);
                        }
                        60% {
                            transform: translateY(5px) scale(0.98);
                        }
                        80% {
                            transform: translateY(-3px) scale(1.01);
                        }
                        100% {
                            transform: translateY(0) scale(1);
                        }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { 
                            opacity: 1;
                            transform: scale(1);
                        }
                        50% { 
                            opacity: 0.7;
                            transform: scale(0.98);
                        }
                    }
                `}
            </style>
            
            {/* Индикатор статуса подключения */}
            {wsStatus !== 'connected' && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    color: currentStatus.color,
                    animation: wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    zIndex: 9999
                }}>
                    <span>{currentStatus.emoji}</span>
                    <span>{currentStatus.text}</span>
                </div>
            )}
            
            <div style={containerStyle}>
                {messages.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: settings.text_color,
                        opacity: 0.5,
                        textAlign: 'center',
                        fontSize: `${settings.font_size}px`
                    }}>
                        <div>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                            <div>Ожидание сообщений...</div>
                            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                                Сообщения появятся здесь автоматически
                            </div>
                        </div>
                    </div>
                ) : (
                    <div 
                        className={settings.chat_direction === 'horizontal' ? 'horizontal-chat-scroll' : ''}
                        style={{ 
                            display: 'flex', 
                            flexDirection: settings.chat_direction === 'horizontal' ? 'row' : 'column',
                            minHeight: '100%',
                            height: '100%',
                            overflowX: settings.chat_direction === 'horizontal' ? 'auto' : 'hidden',
                            overflowY: settings.chat_direction === 'horizontal' ? 'hidden' : 'auto',
                            alignItems: settings.chat_direction === 'horizontal' ? 'center' : 'stretch',
                            gap: settings.chat_direction === 'horizontal' ? '16px' : '0',
                            paddingBottom: settings.chat_direction === 'horizontal' ? '16px' : '0'
                        }}
                    >
                        {/* Пустой элемент чтобы прижать сообщения к низу (только для вертикального режима) */}
                        {settings.chat_direction !== 'horizontal' && <div style={{ flexGrow: 1 }} />}
                        {/* Сообщения */}
                        {messages.map((msg, index) => (
                            <div 
                                key={msg.id || `${msg.platform}-${msg.timestamp}-${msg.author_name || msg.author}`}
                                style={{
                                    ...getMessageStyle(msg), 
                                    ...getMessageSpacing(index),
                                    whiteSpace: settings.chat_direction === 'horizontal' ? 'nowrap' : 'normal',
                                    wordBreak: settings.chat_direction === 'horizontal' ? 'normal' : 'break-word',
                                    flexShrink: 0,
                                    minWidth: settings.chat_direction === 'horizontal' ? 'fit-content' : 'auto',
                                    maxWidth: settings.chat_direction === 'horizontal' ? '600px' : 'auto',
                                    padding: settings.chat_direction === 'horizontal' ? '12px 16px' : '0',
                                    backgroundColor: settings.chat_direction === 'horizontal' ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
                                    borderRadius: settings.chat_direction === 'horizontal' ? `${settings?.border_radius || 8}px` : '0'
                                }}
                            >
                                {/* Platform Icon */}
                                {settings?.show_platform_icons && (
                                    msg.platform === 'twitch' ? (
                                        <TwitchIcon 
                                            style={{ 
                                                color: '#9147FF',
                                                width: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                                height: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                                display: 'inline-block',
                                                verticalAlign: 'text-bottom',
                                                marginRight: '4px'
                                            }} 
                                        />
                                    ) : (
                                        <VKIcon 
                                            style={{ 
                                                color: '#EF4444',
                                                // VK иконка на 15% меньше из-за другого viewBox (20x20 vs 24x24)
                                                width: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                                                height: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                                                display: 'inline-block',
                                                verticalAlign: 'text-bottom',
                                                marginRight: '4px'
                                            }} 
                                        />
                                    )
                                )}
                                
                                {/* Badges (значки Twitch) */}
                                {settings?.show_badges && msg.badges && Array.isArray(msg.badges) && msg.badges.length > 0 && (
                                    <>
                                        {msg.badges.map((badge, idx) => {
                                            // badge в формате "broadcaster/1" или "subscriber/12"
                                            const [badgeId, version] = badge.split('/');
                                            // Получаем правильный URL из Twitch API
                                            const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                                            
                                            // Пропускаем badge если URL не найден
                                            if (!badgeUrl) return null;
                                            
                                            const badgeSize = Math.max(14, Math.min(28, (settings?.font_size || 16) * 1.1));
                                            return (
                                                <img 
                                                    key={idx} 
                                                    src={badgeUrl}
                                                    alt={badgeId}
                                                    title={badge}
                                                    style={{ 
                                                        width: `${badgeSize}px`, 
                                                        height: `${badgeSize}px`,
                                                        display: 'inline-block',
                                                        verticalAlign: 'text-bottom',
                                                        marginRight: '2px'
                                                    }}
                                                    onError={(e) => {
                                                        // Скрываем если значок не загрузился
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                                
                                {/* Avatar */}
                                {settings?.show_avatars && msg.avatar_url && (
                                    <img
                                        src={msg.avatar_url}
                                        alt={msg.author_name || msg.author}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            display: 'inline-block',
                                            verticalAlign: 'text-bottom',
                                            marginRight: '6px'
                                        }}
                                    />
                                )}
                                
                                {/* Message Content */}
                                <span style={{ 
                                    overflowWrap: 'break-word',
                                    wordWrap: 'break-word',
                                    ...(settings.text_stroke_width > 0 ? {
                                        textShadow: `
                                            -${settings.text_stroke_width}px -${settings.text_stroke_width}px 0 ${settings.text_stroke_color || '#000000'},
                                            ${settings.text_stroke_width}px -${settings.text_stroke_width}px 0 ${settings.text_stroke_color || '#000000'},
                                            -${settings.text_stroke_width}px ${settings.text_stroke_width}px 0 ${settings.text_stroke_color || '#000000'},
                                            ${settings.text_stroke_width}px ${settings.text_stroke_width}px 0 ${settings.text_stroke_color || '#000000'}
                                        `
                                    } : {})
                                }}>
                                    <span 
                                        onClick={(e) => handleNicknameClick(e, msg.author_name || msg.author, msg.platform)}
                                        style={{ 
                                            color: msg.platform === 'twitch' ? '#9146FF' : '#FF0000',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                        title="Кликните для открытия меню"
                                    >
                                        {msg.author_name || msg.author}
                                    </span>
                                    {': '}
                                    <span style={{ color: settings.text_color }}>
                                        {settings.chat_direction === 'horizontal' ? (
                                            truncateWords(msg.message, 6)
                                        ) : (
                                            <MessageContent message={msg.message} emotes={{}} />
                                        )}
                                    </span>
                                </span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            
            {/* Контекстное меню */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${contextMenu.y}px`,
                        left: `${contextMenu.x}px`,
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '8px',
                        padding: '8px 0',
                        zIndex: 9999,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                        minWidth: '180px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid #333',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}>
                        {contextMenu.username}
                    </div>
                    
                    {/* Заглушить TTS */}
                    <button
                        onClick={async () => {
                            try {
                                await botService.post('/api/moderation/toggle-mute', {
                                    username: contextMenu.username,
                                    platform: contextMenu.platform,
                                    channel_name: channelName || 'unknown',
                                    duration_seconds: 0,
                                    reason: 'Заглушен в TTS'
                                });
                                setContextMenu(null);
                            } catch (error) {
                                console.error('Ошибка блокировки TTS:', error);
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#ff4444',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                        🔇 Заглушить
                    </button>
                    
                    {/* Разглушить TTS */}
                    <button
                        onClick={async () => {
                            try {
                                await botService.post('/api/moderation/toggle-mute', {
                                    username: contextMenu.username,
                                    platform: contextMenu.platform,
                                    channel_name: channelName || 'unknown',
                                    duration_seconds: 0,
                                    reason: undefined
                                });
                                setContextMenu(null);
                            } catch (error) {
                                console.error('Ошибка разблокировки TTS:', error);
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#00c851',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                        🔊 Разглушить
                    </button>
                </div>
            )}
        </>
    );
};

export default ChatOverlay;

