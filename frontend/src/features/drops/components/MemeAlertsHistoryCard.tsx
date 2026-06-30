import React from 'react';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

import {
    SURFACE_CARD_CLASS,
    formatMemeAlertsAmount,
    formatMemeAlertsTimestamp,
    getSourceLabel,
    type MemeAlertsBalanceItem,
    type MemeAlertsHistoryItem,
} from './memealertsTypes';

interface MemeAlertsHistoryCardProps {
    historyRows: MemeAlertsHistoryItem[];
    historyLoading: boolean;
    historyError?: string | null;
    balanceRows: MemeAlertsBalanceItem[];
    balancesLoading: boolean;
    balancesError?: string | null;
    onRefreshHistory: () => void;
    onRefreshBalances: () => void;
}

export const MemeAlertsHistoryCard: React.FC<MemeAlertsHistoryCardProps> = ({
    historyRows,
    historyLoading,
    historyError,
    balanceRows,
    balancesLoading,
    balancesError,
    onRefreshHistory,
    onRefreshBalances,
}) => {
    const [activeTab, setActiveTab] = React.useState<'history' | 'balances'>('history');
    const loading = activeTab === 'history' ? historyLoading : balancesLoading;

    const refreshActiveTab = (): void => {
        if (activeTab === 'history') {
            onRefreshHistory();
            return;
        }
        onRefreshBalances();
    };

    return (
        <Card className={`${SURFACE_CARD_CLASS} flex h-[460px] w-full min-w-0 flex-col`}>
            <Tabs
                value={activeTab}
                onValueChange={(value) => {
                    const nextTab = value === 'balances' ? 'balances' : 'history';
                    setActiveTab(nextTab);
                    if (nextTab === 'balances') {
                        onRefreshBalances();
                    }
                }}
                className="flex min-h-0 flex-1 flex-col"
            >
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">MemeAlerts</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshActiveTab}
                            disabled={loading}
                            className="h-8 border-border/70 bg-card/70 px-2.5 hover:bg-accent"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span className="sr-only">{loading ? 'Обновляю...' : 'Обновить'}</span>
                        </Button>
                    </div>
                    <TabsList className="mt-3 grid h-9 w-full grid-cols-2 rounded-md border border-border/70 bg-background/40 p-0.5">
                        <TabsTrigger
                            value="history"
                            className="rounded-sm text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                            История
                        </TabsTrigger>
                        <TabsTrigger
                            value="balances"
                            className="rounded-sm text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                            Балансы
                        </TabsTrigger>
                    </TabsList>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 pt-0">
                    <TabsContent value="history" className="mt-0 h-full space-y-1.5 overflow-y-auto pr-1">
                        {historyError ? (
                            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-4 text-xs text-red-200">
                                {historyError}
                            </p>
                        ) : historyRows.length === 0 ? (
                            <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                История MemeAlerts пока пустая.
                            </p>
                        ) : (
                            historyRows.map((item, index) => (
                                <MemeAlertsHistoryRow key={`${item.id || index}`} item={item} />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="balances" className="mt-0 h-full space-y-1.5 overflow-y-auto pr-1">
                        {balancesError ? (
                            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-4 text-xs text-red-200">
                                {balancesError}
                            </p>
                        ) : balanceRows.length === 0 ? (
                            <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                                MemeAlerts пока не вернул список балансов.
                            </p>
                        ) : (
                            balanceRows.map((item, index) => (
                                <MemeAlertsBalanceRow key={`${item.id || item.user_id || index}`} item={item} />
                            ))
                        )}
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    );
};

const normalizeHistoryName = (value?: string | number | null): string | null => {
    const text = String(value ?? '').trim();
    if (!text || /^\d+$/.test(text)) return null;
    return text;
};

const MemeAlertsHistoryRow: React.FC<{ item: MemeAlertsHistoryItem }> = ({ item }) => {
    const isManual = item.source === 'ui' || item.type === 'ui';
    const platformName = normalizeHistoryName(item.platform_user_name);
    const userName = normalizeHistoryName(item.user_name);
    const memealertsName = normalizeHistoryName(item.memealerts_name) || userName || 'MemeAlerts';
    const primaryName = isManual ? platformName : platformName || userName || 'Пользователь';
    const showPrimaryName = Boolean(primaryName && primaryName !== memealertsName);

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
            <div className="min-w-0">
                {showPrimaryName ? (
                    <p className="truncate text-sm font-semibold text-foreground">{primaryName}</p>
                ) : null}
                <p className="truncate text-xs text-muted-foreground">MemeAlerts: {memealertsName}</p>
                <p className="text-[11px] text-muted-foreground">
                    {getSourceLabel(item.source, item.type)} · {formatMemeAlertsTimestamp(item.created_at)}
                </p>
            </div>
            <p className="text-sm font-semibold text-emerald-300">+{formatMemeAlertsAmount(item.amount)}</p>
        </div>
    );
};

const MemeAlertsBalanceRow: React.FC<{ item: MemeAlertsBalanceItem }> = ({ item }) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
        <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{item.memealerts_name || 'Пользователь'}</p>
            <p className="text-[11px] text-muted-foreground">
                Последняя активность: {formatMemeAlertsTimestamp(item.last_grant_at || undefined)}
            </p>
        </div>
        <p className="text-sm font-semibold text-emerald-300">{formatMemeAlertsAmount(item.amount)}</p>
    </div>
);
