import React, { useEffect, useMemo, useState } from 'react';

import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { authService } from '@/services/api/services/authService';
import { integrationsService } from '@/services/api/services/integrationsService';
import { DonationAlertsIcon, TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Badge } from '@/shared/components/ui/badge';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { saveReturnUrl } from '@/utils/urlUtils';

import { Button } from '../ui/button';

const Header: React.FC = () => {
    const { user, logout, isAuthenticated, refreshAuthStatus } = useAuth();
    const { integrations, platformRelease, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const location = useLocation();
    const [integrationsOpen, setIntegrationsOpen] = useState(false);

    // Заголовки страниц
    const pageTitles = useMemo(
        () => ({
            '/dashboard/tts/voices': 'Управление голосами',
            '/dashboard/tts/local': 'Self Hosted TTS',
            '/dashboard/tts': 'TTS ИИ озвучка',
            '/dashboard/youtube': 'YouTube заказы',
            '/dashboard/drops': 'Drops система',
            '/dashboard/commands': 'Команды',
            '/dashboard/points': 'Баллы канала',
            '/dashboard/settings': 'Настройки',
            '/dashboard/chat-analysis': 'Аналитика чата',
            '/dashboard/admin': '',
            '/dashboard': '',
        }),
        []
    );

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
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [integrationsOpen]);

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
                    saveReturnUrl();
                    const redirected = integrationsService.connectDonationAlertsRedirect();
                    if (!redirected) {
                        toast.error('Не удалось открыть авторизацию DonationAlerts');
                    }
                }
            }
        } catch (error) {
            logger.error('Error toggling integration:', error);
        }
    };

    return (
        <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-transparent px-3 sm:gap-4 sm:px-6 lg:h-16">
            <div className="col-start-2 min-w-0 justify-self-center">
                {pageTitle && (
                    <h1 className="app-heading-page truncate text-center text-xl text-cyan-200 sm:text-2xl">
                        {pageTitle}
                    </h1>
                )}
            </div>

            <div className="col-start-3 flex shrink-0 items-center justify-end gap-2 justify-self-end sm:gap-4">
                {isAuthenticated && (
                    <div className="relative integrations-menu">
                        <Button
                            variant="outline"
                            className="flex h-10 items-center gap-2 border-none bg-transparent px-2 text-foreground shadow-none transition-colors duration-200 hover:bg-transparent hover:text-blue-400 active:scale-100 active:transform-none sm:px-4"
                            onClick={() => setIntegrationsOpen(!integrationsOpen)}
                        >
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Интеграции</span>
                            <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${integrationsOpen ? 'rotate-180' : ''}`}
                            />
                        </Button>

                        {integrationsOpen && (
                            <div className="absolute right-0 top-12 z-50 w-64 rounded-md border border-border/60 bg-[#0b0712] shadow-md ring-1 ring-white/10">
                                <div className="p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground">Интеграции</h3>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <TwitchIcon width="24" height="24" className="text-[#9146FF]" />
                                            <span className="text-sm">Twitch</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('twitch')}
                                            className={`w-12 h-6 rounded-full transition-colors ${
                                                integrations?.twitch?.enabled ? 'bg-[#9146FF]' : 'bg-slate-600'
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                                    integrations?.twitch?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <VKIcon width="24" height="24" className="text-[#FF4444]" />
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">VK Live</span>
                                                {platformRelease.vk.badgeLabel ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="h-5 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300"
                                                    >
                                                        {platformRelease.vk.badgeLabel}
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('vk')}
                                            className={`w-12 h-6 rounded-full transition-colors ${
                                                integrations?.vk?.enabled ? 'bg-[#FF4444]' : 'bg-slate-600'
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                                    integrations?.vk?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <DonationAlertsIcon width="24" height="24" />
                                            <span className="text-sm">DonationAlerts</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('donationalerts')}
                                            className={`w-12 h-6 rounded-full transition-colors ${
                                                integrations?.donationalerts?.enabled ? 'bg-orange-500' : 'bg-slate-600'
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                                    integrations?.donationalerts?.enabled
                                                        ? 'translate-x-6'
                                                        : 'translate-x-0.5'
                                                }`}
                                            />
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
                        className="group h-10 w-10 rounded-lg hover:bg-transparent transition-colors duration-200"
                        title="Выйти"
                    >
                        <LogOut className="h-5 w-5 text-foreground transition-colors duration-200 group-hover:text-red-300" />
                    </Button>
                )}
            </div>
        </header>
    );
};

export default Header;
