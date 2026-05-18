import React, { useEffect, useState } from 'react';

import { AlertTriangle, Edit, Gift, Loader2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';

import { useIntegrations } from '@/context/IntegrationsContext';
import {
    useCreatePlatformReward,
    useDeletePlatformReward,
    usePlatformRewards,
    useTogglePlatformReward,
    useUpdatePlatformReward,
} from '@/queries/points/pointsQueries';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from '@/utils/toastManager';

interface PointsRewardsProps {
    user: Record<string, unknown>;
    platform?: string;
    channelName: string;
    integrations?: {
        twitch?: { enabled?: boolean; connected?: boolean };
        vk?: { enabled?: boolean; connected?: boolean };
    };
}

interface Reward {
    id: string;
    title: string;
    description?: string;
    cost: number;
    is_enabled: boolean;
    is_user_input_required?: boolean;
    global_cooldown_seconds?: number;
    max_per_stream?: number;
    max_per_user_per_stream?: number;
    should_redemptions_skip_request_queue?: boolean;
    repair_timeout?: number;
    max_uses_count?: number;
    max_uses_count_per_user?: number;
    is_message_required?: boolean;
}

interface FormData {
    title: string;
    description: string;
    cost: number;
    is_user_input_required: boolean;
    global_cooldown_seconds: number;
    max_per_stream: number;
    max_per_user_per_stream: number;
    should_redemptions_skip_request_queue: boolean;
    repair_timeout: number;
    max_uses_count: number;
    max_uses_count_per_user: number;
    is_message_required: boolean;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';

const PointsRewards: React.FC<PointsRewardsProps> = ({ user, platform, channelName, integrations }) => {
    const { integrations: integrationsContext } = useIntegrations();
    const actualIntegrations = integrations || integrationsContext;
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [rewardToDelete, setRewardToDelete] = useState<string | null>(null);
    const [partnerRequired, setPartnerRequired] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({
        title: '',
        description: '',
        cost: 100,
        is_user_input_required: false,
        global_cooldown_seconds: 0,
        max_per_stream: 0,
        max_per_user_per_stream: 0,
        should_redemptions_skip_request_queue: false,
        repair_timeout: 0,
        max_uses_count: 0,
        max_uses_count_per_user: 0,
        is_message_required: false,
    });

    // Определяем доступные платформы
    const twitchAvailable = !!(actualIntegrations?.twitch?.enabled && user?.twitch_username);
    const vkAvailable = !!(actualIntegrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name));

    // [OK] SIMPLIFICATION: auto-select platform with Twitch -> VK priority
    useEffect(() => {
        if (!selectedPlatform) {
            if (platform) {
                setSelectedPlatform(platform);
            } else if (twitchAvailable) {
                setSelectedPlatform('twitch');
            } else if (vkAvailable) {
                setSelectedPlatform('vk');
            }
        }
    }, [platform, twitchAvailable, vkAvailable, selectedPlatform]);

    // React Query hooks
    const {
        data: rewardsData,
        isLoading: loading,
        isError,
        error: rewardsError,
        refetch,
    } = usePlatformRewards(selectedPlatform || '', {
        enabled: !!user && !!selectedPlatform && !!channelName,
    });

    // Обработка ошибок
    useEffect(() => {
        if (isError && rewardsError) {
            const error = rewardsError as {
                response?: { status?: number; data?: { detail?: string; message?: string } };
            };
            // [OK] Обработка 403 - партнер/аффилиат требуется
            if (error.response?.status === 403) {
                const detail = error.response?.data?.detail || error.response?.data?.message;
                if (
                    detail &&
                    (detail.includes('партнёр') ||
                        detail.includes('аффилейт') ||
                        detail.includes('partner') ||
                        detail.includes('affiliate'))
                ) {
                    setPartnerRequired(true);
                    setErrorMessage(detail);
                    return;
                }
            }

            // Для других ошибок (кроме 404)
            if (error.response?.status !== 404) {
                const detail = error.response?.data?.detail || error.response?.data?.message;
                setErrorMessage(detail || 'Ошибка загрузки наград');
            }
        } else if (rewardsData && !isError) {
            setPartnerRequired(false);
            setErrorMessage(null);
        }
    }, [isError, rewardsError, rewardsData]);

    const rewards: Reward[] = (rewardsData as { data?: { rewards?: Reward[] } })?.data?.rewards || [];

    const createRewardMutation = useCreatePlatformReward(selectedPlatform || '', {
        onSuccess: () => {
            setShowDialog(false);
            resetForm();
        },
    });

    const updateRewardMutation = useUpdatePlatformReward(selectedPlatform || '', {
        onSuccess: () => {
            setShowDialog(false);
            resetForm();
        },
    });

    const deleteRewardMutation = useDeletePlatformReward(selectedPlatform || '');
    const toggleRewardMutation = useTogglePlatformReward(selectedPlatform || '');

    const handleSave = () => {
        if (!formData.title.trim()) {
            toast.error('Введите название награды');
            return;
        }

        if (!selectedPlatform) {
            toast.error('Платформа не выбрана');
            return;
        }

        const rewardData: Record<string, unknown> = {
            title: formData.title,
            description: formData.description,
            cost: parseInt(formData.cost.toString()) || 100,
            is_user_input_required: formData.is_user_input_required,
            platform: selectedPlatform,
            channel_name: channelName,
        };

        // Добавляем платформо-специфичные поля
        if (selectedPlatform === 'twitch') {
            rewardData.global_cooldown_seconds = parseInt(formData.global_cooldown_seconds.toString()) || 0;
            rewardData.max_per_stream = parseInt(formData.max_per_stream.toString()) || 0;
            rewardData.max_per_user_per_stream = parseInt(formData.max_per_user_per_stream.toString()) || 0;
            rewardData.should_redemptions_skip_request_queue = formData.should_redemptions_skip_request_queue;
        } else if (selectedPlatform === 'vk') {
            rewardData.repair_timeout = parseInt(formData.repair_timeout.toString()) || 0;
            rewardData.max_uses_count = parseInt(formData.max_uses_count.toString()) || 0;
            rewardData.max_uses_count_per_user = parseInt(formData.max_uses_count_per_user.toString()) || 0;
            rewardData.is_message_required = formData.is_message_required;
        }

        if (editingReward) {
            updateRewardMutation.mutate({ rewardId: editingReward.id, reward: rewardData });
        } else {
            createRewardMutation.mutate(rewardData);
        }
    };

    const handleDelete = (rewardId: string) => {
        setRewardToDelete(rewardId);
    };

    const confirmDeleteReward = (): void => {
        if (!rewardToDelete) return;
        deleteRewardMutation.mutate(rewardToDelete);
        setRewardToDelete(null);
    };

    const handleToggle = (rewardId: string, enabled: boolean) => {
        toggleRewardMutation.mutate({ rewardId, isEnabled: !enabled });
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            cost: 100,
            is_user_input_required: false,
            global_cooldown_seconds: 0,
            max_per_stream: 0,
            max_per_user_per_stream: 0,
            should_redemptions_skip_request_queue: false,
            repair_timeout: 0,
            max_uses_count: 0,
            max_uses_count_per_user: 0,
            is_message_required: false,
        });
        setEditingReward(null);
    };

    const handleOpenDialog = (reward: Reward | null = null) => {
        if (reward) {
            setEditingReward(reward);
            setFormData({
                title: reward.title || '',
                description: reward.description || '',
                cost: reward.cost || 100,
                is_user_input_required: reward.is_user_input_required || false,
                global_cooldown_seconds: reward.global_cooldown_seconds || 0,
                max_per_stream: reward.max_per_stream || 0,
                max_per_user_per_stream: reward.max_per_user_per_stream || 0,
                should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue || false,
                repair_timeout: reward.repair_timeout || 0,
                max_uses_count: reward.max_uses_count || 0,
                max_uses_count_per_user: reward.max_uses_count_per_user || 0,
                is_message_required: reward.is_message_required || false,
            });
        } else {
            resetForm();
        }
        setShowDialog(true);
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        resetForm();
    };

    // Проверка интеграций
    const hasAnyIntegration = twitchAvailable || vkAvailable;

    if (!hasAnyIntegration) {
        return (
            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="p-8">
                    <div className="text-center py-8 text-muted-foreground">
                        <h3 className="text-lg font-semibold mb-2">Интеграция не подключена</h3>
                        <p className="text-sm break-words">
                            Подключите Twitch или VK в настройках, чтобы создавать награды.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const selectedPlatformLabel = selectedPlatform === 'vk' ? 'VK Live' : 'Twitch';

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {twitchAvailable && vkAvailable && (
                    <div className="grid grid-cols-2 rounded-xl border border-border/70 bg-card/70 p-1">
                        <button
                            type="button"
                            onClick={() => setSelectedPlatform('twitch')}
                            className={`h-8 rounded-lg px-4 text-xs font-bold transition-colors ${
                                selectedPlatform === 'twitch'
                                    ? 'bg-[#9146FF] text-white'
                                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                            }`}
                        >
                            Twitch
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedPlatform('vk')}
                            className={`h-8 rounded-lg px-4 text-xs font-bold transition-colors ${
                                selectedPlatform === 'vk'
                                    ? 'bg-[#FF4444] text-white'
                                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                            }`}
                        >
                            VK Live
                        </button>
                    </div>
                )}
                <Button
                    onClick={() => handleOpenDialog()}
                    className="h-10 flex-1 gap-2 bg-blue-700 text-white hover:bg-blue-600 disabled:bg-blue-950/50 disabled:text-muted-foreground"
                    disabled={partnerRequired}
                >
                    <Plus className="h-4 w-4" />
                    Создать награду
                </Button>
            </div>

            {partnerRequired && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={1.8} />
                        <span className="truncate text-sm font-bold text-amber-100">{selectedPlatformLabel}</span>
                    </div>
                    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100" variant="outline">
                        Нужен Affiliate или Partner
                    </Badge>
                </div>
            )}

            <Card className={SURFACE_CARD_CLASS}>
                <CardContent className="p-3">
                    {loading ? (
                        <div className="grid min-h-40 place-items-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : partnerRequired ? (
                        <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border/60 bg-background/25">
                            <Gift className="h-10 w-10 text-muted-foreground/35" strokeWidth={1.5} />
                        </div>
                    ) : errorMessage && !partnerRequired ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                            <span className="min-w-0 truncate text-sm text-red-200">{errorMessage}</span>
                            <Button onClick={() => refetch()} size="sm" variant="outline" className="shrink-0">
                                Повторить
                            </Button>
                        </div>
                    ) : rewards.length === 0 ? (
                        <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border/60 bg-background/25">
                            <Button onClick={() => handleOpenDialog()} size="sm" variant="outline" className="gap-2">
                                <Plus className="h-4 w-4" />
                                Первая награда
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rewards.map((reward) => (
                                <div
                                    key={reward.id}
                                    className="flex items-center gap-3 p-3 border border-border/70 rounded-lg bg-card/60 hover:bg-card/70 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-medium break-words">{reward.title}</h4>
                                            {!reward.is_enabled && (
                                                <Badge variant="outline" className="text-xs">
                                                    Отключено
                                                </Badge>
                                            )}
                                            <Badge variant="secondary" className="text-xs">
                                                {reward.cost} баллов
                                            </Badge>
                                        </div>
                                        {reward.description && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                                                {reward.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggle(reward.id, reward.is_enabled)}
                                        >
                                            {reward.is_enabled ? (
                                                <Power className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <PowerOff className="w-4 h-4 text-gray-500" />
                                            )}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(reward)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(reward.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Диалог создания/редактирования */}
            <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto border-border/70 bg-[#0b0712] ring-1 ring-white/10">
                    <DialogHeader>
                        <DialogTitle>{editingReward ? 'Редактировать награду' : 'Создать награду'}</DialogTitle>
                        <DialogDescription>
                            {selectedPlatform
                                ? `Награда будет создана на ${selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}`
                                : 'Создание награды за баллы'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Название */}
                        <div className="space-y-2">
                            <Label>Название награды *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Например: Крутка обычного сундука"
                            />
                        </div>

                        {/* Описание */}
                        <div className="space-y-2">
                            <Label>Описание</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Описание награды"
                                rows={3}
                            />
                        </div>

                        {/* Стоимость */}
                        <div className="space-y-2">
                            <Label>Стоимость (баллы) *</Label>
                            <Input
                                type="number"
                                value={formData.cost}
                                onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })}
                                min={1}
                            />
                        </div>

                        {/* Требуется ввод от пользователя */}
                        <div className="flex items-center justify-between p-3 border border-border/70 bg-card/60 rounded-lg">
                            <div>
                                <Label>Требуется ввод от пользователя</Label>
                                <p className="text-xs text-muted-foreground">
                                    Зритель должен ввести сообщение при покупке награды
                                </p>
                            </div>
                            <Switch
                                checked={formData.is_user_input_required}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, is_user_input_required: checked })
                                }
                            />
                        </div>

                        {/* Платформо-специфичные настройки */}
                        {selectedPlatform === 'twitch' && (
                            <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium text-sm">Настройки Twitch</h4>

                                <div className="space-y-2">
                                    <Label>Глобальный кулдаун (секунды)</Label>
                                    <Input
                                        type="number"
                                        value={formData.global_cooldown_seconds}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                global_cooldown_seconds: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        min={0}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Макс. использований за стрим (0 = без ограничений)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_per_stream}
                                        onChange={(e) =>
                                            setFormData({ ...formData, max_per_stream: parseInt(e.target.value) || 0 })
                                        }
                                        min={0}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Макс. использований на пользователя за стрим (0 = без ограничений)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_per_user_per_stream}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                max_per_user_per_stream: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        min={0}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 border border-border/70 bg-card/60 rounded-lg">
                                    <div>
                                        <Label>Автоматически выполнять (пропустить очередь)</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Награда будет выполнена автоматически без модерации
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.should_redemptions_skip_request_queue}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, should_redemptions_skip_request_queue: checked })
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {selectedPlatform === 'vk' && (
                            <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium text-sm">Настройки VK Live</h4>

                                <div className="space-y-2">
                                    <Label>Таймаут ремонта (секунды)</Label>
                                    <Input
                                        type="number"
                                        value={formData.repair_timeout}
                                        onChange={(e) =>
                                            setFormData({ ...formData, repair_timeout: parseInt(e.target.value) || 0 })
                                        }
                                        min={0}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Макс. использований (0 = без ограничений)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_uses_count}
                                        onChange={(e) =>
                                            setFormData({ ...formData, max_uses_count: parseInt(e.target.value) || 0 })
                                        }
                                        min={0}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Макс. использований на пользователя (0 = без ограничений)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_uses_count_per_user}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                max_uses_count_per_user: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        min={0}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>
                            Отмена
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={createRewardMutation.isPending || updateRewardMutation.isPending}
                        >
                            {createRewardMutation.isPending || updateRewardMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : editingReward ? (
                                'Сохранить'
                            ) : (
                                'Создать'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={rewardToDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setRewardToDelete(null);
                }}
                title="Удалить награду"
                description="Награда будет удалена с выбранной платформы."
                confirmLabel="Удалить"
                variant="destructive"
                loading={deleteRewardMutation.isPending}
                onConfirm={confirmDeleteReward}
            />
        </div>
    );
};

export default PointsRewards;
