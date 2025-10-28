import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Mic, Youtube, Coins, Headphones, Settings, Shield, MessageSquare, Command, Sparkles, Monitor, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAdminList, botService } from '../../services/microservices';

const getNavItems = (isYourchy) => {
    const baseItems = [
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
            label: 'Медиа интерактивность', 
            icon: Sparkles,
            submenu: [
                { to: '/dashboard/youtube', label: 'YouTube заказы', icon: Youtube },
                { to: '/dashboard/points', label: 'Баллы канала', icon: Coins },
                { to: '/dashboard/drops', label: 'Drops система', icon: Sparkles },
            ]
        },
        { to: '/dashboard/chat-analysis', label: 'Анализ и модерация чата', icon: MessageSquare },
        { to: '/dashboard/commands', label: 'Команды', icon: Command },
        { to: '/dashboard/settings', label: 'Настройки', icon: Settings },
    ];

    // Добавляем админ панель только для пользователя yourchy
    if (isYourchy) {
        baseItems.push({ to: '/dashboard/dolbaebadmintts', label: 'Админ панель', icon: Shield });
    }

    return baseItems;
};

const SidebarNavItem = ({ item, openSection, setOpenSection, onMobileMenuClose }) => {
    const location = useLocation();
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    // Проверяем активен ли какой-то из подпунктов
    const isParentActive = hasSubmenu 
        ? item.submenu.some(sub => location.pathname === sub.to || location.pathname.startsWith(sub.to))
        : location.pathname === item.to;

    const isOpen = openSection === item.label;

    // Функции для управления dropdown при наведении
    const handleMouseEnter = () => {
        if (hasSubmenu) {
            setOpenSection(item.label);
        }
    };

    const handleMouseLeave = () => {
        if (hasSubmenu) {
            setOpenSection(null);
        }
    };

    if (hasSubmenu) {
        return (
            <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className={`rounded-lg px-4 py-2.5 text-lg font-semibold cursor-pointer transition-colors ${
                    isParentActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}>
                    <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6" />
                        {item.label}
                    </div>
                </div>
                {isOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/20 pl-4">
                        {item.submenu.map((subItem) => (
                            <NavLink
                                key={subItem.to}
                                to={subItem.to}
                                onClick={onMobileMenuClose}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-md px-4 py-2 text-base font-medium transition-colors ${
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground/80'
                                    }`
                                }
                            >
                                {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                {subItem.label}
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <NavLink
            to={item.to}
            end
            onClick={onMobileMenuClose}
            className={({ isActive }) =>
                `flex items-center gap-4 rounded-lg px-4 py-2.5 text-lg font-semibold transition-colors ${
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

const Sidebar = () => {
    const { user, isAuthenticated, isGuest } = useAuth();
    const [adminUsers, setAdminUsers] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Загружаем список админов только для админов
    useEffect(() => {
        const loadAdminList = async () => {
            // Проверяем права доступа перед запросом
            if (!user?.is_admin) {
                setAdminUsers([]);
                return;
            }
            
            try {
                const response = await botService.get('/api/admin/list');
                setAdminUsers(response.data);
            } catch (error) {
                console.error('Failed to load admin list:', error);
                setAdminUsers([]);
            }
        };
        
        loadAdminList();
    }, [user?.is_admin]); // Загружаем только при изменении прав админа
    
    // Проверяем, является ли пользователь админом
    useEffect(() => {
        if (isAuthenticated && user) {
            // Проверяем напрямую поле is_admin от сервера
            const userIsAdmin = user.is_admin === true;
            setIsAdmin(userIsAdmin);
        } else {
            setIsAdmin(false);
        }
    }, [isAuthenticated, user, adminUsers]);
    
    const navItems = getNavItems(isAdmin);
    
    // Состояние для управления открытыми разделами
    const [openSection, setOpenSection] = useState(null);
    
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
                fixed md:relative h-full w-64 bg-background z-50 transform transition-transform duration-300 ease-in-out
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
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {navItems.map((item) => (
                            <SidebarNavItem 
                                key={item.to} 
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
