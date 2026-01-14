// src/components/tts/TtsFilterManager.tsx
import React, { useState } from 'react';

import { AlertCircle, Plus, UserX, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { useAddFilteredWord, useBlockedUsers, useBlockUser, useDeleteFilteredWord, useFilteredWords, useUnblockUser } from '../../../queries/tts/ttsQueries';
import { queryKeys } from '../../../queries/queryKeys';
import { TwitchIcon, VKIcon } from '../../../shared/components/PlatformIcons';
import { useQueryClient } from '@tanstack/react-query';

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

interface TtsFilterManagerProps {
    className?: string;
}

const TtsFilterManager: React.FC<TtsFilterManagerProps> = React.memo(({ className }) => {
    const { user } = useAuth();
    const { integrations } = useIntegrations();
    const queryClient = useQueryClient();

    // Состояния для черного списка
    const [newUsername, setNewUsername] = useState('');
    const [selectedUserPlatform, setSelectedUserPlatform] = useState<string>('twitch');

    // Состояния для словаря фильтра
    const [newWord, setNewWord] = useState('');
    const [selectedWordPlatform, setSelectedWordPlatform] = useState<string>('all');

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
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
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
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
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
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
        },
        onError: (error: AxiosError) => {
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                // Ошибка уже обработана в hook
            }
        },
    });

    const deleteWordMutation = useDeleteFilteredWord({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
        },
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
            case 'vk': return 'bg-rose-600';
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
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${className || ''}`} data-testid="tts-filter-card">
            {/* ========== ЧЕРНЫЙ СПИСОК ========== */}
            <div className="border border-gray-700/50 bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/5 border-b border-gray-700/30">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <UserX className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Черный список</h3>
                    {blacklist.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded-full">
                            {blacklist.length}
                        </span>
                    )}
                </div>

                <div className="p-4">
                    {/* Форма добавления */}
                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="Имя пользователя"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                            disabled={addingUser || availablePlatforms.length === 0}
                            className="flex-1 bg-gray-800/60 border-gray-700/50 text-white placeholder-gray-500 h-9 text-sm focus:border-red-500/50 focus:ring-red-500/20"
                        />
                        {availablePlatforms.length > 0 && (
                            <Select value={selectedUserPlatform} onValueChange={setSelectedUserPlatform}>
                                <SelectTrigger className="w-[100px] bg-gray-800/60 border-gray-700/50 text-white h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    {availablePlatforms.map(platform => (
                                        <SelectItem key={platform} value={platform}>
                                            <div className="flex items-center gap-1.5">
                                                {platform === 'twitch' ? <TwitchIcon className="w-3.5 h-3.5 text-purple-400" /> : <VKIcon className="w-3.5 h-3.5 text-blue-400" />}
                                                <span className="text-xs">{platform === 'twitch' ? 'Twitch' : 'VK'}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button
                            onClick={addToBlacklist}
                            disabled={addingUser || !newUsername.trim() || !selectedUserPlatform}
                            size="sm"
                            className="h-9 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-medium shadow-lg shadow-red-600/20 transition-all duration-200 hover:shadow-red-500/30"
                        >
                            {addingUser ? '...' : <><Plus className="h-3.5 w-3.5 mr-1" />Бан</>}
                        </Button>
                    </div>

                    {/* Список */}
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {loadingUsers ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <div className="w-5 h-5 border-2 border-gray-600 border-t-red-400 rounded-full animate-spin mb-2" />
                                <span className="text-xs">Загрузка...</span>
                            </div>
                        ) : blacklist.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <UserX className="w-8 h-8 mb-2 opacity-30" />
                                <span className="text-xs">Нет заблокированных</span>
                            </div>
                        ) : (
                            blacklist.map((blockedUser, index) => (
                                <div
                                    key={`${blockedUser.username}-${blockedUser.platform}-${index}`}
                                    className="group flex items-center justify-between py-2 px-3 bg-gray-800/40 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${blockedUser.platform === 'twitch' ? 'bg-purple-500/20' : 'bg-rose-500/20'}`}>
                                            {blockedUser.platform === 'twitch' ? <TwitchIcon className="w-3 h-3 text-purple-400" /> : <VKIcon className="w-3 h-3 text-rose-400" />}
                                        </div>
                                        <span className="text-sm text-gray-200 truncate font-medium">{blockedUser.username}</span>
                                    </div>
                                    <button
                                        onClick={() => removeFromBlacklist(blockedUser)}
                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-red-500/10 rounded"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {availablePlatforms.length === 0 && (
                    <div className="px-4 pb-3 text-xs text-gray-400">Подключите платформу</div>
                )}
            </div>

            {/* ========== ЗАПРЕЩЕННЫЕ СЛОВА ========== */}
            <div className="border border-gray-700/50 bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/5 border-b border-gray-700/30">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Запрещенные слова</h3>
                    {Array.isArray(words) && words.length > 0 && (
                        <span className="ml-auto text-xs font-medium text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                            {words.length}
                        </span>
                    )}
                </div>

                <div className="p-4">
                    {/* Форма добавления */}
                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="Слово или фраза"
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addWord()}
                            disabled={addingWord}
                            className="flex-1 bg-gray-800/60 border-gray-700/50 text-white placeholder-gray-500 h-9 text-sm focus:border-yellow-500/50 focus:ring-yellow-500/20"
                        />
                        <Button
                            onClick={addWord}
                            disabled={addingWord || !newWord.trim()}
                            size="sm"
                            className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg shadow-blue-600/20 transition-all duration-200 hover:shadow-blue-500/30"
                        >
                            {addingWord ? '...' : <><Plus className="h-3.5 w-3.5 mr-1" />Добавить</>}
                        </Button>
                    </div>

                    {/* Список слов - тегами */}
                    <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto custom-scrollbar content-start">
                        {loadingWords ? (
                            <div className="w-full flex flex-col items-center justify-center py-8 text-gray-500">
                                <div className="w-5 h-5 border-2 border-gray-600 border-t-yellow-400 rounded-full animate-spin mb-2" />
                                <span className="text-xs">Загрузка...</span>
                            </div>
                        ) : !Array.isArray(words) || words.length === 0 ? (
                            <div className="w-full flex flex-col items-center justify-center py-8 text-gray-500">
                                <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
                                <span className="text-xs">Нет запрещенных слов</span>
                            </div>
                        ) : (
                            words.filter(word => word && (word.word || word.text)).map((word) => (
                                <div
                                    key={word.id}
                                    className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800/70 hover:bg-yellow-500/10 border border-gray-700/50 hover:border-yellow-500/30 rounded-lg text-xs text-gray-200 transition-all duration-200"
                                >
                                    <span className="max-w-[100px] truncate">{word.word || word.text}</span>
                                    <button
                                        onClick={() => removeWord(word.id)}
                                        className="text-gray-600 hover:text-red-400 transition-colors p-0.5 hover:bg-red-500/10 rounded"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

TtsFilterManager.displayName = 'TtsFilterManager';

export default TtsFilterManager;



