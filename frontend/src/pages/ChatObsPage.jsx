// src/pages/ChatObsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const ChatObsPage = () => {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef(null);
    
    // Получаем параметры из URL
    const userId = searchParams.get('userId');
    const platformFilter = searchParams.get('platformFilter') || 'all';
    const fontSize = searchParams.get('fontSize') || '14px';
    const fontFamily = searchParams.get('fontFamily') || 'Arial';
    const backgroundColor = searchParams.get('backgroundColor') || '#1a1a1a';
    const textColor = searchParams.get('textColor') || '#ffffff';
    const showTimestamps = searchParams.get('showTimestamps') === 'true';
    const showPlatform = searchParams.get('showPlatform') === 'true';
    const maxMessages = parseInt(searchParams.get('maxMessages')) || '50';

    // Стили для чата
    const chatStyles = {
        container: {
            width: '100%',
            height: '100vh',
            backgroundColor,
            color: textColor,
            fontFamily,
            fontSize,
            padding: '10px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        },
        messages: {
            flex: 1,
            overflowY: 'auto',
            padding: '5px 0'
        },
        message: {
            marginBottom: '5px',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        username: {
            fontWeight: 'bold',
            color: '#00d4ff'
        },
        timestamp: {
            fontSize: '0.8em',
            opacity: 0.7,
            color: '#888'
        },
        platform: {
            fontSize: '0.8em',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
        },
        text: {
            flex: 1
        }
    };

    // Подключение к реальному чату пользователя
    useEffect(() => {
        if (!userId) {
            console.error('User ID not provided');
            return;
        }

        // WebSocket URL для чата пользователя
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat/${userId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to user chat:', userId);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                
                // Фильтруем сообщения по платформе
                if (platformFilter === 'all' || 
                    (platformFilter === 'twitch' && data.platform === 'twitch') ||
                    (platformFilter === 'vk' && data.platform === 'vk') ||
                    (platformFilter === 'combined' && (data.platform === 'twitch' || data.platform === 'vk'))) {
                    
                    setMessages(prev => {
                        const newMessages = [...prev, data];
                        return newMessages.slice(-maxMessages);
                    });
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from chat');
            setIsConnected(false);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setIsConnected(false);
        };

        return () => {
            ws.close();
        };
    }, [userId, platformFilter, maxMessages]);

    // Автоскролл к последнему сообщению
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getPlatformColor = (platform) => {
        switch (platform) {
            case 'twitch': return '#9146ff';
            case 'vk': return '#0077ff';
            default: return '#666';
        }
    };

    const getPlatformName = (platform) => {
        switch (platform) {
            case 'twitch': return 'Twitch';
            case 'vk': return 'VK Live';
            default: return platform;
        }
    };

    const formatTime = (timestamp) => {
        // Если timestamp это строка (ISO), создаем Date объект
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div style={chatStyles.container}>
            <div style={chatStyles.messages}>
                {messages.map((message) => (
                    <div key={message.id} style={chatStyles.message}>
                        {showTimestamps && (
                            <span style={chatStyles.timestamp}>
                                {formatTime(message.timestamp)}
                            </span>
                        )}
                        
                        {showPlatform && (
                            <span 
                                style={{
                                    ...chatStyles.platform,
                                    backgroundColor: getPlatformColor(message.platform)
                                }}
                            >
                                {getPlatformName(message.platform)}
                            </span>
                        )}
                        
                        <span style={chatStyles.username}>
                            {message.username}:
                        </span>
                        
                        <span style={chatStyles.text}>
                            {message.text}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Статус подключения */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '5px 10px',
                backgroundColor: isConnected ? '#00ff00' : '#ff0000',
                color: '#000',
                borderRadius: '3px',
                fontSize: '12px',
                fontWeight: 'bold'
            }}>
                {isConnected ? 'Подключен' : 'Отключен'}
            </div>
        </div>
    );
};

export default ChatObsPage;
