import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { Bot, Mic, Shield, Users } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { ADMIN_PAGE_CLASS, AdminPageHeader } from '@/features/admin/components/admin-ui';
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

const AdminRuntimePage = lazy(() => import('./AdminRuntimePage'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const AdminTtsPage = lazy(() => import('./AdminTtsPage'));

interface Tab {
    id: AdminTabId;
    label: string;
    icon: React.ElementType;
}

const VISIBLE_TABS: Tab[] = [
    { id: 'runtime', label: 'Боты', icon: Bot },
    { id: 'accounts', label: 'Whitelist', icon: Users },
    { id: 'voices', label: 'Голоса', icon: Mic },
];

const TabSkeleton: React.FC = () => (
    <Card>
        <CardContent className="space-y-3 p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
        </CardContent>
    </Card>
);

const TabContent: React.FC<{ activeTab: AdminTabId }> = ({ activeTab }) => {
    switch (activeTab) {
        case 'accounts':
            return <UserManagementPage />;
        case 'voices':
            return <AdminTtsPage />;
        case 'runtime':
        default:
            return <AdminRuntimePage />;
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
        const rawTab = searchParams.get('tab');
        const normalizedTab = rawTab ? normalizeAdminTab(rawTab) : initialTab;
        const expectedHref = getAdminTabHref(normalizedTab);
        const expectedUrl = new URL(expectedHref, window.location.origin);
        const currentSearch = searchParams.toString();
        const currentHref = `${location.pathname}${currentSearch ? `?${currentSearch}` : ''}`;

        if (location.pathname === ADMIN_BASE_PATH && currentHref === `${expectedUrl.pathname}${expectedUrl.search}`) {
            return;
        }

        navigate(expectedHref, { replace: true });
    }, [initialTab, location.pathname, navigate, searchParams]);

    const handleTabChange = (tabId: AdminTabId) => {
        setActiveTab(tabId);
        navigate(getAdminTabHref(tabId), { replace: true });
    };

    if (!isAdmin) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 font-sans">
                <Card className="w-full max-w-sm">
                    <CardContent className="space-y-3 p-5 text-center">
                        <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
                        <h1 className="text-xl font-semibold">Доступ ограничен</h1>
                        <p className="text-sm text-muted-foreground">Для этого раздела нужна роль администратора.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={cn('p-4', ADMIN_PAGE_CLASS)}>
            <div className="mx-auto w-full max-w-5xl space-y-4">
                <AdminPageHeader
                    title="Админ панель"
                    description="Авторизация ботов, whitelist пользователей и управление голосовыми сэмплами."
                />

                <div className="rounded-lg border border-border/70 bg-card/60 p-1">
                    <div className="flex justify-start gap-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
                        {VISIBLE_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleTabChange(tab.id)}
                                    className={cn(
                                        'inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
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
                    <div className="mx-auto w-full max-w-5xl">
                        <TabContent activeTab={activeTab} />
                    </div>
                </Suspense>
            </div>
        </div>
    );
};

export default AdminPage;
