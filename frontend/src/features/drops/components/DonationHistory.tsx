import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, DollarSign } from 'lucide-react';
import { useDropsHistory } from '../../../queries/drops/dropsQueries';
import type { DonationEntry } from '../../../types';

interface DonationHistoryProps {
    user: any;
    platform: string;
    channelName: string;
}

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          Недавние донаты
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {history.map((entry) => (
            <div 
              key={entry.id}
              className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
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


