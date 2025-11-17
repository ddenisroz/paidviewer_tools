// src/components/tts/BlacklistManager.tsx
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, UserX, VolumeX, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { useAuth } from '../../../context/AuthContext';
import { useBlockedUsers, useBlockUser, useUnblockUser } from '../../../queries/tts/ttsQueries';

interface BlockedUser {
    id: number;
    username: string;
    platform: string;
}

const BlacklistManager: React.FC = React.memo(() => {
    const [newUsername, setNewUsername] = useState('');
    const [isBlacklistExpanded, setIsBlacklistExpanded] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string>('twitch'); // По умолчанию Twitch
    
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
        onError: (error: any) => {
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
        onError: (error: any) => {
            // Ошибка уже обработана в hook
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const blacklist: BlockedUser[] = Array.isArray(blockedUsersData) ? blockedUsersData : (blockedUsersData as any)?.data?.blocked_users || [];
    const adding = blockUserMutation.isPending;

    // Получаем доступные платформы из интеграций
    const getAvailablePlatforms = (): string[] => {
        const platforms: string[] = [];
        if (integrations?.twitch?.enabled) platforms.push('twitch');
        if (integrations?.vk?.enabled) platforms.push('vk');
        return platforms;
    };

    // Получаем имя канала для платформы
    const getChannelName = (platform: string): string => {
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
            platform: selectedPlatform as 'youtube' | 'twitch' | 'vk',
            username: newUsername.trim()
        });
    };

    // Удаление пользователя из черного списка
    const removeFromBlacklist = (userId: number, username: string, platform: string) => {
        const channelName = getChannelName(platform);
        
        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${platform}`);
            return;
        }

        unblockUserMutation.mutate({
            channel_name: channelName,
            platform: platform as 'youtube' | 'twitch' | 'vk',
            username: username
        });
    };

    const availablePlatforms = getAvailablePlatforms();
    const hasPlatforms = availablePlatforms.length > 0;

    // Фильтруем черный список по выбранной платформе
    const filteredBlacklist = selectedPlatform === 'all'
        ? blacklist
        : blacklist.filter(user => user.platform === selectedPlatform);

    // Получаем иконку для платформы
    const getPlatformIcon = (platform: string): string => {
        if (platform === 'twitch') return '🟣';
        if (platform === 'vk') return '🔵';
        return '❓';
    };

    // Получаем цвет для платформы
    const getPlatformColor = (platform: string): string => {
        if (platform === 'twitch') return 'bg-purple-600';
        if (platform === 'vk') return 'bg-blue-600';
        return 'bg-gray-600';
    };

    if (!hasPlatforms) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserX className="h-5 w-5 text-red-500" />
                        Черный список
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Подключите хотя бы одну платформу (Twitch или VK Live) для использования черного списка
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <UserX className="h-5 w-5 text-red-500" />
                        Черный список
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleBlacklistExpanded}
                        className="gap-2"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isBlacklistExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            {isBlacklistExpanded && (
                <CardContent className="space-y-4">
                    {/* Добавление пользователя */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Добавить пользователя</label>
                        <div className="flex gap-2">
                            <Input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Введите имя пользователя"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        addToBlacklist();
                                    }
                                }}
                                className="flex-1"
                            />
                            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePlatforms.includes('twitch') && (
                                        <SelectItem value="twitch">🟣 Twitch</SelectItem>
                                    )}
                                    {availablePlatforms.includes('vk') && (
                                        <SelectItem value="vk">🔵 VK Live</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={addToBlacklist}
                                disabled={adding || !newUsername.trim()}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Добавить
                            </Button>
                        </div>
                    </div>

                    {/* Список заблокированных пользователей */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Заблокированные пользователи ({filteredBlacklist.length})
                        </label>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Загрузка...</p>
                        ) : filteredBlacklist.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Черный список пуст</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {filteredBlacklist.map((user) => (
                                    <Badge
                                        key={user.id}
                                        variant="destructive"
                                        className="flex items-center gap-2"
                                    >
                                        <UserX className="h-3 w-3" />
                                        <span>{user.username}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${getPlatformColor(user.platform)} text-white`}>
                                            {getPlatformIcon(user.platform)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                            onClick={() => removeFromBlacklist(user.id, user.username, user.platform)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
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



