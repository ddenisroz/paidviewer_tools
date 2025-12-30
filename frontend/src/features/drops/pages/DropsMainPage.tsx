import React, { useEffect, useState } from 'react';

import { 
  AlertCircle, 
  Coins, 
  DollarSign,
  History,
  Monitor,
  Package,
  Settings,
  Users
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAuth } from '../../../context/AuthContext';
import { useIntegrations } from '../../../context/IntegrationsContext';
import PageWrapper from '../../../shared/components/PageWrapper';
import DonationSettings from '../components/DonationSettings';
import DropsHistory from '../components/DropsHistory';
import PointsRewards from '../components/PointsRewards';
import RewardsManager from '../components/RewardsManager';
import StreakSettings from '../components/StreakSettings';
import StreakTracker from '../components/StreakTracker';
import WidgetSettings from '../components/WidgetSettings';

type TabType = 'streak' | 'donation' | 'points' | 'rewards' | 'history' | 'widget';

const DropsMainPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'streak');
  const [channelName, setChannelName] = useState<string | null>(null);
  const [_rewardsCount, setRewardsCount] = useState<number>(0);

  useEffect(() => {
    if (activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['streak', 'donation', 'points', 'rewards', 'history', 'widget'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setChannelName(null);
      return;
    }

    if (integrations?.twitch?.enabled && user?.twitch_username) {
      setChannelName(user.twitch_username);
    } else if (integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name)) {
      setChannelName(user.vk_username || user.vk_channel_name || null);
    } else {
      setChannelName(null);
    }
  }, [isAuthenticated, user, integrations]);

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Drops система">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Требуется авторизация
              </h3>
              <p className="text-gray-400 text-sm">
                Для использования системы лояльности необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
              </p>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Войти в систему
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Guard clause for null channelName or user
  if (!channelName || !user) {
    return (
      <PageWrapper title="Drops система">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Загрузка данных...
              </h3>
              <p className="text-gray-400 text-sm">
                Пожалуйста, подождите
              </p>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Drops система">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="streak" className="gap-2">
            <Users className="w-4 h-4" />
            Стрик
          </TabsTrigger>
          <TabsTrigger value="donation" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Донаты
          </TabsTrigger>
          <TabsTrigger value="points" className="gap-2">
            <Coins className="w-4 h-4" />
            Очки
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-2">
            <Package className="w-4 h-4" />
            Награды
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            История
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-2">
            <Monitor className="w-4 h-4" />
            Виджет
          </TabsTrigger>
        </TabsList>

        <TabsContent value="streak" className="space-y-4">
          <StreakSettings channelName={channelName} user={user} />
          <StreakTracker channelName={channelName} user={user} />
        </TabsContent>

        <TabsContent value="donation" className="space-y-4">
          <DonationSettings channelName={channelName} user={user} />
        </TabsContent>

        <TabsContent value="points" className="space-y-4">
          <PointsRewards channelName={channelName} user={user} />
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <RewardsManager channelName={channelName} user={user} onRewardsCountChange={setRewardsCount} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <DropsHistory channelName={channelName} user={user} />
        </TabsContent>

        <TabsContent value="widget" className="space-y-4">
          <WidgetSettings channelName={channelName} user={user} />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default DropsMainPage;


