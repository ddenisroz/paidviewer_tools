import React, { useEffect, useState } from 'react';

import { Globe, Plus, ShieldAlert, Trash2 } from 'lucide-react';

import {
  AdminEmptyState,
  AdminPageHeader,
  ADMIN_ACTION_BUTTON_CLASS,
  ADMIN_CARD_CLASS,
} from '@/features/admin/components/admin-ui';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { ApiResponse } from '../../../types';

interface BlockedChannel {
  id: number;
  channel_name: string;
  platform?: string;
  reason?: string;
  created_at?: string;
  blocked_at?: string;
}

const AdminChannelsPage: React.FC = () => {
  const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadBlockedChannels = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await adminService.getBlockedChannels();
      const payload = response.data as ApiResponse<{ blocked_channels?: BlockedChannel[] }> & {
        blocked_channels?: BlockedChannel[];
      };
      setBlockedChannels(payload.blocked_channels || payload.data?.blocked_channels || []);
    } catch (error) {
      logger.error('Error loading blocked channels', error);
      toast.error('Не удалось загрузить список каналов');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = async (): Promise<void> => {
    if (!newChannel.trim()) {
      toast.error('Введите имя канала');
      return;
    }

    try {
      setIsSaving(true);
      await adminService.blockChannel({
        channel_name: newChannel.trim(),
        reason: 'Заблокировано вручную через админку',
      });
      toast.success(`Канал ${newChannel.trim()} заблокирован`);
      setNewChannel('');
      setShowAddForm(false);
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error blocking channel', error);
      toast.error('Не удалось заблокировать канал');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveChannel = async (channelId: number): Promise<void> => {
    try {
      await adminService.unblockChannel(channelId);
      toast.success('Канал разблокирован');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error unblocking channel', error);
      toast.error('Не удалось разблокировать канал');
    }
  };

  useEffect(() => {
    void loadBlockedChannels();
  }, []);

  if (loading) {
    return (
      <Card className={ADMIN_CARD_CLASS}>
        <CardContent className="space-y-3 p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-muted/60" />
          <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Заблокированные каналы"
        description="Каналы из этого списка не смогут использовать интеграцию, пока блокировка активна."
        actions={
          <Button
            type="button"
            variant={showAddForm ? 'outline' : 'default'}
            className={showAddForm ? ADMIN_ACTION_BUTTON_CLASS : 'h-9'}
            onClick={() => setShowAddForm(prev => !prev)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {showAddForm ? 'Скрыть форму' : 'Добавить канал'}
          </Button>
        }
        meta={
          <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">
            Всего: {blockedChannels.length}
          </Badge>
        }
      />

      {showAddForm ? (
        <Card className={ADMIN_CARD_CLASS}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
            <Input
              value={newChannel}
              onChange={event => setNewChannel(event.target.value)}
              placeholder="Название канала"
              className="h-9 border-border/70 bg-background/60"
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleAddChannel();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void handleAddChannel()}
              disabled={isSaving || !newChannel.trim()}
              className="h-9"
            >
              {isSaving ? 'Сохраняю...' : 'Заблокировать'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {blockedChannels.length === 0 ? (
        <AdminEmptyState
          icon={ShieldAlert}
          title="Список пуст"
          description="Сейчас в системе нет заблокированных каналов."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {blockedChannels.map(channel => (
            <Card key={channel.id} className={ADMIN_CARD_CLASS}>
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <p className="truncate text-base font-semibold text-foreground">{channel.channel_name}</p>
                    </div>
                    {channel.reason ? <p className="text-sm text-muted-foreground">{channel.reason}</p> : null}
                  </div>
                  {channel.platform ? (
                    <Badge variant="outline" className="border-border/70 bg-background/60">
                      {channel.platform}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {channel.created_at || channel.blocked_at
                      ? new Date(channel.created_at || channel.blocked_at || '').toLocaleString('ru-RU')
                      : 'Дата неизвестна'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void handleRemoveChannel(channel.id)}
                    title="Разблокировать"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminChannelsPage;
