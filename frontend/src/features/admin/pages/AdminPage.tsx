import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { BarChart3, Bot, FileText, Mic, Monitor, Shield, Slash, Users } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { AdminPageHeader, ADMIN_PAGE_CLASS } from '@/features/admin/components/admin-ui';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import Skeleton from '@/shared/components/ui/skeleton';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const VoiceManagement = lazy(() => import('../components/VoiceManagement'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const BotManagementPage = lazy(() => import('./AdminBotManagementPage'));
const BlockedChannelsPage = lazy(() => import('./AdminChannelsPage'));
const SystemLogsPage = lazy(() => import('./AdminSystemLogsPage'));
const MonitoringPage = lazy(() => import('./AdminMonitoringPage'));

type TabId = 'dashboard' | 'bots' | 'voices' | 'users' | 'channels' | 'logs' | 'monitoring';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const VISIBLE_TABS: Tab[] = [
  { id: 'dashboard', label: 'Обзор', icon: BarChart3 },
  { id: 'bots', label: 'Боты', icon: Bot },
  { id: 'voices', label: 'Голоса', icon: Mic },
  { id: 'users', label: 'Пользователи', icon: Users },
  { id: 'channels', label: 'Каналы', icon: Slash },
  { id: 'logs', label: 'Логи', icon: FileText },
  { id: 'monitoring', label: 'Мониторинг', icon: Monitor },
];

const isTabId = (value: string | null): value is TabId =>
  value === 'dashboard' ||
  value === 'bots' ||
  value === 'voices' ||
  value === 'users' ||
  value === 'channels' ||
  value === 'logs' ||
  value === 'monitoring';

const tabFromPath = (pathname: string): TabId => {
  if (pathname.endsWith('/bots')) return 'bots';
  if (pathname.endsWith('/voices')) return 'voices';
  if (pathname.endsWith('/users')) return 'users';
  if (pathname.endsWith('/channels')) return 'channels';
  if (pathname.endsWith('/monitoring')) return 'monitoring';
  if (pathname.endsWith('/logs')) return 'logs';
  return 'dashboard';
};

const TabSkeleton: React.FC = () => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-24 w-full" />
    </CardContent>
  </Card>
);

const TabContent: React.FC<{ activeTab: TabId }> = ({ activeTab }) => {
  switch (activeTab) {
    case 'dashboard':
      return <AdminDashboard />;
    case 'bots':
      return <BotManagementPage />;
    case 'voices':
      return <VoiceManagement />;
    case 'users':
      return <UserManagementPage />;
    case 'channels':
      return <BlockedChannelsPage />;
    case 'logs':
      return <SystemLogsPage />;
    case 'monitoring':
      return <MonitoringPage />;
    default:
      return <AdminDashboard />;
  }
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin === true;

  const initialTab = useMemo<TabId>(() => {
    const searchTab = searchParams.get('tab');
    if (isTabId(searchTab)) return searchTab;
    return tabFromPath(location.pathname);
  }, [location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    navigate(`/dashboard/dolbaebadmintts?tab=${tabId}`, { replace: true });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-4 font-sans flex items-center justify-center">
        <Card className="max-w-sm w-full">
          <CardContent className="p-5 text-center space-y-3">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Доступ ограничен</h1>
            <p className="text-sm text-muted-foreground">Для этого раздела нужна роль администратора.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('p-4', ADMIN_PAGE_CLASS)}>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <AdminPageHeader
          title="Админ-панель"
          description="Управление системой, голосами и bot runtime в одном месте."
        />

        <div className="rounded-2xl border border-border/70 bg-card/60 p-1.5">
          <div className="flex justify-start gap-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
            {VISIBLE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Suspense fallback={<TabSkeleton />}>
          <div className="mx-auto w-full max-w-6xl">
            <TabContent activeTab={activeTab} />
          </div>
        </Suspense>
      </div>
    </div>
  );
};

export default AdminPage;
