import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Monitor,
  Settings,
  AlertCircle
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
import { toast } from 'sonner';
const DropsMainPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { integrations } = useIntegrations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'streak');
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

  // Определяем channelName (используем первый доступный канал)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setChannelName(null);
      return;
    }

    // Приоритет: Twitch -> VK
    if (integrations?.twitch?.enabled && user?.twitch_username) {
      setChannelName(user.twitch_username);
    } else if (integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name)) {
      setChannelName(user.vk_username || user.vk_channel_name);
    } else {
      setChannelName(null);
    }
  }, [isAuthenticated, user, integrations]);

  // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
  // Если пользователь не авторизован - показываем сообщение с предложением войти
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

  // Проверка наличия подключенных платформ
  const hasAnyIntegration = (integrations?.twitch?.enabled && user?.twitch_username) || 
                            (integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name));
  
  if (!hasAnyIntegration) {
    return (
      <PageWrapper title="Drops система">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Нет подключенных интеграций
              </h3>
              <p className="text-gray-400 text-sm">
                Для использования системы лояльности необходимо подключить хотя бы одну платформу (Twitch или VK Live)
              </p>
            </div>
            <Button 
              onClick={() => navigate('/dashboard/settings')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Перейти в настройки
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Проверяем, есть ли награды
  const hasRewards = rewardsCount > 0;

  return (
      <PageWrapper>
      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2 mb-4">
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
        <TabsContent value="streak" className="mt-0">
          <div className="space-y-4">
            <StreakSettings 
              user={user}
              channelName={channelName}
              hasRewards={hasRewards}
              integrations={integrations}
            />
            <StreakTracker 
              user={user}
              channelName={channelName}
            />
          </div>
        </TabsContent>

        {/* Донат */}
        <TabsContent value="donation" className="mt-0">
          <DonationSettings 
            user={user}
            channelName={channelName}
            hasRewards={hasRewards}
          />
        </TabsContent>

        {/* Баллы */}
        <TabsContent value="points" className="mt-0">
          <PointsRewards 
            user={user}
            platform={null}
            channelName={channelName}
            integrations={integrations}
          />
        </TabsContent>

        {/* Награды */}
        <TabsContent value="rewards" className="mt-0">
          <RewardsManager 
            user={user}
            channelName={channelName}
            integrations={integrations}
            onRewardsCountChange={setRewardsCount}
          />
        </TabsContent>

        {/* История */}
        <TabsContent value="history" className="mt-0">
          <DropsHistory 
            user={user}
            channelName={channelName}
          />
        </TabsContent>

        {/* Виджет */}
        <TabsContent value="widget" className="mt-0">
          <WidgetSettings 
            user={user}
            channelName={channelName}
          />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default DropsMainPage;
