import React, { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { toast } from '@/utils/toastManager';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { queryKeys } from '../../../queries/queryKeys';
import { useCreateTtsReward, useDeleteTtsReward, useTtsModeSettings } from '../../../queries/tts/ttsQueries';
import { TwitchIcon, VKIcon } from '../../../shared/components/PlatformIcons';
import { logger } from '../../../utils/prodLogger';

interface TtsChannelPointsModeProps {
  ttsMode: string;
  onModeChange: (mode: 'all_messages' | 'channel_points') => void;
  isSaving: boolean;
  showModeSelector?: boolean;
  showRewards?: boolean;
}

interface RewardForm {
  title: string;
  cost: number;
  cooldown: number;
}

/**
 * Компонент для управления режимом TTS (все сообщения / за баллы канала)
 */
const TtsChannelPointsMode: React.FC<TtsChannelPointsModeProps> = ({
  ttsMode,
  onModeChange,
  isSaving,
  showModeSelector = true,
  showRewards = true
}) => {
  const { user } = useAuth();
  const { integrations } = useIntegrations();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Форма создания награды
  const [rewardForm, setRewardForm] = useState<RewardForm>({
    title: '',
    cost: 500,
    cooldown: 0
  });

  // [OK] НОВЫЙ КОД: Используем централизованный hook для режима TTS
  const { data: modeSettingsResponse, isLoading: isLoadingRewards, refetch: refetchModeSettings } = useTtsModeSettings({
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Всегда считаем данные устаревшими для немедленного обновления
  });
  const modeSettingsData = (modeSettingsResponse as { data?: { tts_reward_ids?: Record<string, string> } })?.data;

  const ttsRewardIds = modeSettingsData?.tts_reward_ids || {};

  // Открыть диалог создания награды
  const openCreateDialog = (platform: string) => {
    setSelectedPlatform(platform);
    setRewardForm({
      title: `TTS Озвучка сообщения`,
      cost: 500,
      cooldown: 0
    });
    setShowCreateDialog(true);
  };

  // [OK] НОВЫЙ КОД: Используем централизованный hook для создания награды
  const createTtsRewardMutation = useCreateTtsReward({
    onSuccess: (response) => {
      // Оптимистичное обновление - сразу обновляем кэш с новым reward_id
      const responseData = response as { data?: { reward_id?: string } };
      const rewardId = responseData.data?.reward_id;
      if (rewardId && modeSettingsData && selectedPlatform) {
        queryClient.setQueryData(queryKeys.tts.modeSettings(), (oldData: Record<string, unknown> | undefined) => {
          if (!oldData) return oldData;
          const oldRewardIds = (oldData.tts_reward_ids || {}) as Record<string, unknown>;
          return {
            ...oldData,
            tts_reward_ids: {
              ...oldRewardIds,
              [selectedPlatform]: rewardId
            }
          };
        });
      }
      // Принудительно обновляем данные с сервера
      refetchModeSettings();
      setShowCreateDialog(false);
      // toast уже показан в hook
    },
    onError: (error) => {
      logger.error('Error creating TTS reward:', error);
      // Откатываем оптимистичное обновление при ошибке
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      // toast уже показан в hook
    },
  });

  // Создать награду TTS
  const handleCreateReward = () => {
    if (!rewardForm.title.trim()) {
      toast.error('Введите название награды');
      return;
    }

    if (createTtsRewardMutation.isPending || !selectedPlatform) return;
    setSaving(true);

    createTtsRewardMutation.mutate({
      platform: selectedPlatform,
      title: rewardForm.title,
      cost: rewardForm.cost,
      cooldown: rewardForm.cooldown
    }, {
      onSettled: () => {
        setSaving(false);
      },
    });
  };

  // [OK] НОВЫЙ КОД: Используем централизованный hook для удаления награды
  const deleteTtsRewardMutation = useDeleteTtsReward({
    onSuccess: () => {
      // Принудительно обновляем данные с сервера
      refetchModeSettings();
      // toast уже показан в hook
    },
    onError: (error) => {
      logger.error('Error deleting TTS reward:', error);
      // Откатываем оптимистичное обновление при ошибке
      queryClient.invalidateQueries({ queryKey: queryKeys.tts.modeSettings() });
      // toast уже показан в hook
    },
  });

  // Удалить награду TTS
  const handleDeleteReward = (platform: string) => {
    if (!confirm(`Удалить TTS награду для ${platform.toUpperCase()}?`)) {
      return;
    }

    if (deleteTtsRewardMutation.isPending) return;

    // Оптимистичное обновление - сразу удаляем reward_id из кэша
    if (modeSettingsData) {
      queryClient.setQueryData(queryKeys.tts.modeSettings(), (oldData: Record<string, unknown> | undefined) => {
        if (!oldData) return oldData;
        const oldRewardIds = { ...((oldData.tts_reward_ids || {}) as Record<string, unknown>) };
        delete oldRewardIds[platform];
        return {
          ...oldData,
          tts_reward_ids: oldRewardIds
        };
      });
    }

    deleteTtsRewardMutation.mutate(platform);
  };

  const isTwitchConnected = integrations?.twitch?.enabled;
  const isVkConnected = integrations?.vk?.enabled;

  const connectedPlatforms: string[] = [];
  if (isTwitchConnected) connectedPlatforms.push('twitch');
  if (isVkConnected) connectedPlatforms.push('vk');

  return (
    <div className="space-y-3">
      {/* Выбор режима - показываем только если showModeSelector=true */}
      {showModeSelector && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onModeChange('all_messages')}
            disabled={isSaving}
            className={`p-3 rounded-lg border-2 transition-all text-left ${ttsMode === 'all_messages'
              ? 'border-purple-500 bg-purple-500/10 text-white'
              : 'border-gray-700 hover:border-purple-500/50 text-gray-400'
              }`}
          >
            <div className="font-semibold text-sm mb-0.5">Все сообщения</div>
            <div className="text-xs text-gray-400">Стандартный режим</div>
          </button>

          <button
            onClick={() => onModeChange('channel_points')}
            disabled={isSaving || !isTwitchConnected}
            className={`p-3 rounded-lg border-2 transition-all text-left ${!isTwitchConnected
              ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
              : ttsMode === 'channel_points'
                ? 'border-green-500 bg-green-500/10 text-white'
                : 'border-gray-700 hover:border-green-500/50 text-gray-400'
              }`}
          >
            <div className="font-semibold text-sm mb-0.5">За баллы канала</div>
            <div className="text-xs text-gray-400">
              {!isTwitchConnected ? 'Требуется Twitch' : 'Только с наградой'}
            </div>
          </button>
        </div>
      )}

      {/* Настройка наград */}
      {ttsMode === 'channel_points' && showRewards && (
        <div className={showModeSelector ? "pt-3 border-t border-gray-700/30" : "py-0"}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {connectedPlatforms.map(platform => (
                <Card key={platform} className="border-gray-700 bg-gray-800/30">
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        {platform === 'twitch' ? (
                          <TwitchIcon className="w-4 h-4 text-purple-400" />
                        ) : (
                          <VKIcon className="w-4 h-4 text-blue-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-white truncate">
                            {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                          </div>
                          {isLoadingRewards ? (
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Загрузка...
                            </div>
                          ) : ttsRewardIds[platform] ? (
                            <div className="text-xs text-green-400">
                              ✓ Создана
                            </div>
                          ) : (
                            <div className="text-xs text-yellow-400">
                              ⚠ Не создана
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {isLoadingRewards ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="w-full text-xs opacity-50 cursor-not-allowed"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Загрузка...
                          </Button>
                        ) : ttsRewardIds[platform] ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteReward(platform)}
                            className="text-red-400 hover:bg-red-600/20 border-red-600/50 w-full text-xs"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Удалить
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openCreateDialog(platform)}
                            className="w-full bg-green-600 hover:bg-green-700 text-xs"
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
              <div className="text-sm text-gray-400 p-4 border rounded-lg bg-gray-800/30 border-gray-700">
                Подключите хотя бы одну платформу (Twitch или VK Live)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Диалог создания награды */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              TTS награда для {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="title" className="text-gray-300">Название</Label>
              <Input
                id="title"
                value={rewardForm.title}
                onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                placeholder="Озвучить моё сообщение"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cost" className="text-gray-300">Цена (баллы)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="1"
                  value={rewardForm.cost}
                  onChange={(e) => setRewardForm({ ...rewardForm, cost: parseInt(e.target.value) || 0 })}
                  placeholder="500"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="cooldown" className="text-gray-300">Кулдаун (сек)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min="0"
                  value={rewardForm.cooldown}
                  onChange={(e) => setRewardForm({ ...rewardForm, cooldown: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateReward}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
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



