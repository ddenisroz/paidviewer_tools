import React, { useEffect, useState } from 'react';

/* eslint-disable no-alert */
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Copy,
    Cpu,
    ExternalLink,
    HardDrive,
    Loader2,
    Mic,
    Plus,
    RefreshCw,
    Server,
    Settings,
    Trash2,
    Upload,
    XCircle,
    Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';


import { TABLE_CLASSES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import {
    useCreateVoiceMutation,
    useDeleteVoiceMutation,
    useLocalVoicesQuery,
    useUploadSampleMutation
} from '@/queries/tts/localVoicesQueries';
import {
    useLocalTtsConfig,
    useSaveLocalTtsConfig,
    useTestLocalTtsConnection,
    useToggleLocalTts
} from '@/queries/tts/ttsQueries';
import PageWrapper from '@/shared/components/PageWrapper';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { AxiosError } from 'axios';

type LocalTtsProvider = 'f5' | 'qwen';

interface ProviderMeta {
    label: string;
    defaultEndpoint: string;
    folder: string;
    runCommand: string;
    apiKeyHint: string;
    docsUrl?: string;
}

const PROVIDER_META: Record<LocalTtsProvider, ProviderMeta> = {
    f5: {
        label: 'F5 TTS',
        defaultEndpoint: 'http://localhost:8001',
        folder: 'F5_tts',
        runCommand: 'python main.py',
        apiKeyHint: 'Если включена авторизация, укажите API ключ из .env или config сервиса.'
    },
    qwen: {
        label: 'Qwen 3 TTS',
        defaultEndpoint: 'http://localhost:8002',
        folder: 'nano-qwen3tts-vllm',
        runCommand: 'python <entrypoint>.py',
        apiKeyHint: 'API ключ обязателен только если в Qwen включена авторизация.',
        docsUrl: 'https://github.com/calldatfate/nano-qwen3tts-vllm'
    }
};

interface LocalTtsConfigState {
    endpoint_url: string;
    api_key: string;
    use_local: boolean;
}

interface TestResult {
    success: boolean;
    message: string;
}

interface HealthData {
    status: string;
    version?: string;
    uptime?: number;
    gpu_info?: {
        name: string;
        memory_total: number;
    };
}

interface StatusData {
    stats?: {
        total_requests: number;
        successful_requests: number;
        failed_requests: number;
        average_processing_time: number;
    };
}

interface Voice {
    id: number;
    name: string;
    language: string;
    description?: string;
    type?: 'base' | 'custom';
    samples_count?: number;
}

interface NewVoice {
    name: string;
    language: 'ru' | 'en';
    description: string;
}

const TAB_TRIGGER_CLASS =
    'rounded-none -mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:shadow-none';

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

    const [testing, setTesting] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [healthData, setHealthData] = useState<HealthData | null>(null);
    const [statusData, setStatusData] = useState<StatusData | null>(null);

    const activeVoicesEndpoint = testResult?.success ? config.endpoint_url : undefined;

    // TanStack Query for voices (replaces manual axios calls)
    const { data: voicesData, isLoading: loadingVoices, refetch: refetchVoices } = useLocalVoicesQuery(provider, activeVoicesEndpoint);
    const voices = (voicesData || []) as Voice[];

    const createVoiceMutation = useCreateVoiceMutation(provider, activeVoicesEndpoint);
    const uploadSampleMutation = useUploadSampleMutation(provider, activeVoicesEndpoint);
    const deleteVoiceMutation = useDeleteVoiceMutation(provider, activeVoicesEndpoint);

    const [isCreateVoiceDialogOpen, setIsCreateVoiceDialogOpen] = useState<boolean>(false);
    const [newVoice, setNewVoice] = useState<NewVoice>({ name: '', language: 'ru', description: '' });
    const uploadingFile = uploadSampleMutation.isPending;
    const [currentTab, setCurrentTab] = useState<'connection' | 'voices'>('connection');
    const { data: configData, isLoading: configLoading, error: configError } = useLocalTtsConfig(provider);

    useEffect(() => {
        setTestResult(null);
        setHealthData(null);
        setStatusData(null);
        setCurrentTab('connection');
    }, [provider]);

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (configLoading) return;
        if (!configData) {
            setConfig({
                endpoint_url: providerMeta.defaultEndpoint,
                api_key: '',
                use_local: false
            });
            return;
        }
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
            if (success) {
                setTestResult({ success: true, message: payload.message || nested.message || 'Соединение успешно!' });
                setHealthData(payload.health_data || nested.health_data || null);
                setStatusData(payload.status_data || nested.status_data || null);
                return;
            }
            setTestResult({
                success: false,
                message: payload.error || nested.error || payload.message || nested.message || 'Не удалось подключиться'
            });
            setHealthData(null);
            setStatusData(null);
        },
        onError: (error) => {
            const axiosError = error as AxiosError<{ detail?: string }>;
            setTestResult({
                success: false,
                message: axiosError.response?.data?.detail || 'Ошибка соединения с сервером'
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

    const toggleServiceMutation = useToggleLocalTts({
        onSuccess: (response) => {
            const payload = response as {
                success?: boolean;
                message?: string;
                use_local?: boolean;
                data?: { success?: boolean; message?: string; use_local?: boolean };
            };
            const nested = payload.data || {};
            const success = payload.success ?? nested.success ?? false;
            const useLocal = payload.use_local ?? nested.use_local ?? false;
            const message = payload.message || nested.message;
            if (success) {
                setConfig(prev => ({ ...prev, use_local: useLocal }));
                toast.success(message || (useLocal ? 'Локальный режим включен' : 'Локальный режим отключен'));
                return;
            }
            toast.error(message || 'Ошибка переключения локального режима');
        },
        onError: (error) => {
            logger.error('Error toggling service:', error);
            toast.error('Ошибка переключения локального режима');
        },
    });

    const toggleService = (): void => {
        toggleServiceMutation.mutate(provider);
    };

    const copyToClipboard = (text: string): void => {
        navigator.clipboard.writeText(text);
        toast.success('Скопировано в буфер обмена');
    };

    // Using TanStack Query mutation instead of direct axios
    const createVoice = (): void => {
        if (!newVoice.name.trim()) {
            toast.error('Введите название голоса');
            return;
        }

        createVoiceMutation.mutate(
            { name: newVoice.name, language: newVoice.language, description: newVoice.description },
            {
                onSuccess: () => {
                    setIsCreateVoiceDialogOpen(false);
                    setNewVoice({ name: '', language: 'ru', description: '' });
                }
            }
        );
    };

    const [sampleDialogOpen, setSampleDialogOpen] = useState<boolean>(false);
    const [currentSampleVoiceId, setCurrentSampleVoiceId] = useState<number | null>(null);
    const [sampleText, setSampleText] = useState<string>('');
    const [sampleFile, setSampleFile] = useState<File | null>(null);

    const openSampleDialog = (voiceId: number): void => {
        setCurrentSampleVoiceId(voiceId);
        setSampleText('');
        setSampleFile(null);
        setSampleDialogOpen(true);
    };

    // Using TanStack Query mutation instead of direct axios
    const handleSampleUpload = (): void => {
        if (!sampleFile || !currentSampleVoiceId) {
            toast.error('Выберите файл');
            return;
        }
        uploadSampleMutation.mutate(
            { voiceId: currentSampleVoiceId, file: sampleFile, sampleText },
            {
                onSuccess: () => {
                    setSampleDialogOpen(false);
                    setSampleText('');
                    setSampleFile(null);
                }
            }
        );
    };

    // Using TanStack Query mutation instead of direct axios
    const deleteVoice = (voiceId: number): void => {
        if (!confirm('Удалить голос со всеми данными?')) return;
        deleteVoiceMutation.mutate(voiceId);
    };

    useEffect(() => {
        if (testResult?.success && currentTab === 'voices') {
            refetchVoices();
        }
    }, [testResult, currentTab, refetchVoices]);

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

    if (configLoading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl space-y-6">
            <Card className="card-glass border-blue-500/20">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                        <span>Провайдер локального TTS</span>
                        <Badge variant="secondary" className="bg-blue-500/15 text-blue-200 border border-blue-500/30">
                            {providerMeta.label}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setProvider('f5')}
                            className={`h-9 border ${provider === 'f5'
                                ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                                : 'border-blue-900/60 bg-transparent text-blue-300 hover:bg-blue-500/10'
                                }`}
                        >
                            F5 TTS
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setProvider('qwen')}
                            className={`h-9 border ${provider === 'qwen'
                                ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                                : 'border-blue-900/60 bg-transparent text-blue-300 hover:bg-blue-500/10'
                                }`}
                        >
                            Qwen 3 TTS
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Конфигурация, локальный режим и список голосов разделены по провайдеру.
                    </p>
                </CardContent>
            </Card>

            <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'connection' | 'voices')} className="w-full">
                <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 border-b border-border">
                    <TabsTrigger value="connection" className={`flex items-center gap-2 ${TAB_TRIGGER_CLASS}`}>
                        <Server className="w-4 h-4" />
                        Подключение
                    </TabsTrigger>
                    <TabsTrigger value="voices" className={`flex items-center gap-2 ${TAB_TRIGGER_CLASS}`} disabled={!testResult?.success}>
                        <Mic className="w-4 h-4" />
                        Управление голосами
                    </TabsTrigger>
                </TabsList>

                {!testResult?.success && (
                    <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        Управление голосами станет доступно после успешного теста подключения выбранного провайдера.
                    </div>
                )}

                <TabsContent value="connection" className="space-y-4 mt-4">
                    <Card className="card-glass border-blue-500/20">
                        <CardHeader>
                            <CardTitle className="text-blue-400 flex items-center gap-2">
                                <ExternalLink className="w-5 h-5" />
                                Как запустить локальный {providerMeta.label}?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">1</span>
                                    <div>
                                        <p className="font-medium">Перейдите в папку сервиса:</p>
                                        <code className="block bg-gray-800 p-2 rounded mt-1">
                                            cd {providerMeta.folder}
                                        </code>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">2</span>
                                    <div>
                                        <p className="font-medium">Установите зависимости:</p>
                                        <code className="block bg-gray-800 p-2 rounded mt-1">
                                            python -m pip install -r requirements.txt
                                        </code>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">3</span>
                                    <div>
                                        <p className="font-medium">Запустите API сервер:</p>
                                        <code className="block bg-gray-800 p-2 rounded mt-1">
                                            {providerMeta.runCommand}
                                        </code>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">4</span>
                                    <div>
                                        <p className="font-medium">Проверьте URL и API ключ в форме ниже</p>
                                        <p className="text-muted-foreground text-xs mt-1">
                                            {providerMeta.apiKeyHint}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {providerMeta.docsUrl && (
                                <a
                                    href={providerMeta.docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Открыть репозиторий {providerMeta.label}
                                </a>
                            )}

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-yellow-200">
                                    <p className="font-medium">Рекомендации:</p>
                                    <ul className="list-disc list-inside mt-1 space-y-1 text-xs text-yellow-200/80">
                                        <li>Используйте отдельный порт для каждого локального провайдера</li>
                                        <li>Перед включением локального режима выполняйте тест подключения</li>
                                        <li>Если используется Docker, проверьте доступность порта из bot_service</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-glass">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5" />
                                Настройки подключения {providerMeta.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="endpoint_url">URL сервера</Label>
                                <Input
                                    id="endpoint_url"
                                    value={config.endpoint_url}
                                    onChange={(e) => setConfig({ ...config, endpoint_url: e.target.value })}
                                    placeholder={providerMeta.defaultEndpoint}
                                />
                                <p className="text-xs text-muted-foreground">
                                    По умолчанию: {providerMeta.defaultEndpoint}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="api_key">API ключ (опционально)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="api_key"
                                        type="password"
                                        value={config.api_key}
                                        onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                                        placeholder="Введите API ключ, если включена авторизация"
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
                                <p className="text-xs text-muted-foreground">
                                    {providerMeta.apiKeyHint}
                                </p>
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

                            {testResult && (
                                <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success
                                    ? 'bg-green-500/10 border border-green-500/30'
                                    : 'bg-red-500/10 border border-red-500/30'
                                    }`}>
                                    {testResult.success ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-400" />
                                    )}
                                    <span className={testResult.success ? 'text-green-300' : 'text-red-300'}>
                                        {testResult.message}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {healthData && (
                        <Card className="card-glass">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="w-5 h-5" />
                                    Статус сервера
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Статус</p>
                                        <p className="text-lg font-semibold flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
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

                                {statusData?.stats && (
                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                        <h4 className="text-sm font-medium mb-3">Статистика</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Всего запросов</p>
                                                <p className="text-lg font-semibold">{statusData.stats.total_requests}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Успешно</p>
                                                <p className="text-lg font-semibold text-green-400">
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

                    {testResult?.success && (
                        <Card className="card-glass">
                            <CardHeader>
                                <CardTitle>Использование локального TTS</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                                    <div>
                                        <p className="font-medium">Использовать локальный {providerMeta.label}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {config.use_local
                                                ? 'Запросы выбранного провайдера идут через локальный сервис'
                                                : 'Выбранный провайдер работает в облачном режиме или через фолбэк'
                                            }
                                        </p>
                                    </div>
                                    <Button
                                        onClick={toggleService}
                                        variant={config.use_local ? 'default' : 'outline'}
                                        className={config.use_local
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'border-blue-700 text-blue-300 hover:bg-blue-500/10'}
                                    >
                                        {config.use_local ? 'Включено' : 'Отключено'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="voices" className="space-y-4 mt-4">
                    <Card className="card-glass">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mic className="w-5 h-5" />
                                        Управление голосами ({providerMeta.label})
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Голоса и сэмплы сохраняются отдельно для выбранного провайдера
                                    </p>
                                </div>
                                <Dialog open={isCreateVoiceDialogOpen} onOpenChange={setIsCreateVoiceDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="flex items-center gap-2 border border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
                                            <Plus className="w-4 h-4" />
                                            Создать голос
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Создание нового голоса</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Название голоса *</Label>
                                                <Input
                                                    value={newVoice.name}
                                                    onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
                                                    placeholder="Пример: Мой голос"
                                                />
                                            </div>
                                            <div>
                                                <Label>Язык</Label>
                                                <select
                                                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
                                                    value={newVoice.language}
                                                    onChange={(e) => setNewVoice({ ...newVoice, language: e.target.value as 'ru' | 'en' })}
                                                >
                                                    <option value="ru">Русский</option>
                                                    <option value="en">English</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Label>Описание (опционально)</Label>
                                                <Input
                                                    value={newVoice.description}
                                                    onChange={(e) => setNewVoice({ ...newVoice, description: e.target.value })}
                                                    placeholder="Описание голоса"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsCreateVoiceDialogOpen(false)} className="border-blue-700 text-blue-300 hover:bg-blue-500/10">
                                                Отмена
                                            </Button>
                                            <Button onClick={createVoice} className="border border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
                                                Создать
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingVoices ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : voices.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Нет созданных голосов</p>
                                    <p className="text-sm mt-2">Создайте первый голос, чтобы начать</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {voices.map((voice) => {
                                        const voiceType = voice.type === 'base' ? 'base' : 'custom';
                                        return (
                                            <Card key={voice.id} className="overflow-hidden">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            {voice.name}
                                                            <Badge variant={voiceType === 'base' ? 'default' : 'secondary'}>
                                                                {voiceType === 'base' ? 'Базовый' : 'Свой'}
                                                            </Badge>
                                                        </CardTitle>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {voice.language === 'ru' ? 'RU Русский' : 'EN English'}
                                                        </p>
                                                    </div>
                                                    {voiceType === 'custom' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteVoice(voice.id)}
                                                            className={TABLE_CLASSES.actionButton}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {voiceType === 'custom' && (
                                                    <>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm text-muted-foreground">
                                                                Сэмплов: {voice.samples_count || 0}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            onClick={() => openSampleDialog(voice.id)}
                                                            variant="outline"
                                                            className="w-full border-blue-700 text-blue-300 hover:bg-blue-500/10"
                                                            disabled={uploadingFile}
                                                        >
                                                            <Upload className="w-4 h-4 mr-2" />
                                                            Загрузить сэмпл
                                                        </Button>
                                                    </>
                                                )}
                                                {voiceType === 'base' && (
                                                    <p className="text-xs text-muted-foreground italic">
                                                        Базовые голоса нельзя изменять
                                                    </p>
                                                )}
                                            </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <Dialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Загрузка сэмпла</DialogTitle>
                            <DialogDescription>
                                Загрузите аудиофайл (wav/mp3) с голосом. Желательно от 10 секунд до 2 минут.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Текст сэмпла (для улучшения качества)</Label>
                                <Textarea
                                    value={sampleText}
                                    onChange={(e) => setSampleText(e.target.value)}
                                    placeholder="Текст, который произносится в аудио..."
                                    className="h-24"
                                />
                            </div>
                            <div>
                                <Label>Файл</Label>
                                <Input
                                    type="file"
                                    onChange={(e) => setSampleFile(e.target.files?.[0] || null)}
                                    accept=".wav,.mp3,.ogg"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSampleDialogOpen(false)} className="border-blue-700 text-blue-300 hover:bg-blue-500/10">
                                Отмена
                            </Button>
                            <Button onClick={handleSampleUpload} disabled={uploadingFile || !sampleFile} className="border border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
                                {uploadingFile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Загрузить
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Tabs>
        </div>
    );
};

export default LocalTTSSettingsPage;
