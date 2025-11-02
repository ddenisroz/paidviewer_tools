import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Loader2, Power, PowerOff, Coins } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import { useIntegrations } from '../../context/IntegrationsContext';

const PointsRewards = ({ user, platform, channelName }) => {
  const { integrations } = useIntegrations();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cost: 100,
    is_user_input_required: false,
    // Twitch
    global_cooldown_seconds: 0,
    max_per_stream: 0,
    max_per_user_per_stream: 0,
    should_redemptions_skip_request_queue: false,
    // VK
    repair_timeout: 0,
    max_uses_count: 0,
    max_uses_count_per_user: 0,
    is_message_required: false
  });

  useEffect(() => {
    loadRewards();
  }, [user, platform, channelName]);

  const loadRewards = async () => {
    if (!user || !platform || !channelName) return;
    
    try {
      setLoading(true);
      const response = await botService.get(`/api/points/platform/rewards`, {
        params: { platform }
      });
      
      if (response.data.success) {
        setRewards(response.data.rewards || []);
      }
    } catch (error) {
      logger.error('Error loading platform rewards:', error);
      if (error.response?.status !== 404) {
        toast.error('Ошибка загрузки наград');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Введите название награды');
      return;
    }

    try {
      const rewardData = {
        title: formData.title,
        description: formData.description,
        cost: parseInt(formData.cost) || 100,
        is_user_input_required: formData.is_user_input_required,
        platform: platform,
        channel_name: channelName
      };

      // Добавляем платформо-специфичные поля
      if (platform === 'twitch') {
        rewardData.global_cooldown_seconds = parseInt(formData.global_cooldown_seconds) || 0;
        rewardData.max_per_stream = parseInt(formData.max_per_stream) || 0;
        rewardData.max_per_user_per_stream = parseInt(formData.max_per_user_per_stream) || 0;
        rewardData.should_redemptions_skip_request_queue = formData.should_redemptions_skip_request_queue;
      } else if (platform === 'vk') {
        rewardData.repair_timeout = parseInt(formData.repair_timeout) || 0;
        rewardData.max_uses_count = parseInt(formData.max_uses_count) || 0;
        rewardData.max_uses_count_per_user = parseInt(formData.max_uses_count_per_user) || 0;
        rewardData.is_message_required = formData.is_message_required;
      }

      if (editingReward) {
        await botService.put(`/api/points/platform/rewards/${editingReward.id}`, rewardData);
        toast.success('Награда обновлена');
      } else {
        await botService.post(`/api/points/platform/rewards/create`, rewardData, {
          params: { platform }
        });
        toast.success('Награда создана на платформе');
      }

      await loadRewards();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      logger.error('Error saving platform reward:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка сохранения награды';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (rewardId) => {
    if (!confirm('Удалить эту награду с платформы?')) return;

    try {
      await botService.delete(`/api/points/platform/rewards/${rewardId}`, {
        params: { platform }
      });
      toast.success('Награда удалена');
      await loadRewards();
    } catch (error) {
      logger.error('Error deleting reward:', error);
      toast.error('Ошибка удаления награды');
    }
  };

  const handleToggle = async (rewardId, enabled) => {
    try {
      await botService.put(`/api/points/platform/rewards/${rewardId}`, {
        is_enabled: !enabled
      }, {
        params: { platform }
      });
      toast.success(enabled ? 'Награда отключена' : 'Награда включена');
      await loadRewards();
    } catch (error) {
      logger.error('Error toggling reward:', error);
      toast.error('Ошибка изменения статуса награды');
    }
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
      is_message_required: false
    });
    setEditingReward(null);
  };

  const handleOpenDialog = (reward = null) => {
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
        is_message_required: reward.is_message_required || false
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
  const hasIntegration = integrations?.[platform]?.enabled || false;

  if (!hasIntegration) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center py-8 text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">Интеграция не подключена</h3>
            <p className="text-sm">
              Для создания наград через API {platform === 'twitch' ? 'Twitch' : 'VK'} необходимо подключить интеграцию в настройках
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Награды платформы ({platform === 'twitch' ? 'Twitch' : 'VK'})
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Создавайте и управляйте наградами за баллы канала через API платформы
              </CardDescription>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Создать награду
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Загрузка наград...</p>
            </div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">Награды не созданы</p>
              <p className="text-xs text-muted-foreground mb-4">
                Создайте награды за баллы, которые зрители смогут приобретать на {platform === 'twitch' ? 'Twitch' : 'VK'}
              </p>
              <Button onClick={() => handleOpenDialog()} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Создать первую награду
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{reward.title}</h4>
                      {!reward.is_enabled && (
                        <Badge variant="outline" className="text-xs">Отключено</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {reward.cost} баллов
                      </Badge>
                    </div>
                    {reward.description && (
                      <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(reward)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(reward.id)}
                    >
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'Редактировать награду' : 'Создать награду'}
            </DialogTitle>
            <DialogDescription>
              Награда будет создана на платформе {platform === 'twitch' ? 'Twitch' : 'VK'} через API
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Название */}
            <div className="space-y-2">
              <Label>Название награды *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Например: Крутка обычного сундука"
              />
            </div>

            {/* Описание */}
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
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
                onChange={(e) => setFormData({...formData, cost: parseInt(e.target.value) || 0})}
                min={1}
              />
            </div>

            {/* Требуется ввод от пользователя */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Требуется ввод от пользователя</Label>
                <p className="text-xs text-muted-foreground">
                  Зритель должен ввести сообщение при покупке награды
                </p>
              </div>
              <Switch
                checked={formData.is_user_input_required}
                onCheckedChange={(checked) => setFormData({...formData, is_user_input_required: checked})}
              />
            </div>

            {/* Платформо-специфичные настройки */}
            {platform === 'twitch' && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-sm">Настройки Twitch</h4>
                
                <div className="space-y-2">
                  <Label>Глобальный кулдаун (секунды)</Label>
                  <Input
                    type="number"
                    value={formData.global_cooldown_seconds}
                    onChange={(e) => setFormData({...formData, global_cooldown_seconds: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Макс. использований за стрим (0 = без ограничений)</Label>
                  <Input
                    type="number"
                    value={formData.max_per_stream}
                    onChange={(e) => setFormData({...formData, max_per_stream: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Макс. использований на пользователя за стрим (0 = без ограничений)</Label>
                  <Input
                    type="number"
                    value={formData.max_per_user_per_stream}
                    onChange={(e) => setFormData({...formData, max_per_user_per_stream: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Автоматически выполнять (пропустить очередь)</Label>
                    <p className="text-xs text-muted-foreground">
                      Награда будет выполнена автоматически без модерации
                    </p>
                  </div>
                  <Switch
                    checked={formData.should_redemptions_skip_request_queue}
                    onCheckedChange={(checked) => setFormData({...formData, should_redemptions_skip_request_queue: checked})}
                  />
                </div>
              </div>
            )}

            {platform === 'vk' && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-sm">Настройки VK Live</h4>
                
                <div className="space-y-2">
                  <Label>Таймаут ремонта (секунды)</Label>
                  <Input
                    type="number"
                    value={formData.repair_timeout}
                    onChange={(e) => setFormData({...formData, repair_timeout: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Макс. использований (0 = без ограничений)</Label>
                  <Input
                    type="number"
                    value={formData.max_uses_count}
                    onChange={(e) => setFormData({...formData, max_uses_count: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Макс. использований на пользователя (0 = без ограничений)</Label>
                  <Input
                    type="number"
                    value={formData.max_uses_count_per_user}
                    onChange={(e) => setFormData({...formData, max_uses_count_per_user: parseInt(e.target.value) || 0})}
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
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                editingReward ? 'Сохранить' : 'Создать'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PointsRewards;

