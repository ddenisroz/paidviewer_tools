// src/components/tts/BlacklistManager.jsx
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, UserX, VolumeX, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useIntegrations } from '../../context/IntegrationsContext';
import { useAuth } from '../../context/AuthContext';
import { useBlockedUsers, useBlockUser, useUnblockUser } from '../../queries/tts/ttsQueries';

const BlacklistManager = React.memo(() => {
    const [newUsername, setNewUsername] = useState('');
    const [isBlacklistExpanded, setIsBlacklistExpanded] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('twitch'); // По умолчанию Twitch
    
    // Используем useCallback для стабильной ссылки на функцию
    const toggleBlacklistExpanded = useCallback(() => {
        setIsBlacklistExpanded(prev => !prev);
    }, []);
    
    const { integrations } = useIntegrations();
    const { user } = useAuth();

    // React Query hooks
    const { data: blockedUsersData, isLoading: loading } = useBlockedUsers({
        retry: false, // Не повторяем при ошибке
        refetchOnWindowFocus: false,
    });

    const blockUserMutation = useBlockUser({
        onSuccess: (response, variables) => {
            setNewUsername('');
            const platformName = variables.platform === 'twitch' ? 'Twitch' : 'VK Live';
            toast.success(`Пользователь ${variables.username} заглушен на ${platformName}`);
        },
        onError: (error) => {
            // Ошибка уже обработана в hook
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const unblockUserMutation = useUnblockUser({
        onSuccess: (response, variables) => {
            const platformName = variables.platform === 'twitch' ? 'Twitch' : 'VK Live';
            toast.success(`${variables.username} разглушен на ${platformName}`);
        },
        onError: (error) => {
            // Ошибка уже обработана в hook
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const blacklist = blockedUsersData?.data?.blocked_users || [];
    const adding = blockUserMutation.isPending;

    // Получаем доступные платформы из интеграций
    const getAvailablePlatforms = () => {
        const platforms = [];
        if (integrations?.twitch?.enabled) platforms.push('twitch');
        if (integrations?.vk?.enabled) platforms.push('vk');
        return platforms;
    };

    // Получаем имя канала для платформы
    const getChannelName = (platform) => {
        if (platform === 'twitch') return user?.twitch_username || '';
        if (platform === 'vk') return user?.vk_username || user?.vk_channel_name || '';
        return '';
    };

    // Добавление пользователя в черный список
    const addToBlacklist = () => {
        if (!newUsername.trim()) {
            return;
        }

        if (!selectedPlatform) {
            return;
        }

        const channelName = getChannelName(selectedPlatform);
        
        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${selectedPlatform}`);
            return;
        }

        blockUserMutation.mutate({
            channel_name: channelName,
            platform: selectedPlatform,
            username: newUsername.trim()
        });
    };

    // Удаление пользователя из черного списка (конкретная запись)
    const removeFromBlacklist = (blockedUser) => {
        unblockUserMutation.mutate({
            channel_name: blockedUser.channel_name,
            platform: blockedUser.platform,
            username: blockedUser.username
        });
    };


    // Получаем иконку для платформы
    const getPlatformIcon = (platform) => {
        if (platform === 'twitch') return '🟣';
        if (platform === 'vk') return '🔵';
        return '❓';
    };


    const availablePlatforms = getAvailablePlatforms();

    return (
        <Card data-testid="blacklist-card">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/50 transition-colors pb-4"
                onClick={toggleBlacklistExpanded}
                data-testid="blacklist-header"
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <UserX className="h-5 w-5" />
                        Черный список пользователей
                    </CardTitle>
                    <ChevronDown 
                        className={`w-4 h-4 transition-transform ${isBlacklistExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </CardHeader>
            {isBlacklistExpanded && (
                <CardContent className="space-y-6 pt-4">
                    {/* Добавление пользователя */}
                    <div className="space-y-3">
                        {/* Поле ввода, выбор платформы и кнопка */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="Введите имя пользователя"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                                disabled={adding || availablePlatforms.length === 0}
                                className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                            />
                            {availablePlatforms.length > 0 && (
                                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                    <SelectTrigger className="w-full sm:w-[140px] bg-gray-800/50 border-gray-700/50 text-white">
                                        <SelectValue placeholder="Платформа" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                        {availablePlatforms.map(platform => (
                                            <SelectItem key={platform} value={platform}>
                                                {getPlatformIcon(platform)} {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button
                                onClick={addToBlacklist}
                                disabled={adding || !newUsername.trim() || !selectedPlatform}
                                className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {adding ? 'Добавление...' : 'Заглушить'}
                            </Button>
                        </div>
                        
                        {availablePlatforms.length === 0 && (
                            <p className="text-sm text-gray-400">
                                Подключите хотя бы одну платформу (Twitch или VK Live) чтобы заглушать пользователей
                            </p>
                        )}
                    </div>

                    {/* Список пользователей */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-300">
                            Заглушенные пользователи ({blacklist.length})
                        </h4>
                        
                        {loading ? (
                            <div className="text-center py-4 text-gray-400">
                                Загрузка...
                            </div>
                        ) : blacklist.length === 0 ? (
                            <div className="text-center py-4 text-gray-400">
                                Список пуст
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {blacklist.map((blockedUser) => (
                                    <div
                                        key={`${blockedUser.platform}-${blockedUser.username}-${blockedUser.id}`}
                                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <VolumeX className="h-4 w-4 text-red-400" />
                                            <span className="font-medium">{blockedUser.username}</span>
                                            <Badge 
                                                variant="outline" 
                                                className={`text-xs ${
                                                    blockedUser.platform === 'twitch' 
                                                        ? 'border-purple-500 text-purple-400' 
                                                        : 'border-blue-500 text-blue-400'
                                                }`}
                                            >
                                                {getPlatformIcon(blockedUser.platform)} {blockedUser.platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFromBlacklist(blockedUser)}
                                            className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                            title="Разглушить"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
});

BlacklistManager.displayName = 'BlacklistManager';

export default BlacklistManager;
