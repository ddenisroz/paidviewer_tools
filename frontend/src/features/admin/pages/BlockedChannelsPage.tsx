import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../../services/api/services/adminService';
import { logger } from '../../../utils/prodLogger';

interface BlockedChannel {
  id: number;
  channel_name: string;
  platform?: string;
  reason?: string;
  blocked_at?: string;
  [key: string]: any;
}

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
      setBlockedChannels((response.data as any).blocked_channels || []);
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
        reason: 'Заблокировано администратором'
      });
      
      toast.success('Канал заблокирован');
      setNewChannel('');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error adding blocked channel:', error);
      toast.error('Ошибка блокировки канала');
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
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground flex items-center">
            <Shield className="w-8 h-8 mr-3 text-red-500" />
            Заблокированные каналы
          </h1>
          <div className="text-muted-foreground mt-2 space-y-1">
            <p>📌 <strong>Назначение:</strong> Отключение бота от каналов, где он забанен или не нужен</p>
            <p>🔴 Бот автоматически покинет заблокированный канал и больше не подключится</p>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {blockedChannels.length} заблокировано
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Список заблокированных каналов</CardTitle>
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
              {showAddForm ? <AlertCircle className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showAddForm ? 'Отмена' : 'Добавить канал'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex gap-2">
                <Input
                  placeholder="Название канала (например: username)"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addBlockedChannel();
                    }
                  }}
                />
                <Button onClick={addBlockedChannel} disabled={addingChannel || !newChannel.trim()}>
                  {addingChannel ? 'Добавление...' : 'Добавить'}
                </Button>
              </div>
            </div>
          )}

          {blockedChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет заблокированных каналов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedChannels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{channel.channel_name}</span>
                      {channel.platform && (
                        <Badge variant="outline">{channel.platform}</Badge>
                      )}
                    </div>
                    {channel.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{channel.reason}</p>
                    )}
                    {channel.blocked_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Заблокирован: {new Date(channel.blocked_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlockedChannel(channel.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
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



