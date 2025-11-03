import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
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
import pointsApi from '../services/pointsApi';
import { PLATFORM_COLORS } from '../constants/uiConstants';
import { logger } from '../utils/prodLogger';

const PointsManagementPage = () => {
  const { user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState('twitch'); // vk или twitch
  const [activeTab, setActiveTab] = useState('rewards'); // rewards или queue
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);

  // Загрузка наград с выбранной платформы
  const loadRewards = async () => {
    try {
      setLoading(true);
      const data = await pointsApi.getRewards(selectedPlatform);
      
      // Сортируем: активные впереди, неактивные сзади
      const sortedRewards = (data.rewards || []).sort((a, b) => {
        if (a.is_enabled === b.is_enabled) return 0;
        return a.is_enabled ? -1 : 1; // активные (true) впереди
      });
      
      setRewards(sortedRewards);
    } catch (err) {
      logger.error('Error loading rewards:', err);
      const errorMessage = err.message || 'Неизвестная ошибка';
      
      // Обработка специфичных ошибок
      if (err.status === 404) {
        toast.error('Платформа не подключена. Авторизуйтесь через настройки', { duration: 5000 });
      } else if (err.status === 403 || errorMessage.includes('партнёров и аффилейтов') || errorMessage.includes('partner or affiliate')) {
        toast.error('Награды Twitch доступны только для партнёров и аффилейтов', { duration: 5000 });
      } else {
        // Показываем сообщение об ошибке из API
        toast.error(errorMessage, { duration: 5000 });
      }
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
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Награды за баллы</h1>
          </div>
          
          {/* Переключатель платформ */}
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={selectedPlatform === 'twitch' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedPlatform('twitch')}
              className="gap-1.5 h-8"
            >
              <TwitchIcon className="w-3.5 h-3.5" />
              Twitch
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPlatform('vk')}
              className={`gap-1.5 h-8 ${
                selectedPlatform === 'vk' 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'hover:bg-muted'
              }`}
            >
              <VKIcon className="w-3.5 h-3.5" />
              VK Live
            </Button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'rewards'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Награды
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'queue'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Очередь запросов
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="min-h-[400px]">
        {/* Кнопка создания - всегда резервируем место, но видна только во вкладке Награды */}
        <div className="mb-6 h-10">
          {activeTab === 'rewards' && (
            <Button onClick={() => setShowCreateDialog(true)} className="w-full h-10" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Создать награду
            </Button>
          )}
        </div>
        
        {/* Контент вкладок */}
        <div>
          {activeTab === 'rewards' ? (
            <div>
              {/* Награды в grid layout */}
              {rewards.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground font-medium">Нет наград</p>
                    <p className="text-xs text-muted-foreground mt-1">Создайте первую награду для зрителей!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      platform={selectedPlatform}
                      onEdit={() => setEditingReward(reward)}
                      onRefresh={loadRewards}
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

/**
 * Displays a reward card with title, description, cost, and action buttons
 * @param {Object} props
 * @param {Object} props.reward - Reward object from API
 * @param {'twitch'|'vk'} props.platform - Platform identifier
 * @param {Function} props.onEdit - Callback when edit button clicked
 * @param {Function} props.onRefresh - Callback to refresh rewards list
 */
const RewardCard = ({ reward, platform, onEdit, onRefresh }) => {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту награду?')) return;
    
    setDeleting(true);
    try {
      // Для VK: ВСЕГДА отключаем награду перед удалением (VK API требование)
      if (platform === 'vk') {
        try {
          await pointsApi.toggleReward(platform, reward.id, false);
          // Небольшая задержка чтобы VK API обработал
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (toggleErr) {
          // Ignore toggle error, награда может быть уже отключена
          logger.log('Toggle before delete:', toggleErr.message);
        }
      }

      await pointsApi.deleteReward(platform, reward.id);
      toast.success('Награда удалена');
      onRefresh();
    } catch (err) {
      logger.error('Error deleting reward:', err);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    if (platform !== 'vk') return; // Toggle только для VK

    setToggling(true);
    const newState = !reward.is_enabled;
    
    try {
      await pointsApi.toggleReward(platform, reward.id, newState);
      // Молча обновляем - не спамим уведомлениями
      await onRefresh();
    } catch (err) {
      logger.error('Error toggling reward:', err);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setToggling(false);
    }
  };

  // Цвет для бейджа стоимости
  const bgColor = reward.background_color || (platform === 'vk' ? PLATFORM_COLORS.VK_LIVE : PLATFORM_COLORS.TWITCH);

  return (
    <Card className="transition-all hover:ring-2 hover:ring-primary">
      <CardContent className="p-5">
        {/* Header с названием и статусом */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold mb-1 line-clamp-2">{reward.title}</h3>
            {platform === 'vk' && (
              <Badge variant={reward.is_enabled ? 'default' : 'secondary'} className="text-xs">
                {reward.is_enabled ? '✓ Активна' : '○ Выключена'}
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

        {/* Описание */}
        {reward.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {reward.description}
          </p>
        )}

        {/* Кнопки управления */}
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
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

RewardCard.propTypes = {
  reward: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    cost: PropTypes.number.isRequired,
    is_enabled: PropTypes.bool,
    background_color: PropTypes.string
  }).isRequired,
  platform: PropTypes.oneOf(['twitch', 'vk']).isRequired,
  onEdit: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired
};

/**
 * Dialog for creating or editing a reward
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Function} props.onClose - Close dialog callback
 * @param {Object} props.reward - Reward to edit (null for create)
 * @param {'twitch'|'vk'} props.platform - Platform identifier
 * @param {Function} props.onSuccess - Success callback
 */
const RewardDialog = ({ open, onClose, reward, platform, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cost: 100,
    // VK Live специфичные поля
    repair_timeout: 0,
    max_uses_count: 0,
    max_uses_count_per_user: 0,
    is_message_required: false,
    // Twitch специфичные поля
    global_cooldown_seconds: 0,
    max_per_stream: 0,
    max_per_user_per_stream: 0,
    should_redemptions_skip_request_queue: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reward) {
      setFormData({
        title: reward.title || reward.name || '',
        description: reward.description || reward.prompt || '',
        cost: reward.cost || reward.price || 100,
        // VK Live специфичные поля
        repair_timeout: reward.repair_timeout || 0,
        max_uses_count: reward.max_uses_count || 0,
        max_uses_count_per_user: reward.max_uses_count_per_user || 0,
        is_message_required: reward.is_message_required || false,
        // Twitch специфичные поля
        global_cooldown_seconds: reward.global_cooldown?.seconds || reward.global_cooldown_seconds || 0,
        max_per_stream: reward.max_per_stream || 0,
        max_per_user_per_stream: reward.max_per_user_per_stream || 0,
        should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue || false
      });
    } else {
      setFormData({ 
        title: '', 
        description: '', 
        cost: 100,
        repair_timeout: 0,
        max_uses_count: 0,
        max_uses_count_per_user: 0,
        is_message_required: false,
        global_cooldown_seconds: 0,
        max_per_stream: 0,
        max_per_user_per_stream: 0,
        should_redemptions_skip_request_queue: false
      });
    }
  }, [reward, platform]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Введите название награды');
      return;
    }

    setSaving(true);
    try {
      // Общие поля для обеих платформ
      let rewardData = {
        title: formData.title,
        description: formData.description,
        cost: parseInt(formData.cost),
        is_user_input_required: formData.is_message_required,
        platform: platform,
        channel_name: ''
      };

      // Для VK добавляем специфичные поля
      if (platform === 'vk') {
        rewardData = {
          ...rewardData,
          repair_timeout: parseInt(formData.repair_timeout) || 0,
          max_uses_count: parseInt(formData.max_uses_count) || 0,
          max_uses_count_per_user: parseInt(formData.max_uses_count_per_user) || 0,
          is_message_required: formData.is_message_required
        };
      }
      
      // Для Twitch добавляем специфичные поля
      if (platform === 'twitch') {
        rewardData = {
          ...rewardData,
          global_cooldown_seconds: parseInt(formData.global_cooldown_seconds) || 0,
          max_per_stream: parseInt(formData.max_per_stream) || 0,
          max_per_user_per_stream: parseInt(formData.max_per_user_per_stream) || 0,
          should_redemptions_skip_request_queue: formData.should_redemptions_skip_request_queue,
          is_enabled: true
        };
      }

      if (reward) {
        await pointsApi.updateReward(platform, reward.id, rewardData);
        toast.success('Награда обновлена');
      } else {
        await pointsApi.createReward(platform, rewardData);
        toast.success('Награда создана');
      }
      
      onSuccess();
    } catch (err) {
      logger.error('Error saving reward:', err);
      // apiClient.js уже показывает toast при ошибках
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
            <Label htmlFor="title" className="text-sm">Название</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например: Приветствие"
              className="h-9"
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-sm">Описание (опционально)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Что получит зритель за эту награду?"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          
          <div>
            <Label htmlFor="cost" className="text-sm">Стоимость</Label>
            <Input
              id="cost"
              type="number"
              min="1"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {platform === 'twitch' ? 'Channel Points' : 'Баллы VK Live'}
            </p>
          </div>

          {/* VK Live специфичные настройки */}
          {platform === 'vk' && (
            <>
              <div>
                <Label htmlFor="repair_timeout" className="text-sm">Кулдаун (секунды)</Label>
                <Input
                  id="repair_timeout"
                  type="number"
                  min="0"
                  value={formData.repair_timeout}
                  onChange={(e) => setFormData({ ...formData, repair_timeout: e.target.value })}
                  className="h-9"
                  placeholder="0 = без кулдауна"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Время восстановления награды (0 = без ограничений)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="max_uses_count" className="text-sm">Макс. использований</Label>
                  <Input
                    id="max_uses_count"
                    type="number"
                    min="0"
                    value={formData.max_uses_count}
                    onChange={(e) => setFormData({ ...formData, max_uses_count: e.target.value })}
                    className="h-9"
                    placeholder="0 = без лимита"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Всего (0 = ∞)
                  </p>
                </div>

                <div>
                  <Label htmlFor="max_uses_count_per_user" className="text-sm">Макс. на юзера</Label>
                  <Input
                    id="max_uses_count_per_user"
                    type="number"
                    min="0"
                    value={formData.max_uses_count_per_user}
                    onChange={(e) => setFormData({ ...formData, max_uses_count_per_user: e.target.value })}
                    className="h-9"
                    placeholder="0 = без лимита"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    На 1 человека (0 = ∞)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_message_required"
                  type="checkbox"
                  checked={formData.is_message_required}
                  onChange={(e) => setFormData({ ...formData, is_message_required: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="is_message_required" className="text-sm cursor-pointer">
                  Требовать сообщение от зрителя
                </Label>
              </div>
            </>
          )}

          {/* Twitch специфичные настройки */}
          {platform === 'twitch' && (
            <>
              <div>
                <Label htmlFor="global_cooldown_seconds" className="text-sm">Глобальный кулдаун (секунды)</Label>
                <Input
                  id="global_cooldown_seconds"
                  type="number"
                  min="0"
                  value={formData.global_cooldown_seconds}
                  onChange={(e) => setFormData({ ...formData, global_cooldown_seconds: e.target.value })}
                  className="h-9"
                  placeholder="0 = без кулдауна"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Время ожидания между активациями (0 = без ограничений)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="max_per_stream" className="text-sm">Макс. за стрим</Label>
                  <Input
                    id="max_per_stream"
                    type="number"
                    min="0"
                    value={formData.max_per_stream}
                    onChange={(e) => setFormData({ ...formData, max_per_stream: e.target.value })}
                    className="h-9"
                    placeholder="0 = без лимита"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Всего за стрим (0 = ∞)
                  </p>
                </div>

                <div>
                  <Label htmlFor="max_per_user_per_stream" className="text-sm">Макс. на юзера за стрим</Label>
                  <Input
                    id="max_per_user_per_stream"
                    type="number"
                    min="0"
                    value={formData.max_per_user_per_stream}
                    onChange={(e) => setFormData({ ...formData, max_per_user_per_stream: e.target.value })}
                    className="h-9"
                    placeholder="0 = без лимита"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    На 1 человека за стрим (0 = ∞)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="should_redemptions_skip_request_queue"
                  type="checkbox"
                  checked={formData.should_redemptions_skip_request_queue}
                  onChange={(e) => setFormData({ ...formData, should_redemptions_skip_request_queue: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="should_redemptions_skip_request_queue" className="text-sm cursor-pointer">
                  Автоматическое выполнение (без очереди)
                </Label>
              </div>
            </>
          )}
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

RewardDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  reward: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    cost: PropTypes.number
  }),
  platform: PropTypes.oneOf(['twitch', 'vk']).isRequired,
  onSuccess: PropTypes.func.isRequired
};

/**
 * Компонент для отображения и управления очередью запросов на награды
 */
const RedemptionQueue = ({ platform }) => {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(new Set());
  const [rewardsMap, setRewardsMap] = useState(new Map());

  // Загрузка очереди
  const loadRedemptions = useCallback(async () => {
    try {
      setLoading(true);
      if (platform === 'vk') {
        // Сначала загружаем награды для получения названий
        const rewardsData = await pointsApi.getRewards('vk');
        const map = new Map();
        if (rewardsData.rewards) {
          rewardsData.rewards.forEach(reward => {
            map.set(reward.id, reward);
          });
        }
        setRewardsMap(map);

        // Затем загружаем demands
        const data = await pointsApi.getVKDemands();
        
        // Парсим demands в зависимости от структуры
        let demands = [];
        if (Array.isArray(data.demands)) {
          demands = data.demands;
        } else if (data.demands && typeof data.demands === 'object') {
          // Если это объект, конвертируем в массив
          if (data.demands.items && Array.isArray(data.demands.items)) {
            // Структура { items: [...], count: N }
            demands = data.demands.items;
          } else if (data.demands.demands && Array.isArray(data.demands.demands)) {
            // Структура { demands: [...] }
            demands = data.demands.demands;
          } else {
            // Преобразуем объект в массив значений { "id1": {...}, "id2": {...} }
            const values = Object.values(data.demands);
            // Если первый элемент - это массив, значит неправильно распарсили
            if (values.length === 1 && Array.isArray(values[0])) {
              demands = values[0];
            } else {
              demands = values;
            }
          }
        }
        
        setRedemptions(demands);
      } else {
        // Twitch пока не поддерживается (требует партнерство)
        setRedemptions([]);
      }
    } catch (err) {
      logger.error('Error loading redemptions:', err);
      toast.error('Не удалось загрузить очередь запросов');
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    loadRedemptions();
  }, [loadRedemptions]);

  const handleAccept = async (redemptionId) => {
    setProcessing(prev => new Set(prev).add(redemptionId));
    try {
      await pointsApi.processVKDemands('accept', [redemptionId]);
      // Молча обновляем - не спамим уведомлениями
      loadRedemptions();
    } catch (err) {
      logger.error('Error accepting redemption:', err);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(redemptionId);
        return next;
      });
    }
  };

  const handleReject = async (redemptionId) => {
    setProcessing(prev => new Set(prev).add(redemptionId));
    try {
      await pointsApi.processVKDemands('reject', [redemptionId]);
      // Молча обновляем - не спамим уведомлениями
      loadRedemptions();
    } catch (err) {
      logger.error('Error rejecting redemption:', err);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(redemptionId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (redemptions.length === 0) {
    return (
      <div className="min-h-[400px]">
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Нет ожидающих запросов
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Когда зрители активируют награды, они появятся здесь
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-h-[400px]">
      {Array.isArray(redemptions) && redemptions.map((demand, index) => {
        const rewardData = rewardsMap.get(demand.reward?.id);
        const rewardTitle = rewardData?.name || rewardData?.title || 'Неизвестная награда';
        const rewardCost = rewardData?.price || rewardData?.cost || 0;
        
        // Собираем сообщение из message_parts (если это массив)
        let message = '';
        if (Array.isArray(demand.message_parts) && demand.message_parts.length > 0) {
          message = demand.message_parts.join(' ');
        } else if (typeof demand.message === 'string') {
          message = demand.message;
        }
        
        return (
          <Card key={demand.id || index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{demand.user?.nick || demand.user?.name || 'Пользователь'}</span>
                    <Badge variant="outline" className="text-xs">
                      {rewardTitle}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {rewardCost} баллов
                    </Badge>
                  </div>
                  {message && (
                    <p className="text-sm text-muted-foreground mt-2">
                      💬 {message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    🕐 {demand.created_at ? new Date(demand.created_at * 1000).toLocaleString('ru-RU') : 'Неизвестно'}
                  </p>
                </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAccept(demand.id)}
                  disabled={processing.has(demand.id)}
                  className="h-8"
                >
                  {processing.has(demand.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Принять'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(demand.id)}
                  disabled={processing.has(demand.id)}
                  className="h-8"
                >
                  Отклонить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
};

RedemptionQueue.propTypes = {
  platform: PropTypes.string.isRequired,
};

export default PointsManagementPage;
