import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, Loader2, Music, Power, Save, Trash2, Upload } from 'lucide-react';

import {
    useCreateDropsReward,
    useDeleteDropsReward,
    useDropsQualities,
    useDropsRewards,
    useToggleDropsReward,
    useUploadDropsRewardSound,
    useUpdateDropsReward,
} from '@/queries/drops/dropsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from '@/utils/toastManager';

import CommonClosed from '../../../images/lootboxes/common/common_closed.png';
import EpicClosed from '../../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../../images/lootboxes/legendary/legendary_closed.png';
import MythicalClosed from '../../../images/lootboxes/mythyc/mythyc_closed.png';
import RareClosed from '../../../images/lootboxes/rare/rare_closed.png';

import type { DropsReward } from '@/types/drops';

interface QualityConfig {
    id: number;
    name: string;
    color: string;
    label: string;
    image: string;
}

const QUALITIES: QualityConfig[] = [
    { id: 1, name: 'Common', color: '#6B7280', label: 'Обычный', image: CommonClosed },
    { id: 2, name: 'Rare', color: '#3B82F6', label: 'Редкий', image: RareClosed },
    { id: 3, name: 'Epic', color: '#8B5CF6', label: 'Эпический', image: EpicClosed },
    { id: 4, name: 'Legendary', color: '#F59E0B', label: 'Легендарный', image: LegendaryClosed },
    { id: 5, name: 'Mythical', color: '#EF4444', label: 'Мифический', image: MythicalClosed },
];

interface Reward {
    id: string | number;
    name: string;
    description?: string;
    quality?: 'common' | 'rare' | 'epic' | 'legendary' | 'mythical' | { id?: number; name?: string } | number;
    weight?: number;
    reward_type?: string;
    reward_value?: string;
    image_url?: string;
    sound_file?: string;
    sound_volume?: number;
    is_active: boolean;
    platform?: string;
}

interface RewardForm {
    name: string;
    description: string;
    quality_id: number | null;
    weight: number;
    image_url: string;
    sound_volume: number;
    is_active: boolean;
    platform: string;
}

interface RewardsManagerProps {
    user: Record<string, unknown>;
    channelName: string;
    onRewardsCountChange?: (count: number) => void;
    integrations?: {
        twitch?: { enabled?: boolean; connected?: boolean };
        vk?: { enabled?: boolean; connected?: boolean };
    };
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const CONTROL_TRIGGER_CLASS = 'h-9 border-border/70 bg-transparent shadow-none';
const CONTROL_CONTENT_CLASS = 'border-border/70 bg-[#0b0712] ring-1 ring-white/10';
const MAX_REWARD_WEIGHT = 2000;

const QUALITY_CARD_SKELETON_COUNT = 4;

const dedupeRewards = (items: Reward[]): Reward[] => {
    const bySignature = new Map<string, Reward>();

    for (const reward of items) {
        const qualityName =
            typeof reward.quality === 'object'
                ? reward.quality?.name || 'unknown'
                : String(reward.quality || 'unknown');
        const signature = `${reward.name.trim().toLowerCase()}|${qualityName.toLowerCase()}`;

        const existing = bySignature.get(signature);
        if (!existing) {
            bySignature.set(signature, reward);
            continue;
        }

        const existingId = Number(existing.id);
        const nextId = Number(reward.id);
        const preferNew =
            (reward.is_active && !existing.is_active) ||
            (Number.isFinite(nextId) && Number.isFinite(existingId) && nextId > existingId);

        if (preferNew) {
            bySignature.set(signature, reward);
        }
    }

    return Array.from(bySignature.values());
};

const emptyForm = (platform: string, qualityId: number | null): RewardForm => ({
    name: '',
    description: '',
    quality_id: qualityId,
    weight: 100,
    image_url: '',
    sound_volume: 1,
    is_active: true,
    platform,
});

const getRewardQualityId = (reward: Reward): number | null => {
    if (typeof reward.quality === 'object') return reward.quality?.id || null;
    if (typeof reward.quality === 'number') return reward.quality;
    const qualityName = typeof reward.quality === 'string' ? reward.quality.toLowerCase() : '';
    return (
        QUALITIES.find((item) => item.name.toLowerCase() === qualityName || item.label.toLowerCase() === qualityName)
            ?.id || null
    );
};

const getWeightChanceLabel = (chance: number): string => {
    if (!Number.isFinite(chance) || chance <= 0) return '0%';
    if (chance >= 99.95) return '100%';
    if (chance >= 10) return `${chance.toFixed(1)}%`;
    return `${chance.toFixed(2)}%`;
};

const RewardsManager: React.FC<RewardsManagerProps> = React.memo(
    ({ user, channelName, onRewardsCountChange, integrations }) => {
        const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
        const [selectedRewardId, setSelectedRewardId] = useState<number | null>(null);
        const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
        const [pendingSoundFile, setPendingSoundFile] = useState<File | null>(null);

        const twitchAvailable = useMemo(
            () => !!(integrations?.twitch?.enabled && user?.twitch_username),
            [integrations?.twitch?.enabled, user?.twitch_username]
        );
        const vkAvailable = useMemo(
            () => !!(integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name)),
            [integrations?.vk?.enabled, user?.vk_username, user?.vk_channel_name]
        );

        const availablePlatforms: { value: string; label: string }[] = [];
        if (twitchAvailable) availablePlatforms.push({ value: 'twitch', label: 'Twitch' });
        if (vkAvailable) availablePlatforms.push({ value: 'vk', label: 'VK Live' });

        const { data: qualitiesData = [], isLoading: isQualitiesLoading } = useDropsQualities();
        const { data: allRewardsData = [], isLoading: isRewardsLoading } = useDropsRewards(channelName);

        const createRewardMutation = useCreateDropsReward(channelName);
        const updateRewardMutation = useUpdateDropsReward(channelName);
        const deleteRewardMutation = useDeleteDropsReward(channelName);
        const toggleRewardMutation = useToggleDropsReward(channelName);
        const uploadRewardSoundMutation = useUploadDropsRewardSound(channelName);
        const soundInputRef = useRef<HTMLInputElement | null>(null);

        const firstQualityId = useMemo(() => {
            if (Array.isArray(qualitiesData) && qualitiesData.length > 0) {
                return (qualitiesData[0] as { id?: number })?.id ?? QUALITIES[0].id;
            }
            return QUALITIES[0].id;
        }, [qualitiesData]);

        const defaultPlatform = availablePlatforms[0]?.value || 'twitch';

        const [form, setForm] = useState<RewardForm>(() => emptyForm(defaultPlatform, firstQualityId));

        const rewards = useMemo(() => {
            const allRewards = (Array.isArray(allRewardsData) ? allRewardsData : []) as Reward[];
            return dedupeRewards(allRewards);
        }, [allRewardsData]);

        const selectedReward = useMemo(
            () => rewards.find((reward) => Number(reward.id) === selectedRewardId) || null,
            [rewards, selectedRewardId]
        );

        const normalizedWeight = Math.max(1, Math.min(MAX_REWARD_WEIGHT, Number(form.weight) || 1));
        const currentQualityId = form.quality_id;
        const selectedQualityRewards = useMemo(() => {
            if (!currentQualityId) return [];
            return rewards.filter((reward) => getRewardQualityId(reward) === currentQualityId);
        }, [currentQualityId, rewards]);

        const weightPreview = useMemo(() => {
            if (!currentQualityId) {
                return {
                    totalWeight: normalizedWeight,
                    chancePercent: 100,
                    isOnlyReward: true,
                };
            }

            const otherRewards = selectedQualityRewards.filter((reward) => {
                if (editorMode !== 'edit' || !selectedReward) return true;
                return Number(reward.id) !== Number(selectedReward.id);
            });

            const totalWeight =
                otherRewards.reduce((sum, reward) => sum + Math.max(1, Number(reward.weight) || 1), 0) +
                normalizedWeight;
            const chancePercent = totalWeight > 0 ? (normalizedWeight / totalWeight) * 100 : 100;

            return {
                totalWeight,
                chancePercent,
                isOnlyReward: otherRewards.length === 0,
            };
        }, [currentQualityId, editorMode, normalizedWeight, selectedQualityRewards, selectedReward]);

        useEffect(() => {
            if (onRewardsCountChange) onRewardsCountChange(rewards.length);
        }, [rewards.length, onRewardsCountChange]);

        useEffect(() => {
            if (editorMode === 'edit' && selectedReward) {
                const qualityId =
                    typeof selectedReward.quality === 'object'
                        ? selectedReward.quality?.id || null
                        : typeof selectedReward.quality === 'number'
                          ? selectedReward.quality
                          : null;

                setForm({
                    name: selectedReward.name,
                    description: selectedReward.description || '',
                    quality_id: qualityId,
                    weight: selectedReward.weight ?? 100,
                    image_url: selectedReward.image_url || '',
                    sound_volume: selectedReward.sound_volume || 1,
                    is_active: selectedReward.is_active,
                    platform: selectedReward.platform || defaultPlatform,
                });
            }
        }, [editorMode, selectedReward, defaultPlatform]);

        useEffect(() => {
            if (editorMode === 'edit' && selectedRewardId !== null && !selectedReward) {
                setEditorMode('create');
                setSelectedRewardId(null);
                setForm(emptyForm(defaultPlatform, firstQualityId));
            }
        }, [editorMode, selectedRewardId, selectedReward, defaultPlatform, firstQualityId]);

        const switchToCreate = (): void => {
            setEditorMode('create');
            setSelectedRewardId(null);
            setDeleteConfirmId(null);
            setPendingSoundFile(null);
            setForm(emptyForm(defaultPlatform, firstQualityId));
        };

        const switchToEdit = (reward: Reward): void => {
            setEditorMode('edit');
            setSelectedRewardId(Number(reward.id));
            setDeleteConfirmId(null);
            setPendingSoundFile(null);
        };

        const handleToggleReward = (reward: Reward): void => {
            toggleRewardMutation.mutate({
                rewardId: Number(reward.id),
                isActive: !reward.is_active,
            });
        };

        const handleDelete = (): void => {
            if (!selectedReward) return;
            const rewardId = Number(selectedReward.id);

            deleteRewardMutation.mutate(rewardId, {
                onSuccess: () => {
                    toast.success('Награда удалена');
                    switchToCreate();
                },
            });
        };

        const handleSoundSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
            const file = event.target.files?.[0];
            if (!file) return;

            if (editorMode !== 'edit' || !selectedReward) {
                setPendingSoundFile(file);
                if (soundInputRef.current) {
                    soundInputRef.current.value = '';
                }
                return;
            }

            uploadRewardSoundMutation.mutate(
                {
                    rewardId: Number(selectedReward.id),
                    file,
                },
                {
                    onSettled: () => {
                        if (soundInputRef.current) {
                            soundInputRef.current.value = '';
                        }
                    },
                }
            );
        };

        const handleSave = (): void => {
            if (!form.name.trim()) {
                toast.error('Укажите название награды');
                return;
            }

            if (!form.quality_id) {
                toast.error('Выберите качество сундука');
                return;
            }

            const payload: Partial<DropsReward> = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                quality_id: form.quality_id,
                weight: Math.max(1, Math.min(MAX_REWARD_WEIGHT, Number(form.weight) || 1)),
                reward_type: 'custom',
                reward_value: '',
                image_url: form.image_url.trim() || undefined,
                sound_volume: Math.max(0, Math.min(2, Number(form.sound_volume) || 1)),
                is_active: form.is_active,
                platform: form.platform,
            } as Partial<DropsReward>;

            if (editorMode === 'edit' && selectedReward) {
                updateRewardMutation.mutate(
                    {
                        rewardId: Number(selectedReward.id),
                        reward: payload,
                    },
                    {
                        onSuccess: () => toast.success('Награда обновлена'),
                    }
                );
                return;
            }

            createRewardMutation.mutate(payload, {
                onSuccess: (response) => {
                    const createdRewardId = Number((response as { data?: { id?: number | string } })?.data?.id);
                    if (pendingSoundFile && Number.isFinite(createdRewardId)) {
                        uploadRewardSoundMutation.mutate({
                            rewardId: createdRewardId,
                            file: pendingSoundFile,
                        });
                    }
                    toast.success('Награда создана');
                    setPendingSoundFile(null);
                    setForm(emptyForm(defaultPlatform, firstQualityId));
                },
            });
        };

        const rewardsByQuality = (qualityName: string): Reward[] => {
            return rewards.filter((reward) => {
                if (typeof reward.quality === 'object') return reward.quality?.name === qualityName;
                return false;
            });
        };

        const isSaving = createRewardMutation.isPending || updateRewardMutation.isPending;
        const isRewardsLayoutLoading = isQualitiesLoading || isRewardsLoading;

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_clamp(280px,27vw,360px)] gap-3 min-[1280px]:gap-4">
                    <div className="space-y-4">
                        {QUALITIES.map((qualityItem) => {
                            const qualityRewards = rewardsByQuality(qualityItem.name);
                            const activeQualityWeight = qualityRewards
                                .filter((reward) => reward.is_active !== false)
                                .reduce((sum, reward) => sum + Math.max(1, Number(reward.weight) || 1), 0);
                            const qualityData = Array.isArray(qualitiesData)
                                ? (qualitiesData as unknown as QualityConfig[]).find((q) => q.name === qualityItem.name)
                                : null;

                            return (
                                <Card key={qualityItem.id} className={SURFACE_CARD_CLASS}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <img
                                                src={qualityItem.image}
                                                alt={`${qualityItem.label} chest`}
                                                className="h-8 w-8 object-contain"
                                            />
                                            <span style={{ color: qualityData?.color || qualityItem.color }}>
                                                {qualityItem.label}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="border-border/70 bg-transparent text-foreground/90"
                                            >
                                                {isRewardsLayoutLoading ? '...' : qualityRewards.length}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {isRewardsLayoutLoading ? (
                                            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2.5">
                                                {Array.from({ length: QUALITY_CARD_SKELETON_COUNT }).map((_, index) => (
                                                    <div
                                                        key={`${qualityItem.name}-skeleton-${index}`}
                                                        className="h-[100px] animate-pulse rounded-xl border border-border/70 bg-card/60"
                                                    />
                                                ))}
                                            </div>
                                        ) : qualityRewards.length === 0 ? (
                                            <div className="rounded-lg border border-border/70 bg-transparent py-5 text-center text-sm text-muted-foreground">
                                                Наград пока нет
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2.5">
                                                {qualityRewards.map((reward) => {
                                                    const isSelected =
                                                        editorMode === 'edit' && Number(reward.id) === selectedRewardId;
                                                    const rewardWeight = Math.max(1, Number(reward.weight) || 1);
                                                    const rewardChance =
                                                        reward.is_active === false || activeQualityWeight <= 0
                                                            ? 0
                                                            : (rewardWeight / activeQualityWeight) * 100;
                                                    return (
                                                        <div
                                                            key={reward.id}
                                                            className={`flex min-h-[92px] flex-col rounded-lg border p-2.5 transition-colors ${reward.is_active ? (isSelected ? 'border-sky-500/50' : 'border-border/70') : 'border-red-500/40'} ${reward.is_active ? 'bg-transparent' : 'bg-transparent opacity-70'}`}
                                                        >
                                                            <div className="mb-1.5 flex items-start justify-between gap-2">
                                                                <h4 className="line-clamp-2 text-sm font-semibold text-foreground">
                                                                    {reward.name}
                                                                </h4>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="shrink-0 border-border/70 bg-transparent text-sky-300"
                                                                >
                                                                    Вес {reward.weight} · {getWeightChanceLabel(rewardChance)}
                                                                </Badge>
                                                            </div>

                                                            {reward.description ? (
                                                                <p className="mb-1.5 line-clamp-1 text-xs text-muted-foreground">
                                                                    {reward.description}
                                                                </p>
                                                            ) : null}

                                                            {reward.sound_file && (
                                                                <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Music className="h-3 w-3" /> Звук
                                                                </div>
                                                            )}

                                                            <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => switchToEdit(reward)}
                                                                    className="h-8 w-8 p-0 text-sky-300 hover:bg-transparent hover:text-sky-200"
                                                                    title="Редактировать"
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleToggleReward(reward)}
                                                                    className={`h-8 w-8 p-0 ${reward.is_active ? 'text-emerald-400 hover:bg-transparent hover:text-emerald-300' : 'text-muted-foreground hover:bg-transparent hover:text-sky-300'}`}
                                                                    disabled={toggleRewardMutation.isPending}
                                                                    title={
                                                                        reward.is_active
                                                                            ? 'Деактивировать'
                                                                            : 'Активировать'
                                                                    }
                                                                >
                                                                    <Power className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        switchToEdit(reward);
                                                                        setDeleteConfirmId(Number(reward.id));
                                                                    }}
                                                                    className="h-8 w-8 p-0 text-red-400 hover:bg-transparent hover:text-red-300"
                                                                    title="Удалить"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Card className={`${SURFACE_CARD_CLASS} xl:sticky xl:top-20 h-fit`}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                {editorMode === 'edit' ? 'Редактирование награды' : 'Создание награды'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="reward_name">Название</Label>
                                <Input
                                    id="reward_name"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="border-border/70 bg-transparent"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="reward_description">Описание</Label>
                                <Textarea
                                    id="reward_description"
                                    value={form.description}
                                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="border-border/70 bg-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="reward_quality">Качество</Label>
                                    <Select
                                        value={form.quality_id?.toString() || ''}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                quality_id: parseInt(value, 10) || firstQualityId,
                                            }))
                                        }
                                    >
                                        <SelectTrigger id="reward_quality" className={CONTROL_TRIGGER_CLASS}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                                            {(qualitiesData.length > 0
                                                ? (qualitiesData as unknown as QualityConfig[])
                                                : QUALITIES
                                            ).map((q) => {
                                                const qName = typeof q.name === 'string' ? q.name : '';
                                                const qualityInfo =
                                                    QUALITIES.find(
                                                        (qual) => qual.name.toLowerCase() === qName.toLowerCase()
                                                    ) || q;
                                                return (
                                                    <SelectItem key={q.id} value={q.id.toString()}>
                                                        <div className="flex items-center gap-2">
                                                            {'image' in qualityInfo && qualityInfo.image ? (
                                                                <img
                                                                    src={qualityInfo.image}
                                                                    alt={qualityInfo.label || qName}
                                                                    className="h-4 w-4"
                                                                />
                                                            ) : null}
                                                            {qualityInfo.label || qName}
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="reward_weight">Вес выпадения</Label>
                                    <Input
                                        id="reward_weight"
                                        type="number"
                                        min="1"
                                        max={String(MAX_REWARD_WEIGHT)}
                                        value={form.weight}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                weight: Math.max(
                                                    1,
                                                    Math.min(MAX_REWARD_WEIGHT, parseInt(e.target.value, 10) || 1)
                                                ),
                                            }))
                                        }
                                        className="border-border/70 bg-transparent"
                                    />
                                    <p className="text-[11px] leading-4 text-muted-foreground">
                                        {weightPreview.isOnlyReward
                                            ? 'Если награда одна в этом сундуке, шанс выпадения будет 100%.'
                                            : `Примерный шанс выпадения в этом сундуке: ${getWeightChanceLabel(weightPreview.chancePercent)} при общем весе ${weightPreview.totalWeight}.`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                                <Label htmlFor="reward_active" className="text-sm">
                                    Активна
                                </Label>
                                <Switch
                                    id="reward_active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                                />
                            </div>

                            <div className="space-y-2 rounded-md border border-border/70 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <Label className="text-sm">Звук награды</Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            Проигрывается после остановки рулетки.
                                        </p>
                                    </div>
                                    {selectedReward?.sound_file ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                            <Music className="h-3 w-3" /> Загружен
                                        </span>
                                    ) : null}
                                </div>
                                <input
                                    ref={soundInputRef}
                                    type="file"
                                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                                    className="hidden"
                                    onChange={(event) => void handleSoundSelect(event)}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200"
                                    disabled={uploadRewardSoundMutation.isPending}
                                    onClick={() => soundInputRef.current?.click()}
                                >
                                    {uploadRewardSoundMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                    )}
                                    {pendingSoundFile
                                        ? pendingSoundFile.name
                                        : selectedReward?.sound_file
                                          ? 'Заменить звук'
                                          : 'Загрузить звук'}
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving || deleteRewardMutation.isPending}
                                    variant="outline"
                                    className="flex-1 border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200"
                                >
                                    {isSaving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    {editorMode === 'edit' ? 'Сохранить' : 'Создать'}
                                </Button>
                                {editorMode === 'edit' ? (
                                    <Button
                                        onClick={() =>
                                            setDeleteConfirmId((prev) =>
                                                prev ? null : Number(selectedReward?.id || 0)
                                            )
                                        }
                                        variant="outline"
                                        className="border-border/70 bg-transparent text-red-400 hover:bg-transparent hover:text-red-300"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Удалить
                                    </Button>
                                ) : null}
                            </div>

                            {editorMode === 'edit' ? (
                                <Button
                                    onClick={switchToCreate}
                                    variant="outline"
                                    className="w-full border-border/70 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                                >
                                    Отмена редактирования
                                </Button>
                            ) : null}

                            {deleteConfirmId &&
                            editorMode === 'edit' &&
                            selectedReward &&
                            Number(selectedReward.id) === deleteConfirmId ? (
                                <div className="rounded-md border border-red-500/40 bg-transparent p-2.5 text-xs text-red-300">
                                    <p className="mb-2">Удалить награду «{selectedReward.name}»?</p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleDelete}
                                            disabled={deleteRewardMutation.isPending}
                                            variant="outline"
                                            className="h-8 border-red-500/40 bg-transparent text-red-300 hover:bg-transparent hover:text-red-200"
                                        >
                                            Да, удалить
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => setDeleteConfirmId(null)}
                                            variant="outline"
                                            className="h-8 border-border/70 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                                        >
                                            Отмена
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
);

export default RewardsManager;
