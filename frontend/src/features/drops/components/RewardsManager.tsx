import React, { useCallback, useEffect, useMemo, useState } from 'react';

/* eslint-disable no-alert */
import {
  Edit,
  Loader2,
  Music,
  Plus,
  Power,
  Save,
  Trash2
} from 'lucide-react';

import {
  useCreateDropsReward,
  useDeleteDropsReward,
  useDropsQualities,
  useDropsRewards,
  useToggleDropsReward,
  useUpdateDropsReward,
} from '@/queries/drops/dropsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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
  {
    id: 1,
    name: 'Common',
    color: '#6B7280',
    label: 'Обычный',
    image: CommonClosed
  },
  {
    id: 2,
    name: 'Rare',
    color: '#3B82F6',
    label: 'Редкий',
    image: RareClosed
  },
  {
    id: 3,
    name: 'Epic',
    color: '#8B5CF6',
    label: 'Эпический',
    image: EpicClosed
  },
  {
    id: 4,
    name: 'Legendary',
    color: '#F59E0B',
    label: 'Легендарный',
    image: LegendaryClosed
  },
  {
    id: 5,
    name: 'Mythical',
    color: '#EF4444',
    label: 'Мифический',
    image: MythicalClosed
  }
];

interface Reward {
  id: string | number;
  name: string;
  description?: string;
  quality?: 'common' | 'rare' | 'epic' | 'legendary' | 'mythical' | {
    id?: number;
    name?: string;
  } | number;
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
  weight: number[];
  reward_type: string;
  reward_value: string;
  image_url?: string;
  sound_volume: number[];
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

const SURFACE_CARD_CLASS = 'border-slate-800 bg-slate-950/70 backdrop-blur-sm shadow-md shadow-black/20';
const CONTROL_TRIGGER_CLASS = 'h-9 border-slate-700 bg-slate-900/80 shadow-none';
const CONTROL_CONTENT_CLASS = 'border-slate-700 bg-slate-950/95 backdrop-blur-sm';
const MAX_REWARD_WEIGHT = 2000;

const RewardsManager: React.FC<RewardsManagerProps> = React.memo(({ user, channelName, onRewardsCountChange, integrations }) => {
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  // [OK] OPTIMIZATION: Memoize platform availability checks
  const twitchAvailable = useMemo(() =>
    !!(integrations?.twitch?.enabled && user?.twitch_username),
    [integrations?.twitch?.enabled, user?.twitch_username]
  );
  const vkAvailable = useMemo(() =>
    !!(integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name)),
    [integrations?.vk?.enabled, user?.vk_username, user?.vk_channel_name]
  );

  // Определяем доступные платформы для выбора
  const availablePlatforms: { value: string; label: string }[] = [];
  if (twitchAvailable) availablePlatforms.push({ value: 'twitch', label: 'Twitch' });
  if (vkAvailable) availablePlatforms.push({ value: 'vk', label: 'VK Live' });

  const [rewardForm, setRewardForm] = useState<RewardForm>({
    name: '',
    description: '',
    quality_id: null,
    weight: [100],
    reward_type: 'custom',
    reward_value: '',
    sound_volume: [1.0],
    is_active: true,
    platform: availablePlatforms.length > 0 ? availablePlatforms[0].value : 'twitch' // Выбранная платформа для новой награды
  });

  const { data: qualitiesData = [] } = useDropsQualities();

  const { data: allRewardsData = [] } = useDropsRewards(channelName);

  // Фильтр по платформе для отображения
  const [platformFilter] = useState<string>('all'); // 'all', 'twitch', 'vk'

  const createRewardMutation = useCreateDropsReward(channelName, {
    onSuccess: () => {
      setRewardDialogOpen(false);
    }
  });
  const updateRewardMutation = useUpdateDropsReward(channelName, {
    onSuccess: () => {
      setRewardDialogOpen(false);
    }
  });
  const deleteRewardMutation = useDeleteDropsReward(channelName);
  const toggleRewardMutation = useToggleDropsReward(channelName);

  // Фильтруем награды по выбранной платформе
  const rewards = React.useMemo(() => {
    const allRewards = (Array.isArray(allRewardsData) ? allRewardsData : []) as Reward[];
    if (!allRewards) return [];
    if (platformFilter === 'all') return allRewards;
    return allRewards.filter(r => (r.platform || 'twitch') === platformFilter);
  }, [allRewardsData, platformFilter]);

  // Уведомляем родителя об изменении количества наград
  useEffect(() => {
    if (onRewardsCountChange && rewards) {
      onRewardsCountChange(rewards.length);
    }
  }, [rewards, onRewardsCountChange]);

  const handleOpenRewardDialog = (qualityId: number | null = null) => {
    setEditingReward(null);
    // Если qualityId не передан, берем первый из БД
    const defaultQualityId = qualityId ?? (Array.isArray(qualitiesData) && qualitiesData.length > 0 ? (qualitiesData[0] as { id?: number })?.id ?? null : null);
    setRewardForm({
      name: '',
      description: '',
      quality_id: defaultQualityId,
      weight: [100],
      reward_type: 'custom',
      reward_value: '',
      image_url: '',
      sound_volume: [1.0],
      is_active: true,
      platform: availablePlatforms.length > 0 ? availablePlatforms[0].value : 'twitch' // Выбираем первую доступную платформу
    });
    setRewardDialogOpen(true);
  };

  const handleEditReward = (reward: Reward) => {
    setEditingReward(reward);
    // Используем реальный ID из БД
    const qualityId = typeof reward.quality === 'object'
      ? (reward.quality?.id || null)
      : (typeof reward.quality === 'number' ? reward.quality : null);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      quality_id: qualityId,
      weight: [reward.weight ?? 100],
      reward_type: reward.reward_type || 'custom',
      reward_value: reward.reward_value || '',
      image_url: reward.image_url || '',
      sound_volume: [reward.sound_volume || 1.0],
      is_active: reward.is_active !== undefined ? reward.is_active : true,
      platform: reward.platform || 'twitch'
    });
    setRewardDialogOpen(true);
  };


  const handleSaveReward = async () => {
    if (!rewardForm.name) {
      toast.error('Укажите название награды');
      return;
    }

    if (!rewardForm.quality_id) {
      toast.error('Выберите качество сундука');
      return;
    }

    const payload: Partial<DropsReward> = {
      name: rewardForm.name,
      description: rewardForm.description || undefined,
      quality_id: rewardForm.quality_id,
      weight: rewardForm.weight[0],
      reward_type: 'custom', // Всегда custom
      reward_value: '', // Пустое значение
      image_url: (rewardForm.image_url && rewardForm.image_url.trim()) || undefined,
      sound_volume: rewardForm.sound_volume[0] || 1.0,
      is_active: rewardForm.is_active,
      platform: rewardForm.platform
    } as Partial<DropsReward>;

    if (editingReward) {
      updateRewardMutation.mutate({ rewardId: Number(editingReward.id), reward: payload });
    } else {
      createRewardMutation.mutate(payload);
    }
  };

  const handleDeleteReward = (rewardId: string | number) => {
    if (!confirm('Удалить эту награду?')) return;
    deleteRewardMutation.mutate(Number(rewardId));
  };

  const handleToggleReward = (reward: Reward) => {
    const newIsActive = !reward.is_active;
    toggleRewardMutation.mutate({
      rewardId: Number(reward.id),
      isActive: newIsActive
    });
  };

  const getRewardsForQuality = useCallback((qualityName: string): Reward[] => {
    if (!rewards) return [];
    return rewards.filter(r => {
      if (typeof r.quality === 'object') {
        return r.quality?.name === qualityName;
      }
      return false;
    });
  }, [rewards]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-6 mt-4">
        <Button
          onClick={() => handleOpenRewardDialog(null)}
          variant="outline"
          size="default"
          className="border-slate-700 bg-slate-900/70 hover:bg-slate-800 font-medium gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать награду
        </Button>
      </div>

      {/* Награды по качествам */}
      {QUALITIES.map((qualityItem: QualityConfig) => {
        const { id, name, label, image, color: qualityColor } = qualityItem;
        const qualityRewards = getRewardsForQuality(name);
        const qualityData = Array.isArray(qualitiesData) ? (qualitiesData as unknown as QualityConfig[]).find((q) => q.name === name) : null;

        return (
          <Card key={id} className={SURFACE_CARD_CLASS}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={image}
                  alt={`${label} chest`}
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="whitespace-nowrap" style={{ color: qualityData?.color || qualityColor }}>
                      {label}
                    </span>
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: qualityData?.color || qualityColor }}
                      className="text-white text-xs"
                    >
                      {qualityRewards.length}
                    </Badge>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {qualityRewards.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-orange-500/30 bg-orange-500/5 rounded-lg">
                  <p className="text-sm font-medium text-orange-400">Наград пока нет</p>
                  <p className="text-xs mt-2 text-muted-foreground">Добавьте минимум 1 награду для этого сундука</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {qualityRewards.map((reward) => {
                    return (
                      <div
                        key={reward.id}
                        className="relative flex flex-col p-2.5 border border-slate-800 bg-slate-900/60 rounded-lg hover:bg-slate-900/90 transition-colors group"
                      >
                        {/* Шанс */}
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="secondary" className="text-xs">
                            {reward.weight}
                          </Badge>
                        </div>

                        {/* Изображение */}
                        {reward.image_url && (
                          <div className="w-full aspect-square border border-slate-800 rounded overflow-hidden mb-1.5 bg-slate-950/80">
                            <img
                              src={reward.image_url}
                              alt={reward.name}
                              className="w-full h-full object-cover"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        {/* Название */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5 mb-1 pr-12">
                            <h4 className="text-sm font-medium line-clamp-2 flex-1">{reward.name}</h4>
                            {!reward.is_active && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">Отключено</Badge>
                            )}
                          </div>
                          {reward.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{reward.description}</p>
                          )}
                          {reward.sound_file && (
                            <div className="flex items-center gap-1 mb-1">
                              <Music className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Звук</span>
                            </div>
                          )}
                        </div>

                        {/* Кнопки действий */}
                        <div className="flex gap-1 justify-end w-full pt-1.5 border-t border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditReward(reward)}
                            className="h-7 w-7 p-0"
                            title="Редактировать"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleReward(reward)}
                            className={`h-7 w-7 p-0 ${reward.is_active ? 'text-green-500 hover:text-green-600' : 'text-gray-500 hover:text-gray-600'
                              }`}
                            disabled={toggleRewardMutation.isPending}
                            title={reward.is_active ? 'Деактивировать' : 'Активировать'}
                          >
                            <Power className={`w-3.5 h-3.5 ${reward.is_active ? '' : 'opacity-50'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReward(reward.id)}
                            className="h-7 w-7 p-0 text-destructive"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Диалог создания/редактирования */}
      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'Редактировать награду' : 'Создать награду'}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры награды, которая будет выдаваться зрителям
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
            {/* Название */}
            <div className="space-y-2">
              <Label htmlFor="reward_name">Название награды *</Label>
              <Input
                id="reward_name"
                placeholder="Например: показать анус на стриме"
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              />
            </div>

            {/* Описание */}
            <div className="space-y-2">
              <Label htmlFor="reward_description">Описание</Label>
              <Textarea
                id="reward_description"
                placeholder="Краткое описание награды"
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Качество */}
            <div className="space-y-2">
              <Label htmlFor="reward_quality">Качество сундука *</Label>
              <Select
                value={rewardForm.quality_id?.toString() || ''}
                onValueChange={(value) => setRewardForm({ ...rewardForm, quality_id: parseInt(value) })}
              >
                <SelectTrigger id="reward_quality" className={CONTROL_TRIGGER_CLASS}>
                  <SelectValue placeholder="Выберите качество" />
                </SelectTrigger>
                <SelectContent className={CONTROL_CONTENT_CLASS}>
                  {/* Используем данные из БД если есть, иначе fallback на статические */}
                  {qualitiesData.length > 0 ? (
                    (qualitiesData as unknown as QualityConfig[]).map((q) => {
                      const qName = typeof q.name === 'string' ? q.name : '';
                      const qualityInfo = QUALITIES.find(qual => qual.name.toLowerCase() === qName.toLowerCase());
                      return (
                        <SelectItem key={q.id} value={q.id.toString()}>
                          <div className="flex items-center gap-2">
                            {qualityInfo && (
                              <img src={qualityInfo.image} alt={qualityInfo.label} className="w-5 h-5" />
                            )}
                            {qualityInfo?.label || qName}
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    // Fallback на статические качества если БД еще не загружена
                    QUALITIES.map(q => (
                      <SelectItem key={q.id} value={q.id.toString()}>
                        <div className="flex items-center gap-2">
                          <img src={q.image} alt={q.label} className="w-5 h-5" />
                          {q.label}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>


            {/* Вес награды */}
            <div className="space-y-4">
              <Label>Вес награды (относительный шанс)</Label>

              {/* Пресеты */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Очень редко', value: 10, color: 'border-purple-500/50 hover:bg-purple-500/10' },
                  { label: 'Редко', value: 50, color: 'border-blue-500/50 hover:bg-blue-500/10' },
                  { label: 'Обычно', value: 100, color: 'border-gray-500/50 hover:bg-gray-500/10' },
                  { label: 'Часто', value: 200, color: 'border-green-500/50 hover:bg-green-500/10' },
                  { label: 'Очень часто', value: 500, color: 'border-yellow-500/50 hover:bg-yellow-500/10' }
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={rewardForm.weight[0] === preset.value ? "default" : "outline"}
                    className={`flex flex-col h-auto py-2.5 ${preset.color} ${rewardForm.weight[0] === preset.value ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setRewardForm({ ...rewardForm, weight: [preset.value] })}
                  >
                    <span className="text-xs font-medium">{preset.label}</span>
                    <span className="text-sm font-bold mt-0.5">Вес: {preset.value}</span>
                  </Button>
                ))}
              </div>

              {/* Кастомный вес */}
              <div className="space-y-2">
                <Label htmlFor="reward_weight_custom">Или укажите свой вес (1-2000)</Label>
                <Input
                  id="reward_weight_custom"
                  type="number"
                  min="1"
                  max={String(MAX_REWARD_WEIGHT)}
                  value={rewardForm.weight[0]}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setRewardForm({ ...rewardForm, weight: [Math.max(1, Math.min(MAX_REWARD_WEIGHT, value))] });
                  }}
                  className="w-full"
                  placeholder="Введите вес награды"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1 border-slate-700 bg-slate-900/70 hover:bg-slate-800">
              Отмена
            </Button>
            <Button
              onClick={handleSaveReward}
              disabled={createRewardMutation.isPending || updateRewardMutation.isPending || deleteRewardMutation.isPending}
              className="gap-2 w-full sm:w-auto bg-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-none font-semibold order-1 sm:order-2"
            >
              {(createRewardMutation.isPending || updateRewardMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingReward ? 'Сохранить изменения' : 'Создать награду'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default RewardsManager;
