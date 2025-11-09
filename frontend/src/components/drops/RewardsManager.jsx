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
  Loader2,
  Power
} from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import MythicalClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';

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
  },
  { 
    id: 5, 
    name: 'Mythical', 
    color: '#EF4444', 
    label: 'Мифический',
    image: MythicalClosed
  }
];


const RewardsManager = ({ user, channelName, onRewardsCountChange, integrations }) => {
  const queryClient = useQueryClient();
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  
  // Проверяем доступные платформы (явно преобразуем в boolean)
  const twitchAvailable = !!(integrations?.twitch?.enabled && user?.twitch_username);
  const vkAvailable = !!(integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name));
  
  // Определяем доступные платформы для выбора
  const availablePlatforms = [];
  if (twitchAvailable) availablePlatforms.push({ value: 'twitch', label: 'Twitch' });
  if (vkAvailable) availablePlatforms.push({ value: 'vk', label: 'VK Live' });
  
  const [rewardForm, setRewardForm] = useState({
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
  
  // Фильтр по платформе для отображения
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all', 'twitch', 'vk'

  // React Query: загружаем качества (кешируются глобально)
  const { data: qualitiesData = [], isLoading: qualitiesLoading } = useQuery({
    queryKey: ['drops-qualities'],
    queryFn: async () => {
      const response = await botService.get('/api/drops/qualities');
      return response.data.success ? response.data.data : [];
    },
    staleTime: 10 * 60 * 1000, // 10 минут - качества редко меняются
  });

  // React Query: загружаем награды (ОБЩИЕ для всех платформ)
  const { data: allRewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['drops-rewards', channelName],
    queryFn: async () => {
      if (!channelName) return [];
      
      // ✅ Награды ОБЩИЕ - делаем один запрос
      // Параметр platform передаем для совместимости, но он игнорируется на бэкенде
      const response = await botService.get(`/api/drops/rewards/${channelName}`, { 
        params: { platform: 'twitch' } // Игнорируется бэкендом, награды общие
      });
      
      if (!response.data.success) return [];
      
      // Добавляем platform к каждой награде для отображения
      return (response.data.data || []).map(r => ({
        ...r,
        // Награда доступна на всех платформах, но показываем где она была создана
        platform: r.platform || 'twitch'
      }));
    },
    enabled: !!channelName, // ✅ Награды глобальные, не зависят от платформы
  });
  
  // ✅ Защита от null/undefined - всегда массив
  const allRewards = allRewardsData || [];
  
  // Фильтруем награды по выбранной платформе
  const rewards = React.useMemo(() => {
    // ✅ Защита от null/undefined
    if (!allRewards) return [];
    if (platformFilter === 'all') return allRewards;
    return allRewards.filter(r => r.platform === platformFilter);
  }, [allRewards, platformFilter]);

  // Уведомляем родителя об изменении количества наград
  useEffect(() => {
    if (onRewardsCountChange && rewards) {
      onRewardsCountChange(rewards.length);
    }
  }, [rewards, onRewardsCountChange]);

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
      is_active: true,
      platform: availablePlatforms.length > 0 ? availablePlatforms[0].value : 'twitch' // Выбираем первую доступную платформу
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
      is_active: reward.is_active !== undefined ? reward.is_active : true,
      platform: reward.platform || 'twitch' // Используем platform из награды или дефолт
    });
    setRewardDialogOpen(true);
  };

  // React Query: мутация для создания/обновления награды с optimistic updates
  const saveRewardMutation = useMutation({
    mutationFn: async ({ payload, isEdit, rewardId }) => {
      if (isEdit) {
        return await botService.put(`/api/drops/rewards/${rewardId}`, payload);
      } else {
        // При создании используем platform из payload
        const platform = payload.platform || 'twitch';
        return await botService.post(`/api/drops/rewards/${channelName}`, payload, {
          params: { platform }
        });
      }
    },
    onMutate: async ({ payload, isEdit }) => {
      // Отменяем исходящие запросы для всех платформ
      await queryClient.cancelQueries({ queryKey: ['drops-rewards', channelName] });
      
      // Snapshot предыдущего значения
      const previousRewards = queryClient.getQueryData(['drops-rewards', channelName]);
      
      // Optimistically update (работаем с объединенным списком наград)
      if (isEdit && editingReward) {
        queryClient.setQueryData(['drops-rewards', channelName], (old) => {
          // ✅ Защита от null/undefined
          if (!old) return [];
          return old.map(reward => 
            reward.id === editingReward.id 
              ? { ...reward, ...payload, quality: qualitiesData.find(q => q.id === payload.quality_id) }
              : reward
          );
        });
      } else {
        const newReward = {
          ...payload,
          platform: payload.platform || 'twitch',
          quality: qualitiesData.find(q => q.id === payload.quality_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['drops-rewards', channelName], (old) => {
          // ✅ Защита от null/undefined
          return [...(old || []), newReward];
        });
      }
      
      return { previousRewards };
    },
    onError: (err, variables, context) => {
      // Rollback при ошибке
      if (context?.previousRewards) {
        // ✅ Защита от null - устанавливаем пустой массив если previousRewards null
        queryClient.setQueryData(['drops-rewards', channelName], context.previousRewards || []);
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
      // Refetch для синхронизации (обновляем все награды)
      queryClient.invalidateQueries({ queryKey: ['drops-rewards', channelName] });
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
      is_active: rewardForm.is_active,
      platform: rewardForm.platform // Добавляем platform для новой награды
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
      await queryClient.cancelQueries({ queryKey: ['drops-rewards', channelName] });
      
      const previousRewards = queryClient.getQueryData(['drops-rewards', channelName]);
      
      // Optimistically remove
      queryClient.setQueryData(['drops-rewards', channelName], (old) => 
        (old || []).filter(reward => reward.id !== rewardId)
      );
      
      return { previousRewards };
    },
    onError: (err, rewardId, context) => {
      if (context?.previousRewards) {
        // ✅ Защита от null - устанавливаем пустой массив если previousRewards null
        queryClient.setQueryData(['drops-rewards', channelName], context.previousRewards || []);
      }
      toast.error('Ошибка удаления награды');
      logger.error('Error deleting reward:', err);
    },
    onSuccess: () => {
      toast.success('Награда удалена');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['drops-rewards', channelName] });
    },
  });

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Удалить эту награду?')) return;
    deleteRewardMutation.mutate(rewardId);
  };

  // React Query: мутация для переключения активности награды
  const toggleRewardMutation = useMutation({
    mutationFn: async (rewardId) => {
      const response = await botService.patch(`/api/drops/rewards/${rewardId}/toggle`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drops-rewards', channelName] });
      toast.success(data.message || 'Статус награды изменен');
    },
    onError: (error) => {
      logger.error('Error toggling reward:', error);
      toast.error('Ошибка изменения статуса награды');
    },
  });

  const handleToggleReward = async (reward) => {
    toggleRewardMutation.mutate(reward.id);
  };

  const getRewardsForQuality = (qualityName) => {
    // ✅ Защита от null/undefined
    if (!rewards) return [];
    return rewards.filter(r => r.quality?.name === qualityName);
  };

  const getTotalWeight = (qualityName) => {
    const qualityRewards = getRewardsForQuality(qualityName);
    return qualityRewards.reduce((sum, r) => sum + r.weight, 0);
  };

  return (
    <div className="space-y-6">
      {/* ✅ Одна общая кнопка создания награды */}
      <div className="flex justify-end mb-6 mt-4">
        <Button
          onClick={() => handleOpenRewardDialog(null)}
          size="default"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-medium gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать награду
        </Button>
      </div>
      
      {/* Награды по качествам */}
      {QUALITIES.map((quality) => {
        const qualityRewards = getRewardsForQuality(quality.name);
        const totalWeight = getTotalWeight(quality.name);
        const qualityData = qualitiesData.find(q => q.name === quality.name);
        
        return (
          <Card key={quality.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <img 
                  src={quality.image} 
                  alt={`${quality.label} chest`}
                  className="w-10 h-10 object-contain"
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
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {qualityRewards.map((reward) => {
                    return (
                      <div 
                        key={reward.id} 
                        className="relative flex flex-col p-2.5 border rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        {/* Шанс справа вверху */}
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="secondary" className="text-xs">
                            {reward.weight}
                          </Badge>
                        </div>
                        
                        {/* Изображение (если есть) */}
                        {reward.image_url && (
                          <div className="w-full aspect-square border rounded overflow-hidden mb-1.5 bg-muted">
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
                        
                        {/* Название слева */}
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
                        
                        {/* Кнопки действий - справа */}
                        <div className="flex gap-1 justify-end w-full pt-1.5 border-t opacity-0 group-hover:opacity-100 transition-opacity">
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
                            className={`h-7 w-7 p-0 ${
                              reward.is_active ? 'text-green-500 hover:text-green-600' : 'text-gray-500 hover:text-gray-600'
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
            {/* ✅ УБРАЛИ выбор платформы - награды ОБЩИЕ для всех платформ */}

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


            {/* Вес награды - ПРЕСЕТЫ БЕЗ ПРОЦЕНТОВ */}
            <div className="space-y-4">
              <Label>Вес награды (относительный шанс)</Label>
              
              {/* Пресеты без процентов - только вес */}
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
                    onClick={() => setRewardForm({...rewardForm, weight: [preset.value]})}
                  >
                    <span className="text-xs font-medium">{preset.label}</span>
                    <span className="text-sm font-bold mt-0.5">Вес: {preset.value}</span>
                  </Button>
                ))}
              </div>
              
              {/* Кастомный вес */}
              <div className="space-y-2">
                <Label htmlFor="reward_weight_custom">Или укажите свой вес (1-10000)</Label>
                <Input
                  id="reward_weight_custom"
                  type="number"
                  min="1"
                  max="10000"
                  value={rewardForm.weight[0]}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setRewardForm({...rewardForm, weight: [Math.max(1, Math.min(10000, value))]});
                  }}
                  className="w-full"
                  placeholder="Введите вес награды"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
              Отмена
            </Button>
            <Button 
              onClick={handleSaveReward} 
              disabled={saveRewardMutation.isPending || deleteRewardMutation.isPending}
              className="gap-2 w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold order-1 sm:order-2"
            >
              {saveRewardMutation.isPending ? (
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
};

export default RewardsManager;

