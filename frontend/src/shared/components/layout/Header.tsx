import React, { useEffect, useMemo, useState } from 'react';

import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { authService } from '@/services/api/services/authService';
import { integrationsService } from '@/services/api/services/integrationsService';
import { TwitchIcon, VKIcon, DonationAlertsIcon } from '@/shared/components/PlatformIcons';
import { logger } from '@/shared/utils/prodLogger';
import { saveReturnUrl } from '@/utils/urlUtils';

import { Button } from '../ui/button';

const Header: React.FC = () => {
    const { user, logout, isAuthenticated, refreshAuthStatus } = useAuth();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const _navigate = useNavigate();
    const [integrationsOpen, setIntegrationsOpen] = useState(false);

    // Заголовки страниц
    const pageTitles = useMemo(() => ({
        '/dashboard/tts/voices': 'Управление голосами',
        '/dashboard/tts/local': 'Локальный TTS',
        '/dashboard/tts': 'TTS ИИ озвучка', // Match Sidebar
        '/dashboard/youtube': 'YouTube заказы', // Match Sidebar case
        '/dashboard/drops': 'Drops система', // Match Sidebar case
        '/dashboard/commands': 'Команды',
        '/dashboard/points': 'Баллы канала',
        '/dashboard/settings': 'Настройки',
        '/dashboard/chat-analysis': 'Управление чатом', // Match Sidebar
        '/dashboard/dolbaebadmintts': 'Админ панель',
        '/dashboard': '', // Главная страница без заголовка
    }), []);

    const pageTitle = useMemo(() => {
        const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

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
    }, [pageTitles]);

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
                                            <TwitchIcon width="24" height="24" />
                                            <span className="text-sm">Twitch</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('twitch')}
                                            className={`w-12 h-6 rounded-full transition-colors ${integrations?.twitch?.enabled
                                                ? 'bg-purple-500'
                                                : 'bg-slate-600'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${integrations?.twitch?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <VKIcon width="24" height="24" />
                                            <span className="text-sm">VK Live</span>
                                        </div>
                                        <button
                                            onClick={() => handleIntegrationToggle('vk')}
                                            className={`w-12 h-6 rounded-full transition-colors ${integrations?.vk?.enabled
                                                ? 'bg-red-500'
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
                        className="h-10 w-10 sm:h-12 sm:w-12 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 group"
                        title="Выйти"
                    >
                        <LogOut className="h-7 w-7 sm:h-9 sm:w-9 group-hover:scale-110 transition-transform duration-200" strokeWidth={2.5} />
                    </Button>
                )}
            </div>
        </header>
    );
};

export default Header;
