import React, { useState, useEffect } from 'react';
import PageWrapper from '../../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gift, 
  History, 
  Users,
  DollarSign,
  Coins,
  Package,
  Monitor
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { TwitchIcon, VKIcon } from '../../components/PlatformIcons';
import StreakSettings from '../../components/drops/StreakSettings';
import DonationSettings from '../../components/drops/DonationSettings';
import RewardsManager from '../../components/drops/RewardsManager';
import DropsHistory from '../../components/drops/DropsHistory';
import StreakTracker from '../../components/drops/StreakTracker';
import WidgetSettings from '../../components/drops/WidgetSettings';
import { logger } from '../../utils/prodLogger';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
const DropsMainPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  const [activeTab, setActiveTab] = useState('streak');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [channelName, setChannelName] = useState(null);
  const [rewardsCount, setRewardsCount] = useState(0);
  const hasNoRewards = rewardsCount === 0;

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
      <PageWrapper>
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-8 text-muted-foreground">
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
    <PageWrapper>
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
          <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="streak" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Стрик
            {hasNoRewards && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="donation" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Донат
            {hasNoRewards && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Награды
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            История
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Виджет
          </TabsTrigger>
        </TabsList>

        {/* Стрик */}
        <TabsContent value="streak" className="mt-6">
          <div className="space-y-6">
            <StreakSettings 
              user={user}
              platform={selectedPlatform}
              channelName={channelName}
            />
            <StreakTracker 
              user={user}
              platform={selectedPlatform}
              channelName={channelName}
            />
          </div>
        </TabsContent>

        {/* Донат */}
        <TabsContent value="donation" className="mt-6">
          <DonationSettings 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
          />
        </TabsContent>

        {/* Награды */}
        <TabsContent value="rewards" className="mt-6">
          <RewardsManager 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
            onRewardsCountChange={setRewardsCount}
          />
        </TabsContent>

        {/* История */}
        <TabsContent value="history" className="mt-6">
          <DropsHistory 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
          />
        </TabsContent>

        {/* Виджет */}
        <TabsContent value="widget" className="mt-6">
          <WidgetSettings 
            user={user}
            platform={selectedPlatform}
            channelName={channelName}
          />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default DropsMainPage;
