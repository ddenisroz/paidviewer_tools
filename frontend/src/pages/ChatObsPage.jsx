// src/pages/ChatObsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const ChatObsPage = () => {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef(null);
    
    // Получаем параметры из URL
    const platform = searchParams.get('platform') || 'twitch';
    const combined = searchParams.get('combined') === 'true';
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

    // Подключение к чату (заглушка для демонстрации)
    useEffect(() => {
        setIsConnected(true);
        
        // Симуляция получения сообщений
        const interval = setInterval(() => {
            const mockMessages = [
                { id: Date.now(), username: 'viewer1', text: 'Привет всем!', platform: 'twitch', timestamp: new Date() },
                { id: Date.now() + 1, username: 'viewer2', text: 'Отличный стрим!', platform: 'vk', timestamp: new Date() },
                { id: Date.now() + 2, username: 'viewer3', text: 'Когда следующий стрим?', platform: 'twitch', timestamp: new Date() }
            ];
            
            setMessages(prev => {
                const newMessages = [...prev, ...mockMessages];
                return newMessages.slice(-maxMessages);
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [maxMessages]);

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
        return timestamp.toLocaleTimeString('ru-RU', { 
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
