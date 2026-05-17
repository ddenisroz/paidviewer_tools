import React, { useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { queryKeys } from '@/queries/queryKeys';
import {
    useAddFilteredWord,
    useBlockedUsers,
    useBlockUser,
    useDeleteFilteredWord,
    useFilteredWords,
    useUnblockUser,
} from '@/queries/tts/ttsQueries';
import { toast } from '@/utils/toastManager';

import { TtsBlacklistCard } from './TtsBlacklistCard';
import { TtsForbiddenWordsCard } from './TtsForbiddenWordsCard';

import type { BlockedUser, FilteredWord } from './ttsFilterTypes';
import type { AxiosError } from 'axios';

interface TtsFilterManagerProps {
    className?: string;
}

const getBlockedUsers = (data: unknown): BlockedUser[] => {
    if (Array.isArray(data)) return data as BlockedUser[];
    return (data as { data?: { blocked_users?: BlockedUser[] } } | undefined)?.data?.blocked_users ?? [];
};

const getFilteredWords = (data: unknown): FilteredWord[] => {
    const payload = data as { data?: { filtered_words?: unknown; words?: unknown } } | undefined;
    const raw = Array.isArray(data) ? data : (payload?.data?.filtered_words ?? payload?.data?.words ?? []);
    return (Array.isArray(raw) ? raw : []) as FilteredWord[];
};

const isNetworkError = (error: AxiosError): boolean =>
    error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED';

const TtsFilterManager: React.FC<TtsFilterManagerProps> = React.memo(({ className }) => {
    const { user } = useAuth();
    const { integrations } = useIntegrations();
    const queryClient = useQueryClient();

    const [newUsername, setNewUsername] = useState('');
    const [selectedUserPlatform, setSelectedUserPlatform] = useState<string>('twitch');
    const [pendingUnblockKey, setPendingUnblockKey] = useState<string | null>(null);
    const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
    const blacklistFormRef = useRef<HTMLDivElement | null>(null);

    const [newWord, setNewWord] = useState('');
    const [isWordsOpen, setIsWordsOpen] = useState(false);
    const forbiddenWordsFormRef = useRef<HTMLDivElement | null>(null);

    const { data: blockedUsersData, isLoading: loadingUsers } = useBlockedUsers({
        retry: false,
        refetchOnWindowFocus: false,
    });
    const { data: wordsData, isLoading: loadingWords } = useFilteredWords({
        retry: false,
        refetchOnWindowFocus: false,
    });

    const blockUserMutation = useBlockUser({
        onSuccess: (_response, variables) => {
            setNewUsername('');
            setIsBlacklistOpen(false);
            toast.success(
                `Пользователь ${variables.username} заглушен на ${variables.platform === 'twitch' ? 'Twitch' : 'VK Live'}`
            );
            queryClient.setQueryData(queryKeys.tts.blockedUsers(), (prev: unknown) => {
                const prevList = getBlockedUsers(prev);
                const exists = prevList.some(
                    (item) =>
                        item.username.toLowerCase() === variables.username.toLowerCase() &&
                        item.platform === variables.platform
                );
                if (exists) return prev;
                const nextItem: BlockedUser = {
                    username: variables.username,
                    platform: variables.platform,
                    channel_name: variables.channel_name,
                };
                return Array.isArray(prev)
                    ? [nextItem, ...prevList]
                    : { data: { blocked_users: [nextItem, ...prevList] } };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
        },
        onError: (error: AxiosError) => {
            if (!isNetworkError(error)) return;
        },
    });

    const unblockUserMutation = useUnblockUser({
        onSuccess: (_response, variables) => {
            toast.success(`Пользователь ${variables.username} разблокирован`);
            setPendingUnblockKey(null);
            queryClient.setQueryData(queryKeys.tts.blockedUsers(), (prev: unknown) => {
                const nextList = getBlockedUsers(prev).filter(
                    (item) => !(item.username === variables.username && item.platform === variables.platform)
                );
                return Array.isArray(prev) ? nextList : { data: { blocked_users: nextList } };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.blockedUsers() });
        },
        onError: (error: AxiosError) => {
            if (!isNetworkError(error)) return;
        },
    });

    const addWordMutation = useAddFilteredWord({
        onSuccess: () => {
            setNewWord('');
            setIsWordsOpen(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() });
        },
        onError: (error: AxiosError) => {
            if (!isNetworkError(error)) return;
        },
    });

    const deleteWordMutation = useDeleteFilteredWord({
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tts.filteredWords() }),
        onError: (error: AxiosError) => {
            if (!isNetworkError(error)) return;
        },
    });

    const blacklist = getBlockedUsers(blockedUsersData);
    const words = getFilteredWords(wordsData);
    const availablePlatforms = [
        ...(integrations?.twitch?.enabled ? ['twitch'] : []),
        ...(integrations?.vk?.enabled ? ['vk'] : []),
    ];

    const getChannelName = (platform: string): string => {
        if (platform === 'twitch') return user?.twitch_username || '';
        if (platform === 'vk') return user?.vk_username || user?.vk_channel_name || '';
        return '';
    };

    const addToBlacklist = () => {
        const username = newUsername.trim();
        if (!username || !selectedUserPlatform) return;
        const channelName = getChannelName(selectedUserPlatform);
        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${selectedUserPlatform}`);
            return;
        }
        blockUserMutation.mutate({
            channel_name: channelName,
            platform: selectedUserPlatform as 'youtube' | 'twitch' | 'vk',
            username,
        });
    };

    const removeFromBlacklist = (blockedUser: BlockedUser) => {
        const channelName = blockedUser.channel_name || getChannelName(blockedUser.platform);
        if (!channelName) {
            toast.error(`Не удалось получить имя канала для платформы ${blockedUser.platform}`);
            return;
        }
        unblockUserMutation.mutate({
            channel_name: channelName,
            platform: blockedUser.platform as 'youtube' | 'twitch' | 'vk',
            username: blockedUser.username,
        });
    };

    const addWord = () => {
        const word = newWord.trim();
        if (word) addWordMutation.mutate({ word });
    };

    return (
        <div
            className={`grid grid-cols-1 items-start gap-3 lg:grid-cols-2 ${className || ''}`}
            data-testid="tts-filter-card"
        >
            <TtsBlacklistCard
                blacklist={blacklist}
                isLoading={loadingUsers}
                isOpen={isBlacklistOpen}
                pendingUnblockKey={pendingUnblockKey}
                newUsername={newUsername}
                selectedPlatform={selectedUserPlatform}
                availablePlatforms={availablePlatforms}
                addingUser={blockUserMutation.isPending}
                formRef={blacklistFormRef}
                onOpenChange={setIsBlacklistOpen}
                onPendingUnblockKeyChange={setPendingUnblockKey}
                onUsernameChange={setNewUsername}
                onPlatformChange={setSelectedUserPlatform}
                onAdd={addToBlacklist}
                onRemove={removeFromBlacklist}
            />
            <TtsForbiddenWordsCard
                words={words}
                isLoading={loadingWords}
                isOpen={isWordsOpen}
                newWord={newWord}
                addingWord={addWordMutation.isPending}
                formRef={forbiddenWordsFormRef}
                onOpenChange={setIsWordsOpen}
                onWordChange={setNewWord}
                onAdd={addWord}
                onRemove={(wordId) => deleteWordMutation.mutate(wordId)}
            />
        </div>
    );
});

TtsFilterManager.displayName = 'TtsFilterManager';

export default TtsFilterManager;
