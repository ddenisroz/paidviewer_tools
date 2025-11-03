import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import StreakSettings from '../../components/drops/StreakSettings';
import DonationSettings from '../../components/drops/DonationSettings';
import PointsRewards from '../../components/drops/PointsRewards';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'streak');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [channelName, setChannelName] = useState(null);
  const [rewardsCount, setRewardsCount] = useState(0);

  // Обновляем URL при изменении вкладки
  useEffect(() => {
    if (activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  // Автоматически переключаемся на вкладку "Награды" если нет наград при первой загрузке
  useEffect(() => {
    if (rewardsCount === 0 && activeTab !== 'rewards') {
      // Не переключаем автоматически, только если пользователь специально не открыл другую вкладку
      // Предупреждение будет показано в баннере
    }
  }, [rewardsCount, activeTab]);

  // Проверяем параметр tab из URL при загрузке
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['streak', 'donation', 'points', 'rewards', 'history', 'widget'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []); // Только при монтировании

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

  // Проверяем, есть ли награды
  const hasRewards = rewardsCount > 0;

  return (
      <PageWrapper 
        title="Drops система"
      >
      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2">
          <TabsTrigger value="streak" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Стрик</span>
          </TabsTrigger>
          <TabsTrigger value="donation" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Донат</span>
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Баллы</span>
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Package className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Награды</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <History className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">История</span>
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Виджет</span>
          </TabsTrigger>
        </TabsList>

        {/* Стрик */}
        <TabsContent value="streak" className="mt-6">
          <div className="space-y-6">
            <StreakSettings 
              user={user}
              platform={selectedPlatform}
              channelName={channelName}
              hasRewards={hasRewards}
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
            hasRewards={hasRewards}
          />
        </TabsContent>

        {/* Баллы */}
        <TabsContent value="points" className="mt-6">
          <PointsRewards 
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
