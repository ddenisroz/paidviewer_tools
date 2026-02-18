// src/components/tts/BlacklistManager.tsx
import React, { useCallback, useState } from 'react';

import { ChevronDown, Plus, UserX, X } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { useBlockedUsers, useBlockUser, useUnblockUser } from '../../../queries/tts/ttsQueries';

interface BlockedUser {
    id: number;
    username: string;
    platform: string;
}

const BlacklistManager: React.FC = React.memo(() => {
    const [newUsername, setNewUsername] = useState('');
    const [isBlacklistExpanded, setIsBlacklistExpanded] = useState(true);
    const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

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
        onError: (error: unknown) => {
            // Ошибка уже обработана в hook
            const err = error as { code?: string };
            if (err.code === 'ERR_NETWORK' || err.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const unblockUserMutation = useUnblockUser({
        onSuccess: (response, variables) => {
            const platformName = variables.platform === 'twitch' ? 'Twitch' : 'VK Live';
            toast.success(`${variables.username} разглушен на ${platformName}`);
        },
        onError: (error: unknown) => {
            // Ошибка уже обработана в hook
            const err = error as { code?: string };
            if (err.code === 'ERR_NETWORK' || err.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const blacklist: BlockedUser[] = Array.isArray(blockedUsersData)
        ? blockedUsersData
        : ((blockedUsersData as { data?: BlockedUser[] } | undefined)?.data ?? []);
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
        const normalizedUsername = newUsername.trim().toLowerCase();
        if (!normalizedUsername) {
            return;
        }

        if (!selectedPlatform || selectedPlatform === 'all') {
            toast.error('Выберите конкретную платформу для блокировки');
            return;
        }

        const isAlreadyBlocked = blacklist.some((blockedUser) =>
            blockedUser.platform === selectedPlatform &&
            blockedUser.username.trim().toLowerCase() === normalizedUsername
        );
        if (isAlreadyBlocked) {
            toast.error('Пользователь уже находится в черном списке');
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
            username: normalizedUsername
        });
    };

    // Удаление пользователя из черного списка
    const removeFromBlacklist = (username: string, platform: string) => {
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
        if (platform === 'twitch') return '[TW]';
        if (platform === 'vk') return '[VK]';
        return '[?]';
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
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                name="tts_blacklist_username"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        addToBlacklist();
                                    }
                                }}
                                className="flex-1 bg-background text-foreground"
                            />
                            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все платформы</SelectItem>
                                    {availablePlatforms.includes('twitch') && (
                                        <SelectItem value="twitch">[TW] Twitch</SelectItem>
                                    )}
                                    {availablePlatforms.includes('vk') && (
                                        <SelectItem value="vk">[VK] VK Live</SelectItem>
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
                                        onClick={() => removeFromBlacklist(user.username, user.platform)}
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



