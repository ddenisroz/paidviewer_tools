import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';

/**
 * Компонент для управления режимом TTS (все сообщения / за баллы канала)
 * Теперь используется внутри TtsControlPanel
 */
const TtsChannelPointsMode = ({ asSection = false }) => {
  const { user } = useAuth();
  const [ttsMode, setTtsMode] = useState('all_messages'); // 'all_messages' или 'channel_points'
  const [ttsRewardIds, setTtsRewardIds] = useState({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Форма создания награды
  const [rewardForm, setRewardForm] = useState({
    title: '',
    cost: 100,
    cooldown: 0
  });

  // Загрузка текущих настроек
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.get('/api/tts/mode-settings');
      
      setTtsMode(data.tts_mode);
      setTtsRewardIds(data.tts_reward_ids || {});
    } catch (error) {
      console.error('Error loading TTS mode settings:', error);
      // Не показываем toast при первой загрузке - данные по умолчанию уже корректны
    }
  };

  // Изменение режима TTS
  const handleModeChange = async (newMode) => {
    try {
      setSaving(true);
      
      await apiClient.post('/api/tts/mode-settings', { tts_mode: newMode });
      
      setTtsMode(newMode);
      toast.success(newMode === 'all_messages' 
        ? 'Режим: все сообщения' 
        : 'Режим: за баллы канала'
      );
      
      await loadSettings();
    } catch (error) {
      console.error('Error changing TTS mode:', error);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setSaving(false);
    }
  };

  // Открыть диалог создания награды
  const openCreateDialog = (platform) => {
    setSelectedPlatform(platform);
    setRewardForm({
      title: `TTS Озвучка (${platform.toUpperCase()})`,
      cost: 100,
      cooldown: 0
    });
    setShowCreateDialog(true);
  };

  // Создать награду TTS
  const handleCreateReward = async () => {
    try {
      if (!rewardForm.title.trim()) {
        toast.error('Введите название награды');
        return;
      }

      setSaving(true);
      
      await apiClient.post('/api/tts/create-reward', {
        platform: selectedPlatform,
        title: rewardForm.title,
        cost: rewardForm.cost,
        cooldown: rewardForm.cooldown
      });
      
      toast.success('Награда создана');
      setShowCreateDialog(false);
      await loadSettings();
    } catch (error) {
      console.error('Error creating TTS reward:', error);
      // apiClient.js уже показывает toast при ошибках
    } finally {
      setSaving(false);
    }
  };

  // Удалить награду TTS
  const handleDeleteReward = async (platform) => {
    if (!confirm(`Удалить TTS награду для ${platform.toUpperCase()}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/tts/reward/${platform}`);
      
      toast.success('Награда удалена');
      await loadSettings();
    } catch (error) {
      console.error('Error deleting TTS reward:', error);
      // apiClient.js уже показывает toast при ошибках
    }
  };

  const connectedPlatforms = [];
  if (user?.integrations?.twitch?.connected) connectedPlatforms.push('twitch');
  if (user?.integrations?.vk?.connected) connectedPlatforms.push('vk');

    return (
        <div className="space-y-3">
            {/* Выбор режима - компактный БЕЗ эмодзи */}
            <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleModeChange('all_messages')}
            disabled={saving}
            className={`p-2.5 rounded-lg border-2 transition-all text-left ${
              ttsMode === 'all_messages'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-sm mb-0.5">Все сообщения</div>
            <div className="text-xs text-muted-foreground">Стандартный режим</div>
          </button>

          <button
            onClick={() => handleModeChange('channel_points')}
            disabled={saving}
            className={`p-2.5 rounded-lg border-2 transition-all text-left ${
              ttsMode === 'channel_points'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-semibold text-sm mb-0.5">За баллы канала</div>
            <div className="text-xs text-muted-foreground">Только с наградой</div>
          </button>
        </div>

          {/* Настройка наград (показываем только если выбран режим channel_points) */}
          {ttsMode === 'channel_points' && (
            <div className="space-y-2 pt-3 border-t border-gray-700/30">

              <div className="grid grid-cols-2 gap-2">
                {connectedPlatforms.map(platform => (
                  <Card key={platform} className="border-2">
                    <CardContent className="p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {platform === 'twitch' ? (
                            <TwitchIcon className="w-4 h-4" />
                          ) : (
                            <VKIcon className="w-4 h-4" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">
                              {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                            </div>
                            {ttsRewardIds[platform] ? (
                              <div className="text-xs text-muted-foreground">
                                Создана
                              </div>
                            ) : (
                              <div className="text-xs text-yellow-600">
                                Не создана
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          {ttsRewardIds[platform] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteReward(platform)}
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Удалить
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openCreateDialog(platform)}
                              className="w-full"
                            >
                              Создать
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {connectedPlatforms.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
                  Подключите хотя бы одну платформу (Twitch или VK Live) в настройках интеграций
                </div>
              )}
            </div>
          )}

      {/* Диалог создания награды */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TTS награда для {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={rewardForm.title}
                onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                placeholder="Озвучить моё сообщение"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cost">Цена</Label>
                <Input
                  id="cost"
                  type="number"
                  min="1"
                  value={rewardForm.cost}
                  onChange={(e) => setRewardForm({ ...rewardForm, cost: parseInt(e.target.value) })}
                  placeholder="100"
                />
              </div>

              <div>
                <Label htmlFor="cooldown">Кулдаун (сек)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min="0"
                  value={rewardForm.cooldown}
                  onChange={(e) => setRewardForm({ ...rewardForm, cooldown: parseInt(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateReward} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TtsChannelPointsMode;

