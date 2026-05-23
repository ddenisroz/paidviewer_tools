import React, { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, HeartPulse, Save, Server } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import {
    useLocalTtsConfig,
    useSaveLocalTtsConfig,
    useTestLocalTtsConnection,
    useToggleLocalTts,
    useTtsStatus,
} from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import PageWrapper from '@/shared/components/PageWrapper';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';

import type { LocalTtsConfig, TtsStatus } from '@/types/tts';

interface WorkerItem {
    worker_key: string;
    label?: string;
    status?: string;
    supports_f5?: boolean;
}

const unwrapStatus = (payload: unknown): TtsStatus | undefined =>
    ((payload as { data?: TtsStatus })?.data || payload) as TtsStatus | undefined;

const statusLabel = (config: LocalTtsConfig | null | undefined): string => {
    if (config?.healthy) return 'Подключен';
    if (config?.configured) return 'Нужна проверка';
    return 'Не настроен';
};

const workerLabel = (status?: string): string => {
    if (status === 'online') return 'online';
    if (status === 'busy') return 'busy';
    return 'offline';
};

const LocalTTSSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;

    const { data: statusResponse } = useTtsStatus(null, { enabled: Boolean(userId) });
    const { data: localConfig, refetch: refetchLocalConfig } = useLocalTtsConfig('f5', { enabled: Boolean(userId) });
    const saveConfigMutation = useSaveLocalTtsConfig({
        onSuccess: () => {
            toast.success('Локальный движок сохранен');
            void refetchLocalConfig();
        },
    });
    const testConnectionMutation = useTestLocalTtsConnection({
        onSuccess: (response) => {
            const success =
                (response as { success?: boolean } | undefined)?.success ??
                (response as { data?: { success?: boolean } } | undefined)?.data?.success;
            toast[success ? 'success' : 'error'](success ? 'Подключение работает' : 'Подключение не отвечает');
            void refetchLocalConfig();
        },
    });
    const toggleLocalMutation = useToggleLocalTts({
        onSuccess: () => {
            void refetchLocalConfig();
        },
    });

    const { data: workers = [], refetch: refetchWorkers } = useQuery<WorkerItem[]>({
        queryKey: ['tts', 'workers', 'f5'],
        enabled: Boolean(userId),
        staleTime: 30 * 1000,
        queryFn: async () => {
            const response = await ttsService.getWorkerAgents();
            const payload = response.data as { workers?: WorkerItem[]; data?: { workers?: WorkerItem[] } };
            return (payload.workers || payload.data?.workers || []).filter((worker) => worker.supports_f5 !== false);
        },
    });

    const [endpointUrl, setEndpointUrl] = useState('http://localhost:8011');
    const [apiKey, setApiKey] = useState('');
    const [useLocal, setUseLocal] = useState(false);

    useEffect(() => {
        if (!localConfig) return;
        setEndpointUrl(localConfig.endpoint_url || 'http://localhost:8011');
        setUseLocal(Boolean(localConfig.use_local));
    }, [localConfig]);

    const status = unwrapStatus(statusResponse);
    const activeWorkers = useMemo(
        () => workers.filter((worker) => worker.status === 'online' || worker.status === 'busy'),
        [workers]
    );
    const configured = Boolean(localConfig?.configured || localConfig?.endpoint_url);
    const healthy = Boolean(localConfig?.healthy);

    const savePayload = (): Partial<LocalTtsConfig> => ({
        provider: 'f5',
        endpoint_url: endpointUrl.trim(),
        api_key: apiKey.trim() || undefined,
        use_local: useLocal,
    });

    const handleSave = (): void => {
        saveConfigMutation.mutate(savePayload());
    };

    const handleTest = (): void => {
        testConnectionMutation.mutate({
            provider: 'f5',
            endpoint_url: endpointUrl.trim(),
            api_key: apiKey.trim() || undefined,
            use_local: true,
        });
        void refetchWorkers();
    };

    const handleToggleLocal = (enabled: boolean): void => {
        if (!configured) {
            toast.error('Сначала сохраните endpoint');
            return;
        }
        setUseLocal(enabled);
        toggleLocalMutation.mutate('f5', {
            onError: () => setUseLocal(Boolean(localConfig?.use_local)),
        });
    };

    return (
        <PageWrapper contentClassName="space-y-4">
            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Server className="h-5 w-5 text-sky-300" />
                            Локальный F5 TTS
                        </CardTitle>
                        <Badge variant={healthy ? 'default' : 'secondary'}>{statusLabel(localConfig)}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Endpoint</label>
                            <Input
                                value={endpointUrl}
                                onChange={(event) => setEndpointUrl(event.target.value)}
                                placeholder="http://localhost:8011"
                                className="h-10"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/35 px-4 py-3">
                            <span className="text-sm font-bold text-foreground">Использовать self-host</span>
                            <Switch checked={useLocal} onCheckedChange={handleToggleLocal} disabled={toggleLocalMutation.isPending} />
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">API key</label>
                            <Input
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={localConfig?.api_key_redacted || 'опционально'}
                                className="h-10"
                            />
                        </div>
                        <Button type="button" variant="secondary" onClick={handleTest} disabled={testConnectionMutation.isPending}>
                            <HeartPulse className="mr-2 h-4 w-4" />
                            Проверить
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={saveConfigMutation.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            Сохранить
                        </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <StatusTile title="Endpoint" active={configured} value={configured ? endpointUrl : 'не задан'} />
                        <StatusTile title="Health" active={healthy} value={healthy ? 'отвечает' : 'нет ответа'} />
                        <StatusTile title="Режим" active={status?.f5_mode === 'local' || useLocal} value={useLocal ? 'self-host' : 'cloud'} />
                    </div>
                </CardContent>
            </Card>

            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Worker-ы</CardTitle>
                        <Badge variant="outline">{activeWorkers.length}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
                    {workers.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                            Worker-ы не подключены
                        </div>
                    ) : (
                        workers.map((worker) => (
                            <div key={worker.worker_key} className="rounded-lg border border-border/70 bg-background/35 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">{worker.label || 'F5 Worker'}</p>
                                        <p className="truncate text-xs text-muted-foreground">{worker.worker_key}</p>
                                    </div>
                                    <Badge variant={worker.status === 'online' || worker.status === 'busy' ? 'default' : 'secondary'}>
                                        {workerLabel(worker.status)}
                                    </Badge>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </PageWrapper>
    );
};

const StatusTile: React.FC<{ title: string; active: boolean; value: string }> = ({ title, active, value }) => (
    <div className="rounded-lg border border-border/70 bg-background/35 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {active ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-300" />}
            {title}
        </div>
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
    </div>
);

export default LocalTTSSettingsPage;
