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
import { logger } from '../utils/prodLogger';
import { usePageAnimation, getAnimationClasses } from '../hooks/usePageAnimation';



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
    
    // Дополнительные данные для стримов (Twitch и VK)
    const [twitchStreamInfo, setTwitchStreamInfo] = useState(null);
    const [vkStreamInfo, setVkStreamInfo] = useState(null);
    
    // 🚀 КЭШИРОВАНИЕ: Храним время последней загрузки stream info
    const [lastLoadTime, setLastLoadTime] = useState({ twitch: 0, vk: 0 });
    const CACHE_TTL = 30000; // 30 секунд кэш
    
    // 🎬 Анимация страницы: проигрывается только при первой загрузке
    const { shouldAnimate, contentLoaded } = usePageAnimation('home', 100);
    
    // Состояние объединения полей для карточек
    const [titleLinked, setTitleLinked] = useState(false);
    const [categoryLinked, setCategoryLinked] = useState(false);

    // Состояние будет загружаться через контекст CombineSettingsContext

    // Загружаем данные стримов (Twitch и VK) отдельно
    useEffect(() => {
        const loadStreamInfo = async (platform) => {
            if ((integrations?.twitch?.enabled && platform === 'twitch') || 
                (integrations?.vk?.enabled && platform === 'vk')) {
                if (!isAuthenticated) return;
                
                // Проверяем кэш
                const now = Date.now();
                if (now - lastLoadTime[platform] < CACHE_TTL) {
                    logger.log(`📦 [HomePage] Using cached ${platform} stream info`);
                    return;
                }
                
                try {
                    const response = await botService.get(`/api/${platform}/stream-info`);
                    if (platform === 'twitch') {
                        setTwitchStreamInfo(response.data);
                    } else {
                        setVkStreamInfo(response.data);
                    }
                    setLastLoadTime(prev => ({ ...prev, [platform]: now }));
                } catch (error) {
                    logger.error(`Error loading ${platform} stream info:`, error);
                    if (platform === 'twitch') {
                        setTwitchStreamInfo(null);
                    } else {
                        setVkStreamInfo(null);
                    }
                }
            }
        };

        // Загружаем данные для обеих платформ
        loadStreamInfo('twitch');
        loadStreamInfo('vk');
        
        // Обновляем каждые 30 секунд
        const interval = setInterval(() => {
            loadStreamInfo('twitch');
            loadStreamInfo('vk');
        }, 30000);
        return () => clearInterval(interval);
    }, [integrations?.twitch?.enabled, integrations?.vk?.enabled, isAuthenticated, lastLoadTime]);

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
                <div {...getAnimationClasses(shouldAnimate, contentLoaded, 0)}>
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
                            <div {...getAnimationClasses(shouldAnimate, contentLoaded, 0)}>
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
                            <div {...getAnimationClasses(shouldAnimate, contentLoaded, 100)}>
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
                        <div {...getAnimationClasses(shouldAnimate, contentLoaded, 200)}>
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
                            <div {...getAnimationClasses(shouldAnimate, contentLoaded, 300)}>
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
