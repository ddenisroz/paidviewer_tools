import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { AdminPageHeader, ADMIN_ACTION_BUTTON_CLASS } from '@/features/admin/components/admin-ui';
import { TtsFleetSummaryCard, TtsProviderGrid } from '@/features/admin/components/ops-center/TtsSections';
import type { TtsPayload } from '@/features/admin/types/adminReadModels';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/utils/toastManager';

import VoiceManagement from '../components/VoiceManagement';

const AdminTtsPage: React.FC = () => {
  const { data, isLoading, refetch, isFetching } = useQuery<TtsPayload>({
    queryKey: queryKeys.admin.ttsOverview(),
    queryFn: async () => {
      const response = await adminService.getTtsOverview();
      const payload = response.data as { data?: TtsPayload };
      return payload.data ?? {};
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });

  const handleRestartTts = async (): Promise<void> => {
    try {
      await adminService.restartTtsEngine();
      toast.success('Команда на рестарт TTS отправлена');
      await refetch();
    } catch {
      toast.error('Не удалось отправить команду на рестарт TTS');
    }
  };

  const ttsData = data ?? {};
  const officialModes = ttsData.official_modes ?? ['cloud', 'self_host'];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="TTS"
        description="Единый cloud/self-host контур по F5 и Qwen без отдельных UX-потоков под каждый движок."
        actions={(
          <>
            <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void handleRestartTts()}>
              Рестарт TTS runtime
            </Button>
          </>
        )}
        meta={(
          <div className="flex flex-wrap gap-2">
            {officialModes.map(mode => <Badge key={mode} variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">{mode}</Badge>)}
          </div>
        )}
      />
      {isLoading ? (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">Загрузка TTS-сводки...</div>
      ) : (
        <>
          <TtsProviderGrid data={ttsData} />
          <TtsFleetSummaryCard data={ttsData} />
          <VoiceManagement />
        </>
      )}
    </div>
  );
};

export default AdminTtsPage;
