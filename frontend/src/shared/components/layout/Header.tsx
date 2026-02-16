import React, { useEffect, useMemo, useState } from 'react';

/* eslint-disable no-alert */
import { Check, ChevronDown, LogOut, RotateCcw, Settings, Settings2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';


import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { cn } from '@/lib/utils';
import { authService } from '@/services/api/services/authService';
import { integrationsService } from '@/services/api/services/integrationsService';
import { DonationAlertsIcon, TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { logger } from '@/shared/utils/prodLogger';
import { useLayoutStore, type WidgetId } from '@/store/useLayoutStore';
import { saveReturnUrl } from '@/utils/urlUtils';

import { Button } from '../ui/button';

const Header: React.FC = () => {
    const { user, logout, isAuthenticated, refreshAuthStatus } = useAuth();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const location = useLocation();
    const [integrationsOpen, setIntegrationsOpen] = useState(false);
    const [layoutBlocksMenuOpen, setLayoutBlocksMenuOpen] = useState(false);

    // Layout Store logic
    const { isEditMode, toggleEditMode, resetLayout, toggleWidgetVisibility, widgets, draftWidgets } = useLayoutStore();
    const isDashboard = location.pathname === '/dashboard';
    const activeWidgets = isEditMode && draftWidgets ? draftWidgets : widgets;
    const widgetLabels: Record<WidgetId, string> = useMemo(() => ({
        'stream-status': 'Статус стрима',
        'stream-management': 'Управление стримом',
        'chat': 'Чат',
        'quick-actions': 'Быстрые действия',
    }), []);

    // Заголовки страниц
    const pageTitles = useMemo(() => ({
        '/dashboard/tts/voices': 'Управление голосами',
        '/dashboard/tts/local': 'Локальный TTS',
        '/dashboard/tts': 'TTS ИИ озвучка',
        '/dashboard/youtube': 'YouTube заказы',
        '/dashboard/drops': 'Drops система',
        '/dashboard/commands': 'Команды',
        '/dashboard/points': 'Баллы канала',
        '/dashboard/settings': 'Настройки',
        '/dashboard/chat-analysis': 'Аналитика чата',
        '/dashboard/dolbaebadmintts': '',
        '/dashboard': '',
    }), []);

    const pageTitle = useMemo(() => {
        const currentPath = location.pathname.replace(/\/$/, '') || '/';

        if (currentPath === '/dashboard/media') {
            const params = new URLSearchParams(location.search);
            const tab = params.get('tab');
            if (tab === 'memealerts') return 'MemeAlerts';
            if (tab === 'drops') return 'Drops система';
            return 'YouTube заказы';
        }

        if (pageTitles[currentPath as keyof typeof pageTitles] !== undefined) {
            return pageTitles[currentPath as keyof typeof pageTitles];
        }

        const sortedPaths = Object.entries(pageTitles).sort((a, b) => b[0].length - a[0].length);

        for (const [path, title] of sortedPaths) {
            if (!title) continue;
            if (currentPath.startsWith(`${path}/`)) {
                return title;
            }
        }

        return '';
    }, [pageTitles, location.pathname, location.search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (integrationsOpen && !(event.target as Element).closest('.integrations-menu')) {
                setIntegrationsOpen(false);
            }
            if (layoutBlocksMenuOpen && !(event.target as Element).closest('.layout-blocks-menu')) {
                setLayoutBlocksMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [integrationsOpen, layoutBlocksMenuOpen]);

    useEffect(() => {
        if (!isEditMode) {
            setLayoutBlocksMenuOpen(false);
        }
    }, [isEditMode]);


    const handleIntegrationToggle = async (platform: string) => {
        try {
            if (platform === 'twitch') {
                const newEnabled = !integrations?.twitch?.enabled;
                if (newEnabled) {
                    saveReturnUrl();
                    authService.loginWithTwitch();
                } else {
                    await updateTwitchIntegration(newEnabled);
                }
            } else if (platform === 'vk') {
                const newEnabled = !integrations?.vk?.enabled;
                if (newEnabled) {
                    saveReturnUrl();
                    authService.loginWithVk();
                } else {
                    await updateVkIntegration(newEnabled);
                }
            } else if (platform === 'donationalerts') {
                if (integrations?.donationalerts?.enabled) {
                    await integrationsService.disconnectDonationAlerts();
                    await refreshAuthStatus();
                } else {
                    try {
                        const response = await integrationsService.connectDonationAlerts();
                        const responseData = response.data as { data?: { success?: boolean; auth_url?: string }; success?: boolean; auth_url?: string };
                        const data = responseData.data || responseData;
                        if (data.success && data.auth_url) {
                            saveReturnUrl();
                            window.location.href = data.auth_url;
                        } else {
                            logger.error('URL авторизации DonationAlerts не получен:', data);
                            alert('Ошибка: URL авторизации DonationAlerts не получен');
                        }
                    } catch (error) {
                        logger.error('Ошибка подключения DonationAlerts:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                        alert(`Ошибка подключения DonationAlerts: ${errorMessage}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Error toggling integration:', error);
        }
    };

    return (
        <header className="relative flex h-14 items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:h-16 bg-muted/40">
            <div className="flex-1"></div>

            {pageTitle && (
                <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-emerald-400 to-green-500 bg-clip-text text-transparent tracking-wide drop-shadow-lg"
                    style={{
                        fontFamily: "'Orbitron', 'Rajdhani', 'Exo 2', 'Inter', sans-serif",
                        letterSpacing: '0.08em',
                        textShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                    }}>
                    {pageTitle}
                </h1>
            )}

            <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
                {/* Layout Config Button (Dashboard only) */}
                {isAuthenticated && isDashboard && (
                    <div className="hidden sm:flex items-center gap-2 mr-2">
                        {isEditMode && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={resetLayout}
                                    className="h-9 px-3 border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 hover:text-white"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Сбросить позиционирование
                                </Button>

                                <div className="relative layout-blocks-menu">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setLayoutBlocksMenuOpen((prev) => !prev)}
                                        className="h-9 px-3 border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 hover:text-white"
                                    >
                                        Блоки
                                        <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", layoutBlocksMenuOpen && "rotate-180")} />
                                    </Button>

                                    {layoutBlocksMenuOpen && (
                                        <div className="absolute right-0 top-11 w-64 rounded-md border border-border bg-popover p-2 shadow-lg z-50">
                                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                                Показывать блоки
                                            </div>
                                            <div className="mt-1 space-y-1">
                                                {activeWidgets.map((widget) => (
                                                    <button
                                                        key={widget.id}
                                                        type="button"
                                                        onClick={() => toggleWidgetVisibility(widget.id)}
                                                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-slate-200 hover:bg-slate-800/50"
                                                    >
                                                        <span>{widgetLabels[widget.id]}</span>
                                                        <span
                                                            className={cn(
                                                                "flex h-4 w-4 items-center justify-center rounded border",
                                                                widget.isVisible
                                                                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                                                                    : "border-slate-500 bg-transparent text-transparent"
                                                            )}
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <Button
                            type="button"
                            onClick={toggleEditMode}
                            variant={isEditMode ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("flex items-center gap-2 transition-all", isEditMode && "bg-green-500/20 text-green-400 hover:bg-green-500/30")}
                        >
                            {isEditMode ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                            {isEditMode ? "Сохранить макет" : "Настроить макет"}
                        </Button>
                    </div>
                )}

                {isAuthenticated && (
                    <div className="relative integrations-menu">
                        <Button
                            variant="outline"
                            className="flex items-center gap-2 h-10 px-4 bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500 text-slate-200 hover:text-white transition-colors duration-200 active:scale-100 active:transform-none"
                            onClick={() => setIntegrationsOpen(!integrationsOpen)}
                        >
                            <Settings className="h-4 w-4" />
                            <span>Интеграции</span>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${integrationsOpen ? 'rotate-180' : ''}`} />
                        </Button>

                        {integrationsOpen && (
                            <div
                                className="absolute right-0 top-12 w-64 bg-popover border border-border rounded-md shadow-lg z-50"
                            >
                                <div className="p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground">Интеграции</h3>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <TwitchIcon width="24" height="24" className="text-[#9146FF]" />
                                            <span className="text-sm">Twitch</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('twitch')}
                                            className={`w-12 h-6 rounded-full transition-colors ${integrations?.twitch?.enabled
                                                ? 'bg-[#9146FF]'
                                                : 'bg-slate-600'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${integrations?.twitch?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <VKIcon width="24" height="24" className="text-[#FF4444]" />
                                            <span className="text-sm">VK Live</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('vk')}
                                            className={`w-12 h-6 rounded-full transition-colors ${integrations?.vk?.enabled
                                                ? 'bg-[#FF4444]'
                                                : 'bg-slate-600'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${integrations?.vk?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <DonationAlertsIcon width="24" height="24" />
                                            <span className="text-sm">DonationAlerts</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('donationalerts')}
                                            className={`w-12 h-6 rounded-full transition-colors ${integrations?.donationalerts?.enabled
                                                ? 'bg-orange-500'
                                                : 'bg-slate-600'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${integrations?.donationalerts?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {user && (
                    <Button
                        onClick={logout}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 transition-colors duration-200"
                        title="Выйти"
                    >
                        <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 hover:text-red-400 transition-colors" />
                    </Button>
                )}
            </div>
        </header>
    );
};

export default Header;
