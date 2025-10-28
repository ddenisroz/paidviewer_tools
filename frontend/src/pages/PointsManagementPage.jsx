import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../constants';
import { Gift, Plus, Edit, Trash2, Loader2, Power, PowerOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PointsManagementPage = () => {
  const { user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState('vk'); // vk или twitch
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);

  // Загрузка наград с выбранной платформы
  const loadRewards = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/points/rewards/${selectedPlatform}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load rewards:', response.status, errorText);
        toast.error(`Ошибка загрузки наград: ${errorText}`);
        setRewards([]);
      }

    } catch (err) {
      console.error('Error loading rewards:', err);
      toast.error('Не удалось загрузить награды');
      setRewards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, [selectedPlatform]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Загрузка наград...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Компактный header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Баллы канала</h1>
        
        {/* Переключатель платформ - компактно */}
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={selectedPlatform === 'twitch' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedPlatform('twitch')}
            className="gap-2"
          >
            <TwitchIcon className="w-4 h-4" />
            Twitch
          </Button>
          <Button
            variant={selectedPlatform === 'vk' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedPlatform('vk')}
            className="gap-2"
          >
            <VKIcon className="w-4 h-4" />
            VK Live
          </Button>
        </div>
      </div>

      {/* Список наград */}
      <div className="space-y-4">
        {/* Кнопка создания */}
        <Button onClick={() => setShowCreateDialog(true)} className="w-full" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Создать награду
        </Button>

        {/* Награды */}
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Нет наград. Создайте первую награду!</p>
            </CardContent>
          </Card>
        ) : (
          rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              platform={selectedPlatform}
              onEdit={() => setEditingReward(reward)}
              onRefresh={loadRewards}
            />
          ))
        )}
      </div>

      {/* Диалог создания/редактирования */}
      <RewardDialog
        open={showCreateDialog || !!editingReward}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingReward(null);
        }}
        reward={editingReward}
        platform={selectedPlatform}
        onSuccess={() => {
          setShowCreateDialog(false);
          setEditingReward(null);
          loadRewards();
        }}
      />
    </div>
  );
};

// Карточка награды
const RewardCard = ({ reward, platform, onEdit, onRefresh }) => {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту награду?')) return;
    
    setDeleting(true);
    try {
      // Для VK: сначала отключаем награду, потом удаляем
      if (platform === 'vk' && reward.is_enabled) {
        const toggleResponse = await fetch(`${API_BASE_URL}/api/points/rewards/vk/${reward.id}/toggle`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_enabled: false })
        });
        
        if (!toggleResponse.ok) {
          toast.error('Не удалось отключить награду перед удалением');
          return;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${reward.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Награда удалена');
        onRefresh();
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Ошибка удаления награды');
      }
    } catch (err) {
      console.error('Error deleting reward:', err);
      toast.error('Не удалось удалить награду');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    if (platform !== 'vk') return; // Toggle только для VK

    setToggling(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/points/rewards/vk/${reward.id}/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !reward.is_enabled })
      });

      if (response.ok) {
        toast.success(reward.is_enabled ? 'Награда отключена' : 'Награда включена');
        onRefresh();
      } else {
        toast.error('Ошибка переключения награды');
      }
    } catch (err) {
      console.error('Error toggling reward:', err);
      toast.error('Не удалось переключить награду');
    } finally {
      setToggling(false);
    }
  };

  // Цвет для бейджа стоимости
  const bgColor = reward.background_color || (platform === 'vk' ? '#FF0000' : '#9147FF');

  return (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: bgColor }}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Левая часть: иконка и информация */}
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Цветная иконка */}
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: bgColor + '20' }}
            >
              <Gift className="w-8 h-8" style={{ color: bgColor }} />
            </div>
            
            {/* Информация */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold truncate">{reward.title}</h3>
                {platform === 'vk' && (
                  <Badge variant={reward.is_enabled ? 'default' : 'secondary'} className="flex-shrink-0">
                    {reward.is_enabled ? '✓ Активна' : '⊗ Выключена'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {reward.description || 'Нет описания'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono" style={{ borderColor: bgColor, color: bgColor }}>
                  {reward.cost} {platform === 'twitch' ? 'points' : 'баллов'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Правая часть: кнопки управления */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit} className="w-32">
              <Edit className="w-4 h-4 mr-2" />
              Изменить
            </Button>
            
            {platform === 'vk' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToggle}
                disabled={toggling}
                className="w-32"
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : reward.is_enabled ? (
                  <PowerOff className="w-4 h-4 mr-2" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                {reward.is_enabled ? 'Выключить' : 'Включить'}
              </Button>
            )}
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDelete}
              disabled={deleting}
              className="w-32"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Удалить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Диалог создания/редактирования награды
const RewardDialog = ({ open, onClose, reward, platform, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cost: 100
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reward) {
      setFormData({
        title: reward.title || '',
        description: reward.description || '',
        cost: reward.cost || 100
      });
    } else {
      setFormData({ title: '', description: '', cost: 100 });
    }
  }, [reward]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Введите название награды');
      return;
    }

    setSaving(true);
    try {
      const url = reward
        ? `${API_BASE_URL}/api/points/rewards/${platform}/${reward.id}`
        : `${API_BASE_URL}/api/points/rewards/${platform}/create`;
      
      const method = reward ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          cost: parseInt(formData.cost),
          background_color: '#9147ff',
          is_enabled: true
        })
      });

      if (response.ok) {
        toast.success(reward ? 'Награда обновлена' : 'Награда создана');
        onSuccess();
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Ошибка сохранения награды');
      }
    } catch (err) {
      console.error('Error saving reward:', err);
      toast.error('Не удалось сохранить награду');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reward ? 'Редактировать награду' : 'Создать награду'}</DialogTitle>
          <DialogDescription>
            {reward ? 'Измените параметры награды' : 'Укажите параметры новой награды'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например: Приветствие"
            />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Что получит зритель за эту награду?"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="cost">Стоимость ({platform === 'twitch' ? 'поинты' : 'баллы'})</Label>
            <Input
              id="cost"
              type="number"
              min="1"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {reward ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PointsManagementPage;
