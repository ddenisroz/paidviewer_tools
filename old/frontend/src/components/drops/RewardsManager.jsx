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
  Volume2,
  Zap,
  Mic,
  Command,
  Crown,
  Music,
  Sparkles,
  Save
} from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import MythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';

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
    color: '#EC4899', 
    label: 'Мифический',
    image: MythycClosed
  }
];

const REWARD_TYPES = [
  { value: 'points', label: 'Баллы канала', icon: Zap },
  { value: 'voice', label: 'Озвучка', icon: Mic },
  { value: 'command', label: 'Команда', icon: Command },
  { value: 'custom', label: 'Своя награда', icon: Sparkles }
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
    reward_type: 'points',
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
    setRewardForm({
      name: '',
      description: '',
      quality_id: qualityId,
      weight: [100],
      reward_type: 'points',
      reward_value: '',
      sound_volume: [1.0],
      is_active: true
    });
    setRewardDialogOpen(true);
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    setSelectedQuality(reward.quality.id);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      quality_id: reward.quality.id,
      weight: [reward.weight],
      reward_type: reward.reward_type,
      reward_value: reward.reward_value,
      sound_volume: [reward.sound_volume],
      is_active: reward.is_active
    });
    setRewardDialogOpen(true);
  };

  const handleSaveReward = async () => {
    if (!rewardForm.name || !rewardForm.reward_value) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    const payload = {
      ...rewardForm,
      weight: rewardForm.weight[0],
      sound_volume: rewardForm.sound_volume[0]
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
      toast.error('Ошибка сохранения награды');
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

  const getRewardsForQuality = (qualityId) => {
    return rewards.filter(r => r.quality.id === qualityId);
  };

  const getTotalWeight = (qualityId) => {
    const qualityRewards = getRewardsForQuality(qualityId);
    return qualityRewards.reduce((sum, r) => sum + r.weight, 0);
  };

  return (
    <div className="space-y-6">
      {/* Награды по качествам */}
      {QUALITIES.map((quality) => {
        const qualityRewards = getRewardsForQuality(quality.id);
        const totalWeight = getTotalWeight(quality.id);
        const qualityData = qualitiesData.find(q => q.id === quality.id);
        
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
                  onClick={() => handleOpenRewardDialog(quality.id)}
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
                    const RewardTypeIcon = REWARD_TYPES.find(t => t.value === reward.reward_type)?.icon || Zap;
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
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-xs">
                              <RewardTypeIcon className="w-3 h-3" />
                              <span className="font-mono">{reward.reward_value}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Вес:</span>
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
                placeholder="Например: 100 баллов канала"
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
                  {QUALITIES.map(q => (
                    <SelectItem key={q.id} value={q.id.toString()}>
                      <div className="flex items-center gap-2">
                        <img src={q.image} alt={q.label} className="w-5 h-5" />
                        {q.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Тип награды */}
            <div className="space-y-2">
              <Label htmlFor="reward_type">Тип награды *</Label>
              <Select
                value={rewardForm.reward_type}
                onValueChange={(value) => setRewardForm({...rewardForm, reward_type: value})}
              >
                <SelectTrigger id="reward_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REWARD_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Значение награды */}
            <div className="space-y-2">
              <Label htmlFor="reward_value">
                Значение награды * 
                <span className="text-xs text-muted-foreground ml-2">
                  ({rewardForm.reward_type === 'points' && 'число баллов'}
                  {rewardForm.reward_type === 'voice' && 'ID голоса'}
                  {rewardForm.reward_type === 'command' && 'название команды'}
                  {rewardForm.reward_type === 'custom' && 'произвольное значение'})
                </span>
              </Label>
              <Input
                id="reward_value"
                placeholder={
                  rewardForm.reward_type === 'points' ? '100' :
                  rewardForm.reward_type === 'voice' ? 'female_1' :
                  rewardForm.reward_type === 'command' ? '!custom' :
                  'любое значение'
                }
                value={rewardForm.reward_value}
                onChange={(e) => setRewardForm({...rewardForm, reward_value: e.target.value})}
              />
            </div>

            {/* Вес награды */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="reward_weight">Вес награды</Label>
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
              <p className="text-xs text-muted-foreground">
                Чем выше вес, тем больше шанс выпадения этой награды среди других наград того же качества
              </p>
            </div>

            {/* Громкость звука */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="reward_sound_volume">
                  <Volume2 className="w-4 h-4 inline mr-2" />
                  Громкость звука
                </Label>
                <span className="text-sm font-semibold">{rewardForm.sound_volume[0].toFixed(1)}</span>
              </div>
              <Slider
                id="reward_sound_volume"
                value={rewardForm.sound_volume}
                onValueChange={(value) => setRewardForm({...rewardForm, sound_volume: value})}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
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

