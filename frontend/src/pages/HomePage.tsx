// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';

import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MessageCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ChatBoxSettingsModal from '@/components/ChatBoxSettingsModal';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { HomeQuickActions } from '@/features/home/components/HomeQuickActions';
import WidgetWrapper from '@/features/home/components/WidgetWrapper';
import { createHomeStreamData } from '@/features/home/utils/homeStreamData';
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
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const { data: vkStreamInfo } = useVkStreamInfo({
        enabled: !!isAuthenticated && !!integrations?.vk?.enabled,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const hasAnyIntegration = useMemo<boolean>(() => {
        // Check if user has any ENABLED integrations (matching legacy behavior)
        return integrations?.twitch?.enabled || integrations?.vk?.enabled;
    }, [integrations]);

    const streamData = useMemo(
        () =>
            createHomeStreamData({
                integrations,
                twitchStreamInfo,
                vkStreamInfo,
                initialData,
                combineCategories,
            }),
        [integrations, twitchStreamInfo, vkStreamInfo, initialData, combineCategories]
    );

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
            const oldIndex = activeWidgets.findIndex((w) => w.id === active.id);
            const newIndex = activeWidgets.findIndex((w) => w.id === over.id);
            reorderWidgets(oldIndex, newIndex);
        }
    };

    const handleOpenChatWindow = (): void => {
        const width = 600;
        const height = 800;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
            '/chat-window',
            'ChatWindow',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );
    };

    const renderWidget = (id: string) => {
        switch (id) {
            case 'stream-status':
                return <StreamStatus integrations={integrations} streamData={streamData} isLoading={false} />;
            case 'stream-management':
                return <StreamManagementCards />;
            default:
                return null;
        }
    };

    const widgetTitles: Record<string, string> = {
        'stream-status': 'Статус стрима',
        'stream-management': 'Управление стримом',
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
                                <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
                                <p className="text-muted-foreground text-sm">
                                    Для использования функций бота необходимо войти через Twitch или VK Live
                                </p>
                            </div>
                            <Button onClick={() => navigate('/login')} className="gap-2">
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
                                <p className="text-muted-foreground text-sm">Автоматический выход...</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={activeWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                            {isEditMode ? (
                                <div className="space-y-6 transition-all">
                                    {activeWidgets
                                        .filter((w) => w.id === 'stream-status' || w.id === 'stream-management')
                                        .map((w) => (
                                            <WidgetWrapper key={w.id} id={w.id} title={widgetTitles[w.id]}>
                                                {renderWidget(w.id)}
                                            </WidgetWrapper>
                                        ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {activeWidgets
                                        .filter((w) => w.id === 'stream-status' || w.id === 'stream-management')
                                        .map((w) => (
                                            <WidgetWrapper key={w.id} id={w.id} title={widgetTitles[w.id]}>
                                                {renderWidget(w.id)}
                                            </WidgetWrapper>
                                        ))}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                )}

                <HomeQuickActions
                    onOpenChatBox={() => setShowChatBoxModal(true)}
                    onOpenChatWindow={handleOpenChatWindow}
                />
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
