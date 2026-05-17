import React, { useState } from 'react';

/* eslint-disable no-alert */
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { queryKeys } from '../../../queries/queryKeys';
import { useCreateTtsReward, useDeleteTtsReward, useTtsModeSettings } from '../../../queries/tts/ttsQueries';
import { TwitchIcon, VKIcon } from '../../../shared/components/PlatformIcons';
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

const RewardPlatformRow: React.FC<RewardPlatformRowProps> = ({
    platform,
    rewardId,
    isLoadingRewards,
    onCreate,
    onDelete,
}) => (
    <Card className="border-gray-700 bg-gray-800/30">
        <CardContent className="p-3 flex items-center justify-between">
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
                        Создать
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
    const modeSettingsData = (modeSettingsResponse as { data?: { tts_reward_ids?: Record<string, string> } })?.data;

    const ttsRewardIds = modeSettingsData?.tts_reward_ids || {};

    // Открыть диалог создания награды
    const openCreateDialog = (platform: RewardPlatformKey) => {
        setSelectedPlatform(platform);
        setRewardForm({
            title: `TTS Озвучка сообщения`,
            cost: 500,
            cooldown: 0,
        });
        setShowCreateDialog(true);
    };

    // [OK] НОВЫЙ КОД: Используем централизованный hook для создания награды
    const createTtsRewardMutation = useCreateTtsReward({
        onSuccess: (response) => {
            // Оптимистичное обновление - сразу обновляем кэш с новым reward_id
            const responseData = response as { data?: { reward_id?: string } };
            const rewardId = responseData.data?.reward_id;
            if (rewardId && modeSettingsData && selectedPlatform) {
                queryClient.setQueryData(
                    queryKeys.tts.modeSettings(),
                    (oldData: Record<string, unknown> | undefined) => {
                        if (!oldData) return oldData;
                        const oldRewardIds = (oldData.tts_reward_ids || {}) as Record<string, unknown>;
                        return {
                            ...oldData,
                            tts_reward_ids: {
                                ...oldRewardIds,
                                [selectedPlatform]: rewardId,
                            },
                        };
                    }
                );
            }
            // Принудительно обновляем данные с сервера
            refetchModeSettings();
            setShowCreateDialog(false);
            // toast уже показан в hook
        },
        onError: (error) => {
            logger.error('Error creating TTS reward:', error);
            // Откатываем оптимистичное обновление при ошибке
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
            // toast уже показан в hook
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
            // toast уже показан в hook
        },
    });

    // Удалить награду TTS
    const handleDeleteReward = (platform: RewardPlatformKey) => {
        if (!confirm(`Удалить TTS награду для ${platform.toUpperCase()}?`)) {
            return;
        }

        if (deleteTtsRewardMutation.isPending) return;

        // Оптимистичное обновление - сразу удаляем reward_id из кэша
        if (modeSettingsData) {
            queryClient.setQueryData(queryKeys.tts.modeSettings(), (oldData: Record<string, unknown> | undefined) => {
                if (!oldData) return oldData;
                const oldRewardIds = { ...((oldData.tts_reward_ids || {}) as Record<string, unknown>) };
                delete oldRewardIds[platform];
                return {
                    ...oldData,
                    tts_reward_ids: oldRewardIds,
                };
            });
        }

        deleteTtsRewardMutation.mutate(platform);
    };

    const connectedPlatforms = React.useMemo(
        () => REWARD_PLATFORMS.filter(({ key }) => integrations?.[key]?.enabled && platformCapabilities[key].rewards),
        [integrations, platformCapabilities]
    );
    const hasRewardPlatforms = connectedPlatforms.length > 0;

    return (
        <div className="space-y-3">
            {/* Выбор режима - показываем только если showModeSelector=true */}
            {showModeSelector && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onModeChange('all_messages')}
                        disabled={isSaving}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                            ttsMode === 'all_messages'
                                ? 'border-sky-500/50 bg-sky-500/10 text-sky-50'
                                : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                    >
                        <div className="font-semibold text-sm mb-0.5">Все сообщения</div>
                        <div
                            className={`text-xs ${ttsMode === 'all_messages' ? 'text-sky-200/80' : 'text-muted-foreground'}`}
                        >
                            Стандартный режим
                        </div>
                    </button>

                    <button
                        onClick={() => onModeChange('channel_points')}
                        disabled={isSaving || !hasRewardPlatforms}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                            !hasRewardPlatforms
                                ? 'cursor-not-allowed border-border/60 bg-background/20 text-muted-foreground/70 opacity-40'
                                : ttsMode === 'channel_points'
                                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-50'
                                  : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                    >
                        <div className="font-semibold text-sm mb-0.5">За баллы канала</div>
                        <div
                            className={`text-xs ${ttsMode === 'channel_points' && hasRewardPlatforms ? 'text-sky-200/80' : 'text-muted-foreground'}`}
                        >
                            {!hasRewardPlatforms ? 'Подключите Twitch или VK Live' : 'Только с наградой'}
                        </div>
                    </button>
                </div>
            )}

            {/* Настройка наград */}
            {ttsMode === 'channel_points' && showRewards && (
                <div className={showModeSelector ? 'pt-3 border-t border-gray-700/30' : 'py-0'}>
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

            {/* Диалог создания награды */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="bg-gray-900 border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            TTS награда для {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
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
                                        setRewardForm({ ...rewardForm, cooldown: parseInt(e.target.value) || 0 })
                                    }
                                    placeholder="0"
                                    className="bg-gray-800 border-gray-700 text-white"
                                />
                            </div>
                        </div>
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
                            onClick={handleCreateReward}
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Создать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TtsChannelPointsMode;
