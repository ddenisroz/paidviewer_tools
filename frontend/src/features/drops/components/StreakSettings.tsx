import React, { useEffect, useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Gift, Loader2, Package } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import { useDropsConfig } from '@/features/drops/hooks/useDropsConfig';
import { dropsService } from '@/services/api/services/dropsService';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import StreakCalendar from './StreakCalendar';



import type { DropsConfig } from '@/types/drops';
import type { User, UserIntegrations } from '@/types/user';

interface StreakSettingsProps {
    user: User;
    channelName: string;
    hasRewards?: boolean;
    integrations?: UserIntegrations;
}

interface StreakSettingsFormData {
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    streak_messages_required: number[];
    streak_reset_on_skip: boolean;
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
}

const StreakSettings: React.FC<StreakSettingsProps> = ({ user, channelName, hasRewards = false, integrations }) => {
  const twitchAvailable = integrations?.twitch?.connected && user?.twitch_username;
  const vkAvailable = integrations?.vk?.connected && (user?.vk_username || user?.vk_channel_name);
  
  const { config, isLoading, isInitialLoad, setIsInitialLoad, saveMutation } = useDropsConfig(channelName);
  
  const [formData, setFormData] = useState<StreakSettingsFormData>({
    streak_days_common: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
    streak_days_rare: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
    streak_days_epic: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
    streak_days_legendary: [DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
    streak_messages_required: [DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
    streak_reset_on_skip: true,
    streak_enabled_twitch: false,
    streak_enabled_vk: false
  });

  useEffect(() => {
    const handleDropsConfigChange = (event: CustomEvent) => {
      const { streak_enabled, channel, platform: eventPlatform, source } = event.detail;
      // [OK] �����������: ��������� ��������� ��������� ������ ���� ������� ������ �� QuickActionsBar
      // ���� ������� ������ �� useDropsConfig (��� ����������� saveMutation), �� ��������� ��� ��������� ����� setFormData
      if (channel === channelName && streak_enabled !== undefined && eventPlatform && source === 'QuickActionsBar') {
        if (eventPlatform === 'twitch') {
          setFormData(prev => ({ ...prev, streak_enabled_twitch: streak_enabled }));
        } else if (eventPlatform === 'vk') {
          setFormData(prev => ({ ...prev, streak_enabled_vk: streak_enabled }));
        }
      }
    };

    window.addEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
    return () => window.removeEventListener('drops-config-changed', handleDropsConfigChange as EventListener);
  }, [channelName]);
  
  const initialFormData = useMemo(() => {
    if (!config) return null;
    
    // Type assertion after null check
    const typedConfig = config as DropsConfig;
    
    return {
      streak_days_common: [typedConfig.streak_days_common ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_COMMON],
      streak_days_rare: [typedConfig.streak_days_rare ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_RARE],
      streak_days_epic: [typedConfig.streak_days_epic ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_EPIC],
      streak_days_legendary: [typedConfig.streak_days_legendary ?? DROPS_CONSTANTS.STREAK.DEFAULT_DAYS_LEGENDARY],
      streak_messages_required: [typedConfig.streak_messages_required ?? DROPS_CONSTANTS.STREAK.DEFAULT_MESSAGES_REQUIRED],
      streak_reset_on_skip: typedConfig.streak_reset_on_skip ?? true,
      streak_enabled_twitch: typedConfig.streak_enabled_twitch ?? false,
      streak_enabled_vk: typedConfig.streak_enabled_vk ?? false
    };
  }, [config]);
  
  // [OK] �������������: ��������� ������ ��� ������ ��������
  useEffect(() => {
    if (initialFormData && isInitialLoad) {
      setFormData(initialFormData);
      setIsInitialLoad(false);
    }
  }, [initialFormData, isInitialLoad]);
  
  // [OK] �������������: �������������� formData � config �� React Query
  // ��������� ��� ����, ������� streak_enabled (fallback ���� ������� �� ���� ����������)
  useEffect(() => {
    if (!isInitialLoad && config && initialFormData) {
      setFormData(prev => {
        // [OK] ���������, ���������� �� �������� � config
        const needsUpdate = 
          prev.streak_days_common[0] !== initialFormData.streak_days_common[0] ||
          prev.streak_days_rare[0] !== initialFormData.streak_days_rare[0] ||
          prev.streak_days_epic[0] !== initialFormData.streak_days_epic[0] ||
          prev.streak_days_legendary[0] !== initialFormData.streak_days_legendary[0] ||
          prev.streak_messages_required[0] !== initialFormData.streak_messages_required[0] ||
          prev.streak_reset_on_skip !== initialFormData.streak_reset_on_skip ||
          prev.streak_enabled_twitch !== initialFormData.streak_enabled_twitch ||
          prev.streak_enabled_vk !== initialFormData.streak_enabled_vk;
        
        // ��������� ������ ���� �������� ���������� (������������� ������ ����������)
        if (needsUpdate) {
          return {
            ...prev,
            streak_days_common: initialFormData.streak_days_common,
            streak_days_rare: initialFormData.streak_days_rare,
            streak_days_epic: initialFormData.streak_days_epic,
            streak_days_legendary: initialFormData.streak_days_legendary,
            streak_messages_required: initialFormData.streak_messages_required,
            streak_reset_on_skip: initialFormData.streak_reset_on_skip,
            streak_enabled_twitch: initialFormData.streak_enabled_twitch,
            streak_enabled_vk: initialFormData.streak_enabled_vk
          };
        }
        return prev;
      });
    }
  }, [config, isInitialLoad, initialFormData]);

  const queryClient = useQueryClient();
  const { autoSave } = useAutoSave(
    (payload: Partial<DropsConfig>) => saveMutation.mutate(payload),
    1000
  );

  const createPayload = (includeEnabledFlags = true): Partial<DropsConfig> => {
    const payload: Partial<DropsConfig> = {
      streak_days_common: formData.streak_days_common[0],
      streak_days_rare: formData.streak_days_rare[0],
      streak_days_epic: formData.streak_days_epic[0],
      streak_days_legendary: formData.streak_days_legendary[0],
      streak_messages_required: formData.streak_messages_required[0],
      streak_reset_on_skip: formData.streak_reset_on_skip
    };
    
    // [OK] �������� streak_enabled ������ ���� explicitly requested (��� handlePlatformToggle)
    if (includeEnabledFlags) {
      payload.streak_enabled_twitch = formData.streak_enabled_twitch;
      payload.streak_enabled_vk = formData.streak_enabled_vk;
    }
    
    return payload;
  };

  const handlePlatformToggle = (platform: string, enabled: boolean) => {
    if (!hasRewards && enabled) {
      toast.error('������� ��������� ���������� �������� �� ������� "�������"');
      return;
    }
    
    const platformKey = platform === 'twitch' ? 'streak_enabled_twitch' : 'streak_enabled_vk';
    setFormData(prev => ({ ...prev, [platformKey]: enabled }));
    autoSave({ ...createPayload(), [platformKey]: enabled });
  };
  
  // [OK] �����������: �������������� ������ ��� ��������, �� ��� streak_enabled_twitch/vk
  // streak_enabled_twitch/vk ����������� �������� ����� handlePlatformToggle
  // ��� ������������� ��������� ���������� ��� ���������� �� QuickActionsBar
  useEffect(() => {
    if (!isInitialLoad && config) {
      // [OK] ������� payload ��� streak_enabled ����� ��� ��������������
      autoSave(createPayload(false));
    }
  }, [
    formData.streak_days_common,
    formData.streak_days_rare,
    formData.streak_days_epic,
    formData.streak_days_legendary,
    formData.streak_messages_required,
    formData.streak_reset_on_skip,
    isInitialLoad,
    autoSave
    // [OK] ���������: formData.streak_enabled_twitch, formData.streak_enabled_vk
    // ��� ���� ����������� �������� ����� handlePlatformToggle
  ]);

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      return await dropsService.resetStreak(channelName);
    },
    onSuccess: (response) => {
      const responseData = response?.data as { data?: { deleted_count?: number } } | undefined;
      const deletedCount = responseData?.data?.deleted_count || 0;
      toast.success(`���������� ������� �������� (������� ${deletedCount} �������)`);
      queryClient.invalidateQueries({ queryKey: ['drops-streak-stats', channelName] });
    },
    onError: (err: Error) => {
      toast.error('������ ������ ����������');
      logger.error('Error resetting streak statistics:', err);
    },
  });

  const handleResetStatistics = async () => {
    if (!user || !channelName) {
      toast.error('������������ ������');
      return;
    }

    if (!confirm('�� �������, ��� ������ �������� ��� ���������� �������? ��� �������� ����������!')) {
      return;
    }

    resetStatsMutation.mutate();
  };
  
  const _isStreakEnabledAnywhere = formData.streak_enabled_twitch || formData.streak_enabled_vk;

  // ���������� loader ������ ���� ��� ��������� �������� � ������ ��� �� ���������
  // ���� config === null ����� ��������, ������ ������ ���������� - ���������� ����� � ���������� ����������
  if (isLoading && isInitialLoad) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // ���� config �� ���������� (������ ����������), ���������� ��������������
  if (!config && !isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-l-4 border-l-red-500 border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/10 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  �� ������� ��������� ��������� �������. ���������, ��� ������ ������� �� <strong className="text-foreground font-mono">����� 8000</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* �������������� ���� ��� ������ */}
      {!hasRewards && (
        <Card className="border-l-4 border-l-orange-500 border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-1.5 rounded-lg bg-orange-500/10 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-sm text-muted-foreground">
                  ��� ������ ������� ������� ��������� ���������� �������� �� ������� <strong className="text-foreground">"�������"</strong>
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/dashboard/drops?tab=rewards'}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-shrink-0"
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                ���������
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ��������� ���� ������ - ������ ����� */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* �������� ��������� - ����� */}
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">������� �������</h3>
            </div>
            
            {/* ������������� ��� ������ ��������� - ������ */}
            <div className="flex items-center gap-4 flex-wrap">
              {twitchAvailable && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Twitch</Label>
                  <Switch
                    checked={formData.streak_enabled_twitch}
                    onCheckedChange={(checked) => handlePlatformToggle('twitch', checked)}
                  />
                </div>
              )}
              {vkAvailable && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">VK Live</Label>
                  <Switch
                    checked={formData.streak_enabled_vk}
                    onCheckedChange={(checked) => handlePlatformToggle('vk', checked)}
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StreakCalendar 
            formData={formData as unknown as { streak_days_common: number[]; streak_days_rare: number[]; streak_days_epic: number[]; streak_days_legendary: number[]; [key: string]: number[] }} 
            setFormData={setFormData as unknown as React.Dispatch<React.SetStateAction<{ streak_days_common: number[]; streak_days_rare: number[]; streak_days_epic: number[]; streak_days_legendary: number[]; [key: string]: number[] }>>} 
          />
        </CardContent>
      </Card>



      {/* ����� ��������� - ���������� ���� */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* ��������� ��� ������� ��� */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">��������� ��� ������� ������</Label>
              <span className="text-lg font-semibold">{formData.streak_messages_required[0]}</span>
            </div>
            <Slider
              value={formData.streak_messages_required}
              onValueChange={(value) => {
                setFormData({...formData, streak_messages_required: value});
                // �������������� ��� � useEffect
              }}
              min={1}
              max={100}
              step={1}
            />
          </div>

          {/* ����� ��� �������� */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">����� ��� ��������</Label>
              <p className="text-xs text-muted-foreground">�������� ����� ��� ������������ �� ����� ������</p>
            </div>
            <Switch
              checked={formData.streak_reset_on_skip}
              onCheckedChange={(checked) => {
                setFormData({...formData, streak_reset_on_skip: checked});
                // �������������� ��� � useEffect
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* [OK] ������ ������ "���������" - �������������� �������� ������������� */}
      {/* ������ ������ ���������� */}
      <div className="flex items-center gap-3 justify-end">
        <Button 
          onClick={handleResetStatistics}
          disabled={resetStatsMutation.isPending}
          size="sm"
          variant="destructive"
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          {resetStatsMutation.isPending ? '�����...' : '�������� ���������� �������'}
        </Button>
      </div>
    </div>
  );
};

export default StreakSettings;


