import React, { useEffect, useState } from 'react';

/* eslint-disable no-alert */
import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    CheckCircle,
    Copy,
    Cpu,
    ExternalLink,
    HardDrive,
    Loader2,
    Mic,
    RefreshCw,
    Server,
    Settings,
    Trash2,
    Upload,
    User,
    XCircle,
    Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import {
    useDeleteVoiceMutation,
    useLocalVoicesQuery,
    useUpdateVoiceSettingsMutation,
    useUploadVoiceMutation
} from '@/queries/tts/localVoicesQueries';
import {
    useLocalTtsConfig,
    useSaveLocalTtsConfig,
    useTestLocalTtsConnection
} from '@/queries/tts/ttsQueries';
import { queryKeys } from '@/queries/queryKeys';
import { ttsService } from '@/services/api/services/ttsService';
import PageWrapper from '@/shared/components/PageWrapper';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { AxiosError } from 'axios';
import type { LocalTtsProviderContract } from '@/types';

type LocalTtsProvider = 'f5' | 'qwen';

interface ProviderMeta {
    label: string;
    defaultEndpoint: string;
    folder: string;
    installCommand: string;
    runCommand: string;
    apiKeyHint: string;
    docsUrl?: string;
}

const PROVIDER_META: Record<LocalTtsProvider, ProviderMeta> = {
    f5: {
        label: 'F5 TTS',
        defaultEndpoint: 'http://localhost:8011',
        folder: 'f5-tts-service',
        installCommand: 'uv sync',
        runCommand: 'uv run uvicorn app.main:app --port 8011',
        apiKeyHint: 'Если включена авторизация, укажите API ключ из .env или config сервиса.',
        docsUrl: 'https://github.com/ddenisroz/f5-tts-service/tree/phase1-bootstrap',
    },
    qwen: {
        label: 'Qwen 3 TTS',
        defaultEndpoint: 'http://localhost:8012',
        folder: 'nano-qwen3tts-vllm',
        installCommand: 'python -m pip install -r requirements.txt',
        runCommand: 'python api_server.py --host 0.0.0.0 --port 8012',
        apiKeyHint: 'Если у self-hosted Qwen runtime задан API_KEY, укажите тот же ключ здесь.',
        docsUrl: 'https://github.com/calldatfate/nano-qwen3tts-vllm'
    }
};

const FALLBACK_PROVIDER_CONTRACT: LocalTtsProviderContract = {
    managed_topology: 'gateway_managed',
    supports_native_health_endpoint: true,
    supports_local_voice_management: true,
    official_modes: ['cloud', 'self_host'],
    official_cloud_path: 'tts-gateway',
    official_self_host_path: 'tts_worker_agent',
    legacy_raw_endpoint_supported: true,
};

const DEFAULT_SELF_HOST_WARNING = 'Для релизного сценария используйте pairing bundle и локальный tts_worker_agent. Ручной URL ниже оставлен только как резервный compatibility path для диагностики и поддержки.';

const resolveLocalProviderContract = (
    providerContract?: LocalTtsProviderContract | null,
): LocalTtsProviderContract => ({
    ...FALLBACK_PROVIDER_CONTRACT,
    ...(providerContract || {}),
});

const resolveOfficialSelfHostPath = (providerContract: LocalTtsProviderContract): string =>
    providerContract.official_self_host_path || 'tts_worker_agent';

const resolveSelfHostWarning = (providerContract: LocalTtsProviderContract): string =>
    providerContract.warning || DEFAULT_SELF_HOST_WARNING;

interface LocalTtsConfigState {
    endpoint_url: string;
    api_key: string;
    use_local: boolean;
}

interface TestResult {
    success: boolean;
    message: string;
    warnings?: string[];
}

interface HealthData {
    status: string;
    version?: string;
    uptime?: number;
    ready?: boolean;
    phase?: string;
    percent?: number;
    message?: string;
    current_model?: string | null;
    target_model?: string | null;
    gpu_info?: {
        name: string;
        memory_total: number;
    };
}

interface StatusData {
    ready?: boolean;
    phase?: string;
    percent?: number;
    message?: string;
    current_model?: string | null;
    target_model?: string | null;
    progress?: {
        ready?: boolean;
        phase?: string;
        percent?: number;
        message?: string;
        current_model?: string | null;
        target_model?: string | null;
    };
    stats?: {
        total_requests: number;
        successful_requests: number;
        failed_requests: number;
        average_processing_time: number;
    };
}

interface WorkerInfo {
    worker_key: string;
    label: string;
    status: string;
    is_active: boolean;
    is_managed: boolean;
    supports_f5: boolean;
    supports_qwen: boolean;
    providers?: string[];
}

interface WorkersResponse {
    workers?: WorkerInfo[];
}

interface ProvisioningBundlePayload {
    kind?: string;
    format_version?: number;
    server_base_url?: string;
    pairing_code?: string;
    expires_at?: string | null;
    trusted_origins?: string[];
    label?: string;
    poll_interval_sec?: number;
    max_jobs_per_poll?: number;
    wait_for_jobs?: boolean;
    providers?: Record<string, {
        enabled?: boolean;
        endpoint_url?: string;
        api_key?: string;
    }>;
}

interface WorkerProvisioningResponse {
    download_filename?: string;
    provisioning_bundle?: ProvisioningBundlePayload;
    expires_at?: string | null;
}

interface Voice {
    id: number;
    name: string;
    language?: string | null;
    description?: string | null;
    type?: 'base' | 'custom';
    voice_type?: 'base' | 'custom';
    samples_count?: number;
    file_path?: string | null;
    is_active?: boolean;
    created_at?: string | null;
    reference_text?: string | null;
    cfg_strength?: number | null;
    speed_preset?: VoiceSpeedPreset | null;
}

interface UploadVoiceDraft {
    name: string;
    sampleText: string;
    file: File | null;
}

type VoiceSpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';

interface VoiceSettingsDraft {
    referenceText: string;
    cfgStrength: number;
    speedPreset: VoiceSpeedPreset;
}

const TAB_TRIGGER_CLASS =
    'rounded-none -mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-sky-300 data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-none';
const PROVIDER_SWITCH_TAB_CLASS =
    'appearance-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-sky-300 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-[inset_0_-1px_0_0_rgba(14,165,233,1)]';
const VOICE_CARD_CLASS = 'overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-sm shadow-none';
const SPEED_PRESET_OPTIONS: VoiceSpeedPreset[] = ['very_slow', 'slow', 'normal', 'fast', 'very_fast'];

const getConfiguredLocalAgentApiUrl = (): string | null => {
    const configuredUrl = (import.meta.env.VITE_LOCAL_TTS_AGENT_URL as string | undefined)?.trim();
    return configuredUrl ? configuredUrl.replace(/\/+$/, '') : null;
};

const getVoiceType = (voice: Voice): 'base' | 'custom' => (
    voice.type === 'base' || voice.voice_type === 'base' ? 'base' : 'custom'
);

const getVoiceStatusLabel = (voice: Voice): 'Готов' | 'Недоступен' => {
    if (voice.is_active === false) {
        return 'Недоступен';
    }
    if (getVoiceType(voice) === 'custom' && !voice.file_path) {
        return 'Недоступен';
    }
    return 'Готов';
};

const getVoiceSubtitle = (voice: Voice): string => {
    if (voice.file_path) {
        return 'Референсный файл подключен';
    }
    if (voice.language === 'ru') {
        return 'Русский голос';
    }
    if (voice.language === 'en') {
        return 'English voice';
    }
    return getVoiceType(voice) === 'base'
        ? 'Базовый голос из каталога провайдера'
        : 'Пользовательский голос готов к использованию';
};

const getSpeedPresetLabel = (preset: VoiceSpeedPreset): string => {
    switch (preset) {
        case 'very_slow':
            return 'Очень медленный';
        case 'slow':
            return 'Медленный';
        case 'normal':
            return 'Нормальный';
        case 'fast':
            return 'Быстрый';
        case 'very_fast':
            return 'Очень быстрый';
        default:
            return 'Нормальный';
    }
};

const LocalTTSSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();

    const isTwitchConnected = integrations.twitch?.enabled;
    const isVkConnected = integrations.vk?.enabled;
    const [provider, setProvider] = useState<LocalTtsProvider>('f5');
    const providerMeta = PROVIDER_META[provider];

    const [config, setConfig] = useState<LocalTtsConfigState>({
        endpoint_url: providerMeta.defaultEndpoint,
        api_key: '',
        use_local: false
    });
    const [hasStoredApiKey, setHasStoredApiKey] = useState<boolean>(false);

    const [testing, setTesting] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [healthData, setHealthData] = useState<HealthData | null>(null);
    const [statusData, setStatusData] = useState<StatusData | null>(null);
    const [hasResolvedInitialConfig, setHasResolvedInitialConfig] = useState<boolean>(false);
    const { data: configData, isLoading: configLoading, error: configError } = useLocalTtsConfig(provider);
    const providerContract = React.useMemo<LocalTtsProviderContract>(
        () => resolveLocalProviderContract(configData?.provider_contract),
        [configData?.provider_contract],
    );
    const officialSelfHostPath = resolveOfficialSelfHostPath(providerContract);
    const selfHostWarning = resolveSelfHostWarning(providerContract);

    const canManageVoices = providerContract.supports_local_voice_management !== false;
    const hasSavedConfig = configData?.configured === true;
    const hasHealthyVoiceManagementEndpoint =
        configData?.healthy === true || configData?.data?.healthy === true || testResult?.success === true;
    const canOpenVoiceManagement = canManageVoices && hasSavedConfig && hasHealthyVoiceManagementEndpoint;
    const shouldLoadVoices = canOpenVoiceManagement;
    const initializationState = React.useMemo(() => {
        const candidate = statusData?.progress || statusData || healthData;
        if (!candidate) {
            return null;
        }

        const rawPercent = candidate.percent;
        const percent = typeof rawPercent === 'number'
            ? Math.max(0, Math.min(100, rawPercent))
            : null;
        const phase = typeof candidate.phase === 'string' ? candidate.phase : null;
        const message = typeof candidate.message === 'string' ? candidate.message : null;
        const currentModel = typeof candidate.current_model === 'string' ? candidate.current_model : null;
        const targetModel = typeof candidate.target_model === 'string' ? candidate.target_model : null;
        const ready = candidate.ready === true || healthData?.status === 'healthy';

        if (percent === null && !phase && !message && !currentModel && !targetModel) {
            return null;
        }

        return {
            percent,
            phase,
            message,
            currentModel,
            targetModel,
            ready,
        };
    }, [healthData, statusData]);

    const { data: voicesData, isLoading: loadingVoices, refetch: refetchVoices } = useLocalVoicesQuery(provider, shouldLoadVoices);
    const voices = (voicesData || []) as Voice[];

    const uploadVoiceMutation = useUploadVoiceMutation(provider);
    const deleteVoiceMutation = useDeleteVoiceMutation(provider);
    const updateVoiceSettingsMutation = useUpdateVoiceSettingsMutation(provider);
    const userVoices = React.useMemo(() => voices.filter((voice) => getVoiceType(voice) === 'custom'), [voices]);

    const [isUploadVoiceDialogOpen, setIsUploadVoiceDialogOpen] = useState<boolean>(false);
    const [isVoiceSettingsDialogOpen, setIsVoiceSettingsDialogOpen] = useState<boolean>(false);
    const [isPairingDialogOpen, setIsPairingDialogOpen] = useState<boolean>(false);
    const [pairingDownloadFilename, setPairingDownloadFilename] = useState<string>('');
    const [pairingStatusMessage, setPairingStatusMessage] = useState<string>('');
    const [pairingUsedDownloadFallback, setPairingUsedDownloadFallback] = useState<boolean>(false);
    const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<string | null>(null);
    const [pairingLoading, setPairingLoading] = useState<boolean>(false);
    const [pairingError, setPairingError] = useState<string | null>(null);
    const [uploadVoiceDraft, setUploadVoiceDraft] = useState<UploadVoiceDraft>({
        name: '',
        sampleText: '',
        file: null,
    });
    const [currentVoice, setCurrentVoice] = useState<Voice | null>(null);
    const [voiceSettingsDraft, setVoiceSettingsDraft] = useState<VoiceSettingsDraft>({
        referenceText: '',
        cfgStrength: 3.0,
        speedPreset: 'normal',
    });
    const uploadingFile = uploadVoiceMutation.isPending;
    const [currentTab, setCurrentTab] = useState<'connection' | 'voices'>('connection');
    const { data: workerAgentsData, refetch: refetchWorkerAgents } = useQuery<WorkersResponse>({
        queryKey: queryKeys.tts.workers(provider),
        queryFn: async () => {
            const response = await ttsService.getWorkerAgents();
            return response.data as WorkersResponse;
        },
        staleTime: 5_000,
        refetchInterval: 15_000,
        refetchOnWindowFocus: false,
        enabled: isAuthenticated,
    });
    const providerWorkers = React.useMemo(() => {
        const workers = workerAgentsData?.workers || [];
        return workers.filter((worker) => (
            provider === 'qwen' ? worker.supports_qwen : worker.supports_f5
        ));
    }, [provider, workerAgentsData]);
    const hasReadyWorker = providerWorkers.some((worker) => (
        worker.is_active && (worker.status === 'online' || worker.status === 'busy')
    ));
    const providerLampClass = hasReadyWorker
        ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]'
        : 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]';

    useEffect(() => {
        setTestResult(null);
        setHealthData(null);
        setStatusData(null);
        setCurrentTab('connection');
        setIsUploadVoiceDialogOpen(false);
        setIsVoiceSettingsDialogOpen(false);
        setIsPairingDialogOpen(false);
        setPairingDownloadFilename('');
        setPairingStatusMessage('');
        setPairingUsedDownloadFallback(false);
        setPairingCodeExpiresAt(null);
        setPairingError(null);
        setCurrentVoice(null);
        setVoiceSettingsDraft({
            referenceText: '',
            cfgStrength: 3.0,
            speedPreset: 'normal',
        });
        setConfig({
            endpoint_url: providerMeta.defaultEndpoint,
            api_key: '',
            use_local: false,
        });
        setHasStoredApiKey(false);
    }, [provider, providerMeta.defaultEndpoint]);

    useEffect(() => {
        if (!configLoading) {
            setHasResolvedInitialConfig(true);
        }
    }, [configLoading]);

    useEffect(() => {
        if (currentTab === 'voices' && !canOpenVoiceManagement) {
            setCurrentTab('connection');
        }
    }, [canOpenVoiceManagement, currentTab]);

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (configLoading) return;
        if (!configData || configData.configured === false) {
            setConfig({
                endpoint_url: providerMeta.defaultEndpoint,
                api_key: '',
                use_local: false
            });
            setHasStoredApiKey(false);
            return;
        }
        setHasStoredApiKey(Boolean(configData.has_api_key));
        setConfig({
            endpoint_url: configData.endpoint_url || configData.host || providerMeta.defaultEndpoint,
            api_key: configData.api_key || '',
            use_local: configData.use_local ?? configData.enabled ?? false
        });
    }, [configData, configLoading, providerMeta.defaultEndpoint]);

    useEffect(() => {
        if (configError) {
            logger.error('Error loading config:', configError);
        }
    }, [configError]);

    const testConnectionMutation = useTestLocalTtsConnection({
        onSuccess: (response) => {
            const payload = response as {
                success?: boolean;
                message?: string;
                error?: string;
                health_data?: HealthData;
                status_data?: StatusData;
                data?: {
                    success?: boolean;
                    message?: string;
                    error?: string;
                    health_data?: HealthData;
                    status_data?: StatusData;
                };
            };
            const nested = payload.data || {};
            const success = payload.success ?? nested.success ?? false;
            const warnings = Array.isArray((payload as { warnings?: string[] }).warnings)
                ? ((payload as { warnings?: string[] }).warnings || []).filter(Boolean)
                : [];
            if (success) {
                setTestResult({
                    success: true,
                    message: payload.message || nested.message || 'Соединение успешно!',
                    warnings,
                });
                setHealthData(payload.health_data || nested.health_data || null);
                setStatusData(payload.status_data || nested.status_data || null);
                return;
            }
            setTestResult({
                success: false,
                message: payload.error || nested.error || payload.message || nested.message || 'Не удалось подключиться',
                warnings,
            });
            setHealthData(null);
            setStatusData(null);
        },
        onError: (error) => {
            const axiosError = error as AxiosError<{ detail?: string | { message?: string } }>;
            const detailPayload = axiosError.response?.data?.detail;
            const detailMessage = typeof detailPayload === 'string'
                ? detailPayload
                : detailPayload?.message;
            setTestResult({
                success: false,
                message: detailMessage || 'Ошибка соединения с сервером'
            });
        },
        onMutate: () => {
            setTesting(true);
            setTestResult(null);
            setHealthData(null);
            setStatusData(null);
        },
        onSettled: () => {
            setTesting(false);
        },
    });

    const testConnection = (): void => {
        const endpoint = config.endpoint_url.trim();
        if (!endpoint) {
            toast.error('Укажите URL сервера');
            return;
        }
        testConnectionMutation.mutate({
            provider,
            endpoint_url: endpoint,
            api_key: config.api_key.trim() || undefined,
            use_local: config.use_local
        });
    };

    const saveConfigMutation = useSaveLocalTtsConfig({
        onSuccess: () => {
            if (config.api_key.trim()) {
                setHasStoredApiKey(true);
            }
            // Toast обработан в hook
        },
        onError: (error: unknown) => {
            logger.error('Error saving config:', error);
        },
        onMutate: () => {
            setSaving(true);
        },
        onSettled: () => {
            setSaving(false);
        },
    });

    const saveConfig = (): void => {
        const endpoint = config.endpoint_url.trim();
        if (!endpoint) {
            toast.error('Укажите URL сервера');
            return;
        }
        saveConfigMutation.mutate({
            provider,
            endpoint_url: endpoint,
            api_key: config.api_key.trim() || undefined,
            use_local: config.use_local
        });
    };

    const copyToClipboard = (text: string): void => {
        navigator.clipboard.writeText(text);
        toast.success('Скопировано в буфер обмена');
    };

    const downloadProvisioningBundle = (bundle: ProvisioningBundlePayload, filename: string): void => {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
    };

    const provisionLocalAgent = async (bundle: ProvisioningBundlePayload): Promise<void> => {
        const localAgentApiUrl = getConfiguredLocalAgentApiUrl();
        if (!localAgentApiUrl) {
            throw new Error('Local TTS agent URL is not configured');
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(`${localAgentApiUrl}/api/provision`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ provisioning_bundle: bundle }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                const detail = typeof payload?.detail === 'string' ? payload.detail : '';
                throw new Error(detail || 'Локальный агент недоступен');
            }
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    const requestPairingCode = async (): Promise<void> => {
        setPairingLoading(true);
        setPairingError(null);
        setPairingDownloadFilename('');
        setPairingStatusMessage('');
        setPairingUsedDownloadFallback(false);
        setPairingCodeExpiresAt(null);
        try {
            const response = await ttsService.createWorkerProvisioning({ provider_hint: provider });
            const payload = response.data as WorkerProvisioningResponse;
            const bundle = payload.provisioning_bundle;
            const filename = String(payload.download_filename || '').trim();
            if (!bundle || bundle.kind !== 'paidviewer_worker_provisioning') {
                throw new Error('Сервер не вернул файл подключения');
            }
            if (!filename) {
                throw new Error('Сервер не вернул имя файла подключения');
            }

            try {
                await provisionLocalAgent(bundle);
                setPairingStatusMessage('Локальный агент найден и подключается');
                setPairingCodeExpiresAt(payload.expires_at || bundle.expires_at || null);
                setIsPairingDialogOpen(true);
                toast.success('Устройство передано локальному агенту');
                window.setTimeout(() => {
                    void refetchWorkerAgents();
                }, 2500);
                return;
            } catch (localProvisionError) {
                logger.warn('Local agent provisioning failed, falling back to download:', localProvisionError);
            }

            downloadProvisioningBundle(bundle, filename);
            setPairingDownloadFilename(filename);
            setPairingStatusMessage('Локальный агент не найден, скачан резервный файл подключения');
            setPairingUsedDownloadFallback(true);
            setPairingCodeExpiresAt(payload.expires_at || bundle.expires_at || null);
            setIsPairingDialogOpen(true);
            toast.success('Файл подключения скачан');
            void refetchWorkerAgents();
        } catch (error) {
            logger.error('Error creating worker provisioning bundle:', error);
            const message = error instanceof Error ? error.message : 'Не удалось скачать файл подключения';
            setPairingError(message);
            setIsPairingDialogOpen(true);
        } finally {
            setPairingLoading(false);
        }
    };

    const resetUploadVoiceDraft = (): void => {
        setUploadVoiceDraft({
            name: '',
            sampleText: '',
            file: null,
        });
    };

    const openVoiceSettings = (voice: Voice): void => {
        setCurrentVoice(voice);
        setVoiceSettingsDraft({
            referenceText: voice.reference_text || '',
            cfgStrength: typeof voice.cfg_strength === 'number' ? voice.cfg_strength : 3.0,
            speedPreset: voice.speed_preset || 'normal',
        });
        setIsVoiceSettingsDialogOpen(true);
    };

    const closeVoiceSettings = (open: boolean): void => {
        setIsVoiceSettingsDialogOpen(open);
        if (!open) {
            setCurrentVoice(null);
        }
    };

    const uploadVoice = (): void => {
        if (!uploadVoiceDraft.name.trim()) {
            toast.error('Введите название голоса');
            return;
        }
        if (!uploadVoiceDraft.file) {
            toast.error('Выберите аудиофайл');
            return;
        }

        uploadVoiceMutation.mutate(
            {
                name: uploadVoiceDraft.name.trim(),
                file: uploadVoiceDraft.file,
                sampleText: uploadVoiceDraft.sampleText.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setIsUploadVoiceDialogOpen(false);
                    resetUploadVoiceDraft();
                }
            }
        );
    };

    // Using TanStack Query mutation instead of direct axios
    const deleteVoice = (voiceId: number): void => {
        if (!confirm('Удалить голос со всеми данными?')) return;
        deleteVoiceMutation.mutate(voiceId);
    };

    const saveVoiceSettings = (): void => {
        if (!currentVoice) {
            return;
        }

        const settings: Record<string, unknown> = {
            reference_text: voiceSettingsDraft.referenceText.trim() || null,
        };

        if (provider === 'f5') {
            settings.cfg_strength = Number(voiceSettingsDraft.cfgStrength.toFixed(1));
            settings.speed_preset = voiceSettingsDraft.speedPreset;
        }

        updateVoiceSettingsMutation.mutate(
            {
                voiceId: currentVoice.id,
                settings,
            },
            {
                onSuccess: () => {
                    closeVoiceSettings(false);
                },
            },
        );
    };

    useEffect(() => {
        if (canOpenVoiceManagement && currentTab === 'voices') {
            refetchVoices();
        }
    }, [canOpenVoiceManagement, currentTab, refetchVoices]);

    const renderVoiceCard = (voice: Voice): React.ReactNode => {
        const voiceStatus = getVoiceStatusLabel(voice);

        return (
            <Card key={voice.id} className={`${VOICE_CARD_CLASS} flex min-h-[148px] flex-col`}>
                <CardHeader className="space-y-2 p-3.5 pb-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <CardTitle className="truncate text-sm font-semibold text-foreground">
                                {voice.name}
                            </CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteVoice(voice.id)}
                            className="h-8 w-8 shrink-0 p-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                            title="Удалить голос"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-emerald-500/15 bg-background/40 text-muted-foreground">
                            self-hosted
                        </Badge>
                        <Badge
                            variant="outline"
                            className={voiceStatus === 'Готов'
                                ? 'border-emerald-400/45 bg-emerald-500/10 text-emerald-300'
                                : 'border-red-400/45 bg-red-500/10 text-red-300'}
                        >
                            {voiceStatus}
                        </Badge>
                    </div>
                    <p className="line-clamp-2 min-h-10 text-xs text-muted-foreground">
                        {getVoiceSubtitle(voice)}
                    </p>
                </CardHeader>
                <CardContent className="mt-auto px-3.5 pb-3.5 pt-0">
                    <div className="grid grid-cols-2 gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openVoiceSettings(voice)}
                            className="h-8 justify-center border-blue-500/35 bg-blue-500/12 text-blue-200 hover:border-blue-400/45 hover:bg-blue-500/16 hover:text-blue-100"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            Настроить
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteVoice(voice.id)}
                            className="h-8 justify-center border-red-500/35 bg-red-500/10 text-red-200 hover:border-red-400/45 hover:bg-red-500/16 hover:text-red-100"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Удалить
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Настройка локального TTS">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Требуется авторизация
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования управления TTS необходимо войти в систему и подключить одну из платформ (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="gap-2 border border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                        >
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    if (!isTwitchConnected && !isVkConnected) {
        return (
            <PageWrapper title="Настройка локального TTS">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Нет подключенных интеграций
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования управления TTS необходимо подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard/settings')}
                            className="gap-2 border border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                        >
                            <Settings className="w-4 h-4" />
                            Перейти в настройки
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    if (configLoading && !hasResolvedInitialConfig) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <PageWrapper title="Локальный TTS">
            <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'connection' | 'voices')} className="space-y-6">
                <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="connection" className={`flex items-center gap-2 ${TAB_TRIGGER_CLASS}`}>
                        <Server className="w-4 h-4" />
                        Подключение
                    </TabsTrigger>
                    <TabsTrigger value="voices" className={`flex items-center gap-2 ${TAB_TRIGGER_CLASS}`} disabled={!canOpenVoiceManagement}>
                        <Mic className="w-4 h-4" />
                        Управление голосами
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="connection" className="space-y-4">
                    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/75 p-6 shadow-none backdrop-blur-sm">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex items-center gap-2">
                                    <Server className="w-5 h-5" />
                                    <h3 className="text-lg font-semibold text-foreground">Подключение</h3>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={requestPairingCode}
                                        disabled={pairingLoading}
                                        className="border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                    >
                                        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${providerLampClass}`} />
                                        Подключить устройство
                                        {pairingLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                                    </Button>
                                    <a
                                        href={PROVIDER_META.f5.docsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Репозиторий F5
                                    </a>
                                    <a
                                        href={PROVIDER_META.qwen.docsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Репозиторий Qwen
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 pb-1">
                                <button
                                    type="button"
                                    onClick={() => setProvider('f5')}
                                    className={PROVIDER_SWITCH_TAB_CLASS}
                                    data-state={provider === 'f5' ? 'active' : 'inactive'}
                                >
                                    F5 TTS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProvider('qwen')}
                                    className={PROVIDER_SWITCH_TAB_CLASS}
                                    data-state={provider === 'qwen' ? 'active' : 'inactive'}
                                >
                                    Qwen 3 TTS
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">Папка</p>
                                    <code className="block rounded-lg bg-[#13192b] px-3 py-2 text-sm text-slate-100">
                                        cd {providerMeta.folder}
                                    </code>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">Запуск</p>
                                    <code className="block rounded-lg bg-[#13192b] px-3 py-2 text-sm text-slate-100">
                                        {providerMeta.runCommand}
                                    </code>
                                </div>
                            </div>

                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-blue-300" />
                                    <p className="text-sm font-semibold text-blue-200">Основной self-host путь</p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {selfHostWarning}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                                        official_mode: self_host
                                    </Badge>
                                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                                        recommended_path: {officialSelfHostPath}
                                    </Badge>
                                </div>
                            </div>

                            <details className="rounded-xl border border-border/70 bg-background/45 p-4" open={!hasReadyWorker && !hasSavedConfig}>
                                <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                                    Резервный ручной endpoint
                                </summary>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Используйте этот блок только если локальный агент недоступен или вам нужно вручную проверить сохранённый self-hosted endpoint.
                                </p>

                                <div className="mt-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="endpoint_url">URL self-hosted сервиса</Label>
                                        <Input
                                            id="endpoint_url"
                                            value={config.endpoint_url}
                                            onChange={(e) => setConfig({ ...config, endpoint_url: e.target.value })}
                                            placeholder={providerMeta.defaultEndpoint}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="api_key">
                                            {provider === 'qwen'
                                                ? 'API ключ runtime (если у worker задан API_KEY)'
                                                : 'API ключ runtime (если у сервиса включена авторизация)'}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="api_key"
                                                type="password"
                                                value={config.api_key}
                                                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                                                placeholder={
                                                    provider === 'qwen'
                                                        ? 'Введите API_KEY из .env self-hosted Qwen worker'
                                                        : 'Введите API ключ, если включена авторизация'
                                                }
                                            />
                                            {config.api_key && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => copyToClipboard(config.api_key)}
                                                    className="border-blue-800/60 text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {hasStoredApiKey && !config.api_key.trim() && (
                                            <p className="text-xs text-amber-300">
                                                Ключ уже сохранён. Поле можно оставить пустым.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            onClick={testConnection}
                                            disabled={testing || !config.endpoint_url.trim()}
                                            className="flex-1 border border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                                        >
                                            {testing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Проверка...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Тест соединения
                                                </>
                                            )}
                                        </Button>

                                        <Button
                                            onClick={saveConfig}
                                            disabled={saving || !config.endpoint_url.trim()}
                                            variant="outline"
                                            className="flex-1 border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Сохранение...
                                                </>
                                            ) : (
                                                'Сохранить конфиг'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </details>

                            {testResult && (
                                <div className={`rounded-lg border p-4 ${testResult.success
                                    ? 'border-blue-500/30 bg-blue-500/10'
                                    : 'bg-red-500/10 border-red-500/30'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        {testResult.success ? (
                                            <CheckCircle className="w-5 h-5 text-blue-300" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-400" />
                                        )}
                                        <span className={testResult.success ? 'text-blue-100' : 'text-red-300'}>
                                            {testResult.message}
                                        </span>
                                    </div>
                                    {testResult.warnings && testResult.warnings.length > 0 && (
                                        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                            {testResult.warnings.map((warning) => (
                                                <p key={warning}>{warning}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Dialog open={isPairingDialogOpen} onOpenChange={setIsPairingDialogOpen}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Подключить устройство</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="border-blue-700/60 bg-blue-500/10 text-blue-300">
                                        {providerMeta.label}
                                    </Badge>
                                    {pairingCodeExpiresAt ? (
                                        <span className="text-xs text-muted-foreground">
                                            До {new Date(pairingCodeExpiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    ) : null}
                                </div>

                                {pairingLoading ? (
                                    <div className="flex items-center justify-center rounded-xl border border-border/70 bg-background/55 p-6">
                                        <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
                                    </div>
                                ) : pairingError ? (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                                        {pairingError}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                                        <div className="flex items-center justify-center gap-2 text-center text-sm text-foreground">
                                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                                            <span>{pairingStatusMessage || pairingDownloadFilename || 'Устройство подключается'}</span>
                                        </div>
                                        {pairingUsedDownloadFallback && pairingDownloadFilename ? (
                                            <p className="mt-3 text-center text-xs text-muted-foreground">
                                                {pairingDownloadFilename}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={requestPairingCode}
                                    className="border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                    disabled={pairingLoading}
                                >
                                    Скачать заново
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {healthData && (
                        <Card className="card-glass">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Server className="w-5 h-5 text-blue-300" />
                                    Статус сервера
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {initializationState && (
                                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">
                                                    {initializationState.ready ? 'Готовность' : 'Инициализация'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {initializationState.message || initializationState.phase || 'Подготовка модели'}
                                                </p>
                                            </div>
                                            <span className="text-sm font-semibold text-blue-300">
                                                {initializationState.percent ?? (initializationState.ready ? 100 : 0)}%
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-background/80">
                                            <div
                                                className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                                                style={{ width: `${initializationState.percent ?? (initializationState.ready ? 100 : 0)}%` }}
                                            />
                                        </div>
                                        {(initializationState.currentModel || initializationState.targetModel) && (
                                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-blue-100/90">
                                                {initializationState.currentModel && (
                                                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1">
                                                        Текущая: {initializationState.currentModel}
                                                    </span>
                                                )}
                                                {initializationState.targetModel && (
                                                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1">
                                                        Целевая: {initializationState.targetModel}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Статус</p>
                                        <p className="text-lg font-semibold flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5 text-blue-300" />
                                            {healthData.status === 'healthy' ? 'Доступен' : 'Ошибка'}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Версия</p>
                                        <p className="text-lg font-semibold">{healthData.version}</p>
                                    </div>

                                    {healthData.gpu_info && (
                                        <>
                                            <div className="space-y-2">
                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Cpu className="w-4 h-4" />
                                                    GPU
                                                </p>
                                                <p className="text-lg font-semibold">{healthData.gpu_info.name}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <HardDrive className="w-4 h-4" />
                                                    VRAM
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {(healthData.gpu_info.memory_total / 1024).toFixed(1)} GB
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Аптайм</p>
                                        <p className="text-lg font-semibold">
                                            {healthData.uptime ? `${Math.floor(healthData.uptime / 3600)}ч ${Math.floor((healthData.uptime % 3600) / 60)}м` : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {statusData?.stats && providerContract.supports_native_status_endpoint !== false && (
                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                        <h4 className="text-sm font-medium mb-3">Статистика</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Всего запросов</p>
                                                <p className="text-lg font-semibold">{statusData.stats.total_requests}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Успешно</p>
                                                <p className="text-lg font-semibold text-blue-300">
                                                    {statusData.stats.successful_requests}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Ошибки</p>
                                                <p className="text-lg font-semibold text-red-400">
                                                    {statusData.stats.failed_requests}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Среднее время</p>
                                                <p className="text-lg font-semibold">
                                                    {statusData.stats.average_processing_time.toFixed(2)}с
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={testConnection}
                                    className="mt-4 w-full"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Обновить статус
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {hasSavedConfig && hasHealthyVoiceManagementEndpoint && (
                        <Card className="card-glass">
                            <CardHeader>
                                <CardTitle>Режим подключения</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                                    <div>
                                        <p className="font-medium">Endpoint сохранен для self-hosted {providerMeta.label}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Этот экран управляет только локальным runtime, API ключом и проверкой здоровья.
                                            Переключение между cloud и self_host теперь делается только на основной странице TTS.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => navigate('/dashboard/tts')}
                                    variant="outline"
                                    className="w-full border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                >
                                    Открыть основные настройки TTS
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="voices" className="space-y-8">
                    {loadingVoices ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <section className="space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-sky-400" />
                                    <h3 className="text-lg font-semibold text-white">Мои голоса (self-hosted)</h3>
                                    <Badge variant="outline" className="border-sky-500/40 text-sky-400">
                                        {userVoices.length}
                                    </Badge>
                                </div>
                                {canManageVoices && hasHealthyVoiceManagementEndpoint ? (
                                    <Dialog
                                        open={isUploadVoiceDialogOpen}
                                        onOpenChange={(open) => {
                                            setIsUploadVoiceDialogOpen(open);
                                            if (!open) {
                                                resetUploadVoiceDraft();
                                            }
                                        }}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="border-blue-700/40 bg-transparent text-muted-foreground hover:bg-transparent hover:text-blue-400">
                                                <Upload className="mr-2 h-4 w-4" />
                                                Загрузить свой голос
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>Загрузка пользовательского голоса</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Название голоса *</Label>
                                                    <Input
                                                        value={uploadVoiceDraft.name}
                                                        onChange={(e) => setUploadVoiceDraft((prev) => ({ ...prev, name: e.target.value }))}
                                                        placeholder="Пример: Мой голос"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Текст референса</Label>
                                                    <Textarea
                                                        value={uploadVoiceDraft.sampleText}
                                                        onChange={(e) => setUploadVoiceDraft((prev) => ({ ...prev, sampleText: e.target.value }))}
                                                        placeholder="Опционально. Текст, который произносится в референсном аудио."
                                                        className="min-h-[110px]"
                                                    />
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Для Qwen это reference_text. Для F5 поле тоже сохраняется вместе с sample.
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label>Аудиофайл *</Label>
                                                    <Input
                                                        type="file"
                                                        accept=".wav,.mp3,.ogg,.m4a,.flac"
                                                        onChange={(e) => setUploadVoiceDraft((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsUploadVoiceDialogOpen(false);
                                                        resetUploadVoiceDraft();
                                                    }}
                                                    className="border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    Отмена
                                                </Button>
                                                <Button
                                                    onClick={uploadVoice}
                                                    disabled={uploadingFile || !uploadVoiceDraft.name.trim() || !uploadVoiceDraft.file}
                                                    className="border border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                                                >
                                                    {uploadingFile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Загрузить
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                ) : (
                                    <Badge variant="secondary">CRUD недоступен</Badge>
                                )}
                            </div>

                            {userVoices.length === 0 ? (
                                <div className="rounded-2xl border border-border/70 border-dashed bg-card/55 py-8 text-center">
                                    <User className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                                    <p className="mb-2 text-slate-300">У вас пока нет self-hosted голосов</p>
                                    <p className="text-sm text-slate-500">Подключённый локальный движок позволит загрузить первый sample прямо в этот раздел.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    {userVoices.map((voice) => renderVoiceCard(voice))}
                                </div>
                            )}
                        </section>
                    )}
                </TabsContent>

                <Dialog open={isVoiceSettingsDialogOpen} onOpenChange={closeVoiceSettings}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{currentVoice ? `Настройки голоса "${currentVoice.name}"` : 'Настройки голоса'}</DialogTitle>
                        </DialogHeader>
                        {currentVoice && (
                            <div className="space-y-5">
                                <div className="rounded-xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                                    Настройки будут сохранены вместе с локальным self-hosted голосом.
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="local-reference-text">Референсный текст</Label>
                                    <Textarea
                                        id="local-reference-text"
                                        value={voiceSettingsDraft.referenceText}
                                        onChange={(e) => setVoiceSettingsDraft((prev) => ({ ...prev, referenceText: e.target.value }))}
                                        rows={4}
                                        placeholder="Текст, который произносится в референсном аудио"
                                    />
                                </div>

                                {provider === 'f5' ? (
                                    <>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="local-cfg-strength">Стабильность синтеза</Label>
                                                <span className="text-sm font-medium text-blue-300">
                                                    {voiceSettingsDraft.cfgStrength.toFixed(1)}
                                                </span>
                                            </div>
                                            <Slider
                                                id="local-cfg-strength"
                                                min={0.1}
                                                max={10}
                                                step={0.1}
                                                value={[voiceSettingsDraft.cfgStrength]}
                                                onValueChange={(value) => setVoiceSettingsDraft((prev) => ({ ...prev, cfgStrength: value[0] ?? prev.cfgStrength }))}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="local-speed-preset">Скорость речи</Label>
                                                <span className="text-sm font-medium text-blue-300">
                                                    {getSpeedPresetLabel(voiceSettingsDraft.speedPreset)}
                                                </span>
                                            </div>
                                            <Slider
                                                id="local-speed-preset"
                                                min={0}
                                                max={SPEED_PRESET_OPTIONS.length - 1}
                                                step={1}
                                                value={[SPEED_PRESET_OPTIONS.indexOf(voiceSettingsDraft.speedPreset)]}
                                                onValueChange={(value) => {
                                                    const nextPreset = SPEED_PRESET_OPTIONS[value[0] ?? 2] || 'normal';
                                                    setVoiceSettingsDraft((prev) => ({ ...prev, speedPreset: nextPreset }));
                                                }}
                                            />
                                            <div className="grid grid-cols-5 gap-1 px-1 text-[11px] text-muted-foreground">
                                                {SPEED_PRESET_OPTIONS.map((preset) => (
                                                    <span key={preset} className="text-center leading-none">
                                                        {preset === 'very_slow'
                                                            ? 'Очень медл.'
                                                            : preset === 'slow'
                                                                ? 'Медленно'
                                                                : preset === 'normal'
                                                                    ? 'Норма'
                                                                    : preset === 'fast'
                                                                        ? 'Быстро'
                                                                        : 'Очень быстро'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                                        Для self-hosted Qwen здесь используется тот же reference_text, что и в cloud voice management. Дополнительные F5-параметры не применяются.
                                    </div>
                                )}
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => closeVoiceSettings(false)}
                                className="border-blue-700 text-blue-300 hover:bg-blue-500/10"
                            >
                                Отмена
                            </Button>
                            <Button
                                onClick={saveVoiceSettings}
                                disabled={!currentVoice || updateVoiceSettingsMutation.isPending}
                                className="border border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                            >
                                {updateVoiceSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </Tabs>
        </PageWrapper>
    );
};

export default LocalTTSSettingsPage;
