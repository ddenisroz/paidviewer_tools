import React, { useEffect, useState } from 'react';

import { Coins, Edit, Loader2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';

import { useIntegrations } from '@/context/IntegrationsContext';
import { useCreatePlatformReward, useDeletePlatformReward, usePlatformRewards, useTogglePlatformReward, useUpdatePlatformReward } from '@/queries/points/pointsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from '@/utils/toastManager';


interface PointsRewardsProps {
    user: Record<string, unknown>;
    platform?: string;
    channelName: string;
    integrations?: {
        twitch?: { enabled?: boolean; connected?: boolean };
        vk?: { enabled?: boolean; connected?: boolean };
    };
}

interface Reward {
    id: string;
    title: string;
    description?: string;
    cost: number;
    is_enabled: boolean;
    is_user_input_required?: boolean;
    global_cooldown_seconds?: number;
    max_per_stream?: number;
    max_per_user_per_stream?: number;
    should_redemptions_skip_request_queue?: boolean;
    repair_timeout?: number;
    max_uses_count?: number;
    max_uses_count_per_user?: number;
    is_message_required?: boolean;
}

interface FormData {
    title: string;
    description: string;
    cost: number;
    is_user_input_required: boolean;
    global_cooldown_seconds: number;
    max_per_stream: number;
    max_per_user_per_stream: number;
    should_redemptions_skip_request_queue: boolean;
    repair_timeout: number;
    max_uses_count: number;
    max_uses_count_per_user: number;
    is_message_required: boolean;
}

const PointsRewards: React.FC<PointsRewardsProps> = ({ user, platform, channelName, integrations }) => {
  const { integrations: integrationsContext } = useIntegrations();
  const actualIntegrations = integrations || integrationsContext;
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [partnerRequired, setPartnerRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
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

  // ���������� ��������� ���������
  const twitchAvailable = actualIntegrations?.twitch?.enabled && user?.twitch_username;
  const vkAvailable = actualIntegrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name);
  
  // [OK] ���������: ������������� ���������� ��������� (���������: Twitch -> VK)
  useEffect(() => {
    if (!selectedPlatform) {
      if (platform) {
        setSelectedPlatform(platform);
      } else if (twitchAvailable) {
        setSelectedPlatform('twitch');
      } else if (vkAvailable) {
        setSelectedPlatform('vk');
      }
    }
  }, [platform, twitchAvailable, vkAvailable, selectedPlatform]);

  // React Query hooks
  const { data: rewardsData, isLoading: loading, isError, error: rewardsError, refetch } = usePlatformRewards(
    selectedPlatform || '',
    {
      enabled: !!user && !!selectedPlatform && !!channelName,
    }
  );

  // ��������� ������
  useEffect(() => {
    if (isError && rewardsError) {
      const error = rewardsError as { response?: { status?: number; data?: { detail?: string; message?: string } } };
      // [OK] ��������� 403 - �������/�������� ���������
      if (error.response?.status === 403) {
        const detail = error.response?.data?.detail || error.response?.data?.message;
        if (detail && (detail.includes('������') || detail.includes('��������') || detail.includes('partner') || detail.includes('affiliate'))) {
          setPartnerRequired(true);
          setErrorMessage(detail);
          return;
        }
      }
      
      // ��� ������ ������ (����� 404)
      if (error.response?.status !== 404) {
        const detail = error.response?.data?.detail || error.response?.data?.message;
        setErrorMessage(detail || '������ �������� ������');
      }
    } else if (rewardsData && !isError) {
      setPartnerRequired(false);
      setErrorMessage(null);
    }
  }, [isError, rewardsError, rewardsData]);

  const rewards: Reward[] = (rewardsData as { data?: { rewards?: Reward[] } })?.data?.rewards || [];

  const createRewardMutation = useCreatePlatformReward(selectedPlatform || '', {
    onSuccess: () => {
      setShowDialog(false);
      resetForm();
    },
  });

  const updateRewardMutation = useUpdatePlatformReward(selectedPlatform || '', {
    onSuccess: () => {
      setShowDialog(false);
      resetForm();
    },
  });

  const deleteRewardMutation = useDeletePlatformReward(selectedPlatform || '');
  const toggleRewardMutation = useTogglePlatformReward(selectedPlatform || '');

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error('������� �������� �������');
      return;
    }

    if (!selectedPlatform) {
      toast.error('��������� �� �������');
      return;
    }

    const rewardData: Record<string, unknown> = {
      title: formData.title,
      description: formData.description,
      cost: parseInt(formData.cost.toString()) || 100,
      is_user_input_required: formData.is_user_input_required,
      platform: selectedPlatform,
      channel_name: channelName
    };

    // ��������� ���������-����������� ����
    if (selectedPlatform === 'twitch') {
      rewardData.global_cooldown_seconds = parseInt(formData.global_cooldown_seconds.toString()) || 0;
      rewardData.max_per_stream = parseInt(formData.max_per_stream.toString()) || 0;
      rewardData.max_per_user_per_stream = parseInt(formData.max_per_user_per_stream.toString()) || 0;
      rewardData.should_redemptions_skip_request_queue = formData.should_redemptions_skip_request_queue;
    } else if (selectedPlatform === 'vk') {
      rewardData.repair_timeout = parseInt(formData.repair_timeout.toString()) || 0;
      rewardData.max_uses_count = parseInt(formData.max_uses_count.toString()) || 0;
      rewardData.max_uses_count_per_user = parseInt(formData.max_uses_count_per_user.toString()) || 0;
      rewardData.is_message_required = formData.is_message_required;
    }

    if (editingReward) {
      updateRewardMutation.mutate({ rewardId: editingReward.id, reward: rewardData });
    } else {
      createRewardMutation.mutate(rewardData);
    }
  };

  const handleDelete = (rewardId: string) => {
    if (!confirm('������� ��� ������� � ���������?')) return;
    deleteRewardMutation.mutate(rewardId);
  };

  const handleToggle = (rewardId: string, enabled: boolean) => {
    toggleRewardMutation.mutate({ rewardId, isEnabled: !enabled });
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

  const handleOpenDialog = (reward: Reward | null = null) => {
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

  // �������� ����������
  const hasAnyIntegration = twitchAvailable || vkAvailable;

  if (!hasAnyIntegration) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center py-8 text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">���������� �� ����������</h3>
            <p className="text-sm">
              ��� �������� ������ ����� API ���������� ���������� ���������� Twitch ��� VK � ����������
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="w-5 h-5" />
                ������� �� �����
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {selectedPlatform ? `������� ��� ${selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}` : '���������� � ���������� ��������� �� ����� ������'}
              </CardDescription>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              size="default"
              className="gap-2"
              disabled={partnerRequired}
            >
              <Plus className="w-4 h-4" />
              ������� �������
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">�������� ������...</p>
            </div>
          ) : partnerRequired ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
              <p className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">
                {selectedPlatform === 'twitch' ? '��������� ������ ������� ��� ���������' : '������� ����������'}
              </p>
              <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                {errorMessage || (selectedPlatform === 'twitch' 
                  ? '������� �� ����� ������ Twitch �������� ������ ��� �������� � ����������. �������� ������ ������� ��� ��������� �� Twitch, ����� ������������ ��� �������.'
                  : '������� ���������� ��� ���� ���������.')}
              </p>
              {selectedPlatform === 'twitch' && (
                <p className="text-xs text-muted-foreground">
                  ������� ������ � ��������� ���������� Twitch: <a 
                    href="https://www.twitch.tv/p/ru-ru/partners/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    twitch.tv/p/partners
                  </a>
                </p>
              )}
            </div>
          ) : errorMessage && !partnerRequired ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-sm font-medium text-destructive mb-2">������ ��������</p>
              <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
              <Button onClick={() => refetch()} size="sm" variant="outline">
                ��������� �������
              </Button>
            </div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">������� �� �������</p>
              <p className="text-xs text-muted-foreground mb-4">
                �������� ������� �� �����, ������� ������� ������ ����������� �� {selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}
              </p>
              <Button onClick={() => handleOpenDialog()} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                ������� ������ �������
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
                        <Badge variant="outline" className="text-xs">���������</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {reward.cost} ������
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

      {/* ������ ��������/�������������� */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? '������������� �������' : '������� �������'}
            </DialogTitle>
            <DialogDescription>
              {selectedPlatform ? `������� ����� ������� �� ${selectedPlatform === 'twitch' ? 'Twitch' : 'VK Live'}` : '�������� ������� �� �����'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* �������� */}
            <div className="space-y-2">
              <Label>�������� ������� *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="��������: ������ �������� �������"
              />
            </div>

            {/* �������� */}
            <div className="space-y-2">
              <Label>��������</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="�������� �������"
                rows={3}
              />
            </div>

            {/* ��������� */}
            <div className="space-y-2">
              <Label>��������� (�����) *</Label>
              <Input
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({...formData, cost: parseInt(e.target.value) || 0})}
                min={1}
              />
            </div>

            {/* ��������� ���� �� ������������ */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>��������� ���� �� ������������</Label>
                <p className="text-xs text-muted-foreground">
                  ������� ������ ������ ��������� ��� ������� �������
                </p>
              </div>
              <Switch
                checked={formData.is_user_input_required}
                onCheckedChange={(checked) => setFormData({...formData, is_user_input_required: checked})}
              />
            </div>

            {/* ���������-����������� ��������� */}
            {selectedPlatform === 'twitch' && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-sm">��������� Twitch</h4>
                
                <div className="space-y-2">
                  <Label>���������� ������� (�������)</Label>
                  <Input
                    type="number"
                    value={formData.global_cooldown_seconds}
                    onChange={(e) => setFormData({...formData, global_cooldown_seconds: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>����. ������������� �� ����� (0 = ��� �����������)</Label>
                  <Input
                    type="number"
                    value={formData.max_per_stream}
                    onChange={(e) => setFormData({...formData, max_per_stream: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>����. ������������� �� ������������ �� ����� (0 = ��� �����������)</Label>
                  <Input
                    type="number"
                    value={formData.max_per_user_per_stream}
                    onChange={(e) => setFormData({...formData, max_per_user_per_stream: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>������������� ��������� (���������� �������)</Label>
                    <p className="text-xs text-muted-foreground">
                      ������� ����� ��������� ������������� ��� ���������
                    </p>
                  </div>
                  <Switch
                    checked={formData.should_redemptions_skip_request_queue}
                    onCheckedChange={(checked) => setFormData({...formData, should_redemptions_skip_request_queue: checked})}
                  />
                </div>
              </div>
            )}

            {selectedPlatform === 'vk' && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-sm">��������� VK Live</h4>
                
                <div className="space-y-2">
                  <Label>������� ������� (�������)</Label>
                  <Input
                    type="number"
                    value={formData.repair_timeout}
                    onChange={(e) => setFormData({...formData, repair_timeout: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>����. ������������� (0 = ��� �����������)</Label>
                  <Input
                    type="number"
                    value={formData.max_uses_count}
                    onChange={(e) => setFormData({...formData, max_uses_count: parseInt(e.target.value) || 0})}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <Label>����. ������������� �� ������������ (0 = ��� �����������)</Label>
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
              ������
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createRewardMutation.isPending || updateRewardMutation.isPending}
            >
              {(createRewardMutation.isPending || updateRewardMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ����������...
                </>
              ) : (
                editingReward ? '���������' : '�������'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PointsRewards;


