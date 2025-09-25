import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { API_BASE_URL } from '../constants';
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Shield, 
  ShieldOff, 
  Send,
  Clock,
  User
} from 'lucide-react';
import { useToast } from '../components/ui/toast';

const VkChatModeration = () => {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Состояния для отправки сообщений
  const [messageText, setMessageText] = useState('');
  const [channelName, setChannelName] = useState('');
  
  // Состояния для модерации
  const [moderationUserId, setModerationUserId] = useState('');
  const [moderationChannel, setModerationChannel] = useState('');
  const [muteDuration, setMuteDuration] = useState(300); // 5 минут по умолчанию
  const [banDuration, setBanDuration] = useState(0); // 0 = перманентный

  // Отправка сообщения
  const sendMessage = async () => {
    if (!messageText.trim() || !channelName.trim()) {
      addToast({
        title: 'Ошибка',
        description: 'Заполните все поля для отправки сообщения',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vk/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_name: channelName,
          message: messageText
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send message');
      }

      const result = await response.json();
      addToast({
        title: 'Успех',
        description: result.message,
        type: 'success'
      });
      
      setMessageText('');
    } catch (error) {
      addToast({
        title: 'Ошибка',
        description: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Мут пользователя
  const muteUser = async () => {
    if (!moderationUserId || !moderationChannel) {
      addToast({
        title: 'Ошибка',
        description: 'Заполните ID пользователя и канал',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vk/chat/mute-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_name: moderationChannel,
          user_id: parseInt(moderationUserId),
          duration: muteDuration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to mute user');
      }

      const result = await response.json();
      addToast({
        title: 'Успех',
        description: result.message,
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Ошибка',
        description: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Бан пользователя
  const banUser = async () => {
    if (!moderationUserId || !moderationChannel) {
      addToast({
        title: 'Ошибка',
        description: 'Заполните ID пользователя и канал',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vk/chat/ban-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_name: moderationChannel,
          user_id: parseInt(moderationUserId),
          duration: banDuration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to ban user');
      }

      const result = await response.json();
      addToast({
        title: 'Успех',
        description: result.message,
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Ошибка',
        description: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Разбан пользователя
  const unbanUser = async () => {
    if (!moderationUserId || !moderationChannel) {
      addToast({
        title: 'Ошибка',
        description: 'Заполните ID пользователя и канал',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vk/chat/unban-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_name: moderationChannel,
          user_id: parseInt(moderationUserId)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to unban user');
      }

      const result = await response.json();
      addToast({
        title: 'Успех',
        description: result.message,
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Ошибка',
        description: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Отправка сообщений */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Отправка сообщений
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Канал</label>
              <Input
                placeholder="Название канала (например: zavtrazavod)"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Сообщение</label>
              <Textarea
                placeholder="Текст сообщения..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <Button
            onClick={sendMessage}
            disabled={isLoading || !messageText.trim() || !channelName.trim()}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {isLoading ? 'Отправка...' : 'Отправить сообщение'}
          </Button>
        </CardContent>
      </Card>

      {/* Модерация */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Модерация чата
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Общие поля */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Канал</label>
              <Input
                placeholder="Название канала"
                value={moderationChannel}
                onChange={(e) => setModerationChannel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">ID пользователя</label>
              <Input
                placeholder="ID пользователя"
                type="number"
                value={moderationUserId}
                onChange={(e) => setModerationUserId(e.target.value)}
              />
            </div>
          </div>

          {/* Мут */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <MicOff className="w-5 h-5 text-orange-500" />
              <h3 className="font-medium">Мут пользователя</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Длительность (секунды)</label>
                <Input
                  type="number"
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(parseInt(e.target.value) || 300)}
                  placeholder="300"
                />
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setMuteDuration(60)}>
                    1 мин
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setMuteDuration(300)}>
                    5 мин
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setMuteDuration(1800)}>
                    30 мин
                  </Badge>
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={muteUser}
                  disabled={isLoading || !moderationUserId || !moderationChannel}
                  variant="outline"
                  className="w-full"
                >
                  <MicOff className="w-4 h-4 mr-2" />
                  Замутить
                </Button>
              </div>
            </div>
          </div>

          {/* Бан */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              <h3 className="font-medium">Бан пользователя</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Длительность (секунды)</label>
                <Input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(parseInt(e.target.value) || 0)}
                  placeholder="0 = перманентный"
                />
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setBanDuration(0)}>
                    Навсегда
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setBanDuration(3600)}>
                    1 час
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer" onClick={() => setBanDuration(86400)}>
                    1 день
                  </Badge>
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={banUser}
                  disabled={isLoading || !moderationUserId || !moderationChannel}
                  variant="destructive"
                  className="w-full"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Забанить
                </Button>
              </div>
            </div>
          </div>

          {/* Разбан */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-green-500" />
              <h3 className="font-medium">Разбан пользователя</h3>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={unbanUser}
                disabled={isLoading || !moderationUserId || !moderationChannel}
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50"
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Разбанить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VkChatModeration;
