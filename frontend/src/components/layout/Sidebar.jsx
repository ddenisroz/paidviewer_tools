import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Mic, Clapperboard, AreaChart, Terminal, ChevronDown, ChevronRight, Youtube, Coins, Headphones, Settings } from 'lucide-react';

const navItems = [
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
            { to: '/dashboard/media/youtube', label: 'Youtube интеграция', icon: Youtube },
            { to: '/dashboard/media/channel-points', label: 'Управление баллами канала', icon: Coins },
        ]
    },
    { to: '/dashboard/analytics', label: 'Анализ и модерация чата', icon: AreaChart },
    { to: '/dashboard/commands', label: 'Команды чата', icon: Terminal },
    { to: '/dashboard/settings', label: 'Настройки', icon: Settings },
];

const SidebarNavItem = ({ item }) => {
    const location = useLocation();
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    const isParentActive = hasSubmenu 
        ? location.pathname.startsWith(item.to)
        : location.pathname === item.to;

    const [isOpen, setIsOpen] = useState(isParentActive);

    useEffect(() => {
        if (isParentActive) {
            setIsOpen(true);
        }
    }, [isParentActive, location.pathname]);

    if (hasSubmenu) {
        return (
            <div>
                <div className='flex items-center justify-between rounded-lg px-4 py-2.5 text-lg font-semibold transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground'>
                    <NavLink to={item.to} end className={({isActive}) => `flex items-center gap-4 flex-1 ${isActive ? 'text-primary' : ''}`}>
                        <item.icon className={`h-6 w-6 ${isParentActive ? 'text-primary' : ''}`} />
                        {item.label}
                    </NavLink>
                    <button onClick={() => setIsOpen(!isOpen)} className="p-1 -mr-1 rounded-full hover:bg-accent">
                        {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
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
            <item.icon className={`h-6 w-6 ${location.pathname === item.to ? 'text-primary' : ''}`} />
            {item.label}
        </NavLink>
    );
};

const Sidebar = () => {
    return (
        <div className="hidden border-r bg-background md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-16 items-center border-b px-4 lg:h-[70px] lg:px-6">
                    <a href="/" className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Payedviewer tools
                        </span>
                    </a>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {navItems.map((item) => (
                            <SidebarNavItem key={item.to} item={item} />
                        ))}
                    </nav>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
