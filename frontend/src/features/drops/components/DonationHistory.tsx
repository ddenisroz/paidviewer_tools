import React from 'react';

import { DollarSign, History } from 'lucide-react';

import { useDropsHistory } from '@/queries/drops/dropsQueries';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';


import type { DonationEntry } from '../../../types';

interface DonationHistoryProps {
    user: Record<string, unknown>;
    platform: string;
    channelName: string;
}

const SURFACE_CARD_CLASS = 'border-slate-800 bg-slate-950/70 backdrop-blur-sm shadow-md shadow-black/20';

const DonationHistory: React.FC<DonationHistoryProps> = ({ user, platform, channelName }) => {
  const { data: historyData, isLoading: loading } = useDropsHistory(
    channelName,
    { platform, drops_type: 'donation', limit: 20 },
    {
      enabled: !!user && !!platform && !!channelName,
      retry: false, // Silent fail - optional component
    }
  );

  const history: DonationEntry[] = historyData?.data || [];

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getQualityColor = (quality?: { name?: string }): string => {
    switch (quality?.name?.toLowerCase()) {
      case 'common': return 'text-gray-400';
      case 'rare': return 'text-blue-400';
      case 'epic': return 'text-purple-400';
      case 'legendary': return 'text-yellow-400';
      case 'mythical':
      case 'mythyc': return 'text-pink-400';
      default: return 'text-gray-400';
    }
  };

  if (loading || history.length === 0) {
    return null;
  }

  return (
    <Card className={SURFACE_CARD_CLASS}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          Недавние донаты
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[min(300px,50vh)] overflow-y-auto">
          {history.map((entry) => (
            <div 
              key={entry.id}
              className="flex items-center justify-between p-2 border border-slate-800 rounded bg-slate-950/60 hover:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{entry.viewer_name}</p>
                  <p className={`text-xs truncate ${getQualityColor(entry.quality)}`}>
                    {entry.reward_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs">
                  {entry.donation_amount}₽
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DonationHistory;


