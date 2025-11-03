import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Crown,
  Music,
  Save,
  Loader2
} from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';

const QUALITIES = [
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
  }
  // Мифический сундук только для донатов, не включаем здесь
];


const RewardsManager = ({ user, platform, channelName, onRewardsCountChange }) => {
  const queryClient = useQueryClient();
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    quality_id: null,
    weight: [100],
    reward_type: 'custom',
    reward_value: '',
    sound_volume: [1.0],
    is_active: true
  });

  // React Query: загружаем качества (кешируются глобально)
  const { data: qualitiesData = [], isLoading: qualitiesLoading } = useQuery({
    queryKey: ['drops-qualities'],
    queryFn: async () => {
      const response = await botService.get('/api/drops/qualities');
      return response.data.success ? response.data.data : [];
    },
    staleTime: 10 * 60 * 1000, // 10 минут - качества редко меняются
  });

  // React Query: загружаем награды
  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['drops-rewards', channelName, platform],
    queryFn: async () => {
      if (!channelName) return [];
      const response = await botService.get(`/api/drops/rewards/${channelName}`, {
        params: { platform }
      });
      return response.data.success ? response.data.data : [];
    },
    enabled: !!channelName && !!platform, // Запрос только если есть channelName и platform
  });

  // Уведомляем родителя об изменении количества наград
  useEffect(() => {
    if (onRewardsCountChange) {
      onRewardsCountChange(rewards.length);
    }
  }, [rewards.length, onRewardsCountChange]);

  const handleOpenRewardDialog = (qualityId = null) => {
    setSelectedQuality(qualityId);
    setEditingReward(null);
    // Если qualityId не передан, берем первый из БД
    const defaultQualityId = qualityId || (qualitiesData.length > 0 ? qualitiesData[0].id : null);
    setRewardForm({
      name: '',
      description: '',
      quality_id: defaultQualityId,
      weight: [100],
      reward_type: 'custom',
      reward_value: '',
      image_url: '',
      sound_volume: [1.0],
      is_active: true
    });
    setRewardDialogOpen(true);
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    // Используем реальный ID из БД (может быть объект quality или просто id)
    const qualityId = reward.quality?.id || (reward.quality && typeof reward.quality === 'object' ? reward.quality.id : reward.quality);
    setSelectedQuality(qualityId);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      quality_id: qualityId,
      weight: [reward.weight],
      reward_type: reward.reward_type,
      reward_value: reward.reward_value || '',
      image_url: reward.image_url || '',
      sound_volume: [reward.sound_volume || 1.0],
      is_active: reward.is_active !== undefined ? reward.is_active : true
    });
    setRewardDialogOpen(true);
  };

  // React Query: мутация для создания/обновления награды с optimistic updates
  const saveRewardMutation = useMutation({
    mutationFn: async ({ payload, isEdit, rewardId }) => {
      if (isEdit) {
        return await botService.put(`/api/drops/rewards/${rewardId}`, payload);
      } else {
        return await botService.post(`/api/drops/rewards/${channelName}`, payload, {
          params: { platform }
        });
      }
    },
    onMutate: async ({ payload, isEdit }) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: ['drops-rewards', channelName, platform] });
      
      // Snapshot предыдущего значения
      const previousRewards = queryClient.getQueryData(['drops-rewards', channelName, platform]);
      
      // Optimistically update
      if (isEdit && editingReward) {
        queryClient.setQueryData(['drops-rewards', channelName, platform], (old) => {
          return old.map(reward => 
            reward.id === editingReward.id 
              ? { ...reward, ...payload, quality: qualitiesData.find(q => q.id === payload.quality_id) }
              : reward
          );
        });
      } else {
        // Для новой награды добавляем временный ID
        const newReward = {
          id: `temp-${Date.now()}`,
          ...payload,
          quality: qualitiesData.find(q => q.id === payload.quality_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['drops-rewards', channelName, platform], (old) => [...(old || []), newReward]);
      }
      
      return { previousRewards };
    },
    onError: (err, variables, context) => {
      // Rollback при ошибке
      if (context?.previousRewards) {
        queryClient.setQueryData(['drops-rewards', channelName, platform], context.previousRewards);
      }
      
      // Обрабатываем ошибки валидации
      let errorMessage = 'Ошибка сохранения награды';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        if (Array.isArray(errorData.detail)) {
          const messages = errorData.detail.map(e => {
            if (typeof e === 'object' && e.msg) {
              return `${e.loc?.join('.')}: ${e.msg}`;
            }
            return String(e);
          });
          errorMessage = messages.join(', ');
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      
      toast.error(errorMessage);
      logger.error('Error saving reward:', err);
    },
    onSuccess: (response, variables) => {
      toast.success(variables.isEdit ? 'Награда обновлена' : 'Награда создана');
      setRewardDialogOpen(false);
    },
    onSettled: () => {
      // Refetch для синхронизации
      queryClient.invalidateQueries({ queryKey: ['drops-rewards', channelName, platform] });
    },
  });

  const handleSaveReward = async () => {
    if (!rewardForm.name) {
      toast.error('Укажите название награды');
      return;
    }

    if (!rewardForm.quality_id) {
      toast.error('Выберите качество сундука');
      return;
    }

    const payload = {
      name: rewardForm.name,
      description: rewardForm.description || null,
      quality_id: rewardForm.quality_id,
      weight: rewardForm.weight[0],
      reward_type: 'custom', // Всегда custom, так как награда - это просто сундук
      reward_value: '', // Пустое значение, так как награда - это просто показ сундука
      image_url: (rewardForm.image_url && rewardForm.image_url.trim()) || null, // URL изображения для карточки в гача крутке (null если пусто)
      sound_volume: 1.0, // Дефолтное значение, настройка звука в виджете
      is_active: rewardForm.is_active
    };

    saveRewardMutation.mutate({
      payload,
      isEdit: !!editingReward,
      rewardId: editingReward?.id,
    });
  };

  // React Query: мутация для удаления награды с optimistic updates
  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId) => {
      return await botService.delete(`/api/drops/rewards/${rewardId}`);
    },
    onMutate: async (rewardId) => {
      await queryClient.cancelQueries({ queryKey: ['drops-rewards', channelName, platform] });
      
      const previousRewards = queryClient.getQueryData(['drops-rewards', channelName, platform]);
      
      // Optimistically remove
      queryClient.setQueryData(['drops-rewards', channelName, platform], (old) => 
        old.filter(reward => reward.id !== rewardId)
      );
      
      return { previousRewards };
    },
    onError: (err, rewardId, context) => {
      if (context?.previousRewards) {
        queryClient.setQueryData(['drops-rewards', channelName, platform], context.previousRewards);
      }
      toast.error('Ошибка удаления награды');
      logger.error('Error deleting reward:', err);
    },
    onSuccess: () => {
      toast.success('Награда удалена');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['drops-rewards', channelName, platform] });
    },
  });

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Удалить эту награду?')) return;
    deleteRewardMutation.mutate(rewardId);
  };

  const getRewardsForQuality = (qualityName) => {
    return rewards.filter(r => r.quality?.name === qualityName);
  };

  const getTotalWeight = (qualityName) => {
    const qualityRewards = getRewardsForQuality(qualityName);
    return qualityRewards.reduce((sum, r) => sum + r.weight, 0);
  };

  return (
    <div className="space-y-6">
      {/* Награды по качествам */}
      {QUALITIES.map((quality) => {
        const qualityRewards = getRewardsForQuality(quality.name);
        const totalWeight = getTotalWeight(quality.name);
        const qualityData = qualitiesData.find(q => q.name === quality.name);
        
        return (
          <Card key={quality.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <img 
                  src={quality.image} 
                  alt={`${quality.label} chest`}
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span style={{ color: qualityData?.color || quality.color }}>
                      {quality.label}
                    </span>
                    <Badge 
                      variant="secondary" 
                      style={{ backgroundColor: qualityData?.color || quality.color }}
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
                  <p className="text-sm font-medium text-orange-400">⚠️ Награды не настроены</p>
                  <p className="text-xs mt-2 text-muted-foreground">Добавьте награды в этот лутбокс, чтобы зрители могли их получить</p>
                  <p className="text-xs mt-1 text-yellow-500">Без наград система Drops не будет работать</p>
                  <Button
                    onClick={() => {
                      // Пытаемся найти реальный ID качества из БД (сравниваем без учета регистра)
                      // Если не найдено, используем статический ID из константы (fallback)
                      const dbQuality = qualitiesData.find(q => 
                        q.name.toLowerCase() === quality.name.toLowerCase()
                      );
                      const qualityId = dbQuality ? dbQuality.id : quality.id;
                      handleOpenRewardDialog(qualityId);
                    }}
                    size="sm"
                    className="gap-2 mt-3 text-xs sm:text-sm"
                    variant="outline"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Добавить награду</span>
                    <span className="sm:hidden">Добавить</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        // Пытаемся найти реальный ID качества из БД (сравниваем без учета регистра)
                        // Если не найдено, используем статический ID из константы (fallback)
                        const dbQuality = qualitiesData.find(q => 
                          q.name.toLowerCase() === quality.name.toLowerCase()
                        );
                        const qualityId = dbQuality ? dbQuality.id : quality.id;
                        handleOpenRewardDialog(qualityId);
                      }}
                      size="sm"
                      className="gap-2 text-xs sm:text-sm"
                      variant="outline"
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Добавить награду</span>
                      <span className="sm:hidden">Добавить</span>
                    </Button>
                  </div>
                <div className="space-y-2">
                  {qualityRewards.map((reward) => {
                    return (
                      <div 
                        key={reward.id} 
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium break-words">{reward.name}</h4>
                            {!reward.is_active && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">Отключено</Badge>
                            )}
                          </div>
                          {reward.description && (
                            <p className="text-xs text-muted-foreground mt-1 break-words">{reward.description}</p>
                          )}
                          {reward.image_url && (
                            <div className="mt-2 w-16 h-16 sm:w-20 sm:h-20 border rounded overflow-hidden flex-shrink-0">
                              <img 
                                src={reward.image_url} 
                                alt={reward.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Шанс:</span>
                              <span className="font-semibold">{reward.weight}</span>
                            </div>
                            {reward.sound_file && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Music className="w-3 h-3" />
                                <span>Звук</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 self-end sm:self-auto flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditReward(reward)}
                            className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                          >
                            <Edit className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">Редактировать</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReward(reward.id)}
                            className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">Удалить</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Диалог создания/редактирования награды */}
      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                onChange={(e) => setRewardForm({...rewardForm, name: e.target.value})}
              />
            </div>

            {/* Описание */}
            <div className="space-y-2">
              <Label htmlFor="reward_description">Описание</Label>
              <Textarea
                id="reward_description"
                placeholder="Краткое описание награды"
                value={rewardForm.description}
                onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})}
                rows={2}
              />
            </div>

            {/* Изображение для карточки - только загрузка файла после сохранения */}
            {editingReward && (
              <div className="space-y-2">
                <Label htmlFor="reward_image">Изображение для карточки (гача)</Label>
                <div className="space-y-2">
                  <Input
                    id="reward_image_file"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        const formData = new FormData();
                        formData.append('image_file', file);
                        
                        const response = await botService.post(
                          `/api/drops/rewards/${editingReward.id}/image`,
                          formData,
                          {
                            headers: {
                              'Content-Type': 'multipart/form-data'
                            }
                          }
                        );
                        
                        if (response.data.success) {
                          setRewardForm({...rewardForm, image_url: response.data.data.image_url});
                          toast.success('Изображение загружено');
                        }
                      } catch (error) {
                        logger.error('Error uploading image:', error);
                        toast.error('Ошибка загрузки изображения');
                      } finally {
                        // Сброс input
                        e.target.value = '';
                      }
                    }}
                    className="flex-1"
                  />
                  {rewardForm.image_url && (
                    <div className="w-24 h-24 border rounded overflow-hidden bg-muted">
                      <img 
                        src={rewardForm.image_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Изображение будет показано на карточке при крутке сундука (как в гача-играх). Загрузите изображение после создания награды.
                </p>
              </div>
            )}

            {/* Качество */}
            <div className="space-y-2">
              <Label htmlFor="reward_quality">Качество сундука *</Label>
              <Select
                value={rewardForm.quality_id?.toString() || ''}
                onValueChange={(value) => setRewardForm({...rewardForm, quality_id: parseInt(value)})}
              >
                <SelectTrigger id="reward_quality">
                  <SelectValue placeholder="Выберите качество" />
                </SelectTrigger>
                <SelectContent>
                  {/* Используем данные из БД если есть, иначе fallback на статические */}
                  {qualitiesData.length > 0 ? (
                    qualitiesData.map(q => {
                      const qualityInfo = QUALITIES.find(qual => qual.name.toLowerCase() === q.name.toLowerCase());
                      return (
                        <SelectItem key={q.id} value={q.id.toString()}>
                          <div className="flex items-center gap-2">
                            {qualityInfo && (
                              <img src={qualityInfo.image} alt={qualityInfo.label} className="w-5 h-5" />
                            )}
                            {qualityInfo?.label || q.name}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="reward_weight">Шанс выпадения (вес награды)</Label>
                <span className="text-sm font-semibold">{rewardForm.weight[0]}</span>
              </div>
              <Slider
                id="reward_weight"
                value={rewardForm.weight}
                onValueChange={(value) => setRewardForm({...rewardForm, weight: value})}
                min={1}
                max={1000}
                step={1}
                className="w-full"
              />
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3">
                <p className="text-xs text-blue-300 font-medium mb-1">💡 Как работает вес награды:</p>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                  Система случайно выбирает награду из всех наград того же качества. 
                  Награда с весом <span className="font-semibold">200</span> выпадет в <span className="font-semibold">2 раза чаще</span>, чем награда с весом <span className="font-semibold">100</span>.
                  Используйте вес для регулирования редкости наград.
                </p>
              </div>
            </div>


            {/* Активность */}
            <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm sm:text-base">Активна</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Награда доступна для выдачи
                </p>
              </div>
              <Switch
                checked={rewardForm.is_active}
                onCheckedChange={(checked) => setRewardForm({...rewardForm, is_active: checked})}
                className="flex-shrink-0"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)} className="w-full sm:w-auto">
              Отмена
            </Button>
            <Button 
              onClick={handleSaveReward} 
              disabled={saveRewardMutation.isPending || deleteRewardMutation.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              {saveRewardMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingReward ? 'Сохранить' : 'Создать'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardsManager;

