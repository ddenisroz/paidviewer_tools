import React, { useEffect, useState } from 'react';

import { AlertCircle, Coins, DollarSign, History, Monitor, Settings, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import DonationSettings from '@/features/drops/components/DonationSettings';
import DropsHistory from '@/features/drops/components/DropsHistory';
import PointsRewards from '@/features/drops/components/PointsRewards';
import RewardsManager from '@/features/drops/components/RewardsManager';
import StreakSettings from '@/features/drops/components/StreakSettings';
import StreakTracker from '@/features/drops/components/StreakTracker';
import WidgetSettings from '@/features/drops/components/WidgetSettings';
import { DropsChestIcon } from '@/shared/components/icons/FeatureMarks';
import PageWrapper from '@/shared/components/PageWrapper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

type TabType = 'streak' | 'donation' | 'points' | 'rewards' | 'history' | 'widget';
const TAB_TRIGGER_CLASS =
    'relative h-10 rounded-none whitespace-nowrap border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-sky-300 data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-none gap-2';
const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const TAB_LIST_CONTAINER_CLASS = 'mb-4 border-b border-border/80';

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
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
                            <p className="text-muted-foreground text-sm break-words">
                                Для работы Drops войдите в систему и подключите Twitch или VK Live.
                            </p>
                        </div>
                        <Button onClick={() => navigate('/login')} variant="outline" className="gap-2 border-border/70">
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    // Check for connected integrations (from legacy)
    const hasAnyIntegration =
        (integrations?.twitch?.enabled && user?.twitch_username) ||
        (integrations?.vk?.enabled && (user?.vk_username || user?.vk_channel_name));

    if (!hasAnyIntegration) {
        return (
            <PageWrapper title="Drops система">
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">Нет подключенных интеграций</h3>
                            <p className="text-muted-foreground text-sm break-words">
                                Подключите хотя бы одну платформу: Twitch или VK Live.
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard/settings')}
                            variant="outline"
                            className="gap-2 border-border/70"
                        >
                            <Settings className="w-4 h-4" />
                            Перейти в настройки
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    // Guard clause for null channelName or user (loading state)
    if (!channelName || !user) {
        return (
            <PageWrapper title="Drops система">
                <Card className={SURFACE_CARD_CLASS}>
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">Загрузка данных...</h3>
                            <p className="text-muted-foreground text-sm">Пожалуйста, подождите</p>
                        </div>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Drops система">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full">
                <div className={TAB_LIST_CONTAINER_CLASS}>
                    <TabsList className="h-10 w-full items-stretch justify-start overflow-x-auto overflow-y-hidden hide-scrollbar rounded-none bg-transparent p-0">
                        <TabsTrigger value="streak" className={TAB_TRIGGER_CLASS}>
                            <Users className="w-4 h-4" />
                            Стрик
                        </TabsTrigger>
                        <TabsTrigger value="donation" className={TAB_TRIGGER_CLASS}>
                            <DollarSign className="w-4 h-4" />
                            Донаты
                        </TabsTrigger>
                        <TabsTrigger value="points" className={TAB_TRIGGER_CLASS}>
                            <Coins className="w-4 h-4" />
                            Баллы
                        </TabsTrigger>
                        <TabsTrigger value="rewards" className={TAB_TRIGGER_CLASS}>
                            <DropsChestIcon className="h-4 w-4" />
                            Награды
                        </TabsTrigger>
                        <TabsTrigger value="history" className={TAB_TRIGGER_CLASS}>
                            <History className="w-4 h-4" />
                            История
                        </TabsTrigger>
                        <TabsTrigger value="widget" className={TAB_TRIGGER_CLASS}>
                            <Monitor className="w-4 h-4" />
                            Виджет
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="streak" className="mt-4 w-full min-h-[420px] space-y-4">
                    <StreakSettings channelName={channelName} user={user} />
                    <StreakTracker channelName={channelName} user={user} />
                </TabsContent>

                <TabsContent value="donation" className="mt-4 w-full min-h-[420px] space-y-4">
                    <DonationSettings channelName={channelName} user={user} />
                </TabsContent>

                <TabsContent value="points" className="mt-4 w-full min-h-[420px] space-y-4">
                    <PointsRewards channelName={channelName} user={user} />
                </TabsContent>

                <TabsContent value="rewards" className="mt-4 w-full min-h-[420px] space-y-4">
                    <RewardsManager channelName={channelName} user={user} onRewardsCountChange={setRewardsCount} />
                </TabsContent>

                <TabsContent value="history" className="mt-4 w-full min-h-[420px] space-y-4">
                    <DropsHistory channelName={channelName} user={user} />
                </TabsContent>

                <TabsContent value="widget" className="mt-4 w-full min-h-[420px] space-y-4">
                    <WidgetSettings channelName={channelName} user={user} />
                </TabsContent>
            </Tabs>
        </PageWrapper>
    );
};

export default DropsMainPage;
