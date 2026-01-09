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
      toast.error('������ �������� ��������������� �������');
    } finally {
      setLoading(false);
    }
  };

  const addBlockedChannel = async (): Promise<void> => {
    if (!newChannel.trim()) {
      toast.error('������� �������� ������');
      return;
    }

    try {
      setAddingChannel(true);
      await adminService.blockChannel({
        channel_name: newChannel.trim(),
        reason: '������������� ���������������'
      });
      
      toast.success('����� ������������');
      setNewChannel('');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error adding blocked channel:', error);
      toast.error('������ ���������� ������');
    } finally {
      setAddingChannel(false);
    }
  };

  const removeBlockedChannel = async (channelId: number): Promise<void> => {
    try {
      await adminService.unblockChannel(channelId);
      toast.success('����� �������������');
      await loadBlockedChannels();
    } catch (error) {
      logger.error('Error removing blocked channel:', error);
      toast.error('������ ������������� ������');
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
            ��������������� ������
          </h1>
          <div className="text-muted-foreground mt-2 space-y-1">
            <p>[PIN] <strong>����������:</strong> ���������� ���� �� �������, ��� �� ������� ��� �� �����</p>
            <p>[WARN] ��� ������������� ������� ��������������� ����� � ������ �� �����������</p>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {blockedChannels.length} �������������
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>������ ��������������� �������</CardTitle>
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
              {showAddForm ? <AlertCircle className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showAddForm ? '������' : '�������� �����'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex gap-2">
                <Input
                  placeholder="�������� ������ (��������: username)"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addBlockedChannel();
                    }
                  }}
                />
                <Button onClick={addBlockedChannel} disabled={addingChannel || !newChannel.trim()}>
                  {addingChannel ? '����������...' : '��������'}
                </Button>
              </div>
            </div>
          )}

          {blockedChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>��� ��������������� �������</p>
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
                        ������������: {new Date(channel.blocked_at).toLocaleString()}
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



