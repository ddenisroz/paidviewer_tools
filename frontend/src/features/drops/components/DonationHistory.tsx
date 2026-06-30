import React from 'react';

import { DollarSign, History } from 'lucide-react';

import { useDropsHistory } from '@/queries/drops/dropsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { formatAppDateTime } from '@/shared/utils/dateTime';

import type { DonationEntry } from '../../../types';

interface DonationHistoryProps {
    user: Record<string, unknown>;
    platform: string;
    channelName: string;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';

const DonationHistory: React.FC<DonationHistoryProps> = ({ user, platform, channelName }) => {
    const { data: historyData, isLoading: loading } = useDropsHistory(
        channelName,
        { platform, drops_type: 'donation', limit: 20 },
        {
            enabled: !!user && !!platform && !!channelName,
            retry: false,
        }
    );

    const history: DonationEntry[] = historyData?.data || [];

    const formatDate = (dateString: string): string => {
        return formatAppDateTime(dateString, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getQualityColor = (quality?: { name?: string }): string => {
        switch (quality?.name?.toLowerCase()) {
            case 'common':
                return 'text-gray-400';
            case 'rare':
                return 'text-blue-400';
            case 'epic':
                return 'text-purple-400';
            case 'legendary':
                return 'text-yellow-400';
            case 'mythical':
            case 'mythyc':
                return 'text-pink-400';
            default:
                return 'text-gray-400';
        }
    };

    if (loading || history.length === 0) {
        return null;
    }

    return (
        <Card className={SURFACE_CARD_CLASS}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5" />
                    Недавние донаты
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-h-[min(300px,50vh)] space-y-2 overflow-y-auto">
                    {history.map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center justify-between rounded border border-border/70 bg-card/60 p-2 transition-colors hover:bg-accent/60"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <DollarSign className="h-4 w-4 flex-shrink-0 text-green-400" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{entry.viewer_name}</p>
                                    <p className={`truncate text-xs ${getQualityColor(entry.quality)}`}>
                                        {entry.reward_name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {entry.donation_amount} ₽
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default DonationHistory;
