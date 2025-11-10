// src/pages/HomePage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, MessageCircle } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTwitchStreamInfo, useVkStreamInfo } from '../queries/stream/streamQueries';
import StreamStatus from '../components/StreamStatus';
import ChatCard from '../components/ChatCard';
import StreamTitleCard from '../components/StreamTitleCard';
import StreamCategoryCard from '../components/StreamCategoryCard';
import GuestStubs from '../components/GuestStubs';
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
    const { data: twitchStreamInfo } = useTwitchStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.twitch?.enabled,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    // React Query: загружаем данные стримов (VK) с автоматическим обновлением
    const { data: vkStreamInfo } = useVkStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.vk?.enabled,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    // Удален неиспользуемый preparedStreamHistory

    // Удален неиспользуемый preparedVkStreamHistory
    
    // Проверяем наличие хотя бы одной интеграции
    const hasAnyIntegration = useMemo(() => {
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations]);
    
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


    // 🚀 НИКОГДА НЕ ПОКАЗЫВАЕМ СКЕЛЕТОНЫ - только реальные данные или fallback
    // Это устраняет мерцание при загрузке страницы

    return (
        <div className="space-y-8 pb-20">
            {/* Статусы стримов - скрываем для гостей */}
            {!isGuest && (
                <StreamStatus 
                    integrations={integrations}
                    streamData={streamData}
                    isLoading={false}
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
                ) : !hasAnyIntegration ? (
                    /* Нет подключенных интеграций - показываем сообщение */
                    <Card className="border-gray-700">
                        <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-gray-500" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <h3 className="text-xl font-semibold text-gray-200">
                                    У вас нет подключенных интеграций
                                </h3>
                                <p className="text-gray-400 text-sm">
                                    Для использования функций бота необходимо подключить хотя бы одну платформу (Twitch или VK Live)
                                </p>
                            </div>
                            <Button 
                                onClick={() => navigate('/dashboard/settings')}
                                className="gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Перейти в настройки
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* 🚀 ВСЕГДА показываем карточки - они сами обработают disabled состояние */}
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
