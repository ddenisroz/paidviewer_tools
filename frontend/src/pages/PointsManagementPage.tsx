import React, { useCallback, useEffect, useState } from 'react';

import {
    CheckCircle2,
    Clock,
    Edit,
    Gift,
    Loader2,
    MessageCircle,
    Plus,
    Power,
    PowerOff,
    Trash2,
    XCircle,
} from 'lucide-react';

import { PLATFORM_COLORS } from '@/constants/uiConstants';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { cn } from '@/lib/utils';
import pointsApi from '@/services/pointsApi';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import RewardDialog from '@/shared/components/points/RewardDialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { formatAppDateTime } from '@/shared/utils/dateTime';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { PlatformReward, RewardDemand } from '@/types/points';

interface RewardCardProps {
    reward: PlatformReward;
    platform: 'twitch' | 'vk';
    onEdit: () => void;
    onRefresh: () => void;
}

interface RedemptionQueueProps {
    platform: 'twitch' | 'vk';
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90';
const CONTROL_TRIGGER_CLASS =
    'h-9 border-sky-400/45 bg-background/85 shadow-[0_0_0_1px_rgba(14,165,233,0.12)] data-[state=open]:border-sky-400/75 data-[state=open]:bg-background';
const CONTROL_CONTENT_CLASS = 'border-sky-400/40 bg-[#0b0712] shadow-2xl shadow-black/60 ring-1 ring-white/10';
const TAB_BUTTON_BASE =
    'relative inline-flex shrink-0 items-center px-4 py-2 text-sm font-medium text-muted-foreground transition-colors';
const TAB_ACTIVE_CLASS =
    'text-sky-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-sky-400';
const PLATFORM_TAB_BASE =
    'relative inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-colors';

const RewardCard: React.FC<RewardCardProps> = ({ reward, platform, onEdit, onRefresh }) => {
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
    const [toggling, setToggling] = useState<boolean>(false);

    const handleDelete = async (): Promise<void> => {
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async (): Promise<void> => {
        setDeleting(true);
        try {
            if (platform === 'vk' && reward.is_enabled) {
                try {
                    logger.log(`[REFRESH] [DELETE] Attempting to disable VK reward ${reward.id} before deletion`);
                    await pointsApi.toggleReward(platform, String(reward.id), false);
                    await new Promise((resolve) => setTimeout(resolve, 800));
                } catch (toggleErr) {
                    logger.warn('Toggle before delete failed (backend will handle it):', toggleErr);
                }
            }

            await pointsApi.deleteReward(platform, String(reward.id));
            toast.success('Награда удалена');
            onRefresh();
        } catch (err) {
            logger.error('Error deleting reward:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка удаления награды';
            toast.error(errorMessage);
        } finally {
            setDeleting(false);
            setDeleteConfirmOpen(false);
        }
    };

    const handleToggle = async (): Promise<void> => {
        if (platform !== 'vk') return;

        setToggling(true);
        const newState = !reward.is_enabled;

        try {
            await pointsApi.toggleReward(platform, String(reward.id), newState);
            await onRefresh();
        } catch (err: unknown) {
            logger.error('Error toggling reward:', err);
        } finally {
            setToggling(false);
        }
    };

    const bgColor = reward.background_color || (platform === 'vk' ? PLATFORM_COLORS.VK_LIVE : PLATFORM_COLORS.TWITCH);

    return (
        <>
        <Card className={`${SURFACE_CARD_CLASS} transition-all hover:ring-2 hover:ring-primary/30`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-1 line-clamp-2">{reward.title || reward.name}</h3>
                        {platform === 'vk' && (
                            <Badge variant={reward.is_enabled ? 'default' : 'secondary'} className="text-xs">
                                {reward.is_enabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </Badge>
                        )}
                    </div>
                    <div
                        className="font-mono text-xl font-extrabold flex-shrink-0 px-4 py-2 rounded-lg"
                        style={{
                            backgroundColor: `${bgColor}25`,
                            color: bgColor,
                        }}
                    >
                        {reward.cost || reward.price || 0}
                    </div>
                </div>

                {reward.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{reward.description}</p>
                )}

                <div className="flex gap-2 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 h-9">
                        <Edit className="w-4 h-4 mr-2" />
                        Изменить
                    </Button>

                    {platform === 'vk' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggle}
                            disabled={toggling}
                            className="flex-1 h-9"
                        >
                            {toggling ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : reward.is_enabled ? (
                                <>
                                    <PowerOff className="w-4 h-4 mr-2" />
                                    Выкл
                                </>
                            ) : (
                                <>
                                    <Power className="w-4 h-4 mr-2" />
                                    Вкл
                                </>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-shrink-0 h-9 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
        <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="Удалить награду"
            description="Награда будет удалена с выбранной платформы."
            confirmLabel="Удалить"
            variant="destructive"
            loading={deleting}
            onConfirm={confirmDelete}
        />
        </>
    );
};

// Типы для API ответов
interface RewardsResponse {
    rewards?: PlatformReward[];
    capability?: RewardCapability;
}

interface DemandsResponse {
    demands?:
        | RewardDemand[]
        | {
              items?: RewardDemand[];
              demands?: RewardDemand[];
              [key: string]: unknown;
          };
}

interface RewardCapability {
    can_create: boolean;
    platform: 'twitch' | 'vk';
    reason?: string | null;
    required_role?: string | null;
}

const disabledRewardCapability = (platform: 'twitch' | 'vk', reason: string): RewardCapability => ({
    can_create: false,
    platform,
    reason,
});

const enabledRewardCapability = (platform: 'twitch' | 'vk'): RewardCapability => ({
    can_create: true,
    platform,
    reason: null,
});

const normalizeCapabilityReason = (platform: 'twitch' | 'vk', error: { message?: string; status?: number }): string => {
    const message = error.message?.trim();

    if (message) {
        return message;
    }

    if (error.status === 404) {
        return platform === 'vk'
            ? 'Подключите VK Live, чтобы управлять наградами и очередью запросов.'
            : 'Подключите Twitch, чтобы управлять наградами канала.';
    }

    if (platform === 'twitch' && error.status === 403) {
        return 'Twitch разрешает создавать награды только для каналов со статусом Affiliate или Partner.';
    }

    if (platform === 'vk' && error.status === 403) {
        return 'У токена VK Live не хватает прав для управления наградами. Переавторизуйте интеграцию VK Live.';
    }

    return 'Не удалось получить доступ к наградам платформы. Попробуйте снова чуть позже.';
};

const RedemptionQueue: React.FC<RedemptionQueueProps> = ({ platform }) => {
    const [redemptions, setRedemptions] = useState<RewardDemand[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<Set<string>>(new Set());
    const [rewardsMap, setRewardsMap] = useState<Map<string, PlatformReward>>(new Map());
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<'all' | 'tts' | 'other'>('all');

    const loadRedemptions = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            setLoadError(null);
            if (platform === 'vk') {
                const rewardsData = (await pointsApi.getRewards('vk')) as RewardsResponse;
                const map = new Map<string, PlatformReward>();
                if (rewardsData.rewards) {
                    rewardsData.rewards.forEach((reward: PlatformReward) => {
                        map.set(String(reward.id), reward);
                    });
                }
                setRewardsMap(map);

                const data = (await pointsApi.getVKDemands()) as DemandsResponse;

                let demands: RewardDemand[] = [];
                if (Array.isArray(data.demands)) {
                    demands = data.demands;
                } else if (data.demands && typeof data.demands === 'object') {
                    const demandsObj = data.demands as { items?: RewardDemand[]; demands?: RewardDemand[] };
                    if (demandsObj.items && Array.isArray(demandsObj.items)) {
                        demands = demandsObj.items;
                    } else if (demandsObj.demands && Array.isArray(demandsObj.demands)) {
                        demands = demandsObj.demands;
                    } else {
                        const values = Object.values(data.demands);
                        if (values.length === 1 && Array.isArray(values[0])) {
                            demands = values[0] as RewardDemand[];
                        } else {
                            demands = values as RewardDemand[];
                        }
                    }
                }

                setRedemptions(demands);
            } else {
                setRedemptions([]);
            }
        } catch (err) {
            logger.error('Error loading redemptions:', err);
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : 'Не удалось загрузить очередь наград. Попробуйте снова чуть позже.';
            setLoadError(message);
            toast.error(message);
            setRedemptions([]);
        } finally {
            setLoading(false);
        }
    }, [platform]);

    useEffect(() => {
        loadRedemptions();
    }, [loadRedemptions]);

    const handleAccept = async (redemptionId: string): Promise<void> => {
        setProcessing((prev) => new Set(prev).add(redemptionId));
        try {
            await pointsApi.processVKDemands('accept', [redemptionId]);
            toast.success('Награда принята');
            setRedemptions((prev) => prev.filter((d) => d.id !== redemptionId));
            setSelectedItems((prev) => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        } catch (err: unknown) {
            logger.error('Error accepting redemption:', err);
            toast.error('Ошибка принятия награды');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        }
    };

    const handleReject = async (redemptionId: string): Promise<void> => {
        setProcessing((prev) => new Set(prev).add(redemptionId));
        try {
            await pointsApi.processVKDemands('reject', [redemptionId]);
            toast.success('Награда отклонена');
            setRedemptions((prev) => prev.filter((d) => d.id !== redemptionId));
            setSelectedItems((prev) => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        } catch (err: unknown) {
            logger.error('Error rejecting redemption:', err);
            toast.error('Ошибка отклонения награды');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(redemptionId);
                return next;
            });
        }
    };

    const handleBulkAccept = async (): Promise<void> => {
        if (selectedItems.size === 0) return;

        const ids = Array.from(selectedItems);
        setProcessing((prev) => new Set([...prev, ...ids]));
        try {
            await pointsApi.processVKDemands('accept', ids);
            toast.success(`Принято наград: ${ids.length}`);
            setRedemptions((prev) => prev.filter((d) => !ids.includes(d.id)));
            setSelectedItems(new Set());
        } catch (err: unknown) {
            logger.error('Error bulk accepting:', err);
            toast.error('Ошибка принятия наград');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        }
    };

    const handleBulkReject = async (): Promise<void> => {
        if (selectedItems.size === 0) return;

        const ids = Array.from(selectedItems);
        setProcessing((prev) => new Set([...prev, ...ids]));
        try {
            await pointsApi.processVKDemands('reject', ids);
            toast.success(`Отклонено наград: ${ids.length}`);
            setRedemptions((prev) => prev.filter((d) => !ids.includes(d.id)));
            setSelectedItems(new Set());
        } catch (err: unknown) {
            logger.error('Error bulk rejecting:', err);
            toast.error('Ошибка отклонения наград');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        }
    };

    const filteredRedemptions = redemptions.filter((demand) => {
        if (filterType === 'all') return true;

        const rewardData = rewardsMap.get(demand.reward?.id || '');
        const rewardTitle = (rewardData?.name || rewardData?.title || '').toLowerCase();

        if (filterType === 'tts') {
            return rewardTitle.includes('голос') || rewardTitle.includes('tts') || rewardTitle.includes('озвучка');
        } else {
            return !rewardTitle.includes('голос') && !rewardTitle.includes('tts') && !rewardTitle.includes('озвучка');
        }
    });

    if (loading) {
        return (
            <div className="flex justify-center py-12 min-h-[min(400px,60vh)]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (redemptions.length === 0) {
        return (
            <div className="min-h-[min(400px,60vh)]">
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="py-12 text-center">
                        <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                            {loadError ? 'Очередь наград сейчас недоступна' : 'Нет активных запросов'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {loadError
                                ? loadError
                                : 'Когда зрители активируют награды, они появятся здесь'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[min(400px,60vh)] space-y-4">
            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Фильтр:</Label>
                                <Select
                                    value={filterType}
                                    onValueChange={(value) => setFilterType(value as 'all' | 'tts' | 'other')}
                                >
                                    <SelectTrigger className={`w-[clamp(140px,25vw,200px)] ${CONTROL_TRIGGER_CLASS}`}>
                                        <SelectValue placeholder="Выберите фильтр" />
                                    </SelectTrigger>
                                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                                        <SelectItem value="all">Все награды</SelectItem>
                                        <SelectItem value="tts">TTS награды</SelectItem>
                                        <SelectItem value="other">Прочие</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {filteredRedemptions.length > 0 && (
                                <>
                                    <div className="h-6 w-px bg-border" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                                            Найдено:{' '}
                                            <span className="font-semibold text-foreground">
                                                {filteredRedemptions.length}
                                            </span>
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                const allSelected = filteredRedemptions.every((d) =>
                                                    selectedItems.has(d.id)
                                                );
                                                if (allSelected) {
                                                    setSelectedItems(new Set());
                                                } else {
                                                    setSelectedItems(new Set(filteredRedemptions.map((d) => d.id)));
                                                }
                                            }}
                                            className="whitespace-nowrap"
                                        >
                                            {filteredRedemptions.every((d) => selectedItems.has(d.id))
                                                ? 'Снять все'
                                                : 'Выбрать все'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                                    <span className="text-sm font-medium text-primary">
                                        Выбрано: {selectedItems.size}
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={handleBulkAccept}
                                    disabled={Array.from(selectedItems).some((id) => processing.has(id))}
                                    className="whitespace-nowrap bg-none bg-primary hover:bg-primary/90 shadow-none"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    Принять ({selectedItems.size})
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleBulkReject}
                                    disabled={Array.from(selectedItems).some((id) => processing.has(id))}
                                    className="whitespace-nowrap"
                                >
                                    <XCircle className="w-4 h-4 mr-1.5" />
                                    Отклонить ({selectedItems.size})
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {Array.isArray(filteredRedemptions) && filteredRedemptions.length === 0 ? (
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="py-12 text-center">
                        <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">Нет запросов по выбранному фильтру</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 gap-3 min-[1280px]:gap-4">
                    {filteredRedemptions.map((demand, index) => {
                        const rewardData = rewardsMap.get(demand.reward?.id || '');
                        const rewardTitle = rewardData?.name || rewardData?.title || 'Неизвестная награда';
                        const rewardCost = rewardData?.price || rewardData?.cost || 0;
                        const isTtsReward =
                            rewardTitle.toLowerCase().includes('голос') ||
                            rewardTitle.toLowerCase().includes('tts') ||
                            rewardTitle.toLowerCase().includes('озвучка');

                        let message = '';
                        if (Array.isArray(demand.message_parts) && demand.message_parts.length > 0) {
                            message = demand.message_parts
                                .map((part) => {
                                    if (typeof part === 'string') return part;
                                    if (typeof part === 'object' && part !== null) {
                                        const p = part as {
                                            text?: { content: string };
                                            mention?: { nick: string };
                                            link?: { content: string };
                                            smile?: { name: string };
                                            content?: string;
                                        };
                                        if (p.text?.content) return p.text.content;
                                        if (p.mention?.nick) return `@${p.mention.nick}`;
                                        if (p.link?.content) return p.link.content;
                                        if (p.smile?.name) return p.smile.name;
                                        if (p.content) return p.content;
                                        return JSON.stringify(part);
                                    }
                                    return String(part);
                                })
                                .join(' ')
                                .trim();
                        } else if (typeof demand.message === 'string') {
                            message = demand.message;
                        } else if (demand.message && typeof demand.message === 'object') {
                            const msg = demand.message as { text?: string; content?: string };
                            message = msg.text || msg.content || JSON.stringify(demand.message);
                        }

                        const isSelected = selectedItems.has(demand.id);
                        const isProcessing = processing.has(demand.id);
                        const userName = demand.user?.nick || demand.user?.name || 'Пользователь';
                        const timestamp = demand.created_at
                            ? formatAppDateTime(
                                  typeof demand.created_at === 'number'
                                      ? demand.created_at * 1000
                                      : demand.created_at,
                                  {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                  }
                              )
                            : 'Неизвестно';

                        return (
                            <Card
                                key={demand.id || index}
                                className={`${SURFACE_CARD_CLASS} transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-primary/40 border-primary/50' : 'border-border/50'} ${isProcessing ? 'opacity-60' : ''}`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    setSelectedItems((prev) => {
                                                        const next = new Set(prev);
                                                        if (e.target.checked) {
                                                            next.add(demand.id);
                                                        } else {
                                                            next.delete(demand.id);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                disabled={isProcessing}
                                                className="w-4 h-4 rounded border-border bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-primary"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                                                            <span className="text-xs font-bold text-primary">
                                                                {(userName[0] || 'U').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span className="font-semibold text-sm truncate">
                                                            {userName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                <Badge
                                                    variant={isTtsReward ? 'default' : 'outline'}
                                                    className={`text-xs font-medium ${isTtsReward ? 'bg-purple-600/20 text-purple-300 border-purple-600/30' : 'bg-muted/50'}`}
                                                >
                                                    {rewardTitle}
                                                </Badge>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs font-mono bg-blue-600/20 text-blue-300 border-blue-600/30"
                                                >
                                                    {rewardCost} баллов
                                                </Badge>
                                            </div>

                                            {message && (
                                                <div className="mb-3 p-3 rounded-md bg-muted/50 border border-border/50">
                                                    <div className="flex items-start gap-2">
                                                        <MessageCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                        <p className="text-sm text-foreground break-words flex-1 leading-relaxed">
                                                            {message}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{timestamp}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 flex-shrink-0">
                                            <Button
                                                size="sm"
                                                variant="default"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAccept(demand.id);
                                                }}
                                                disabled={isProcessing}
                                                className="min-w-[clamp(92px,18vw,120px)] h-9 bg-none bg-primary hover:bg-primary/90 shadow-none"
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                        Принять
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReject(demand.id);
                                                }}
                                                disabled={isProcessing}
                                                className="min-w-[clamp(92px,18vw,120px)] h-9"
                                            >
                                                <XCircle className="w-4 h-4 mr-1.5" />
                                                Отклонить
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const PointsManagementPage: React.FC = () => {
    // useAuth unused
    const { user } = useAuth();
    const { integrations } = useIntegrations();

    // Если нет прав или не авторизован то сразу return
    const [selectedPlatform, setSelectedPlatform] = useState<'twitch' | 'vk'>(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('points_selected_platform') : null;
        if (stored === 'twitch' || stored === 'vk') {
            return stored;
        }
        return 'twitch';
    });
    const [activeTab, setActiveTab] = useState<'rewards' | 'queue'>('rewards');
    const [rewards, setRewards] = useState<PlatformReward[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
    const [editingReward, setEditingReward] = useState<PlatformReward | null>(null);
    const [rewardCapability, setRewardCapability] = useState<RewardCapability>(
        disabledRewardCapability('twitch', 'Подключите Twitch, чтобы создавать награды')
    );

    const twitchEnabled = integrations?.twitch?.enabled || false;
    const vkEnabled = integrations?.vk?.enabled || false;

    useEffect(() => {
        setSelectedPlatform((prev) => {
            if (prev === 'twitch' && twitchEnabled) return prev;
            if (prev === 'vk' && vkEnabled) return prev;
            if (vkEnabled) return 'vk';
            if (twitchEnabled) return 'twitch';
            return prev;
        });
    }, [twitchEnabled, vkEnabled]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('points_selected_platform', selectedPlatform);
    }, [selectedPlatform]);

    const loadRewards = useCallback(
        async (platform: 'twitch' | 'vk', showLoader: boolean = true): Promise<void> => {
            try {
                if (showLoader) {
                    setLoading(true);
                }
                if (platform === 'twitch' && !twitchEnabled) {
                    setRewards([]);
                    setRewardCapability(
                        disabledRewardCapability(platform, 'Подключите Twitch, чтобы создавать награды')
                    );
                    return;
                }
                if (platform === 'vk' && !vkEnabled) {
                    setRewards([]);
                    setRewardCapability(
                        disabledRewardCapability(platform, 'Подключите VK Live, чтобы создавать награды')
                    );
                    return;
                }
                const data = (await pointsApi.getRewards(platform)) as RewardsResponse;

                const sortedRewards = (data.rewards || []).sort((a: PlatformReward, b: PlatformReward) => {
                    if (a.is_enabled === b.is_enabled) return 0;
                    return a.is_enabled ? -1 : 1;
                });

                setRewards(sortedRewards);
                setRewardCapability(data.capability ?? enabledRewardCapability(platform));
            } catch (err) {
                logger.error('Error loading rewards:', err);
                const apiError = err as { message?: string; status?: number };
                const capabilityReason = normalizeCapabilityReason(platform, apiError);

                if (apiError.status === 404) {
                    setRewardCapability(disabledRewardCapability(platform, capabilityReason));
                } else {
                    setRewardCapability(disabledRewardCapability(platform, capabilityReason));
                    toast.error(capabilityReason, { duration: 5000 });
                }
                setRewards([]);
            } finally {
                if (showLoader) {
                    setLoading(false);
                }
            }
        },
        [twitchEnabled, vkEnabled]
    );

    useEffect(() => {
        void loadRewards(selectedPlatform, true);
    }, [selectedPlatform, loadRewards]);

    const canCreateReward = rewardCapability.platform === selectedPlatform && rewardCapability.can_create;
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Загрузка данных...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6">
            <div className="flex flex-col gap-3 mb-6">
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border" aria-hidden="true" />
                    <div className="hide-scrollbar relative z-10 flex min-w-0 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('rewards')}
                            className={`${TAB_BUTTON_BASE} ${
                                activeTab === 'rewards'
                                    ? TAB_ACTIVE_CLASS
                                    : 'hover:text-sky-300'
                            }`}
                        >
                            Награды
                        </button>
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`${TAB_BUTTON_BASE} ${
                                activeTab === 'queue'
                                    ? TAB_ACTIVE_CLASS
                                    : 'hover:text-sky-300'
                            }`}
                        >
                            Очередь запросов
                        </button>
                    </div>

                    {(twitchEnabled || vkEnabled) && (
                        <div className="hide-scrollbar relative z-10 inline-flex max-w-full items-center gap-3 overflow-x-auto">
                            {twitchEnabled && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlatform('twitch')}
                                    className={cn(
                                        PLATFORM_TAB_BASE,
                                        selectedPlatform === 'twitch'
                                            ? 'text-[#9146FF] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#9146FF]'
                                            : 'hover:text-[#9146FF]'
                                    )}
                                >
                                    <TwitchIcon className="w-3.5 h-3.5" />
                                    Twitch
                                </button>
                            )}
                            {vkEnabled && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlatform('vk')}
                                    className={cn(
                                        PLATFORM_TAB_BASE,
                                        selectedPlatform === 'vk'
                                            ? 'text-[#FF4444] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#FF4444]'
                                            : 'hover:text-[#FF4444]'
                                    )}
                                >
                                    <VKIcon className="w-3.5 h-3.5" />
                                    VK Live
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="min-h-[400px]">
                <div className="mb-6 space-y-2">
                    {activeTab === 'rewards' && (
                        <>
                            <Button
                                disabled={!canCreateReward}
                                onClick={() => {
                                    if (canCreateReward) {
                                        setShowCreateDialog(true);
                                    }
                                }}
                                className="w-full h-10"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Создать награду
                            </Button>
                        </>
                    )}
                </div>

                <div>
                    {activeTab === 'rewards' ? (
                        <div>
                            {rewards.length === 0 ? (
                                <Card className={SURFACE_CARD_CLASS}>
                                    <CardContent className="grid min-h-52 place-items-center px-5 py-10 text-center">
                                        {canCreateReward ? (
                                            <Button
                                                onClick={() => setShowCreateDialog(true)}
                                                size="sm"
                                                variant="outline"
                                                className="gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Первая награда
                                            </Button>
                                        ) : (
                                            <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-sm text-muted-foreground">
                                                <Gift className="h-12 w-12 text-muted-foreground/30" strokeWidth={1.5} />
                                                {rewardCapability.reason ? <p>{rewardCapability.reason}</p> : null}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 min-[1280px]:gap-4">
                                    {rewards.map((reward) => (
                                        <RewardCard
                                            key={reward.id}
                                            reward={reward}
                                            platform={selectedPlatform}
                                            onEdit={() => setEditingReward(reward)}
                                            onRefresh={() => loadRewards(selectedPlatform, false)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <RedemptionQueue platform={selectedPlatform} />
                    )}
                </div>
            </div>

            <RewardDialog
                open={showCreateDialog || !!editingReward}
                onClose={() => {
                    setShowCreateDialog(false);
                    setEditingReward(null);
                }}
                reward={editingReward}
                platform={selectedPlatform}
                channelName={
                    selectedPlatform === 'vk'
                        ? user?.vk_channel_name || user?.vk_username || integrations.vk?.username
                        : user?.twitch_username || integrations.twitch?.username
                }
                onSuccess={() => {
                    setShowCreateDialog(false);
                    setEditingReward(null);
                    loadRewards(selectedPlatform, false);
                }}
            />
        </div>
    );
};

export default PointsManagementPage;
