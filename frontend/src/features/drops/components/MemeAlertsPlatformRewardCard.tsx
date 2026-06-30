import React, { useMemo, useState } from 'react';

import { Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { cn } from '@/lib/utils';
import { usePlatformRewards } from '@/queries/points/pointsQueries';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

import { FIELD_CLASS } from './memealertsTypes';

import type { ApiResponse, PlatformReward } from '@/types';

type RewardMode = 'create' | 'attach';
type PlatformRewardsResponse = ApiResponse<unknown> & {
    rewards?: PlatformReward[];
    data?: PlatformReward[] | { rewards?: PlatformReward[] };
};

interface MemeAlertsPlatformRewardCardProps {
    platform: 'twitch' | 'vk';
    platformConnected: boolean;
    platformAvailability: Record<'twitch' | 'vk', boolean>;
    title: string;
    cost: number;
    coinsAmount: number;
    canCreateMoreRewards: boolean;
    creating: boolean;
    settingsLoading: boolean;
    editingRewardId: string | null;
    onPlatformChange: (platform: 'twitch' | 'vk') => void;
    onTitleChange: (value: string) => void;
    onCostChange: (value: number) => void;
    onCoinsAmountChange: (value: number) => void;
    onCreate: () => void;
    onAttach: (reward: PlatformReward) => void;
    onCancelEdit: () => void;
}

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

const acceptsMessage = (platform: 'twitch' | 'vk', reward: PlatformReward): boolean => {
    if (platform === 'twitch') return reward.is_user_input_required === true;
    return reward.is_message_required === true;
};

export const MemeAlertsPlatformRewardCard: React.FC<MemeAlertsPlatformRewardCardProps> = ({
    platform,
    platformConnected,
    platformAvailability,
    title,
    cost,
    coinsAmount,
    canCreateMoreRewards,
    creating,
    settingsLoading,
    editingRewardId,
    onPlatformChange,
    onTitleChange,
    onCostChange,
    onCoinsAmountChange,
    onCreate,
    onAttach,
    onCancelEdit,
}) => {
    const [mode, setMode] = useState<RewardMode>('create');
    const [search, setSearch] = useState('');
    const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
    const effectiveMode = editingRewardId ? 'create' : mode;
    const { data: platformRewardsResponse, isLoading: rewardsLoading } = usePlatformRewards(platform, {
        enabled: platformConnected && effectiveMode === 'attach',
    });
    const rewards = useMemo(
        () => getRewardsFromResponse(platformRewardsResponse as PlatformRewardsResponse | undefined),
        [platformRewardsResponse]
    );
    const filteredRewards = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rewards
            .map((reward) => {
                const rewardTitle = getRewardTitle(reward);
                const rewardName = String(reward.name || '').trim();
                const haystack = `${rewardTitle} ${rewardName}`.trim().toLowerCase();
                const exact = Boolean(
                    query && [rewardTitle, rewardName].some((value) => value.toLowerCase() === query)
                );
                return { reward, rewardTitle, haystack, exact };
            })
            .filter(({ haystack }) => !query || haystack.includes(query))
            .sort((left, right) => {
                if (left.exact !== right.exact) return left.exact ? -1 : 1;
                return left.rewardTitle.localeCompare(right.rewardTitle, 'ru');
            })
            .map(({ reward }) => reward);
    }, [rewards, search]);
    const selectedReward = rewards.find((reward) => String(reward.id) === selectedRewardId);

    const selectReward = (reward: PlatformReward): void => {
        if (!acceptsMessage(platform, reward)) {
            toast.error('Для MemeAlerts нужна награда с обязательным вводом сообщения');
            return;
        }
        setSelectedRewardId(String(reward.id));
    };

    const submit = (): void => {
        if (effectiveMode === 'attach') {
            if (!selectedReward) {
                toast.error('Выберите награду для привязки');
                return;
            }
            onAttach(selectedReward);
            return;
        }
        onCreate();
    };

    return (
        <AutomationCard icon={Gift} title="Награда за баллы" contentClassName="grid grid-rows-[1fr_auto]">
            <div className="grid content-start gap-3">
                <TooltipProvider delayDuration={150}>
                    <div className="grid grid-cols-2 gap-2">
                        {(['twitch', 'vk'] as const).map((option) => {
                            const available = platformAvailability[option];
                            const active = platform === option;
                            const button = (
                                <Button
                                    key={option}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (!available) return;
                                        setMode('create');
                                        setSearch('');
                                        setSelectedRewardId(null);
                                        onPlatformChange(option);
                                    }}
                                    disabled={!available}
                                    className={cn(
                                        'h-9 w-full border-border/70',
                                        active
                                            ? option === 'twitch'
                                                ? 'border-[#9146FF] bg-[#9146FF] text-white hover:bg-[#7f3ee8]'
                                                : 'border-[#FF4444] bg-[#FF4444] text-white hover:bg-[#e13d3d]'
                                            : 'bg-card/70 hover:bg-accent',
                                        !available && 'cursor-not-allowed opacity-45'
                                    )}
                                >
                                    {option === 'twitch' ? 'Twitch' : 'VK Live'}
                                </Button>
                            );

                            if (available) return button;

                            return (
                                <Tooltip key={option}>
                                    <TooltipTrigger asChild>
                                        <span>{button}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {option === 'vk' ? 'VK Live не подключен' : 'Twitch не подключен'}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </TooltipProvider>

                {!editingRewardId ? (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background/40 p-1">
                        <Button
                            type="button"
                            variant={effectiveMode === 'create' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => {
                                setMode('create');
                                setSelectedRewardId(null);
                            }}
                            className={cn(
                                'h-8',
                                effectiveMode === 'create'
                                    ? 'bg-blue-700 text-white hover:bg-blue-800'
                                    : 'text-muted-foreground hover:bg-accent'
                            )}
                        >
                            Создать
                        </Button>
                        <Button
                            type="button"
                            variant={effectiveMode === 'attach' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => {
                                setMode('attach');
                                setSelectedRewardId(null);
                            }}
                            className={cn(
                                'h-8',
                                effectiveMode === 'attach'
                                    ? 'bg-blue-700 text-white hover:bg-blue-800'
                                    : 'text-muted-foreground hover:bg-accent'
                            )}
                        >
                            Привязать
                        </Button>
                    </div>
                ) : null}

                {effectiveMode === 'create' ? (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Название награды</Label>
                            <Input
                                value={title}
                                onChange={(event) => onTitleChange(event.target.value)}
                                className={FIELD_CLASS}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <NumberField label="Баллов" value={cost} onChange={onCostChange} />
                            <NumberField label="Мемкоинов" value={coinsAmount} onChange={onCoinsAmountChange} />
                        </div>
                    </>
                ) : (
                    <>
                        <NumberField label="Мемкоинов" value={coinsAmount} onChange={onCoinsAmountChange} />
                        <div className="space-y-1.5">
                            <Label className="text-xs">Поиск награды</Label>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Название существующей награды"
                                className={FIELD_CLASS}
                            />
                        </div>
                        <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-background/45 p-2">
                            {rewardsLoading ? (
                                <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    Загрузка наград
                                </div>
                            ) : filteredRewards.length > 0 ? (
                                filteredRewards.map((reward) => {
                                    const rewardId = String(reward.id);
                                    const canAttach = acceptsMessage(platform, reward);
                                    const selected = selectedRewardId === rewardId;

                                    return (
                                        <button
                                            key={rewardId}
                                            type="button"
                                            aria-disabled={!canAttach}
                                            onClick={() => selectReward(reward)}
                                            className={cn(
                                                'w-full rounded-md border px-2.5 py-2 text-left transition-colors',
                                                selected
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : canAttach
                                                      ? 'border-border/60 bg-card/70 hover:border-blue-500/60'
                                                      : 'border-amber-500/30 bg-amber-500/10 opacity-80'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                                                    {getRewardTitle(reward)}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                                    {reward.cost ?? reward.price ?? 0}
                                                </span>
                                            </div>
                                            {!canAttach ? (
                                                <p className="mt-1 text-[11px] text-amber-200">Нужен ввод сообщения</p>
                                            ) : null}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                                    Награды не найдены
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="flex gap-2">
                <Button
                    type="button"
                    onClick={submit}
                    disabled={
                        creating ||
                        settingsLoading ||
                        !platformConnected ||
                        !canCreateMoreRewards ||
                        (effectiveMode === 'attach' && !selectedReward)
                    }
                    className="h-9 flex-1 bg-blue-700 text-white hover:bg-blue-800"
                >
                    {creating
                        ? 'Сохраняю...'
                        : editingRewardId
                          ? 'Сохранить'
                          : effectiveMode === 'attach'
                            ? 'Привязать'
                            : 'Создать'}
                </Button>
                {editingRewardId ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancelEdit}
                        className="h-9 border-border/70 bg-card/70"
                    >
                        Отмена
                    </Button>
                ) : null}
            </div>
        </AutomationCard>
    );
};

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({
    label,
    value,
    onChange,
}) => (
    <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
            type="number"
            min={1}
            value={value}
            onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
            className={FIELD_CLASS}
        />
    </div>
);
