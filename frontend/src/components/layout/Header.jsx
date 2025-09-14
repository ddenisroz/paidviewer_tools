import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Twitch, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../hooks/useIntegrations';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import HiddenAuth from '../HiddenAuth';

const Header = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const [isOpen, setIsOpen] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSettings = () => {
        navigate('/dashboard/settings');
    };

    const handleTwitchToggle = async (enabled) => {
        if (enabled) {
            setIsRedirecting(true);
        } else {
            await updateTwitchIntegration(false);
        }
    };

    const handleVkToggle = async (enabled) => {
        if (enabled) {
            // VK пока не реализован
            alert('VK авторизация временно недоступна');
        } else {
            await updateVkIntegration(false);
        }
    };

    if (isRedirecting) {
        return <HiddenAuth />;
    }

    return (
        <header className="flex h-16 items-center justify-end gap-4 border-b bg-background px-6 lg:h-[70px]">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="border-2 border-primary/50 text-primary hover:text-primary hover:bg-muted"
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Настройки интеграций</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {/* Twitch */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                                    <Twitch className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <Label className="text-base font-medium">Twitch</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {integrations.twitch_enabled ? 'Подключен' : 'Не подключен'}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={integrations.twitch_enabled}
                                onCheckedChange={handleTwitchToggle}
                            />
                        </div>

                        {/* VK Live */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                                    <Video className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <Label className="text-base font-medium">VK Live</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {integrations.vk_enabled ? 'Подключен' : 'Не подключен'}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={integrations.vk_enabled}
                                onCheckedChange={handleVkToggle}
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <Button 
                                onClick={handleSettings} 
                                variant="outline" 
                                className="w-full flex items-center gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Открыть полные настройки
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            
            <Button onClick={handleLogout} variant="destructive" size="lg" className="px-6">
                Выйти
            </Button>
        </header>
    );
};

export default Header;
