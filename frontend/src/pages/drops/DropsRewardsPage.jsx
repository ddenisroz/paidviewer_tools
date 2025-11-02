import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Volume2, 
  Star, 
  Shield, 
  Gem, 
  Crown,
  Gift,
  Settings,
  Play
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { logger } from '../../utils/prodLogger';

const DropsRewardsPage = () => {
  const [rewards, setRewards] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [filter, setFilter] = useState('all');

  const { get, post, put, del } = useApi();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const channelName = 'default';
      
      // Загружаем награды
      const rewardsResponse = await get(`/api/drops/rewards/${channelName}`);
      if (rewardsResponse.success) {
        setRewards(rewardsResponse.data);
      }

      // Загружаем качества
      const qualitiesResponse = await get('/api/drops/qualities');
      if (qualitiesResponse.success) {
        setQualities(qualitiesResponse.data);
      }

    } catch (error) {
      logger.error('Error loading rewards data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReward = async (rewardData) => {
    try {
      const response = await post(`/api/drops/rewards/default`, rewardData);
      if (response.success) {
        await loadData();
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      logger.error('Error creating reward:', error);
    }
  };

  const handleUpdateReward = async (rewardId, rewardData) => {
    try {
      const response = await put(`/api/drops/rewards/${rewardId}`, rewardData);
      if (response.success) {
        await loadData();
        setIsEditDialogOpen(false);
        setEditingReward(null);
      }
    } catch (error) {
      logger.error('Error updating reward:', error);
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (window.confirm('Удалить эту награду?')) {
      try {
        const response = await del(`/api/drops/rewards/${rewardId}`);
        if (response.success) {
          await loadData();
        }
      } catch (error) {
        logger.error('Error deleting reward:', error);
      }
    }
  };

  const getQualityIcon = (qualityName) => {
    switch (qualityName) {
      case 'Common': return <Shield className="w-4 h-4 text-gray-500" />;
      case 'Rare': return <Star className="w-4 h-4 text-blue-500" />;
      case 'Epic': return <Gem className="w-4 h-4 text-purple-500" />;
      case 'Legendary': return <Crown className="w-4 h-4 text-yellow-500" />;
      default: return <Gift className="w-4 h-4 text-gray-500" />;
    }
  };

  const getQualityColor = (qualityName) => {
    switch (qualityName) {
      case 'Common': return 'bg-gray-100 text-gray-800';
      case 'Rare': return 'bg-blue-100 text-blue-800';
      case 'Epic': return 'bg-purple-100 text-purple-800';
      case 'Legendary': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRewards = rewards.filter(reward => {
    if (filter === 'all') return true;
    if (filter === 'active') return reward.is_active;
    if (filter === 'inactive') return !reward.is_active;
    return reward.quality?.name === filter;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🎁 Управление наградами
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Создавайте и настраивайте награды для системы Drops
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Создать награду
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создать новую награду</DialogTitle>
            </DialogHeader>
            <RewardForm 
              qualities={qualities}
              onSubmit={handleCreateReward}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Фильтры */}
      <div className="flex gap-4 mb-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Фильтр" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все награды</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Неактивные</SelectItem>
            {qualities.map(quality => (
              <SelectItem key={quality.id} value={quality.name}>
                {quality.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Список наград */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRewards.map((reward) => (
          <Card key={reward.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getQualityIcon(reward.quality?.name)}
                  <CardTitle className="text-lg">{reward.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingReward(reward);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteReward(reward.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-2">{reward.description}</p>
                  <Badge className={getQualityColor(reward.quality?.name)}>
                    {reward.quality?.name}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Вес: {reward.weight}</span>
                  <span className="text-gray-500">Тип: {reward.reward_type}</span>
                </div>

                {reward.sound_file && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Volume2 className="w-4 h-4" />
                    <span>Звук загружен</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Badge variant={reward.is_active ? "default" : "secondary"}>
                    {reward.is_active ? "Активна" : "Неактивна"}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог редактирования */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать награду</DialogTitle>
          </DialogHeader>
          {editingReward && (
            <RewardForm 
              qualities={qualities}
              initialData={editingReward}
              onSubmit={(data) => handleUpdateReward(editingReward.id, data)}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingReward(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Форма награды
const RewardForm = ({ qualities, initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quality_id: '',
    weight: 100,
    reward_type: 'points',
    reward_value: '',
    sound_volume: 1.0,
    is_active: true,
    ...initialData
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Название</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Название награды"
            required
          />
        </div>
        <div>
          <Label htmlFor="quality_id">Качество</Label>
          <Select 
            value={formData.quality_id} 
            onValueChange={(value) => setFormData({...formData, quality_id: parseInt(value)})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите качество" />
            </SelectTrigger>
            <SelectContent>
              {qualities.map(quality => (
                <SelectItem key={quality.id} value={quality.id.toString()}>
                  {quality.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Описание награды"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reward_type">Тип награды</Label>
          <Select 
            value={formData.reward_type} 
            onValueChange={(value) => setFormData({...formData, reward_type: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points">Баллы</SelectItem>
              <SelectItem value="voice">Голос</SelectItem>
              <SelectItem value="command">Команда</SelectItem>
              <SelectItem value="custom">Кастомная</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="reward_value">Значение</Label>
          <Input
            id="reward_value"
            value={formData.reward_value}
            onChange={(e) => setFormData({...formData, reward_value: e.target.value})}
            placeholder="Значение награды"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="weight">Вес (1-1000)</Label>
          <Input
            id="weight"
            type="number"
            min="1"
            max="1000"
            value={formData.weight}
            onChange={(e) => setFormData({...formData, weight: parseInt(e.target.value)})}
            required
          />
        </div>
        <div>
          <Label htmlFor="sound_volume">Громкость звука</Label>
          <Input
            id="sound_volume"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={formData.sound_volume}
            onChange={(e) => setFormData({...formData, sound_volume: parseFloat(e.target.value)})}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
          className="w-4 h-4"
        />
        <Label htmlFor="is_active">Активная награда</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">
          {initialData ? 'Обновить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
};

export default DropsRewardsPage;
