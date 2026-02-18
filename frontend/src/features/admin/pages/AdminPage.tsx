import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { BarChart3, Bot, FileText, Mic, Monitor, Shield, Users } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import Skeleton from '@/shared/components/ui/skeleton';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const VoiceManagement = lazy(() => import('../components/VoiceManagement'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const BotManagementPage = lazy(() => import('./BotManagementPage'));
const SystemLogsPage = lazy(() => import('./SystemLogsPage'));
const MonitoringPage = lazy(() => import('./MonitoringPage'));

type TabId = 'dashboard' | 'bots' | 'voices' | 'users' | 'logs' | 'monitoring';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const VISIBLE_TABS: Tab[] = [
  { id: 'dashboard', label: 'Overview', icon: BarChart3 },
  { id: 'bots', label: 'Bot Connect', icon: Bot },
  { id: 'voices', label: 'Voices', icon: Mic },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'monitoring', label: 'Monitoring', icon: Monitor },
];

const isTabId = (value: string | null): value is TabId =>
  value === 'dashboard' ||
  value === 'bots' ||
  value === 'voices' ||
  value === 'users' ||
  value === 'logs' ||
  value === 'monitoring';

const tabFromPath = (pathname: string): TabId => {
  if (pathname.endsWith('/bots')) return 'bots';
  if (pathname.endsWith('/voices')) return 'voices';
  if (pathname.endsWith('/users')) return 'users';
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

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Card className="max-w-sm w-full">
          <CardContent className="p-5 text-center space-y-3">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="text-sm text-muted-foreground">Administrator role is required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mx-auto mb-4 w-full max-w-5xl border-b border-border">
        <div className="flex justify-start overflow-x-auto overflow-y-hidden hide-scrollbar">
          {VISIBLE_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
        <div className="mx-auto w-full max-w-5xl">
          <TabContent activeTab={activeTab} />
        </div>
      </Suspense>
    </div>
  );
};

export default AdminPage;
