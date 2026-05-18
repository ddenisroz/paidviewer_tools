import React, { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Download, HeartPulse, Settings2 } from 'lucide-react';
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

const unwrapConfig = (payload: LocalTtsConfig | null | undefined): LocalTtsConfig | null => {
    if (!payload) return null;
    return payload;
};

const downloadJson = (filename: string, payload: unknown): void => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

const LocalTTSSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;

    const { data: statusResponse } = useTtsStatus(null, { enabled: Boolean(userId) });
    const { data: localConfigResponse, refetch: refetchLocalConfig } = useLocalTtsConfig('f5', { enabled: Boolean(userId) });
    const saveConfigMutation = useSaveLocalTtsConfig();
    const testConnectionMutation = useTestLocalTtsConnection();
    const toggleLocalMutation = useToggleLocalTts();

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

    const localConfig = unwrapConfig(localConfigResponse);
    const status = ((statusResponse as { data?: TtsStatus })?.data || statusResponse) as TtsStatus | undefined;

    const [endpointUrl, setEndpointUrl] = useState<string>('http://localhost:8011');
    const [apiKey, setApiKey] = useState<string>('');
    const [useLocal, setUseLocal] = useState<boolean>(false);

    useEffect(() => {
        if (!localConfig) return;
        setEndpointUrl(localConfig.endpoint_url || 'http://localhost:8011');
        setUseLocal(Boolean(localConfig.use_local));
    }, [localConfig]);

    const activeWorkers = useMemo(
        () => workers.filter((worker) => worker.status === 'online' || worker.status === 'busy'),
        [workers]
    );
    const isHealthy = Boolean(localConfig?.healthy);
    const isConfigured = Boolean(localConfig?.configured);
    const statusLabel = isHealthy ? 'Готов' : isConfigured ? 'Нужна проверка' : 'Не настроен';

    const handleSave = (): void => {
        saveConfigMutation.mutate(
            {
                provider: 'f5',
                endpoint_url: endpointUrl.trim(),
                api_key: apiKey.trim() || undefined,
                use_local: useLocal,
            },
            {
                onSuccess: () => {
                    setApiKey('');
                    void refetchLocalConfig();
                },
            }
        );
    };

    const handleTest = (): void => {
        testConnectionMutation.mutate({
            provider: 'f5',
            endpoint_url: endpointUrl.trim(),
            api_key: apiKey.trim() || undefined,
            use_local: true,
        });
    };

    const handleToggleLocal = (enabled: boolean): void => {
        setUseLocal(enabled);
        toggleLocalMutation.mutate('f5', {
            onSuccess: () => {
                void refetchLocalConfig();
            },
            onError: () => {
                setUseLocal(Boolean(localConfig?.use_local));
            },
        });
    };

    const handleDownloadProvisioning = async (): Promise<void> => {
        try {
            const response = await ttsService.createWorkerProvisioning({ provider_hint: 'f5' });
            const payload = response.data as {
                download_filename?: string;
                provisioning_bundle?: unknown;
                data?: { download_filename?: string; provisioning_bundle?: unknown };
            };
            const bundle = payload.provisioning_bundle || payload.data?.provisioning_bundle;
            const filename = payload.download_filename || payload.data?.download_filename || 'paidviewer-worker-f5.json';
            if (!bundle) {
                toast.error('Не удалось собрать provisioning bundle.');
                return;
            }
            downloadJson(filename, bundle);
            void refetchWorkers();
        } catch {
            toast.error('Не удалось скачать provisioning bundle.');
        }
    };

    return (
        <PageWrapper contentClassName="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-border/70 bg-card/85 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-xl">F5 Self-Host</CardTitle>
                            </div>
                            <Badge variant={isHealthy ? 'default' : 'secondary'}>{statusLabel}</Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Endpoint</label>
                                <Input
                                    value={endpointUrl}
                                    onChange={(event) => setEndpointUrl(event.target.value)}
                                    placeholder="http://localhost:8011"
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 md:min-w-[220px]">
                                <div>
                                    <div className="text-sm font-medium text-foreground">Использовать self-host</div>
                                </div>
                                <Switch checked={useLocal} onCheckedChange={handleToggleLocal} disabled={toggleLocalMutation.isPending} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">API key</label>
                            <Input
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={localConfig?.api_key_redacted || 'Если runtime защищен ключом, укажите его здесь'}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleTest} variant="secondary" disabled={testConnectionMutation.isPending}>
                                <HeartPulse className="mr-2 h-4 w-4" />
                                Проверить
                            </Button>
                            <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Сохранить
                            </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Режим</div>
                                <div className="mt-2 text-sm font-medium text-foreground">
                                    {useLocal ? 'Self-Host активен' : 'Работает cloud'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Health</div>
                                <div className="mt-2 text-sm font-medium text-foreground">
                                    {isHealthy ? 'Runtime отвечает' : 'Нужна проверка'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Статус TTS</div>
                                <div className="mt-2 text-sm font-medium text-foreground">
                                    {status?.enabled ? 'Озвучка включена' : 'Озвучка выключена'}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="border-border/70 bg-card/85 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Worker Agent</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Активные агенты</div>
                                    </div>
                                    <Badge variant="outline">{activeWorkers.length}</Badge>
                                </div>
                            </div>

                            <Button type="button" className="w-full" variant="secondary" onClick={() => void handleDownloadProvisioning()}>
                                <Download className="mr-2 h-4 w-4" />
                                Скачать provisioning bundle
                            </Button>

                            <div className="space-y-2">
                                {workers.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                                        Нет подключенных воркеров
                                    </div>
                                ) : (
                                    workers.map((worker) => (
                                        <div key={worker.worker_key} className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">{worker.label || 'F5 Worker'}</div>
                                                    <div className="text-xs text-muted-foreground">{worker.worker_key}</div>
                                                </div>
                                                <Badge variant={worker.status === 'online' || worker.status === 'busy' ? 'default' : 'secondary'}>
                                                    {worker.status || 'offline'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </PageWrapper>
    );
};

export default LocalTTSSettingsPage;
