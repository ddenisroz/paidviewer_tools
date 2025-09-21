import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogIn, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import IntegrationsDialog from '../IntegrationsDialog';

const Header = () => {
    const { user, logout, userMode } = useAuth();
    const navigate = useNavigate();
    const [integrationsOpen, setIntegrationsOpen] = useState(false);

    const handleLoginRedirect = () => {
        // При переходе на логин сбрасываем любой режим
        logout(); 
    };

    const handleSettingsClick = () => {
        setIntegrationsOpen(true);
    };

    return (
        <header className="flex h-16 items-center justify-end gap-4 border-b bg-background px-6 lg:h-[70px]">
            {/* Кнопка настроек - доступна всегда */}
            <Button 
                onClick={handleSettingsClick} 
                variant="ghost" 
                size="icon"
                className="h-12 w-12"
            >
                <Settings className="h-8 w-8" strokeWidth={2.5} />
            </Button>
            
            {userMode === 'guest' ? (
                <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-400">Режим гостя</span>
                    <Button onClick={handleLoginRedirect} variant="outline" size="lg">
                        <LogIn className="mr-2 h-4 w-4" />
                        Войти
                    </Button>
                </div>
            ) : user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar} alt={`@${user.username}`} />
                                <AvatarFallback>{user.username?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user.display_name || user.username}</p>
                                <p className="text-xs leading-none text-muted-foreground">@{user.username}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Настройки</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Выйти</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
            
            {/* Диалог интеграций */}
            <IntegrationsDialog 
                open={integrationsOpen} 
                onOpenChange={setIntegrationsOpen} 
            />
        </header>
    );
};

export default Header;
