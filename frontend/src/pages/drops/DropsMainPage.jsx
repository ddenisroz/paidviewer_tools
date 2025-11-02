import React, { useState, useEffect } from 'react';
import PageWrapper from '../../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Gift, 
  History, 
  TrendingUp,
  Zap,
  Users,
  DollarSign,
  Clock,
  Star,
  Coins
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import StreakSettings from '../../components/drops/StreakSettings';
import DonationSettings from '../../components/drops/DonationSettings';
import { logger } from '../../utils/prodLogger';

const DropsMainPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  const [activeTab, setActiveTab] = useState('streak');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [channelName, setChannelName] = useState(null);

  // Определяем доступную платформу
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSelectedPlatform(null);
      setChannelName(null);
      return;
    }

    // Приоритет: Twitch -> VK
    if (integrations?.twitch?.enabled && user?.twitch_username) {
      setSelectedPlatform('twitch');
      setChannelName(user.twitch_username);
    } else if (integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name)) {
      setSelectedPlatform('vk');
      setChannelName(user.vk_username || user.vk_channel_name);
    } else {
      setSelectedPlatform(null);
      setChannelName(null);
    }
  }, [isAuthenticated, user, integrations]);

  // Если пользователь не авторизован или нет подключенной платформы
  if (!isAuthenticated || !selectedPlatform || !channelName) {
    return (
      <PageWrapper 
        title="🎁 Система лояльности"
        description="Управление наградами и дропами для зрителей"
      >
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Требуется подключение</h3>
              <p className="text-sm mb-4">
                Для использования системы лояльности необходимо подключить хотя бы одну платформу (Twitch или VK)
              </p>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper 
      title="🎁 Система лояльности"
      description="Управление наградами и дропами для зрителей"
    >
      {/* Выбор платформы */}
      <div className="mb-6 flex justify-end">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={selectedPlatform === 'twitch' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              if (user?.twitch_username) {
                setSelectedPlatform('twitch');
                setChannelName(user.twitch_username);
              }
            }}
            disabled={!integrations?.twitch?.enabled || !user?.twitch_username}
            className="gap-1.5"
          >
            <TwitchIcon className="w-4 h-4" />
            Twitch
          </Button>
          <Button
            variant={selectedPlatform === 'vk' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              if (user?.vk_username || user?.vk_channel_name) {
                setSelectedPlatform('vk');
                setChannelName(user.vk_username || user.vk_channel_name);
              }
            }}
            disabled={!integrations?.vk?.enabled || (!user?.vk_username && !user?.vk_channel_name)}
            className={`gap-1.5 ${
              selectedPlatform === 'vk' && 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <VKIcon className="w-4 h-4" />
            VK Live
          </Button>
        </div>
      </div>

      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="streak" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Стрик
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Баллы
          </TabsTrigger>
          <TabsTrigger value="donation" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Донат
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Виджет
          </TabsTrigger>
        </TabsList>

        {/* Стрик */}
        <TabsContent value="streak" className="mt-6">
          <StreakSettings 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
          />
        </TabsContent>

        {/* Баллы */}
        <TabsContent value="points" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Награды за баллы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Донат */}
        <TabsContent value="donation" className="mt-6">
          <DonationSettings 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
          />
        </TabsContent>

        {/* Виджет */}
        <TabsContent value="widget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                OBS Виджет
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default DropsMainPage;
