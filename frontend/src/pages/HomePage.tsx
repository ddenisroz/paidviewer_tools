// src/pages/HomePage.tsx
import React, { useEffect, useMemo } from 'react';

import { Check, MessageCircle, Settings, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import ChatCard from '@/features/chat/components/ChatCard';
import QuickActionsBar from '@/features/home/components/QuickActionsBar';
import StreamManagementCards from '@/features/stream/components/StreamManagementCards';
import StreamStatus from '@/features/stream/components/StreamStatus';
import { useTwitchStreamInfo, useVkStreamInfo } from '@/queries/stream/streamQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { logger } from '@/shared/utils/prodLogger';
import { getAndClearReturnUrl } from '@/utils/urlUtils';
import { useLayoutStore } from '@/store/useLayoutStore';
import WidgetWrapper from '@/features/home/components/WidgetWrapper';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAuth();
    const { integrations } = useIntegrations();
    const { currentData } = useData();

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
        // Check if user has any ENABLED integrations (matching legacy behavior)
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations]);

    const streamData = useMemo(() => {
        const twitchData = integrations?.twitch?.enabled ? {
            isLive: (twitchStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (twitchStreamInfo?.data?.viewers ?? 0) as number,
            gameName: (twitchStreamInfo?.data?.game_name ?? '') as string || (integrations.twitch?.enabled && currentData.twitch?.category?.name ? currentData.twitch.category.name : ''),
            boxArtUrl: (twitchStreamInfo?.data?.thumbnail_url ?? twitchStreamInfo?.data?.box_art_url ?? '') as string || (integrations.twitch?.enabled && currentData.twitch?.category?.box_art_url ? currentData.twitch.category.box_art_url : '')
        } : undefined;

        const vkData = integrations?.vk?.enabled ? {
            isLive: (vkStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (vkStreamInfo?.data?.viewers ?? 0) as number,
            gameName: (vkStreamInfo?.data?.category_name ?? '') as string || (integrations.vk?.enabled && currentData.vk?.category?.name ? currentData.vk.category.name : ''),
            boxArtUrl: (vkStreamInfo?.data?.category_img_url ?? '') as string || (integrations.vk?.enabled && currentData.vk?.category?.cover_url ? currentData.vk.category.cover_url : '')
        } : undefined;

        // Ensure box art URLs are valid for display (Twitch needs replacement)
        if (twitchData?.boxArtUrl && twitchData.boxArtUrl.includes('{width}')) {
            twitchData.boxArtUrl = twitchData.boxArtUrl.replace('{width}', '52').replace('{height}', '72');
        }

        return {
            twitch: twitchData,
            vk: vkData
        };
    }, [integrations, twitchStreamInfo, vkStreamInfo, currentData]);


    // Auto-logout if no integrations are connected (requested behavior)
    useEffect(() => {
        if (isAuthenticated && !hasAnyIntegration && integrations) {
            // Check double confirmation to avoid race conditions during load
            const timer = setTimeout(async () => {
                const { twitch, vk } = integrations;
                if (!twitch?.enabled && !vk?.enabled) {
                    logger.log('[HOMEPAGE] No integrations found, logging out...');
                    await logout();
                    navigate('/login');
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, hasAnyIntegration, integrations, logout, navigate]);

    const { widgets, isEditMode, toggleEditMode, reorderWidgets } = useLayoutStore();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Требуется сдвиг на 8px для активации drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex(w => w.id === active.id);
            const newIndex = widgets.findIndex(w => w.id === over.id);
            reorderWidgets(oldIndex, newIndex);
        }
    };

    const renderWidget = (id: string) => {
        switch (id) {
            case 'stream-status':
                return (
                    <StreamStatus
                        integrations={integrations}
                        streamData={streamData}
                        isLoading={false}
                    />
                );
            case 'stream-management':
                return <StreamManagementCards />;
            case 'chat':
                return (
                    <ChatCard
                        integrations={integrations}
                        isOnHomePage={true}
                    />
                );
            case 'quick-actions':
                return <QuickActionsBar />;
            default:
                return null;
        }
    };

    const widgetTitles: Record<string, string> = {
        'stream-status': 'Статус стрима',
        'stream-management': 'Управление стримом',
        'chat': 'Чат',
        'quick-actions': 'Быстрые действия'
    };

    return (
        <div className="space-y-4 pb-20 relative">
            {/* Layout Controls */}
            {/* Layout Controls - Moved to Header */}
            {/* Keeping empty space if needed, or remove completely */}

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
                                    Автоматический выход...
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={widgets.map(w => w.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-6 transition-all">
                                {widgets.map(w => (
                                    <WidgetWrapper
                                        key={w.id}
                                        id={w.id}
                                        title={widgetTitles[w.id]}
                                    >
                                        {renderWidget(w.id)}
                                    </WidgetWrapper>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
};

export default HomePage;
