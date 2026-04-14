import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { BarChart3, Bot, FileText, Mic, Shield, Slash, Users } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { AdminPageHeader, ADMIN_PAGE_CLASS } from '@/features/admin/components/admin-ui';
import {
  ADMIN_BASE_PATH,
  type AdminTabId,
  getAdminTabHref,
  normalizeAdminTab,
  resolveAdminTabFromPath,
} from '@/features/admin/utils/adminRoutes';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import Skeleton from '@/shared/components/ui/skeleton';

const AdminOverviewPage = lazy(() => import('./AdminOverviewPage'));
const AdminRuntimePage = lazy(() => import('./AdminRuntimePage'));
const AdminTtsPage = lazy(() => import('./AdminTtsPage'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const AdminChannelsOpsPage = lazy(() => import('./AdminChannelsOpsPage'));
const AdminLogsOverviewPage = lazy(() => import('./AdminLogsOverviewPage'));

interface Tab {
  id: AdminTabId;
  label: string;
  icon: React.ElementType;
}

const VISIBLE_TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'runtime', label: 'Runtime', icon: Bot },
  { id: 'tts', label: 'TTS', icon: Mic },
  { id: 'accounts', label: 'Аккаунты', icon: Users },
  { id: 'channels', label: 'Каналы', icon: Slash },
  { id: 'logs', label: 'Логи', icon: FileText },
];

const TabSkeleton: React.FC = () => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-24 w-full" />
    </CardContent>
  </Card>
);

const TabContent: React.FC<{ activeTab: AdminTabId }> = ({ activeTab }) => {
  switch (activeTab) {
    case 'overview':
      return <AdminOverviewPage />;
    case 'runtime':
      return <AdminRuntimePage />;
    case 'tts':
      return <AdminTtsPage />;
    case 'accounts':
      return <UserManagementPage />;
    case 'channels':
      return <AdminChannelsOpsPage />;
    case 'logs':
      return <AdminLogsOverviewPage />;
    default:
      return <AdminOverviewPage />;
  }
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin === true;

  const initialTab = useMemo<AdminTabId>(() => {
    const searchTab = searchParams.get('tab');
    return searchTab ? normalizeAdminTab(searchTab) : resolveAdminTabFromPath(location.pathname);
  }, [location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState<AdminTabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const rawTab = searchParams.get('tab');
    const normalizedTab = rawTab ? normalizeAdminTab(rawTab) : initialTab;
    const isWrongPath = location.pathname !== ADMIN_BASE_PATH;
    const isWrongTab = rawTab ? normalizedTab !== rawTab : initialTab !== 'overview';

    if (!isWrongPath && !isWrongTab) {
      return;
    }

    if (normalizedTab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', normalizedTab);
    }

    const search = params.toString();
    navigate(
      {
        pathname: ADMIN_BASE_PATH,
        search: search ? `?${search}` : '',
      },
      { replace: true },
    );
  }, [initialTab, location.pathname, navigate, searchParams]);

  const handleTabChange = (tabId: AdminTabId) => {
    setActiveTab(tabId);
    navigate(getAdminTabHref(tabId), { replace: true });
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
          title="Админ-центр"
          description="Минималистичный ops-center: runtime, TTS, аккаунты, каналы и логи в одном согласованном контуре."
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
