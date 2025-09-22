import React, { createContext, useState, useEffect, useContext } from 'react';
import { getActiveChannels, getChannelAvatar } from '../services/activeChannelsApi';
import { useAuth } from './AuthContext';

const ActiveChannelsContext = createContext();

export const ActiveChannelsProvider = ({ children }) => {
    const [activeChannels, setActiveChannels] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const { isAuthenticated, user } = useAuth();

    const loadActiveChannels = async (forceReload = false) => {
        // Если уже загружено и не принудительная перезагрузка, не обновляем
        if (isLoaded && !forceReload) {
            return;
        }

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
                setIsLoaded(true);
            } else {
                // Если API недоступен, показываем пустой список
                setActiveChannels([]);
                setIsLoaded(true);
            }
        } catch (error) {
            console.error('Failed to load active channels:', error);
            // В случае ошибки показываем пустой список
            setActiveChannels([]);
            setIsLoaded(true);
        }
    };

    useEffect(() => {
        // Загружаем каналы только если пользователь авторизован и еще не загружено
        if (isAuthenticated && !isLoaded) {
            loadActiveChannels();
        } else if (!isAuthenticated) {
            // Если не авторизован, очищаем список и сбрасываем флаг загрузки
            setActiveChannels([]);
            setIsLoaded(false);
        }
    }, [isAuthenticated]); // Убрали user?.id из зависимостей

    useEffect(() => {
        // Обновляем данные каждые 60 секунд только для авторизованных пользователей
        if (!isAuthenticated) return;
        
        const interval = setInterval(() => {
            loadActiveChannels(true); // Принудительная перезагрузка
        }, 60000); // Увеличили интервал до 60 секунд

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

export const useActiveChannels = () => {
    const context = useContext(ActiveChannelsContext);
    if (!context) {
        throw new Error('useActiveChannels must be used within an ActiveChannelsProvider');
    }
    return context;
};
