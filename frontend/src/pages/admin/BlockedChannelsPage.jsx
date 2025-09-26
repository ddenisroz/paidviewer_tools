import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const BlockedChannelsPage = () => {
  const [blockedChannels, setBlockedChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newChannel, setNewChannel] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);

  const loadBlockedChannels = async () => {
    try {
      setLoading(true);
      const response = await botService.get('/api/admin/blocked-channels');
      setBlockedChannels(response.data.blocked_channels || []);
    } catch (error) {
      console.error('Error loading blocked channels:', error);
      toast.error('Ошибка загрузки заблокированных каналов');
    } finally {
      setLoading(false);
    }
  };

  const addBlockedChannel = async () => {
    if (!newChannel.trim()) {
      toast.error('Введите название канала');
      return;
    }

    try {
      setAddingChannel(true);
      await botService.post('/api/admin/blocked-channels', {
        channel_name: newChannel.trim(),
        reason: 'Заблокировано администратором'
      });
      
      toast.success('Канал заблокирован');
      setNewChannel('');
      await loadBlockedChannels();
    } catch (error) {
      console.error('Error adding blocked channel:', error);
      toast.error('Ошибка блокировки канала');
    } finally {
      setAddingChannel(false);
    }
  };

  const removeBlockedChannel = async (channelId) => {
    try {
      await botService.delete(`/api/admin/blocked-channels/${channelId}`);
      toast.success('Канал разблокирован');
      await loadBlockedChannels();
    } catch (error) {
      console.error('Error removing blocked channel:', error);
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
          <h1 className="text-3xl font-bold flex items-center">
            <Shield className="w-8 h-8 mr-3 text-red-500" />
            Заблокированные каналы
          </h1>
          <p className="text-muted-foreground mt-2">
            Управление списком заблокированных каналов
          </p>
        </div>
        
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {blockedChannels.length} заблокировано
        </Badge>
      </div>

      {/* Форма добавления */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Заблокировать канал
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Введите название канала"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addBlockedChannel()}
              className="flex-1"
            />
            <Button 
              onClick={addBlockedChannel}
              disabled={addingChannel || !newChannel.trim()}
            >
              {addingChannel ? 'Блокируем...' : 'Заблокировать'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список заблокированных каналов */}
      <Card>
        <CardHeader>
          <CardTitle>Заблокированные каналы ({blockedChannels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {blockedChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Нет заблокированных каналов</p>
              <p className="text-sm">Заблокированные каналы будут отображаться здесь</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedChannels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="font-medium">{channel.channel_name}</span>
                      {channel.reason && (
                        <Badge variant="outline" className="text-xs">
                          {channel.reason}
                        </Badge>
                      )}
                    </div>
                    {channel.created_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Заблокировано: {new Date(channel.created_at).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeBlockedChannel(channel.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Разблокировать
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