import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Gift, Plus, Edit, Trash2, Loader2, Power, PowerOff, Settings, AlertCircle, CheckCircle2, XCircle, Clock, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import pointsApi from '../services/pointsApi';
import { PLATFORM_COLORS } from '../constants/uiConstants';
import { logger } from '../utils/prodLogger';
import PageWrapper from '../components/PageWrapper';

const PointsManagementPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  
  // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
  // Если пользователь не авторизован - показываем сообщение с предложением войти
  if (!isAuthenticated) {
    return (
      <PageWrapper title="Баллы канала">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Требуется авторизация
              </h3>
              <p className="text-gray-400 text-sm">
                Для использования управления баллами необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
              </p>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Войти в систему
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }
  
  const [selectedPlatform, setSelectedPlatform] = useState('twitch'); // vk или twitch
  const [activeTab, setActiveTab] = useState('rewards'); // rewards или queue
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);

  // Определяем доступные платформы
  const twitchEnabled = integrations?.twitch?.enabled || false;
  const vkEnabled = integrations?.vk?.enabled || false;

  // Устанавливаем дефолтную платформу на основе доступных интеграций
  useEffect(() => {
    if (twitchEnabled && selectedPlatform === 'twitch') {
      // Twitch доступен и уже выбран - ничего не меняем
      return;
    } else if (vkEnabled && selectedPlatform === 'vk') {
      // VK доступен и уже выбран - ничего не меняем
      return;
    } else if (twitchEnabled) {
      // Twitch доступен - выбираем его
      setSelectedPlatform('twitch');
    } else if (vkEnabled) {
      // VK доступен - выбираем его
      setSelectedPlatform('vk');
    }
  }, [twitchEnabled, vkEnabled]);

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
      {/* Header - заголовок теперь в Header компоненте */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Вкладки и выбор платформы в одной строке */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex">
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
          
          {/* Переключатель платформ - показываем только подключенные */}
          {(twitchEnabled || vkEnabled) && (
            <div className="flex bg-muted rounded-lg p-1">
              {twitchEnabled && (
                <Button
                  variant={selectedPlatform === 'twitch' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedPlatform('twitch')}
                  className="gap-1.5 h-8"
                >
                  <TwitchIcon className="w-3.5 h-3.5" />
                  Twitch
                </Button>
              )}
              {vkEnabled && (
                <Button
                  variant={selectedPlatform === 'vk' ? 'default' : 'ghost'}
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
              )}
            </div>
          )}
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
      // Backend автоматически отключает награду перед удалением для VK
      // Но для надежности пытаемся отключить на frontend тоже, если награда включена
      if (platform === 'vk' && reward.is_enabled) {
        try {
          logger.log(`🔄 [DELETE] Attempting to disable VK reward ${reward.id} before deletion`);
          await pointsApi.toggleReward(platform, reward.id, false);
          // Небольшая задержка чтобы VK API обработал
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (toggleErr) {
          // Игнорируем ошибку - backend попытается отключить автоматически
          logger.warn('Toggle before delete failed (backend will handle it):', toggleErr.message);
        }
      }

      await pointsApi.deleteReward(platform, reward.id);
      toast.success('Награда удалена');
      onRefresh();
    } catch (err) {
      logger.error('Error deleting reward:', err);
      toast.error(err.message || 'Ошибка удаления награды');
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
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [filterType, setFilterType] = useState('all'); // 'all', 'tts', 'other'

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
      toast.success('Награда принята');
      // Optimistic update - удаляем из списка без перезагрузки
      setRedemptions(prev => prev.filter(d => d.id !== redemptionId));
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(redemptionId);
        return next;
      });
    } catch (err) {
      logger.error('Error accepting redemption:', err);
      toast.error('Ошибка принятия награды');
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
      toast.success('Награда отклонена');
      // Optimistic update - удаляем из списка без перезагрузки
      setRedemptions(prev => prev.filter(d => d.id !== redemptionId));
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(redemptionId);
        return next;
      });
    } catch (err) {
      logger.error('Error rejecting redemption:', err);
      toast.error('Ошибка отклонения награды');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(redemptionId);
        return next;
      });
    }
  };

  // Массовое принятие
  const handleBulkAccept = async () => {
    if (selectedItems.size === 0) return;
    
    const ids = Array.from(selectedItems);
    setProcessing(prev => new Set([...prev, ...ids]));
    try {
      await pointsApi.processVKDemands('accept', ids);
      toast.success(`Принято наград: ${ids.length}`);
      // Optimistic update - удаляем из списка без перезагрузки
      setRedemptions(prev => prev.filter(d => !ids.includes(d.id)));
      setSelectedItems(new Set());
    } catch (err) {
      logger.error('Error bulk accepting:', err);
      toast.error('Ошибка массового принятия');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  // Массовое отклонение
  const handleBulkReject = async () => {
    if (selectedItems.size === 0) return;
    
    const ids = Array.from(selectedItems);
    setProcessing(prev => new Set([...prev, ...ids]));
    try {
      await pointsApi.processVKDemands('reject', ids);
      toast.success(`Отклонено наград: ${ids.length}`);
      // Optimistic update - удаляем из списка без перезагрузки
      setRedemptions(prev => prev.filter(d => !ids.includes(d.id)));
      setSelectedItems(new Set());
    } catch (err) {
      logger.error('Error bulk rejecting:', err);
      toast.error('Ошибка массового отклонения');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  // Фильтрация наград
  const filteredRedemptions = redemptions.filter((demand) => {
    if (filterType === 'all') return true;
    
    const rewardData = rewardsMap.get(demand.reward?.id);
    const rewardTitle = (rewardData?.name || rewardData?.title || '').toLowerCase();
    
    if (filterType === 'tts') {
      return rewardTitle.includes('озвучка') || rewardTitle.includes('tts') || rewardTitle.includes('голос');
    } else {
      return !rewardTitle.includes('озвучка') && !rewardTitle.includes('tts') && !rewardTitle.includes('голос');
    }
  });

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
    <div className="min-h-[400px] space-y-4">
      {/* Фильтры и массовые действия - улучшенный дизайн */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">Фильтр:</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Выберите фильтр" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все награды</SelectItem>
                    <SelectItem value="tts">TTS Озвучка</SelectItem>
                    <SelectItem value="other">Другие</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
          {filteredRedemptions.length > 0 && (
            <>
                  <div className="h-6 w-px bg-gray-700" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Найдено: <span className="font-semibold text-foreground">{filteredRedemptions.length}</span>
              </span>
              <Button
                size="sm"
                      variant="outline"
                onClick={() => {
                  const allSelected = filteredRedemptions.every(d => selectedItems.has(d.id));
                  if (allSelected) {
                    setSelectedItems(new Set());
                  } else {
                    setSelectedItems(new Set(filteredRedemptions.map(d => d.id)));
                  }
                }}
                      className="whitespace-nowrap"
              >
                {filteredRedemptions.every(d => selectedItems.has(d.id)) ? 'Снять всё' : 'Отметить всё'}
              </Button>
                  </div>
            </>
          )}
        </div>
        
        {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                  <span className="text-sm font-medium text-primary">Выбрано: {selectedItems.size}</span>
                </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleBulkAccept}
              disabled={Array.from(selectedItems).some(id => processing.has(id))}
                  className="whitespace-nowrap"
            >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Принять ({selectedItems.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkReject}
              disabled={Array.from(selectedItems).some(id => processing.has(id))}
                  className="whitespace-nowrap"
            >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Отклонить ({selectedItems.size})
            </Button>
          </div>
        )}
      </div>
        </CardContent>
      </Card>

      {Array.isArray(filteredRedemptions) && filteredRedemptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Нет запросов по выбранному фильтру
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRedemptions.map((demand, index) => {
        const rewardData = rewardsMap.get(demand.reward?.id);
        const rewardTitle = rewardData?.name || rewardData?.title || 'Неизвестная награда';
        const rewardCost = rewardData?.price || rewardData?.cost || 0;
        const isTtsReward = rewardTitle.toLowerCase().includes('озвучка') || rewardTitle.toLowerCase().includes('tts') || rewardTitle.toLowerCase().includes('голос');
        
        // Собираем сообщение из message_parts (правильно обрабатываем объекты)
        let message = '';
        if (Array.isArray(demand.message_parts) && demand.message_parts.length > 0) {
          message = demand.message_parts.map(part => {
            // Если это объект, извлекаем текст по ключам VK API
            if (typeof part === 'object' && part !== null) {
              // VK API структура: { "text": { "content": "..." }, "mention": { "nick": "..." }, etc }
              if (part.text && part.text.content) return part.text.content;
              if (part.mention && part.mention.nick) return `@${part.mention.nick}`;
              if (part.link && part.link.content) return part.link.content;
              if (part.smile && part.smile.name) return part.smile.name;
              // Fallback для неизвестных структур
              return part.text || part.content || part.message || JSON.stringify(part);
            }
            // Если это строка, возвращаем как есть
            return String(part);
          }).join(' ').trim();
        } else if (typeof demand.message === 'string') {
          message = demand.message;
        } else if (demand.message && typeof demand.message === 'object') {
          // Если message это объект, пытаемся извлечь текст
          message = demand.message.text || demand.message.content || JSON.stringify(demand.message);
        }
        
        const isSelected = selectedItems.has(demand.id);
        const isProcessing = processing.has(demand.id);
        const userName = demand.user?.nick || demand.user?.name || 'Пользователь';
        const timestamp = demand.created_at ? new Date(demand.created_at * 1000).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : 'Неизвестно';
        
        return (
          <Card 
            key={demand.id || index} 
            className={`transition-all hover:shadow-lg ${isSelected ? 'ring-2 ring-primary border-primary/50' : 'border-gray-700/50'} ${isProcessing ? 'opacity-60' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Чекбокс для выбора - улучшенный стиль */}
                <div className="mt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    setSelectedItems(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        next.add(demand.id);
                      } else {
                        next.delete(demand.id);
                      }
                      return next;
                    });
                  }}
                  disabled={isProcessing}
                    className="w-4 h-4 rounded border-gray-600 bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-primary"
                />
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Заголовок карточки */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                          <span className="text-xs font-bold text-primary">
                            {(userName[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-sm truncate">{userName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Информация о награде */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge 
                      variant={isTtsReward ? "default" : "outline"} 
                      className={`text-xs font-medium ${isTtsReward ? 'bg-purple-600/20 text-purple-300 border-purple-600/30' : 'bg-gray-800/50'}`}
                    >
                      {rewardTitle}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-mono bg-blue-600/20 text-blue-300 border-blue-600/30">
                      {rewardCost} баллов
                    </Badge>
                  </div>

                  {/* Сообщение */}
                  {message && (
                    <div className="mb-3 p-3 rounded-md bg-gray-800/50 border border-gray-700/50">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm text-foreground break-words flex-1 leading-relaxed">
                          {message}
                    </p>
                      </div>
                    </div>
                  )}

                  {/* Время */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timestamp}</span>
                  </div>
                </div>

                {/* Кнопки действий - вертикальное расположение для лучшего UX */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAccept(demand.id);
                    }}
                    disabled={isProcessing}
                    className="min-w-[100px] h-9"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Принять
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(demand.id);
                    }}
                    disabled={isProcessing}
                    className="min-w-[100px] h-9"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Отклонить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
        </div>
      )}
    </div>
  );
};

RedemptionQueue.propTypes = {
  platform: PropTypes.string.isRequired,
};

export default PointsManagementPage;
