import React, { useEffect, useMemo, useState } from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    CaretRight,
    ChatCircleText,
    Coins,
    GearSix,
    Headphones,
    House,
    MicrophoneStage,
    Monitor,
    ShieldCheck,
    Smiley,
    Sparkle,
    TerminalWindow,
    YoutubeLogo,
} from '@phosphor-icons/react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { ADMIN_BASE_PATH } from '@/features/admin/utils/adminRoutes';
import { createPreloadHandler } from '@/shared/utils/preloadRoute';

interface NavSubItem {
    to: string;
    label: string;
    icon: React.ElementType;
}

interface NavItem {
    to?: string;
    label: string;
    icon: React.ElementType;
    submenu?: NavSubItem[];
}

interface SidebarNavItemProps {
    item: NavItem;
    openSection: string | null;
    setOpenSection: (section: string | null) => void;
    onMobileMenuClose: () => void;
}

// Route preload mapping - maps routes to their lazy loaders
// Note: Dynamic imports must use relative paths from this file's location
const routePreloaders: Record<string, () => void> = {
    '/dashboard': createPreloadHandler(() => import('@/pages/HomePage'), 'home'),
    '/dashboard/tts': createPreloadHandler(() => import('@/features/tts/pages/TtsMainPage'), 'tts-main'),
    '/dashboard/tts/voices': createPreloadHandler(() => import('@/features/tts/pages/VoiceManagementPage'), 'tts-voices'),
    '/dashboard/tts/local': createPreloadHandler(() => import('@/features/tts/pages/LocalTTSSettingsPage'), 'tts-local'),
    '/dashboard/media': createPreloadHandler(() => import('@/pages/media/YoutubeIntegrationPage'), 'youtube'),
    '/dashboard/points': createPreloadHandler(() => import('@/pages/PointsManagementPage'), 'points'),
    '/dashboard/drops': createPreloadHandler(() => import('@/features/drops/pages/DropsMainPage'), 'drops'),
    '/dashboard/chat-analysis': createPreloadHandler(() => import('@/pages/AnalyticsPage'), 'analytics'),
    '/dashboard/commands': createPreloadHandler(() => import('@/pages/CommandsPage'), 'commands'),
    '/dashboard/settings': createPreloadHandler(() => import('@/pages/SettingsMainPage'), 'settings'),
    [ADMIN_BASE_PATH]: createPreloadHandler(() => import('@/features/admin/pages/AdminPage'), 'admin'),
};

const getNavItems = (isAdminUser: boolean): NavItem[] => {
    const baseItems: NavItem[] = [
        { to: '/dashboard', label: 'Главная', icon: House },
        {
            label: 'TTS ИИ озвучка',
            icon: MicrophoneStage,
            submenu: [
                { to: '/dashboard/tts', label: 'Основные настройки', icon: GearSix },
                { to: '/dashboard/tts/voices', label: 'Управление голосами', icon: Headphones },
                { to: '/dashboard/tts/local', label: 'Локальный движок', icon: Monitor },
            ]
        },
        {
            label: 'Медиа запросы',
            icon: Sparkle,
            submenu: [
                { to: '/dashboard/media', label: 'YouTube заказы', icon: YoutubeLogo },
                { to: '/dashboard/media?tab=memealerts', label: 'MemeAlerts', icon: Smiley },
                { to: '/dashboard/drops', label: 'Drops система', icon: Sparkle },
            ]
        },
        { to: '/dashboard/points', label: 'Баллы канала', icon: Coins },
        { to: '/dashboard/chat-analysis', label: 'Аналитика чата', icon: ChatCircleText },
        { to: '/dashboard/commands', label: 'Команды', icon: TerminalWindow },
        { to: '/dashboard/settings', label: 'Настройки', icon: GearSix },
    ];

    // Show the admin entry only to users with admin access.
    if (isAdminUser) {
        baseItems.push({ to: ADMIN_BASE_PATH, label: 'Админ панель', icon: ShieldCheck });
    }

    return baseItems;
};

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, openSection, setOpenSection, onMobileMenuClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const firstSubItem = hasSubmenu ? item.submenu![0] : null;

    // Проверяем активен ли какой-то из подпунктов
    const isParentActive = hasSubmenu
        ? item.submenu!.some(sub => {
            const subPath = sub.to.split('?')[0];
            return location.pathname === subPath || location.pathname.startsWith(`${subPath}/`);
        })
        : location.pathname === item.to;

    // Меню открыто только при hover
    const isOpen = openSection === item.label;

    // Функция для открытия dropdown при наведении
    const handleMouseEnter = () => {
        if (hasSubmenu) {
            setOpenSection(item.label);
        }
    };

    const handleParentNavigate = () => {
        if (!firstSubItem) return;

        const preloader = routePreloaders[firstSubItem.to.split('?')[0]];
        if (preloader) preloader();
        navigate(firstSubItem.to);
        setOpenSection(null);
        onMobileMenuClose();
    };

    // Keyboard navigation для accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (hasSubmenu && e.key === 'Enter') {
            e.preventDefault();
            handleParentNavigate();
        } else if (hasSubmenu && e.key === ' ') {
            e.preventDefault();
            setOpenSection(isOpen ? null : item.label);
        }
    };

    const renderSubItem = (subItem: NavSubItem, mode: 'mobile' | 'desktop') => {
        const subPath = subItem.to.split('?')[0];
        const isSubItemActive = location.pathname === subPath &&
            (subItem.to.includes('?')
                ? location.search === `?${subItem.to.split('?')[1]}`
                : location.search === '' || location.search === '?tab=youtube');

        return (
            <NavLink
                key={`${mode}-${subItem.to}`}
                to={subItem.to}
                end
                onClick={() => {
                    setOpenSection(null);
                    onMobileMenuClose();
                }}
                onMouseEnter={() => {
                    const preloader = routePreloaders[subPath];
                    if (preloader) preloader();
                }}
                className={() =>
                    `group relative flex w-full items-center gap-3 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors ${isSubItemActive
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'text-muted-foreground hover:bg-blue-500/10 hover:text-blue-100'
                    }`
                }
            >
                {isSubItemActive && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-blue-300/95" />
                )}
                {subItem.icon && <subItem.icon className="h-4 w-4 flex-shrink-0" weight="duotone" />}
                {subItem.label}
            </NavLink>
        );
    };

    if (hasSubmenu) {
        return (
            <div
                className="relative group"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setOpenSection(null)}
            >
                <div
                    className={`relative w-full cursor-pointer px-0 py-3 text-base font-semibold transition-colors xl:px-4 xl:py-2.5 xl:text-lg ${(isParentActive || isOpen)
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'text-muted-foreground hover:bg-blue-500/10 hover:text-blue-100'
                        }`}
                    onClick={handleParentNavigate}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isOpen}
                    aria-label={`Открыть ${item.label}`}
                    title={item.label}
                >
                    {/* Индикатор активной подстраницы - показываем только если меню закрыто */}
                    {isParentActive && !isOpen && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-blue-300/95" />
                    )}
                    <div className="pointer-events-none flex items-center justify-center gap-3 xl:justify-between xl:gap-4">
                        <div className="flex min-w-0 items-center justify-center gap-0 xl:justify-start xl:gap-4">
                            <item.icon className="h-5 w-5 flex-shrink-0" weight="duotone" />
                            <span className="hidden truncate xl:inline">{item.label}</span>
                        </div>
                        <CaretRight className={`hidden h-4 w-4 transition-transform xl:block ${isOpen ? 'rotate-90 opacity-100' : 'opacity-40'}`} weight="bold" />
                    </div>
                </div>

                {/* Submenu появляется СПРАВА от родителя (GitHub-style, без gap) */}
                {isOpen && (
                    <>
                        {/* Невидимый "мост" между родителем и submenu для плавного hover */}
                        <div
                            className="absolute left-full top-0 w-2 h-full z-40"
                            onMouseEnter={handleMouseEnter}
                        />
                        <div
                            className="absolute left-full top-0 z-50 w-[min(18rem,calc(100vw-4rem))] overflow-hidden rounded-lg border border-border bg-popover/95 p-0 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-left-2 duration-200"
                            onMouseEnter={handleMouseEnter}
                        >
                            {item.submenu!.map((subItem) => renderSubItem(subItem, 'desktop'))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <NavLink
            to={item.to || '#'}
            end
            onClick={onMobileMenuClose}
            onMouseEnter={() => {
                // Preload route on hover
                if (item.to) {
                    const preloader = routePreloaders[item.to];
                    if (preloader) preloader();
                }
            }}
            className={({ isActive }) =>
                `relative flex w-full items-center justify-center gap-0 px-0 py-3 text-base font-semibold transition-colors xl:justify-start xl:gap-4 xl:px-4 xl:py-2.5 xl:text-lg ${isActive
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'text-muted-foreground hover:bg-blue-500/10 hover:text-blue-100'
                }`
            }
            title={item.label}
        >
            <span className={`absolute inset-y-0 left-0 w-0.5 bg-blue-300/95 transition-opacity ${location.pathname === item.to ? 'opacity-100' : 'opacity-0'}`} />
            <item.icon className="h-5 w-5 flex-shrink-0" weight="duotone" />
            <span className="hidden truncate xl:inline">{item.label}</span>
        </NavLink>
    );
};

const Sidebar: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);

    // Проверяем, является ли пользователь админом
    useEffect(() => {
        if (isAuthenticated && user) {
            // role — источник истины, is_admin оставляем как legacy fallback
            const userIsAdmin = user.role === 'admin' || user.is_admin === true;
            setIsAdmin(userIsAdmin);
        } else {
            setIsAdmin(false);
        }
    }, [isAuthenticated, user]);

    // Мемоизируем navItems чтобы избежать пересоздания при каждом рендере
    const navItems = useMemo(() => getNavItems(isAdmin), [isAdmin]);
    const location = useLocation();

    // Состояние для управления открытыми разделами
    const [openSection, setOpenSection] = useState<string | null>(null);

    // Сброс openSection при переходе на страницу, которая НЕ в submenu
    useEffect(() => {
        // Проверяем, находимся ли мы на странице из какого-либо submenu
        const isInAnySubmenu = navItems.some(item =>
            item.submenu?.some(sub =>
                location.pathname === sub.to || location.pathname.startsWith(`${sub.to}/`)
            )
        );

        // Если мы НЕ на странице из submenu, сбрасываем openSection
        if (!isInAnySubmenu) {
            setOpenSection(null);
        }
    }, [location.pathname, navItems]);

    return (
        <div className="relative z-50 h-full w-14 border-r border-border/70 bg-card md:w-16 xl:w-[280px]">
                <div className="flex h-full max-h-screen flex-col gap-2 relative">
                    <div className="flex h-16 items-center justify-center px-2 xl:h-[70px] xl:justify-start xl:px-6">
                        <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold" title="Paidviewer_tools">
                            <span className="brand-wordmark text-lg text-green-400 xl:hidden">
                                PV
                            </span>
                            <span className="brand-wordmark hidden whitespace-nowrap text-xl text-green-400 xl:inline">
                                Paidviewer_tools
                            </span>
                        </NavLink>
                    </div>
                    <div className="flex-1 overflow-visible">
                        <nav className="grid w-full text-sm font-medium">
                            {navItems.map((item) => (
                                <SidebarNavItem
                                    key={item.to || item.label}
                                    item={item}
                                    openSection={openSection}
                                    setOpenSection={setOpenSection}
                                    onMobileMenuClose={() => undefined}
                                />
                            ))}
                        </nav>
                    </div>

                    {/* Мини-плееры (слоты для портала) */}
                    <div className="mt-auto px-2 pb-4 overflow-visible space-y-3">
                        <div id="youtube-mini-player-slot" className="overflow-visible" />
                    </div>

                </div>
            </div>
    );
}

export default Sidebar;

