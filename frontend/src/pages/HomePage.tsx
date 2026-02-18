// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';

import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ExternalLink, MessageCircle, MonitorSmartphone, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


import ChatBoxSettingsModal from '@/components/ChatBoxSettingsModal';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import WidgetWrapper from '@/features/home/components/WidgetWrapper';
import StreamManagementCards from '@/features/stream/components/StreamManagementCards';
import StreamStatus from '@/features/stream/components/StreamStatus';
import { useTwitchStreamInfo, useVkStreamInfo } from '@/queries/stream/streamQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { logger } from '@/shared/utils/prodLogger';
import { useLayoutStore } from '@/store/useLayoutStore';
import { getAndClearReturnUrl } from '@/utils/urlUtils';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAuth();
    const { integrations } = useIntegrations();
    const { initialData } = useData();
    const { getCombineSettings } = useUserSettings();
    const { combine_categories: combineCategories } = getCombineSettings();

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
        staleTime: 120 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 120 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const { data: vkStreamInfo } = useVkStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.vk?.enabled,
        staleTime: 120 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 120 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const hasAnyIntegration = useMemo<boolean>(() => {
        // Check if user has any ENABLED integrations (matching legacy behavior)
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations]);

    const streamData = useMemo(() => {
        const combineCategoriesEnabled = !!combineCategories && !!integrations?.twitch?.enabled && !!integrations?.vk?.enabled;
        const fallbackTwitchCategory = twitchStreamInfo?.data?.game_name ? {
            name: twitchStreamInfo?.data?.game_name as string,
            box_art_url: (twitchStreamInfo?.data?.thumbnail_url ?? twitchStreamInfo?.data?.box_art_url ?? '') as string
        } : null;
        const fallbackVkCategory = vkStreamInfo?.data?.category_name ? {
            name: vkStreamInfo?.data?.category_name as string,
            cover_url: (vkStreamInfo?.data?.category_img_url ?? '') as string
        } : null;
        const combinedCategory = combineCategoriesEnabled
            ? (initialData.twitch?.category || initialData.vk?.category || fallbackTwitchCategory || fallbackVkCategory) as { name?: string; title?: string; box_art_url?: string; cover_url?: string } | null
            : null;
        const combinedGameName = combinedCategory?.name || combinedCategory?.title || '';
        const combinedBoxArtUrl = combinedCategory?.box_art_url || combinedCategory?.cover_url || '';

        const twitchCategoryName = initialData.twitch?.category?.name || initialData.twitch?.category?.title || (twitchStreamInfo?.data?.game_name ?? '');
        const twitchCategoryBoxArt = initialData.twitch?.category?.box_art_url || initialData.twitch?.category?.cover_url ||
            ((twitchStreamInfo?.data?.thumbnail_url ?? twitchStreamInfo?.data?.box_art_url ?? '') as string);

        const vkCategoryName = initialData.vk?.category?.name || initialData.vk?.category?.title || (vkStreamInfo?.data?.category_name ?? '');
        const vkCategoryBoxArt = initialData.vk?.category?.cover_url || initialData.vk?.category?.box_art_url ||
            ((vkStreamInfo?.data?.category_img_url ?? '') as string);

        const twitchData = integrations?.twitch?.enabled ? {
            isLive: (twitchStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (twitchStreamInfo?.data?.viewers ?? 0) as number,
            gameName: combineCategoriesEnabled && combinedGameName
                ? String(combinedGameName)
                : String(twitchCategoryName || ''),
            boxArtUrl: combineCategoriesEnabled && combinedBoxArtUrl
                ? combinedBoxArtUrl
                : (twitchCategoryBoxArt || '')
        } : undefined;

        const vkData = integrations?.vk?.enabled ? {
            isLive: (vkStreamInfo?.data?.is_live ?? false) as boolean,
            viewerCount: (vkStreamInfo?.data?.viewers ?? 0) as number,
            gameName: combineCategoriesEnabled && combinedGameName
                ? String(combinedGameName)
                : String(vkCategoryName || ''),
            boxArtUrl: combineCategoriesEnabled && combinedBoxArtUrl
                ? combinedBoxArtUrl
                : (vkCategoryBoxArt || '')
        } : undefined;

        // Ensure box art URLs are valid for display (Twitch needs replacement)
        if (twitchData?.boxArtUrl && twitchData.boxArtUrl.includes('{width}')) {
            twitchData.boxArtUrl = twitchData.boxArtUrl.replace('{width}', '52').replace('{height}', '72');
        }

        return {
            twitch: twitchData,
            vk: vkData
        };
    }, [integrations, twitchStreamInfo, vkStreamInfo, initialData, combineCategories]);


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

    const { widgets, draftWidgets, isEditMode, reorderWidgets } = useLayoutStore();
    const activeWidgets = isEditMode && draftWidgets ? draftWidgets : widgets;
    const [showChatBoxModal, setShowChatBoxModal] = useState(false);

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
            const oldIndex = activeWidgets.findIndex(w => w.id === active.id);
            const newIndex = activeWidgets.findIndex(w => w.id === over.id);
            reorderWidgets(oldIndex, newIndex);
        }
    };

    const handleOpenChatWindow = (): void => {
        const width = 600;
        const height = 800;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open(
            '/chat-window',
            'ChatWindow',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );
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
            default:
                return null;
        }
    };

    const widgetTitles: Record<string, string> = {
        'stream-status': 'Статус стрима',
        'stream-management': 'Управление стримом'
    };

    return (
        <div className="h-full min-h-0 relative">
            {/* Layout Controls */}
            {/* Layout Controls - Moved to Header */}
            {/* Keeping empty space if needed, or remove completely */}

            <div className="h-full min-h-0 w-full overflow-visible flex flex-col gap-6">
                {!isAuthenticated ? (
                    <Card className="card-glass border-border">
                        <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <h3 className="text-xl font-semibold text-foreground">
                                    Требуется авторизация
                                </h3>
                                <p className="text-muted-foreground text-sm">
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
                    <Card className="card-glass border-border">
                        <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <h3 className="text-xl font-semibold text-foreground">
                                    У вас нет подключенных интеграций
                                </h3>
                                <p className="text-muted-foreground text-sm">
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
                        <SortableContext items={activeWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                            {isEditMode ? (
                                <div className="space-y-6 transition-all">
                                    {activeWidgets
                                        .filter((w) => w.id === 'stream-status' || w.id === 'stream-management')
                                        .map(w => (
                                        <WidgetWrapper
                                            key={w.id}
                                            id={w.id}
                                            title={widgetTitles[w.id]}
                                        >
                                            {renderWidget(w.id)}
                                        </WidgetWrapper>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {activeWidgets
                                        .filter((w) => w.id === 'stream-status' || w.id === 'stream-management')
                                        .map((w) => (
                                            <WidgetWrapper
                                                key={w.id}
                                                id={w.id}
                                                title={widgetTitles[w.id]}
                                            >
                                                {renderWidget(w.id)}
                                            </WidgetWrapper>
                                        ))}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                )}

                <Card className="card-glass border-border mt-auto flex-1 min-h-[220px]">
                    <CardContent className="h-full p-1">
                        <div className="w-full border-b border-border pb-1">
                            <div className="flex items-start justify-center gap-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowChatBoxModal(true)}
                                    className="h-20 w-24 border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-400 flex flex-col items-center justify-center gap-0.5"
                                    title="OBS ChatOverlay"
                                    aria-label="OBS ChatOverlay"
                                >
                                    <MonitorSmartphone className="h-6 w-6" strokeWidth={2.5} />
                                    <span className="text-sm font-semibold leading-none">OBS Chat</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleOpenChatWindow}
                                    className="h-20 w-24 border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-400 flex flex-col items-center justify-center gap-0.5"
                                    title="Чат в отдельном окне"
                                    aria-label="Чат в отдельном окне"
                                >
                                    <ExternalLink className="h-6 w-6" strokeWidth={2.5} />
                                    <span className="text-sm font-semibold leading-none">Открыть чат</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <ChatBoxSettingsModal
                isOpen={showChatBoxModal}
                onClose={() => setShowChatBoxModal(false)}
                onSave={() => {}}
            />
        </div>
    );
};

export default HomePage;
