import React, { useState, useEffect } from 'react';
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
  Save
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
  const [rewards, setRewards] = useState([]);
  const [qualitiesData, setQualitiesData] = useState([]);
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

  useEffect(() => {
    loadQualities();
    loadRewards();
  }, [user, platform, channelName]);

  // Уведомляем родителя об изменении количества наград
  useEffect(() => {
    if (onRewardsCountChange) {
      onRewardsCountChange(rewards.length);
    }
  }, [rewards.length, onRewardsCountChange]);

  const loadQualities = async () => {
    try {
      const response = await botService.get('/api/drops/qualities');
      if (response.data.success) {
        setQualitiesData(response.data.data);
      }
    } catch (error) {
      logger.error('Error loading qualities:', error);
    }
  };

  const loadRewards = async () => {
    if (!user || !platform || !channelName) {
      return;
    }

    try {
      const response = await botService.get(`/api/drops/rewards/${channelName}`, {
        params: { platform }
      });
      
      if (response.data.success) {
        setRewards(response.data.data);
      }
    } catch (error) {
      logger.error('Error loading rewards:', error);
    }
  };

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
      image_url: rewardForm.image_url || null, // URL изображения для карточки в гача крутке
      sound_volume: 1.0, // Дефолтное значение, настройка звука в виджете
      is_active: rewardForm.is_active
    };

    try {
      if (editingReward) {
        await botService.put(`/api/drops/rewards/${editingReward.id}`, payload);
        toast.success('Награда обновлена');
      } else {
        await botService.post(`/api/drops/rewards/${channelName}`, payload, {
          params: { platform }
        });
        toast.success('Награда создана');
      }
      
      await loadRewards();
      setRewardDialogOpen(false);
    } catch (error) {
      logger.error('Error saving reward:', error);
      
      // Обрабатываем ошибки валидации
      let errorMessage = 'Ошибка сохранения награды';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Если это массив ошибок валидации
        if (Array.isArray(errorData.detail)) {
          const messages = errorData.detail.map(err => {
            if (typeof err === 'object' && err.msg) {
              return `${err.loc?.join('.')}: ${err.msg}`;
            }
            return String(err);
          });
          errorMessage = messages.join(', ');
        } 
        // Если это строка
        else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        }
        // Если есть message
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Удалить эту награду?')) return;

    try {
      await botService.delete(`/api/drops/rewards/${rewardId}`);
      toast.success('Награда удалена');
      await loadRewards();
    } catch (error) {
      logger.error('Error deleting reward:', error);
      toast.error('Ошибка удаления награды');
    }
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
              <div className="flex items-center justify-between">
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
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </Button>
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
                <div className="space-y-2">
                  {qualityRewards.map((reward) => {
                    return (
                      <div 
                        key={reward.id} 
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium">{reward.name}</h4>
                            {!reward.is_active && (
                              <Badge variant="outline" className="text-xs">Отключено</Badge>
                            )}
                          </div>
                          {reward.description && (
                            <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>
                          )}
                          {reward.image_url && (
                            <div className="mt-2 w-20 h-20 border rounded overflow-hidden">
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
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Шанс выпадения:</span>
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
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditReward(reward)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReward(reward.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'Редактировать награду' : 'Создать награду'}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры награды, которая будет выдаваться зрителям
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
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

            {/* Изображение для карточки */}
            <div className="space-y-2">
              <Label htmlFor="reward_image">Изображение для карточки (гача)</Label>
              <div className="space-y-2">
                <Input
                  id="reward_image_url"
                  type="url"
                  value={rewardForm.image_url || ''}
                  onChange={(e) => setRewardForm({...rewardForm, image_url: e.target.value})}
                  placeholder="URL изображения (или загрузите файл после сохранения)"
                />
                {editingReward && (
                  <div className="flex items-center gap-2">
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
                  </div>
                )}
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
                Изображение будет показано на карточке при крутке сундука (как в гача-играх)
              </p>
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
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300 font-medium mb-1">💡 Как работает вес награды:</p>
                <p className="text-xs text-blue-200/80">
                  Система случайно выбирает награду из всех наград того же качества. 
                  Награда с весом <span className="font-semibold">200</span> выпадет в <span className="font-semibold">2 раза чаще</span>, чем награда с весом <span className="font-semibold">100</span>.
                  Используйте вес для регулирования редкости наград.
                </p>
              </div>
            </div>


            {/* Активность */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Активна</h3>
                <p className="text-sm text-muted-foreground">
                  Награда доступна для выдачи
                </p>
              </div>
              <Switch
                checked={rewardForm.is_active}
                onCheckedChange={(checked) => setRewardForm({...rewardForm, is_active: checked})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveReward} className="gap-2">
              <Save className="w-4 h-4" />
              {editingReward ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardsManager;

