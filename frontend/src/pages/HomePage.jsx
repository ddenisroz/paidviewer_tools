// src/pages/HomePage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import TtsQuickSettings from '../components/TtsQuickSettings';
import { getAndClearReturnUrl } from '../utils/oauthRedirect';



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
            console.log('🔄 [OAuth] Redirecting back from dashboard to:', returnUrl);
            // Используем replace чтобы не добавлять /dashboard в историю
            navigate(returnUrl, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Пустой массив зависимостей - срабатывает ТОЛЬКО при монтировании
    
    // Дополнительные данные для VK Live
    const [vkStreamInfo, setVkStreamInfo] = useState(null);
    
    // 🚀 КЭШИРОВАНИЕ: Храним время последней загрузки VK stream info
    const [lastVkLoadTime, setLastVkLoadTime] = useState(0);
    const CACHE_TTL = 30000; // 30 секунд кэш
    
    // Общее состояние загрузки для всех карточек
    const [contentLoaded, setContentLoaded] = useState(false);
    
    // Состояние объединения полей для карточек
    const [titleLinked, setTitleLinked] = useState(false);
    const [categoryLinked, setCategoryLinked] = useState(false);

    // Состояние будет загружаться через контекст CombineSettingsContext

    // Загружаем данные VK Live отдельно
    useEffect(() => {
        const loadVkStreamInfo = async () => {
            if (integrations?.vk?.enabled && isAuthenticated) {
                // Проверяем кэш
                const now = Date.now();
                if (now - lastVkLoadTime < CACHE_TTL) {
                    console.log('📦 [HomePage] Using cached VK stream info');
                    return;
                }
                
                try {
                    const response = await botService.get('/api/vk/stream-info');
                    setVkStreamInfo(response.data);
                    setLastVkLoadTime(now);
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
    }, [integrations?.vk?.enabled, isAuthenticated, lastVkLoadTime]);

    // Удален неиспользуемый preparedStreamHistory

    // Удален неиспользуемый preparedVkStreamHistory
    
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


    // Показываем пустые карточки если интеграции еще загружаются
    const isLoading = integrations.twitch.enabled === null || integrations.vk.enabled === null || integrationsLoading;
    
    // Управляем состоянием загрузки контента
    useEffect(() => {
        if (!isLoading) {
            // Небольшая задержка для плавного появления всех карточек одновременно
            const timer = setTimeout(() => {
                setContentLoaded(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setContentLoaded(false);
        }
    }, [isLoading]);

    return (
        <div className="space-y-8 pb-20">
            {/* Статусы стримов - скрываем для гостей */}
            {!isGuest && (
                <div className={`flex justify-center transition-all duration-500 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <StreamStatus 
                        integrations={integrations}
                        streamData={streamData}
                        isLoading={isLoading}
                    />
                </div>
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
                            <div className={`transition-all duration-500 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                {isLoading ? (
                                    <Card className="border-muted-foreground/20 bg-muted/5">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                <div className="w-5 h-5 bg-muted-foreground/30 rounded"></div>
                                                <div className="h-5 bg-muted-foreground/30 rounded w-24"></div>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-center h-12">
                                                    <div className="flex space-x-1">
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <StreamTitleCard onLinkStateChange={setTitleLinked} />
                                )}
                            </div>
                            
                            {/* Карточка категории */}
                            <div className={`transition-all duration-500 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                {isLoading ? (
                                    <Card className="border-muted-foreground/20 bg-muted/5">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                <div className="w-5 h-5 bg-muted-foreground/30 rounded"></div>
                                                <div className="h-5 bg-muted-foreground/30 rounded w-32"></div>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-center h-12">
                                                    <div className="flex space-x-1">
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <StreamCategoryCard onLinkStateChange={setCategoryLinked} />
                                )}
                            </div>
                        </div>
                        
                        {/* Чат - на всю ширину */}
                        <div className={`w-full transition-all duration-500 delay-200 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            {isLoading ? (
                                <Card className="border-muted-foreground/20 bg-muted/5">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <div className="w-5 h-5 bg-muted-foreground/30 rounded"></div>
                                            <div className="h-5 bg-muted-foreground/30 rounded w-20"></div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-center h-32">
                                                <div className="flex space-x-1">
                                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                            <ChatCard 
                                integrations={integrations}
                                isOnHomePage={true}
                            />
                            )}
                        </div>
                        
                        {/* Быстрые настройки TTS - под чатом */}
                        {!isLoading && (
                            <div className={`w-full transition-all duration-500 delay-300 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                <TtsQuickSettings />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;
