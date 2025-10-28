import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Gift, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';

/**
 * Компонент для управления режимом TTS (все сообщения / за баллы канала)
 */
const TtsChannelPointsMode = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      const data = await apiClient.get('/api/tts/mode-settings');
      
      setTtsMode(data.tts_mode);
      setTtsRewardIds(data.tts_reward_ids || {});
    } catch (error) {
      console.error('Error loading TTS mode settings:', error);
      toast.error('Не удалось загрузить настройки режима TTS');
    } finally {
      setLoading(false);
    }
  };

  // Изменение режима TTS
  const handleModeChange = async (newMode) => {
    try {
      setSaving(true);
      
      await apiClient.post('/api/tts/mode-settings', { tts_mode: newMode });
      
      setTtsMode(newMode);
      toast.success(newMode === 'all_messages' 
        ? '💬 Озвучиваются все сообщения' 
        : '🎁 Озвучивается только за баллы'
      );
      
      await loadSettings();
    } catch (error) {
      console.error('Error changing TTS mode:', error);
      toast.error('Не удалось изменить режим TTS');
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
      
      toast.success(`🎁 TTS награда создана для ${selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}`);
      setShowCreateDialog(false);
      await loadSettings();
    } catch (error) {
      console.error('Error creating TTS reward:', error);
      toast.error(error.message || 'Не удалось создать TTS награду');
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
      
      toast.success(`TTS награда для ${platform.toUpperCase()} удалена`);
      await loadSettings();
    } catch (error) {
      console.error('Error deleting TTS reward:', error);
      toast.error('Не удалось удалить TTS награду');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Режим озвучки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const connectedPlatforms = [];
  if (user?.integrations?.twitch?.connected) connectedPlatforms.push('twitch');
  if (user?.integrations?.vk?.connected) connectedPlatforms.push('vk');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Режим озвучки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Выбор режима - компактный */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange('all_messages')}
              disabled={saving}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                ttsMode === 'all_messages'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold mb-1">💬 Все сообщения</div>
              <div className="text-xs text-muted-foreground">Стандартный режим</div>
            </button>

            <button
              onClick={() => handleModeChange('channel_points')}
              disabled={saving}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                ttsMode === 'channel_points'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold mb-1">🎁 За баллы канала</div>
              <div className="text-xs text-muted-foreground">Только с наградой</div>
            </button>
          </div>

          {/* Настройка наград (показываем только если выбран режим channel_points) */}
          {ttsMode === 'channel_points' && (
            <div className="space-y-3 pt-4 border-t">

              <div className="grid gap-3">
                {connectedPlatforms.map(platform => (
                  <Card key={platform} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {platform === 'twitch' ? (
                            <TwitchIcon className="w-5 h-5" />
                          ) : (
                            <VKIcon className="w-5 h-5" />
                          )}
                          <div>
                            <div className="font-semibold">
                              {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                            </div>
                            {ttsRewardIds[platform] ? (
                              <div className="text-xs text-muted-foreground">
                                Награда создана
                              </div>
                            ) : (
                              <div className="text-xs text-yellow-600">
                                Награда не создана
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {ttsRewardIds[platform] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteReward(platform)}
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openCreateDialog(platform)}
                            >
                              <Gift className="w-4 h-4 mr-2" />
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
        </CardContent>
      </Card>

      {/* Диалог создания награды */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TTS награда {selectedPlatform === 'twitch' ? '🟣 Twitch' : '🔵 VK Live'}</DialogTitle>
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
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TtsChannelPointsMode;

