// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';

import { MessageCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import ChatCard from '../components/ChatCard';
import QuickActionsBar from '../components/QuickActionsBar';
import StreamManagementCards from '../components/StreamManagementCards';
import StreamStatus from '../components/StreamStatus';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTwitchStreamInfo, useVkStreamInfo } from '../queries/stream/streamQueries';
import { getAndClearReturnUrl } from '../utils/oauthRedirect';
import { logger } from '../utils/prodLogger';

interface _StreamHistory {
    status?: string;
    current_viewers?: number;
    current_vk_viewers?: number;
}

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const [_titleLinked, setTitleLinked] = useState(false);
    const [_categoryLinked, setCategoryLinked] = useState(false);
    
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const returnUrl = getAndClearReturnUrl();
        if (returnUrl) {
            logger.log('[REFRESH] [OAuth] Redirecting back from dashboard to:', returnUrl);
            navigate(returnUrl, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    

    const { data: twitchStreamInfo } = useTwitchStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.twitch?.enabled,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const { data: vkStreamInfo } = useVkStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.vk?.enabled,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });
    
    const hasAnyIntegration = useMemo<boolean>(() => {
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations]);
    
    const streamData = useMemo(() => {
        const twitchData = integrations?.twitch?.enabled ? {
            isLive: (twitchStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (twitchStreamInfo?.data?.viewers ?? 0) as number
        } : undefined;
        
        const vkData = integrations?.vk?.enabled ? {
            isLive: (vkStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (vkStreamInfo?.data?.viewers ?? 0) as number
        } : undefined;
        
        return {
            twitch: twitchData,
            vk: vkData
        };
    }, [integrations, twitchStreamInfo, vkStreamInfo]);

    return (
        <div className="space-y-8 pb-20">
            <StreamStatus 
                integrations={integrations}
                streamData={streamData}
                isLoading={false}
            />
            
            <div className="space-y-6 max-w-6xl mx-auto overflow-visible">
                {!isAuthenticated ? (
                    <Card className="border-gray-700">
                        <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-gray-500" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <h3 className="text-xl font-semibold text-gray-200">
                                    Требуется авторизация
                                </h3>
                                <p className="text-gray-400 text-sm">
                                    Для использования функций бота необходимо войти через Twitch или VK Live
                                </p>
                            </div>
                            <Button 
                                onClick={() => navigate('/login')}
                                className="gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Войти в систему
                            </Button>
                        </CardContent>
                    </Card>
                ) : !hasAnyIntegration ? (
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
                        <StreamManagementCards 
                            onTitleLinkStateChange={setTitleLinked}
                            onCategoryLinkStateChange={setCategoryLinked}
                        />
                        
                        <ChatCard 
                            integrations={integrations}
                            isOnHomePage={true}
                        />
                        
                        <QuickActionsBar />
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;

