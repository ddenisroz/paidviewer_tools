import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Mic, Clapperboard, AreaChart, Terminal, Youtube, Coins, Headphones, Settings, Shield, MessageSquare, Command, Dice6, Gift } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAdminList } from '../../services/microservices';

const getNavItems = (isYourchy) => {
    const baseItems = [
        { to: '/dashboard', label: 'Главная', icon: Home },
        { 
            to: '/dashboard/tts', 
            label: 'TTS ИИ озвучка', 
            icon: Mic,
            submenu: [
                { to: '/dashboard/tts/voices', label: 'Управление голосами', icon: Headphones },
            ]
        },
        { 
            to: '/dashboard/media', 
            label: 'Медиа интерактивность', 
            icon: Clapperboard,
            submenu: [
                { to: '/dashboard/media/youtube', label: 'YouTube заказы', icon: Youtube },
                { to: '/dashboard/points', label: 'Баллы канала', icon: Coins },
                { to: '/dashboard/gambling', label: 'Гэмблинг', icon: Dice6 },
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

const SidebarNavItem = ({ item, openSection, setOpenSection }) => {
    const location = useLocation();
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    const isParentActive = hasSubmenu 
        ? location.pathname.startsWith(item.to)
        : location.pathname === item.to;

    const isOpen = openSection === item.to;

    // Автоматически открываем меню при переходе на активную страницу
    useEffect(() => {
        if (isParentActive && !isOpen) {
            setOpenSection(item.to);
        }
    }, [isParentActive, item.to, setOpenSection, isOpen]);

    if (hasSubmenu) {
        return (
            <div>
                <div className='rounded-lg px-4 py-2.5 text-lg font-semibold'>
                    <NavLink 
                        to={item.to} 
                        end 
                        className={({isActive}) => `flex items-center gap-4 transition-colors ${isActive || isParentActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <item.icon className="h-6 w-6" />
                        {item.label}
                    </NavLink>
                </div>
                {isOpen && (
                    <div className="pl-8 pt-2 flex flex-col gap-1">
                        {item.submenu.map((subItem) => (
                            <NavLink
                                key={subItem.to}
                                to={subItem.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-md px-4 py-2 text-base font-medium transition-colors ${
                                        isActive
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground/80'
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
    const { user, isAuthenticated } = useAuth();
    const [adminUsers, setAdminUsers] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Загружаем список админов при монтировании компонента
    useEffect(() => {
        const loadAdminList = async () => {
            try {
                const response = await getAdminList();
                setAdminUsers(response.data.admins || []);
            } catch (error) {
                console.error('Failed to load admin list:', error);
                setAdminUsers([]);
            }
        };
        
        loadAdminList();
    }, []); // Keep empty dependency array to load only once
    
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

    return (
        <div className="hidden bg-background md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-16 items-center px-4 lg:h-[70px] lg:px-6">
                    <NavLink to="/dashboard" className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Payedviewer tools
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
    );
}

export default Sidebar;
