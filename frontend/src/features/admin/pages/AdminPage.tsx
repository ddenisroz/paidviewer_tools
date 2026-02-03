import React, { lazy, Suspense, useState } from 'react';

import {
  History,
  MessageCircle,
  Mic,
  Settings,
  Shield,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ADMIN_SECTION_COLORS } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import Skeleton from '@/shared/components/ui/skeleton';



// Lazy load компонентов для оптимизации
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const VoiceManagement = lazy(() => import('../components/VoiceManagement'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const BotManagementPage = lazy(() => import('./BotManagementPage'));
const SupportTicketsPage = lazy(() => import('./SupportTicketsPage'));
const SystemLogsPage = lazy(() => import('./SystemLogsPage'));
const BlockedChannelsPage = lazy(() => import('./BlockedChannelsPage'));

// Типы
type TabId = 'dashboard' | 'voices' | 'users' | 'bots' | 'tickets' | 'logs' | 'blocked';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  color: string;
}

// Конфигурация табов
const TABS: Tab[] = [
  { id: 'dashboard', label: 'Обзор', icon: Shield, color: 'text-blue-400' },
  { id: 'voices', label: 'Голоса', icon: Mic, color: ADMIN_SECTION_COLORS.voices },
  { id: 'users', label: 'Пользователи', icon: Users, color: ADMIN_SECTION_COLORS.users },
  { id: 'bots', label: 'Боты', icon: Settings, color: ADMIN_SECTION_COLORS.bots },
  { id: 'tickets', label: 'Тикеты', icon: MessageCircle, color: ADMIN_SECTION_COLORS.tickets },
  { id: 'logs', label: 'Логи', icon: History, color: ADMIN_SECTION_COLORS.logs },
  { id: 'blocked', label: 'Заблокированные', icon: Shield, color: ADMIN_SECTION_COLORS.blocked },
];

// Компонент загрузки
const TabSkeleton: React.FC = () => (
  <Card>
    <CardContent className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full" />
    </CardContent>
  </Card>
);

// Компонент таба
const TabButton: React.FC<{
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}> = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-10 px-4 flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-200 outline-none select-none',
        isActive
          ? cn("text-white", tab.color)
          : "text-muted-foreground hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4", isActive ? tab.color : "")} />
      <span className="hidden sm:inline">{tab.label}</span>
      <span className="sm:hidden">{tab.label.slice(0, 3)}</span>

      {/* Active Indicator */}
      {isActive && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-[2px] rounded-full",
          tab.color.replace('text-', 'bg-') // Convert text color to bg color for the line
        )} />
      )}
    </button>
  );
};

// Рендер контента таба
const TabContent: React.FC<{ activeTab: TabId }> = ({ activeTab }) => {
  switch (activeTab) {
    case 'dashboard':
      return <AdminDashboard />;
    case 'voices':
      return <VoiceManagement />;
    case 'users':
      return <UserManagementPage />;
    case 'bots':
      return <BotManagementPage />;
    case 'tickets':
      return <SupportTicketsPage />;
    case 'logs':
      return <SystemLogsPage />;
    case 'blocked':
      return <BlockedChannelsPage />;
    default:
      return null;
  }
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Проверка прав доступа
  if (!user?.is_admin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Shield className="h-16 w-16 mx-auto text-red-400" />
            <h1 className="text-2xl font-bold">Доступ запрещен</h1>
            <p className="text-muted-foreground">
              У вас нет прав для доступа к админ панели
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="h-10"
            >
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Навигация табов с горизонтальным скроллом */}
        <div className="border-b border-white/5 pb-0">
          <div className="flex overflow-x-auto scrollbar-none gap-2">
            {TABS.map(tab => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        </div>

        {/* Контент таба с Suspense */}
        <Suspense fallback={<TabSkeleton />}>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <TabContent activeTab={activeTab} />
          </div>
        </Suspense>
      </div>
    </div>
  );
};

export default AdminPage;
