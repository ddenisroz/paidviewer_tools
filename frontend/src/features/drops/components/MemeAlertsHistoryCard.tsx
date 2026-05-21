import { RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import {
    SURFACE_CARD_CLASS,
    formatMemeAlertsAmount,
    formatMemeAlertsTimestamp,
    getSourceLabel,
    type MemeAlertsHistoryItem,
} from './memealertsTypes';

interface MemeAlertsHistoryCardProps {
    rows: MemeAlertsHistoryItem[];
    loading: boolean;
    onRefresh: () => void;
}

export const MemeAlertsHistoryCard: React.FC<MemeAlertsHistoryCardProps> = ({ rows, loading, onRefresh }) => (
    <Card className={`${SURFACE_CARD_CLASS} h-fit`}>
        <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">История выдачи</CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading}
                    className="h-8 border-border/70 bg-card/70 hover:bg-accent"
                >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {loading ? 'Обновляю...' : 'Обновить'}
                </Button>
            </div>
        </CardHeader>
        <CardContent className="pt-0">
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {rows.length === 0 ? (
                    <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-4 text-xs text-muted-foreground">
                        История пока пустая.
                    </p>
                ) : (
                    rows.map((item, index) => <MemeAlertsHistoryRow key={`${item.id || index}`} item={item} />)
                )}
            </div>
        </CardContent>
    </Card>
);

const MemeAlertsHistoryRow: React.FC<{ item: MemeAlertsHistoryItem }> = ({ item }) => {
    const platformName = item.platform_user_name || item.user_name || 'Пользователь';
    const memealertsName = item.memealerts_name || item.user_name || 'MemeAlerts';
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{platformName}</p>
                <p className="truncate text-xs text-muted-foreground">MemeAlerts: {memealertsName}</p>
                <p className="text-[11px] text-muted-foreground">
                    {getSourceLabel(item.source, item.type)} · {formatMemeAlertsTimestamp(item.created_at)}
                </p>
            </div>
            <p className="text-sm font-semibold text-emerald-300">+{formatMemeAlertsAmount(item.amount)}</p>
        </div>
    );
};
