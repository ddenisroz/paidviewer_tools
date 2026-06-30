import React, { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
    CheckCircle2,
    CircleAlert,
    Download,
    ExternalLink,
    HeartPulse,
    RefreshCw,
    Save,
    Server,
    Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const SELF_HOST_DOWNLOAD_URL = 'https://github.com/paidviewer/self-hosted-tts/releases/latest';
const DEFAULT_RUNTIME_ENDPOINT = 'http://127.0.0.1:8011';

interface WorkerItem {
    worker_key: string;
    label?: string;
    status?: string;
    supports_f5?: boolean;
    last_seen_at?: string | null;
    last_error?: string | null;
}

interface ProvisioningResponse {
    download_filename?: string;
    provisioning_bundle?: Record<string, unknown>;
    worker_agent_contract?: {
        required_agent_version?: string | null;
        recommended_agent_version?: string | null;
        recommended_path?: string | null;
        official_mode?: string | null;
    };
}

const unwrapStatus = (payload: unknown): TtsStatus | undefined =>
    ((payload as { data?: TtsStatus })?.data || payload) as TtsStatus | undefined;

const formatDateTime = (value?: string | null): string => {
    if (!value) return 'never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const workerLabel = (status?: string): string => {
    if (status === 'online') return 'online';
    if (status === 'busy') return 'busy';
    if (status === 'disabled') return 'disabled';
    return 'offline';
};

const resolveReleaseStatus = ({
    configured,
    healthy,
    hasActiveWorker,
    useLocal,
}: {
    configured: boolean;
    healthy: boolean;
    hasActiveWorker: boolean;
    useLocal: boolean;
}): { label: string; tone: 'ready' | 'warn' | 'error'; description: string } => {
    if (!configured) {
        return {
            label: 'Needs setup',
            tone: 'warn',
            description: 'Скачайте движок и подготовьте настройки подключения.',
        };
    }
    if (!hasActiveWorker) {
        return {
            label: 'Agent offline',
            tone: 'error',
            description: 'Для аккаунта нет online worker agent.',
        };
    }
    if (!healthy) {
        return {
            label: 'Runtime offline',
            tone: 'error',
            description: `Agent подключен, но F5 runtime не отвечает на ${DEFAULT_RUNTIME_ENDPOINT}.`,
        };
    }
    if (!useLocal) {
        return {
            label: 'Needs setup',
            tone: 'warn',
            description: 'Self Hosted настроен. Включите его, когда будете готовы отправлять TTS локально.',
        };
    }
    return {
        label: 'Ready',
        tone: 'ready',
        description: 'Self Hosted подключен и готов создавать аудио на вашей машине.',
    };
};

const downloadJson = (filename: string, payload: unknown): void => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const LocalTTSSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;

    const { data: statusResponse } = useTtsStatus(null, { enabled: Boolean(userId) });
    const { data: localConfig, refetch: refetchLocalConfig } = useLocalTtsConfig('f5', { enabled: Boolean(userId) });
    const saveConfigMutation = useSaveLocalTtsConfig({
        onSuccess: () => {
            toast.success('Self Hosted settings saved');
            void refetchLocalConfig();
        },
    });
    const testConnectionMutation = useTestLocalTtsConnection({
        onSuccess: (response) => {
            const success =
                (response as { success?: boolean } | undefined)?.success ??
                (response as { data?: { success?: boolean } } | undefined)?.data?.success;
            toast[success ? 'success' : 'error'](
                success ? 'Self Hosted runtime is reachable' : 'Self Hosted runtime does not answer'
            );
            void refetchLocalConfig();
            void refetchWorkers();
        },
    });
    const toggleLocalMutation = useToggleLocalTts({
        onSuccess: () => {
            void refetchLocalConfig();
        },
    });

    const {
        data: workers = [],
        refetch: refetchWorkers,
        isFetching: workersFetching,
    } = useQuery<WorkerItem[]>({
        queryKey: ['tts', 'workers', 'f5'],
        enabled: Boolean(userId),
        staleTime: 15 * 1000,
        queryFn: async () => {
            const response = await ttsService.getWorkerAgents();
            const payload = response.data as { workers?: WorkerItem[]; data?: { workers?: WorkerItem[] } };
            return (payload.workers || payload.data?.workers || []).filter((worker) => worker.supports_f5 !== false);
        },
    });

    const [endpointUrl, setEndpointUrl] = useState(DEFAULT_RUNTIME_ENDPOINT);
    const [apiKey, setApiKey] = useState('');
    const [useLocal, setUseLocal] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [provisioningBusy, setProvisioningBusy] = useState(false);
    const [workerActionKey, setWorkerActionKey] = useState<string | null>(null);
    const [lastProvisioning, setLastProvisioning] = useState<ProvisioningResponse | null>(null);

    useEffect(() => {
        if (!localConfig) return;
        setEndpointUrl(localConfig.endpoint_url || DEFAULT_RUNTIME_ENDPOINT);
        setUseLocal(Boolean(localConfig.use_local));
    }, [localConfig]);

    const status = unwrapStatus(statusResponse);
    const activeWorkers = useMemo(
        () => workers.filter((worker) => worker.status === 'online' || worker.status === 'busy'),
        [workers]
    );
    const hasActiveWorker = activeWorkers.length > 0;
    const configured = Boolean(localConfig?.configured || localConfig?.endpoint_url || lastProvisioning || hasActiveWorker);
    const healthy = Boolean(localConfig?.healthy);
    const hasRuntimeKey = Boolean(localConfig?.has_api_key || apiKey.trim());
    const releaseStatus = resolveReleaseStatus({ configured, healthy, hasActiveWorker, useLocal });
    const requiredAgentVersion =
        lastProvisioning?.worker_agent_contract?.required_agent_version ||
        status?.active_contract?.capabilities?.required_agent_version ||
        'from provisioning bundle';

    const savePayload = (): Partial<LocalTtsConfig> => ({
        provider: 'f5',
        endpoint_url: endpointUrl.trim() || DEFAULT_RUNTIME_ENDPOINT,
        api_key: apiKey.trim() || undefined,
        use_local: useLocal,
    });

    const handleSave = (): void => {
        saveConfigMutation.mutate(savePayload());
    };

    const handleTest = (): void => {
        testConnectionMutation.mutate({
            provider: 'f5',
            endpoint_url: endpointUrl.trim() || DEFAULT_RUNTIME_ENDPOINT,
            api_key: apiKey.trim() || undefined,
            use_local: true,
        });
    };

    const handleToggleLocal = (enabled: boolean): void => {
        if (!configured) {
            toast.error('Сначала сохраните endpoint Self Hosted');
            return;
        }
        setUseLocal(enabled);
        toggleLocalMutation.mutate('f5', {
            onError: () => setUseLocal(Boolean(localConfig?.use_local)),
        });
    };

    const handleDownloadProvisioning = async (): Promise<void> => {
        setProvisioningBusy(true);
        try {
            const response = await ttsService.createWorkerProvisioning({
                label_hint: 'Self Hosted TTS',
                provider_hint: 'f5',
            });
            const payload = response.data as ProvisioningResponse;
            if (!payload.provisioning_bundle) {
                throw new Error('Provisioning bundle missing');
            }
            setLastProvisioning(payload);
            downloadJson(payload.download_filename || 'paidviewer-worker-provisioning-f5.json', payload.provisioning_bundle);
            toast.success('Connection settings downloaded');
        } catch {
            toast.error('Не удалось подготовить настройки подключения');
        } finally {
            setProvisioningBusy(false);
        }
    };

    const handleDisableWorker = async (workerKey: string): Promise<void> => {
        setWorkerActionKey(workerKey);
        try {
            await ttsService.disableWorkerAgent(workerKey);
            toast.success('Worker disabled');
            void refetchWorkers();
        } catch {
            toast.error('Could not disable worker');
        } finally {
            setWorkerActionKey(null);
        }
    };

    return (
        <PageWrapper contentClassName="space-y-4">
            <Card className="card-glass border-border/70">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Server className="h-5 w-5 text-sky-300" />
                                <h2 className="text-lg font-semibold text-foreground">Self Hosted TTS</h2>
                                <Badge
                                    variant={releaseStatus.tone === 'ready' ? 'default' : 'secondary'}
                                    className={
                                        releaseStatus.tone === 'error'
                                            ? 'border-red-500/30 bg-red-500/10 text-red-200'
                                            : undefined
                                    }
                                >
                                    {releaseStatus.label}
                                </Badge>
                            </div>
                            <p className="max-w-3xl text-sm text-muted-foreground">{releaseStatus.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="gap-2">
                                <a href={SELF_HOST_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    Скачать движок
                                </a>
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void handleDownloadProvisioning()}
                                disabled={provisioningBusy}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Скачать настройки подключения
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="card-glass border-border/70">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <CardTitle className="text-base">Настройка</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                        <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                            <div className="text-sm font-semibold text-foreground">Как это работает</div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Сайт отправляет задания на озвучку, Self Hosted приложение на вашем компьютере создает
                                аудио, а worker agent безопасно передает готовый файл обратно в Paidviewer.
                            </p>
                        </div>
                        <div className="hidden rounded-lg border border-border/70 bg-background/35 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-foreground">Runtime access</div>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        Advanced compatibility field for old worker setups. Leave it empty unless you
                                        already use a custom runtime secret.
                                    </p>
                                    {localConfig?.api_key_redacted ? (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Сохраненный ключ: {localConfig.api_key_redacted}. Оставьте поле пустым, чтобы не менять.
                                        </p>
                                    ) : null}
                                </div>
                                <Badge variant={hasRuntimeKey ? 'default' : 'secondary'}>
                                    {hasRuntimeKey ? 'key saved' : 'key required'}
                                </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-foreground">Runtime key</label>
                                    <Input
                                        value={apiKey}
                                        onChange={(event) => setApiKey(event.target.value)}
                                        placeholder={localConfig?.api_key_redacted || 'optional'}
                                        className="h-10"
                                        type="password"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleTest}
                                    disabled={testConnectionMutation.isPending}
                                >
                                    <HeartPulse className="mr-2 h-4 w-4" />
                                    Проверить
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saveConfigMutation.isPending || (!apiKey.trim() && !localConfig?.has_api_key)}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Сохранить ключ
                                </Button>
                            </div>
                        </div>
                        <SetupStep
                            index={1}
                            title="Скачайте Self Hosted"
                            body="Установите релизный пакет на машину, которая будет создавать аудио."
                            action={
                                <Button asChild size="sm" variant="outline">
                                    <a href={SELF_HOST_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                                        Открыть GitHub release
                                    </a>
                                </Button>
                            }
                        />
                        <SetupStep
                            index={2}
                            title="Скачайте настройки подключения"
                            body="JSON bundle содержит одноразовый pairing code, адрес сайта и сохраненный runtime key для worker agent."
                            action={
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleDownloadProvisioning()}
                                    disabled={provisioningBusy}
                                >
                                    Скачать bundle
                                </Button>
                            }
                        />
                        <SetupStep
                            index={3}
                            title="Запустите F5 runtime"
                            body={`Запустите f5-tts-service локально. Worker ожидает runtime на ${DEFAULT_RUNTIME_ENDPOINT}.`}
                        />
                        <SetupStep
                            index={4}
                            title="Запустите worker agent"
                            body="Agent читает скачанный bundle, подключается к Paidviewer, забирает задачи, отправляет их в runtime и загружает готовое аудио."
                        />
                        <SetupStep
                            index={5}
                            title="Проверьте и включите Self Hosted"
                            body="Когда worker online и runtime отвечает, включите Self Hosted для генерации F5."
                            action={
                                <Button type="button" size="sm" variant="outline" onClick={handleTest}>
                                    Проверить runtime
                                </Button>
                            }
                        />
                    </CardContent>
                </Card>

                <Card className="card-glass border-border/70">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <CardTitle className="text-base">Diagnostics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                        <StatusTile title="Agent" active={hasActiveWorker} value={hasActiveWorker ? 'online' : 'offline'} />
                        <StatusTile title="Runtime" active={healthy} value={healthy ? 'healthy' : 'not responding'} />
                        <StatusTile title="Mode" active={useLocal} value={useLocal ? 'Self Hosted' : 'Cloud'} />
                        <StatusTile title="Required agent" active={Boolean(requiredAgentVersion)} value={String(requiredAgentVersion)} />
                        <div className="rounded-lg border border-border/70 bg-background/35 p-3 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground">Runtime endpoint</div>
                            <div className="mt-1 break-all font-mono">{endpointUrl || DEFAULT_RUNTIME_ENDPOINT}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base">Workers</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{activeWorkers.length} active</Badge>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void refetchWorkers()}
                                disabled={workersFetching}
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${workersFetching ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-2 p-4 lg:grid-cols-2 xl:grid-cols-3">
                    {workers.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground lg:col-span-2 xl:col-span-3">
                            Worker agents пока не подключены.
                        </div>
                    ) : (
                        workers.map((worker) => (
                            <div key={worker.worker_key} className="rounded-lg border border-border/70 bg-background/35 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">
                                            {worker.label || 'Self Hosted Worker'}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">{worker.worker_key}</p>
                                    </div>
                                    <Badge
                                        variant={worker.status === 'online' || worker.status === 'busy' ? 'default' : 'secondary'}
                                    >
                                        {workerLabel(worker.status)}
                                    </Badge>
                                </div>
                                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                    <div>Последний сигнал: {formatDateTime(worker.last_seen_at)}</div>
                                    {worker.last_error ? <div className="text-red-300">Ошибка: {worker.last_error}</div> : null}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handleDisableWorker(worker.worker_key)}
                                        disabled={workerActionKey === worker.worker_key || worker.status === 'disabled'}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Отключить
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Расширенная совместимость</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setAdvancedOpen((value) => !value)}>
                            {advancedOpen ? 'Hide' : 'Show'}
                        </Button>
                    </div>
                </CardHeader>
                {advancedOpen ? (
                    <CardContent className="space-y-4 p-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Raw endpoint</label>
                                <Input
                                    value={endpointUrl}
                                    onChange={(event) => setEndpointUrl(event.target.value)}
                                    placeholder={DEFAULT_RUNTIME_ENDPOINT}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/35 px-4 py-3">
                                <span className="text-sm font-bold text-foreground">Use Self Hosted</span>
                                <Switch
                                    checked={useLocal}
                                    onCheckedChange={handleToggleLocal}
                                    disabled={toggleLocalMutation.isPending}
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">API key</label>
                                <Input
                                    value={apiKey}
                                    onChange={(event) => setApiKey(event.target.value)}
                                    placeholder={localConfig?.api_key_redacted || 'optional'}
                                    className="h-10"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleTest}
                                disabled={testConnectionMutation.isPending}
                            >
                                <HeartPulse className="mr-2 h-4 w-4" />
                                Проверить
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={saveConfigMutation.isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                Сохранить
                            </Button>
                        </div>
                        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/tts/voices')}>
                            Open voices
                        </Button>
                    </CardContent>
                ) : null}
            </Card>
        </PageWrapper>
    );
};

const SetupStep: React.FC<{ index: number; title: string; body: string; action?: React.ReactNode }> = ({
    index,
    title,
    body,
    action,
}) => (
    <div className="flex gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 text-sm font-bold text-sky-200">
            {index}
        </div>
        <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            {action ? <div className="mt-3">{action}</div> : null}
        </div>
    </div>
);

const StatusTile: React.FC<{ title: string; active: boolean; value: string }> = ({ title, active, value }) => (
    <div className="rounded-lg border border-border/70 bg-background/35 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {active ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
                <CircleAlert className="h-3.5 w-3.5 text-amber-300" />
            )}
            {title}
        </div>
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
    </div>
);

export default LocalTTSSettingsPage;
