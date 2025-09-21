import React, { createContext, useState, useEffect, useContext } from 'react';
import { getActiveChannels, getChannelAvatar } from '../services/activeChannelsApi';
import { useAuth } from './AuthContext';

const ActiveChannelsContext = createContext();

export const useActiveChannels = () => {
    const context = useContext(ActiveChannelsContext);
    if (!context) {
        throw new Error('useActiveChannels must be used within an ActiveChannelsProvider');
    }
    return context;
};

export const ActiveChannelsProvider = ({ children }) => {
    const [activeChannels, setActiveChannels] = useState([]);
    const { isAuthenticated, user } = useAuth();

    const loadActiveChannels = async () => {
        try {
            const channels = await getActiveChannels();
            
            // Если API вернул данные, используем их
            if (channels && channels.length > 0) {
                // Дедуплицируем каналы по username
                const uniqueChannels = channels.reduce((acc, channel) => {
                    const existingChannel = acc.find(c => c.username.toLowerCase() === channel.username.toLowerCase());
                    if (!existingChannel) {
                        acc.push(channel);
                    }
                    return acc;
                }, []);
                
                // Генерируем аватарки на фронтенде
                const channelsWithAvatars = uniqueChannels.map(channel => ({
                    ...channel,
                    avatar: getChannelAvatar(channel.username, channel.platform)
                }));
                setActiveChannels(channelsWithAvatars);
            } else {
                // Если API недоступен, показываем пустой список
                setActiveChannels([]);
            }
        } catch (error) {
            console.error('Failed to load active channels:', error);
            // В случае ошибки показываем пустой список
            setActiveChannels([]);
        }
    };

    useEffect(() => {
        // Загружаем каналы только если пользователь авторизован
        if (isAuthenticated) {
            loadActiveChannels();
        } else {
            // Если не авторизован, очищаем список
            setActiveChannels([]);
        }
    }, [isAuthenticated, user?.id]); // Перезагружаем при изменении статуса авторизации

    useEffect(() => {
        // Обновляем данные каждые 30 секунд только для авторизованных пользователей
        if (!isAuthenticated) return;
        
        const interval = setInterval(() => {
            loadActiveChannels();
        }, 30000);

        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const value = {
        activeChannels,
        loadActiveChannels
    };

    return (
        <ActiveChannelsContext.Provider value={value}>
            {children}
        </ActiveChannelsContext.Provider>
    );
};
