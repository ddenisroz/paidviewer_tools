import { RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

import {
    formatMemeAlertsAmount,
    formatMemeAlertsTimestamp,
    type MemeAlertsBalanceItem,
} from './memealertsTypes';

interface MemeAlertsBalancesDialogProps {
    open: boolean;
    rows: MemeAlertsBalanceItem[];
    loading: boolean;
    onOpenChange: (open: boolean) => void;
    onRefresh: () => void;
}

export const MemeAlertsBalancesDialog: React.FC<MemeAlertsBalancesDialogProps> = ({
    open,
    rows,
    loading,
    onOpenChange,
    onRefresh,
}) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-2xl">
            <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-8">
                    <DialogTitle className="text-base">Баланс мемкоинов</DialogTitle>
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
            </DialogHeader>

            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
                {rows.length === 0 ? (
                    <p className="rounded-lg border border-border/70 bg-card/70 px-3 py-4 text-sm text-muted-foreground">
                        Балансов пока нет.
                    </p>
                ) : (
                    rows.map((item, index) => (
                        <div
                            key={`${item.user_id || item.memealerts_name || index}`}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/70 bg-card/75 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {item.memealerts_name || 'Пользователь'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Последняя выдача: {formatMemeAlertsTimestamp(item.last_grant_at || undefined)}
                                </p>
                            </div>
                            <p className="text-sm font-semibold text-emerald-300">
                                {formatMemeAlertsAmount(item.amount)}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </DialogContent>
    </Dialog>
);
