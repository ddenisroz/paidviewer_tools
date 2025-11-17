import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Mic, Youtube, Coins, Headphones, Settings, Shield, MessageSquare, Command, Sparkles, Monitor, Menu, X, ChevronRight, LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdminList } from '../../queries/admin/adminQueries';
import { logger } from '../../utils/prodLogger';
import { createPreloadHandler } from '../../utils/preloadRoute';

interface NavSubItem {
    to: string;
    label: string;
    icon: LucideIcon;
}

interface NavItem {
    to?: string;
    label: string;
    icon: LucideIcon;
    submenu?: NavSubItem[];
}

interface SidebarNavItemProps {
    item: NavItem;
    openSection: string | null;
    setOpenSection: (section: string | null) => void;
    onMobileMenuClose: () => void;
}

// Route preload mapping - maps routes to their lazy loaders
const routePreloaders: Record<string, () => void> = {
    '/dashboard': createPreloadHandler(() => import('../../pages/HomePage'), 'home'),
    '/dashboard/tts': createPreloadHandler(() => import('../../features/tts/pages/TtsMainPage'), 'tts-main'),
    '/dashboard/tts/voices': createPreloadHandler(() => import('../../features/tts/pages/VoiceManagementPage'), 'tts-voices'),
    '/dashboard/tts/local': createPreloadHandler(() => import('../../features/tts/pages/LocalTTSSettingsPage'), 'tts-local'),
    '/dashboard/youtube': createPreloadHandler(() => import('../../pages/media/YoutubeIntegrationPage'), 'youtube'),
    '/dashboard/points': createPreloadHandler(() => import('../../pages/PointsManagementPage'), 'points'),
    '/dashboard/drops': createPreloadHandler(() => import('../../features/drops/pages/DropsMainPage'), 'drops'),
    '/dashboard/chat-analysis': createPreloadHandler(() => import('../../pages/AnalyticsPage'), 'analytics'),
    '/dashboard/commands': createPreloadHandler(() => import('../../pages/CommandsPage'), 'commands'),
    '/dashboard/settings': createPreloadHandler(() => import('../../pages/SettingsPage'), 'settings'),
    '/dashboard/dolbaebadmintts': createPreloadHandler(() => import('../../features/admin/pages/AdminPage'), 'admin'),
};

const getNavItems = (isYourchy: boolean): NavItem[] => {
    const baseItems: NavItem[] = [
        { to: '/dashboard', label: 'Главная', icon: Home },
        { 
            label: 'TTS ИИ озвучка', 
            icon: Mic,
            submenu: [
                { to: '/dashboard/tts', label: 'Основные настройки', icon: Settings },
                { to: '/dashboard/tts/voices', label: 'Управление голосами', icon: Headphones },
                { to: '/dashboard/tts/local', label: 'Локальный движок', icon: Monitor },
            ]
        },
        { 
            label: 'Медиа запросы', 
            icon: Sparkles,
            submenu: [
                { to: '/dashboard/youtube', label: 'YouTube заказы', icon: Youtube },
                { to: '/dashboard/points', label: 'Баллы канала', icon: Coins },
                { to: '/dashboard/drops', label: 'Drops система', icon: Sparkles },
            ]
        },
        { to: '/dashboard/chat-analysis', label: 'Управление чатом', icon: MessageSquare },
        { to: '/dashboard/commands', label: 'Команды', icon: Command },
        { to: '/dashboard/settings', label: 'Настройки', icon: Settings },
    ];

    // Добавляем админ панель только для пользователя yourchy
    if (isYourchy) {
        baseItems.push({ to: '/dashboard/dolbaebadmintts', label: 'Админ панель', icon: Shield });
    }

    return baseItems;
};

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, openSection, setOpenSection, onMobileMenuClose }) => {
    const location = useLocation();
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    // Проверяем активен ли какой-то из подпунктов
    const isParentActive = hasSubmenu 
        ? item.submenu!.some(sub => {
            // Точное совпадение или путь начинается с sub.to + '/'
            return location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');
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

    // Keyboard navigation для accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (hasSubmenu && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpenSection(isOpen ? null : item.label);
        }
    };

    if (hasSubmenu) {
        return (
            <div 
                className="relative group"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setOpenSection(null)}
            >
                <div 
                    className={`w-full px-4 py-2.5 text-lg font-semibold cursor-pointer transition-all relative ${
                        isOpen 
                            ? 'bg-primary/20 text-primary' 
                            : isParentActive 
                                ? 'bg-primary/10 text-primary' 
                                : 'text-muted-foreground group-hover:bg-muted/50 group-hover:text-foreground'
                    }`}
                    onClick={() => setOpenSection(isOpen ? null : item.label)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isOpen}
                    aria-label={`${item.label} ${isOpen ? 'свернуть' : 'развернуть'}`}
                >
                    {/* Индикатор активной подстраницы */}
                    {isParentActive && !isOpen && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full pointer-events-none" />
                    )}
                    <div className="flex items-center justify-between gap-4 pointer-events-none">
                        <div className="flex items-center gap-4">
                            <item.icon className="h-6 w-6" />
                            {item.label}
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-0 opacity-100' : 'opacity-0'}`} />
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
                            className="absolute left-full top-0 w-64 bg-background border border-border rounded-lg shadow-lg z-50 py-2 animate-in fade-in slide-in-from-left-2 duration-200"
                            onMouseEnter={handleMouseEnter}
                        >
                        {item.submenu!.map((subItem) => (
                            <NavLink
                                key={subItem.to}
                                to={subItem.to}
                                end
                                onClick={() => {
                                    setOpenSection(null); // Закрываем submenu при клике
                                    onMobileMenuClose();
                                }}
                                onMouseEnter={() => {
                                    // Preload route on hover
                                    const preloader = routePreloaders[subItem.to];
                                    if (preloader) preloader();
                                }}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 text-base font-medium transition-colors ${
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                    }`
                                }
                            >
                                {subItem.icon && <subItem.icon className="h-5 w-5" />}
                                {subItem.label}
                            </NavLink>
                        ))}
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
                `w-full flex items-center gap-4 px-4 py-2.5 text-lg font-semibold transition-colors ${
                    isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
            }
        >
            <item.icon className="h-6 w-6" />
            {item.label}
        </NavLink>
    );
};

const Sidebar: React.FC = () => {
    const { user, isAuthenticated, isGuest } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Загружаем список админов только для админов
    const { data: adminListData } = useAdminList({
        enabled: !!user?.is_admin,
    });
    
    const adminUsers = adminListData?.data || [];
    
    // Проверяем, является ли пользователь админом
    useEffect(() => {
        if (isAuthenticated && user) {
            // Проверяем напрямую поле is_admin от сервера
            const userIsAdmin = user.is_admin === true;
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
                location.pathname === sub.to || location.pathname.startsWith(sub.to + '/')
            )
        );
        
        // Если мы НЕ на странице из submenu, сбрасываем openSection
        if (!isInAnySubmenu) {
            setOpenSection(null);
        }
    }, [location.pathname, navItems]);
    
    // Состояние для мобильного меню
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <>
            {/* Мобильная кнопка меню */}
            <button 
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Открыть меню"
            >
                {isMobileMenuOpen ? (
                    <X className="h-6 w-6 text-white" />
                ) : (
                    <Menu className="h-6 w-6 text-white" />
                )}
            </button>
            
            {/* Overlay для мобильных */}
            {isMobileMenuOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <div className={`
                fixed md:relative h-full w-64 md:w-auto bg-background z-50 transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                md:block
            `}>
                <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-16 items-center px-4 lg:h-[70px] lg:px-6">
                    <NavLink to="/dashboard" className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold text-green-400 font-mono tracking-wider whitespace-nowrap">
                            Payedviewer_tools
                            {isGuest && (
                                <span className="text-sm text-slate-400 ml-2">
                                    (Guest mode)
                                </span>
                            )}
                        </span>
                    </NavLink>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start text-sm font-medium">
                        {navItems.map((item) => (
                            <SidebarNavItem 
                                key={item.to || item.label} 
                                item={item} 
                                openSection={openSection}
                                setOpenSection={setOpenSection}
                                onMobileMenuClose={() => setIsMobileMenuOpen(false)}
                            />
                        ))}
                    </nav>
                </div>
                
                {/* Блок для гостей в низу сайдбара */}
                {!isAuthenticated && (
                    <div className="p-4 border-t">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="text-4xl mb-2">
                                😔
                            </div>
                            <h3 className="text-lg font-bold text-foreground">
                                Интеграции отключены
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Для доступа к полному функционалу необходимо авторизоваться через Twitch
                            </p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </>
    );
}

export default Sidebar;

