// src/components/tts/TtsFilterManager.tsx
import React, { useCallback, useState } from 'react';

import { AlertCircle, ChevronDown, Plus, UserX, X } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { useAddFilteredWord, useBlockedUsers, useBlockUser, useDeleteFilteredWord, useFilteredWords, useUnblockUser } from '../../../queries/tts/ttsQueries';

import type { AxiosError } from 'axios';

interface BlockedUser {
    id?: number;
    username: string;
    platform: string;
    channel_name?: string;
}

interface FilteredWord {
    id: number;
    word?: string;
    text?: string;
    platform: string;
}

const TtsFilterManager: React.FC = React.memo(() => {
    // Общие состояния
    const [isExpanded, setIsExpanded] = useState(false);
    const { integrations } = useIntegrations();
    const { user } = useAuth();

    // Состояния для черного списка
    const [newUsername, setNewUsername] = useState('');
    const [selectedUserPlatform, setSelectedUserPlatform] = useState<string>('twitch');

    // Состояния для словаря фильтра
    const [newWord, setNewWord] = useState('');
    const [selectedWordPlatform, setSelectedWordPlatform] = useState<string>('all');

    // Функция переключения спойлера
    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    // React Query hooks для черного списка
    const { data: blockedUsersData, isLoading: loadingUsers } = useBlockedUsers({
        retry: false,
        refetchOnWindowFocus: false,
    });

    const blockUserMutation = useBlockUser({
        onSuccess: (response, variables) => {
            setNewUsername('');
            const platformName = variables.platform === 'twitch' ? 'Twitch' : 'VK Live';
            toast.success(`Пользователь ${variables.username} заглушен на ${platformName}`);
        },
        onError: (error: unknown) => {
            const err = error as AxiosError;
            if (err.code !== 'ERR_NETWORK' && err.code !== 'ERR_CONNECTION_REFUSED') {
                // Ошибка уже обработана в hook
            }
        },
    });

    const unblockUserMutation = useUnblockUser({
        onSuccess: (response, variables) => {
            toast.success(`Пользователь ${variables.username} разблокирован`);
        },
        onError: (error: AxiosError) => {
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                // Ошибка уже обработана в hook
            }
        },
    });

    // React Query hooks для словаря фильтра
    const { data: wordsData, isLoading: loadingWords } = useFilteredWords({
        retry: false,
        refetchOnWindowFocus: false,
    });

    const addWordMutation = useAddFilteredWord({
        onSuccess: () => {
            setNewWord('');
        },
        onError: (error: AxiosError) => {
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                // Ошибка уже обработана в hook
            }
        },
    });

    const deleteWordMutation = useDeleteFilteredWord({
        onError: (error: AxiosError) => {
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                // Ошибка уже обработана в hook
            }
        },
    });

    const blacklist: BlockedUser[] = Array.isArray(blockedUsersData)
        ? blockedUsersData
        : ((blockedUsersData as { data?: { blocked_users?: BlockedUser[] } } | undefined)?.data?.blocked_users ?? []);

    const wordsRaw = Array.isArray(wordsData)
        ? wordsData
        : ((wordsData as { data?: { filtered_words?: unknown; words?: unknown } } | undefined)?.data?.filtered_words
            ?? (wordsData as { data?: { filtered_words?: unknown; words?: unknown } } | undefined)?.data?.words
            ?? []);
    const words: FilteredWord[] = (Array.isArray(wordsRaw) ? wordsRaw : []) as FilteredWord[];
    const addingUser = blockUserMutation.isPending;
    const addingWord = addWordMutation.isPending;

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

    // Получаем иконку для платформы
    const getPlatformIcon = (platform: string): string => {
        if (platform === 'twitch') return '[TW]';
        if (platform === 'vk') return '[VK]';
        if (platform === 'all') return '[WEB]';
        return '';
    };

    // Получение цвета для платформы
    const getPlatformColor = (platform: string): string => {
        switch (platform) {
            case 'twitch': return 'bg-purple-600';
            case 'vk': return 'bg-blue-600';
            case 'all': return 'bg-gray-600';
            default: return 'bg-gray-600';
        }
    };

    // Получение лейбла для платформы
    const getPlatformLabel = (platform: string): string => {
        switch (platform) {
            case 'twitch': return 'Twitch';
            case 'vk': return 'VK Live';
            case 'all': return 'Все';
            default: return 'Неизвестно';
        }
    };

    // ========== ЧЕРНЫЙ СПИСОК ==========

    // Добавление пользователя в черный список
    const addToBlacklist = () => {
        if (!newUsername.trim()) {
            return;
        }

        if (!selectedUserPlatform) {
            return;
        }

        const channelName = getChannelName(selectedUserPlatform);

        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${selectedUserPlatform}`);
            return;
        }

        blockUserMutation.mutate({
            channel_name: channelName,
            platform: selectedUserPlatform as 'youtube' | 'twitch' | 'vk',
            username: newUsername.trim()
        });
    };

    // Удаление пользователя из черного списка
    const removeFromBlacklist = (blockedUser: BlockedUser) => {
        if (!window.confirm(`Разблокировать пользователя ${blockedUser.username}?`)) {
            return;
        }

        const channelName = blockedUser.channel_name || getChannelName(blockedUser.platform);
        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${blockedUser.platform}`);
            return;
        }

        unblockUserMutation.mutate({
            channel_name: channelName,
            platform: blockedUser.platform as 'youtube' | 'twitch' | 'vk',
            username: blockedUser.username
        });
    };

    // ========== СЛОВАРЬ ФИЛЬТРА ==========

    // Добавление слова
    const addWord = () => {
        if (!newWord.trim()) {
            return;
        }

        addWordMutation.mutate({
            word: newWord.trim()
        });
    };

    // Удаление слова
    const removeWord = (wordId: number) => {
        deleteWordMutation.mutate(wordId);
    };

    const availablePlatforms = getAvailablePlatforms();

    return (
        <Card className="border-gray-700 bg-gray-900/30" data-testid="tts-filter-card">
            <CardHeader
                className="cursor-pointer hover:bg-gray-800/20 transition-colors"
                onClick={toggleExpanded}
                data-testid="tts-filter-header"
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-white">
                        Фильтры и заблокированные
                    </CardTitle>
                    <ChevronDown
                        className={`h-5 w-5 transition-transform duration-300 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="space-y-6 pt-4">
                    <Tabs defaultValue="blacklist" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                            <TabsTrigger value="blacklist" className="data-[state=active]:bg-gray-700">
                                <UserX className="w-4 h-4 mr-2" />
                                Черный список
                            </TabsTrigger>
                            <TabsTrigger value="words" className="data-[state=active]:bg-gray-700">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Запрещенные слова
                            </TabsTrigger>
                        </TabsList>

                        {/* ========== ВКЛАДКА: ЧЕРНЫЙ СПИСОК ========== */}
                        <TabsContent value="blacklist" className="space-y-4">
                            {/* Форма добавления пользователя */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        placeholder="Введите имя пользователя"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                                        disabled={addingUser || availablePlatforms.length === 0}
                                        className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                                    />
                                    {availablePlatforms.length > 0 && (
                                        <Select value={selectedUserPlatform} onValueChange={setSelectedUserPlatform}>
                                            <SelectTrigger className="w-full sm:w-36 bg-gray-800/50 border-gray-700/50 text-white">
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
                                        disabled={addingUser || !newUsername.trim() || !selectedUserPlatform}
                                        className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {addingUser ? 'Добавление...' : 'Заглушить'}
                                    </Button>
                                </div>

                                {availablePlatforms.length === 0 && (
                                    <p className="text-sm text-gray-400">
                                        Подключите хотя бы одну платформу (Twitch или VK Live) чтобы заглушать пользователей
                                    </p>
                                )}
                            </div>

                            {/* Список заглушенных пользователей */}
                            <div className="space-y-4">
                                <Label>Заглушенные пользователи ({blacklist.length})</Label>
                                {loadingUsers ? (
                                    <div className="text-center py-4 text-gray-400">Загрузка...</div>
                                ) : blacklist.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400">Список пуст</div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {blacklist.map((blockedUser, index) => (
                                            <div
                                                key={`${blockedUser.username}-${blockedUser.platform}-${index}`}
                                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium">{blockedUser.username}</span>
                                                    <Badge className={`${getPlatformColor(blockedUser.platform)} text-white`}>
                                                        {getPlatformLabel(blockedUser.platform)}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFromBlacklist(blockedUser)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ========== ВКЛАДКА: ЗАПРЕЩЕННЫЕ СЛОВА ========== */}
                        <TabsContent value="words" className="space-y-4">
                            {/* Форма добавления слова */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        placeholder="Введите слово для фильтрации..."
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addWord()}
                                        disabled={addingWord}
                                        className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                                    />
                                    {availablePlatforms.length > 0 && (
                                        <Select value={selectedWordPlatform} onValueChange={setSelectedWordPlatform}>
                                            <SelectTrigger className="w-full sm:w-44 bg-gray-800/50 border-gray-700/50 text-white">
                                                <SelectValue placeholder="Платформа" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                                <SelectItem value="all">{getPlatformIcon('all')} Все платформы</SelectItem>
                                                {availablePlatforms.map(platform => (
                                                    <SelectItem key={platform} value={platform}>
                                                        {getPlatformIcon(platform)} {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Button
                                        onClick={addWord}
                                        disabled={addingWord || !newWord.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {addingWord ? 'Добавление...' : 'Добавить'}
                                    </Button>
                                </div>

                                {availablePlatforms.length === 0 && (
                                    <p className="text-sm text-gray-400">
                                        Подключите хотя бы одну платформу (Twitch или VK Live) чтобы фильтровать слова
                                    </p>
                                )}
                            </div>

                            {/* Список запрещенных слов */}
                            <div className="space-y-4">
                                <Label>Заблокированные слова ({Array.isArray(words) ? words.length : 0})</Label>
                                {loadingWords ? (
                                    <div className="text-center py-4 text-gray-400">Загрузка...</div>
                                ) : !Array.isArray(words) || words.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400">Слова не добавлены</div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {words.filter(word => word && (word.word || word.text)).map((word) => (
                                            <div
                                                key={word.id}
                                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium">{word.word || word.text || 'Unknown'}</span>
                                                    <Badge className={`${getPlatformColor(word.platform || 'all')} text-white`}>
                                                        {getPlatformLabel(word.platform || 'all')}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeWord(word.id)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            )}
        </Card>
    );
});

TtsFilterManager.displayName = 'TtsFilterManager';

export default TtsFilterManager;



