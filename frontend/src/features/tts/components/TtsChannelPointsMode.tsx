import React, { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { usePlatformRewards } from '../../../queries/points/pointsQueries';
import { queryKeys } from '../../../queries/queryKeys';
import {
    useAttachTtsReward,
    useCreateTtsReward,
    useDeleteTtsReward,
    useTtsModeSettings,
} from '../../../queries/tts/ttsQueries';
import { TwitchIcon, VKIcon } from '../../../shared/components/PlatformIcons';
import type { ApiResponse, PlatformReward } from '../../../types';
import { logger } from '../../../utils/prodLogger';

interface TtsChannelPointsModeProps {
    ttsMode: string;
    onModeChange: (mode: 'all_messages' | 'channel_points') => void;
    isSaving: boolean;
    showModeSelector?: boolean;
    showRewards?: boolean;
}

interface RewardForm {
    title: string;
    cost: number;
    cooldown: number;
}

type RewardPlatformKey = 'twitch' | 'vk';
type RewardSetupMode = 'create' | 'attach';
type PlatformRewardsResponse = ApiResponse<unknown> & {
    rewards?: PlatformReward[];
    data?: PlatformReward[] | { rewards?: PlatformReward[] };
};
type TtsModeSettingsPayload = {
    tts_reward_ids?: Record<string, string>;
    platforms?: Record<string, { reward_configured?: boolean }>;
};

interface RewardPlatformOption {
    key: RewardPlatformKey;
    label: string;
    accentClassName: string;
    Icon: typeof TwitchIcon;
}

interface RewardPlatformRowProps {
    platform: RewardPlatformOption;
    rewardId?: string;
    isLoadingRewards: boolean;
    onCreate: (platform: RewardPlatformKey) => void;
    onDelete: (platform: RewardPlatformKey) => void;
}

const REWARD_PLATFORMS: RewardPlatformOption[] = [
    { key: 'twitch', label: 'Twitch', accentClassName: 'text-purple-400', Icon: TwitchIcon },
    { key: 'vk', label: 'VK Live', accentClassName: 'text-[#FF4444]', Icon: VKIcon },
];

const getRewardTitle = (reward: PlatformReward): string => {
    return String(reward.title || reward.name || reward.id || '').trim();
};

const getRewardsFromResponse = (response?: PlatformRewardsResponse): PlatformReward[] => {
    if (!response) return [];
    if (Array.isArray(response.rewards)) return response.rewards;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && typeof response.data === 'object' && Array.isArray(response.data.rewards)) {
        return response.data.rewards;
    }
    return [];
};

const isRewardInputRequired = (reward: PlatformReward): boolean => reward.is_user_input_required === true;

const RewardPlatformRow: React.FC<RewardPlatformRowProps> = ({
    platform,
    rewardId,
    isLoadingRewards,
    onCreate,
    onDelete,
}) => (
    <Card className="border-border/70 bg-background/30">
        <CardContent className="flex h-10 items-center justify-between px-3 py-0">
            <div className="flex items-center gap-3">
                <platform.Icon className={`w-5 h-5 ${platform.accentClassName}`} />
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white">{platform.label}</span>
                    {isLoadingRewards ? (
                        <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                    ) : rewardId ? (
                        <span className="text-[10px] bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20 font-medium whitespace-nowrap">
                            ВКЛ
                        </span>
                    ) : (
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 font-medium whitespace-nowrap">
                            ВЫКЛ
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center">
                {isLoadingRewards ? (
                    <Button variant="ghost" size="sm" disabled className="h-7 text-xs opacity-50">
                        <Loader2 className="w-3 h-3 animate-spin" />
                    </Button>
                ) : rewardId ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(platform.key)}
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 ml-2"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCreate(platform.key)}
                        className="h-7 text-xs border-sky-600/50 text-sky-300 hover:bg-sky-600/10 hover:text-sky-200"
                    >
                        {platform.key === 'twitch' ? 'Настроить' : 'Создать'}
                    </Button>
                )}
            </div>
        </CardContent>
    </Card>
);

/**
 * Компонент для управления режимом TTS (все сообщения / за баллы канала)
 */
const TtsChannelPointsMode: React.FC<TtsChannelPointsModeProps> = ({
    ttsMode,
    onModeChange,
    isSaving,
    showModeSelector = true,
    showRewards = true,
}) => {
    const { user } = useAuth();
    const { integrations, platformCapabilities } = useIntegrations();
    const queryClient = useQueryClient();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<RewardPlatformKey | null>(null);
    const [rewardSetupMode, setRewardSetupMode] = useState<RewardSetupMode>('create');
    const [attachSearch, setAttachSearch] = useState('');
    const [selectedAttachRewardId, setSelectedAttachRewardId] = useState<string | null>(null);
    const [platformToDelete, setPlatformToDelete] = useState<RewardPlatformKey | null>(null);
    const [saving, setSaving] = useState(false);

    // Форма создания награды
    const [rewardForm, setRewardForm] = useState<RewardForm>({
        title: '',
        cost: 500,
        cooldown: 0,
    });

    // [OK] НОВЫЙ КОД: Используем централизованный hook для режима TTS
    const {
        data: modeSettingsResponse,
        isLoading: isLoadingRewards,
        refetch: refetchModeSettings,
    } = useTtsModeSettings({
        enabled: !!user && ttsMode === 'channel_points' && showRewards,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 60 * 1000,
        retry: false,
    });
    const rawModeSettings = modeSettingsResponse as
        | (ApiResponse<TtsModeSettingsPayload> & TtsModeSettingsPayload)
        | undefined;
    const modeSettingsData =
        rawModeSettings?.data && !Array.isArray(rawModeSettings.data) ? rawModeSettings.data : rawModeSettings;

    const ttsRewardIds = modeSettingsData?.tts_reward_ids || {};
    const { data: twitchRewardsResponse, isLoading: isLoadingAttachRewards } = usePlatformRewards('twitch', {
        enabled: showCreateDialog && selectedPlatform === 'twitch' && rewardSetupMode === 'attach',
    });
    const twitchRewards = React.useMemo(
        () => getRewardsFromResponse(twitchRewardsResponse as PlatformRewardsResponse | undefined),
        [twitchRewardsResponse]
    );
    const attachRewards = React.useMemo(() => {
        const search = attachSearch.trim().toLowerCase();
        const scoredRewards = twitchRewards
            .map((reward) => {
                const title = getRewardTitle(reward);
                const name = String(reward.name || '').trim();
                const haystack = `${title} ${name}`.trim().toLowerCase();
                const isExact = Boolean(search && [title, name].some((value) => value.toLowerCase() === search));
                return { reward, title, haystack, isExact };
            })
            .filter(({ haystack }) => !search || haystack.includes(search));

        return scoredRewards
            .sort((left, right) => {
                if (left.isExact !== right.isExact) return left.isExact ? -1 : 1;
                return left.title.localeCompare(right.title, 'ru');
            })
            .map(({ reward }) => reward);
    }, [attachSearch, twitchRewards]);

    // Открыть диалог создания награды
    const openCreateDialog = (platform: RewardPlatformKey) => {
        setSelectedPlatform(platform);
        setRewardSetupMode('create');
        setAttachSearch('');
        setSelectedAttachRewardId(null);
        setRewardForm({
            title: `TTS Озвучка сообщения`,
            cost: 500,
            cooldown: 0,
        });
        setShowCreateDialog(true);
    };

    // [OK] НОВЫЙ КОД: Используем централизованный hook для создания награды
    const createTtsRewardMutation = useCreateTtsReward({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            refetchModeSettings();
            setShowCreateDialog(false);
            // toast уже показан в hook
        },
        onError: (error) => {
            logger.error('Error creating TTS reward:', error);
            // Откатываем оптимистичное обновление при ошибке
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            const errorData = error.response?.data as Record<string, unknown> | undefined;
            const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка создания награды') as string;
            toast.error(errorMessage);
        },
    });

    // Создать награду TTS
    const handleCreateReward = () => {
        if (!rewardForm.title.trim()) {
            toast.error('Введите название награды');
            return;
        }

        if (createTtsRewardMutation.isPending || !selectedPlatform) return;
        setSaving(true);

        createTtsRewardMutation.mutate(
            {
                platform: selectedPlatform,
                title: rewardForm.title,
                cost: rewardForm.cost,
                cooldown: rewardForm.cooldown,
            },
            {
                onSettled: () => {
                    setSaving(false);
                },
            }
        );
    };

    const attachTtsRewardMutation = useAttachTtsReward({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            refetchModeSettings();
            setShowCreateDialog(false);
            setSelectedAttachRewardId(null);
        },
        onError: (error) => {
            logger.error('Error attaching TTS reward:', error);
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            const errorData = error.response?.data as Record<string, unknown> | undefined;
            const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка привязки награды') as string;
            toast.error(errorMessage);
        },
    });

    const handleSelectAttachReward = (reward: PlatformReward) => {
        if (!isRewardInputRequired(reward)) {
            toast.error('Для TTS нужна награда с обязательным вводом сообщения');
            return;
        }
        setSelectedAttachRewardId(String(reward.id));
    };

    const handleAttachReward = () => {
        if (!selectedAttachRewardId) {
            toast.error('Выберите награду для привязки');
            return;
        }

        const selectedReward = twitchRewards.find((reward) => String(reward.id) === selectedAttachRewardId);
        if (!selectedReward) {
            toast.error('Награда не найдена в списке Twitch');
            return;
        }
        if (!isRewardInputRequired(selectedReward)) {
            toast.error('Для TTS нужна награда с обязательным вводом сообщения');
            return;
        }

        setSaving(true);
        attachTtsRewardMutation.mutate(
            { platform: 'twitch', reward_id: selectedAttachRewardId },
            {
                onSettled: () => {
                    setSaving(false);
                },
            }
        );
    };

    // [OK] НОВЫЙ КОД: Используем централизованный hook для удаления награды
    const deleteTtsRewardMutation = useDeleteTtsReward({
        onSuccess: () => {
            // Принудительно обновляем данные с сервера
            refetchModeSettings();
            // toast уже показан в hook
        },
        onError: (error) => {
            logger.error('Error deleting TTS reward:', error);
            // Откатываем оптимистичное обновление при ошибке
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            const errorData = error.response?.data as Record<string, unknown> | undefined;
            const errorMessage = (errorData?.detail || errorData?.message || 'Ошибка отвязки награды') as string;
            toast.error(errorMessage);
        },
    });

    // Удалить награду TTS
    const handleDeleteReward = (platform: RewardPlatformKey) => {
        setPlatformToDelete(platform);
    };

    const confirmDeleteReward = (): void => {
        if (!platformToDelete) return;
        if (deleteTtsRewardMutation.isPending) return;

        // Оптимистичное обновление - сразу удаляем reward_id из кэша
        if (modeSettingsData) {
            queryClient.setQueryData(queryKeys.tts.modeSettings(), (oldData: unknown) => {
                if (!oldData) return oldData;
                const typedOldData = oldData as ApiResponse<TtsModeSettingsPayload> & TtsModeSettingsPayload;
                const payload =
                    typedOldData.data && !Array.isArray(typedOldData.data) ? typedOldData.data : typedOldData;
                const oldRewardIds = { ...(payload.tts_reward_ids || {}) };
                delete oldRewardIds[platformToDelete];

                if (typedOldData.data && !Array.isArray(typedOldData.data)) {
                    return {
                        ...typedOldData,
                        data: {
                            ...typedOldData.data,
                            tts_reward_ids: oldRewardIds,
                        },
                    };
                }

                return {
                    ...typedOldData,
                    tts_reward_ids: oldRewardIds,
                };
            });
        }

        deleteTtsRewardMutation.mutate(platformToDelete);
        setPlatformToDelete(null);
    };

    const connectedPlatforms = React.useMemo(
        () => REWARD_PLATFORMS.filter(({ key }) => integrations?.[key]?.enabled && platformCapabilities[key].rewards),
        [integrations, platformCapabilities]
    );
    const hasRewardPlatforms = connectedPlatforms.length > 0;

    return (
        <div className="space-y-2">
            {/* Выбор режима - показываем только если showModeSelector=true */}
            {showModeSelector && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onModeChange('all_messages')}
                        disabled={isSaving}
                        className={`flex h-10 items-center rounded-lg border px-3 text-left text-sm font-bold transition-colors ${
                            ttsMode === 'all_messages'
                                ? 'border-sky-500/50 bg-sky-500/10 text-sky-50'
                                : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                    >
                        Все сообщения
                    </button>

                    <button
                        onClick={() => onModeChange('channel_points')}
                        disabled={isSaving || !hasRewardPlatforms}
                        className={`flex h-10 items-center rounded-lg border px-3 text-left text-sm font-bold transition-colors ${
                            !hasRewardPlatforms
                                ? 'cursor-not-allowed border-border/60 bg-background/20 text-muted-foreground/70 opacity-40'
                                : ttsMode === 'channel_points'
                                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-50'
                                  : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                    >
                        За баллы канала
                    </button>
                </div>
            )}

            {/* Настройка наград */}
            {ttsMode === 'channel_points' && showRewards && (
                <div className={showModeSelector ? 'border-t border-border/40 pt-2' : 'py-0'}>
                    <div className="space-y-2">
                        {connectedPlatforms.map((platform) => (
                            <RewardPlatformRow
                                key={platform.key}
                                platform={platform}
                                rewardId={ttsRewardIds[platform.key]}
                                isLoadingRewards={isLoadingRewards}
                                onCreate={openCreateDialog}
                                onDelete={handleDeleteReward}
                            />
                        ))}

                        {connectedPlatforms.length === 0 && (
                            <div className="text-sm text-gray-400 p-4 border rounded-lg bg-gray-800/30 border-gray-700">
                                Подключите хотя бы одну платформу (Twitch или VK Live)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Диалог настройки награды */}
            <Dialog
                open={showCreateDialog}
                onOpenChange={(open) => {
                    setShowCreateDialog(open);
                    if (!open) {
                        setAttachSearch('');
                        setSelectedAttachRewardId(null);
                        setRewardSetupMode('create');
                    }
                }}
            >
                <DialogContent className="bg-gray-900 border-gray-700 sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            TTS награда для {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {selectedPlatform === 'twitch' ? (
                            <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-700 bg-gray-950/40 p-1">
                                <Button
                                    type="button"
                                    variant={rewardSetupMode === 'create' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setRewardSetupMode('create')}
                                    className={
                                        rewardSetupMode === 'create'
                                            ? 'h-8 bg-sky-600 text-white hover:bg-sky-500'
                                            : 'h-8 text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }
                                >
                                    Создать
                                </Button>
                                <Button
                                    type="button"
                                    variant={rewardSetupMode === 'attach' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => {
                                        setRewardSetupMode('attach');
                                        setSelectedAttachRewardId(null);
                                    }}
                                    className={
                                        rewardSetupMode === 'attach'
                                            ? 'h-8 bg-sky-600 text-white hover:bg-sky-500'
                                            : 'h-8 text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }
                                >
                                    Привязать
                                </Button>
                            </div>
                        ) : null}

                        {rewardSetupMode === 'create' || selectedPlatform !== 'twitch' ? (
                            <>
                                <div>
                                    <Label htmlFor="title" className="text-gray-300">
                                        Название
                                    </Label>
                                    <Input
                                        id="title"
                                        value={rewardForm.title}
                                        onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                                        placeholder="Озвучить моё сообщение"
                                        className="bg-gray-800 border-gray-700 text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="cost" className="text-gray-300">
                                            Цена (баллы)
                                        </Label>
                                        <Input
                                            id="cost"
                                            type="number"
                                            min="1"
                                            value={rewardForm.cost}
                                            onChange={(e) =>
                                                setRewardForm({ ...rewardForm, cost: parseInt(e.target.value) || 0 })
                                            }
                                            placeholder="500"
                                            className="bg-gray-800 border-gray-700 text-white"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="cooldown" className="text-gray-300">
                                            Кулдаун (сек)
                                        </Label>
                                        <Input
                                            id="cooldown"
                                            type="number"
                                            min="0"
                                            value={rewardForm.cooldown}
                                            onChange={(e) =>
                                                setRewardForm({
                                                    ...rewardForm,
                                                    cooldown: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="0"
                                            className="bg-gray-800 border-gray-700 text-white"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <Label htmlFor="reward-search" className="text-gray-300">
                                        Поиск награды
                                    </Label>
                                    <Input
                                        id="reward-search"
                                        value={attachSearch}
                                        onChange={(event) => setAttachSearch(event.target.value)}
                                        placeholder="Название существующей награды"
                                        className="bg-gray-800 border-gray-700 text-white"
                                    />
                                </div>

                                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950/30 p-2">
                                    {isLoadingAttachRewards ? (
                                        <div className="flex h-24 items-center justify-center text-sm text-gray-400">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Загрузка наград
                                        </div>
                                    ) : attachRewards.length > 0 ? (
                                        attachRewards.map((reward) => {
                                            const rewardId = String(reward.id);
                                            const title = getRewardTitle(reward);
                                            const canAttach = isRewardInputRequired(reward);
                                            const selected = selectedAttachRewardId === rewardId;

                                            return (
                                                <button
                                                    type="button"
                                                    key={rewardId}
                                                    aria-disabled={!canAttach}
                                                    onClick={() => handleSelectAttachReward(reward)}
                                                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                                        selected
                                                            ? 'border-sky-500 bg-sky-500/10'
                                                            : canAttach
                                                              ? 'border-gray-700 bg-gray-900/70 hover:border-sky-500/60 hover:bg-sky-500/10'
                                                              : 'border-amber-500/30 bg-amber-500/10 opacity-80'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="min-w-0 truncate text-sm font-semibold text-white">
                                                            {title}
                                                        </span>
                                                        <span className="shrink-0 text-xs text-gray-400">
                                                            {reward.cost} баллов
                                                        </span>
                                                    </div>
                                                    {!canAttach ? (
                                                        <p className="mt-1 text-xs text-amber-200">
                                                            Нужен включенный ввод сообщения
                                                        </p>
                                                    ) : null}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="flex h-24 items-center justify-center text-sm text-gray-400">
                                            Награды не найдены
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={
                                selectedPlatform === 'twitch' && rewardSetupMode === 'attach'
                                    ? handleAttachReward
                                    : handleCreateReward
                            }
                            disabled={
                                saving ||
                                (selectedPlatform === 'twitch' &&
                                    rewardSetupMode === 'attach' &&
                                    !selectedAttachRewardId)
                            }
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {selectedPlatform === 'twitch' && rewardSetupMode === 'attach' ? 'Привязать' : 'Создать'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={platformToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPlatformToDelete(null);
                }}
                title="Отвязать TTS награду"
                description={
                    platformToDelete
                        ? `Награда для ${platformToDelete.toUpperCase()} перестанет запускать TTS.`
                        : 'Награда перестанет запускать TTS.'
                }
                confirmLabel="Отвязать"
                variant="destructive"
                loading={deleteTtsRewardMutation.isPending}
                onConfirm={confirmDeleteReward}
            />
        </div>
    );
};

export default TtsChannelPointsMode;
