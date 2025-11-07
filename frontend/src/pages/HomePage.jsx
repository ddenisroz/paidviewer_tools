// src/pages/HomePage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import QuickActionsBar from '../components/QuickActionsBar';
import { getAndClearReturnUrl } from '../utils/oauthRedirect';
import { logger } from '../utils/prodLogger';



const HomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isGuest, user } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { streamHistory } = useData();
    
    // 🔄 Обработка возврата после OAuth - ТОЛЬКО ОДИН РАЗ при монтировании
    useEffect(() => {
        // Проверяем returnUrl только когда:
        // 1. Пользователь аутентифицирован
        // 2. Это первый рендер (монтирование)
        if (!isAuthenticated) return;
        
        const returnUrl = getAndClearReturnUrl();
        if (returnUrl) {
            logger.log('🔄 [OAuth] Redirecting back from dashboard to:', returnUrl);
            // Используем replace чтобы не добавлять /dashboard в историю
            navigate(returnUrl, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Пустой массив зависимостей - срабатывает ТОЛЬКО при монтировании
    
    
    // Состояние объединения полей для карточек
    const [titleLinked, setTitleLinked] = useState(false);
    const [categoryLinked, setCategoryLinked] = useState(false);

    // Состояние будет загружаться через контекст CombineSettingsContext

    // React Query: загружаем данные стримов (Twitch) с автоматическим обновлением
    const { data: twitchStreamInfo } = useQuery({
        queryKey: ['stream-info', 'twitch'],
        queryFn: async () => {
            if (!isAuthenticated || !integrations?.twitch?.enabled) return null;
            const response = await botService.get('/api/twitch/stream-info');
            return response.data;
        },
        enabled: !!isAuthenticated && !!integrations?.twitch?.enabled,
        staleTime: 30 * 1000, // 30 секунд - данные считаются свежими
        refetchInterval: 30 * 1000, // Автообновление каждые 30 секунд
        refetchOnMount: false, // Не делаем дополнительный запрос при монтировании (refetchInterval уже обновляет)
        refetchOnWindowFocus: false, // Не обновлять при фокусе окна
        retry: 1,
    });

    // React Query: загружаем данные стримов (VK) с автоматическим обновлением
    const { data: vkStreamInfo } = useQuery({
        queryKey: ['stream-info', 'vk'],
        queryFn: async () => {
            if (!isAuthenticated || !integrations?.vk?.enabled) return null;
            const response = await botService.get('/api/vk/stream-info');
            return response.data;
        },
        enabled: !!isAuthenticated && !!integrations?.vk?.enabled,
        staleTime: 30 * 1000, // 30 секунд - данные считаются свежими
        refetchInterval: 30 * 1000, // Автообновление каждые 30 секунд
        refetchOnMount: false, // Не делаем дополнительный запрос при монтировании (refetchInterval уже обновляет)
        refetchOnWindowFocus: false, // Не обновлять при фокусе окна
        retry: 1,
    });

    // Удален неиспользуемый preparedStreamHistory

    // Удален неиспользуемый preparedVkStreamHistory
    
    // Подготавливаем данные о стримах для компонента StreamStatus
    const streamData = useMemo(() => {
        // Для Twitch используем данные из twitchStreamInfo или fallback на streamHistory
        const twitchData = integrations?.twitch?.enabled ? {
            isLive: twitchStreamInfo?.is_live !== undefined ? twitchStreamInfo.is_live : (streamHistory?.status === 'online' || false),
            viewerCount: twitchStreamInfo?.viewers !== undefined ? twitchStreamInfo.viewers : (streamHistory?.current_viewers || 0)
        } : null;
        
        // Для VK Live используем данные из vkStreamInfo или fallback на streamHistory
        const vkData = integrations?.vk?.enabled ? {
            isLive: vkStreamInfo?.is_live !== undefined ? vkStreamInfo.is_live : (streamHistory?.status === 'online' || false),
            viewerCount: vkStreamInfo?.viewers !== undefined ? vkStreamInfo.viewers : (streamHistory?.current_vk_viewers || 0)
        } : null;
        
        return {
            twitch: twitchData,
            vk: vkData
        };
    }, [integrations, streamHistory, twitchStreamInfo, vkStreamInfo]);


    // Показываем пустые карточки если интеграции еще загружаются
    const isLoading = integrations.twitch.enabled === null || integrations.vk.enabled === null || integrationsLoading;

    return (
        <div className="space-y-8 pb-20">
            {/* Статусы стримов - скрываем для гостей */}
            {!isGuest && (
                <StreamStatus 
                    integrations={integrations}
                    streamData={streamData}
                    isLoading={isLoading}
                />
            )}
            
            <div className="space-y-6 max-w-6xl mx-auto overflow-visible">
                {!isAuthenticated ? (
                    <GuestStubs />
                ) : isGuest ? (
                    /* Для гостя показываем только ChatBox */
                    <div className="w-full">
                        <ChatCard 
                            integrations={integrations}
                            isOnHomePage={true}
                        />
                    </div>
                ) : (integrations.twitch.enabled === false && integrations.vk.enabled === false) ? (
                    <IntegrationsDisabledPlaceholder />
                ) : (
                    <>
                        {/* Настройки стрима - в две колонки */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Карточка названия */}
                            <StreamTitleCard onLinkStateChange={setTitleLinked} />
                            
                            {/* Карточка категории */}
                            <StreamCategoryCard onLinkStateChange={setCategoryLinked} />
                        </div>
                        
                        {/* Чат - на всю ширину */}
                        <ChatCard 
                            integrations={integrations}
                            isOnHomePage={true}
                        />
                        
                        {/* Быстрые действия - под чатом */}
                        <QuickActionsBar />
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;
