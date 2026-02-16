import React, { useEffect, useState } from 'react';

import { AlertCircle, Plus, Shield, Trash2 } from 'lucide-react';

import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { ApiResponse } from '../../../types';

interface BlockedChannel {
  id: number;
  channel_name: string;
  platform?: string;
  reason?: string;
  blocked_at?: string;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

const BlockedChannelsPage: React.FC = () => {
  const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newChannel, setNewChannel] = useState<string>('');
  const [addingChannel, setAddingChannel] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const loadBlockedChannels = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await adminService.getBlockedChannels();
      const data = response.data as ApiResponse<{ blocked_channels?: BlockedChannel[] }>;
      setBlockedChannels(data.data?.blocked_channels || []);
    } catch (error) {
      logger.error('Error loading blocked channels:', error);
      toast.error('Ошибка загрузки заблокированных каналов');
    } finally {
      setLoading(false);
    }
  };

  const addBlockedChannel = async (): Promise<void> => {
    if (!newChannel.trim()) {
      toast.error('Введите название канала');
      return;
    }

    try {
      setAddingChannel(true);
      await adminService.blockChannel({
        channel_name: newChannel.trim(),
        reason: 'Ручная блокировка'
      });

      toast.success('Канал заблокирован');
      setNewChannel('');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error adding blocked channel:', error);
      toast.error('Ошибка добавления канала');
    } finally {
      setAddingChannel(false);
    }
  };

  const removeBlockedChannel = async (channelId: number): Promise<void> => {
    try {
      await adminService.unblockChannel(channelId);
      toast.success('Канал разблокирован');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error removing blocked channel:', error);
      toast.error('Ошибка разблокировки канала');
    }
  };

  useEffect(() => {
    loadBlockedChannels();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted/60" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded bg-muted/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-2 flex items-center text-2xl font-semibold text-foreground">
            <Shield className="mr-2 h-6 w-6 text-primary" />
            Блокировка каналов
          </h1>
          <div className="mt-1 space-y-1 text-sm text-muted-foreground">
            <p>Подсказка: блокируйте канал, если он нарушает правила платформы.</p>
            <p>После блокировки канал не сможет использовать интеграцию в системе.</p>
          </div>
        </div>

        <Badge variant="secondary" className="px-3 py-1.5 text-sm">
          {blockedChannels.length} заблокировано
        </Badge>
      </div>

      <Card className={SURFACE_CARD_CLASS}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Список заблокированных каналов</CardTitle>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
              size="sm"
              className={ACTION_BUTTON_CLASS}
            >
              {showAddForm ? <AlertCircle className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {showAddForm ? 'Скрыть' : 'Добавить канал'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="rounded-lg border border-border/70 bg-card/60 p-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Введите канал (например: username)"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="h-9 min-w-[220px] flex-1 border-border/70 bg-card/60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void addBlockedChannel();
                    }
                  }}
                />
                <Button className="h-9" onClick={() => void addBlockedChannel()} disabled={addingChannel || !newChannel.trim()}>
                  {addingChannel ? 'Добавляем...' : 'Добавить'}
                </Button>
              </div>
            </div>
          )}

          {blockedChannels.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Shield className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Нет заблокированных каналов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-card/60 p-4 transition-colors hover:bg-card/80"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{channel.channel_name}</span>
                      {channel.platform && (
                        <Badge variant="outline">{channel.platform}</Badge>
                      )}
                    </div>
                    {channel.reason && (
                      <p className="mt-1 text-sm text-muted-foreground">{channel.reason}</p>
                    )}
                    {channel.blocked_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Заблокирован: {new Date(channel.blocked_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeBlockedChannel(channel.id)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BlockedChannelsPage;
