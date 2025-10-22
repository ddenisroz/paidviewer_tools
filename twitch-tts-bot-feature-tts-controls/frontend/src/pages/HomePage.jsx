// src/pages/HomePage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { botService } from '../services/microservices';
import StreamStatus from '../components/StreamStatus';
import ChatCard from '../components/ChatCard';
import StreamTitleCard from '../components/StreamTitleCard';
import StreamCategoryCard from '../components/StreamCategoryCard';
import GuestStubs from '../components/GuestStubs';
import IntegrationsDisabledPlaceholder from '../components/IntegrationsDisabledPlaceholder';



const HomePage = () => {
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const { streamHistory } = useData();
    
    // Дополнительные данные для VK Live
    const [vkStreamInfo, setVkStreamInfo] = useState(null);

    // Загружаем данные VK Live отдельно
    useEffect(() => {
        const loadVkStreamInfo = async () => {
            if (integrations?.vk?.enabled && isAuthenticated) {
                try {
                    const response = await botService.get('/api/vk/stream-info');
                    setVkStreamInfo(response.data);
                } catch (error) {
                    console.error('Error loading VK stream info:', error);
                    setVkStreamInfo(null);
                }
            }
        };

        loadVkStreamInfo();
        
        // Обновляем каждые 30 секунд
        const interval = setInterval(loadVkStreamInfo, 30000);
        return () => clearInterval(interval);
    }, [integrations?.vk?.enabled, isAuthenticated]);

    const preparedStreamHistory = useMemo(() => {
        // streamHistory - это объект с полями history, data, twitch_history, vk_history
        const historyData = streamHistory?.history || streamHistory?.data || [];
        if (!Array.isArray(historyData) || historyData.length < 1) {
            return [];
        }
        const sortedHistory = [...historyData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return [];
        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp);
                if (isNaN(currentTime.getTime())) return null;
                // Используем нормальное время вместо относительного
                const hours = currentTime.getHours().toString().padStart(2, '0');
                const minutes = currentTime.getMinutes().toString().padStart(2, '0');
                return { ...d, time: `${hours}:${minutes}` };
            }).filter(Boolean);
    }, [streamHistory]);

    const preparedVkStreamHistory = useMemo(() => {
        if (!streamHistory?.vk_history || !Array.isArray(streamHistory.vk_history) || streamHistory.vk_history.length < 1) {
            return [];
        }
        const sortedHistory = [...streamHistory.vk_history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return [];
        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp);
                if (isNaN(currentTime.getTime())) return null;
                // Используем нормальное время вместо относительного
                const hours = currentTime.getHours().toString().padStart(2, '0');
                const minutes = currentTime.getMinutes().toString().padStart(2, '0');
                return { ...d, time: `${hours}:${minutes}` };
            }).filter(Boolean);
    }, [streamHistory]);
    
    // Подготавливаем данные о стримах для компонента StreamStatus
    const streamData = useMemo(() => {
        const twitchData = integrations?.twitch?.enabled ? {
            isLive: streamHistory?.status === 'online' || false,
            viewerCount: streamHistory?.current_viewers || 0
        } : null;
        
        // Для VK Live используем данные из vkStreamInfo (приоритет) или vk_history
        const vkData = integrations?.vk?.enabled ? {
            isLive: (() => {
                // Приоритет: данные из vkStreamInfo
                if (vkStreamInfo?.online !== undefined) {
                    return vkStreamInfo.online;
                }
                // Fallback: vk_history
                if (streamHistory?.vk_history && Array.isArray(streamHistory.vk_history) && streamHistory.vk_history.length > 0) {
                    const latestVkData = streamHistory.vk_history[streamHistory.vk_history.length - 1];
                    return latestVkData?.viewers > 0 || false;
                }
                // Fallback на общий статус
                return streamHistory?.status === 'online' || false;
            })(),
            viewerCount: (() => {
                // Приоритет: данные из vkStreamInfo
                if (vkStreamInfo?.viewer_count !== undefined) {
                    return vkStreamInfo.viewer_count;
                }
                // Fallback: vk_history
                if (streamHistory?.vk_history && Array.isArray(streamHistory.vk_history) && streamHistory.vk_history.length > 0) {
                    const latestVkData = streamHistory.vk_history[streamHistory.vk_history.length - 1];
                    return latestVkData?.viewers || 0;
                }
                // Fallback на current_vk_viewers
                return streamHistory?.current_vk_viewers || 0;
            })()
        } : null;
        
        return {
            twitch: twitchData,
            vk: vkData
        };
    }, [integrations, streamHistory, vkStreamInfo]);

    return (
        <div className="space-y-8 pb-20">
            {/* Статусы стримов */}
            <div className="flex justify-center">
                <StreamStatus 
                    integrations={integrations}
                    streamData={streamData}
                />
            </div>
            
            <div className="space-y-6 max-w-6xl mx-auto">
                {!isAuthenticated ? (
                    <GuestStubs />
                ) : !integrations.twitch.enabled && !integrations.vk.enabled ? (
                    <IntegrationsDisabledPlaceholder />
                ) : (
                    <>
                        {/* Настройки стрима - в две колонки */}
                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                            <StreamTitleCard />
                            <StreamCategoryCard />
                        </div>
                        
                        {/* Чат - на всю ширину */}
                        <div className="w-full">
                            <ChatCard 
                                integrations={integrations}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;
