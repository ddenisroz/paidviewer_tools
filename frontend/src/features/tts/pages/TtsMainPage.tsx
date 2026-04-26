import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Play, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { STORAGE_KEYS } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useTts } from '@/context/TtsContext';
import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';
import TtsFilterManager from '@/features/tts/components/TtsFilterManager';
import { queryKeys } from '@/queries/queryKeys';
import {
    useRegenerateTtsObsUrl,
    useSaveTtsModeSettings,
    useSaveTtsPlatformSettings,
    useSaveTtsSettings,
    useSetTtsEngine,
    useSetTtsListeningMode,
    useQwenModels,
    useToggleTts,
    useTtsAudioSettings,
    useTtsModeSettings,
    useTtsPlatformSettings,
    useTtsSettings,
    useTtsStatus
} from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import PageWrapper from '@/shared/components/PageWrapper';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { getQueryCache } from '@/shared/utils/queryPersist';
import { getTtsWebSocketUrl } from '@/shared/utils/urlUtils';
import { toast } from '@/utils/toastManager';

import type { ApiResponse } from '@/types';
import type { AxiosError } from 'axios';

interface PlatformSettings {
    enabled_platforms: ('twitch' | 'vk')[];
    global_enabled: boolean;
}

interface TtsSettingsState {
    enable7TV: boolean;
    enableTwitch: boolean;
    filterReplies: boolean;
    filterMentions: boolean;
    version: number;
}

interface TtsStatusData {
    enabled?: boolean;
    engine_type?: 'gtts' | 'gcloud' | 'f5_cloud' | 'f5_local' | 'qwen_cloud' | 'qwen_local' | 'cloud' | 'local';
    advanced_provider?: 'f5' | 'gcloud' | 'qwen';
    f5_mode?: 'cloud' | 'local';
    qwen_mode?: 'cloud' | 'local';
    has_local_setup?: boolean;
    has_local_setup_f5?: boolean;
    has_local_setup_qwen?: boolean;
    is_whitelisted?: boolean;
}

interface TtsSettingsData {
    enable7TV?: boolean;
    enableTwitch?: boolean;
    filterReplies?: boolean;
    filterMentions?: boolean;
    version?: number;
    listeningMode?: 'website' | 'obs';
    gcloudVoices?: string[];
    gcloud_voices?: string[];
    gcloudMood?: 'neutral' | 'sad' | 'happy';
    gcloud_mood?: 'neutral' | 'sad' | 'happy';
    advancedProvider?: 'f5' | 'gcloud' | 'qwen';
    advanced_provider?: 'f5' | 'gcloud' | 'qwen';
    f5Mode?: 'cloud' | 'local';
    f5_mode?: 'cloud' | 'local';
    qwenMode?: 'cloud' | 'local';
    qwen_mode?: 'cloud' | 'local';
    qwenVoice?: string;
    qwen_voice?: string;
    qwenModel?: string;
    qwen_model?: string;
}

interface GcloudVoice {
    name: string;
    languageCodes?: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number;
    modelName?: string;
    model_name?: string;
}

interface ParsedGcloudVoiceMeta {
    modelFamily: string;
    genderLabel: string;
}

type AdvancedProvider = 'f5' | 'qwen' | 'gcloud';
type PlatformSource = 'twitch' | 'vk';
type BooleanTtsSettingKey = 'enable7TV' | 'enableTwitch' | 'filterReplies' | 'filterMentions';

type GcloudMood = 'neutral' | 'sad' | 'happy';

interface QwenModelOption {
    value: string;
    label: string;
    family?: string;
    supportsVoiceCloning?: boolean;
    requiresRefAudio?: boolean;
    requiresPrompt?: boolean;
}

interface QwenModelCatalogItem {
    id?: string;
    label?: string;
    family?: string;
    supports_voice_cloning?: boolean;
    requires_ref_audio?: boolean;
    requires_prompt?: boolean;
}

interface QwenModelsCatalogResponse {
    success?: boolean;
    provider?: string;
    mode?: 'cloud' | 'local';
    source?: 'managed' | 'local';
    configured?: boolean;
    available?: boolean;
    endpoint_url?: string | null;
    current_model?: string | null;
    models?: QwenModelCatalogItem[];
    detail?: {
        code?: string;
        message?: string;
    };
}

interface ApplySelectedProviderOptions {
    showSuccessToast?: boolean;
    f5ModeOverride?: 'cloud' | 'local';
    qwenModeOverride?: 'cloud' | 'local';
}

const GCLOUD_MOOD_OPTIONS: Array<{ value: GcloudMood; label: string }> = [
    { value: 'neutral', label: 'Нейтральная' },
    { value: 'sad', label: 'Грустная' },
    { value: 'happy', label: 'Веселая' },
];

const QWEN_MODEL_DEFAULT = 'Qwen/Qwen3-TTS-12Hz-1.7B-Base';

const QWEN_CUSTOMVOICE_SPEAKERS = [
    { value: 'serena', label: 'Serena' },
    { value: 'dylan', label: 'Dylan' },
    { value: 'anna', label: 'Anna' },
    { value: 'jason', label: 'Jason' },
];

const normalizeQwenModelOption = (model: QwenModelCatalogItem): QwenModelOption | null => {
    const value = (model.id || '').trim();
    if (!value) return null;

    const family = (model.family || '').trim();
    const supportsVoiceCloning = Boolean(model.supports_voice_cloning);
    const requiresRefAudio = Boolean(model.requires_ref_audio);
    const requiresPrompt = Boolean(model.requires_prompt);
    return {
        value,
        label: (model.label || value).trim(),
        family,
        supportsVoiceCloning,
        requiresRefAudio,
        requiresPrompt,
    };
};

const getQwenModelOption = (options: QwenModelOption[], value?: string): QwenModelOption | undefined => {
    const normalized = (value || '').trim();
    if (!normalized) return undefined;
    return options.find((option) => option.value === normalized);
};

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const SECTION_PANEL_CLASS = 'rounded-xl border border-border/70 bg-card/60 p-4';
const SECTION_EYEBROW_CLASS = 'mb-2 text-xs font-semibold text-muted-foreground';
const SEGMENT_BUTTON_CLASS = 'rounded-lg border border-transparent px-3 py-2 text-xs font-semibold transition-colors duration-200 shadow-none';
const SELECTOR_BUTTON_BASE_CLASS = 'rounded-lg border p-3 text-left transition-colors';
const SELECTOR_BUTTON_ACTIVE_CLASS = 'border-sky-500/50 bg-sky-500/10 text-sky-50';
const SELECTOR_BUTTON_IDLE_CLASS = 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground';
const PROJECT_BLUE_SOLID_CLASS = 'border border-sky-400/80 bg-sky-500/12 text-sky-50 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22)] hover:bg-sky-500/18';
const PROJECT_BLUE_SUBTLE_CLASS = 'bg-blue-700/10 text-blue-400';
const PROJECT_BLUE_TEXT_HOVER_CLASS = 'bg-background/60 text-muted-foreground hover:bg-background/60 hover:text-blue-400';

interface ProviderOptionButtonProps {
    provider: AdvancedProvider;
    title: string;
    active: boolean;
    available: boolean;
    disabled: boolean;
    onSelect: (provider: AdvancedProvider) => void;
}

const ProviderOptionButton = React.memo(function ProviderOptionButton({
    provider,
    title,
    active,
    disabled,
    onSelect,
}: ProviderOptionButtonProps) {
    return (
        <button
            type="button"
            onClick={() => onSelect(provider)}
            disabled={disabled}
            className={`${SELECTOR_BUTTON_BASE_CLASS} ${active
                ? SELECTOR_BUTTON_ACTIVE_CLASS
                : SELECTOR_BUTTON_IDLE_CLASS
                } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
        >
            <div className="text-sm font-semibold">{title}</div>
        </button>
    );
});

interface SourcePlatformToggleRowProps {
    platform: PlatformSource;
    isConnected: boolean;
    isEnabled: boolean;
    onToggle: (platform: PlatformSource) => void;
}

const SourcePlatformToggleRow = React.memo(function SourcePlatformToggleRow({
    platform,
    isConnected,
    isEnabled,
    onToggle,
}: SourcePlatformToggleRowProps) {
    const title = platform === 'twitch' ? 'Twitch' : 'VK Live';
    const activeIconTone = platform === 'twitch'
        ? 'text-[#9146FF]'
        : 'text-[#FF4444]';
    const iconTone = isConnected && isEnabled ? activeIconTone : 'text-muted-foreground';

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/70">
                    {platform === 'twitch' ? <TwitchIcon className={`h-5 w-5 ${iconTone}`} /> : <VKIcon className={`h-5 w-5 ${iconTone}`} />}
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{title}</div>
                    {!isConnected && <div className="mt-1 text-xs text-muted-foreground">Не подключена</div>}
                </div>
            </div>

            <Switch
                checked={Boolean(isConnected && isEnabled)}
                onCheckedChange={() => onToggle(platform)}
                disabled={!isConnected}
            />
        </div>
    );
});

interface TtsFilterSwitchRowProps {
    label: string;
    settingKey: BooleanTtsSettingKey;
    checked: boolean;
    invert?: boolean;
    onToggle: (key: BooleanTtsSettingKey, value: boolean) => void;
}

const TtsFilterSwitchRow = React.memo(function TtsFilterSwitchRow({
    label,
    settingKey,
    checked,
    invert = false,
    onToggle,
}: TtsFilterSwitchRowProps) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-4 py-3">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <Switch
                checked={checked}
                onCheckedChange={(nextChecked) => onToggle(settingKey, invert ? !nextChecked : nextChecked)}
            />
        </div>
    );
});

interface TtsMasterToggleCardProps {
    enabled: boolean;
    isPending: boolean;
    onToggle: () => void;
}

const TtsMasterToggleCard = React.memo(function TtsMasterToggleCard({
    enabled,
    isPending,
    onToggle,
}: TtsMasterToggleCardProps) {
    return (
        <Card
            className={`${SURFACE_CARD_CLASS} ${isPending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            onClick={isPending ? undefined : onToggle}
        >
            <CardContent className="flex items-center justify-between gap-4 p-3.5">
                <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full transition-all duration-300 ${enabled ? 'bg-green-500 shadow-lg shadow-green-500/40' : 'bg-muted-foreground/50'}`} />
                    <div>
                        <div className="text-sm font-semibold text-foreground">Озвучка сообщений</div>
                    </div>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={onToggle}
                    className="pointer-events-none"
                    disabled={isPending}
                />
            </CardContent>
        </Card>
    );
});

const normalizeGcloudMood = (value?: string): GcloudMood => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'sad') return 'sad';
    if (normalized === 'happy') return 'happy';
    return 'neutral';
};

const getGcloudVoiceModelKey = (voice?: GcloudVoice): string => {
    const explicitModel = (voice?.modelName || voice?.model_name || '').trim();
    if (explicitModel) return explicitModel.toLowerCase();
    return (voice?.name || '').toLowerCase();
};

const parseGcloudVoiceModelFamily = (voice?: GcloudVoice): string => {
    const key = getGcloudVoiceModelKey(voice);
    if (!key) return 'Unknown';

    if (key.includes('chirp3-hd')) return 'Chirp 3 HD';
    if (key.includes('gemini')) return 'Gemini TTS';
    if (key.includes('chirp')) return 'Chirp';
    if (key.includes('neural2')) return 'Neural2';
    if (key.includes('wavenet')) return 'WaveNet';
    if (key.includes('studio')) return 'Studio';
    if (key.includes('journey')) return 'Journey';
    if (key.includes('standard')) return 'Standard';

    const voiceName = (voice?.name || '').trim();
    return voiceName || 'Unknown';
};

const getGcloudVoiceQualityRank = (voice?: GcloudVoice): number => {
    const key = getGcloudVoiceModelKey(voice);
    if (key.includes('gemini')) return 0;
    if (key.includes('chirp3-hd')) return 1;
    if (key.includes('neural2')) return 2;
    if (key.includes('wavenet')) return 3;
    if (key.includes('studio')) return 4;
    if (key.includes('journey')) return 5;
    if (key.includes('standard')) return 9;
    return 6;
};

const sortGcloudVoicesByQuality = (voices: GcloudVoice[]): GcloudVoice[] => {
    return [...voices].sort((a, b) => {
        const rankDiff = getGcloudVoiceQualityRank(a) - getGcloudVoiceQualityRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.name || '').localeCompare(b.name || '');
    });
};

const getPreferredDefaultVoiceNames = (voices: GcloudVoice[]): string[] => {
    const preferred = voices
        .filter((voice) => getGcloudVoiceQualityRank(voice) <= 3)
        .map((voice) => voice.name)
        .filter(Boolean);

    if (preferred.length > 0) return preferred;
    return voices.map((voice) => voice.name).filter(Boolean);
};

const parseGcloudVoiceGender = (gender?: string): string => {
    const value = (gender || 'NEUTRAL').toUpperCase();
    if (value === 'MALE') return 'мужской';
    if (value === 'FEMALE') return 'женский';
    return 'нейтральный';
};

const getGcloudVoiceDisplayName = (voiceName?: string): string => {
    const raw = (voiceName || '').trim();
    if (!raw) return 'Unknown';

    const matchedSpeaker = raw.match(/^[a-z]{2}-[A-Z]{2}-(?:Gemini|Chirp3-HD)-([A-Za-z0-9_]+)$/);
    if (matchedSpeaker?.[1]) return matchedSpeaker[1];

    const parts = raw.split('-').filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];

    return raw;
};

const getGcloudVoiceMeta = (voice: GcloudVoice): ParsedGcloudVoiceMeta => ({
    modelFamily: parseGcloudVoiceModelFamily(voice),
    genderLabel: parseGcloudVoiceGender(voice.ssmlGender),
});

const isAdvancedProvider = (value: unknown): value is AdvancedProvider => {
    return value === 'f5' || value === 'qwen' || value === 'gcloud';
};

interface AudioSettingsData {
    websiteVolume?: number;
}

interface PlatformSettingsData {
    enabled_platforms?: ('twitch' | 'vk')[];
    global_enabled?: boolean;
}

interface ModeSettingsData {
    tts_mode?: 'all_messages' | 'channel_points';
}

interface ObsTokenResponse {
    obs_token?: string;
}

interface TtsModeResponse {
    message?: string;
}

const TtsMainPageContent: React.FC = () => {
    const navigate = useNavigate();
    const {
        ttsEnabled: _ttsEnabled,
        isWhitelisted,
        initializeTts: _initializeTts,
        isCheckingHealth,
        checkTtsHealth,
    } = useTts();
    const isChecking = isCheckingHealth;
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();

    const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
    const [ttsTriggerMode, setTtsTriggerMode] = useState<'all_messages' | 'channel_points'>('all_messages');
    const [_ttsEngine, setTtsEngine] = useState<'gtts' | 'gcloud' | 'f5_cloud' | 'f5_local' | 'qwen_cloud' | 'qwen_local'>('f5_cloud');
    const [advancedProvider, setAdvancedProvider] = useState<AdvancedProvider>('f5');
    const [f5Mode, setF5Mode] = useState<'cloud' | 'local'>('cloud');
    const [qwenMode, setQwenMode] = useState<'cloud' | 'local'>('cloud');
    const [qwenModel, setQwenModel] = useState<string>(QWEN_MODEL_DEFAULT);
    const [qwenVoiceValue, setQwenVoiceValue] = useState<string>('');
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>('website');
    const [obsUrl, setObsUrl] = useState<string>('');
    const [localVolume, setLocalVolume] = useState<number>(50);
    const [gcloudVoices, setGcloudVoices] = useState<GcloudVoice[]>([]);
    const [selectedGcloudVoices, setSelectedGcloudVoices] = useState<string[]>([]);
    const [isLoadingGcloudVoices, setIsLoadingGcloudVoices] = useState<boolean>(false);
    const [isSavingGcloudVoices, setIsSavingGcloudVoices] = useState<boolean>(false);
    const [previewingGcloudVoice, setPreviewingGcloudVoice] = useState<string | null>(null);
    const [gcloudLoadHint, setGcloudLoadHint] = useState<string>('');
    const [gcloudMood, setGcloudMood] = useState<GcloudMood>('neutral');

    const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
        enabled_platforms: ['twitch', 'vk'],
        global_enabled: true
    });

    const [ttsSettings, setTtsSettings] = useState<TtsSettingsState>({
        enable7TV: true,
        enableTwitch: true,
        filterReplies: false,
        filterMentions: false,
        version: 1,
    });

    const [isSavingMode, setIsSavingMode] = useState<boolean>(false);
    const [isRegeneratingUrl, setIsRegeneratingUrl] = useState<boolean>(false);

    const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const gcloudPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
    const gcloudSelectionInitializedRef = useRef<boolean>(false);
    const gcloudVoicesRequestStartedRef = useRef<boolean>(false);
    const lastGcloudPreviewAtRef = useRef<number>(0);
    const autoAlignedQwenModelRef = useRef<string | null>(null);

    const queryClient = useQueryClient();
    const isTwitchConnected = integrations.twitch?.enabled;
    const isVkConnected = integrations.vk?.enabled;
    const isAnyTtsEnabled = ttsEnabled;
    const toggleTtsMutation = useToggleTts({
        onSuccess: () => {
            logger.log('TTS state saved');
        },
    });

    const savePlatformSettingsMutation = useSaveTtsPlatformSettings({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            logger.log('Platform settings saved');
        },
        onError: (error: unknown) => {
            logger.error('Error saving platform settings:', error);
        }
    });

    const saveTtsSettingsMutation = useSaveTtsSettings({
        onSuccess: () => {
            logger.log('TTS settings saved');
        },
        onError: (error: unknown) => {
            const axiosError = error as AxiosError<{ detail?: string }>;
            logger.error('Error saving TTS settings:', error);
            if (axiosError.response?.status === 409) {
                toast.warning('Настройки были изменены. Обновление...');
                setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() }), 1500);
            }
        }
    });

    const saveTtsModeSettingsMutation = useSaveTtsModeSettings({
        onSuccess: () => {
            logger.log('TTS mode settings saved');
        },
        onError: (error: unknown) => {
            logger.error('Error saving TTS mode settings:', error);
        }
    });

    const saveListeningModeMutation = useSetTtsListeningMode({
        onSuccess: () => {
            logger.log('Listening mode saved');
        },
    });

    const switchEngineMutation = useSetTtsEngine({
        onSuccess: () => {
            logger.log('Engine switched');
        },
    });
    const isEngineActionPending = toggleTtsMutation.isPending || switchEngineMutation.isPending;
    const isGlobalTogglePending = toggleTtsMutation.isPending;

    const { data: ttsStatusResponse } = useTtsStatus(null, {
        enabled: !!isAuthenticated,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
        staleTime: 60000,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(queryKeys.tts.status(null)) || undefined
    });
    const ttsStatusData = ttsStatusResponse?.data;
    const hasLocalSetupF5 =
        typeof (ttsStatusData as TtsStatusData | undefined)?.has_local_setup_f5 === 'boolean'
            ? Boolean((ttsStatusData as TtsStatusData).has_local_setup_f5)
            : false;
    const hasLocalSetupQwen =
        typeof (ttsStatusData as TtsStatusData | undefined)?.has_local_setup_qwen === 'boolean'
            ? Boolean((ttsStatusData as TtsStatusData).has_local_setup_qwen)
            : false;

    const { data: qwenModelsResponse, isLoading: isLoadingQwenModels } = useQwenModels(qwenMode, {
        enabled: !!isAuthenticated && advancedProvider === 'qwen',
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(queryKeys.tts.qwenModels(qwenMode)) || undefined,
    });
    const qwenModelsData = qwenModelsResponse as QwenModelsCatalogResponse | undefined;

    // Only show loading if we don't have health data yet
    const isF5TTSDataLoading = isChecking;
    const canUseF5Cloud = isWhitelisted === true;
    const canUseF5Local = hasLocalSetupF5;
    const canUseF5TTS = canUseF5Cloud || canUseF5Local;

    const canUseQwenCloud = isWhitelisted === true;
    const canUseQwenLocal = hasLocalSetupQwen;
    const canUseQwenTTS = canUseQwenCloud || canUseQwenLocal;
    const canUseGcloudTTS = selectedGcloudVoices.length > 0 || gcloudVoices.length > 0;

    const getF5UnavailableReason = useCallback((): string => {
        if (isF5TTSDataLoading) return 'Проверка статуса F5...';
        if (!canUseF5Cloud && !canUseF5Local) return 'Нет доступа к F5 Cloud и не настроен локальный сервер';
        if (!canUseF5Cloud && canUseF5Local) return 'F5 Cloud недоступен, но можно использовать локальный сервер';
        if (canUseF5Cloud && !canUseF5Local) return 'Локальный сервер не настроен';
        return '';
    }, [isF5TTSDataLoading, canUseF5Cloud, canUseF5Local]);

    const getQwenUnavailableReason = useCallback((): string => {
        if (!canUseQwenCloud && !canUseQwenLocal) return 'Нет доступа к Qwen Cloud и не настроен локальный сервер';
        if (!canUseQwenCloud && canUseQwenLocal) return 'Qwen Cloud недоступен, но можно использовать локальный сервер';
        if (canUseQwenCloud && !canUseQwenLocal) return 'Локальный сервер Qwen не настроен';
        return '';
    }, [canUseQwenCloud, canUseQwenLocal]);

    const getGcloudUnavailableReason = useCallback((): string => {
        if (isLoadingGcloudVoices) return 'Загрузка голосов Google Cloud...';
        if (gcloudLoadHint) return gcloudLoadHint;
        if (!canUseGcloudTTS) return 'Голоса Google Cloud недоступны';
        return '';
    }, [canUseGcloudTTS, gcloudLoadHint, isLoadingGcloudVoices]);

    const gcloudVoiceMetaMap = useMemo(() => {
        const map = new Map<string, ParsedGcloudVoiceMeta>();
        for (const voice of gcloudVoices) {
            if (!voice.name) continue;
            map.set(voice.name, getGcloudVoiceMeta(voice));
        }
        return map;
    }, [gcloudVoices]);

    const { data: ttsSettingsResponse } = useTtsSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-settings']) || undefined
    });
    const ttsSettingsData = ttsSettingsResponse?.data;

    const { data: audioSettingsResponse } = useTtsAudioSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-audio-settings']) || undefined
    });
    const audioSettingsData = audioSettingsResponse?.data;

    const { data: platformSettingsResponse } = useTtsPlatformSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-platform-settings']) || undefined
    });
    const platformSettingsData = platformSettingsResponse?.data;

    const { data: modeSettingsResponse } = useTtsModeSettings({
        enabled: !!isAuthenticated,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        initialData: () => getQueryCache(['tts-mode-settings']) || undefined
    });
    const modeSettingsData = modeSettingsResponse?.data;

    const _isDataLoaded = useMemo(() => {
        const hasStatus = ttsStatusData !== undefined || getQueryCache(['tts-status']) !== null;
        const hasSettings = ttsSettingsData !== undefined || getQueryCache(['tts-settings']) !== null;
        const hasAudio = audioSettingsData !== undefined || getQueryCache(['tts-audio-settings']) !== null;
        return hasStatus && hasSettings && hasAudio;
    }, [ttsStatusData, ttsSettingsData, audioSettingsData]);

    useEffect(() => {
        if (ttsStatusData) {
            const statusData = ttsStatusData as TtsStatusData;
            const enabled = statusData.enabled || false;
            const rawEngineType = statusData.engine_type || 'gtts';
            const engineType: 'gtts' | 'gcloud' | 'f5_cloud' | 'f5_local' | 'qwen_cloud' | 'qwen_local' =
                rawEngineType === 'cloud'
                    ? 'f5_cloud'
                    : rawEngineType === 'local'
                        ? 'f5_local'
                        : (rawEngineType as 'gtts' | 'gcloud' | 'f5_cloud' | 'f5_local' | 'qwen_cloud' | 'qwen_local');

            setTtsEnabled(prev => prev !== enabled ? enabled : prev);
            setTtsEngine(prev => prev !== engineType ? engineType : prev);

            if (engineType === 'f5_local' || engineType === 'f5_cloud') {
                setF5Mode(engineType === 'f5_local' ? 'local' : 'cloud');
                setAdvancedProvider('f5');
            } else if (engineType === 'qwen_local' || engineType === 'qwen_cloud') {
                setQwenMode(engineType === 'qwen_local' ? 'local' : 'cloud');
                setAdvancedProvider('qwen');
            } else if (engineType === 'gcloud') {
                setAdvancedProvider('gcloud');
            } else if (isAdvancedProvider(statusData.advanced_provider)) {
                setAdvancedProvider(statusData.advanced_provider);
            }

            if (statusData.f5_mode) {
                setF5Mode(statusData.f5_mode);
            }
            if (statusData.qwen_mode) {
                setQwenMode(statusData.qwen_mode);
            }
        }
    }, [ttsStatusData]);

    // [OK] Обновление: слушаем событие tts-status-changed для синхронизации с QuickActionsBar
    // [REMOVED] Redundant event listener. State updates are handled by TtsContext.
    // useEffect(() => {
    //     const handleTtsStatusChange = (event: CustomEvent<{ enabled: boolean }>) => {
    //         logger.log('[REFRESH] TtsMainPage: Received tts-status-changed event:', event.detail);
    //         queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
    //     };
    //     window.addEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    //     return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    // }, [queryClient]);

    useEffect(() => {
        if (ttsSettingsData) {
            const settingsData = ttsSettingsData as TtsSettingsData;
            setTtsSettings(prev => ({
                ...prev,
                enable7TV: settingsData.enable7TV ?? prev.enable7TV,
                enableTwitch: settingsData.enableTwitch ?? prev.enableTwitch,
                filterReplies: settingsData.filterReplies ?? prev.filterReplies,
                filterMentions: settingsData.filterMentions ?? prev.filterMentions,
                version: settingsData.version ?? prev.version,
            }));

            if (settingsData.listeningMode) {
                const nextListeningMode = settingsData.listeningMode;
                setListeningMode(prev => prev !== nextListeningMode ? nextListeningMode : prev);
            }

            const nextProvider = settingsData.advancedProvider || settingsData.advanced_provider;
            if (isAdvancedProvider(nextProvider)) {
                setAdvancedProvider(prev => (prev !== nextProvider ? nextProvider : prev));
            }

            const nextF5Mode = settingsData.f5Mode || settingsData.f5_mode;
            if (nextF5Mode === 'cloud' || nextF5Mode === 'local') {
                setF5Mode(prev => (prev !== nextF5Mode ? nextF5Mode : prev));
            }

            const nextQwenMode = settingsData.qwenMode || settingsData.qwen_mode;
            if (nextQwenMode === 'cloud' || nextQwenMode === 'local') {
                setQwenMode(prev => (prev !== nextQwenMode ? nextQwenMode : prev));
            }

            const nextQwenModel = (settingsData.qwenModel || settingsData.qwen_model || '').trim();
            if (nextQwenModel) {
                setQwenModel(prev => (prev !== nextQwenModel ? nextQwenModel : prev));
            }

            const nextQwenVoiceValue = (settingsData.qwenVoice || settingsData.qwen_voice || '').trim();
            setQwenVoiceValue(prev => (prev !== nextQwenVoiceValue ? nextQwenVoiceValue : prev));

            const gcloudSelection = Array.isArray(settingsData.gcloudVoices)
                ? settingsData.gcloudVoices
                : Array.isArray(settingsData.gcloud_voices)
                    ? settingsData.gcloud_voices
                    : null;

            if (gcloudSelection) {
                setSelectedGcloudVoices(gcloudSelection);
                gcloudSelectionInitializedRef.current = gcloudSelection.length > 0;
            }

            const resolvedMood = normalizeGcloudMood(
                settingsData.gcloudMood || settingsData.gcloud_mood
            );
            setGcloudMood((prev) => (prev !== resolvedMood ? resolvedMood : prev));
        }
    }, [ttsSettingsData]);

    useEffect(() => {
        const audioData = audioSettingsData as AudioSettingsData | undefined;
        if (audioData?.websiteVolume !== undefined) {
            const nextWebsiteVolume = audioData.websiteVolume;
            setLocalVolume(prev => prev !== nextWebsiteVolume ? nextWebsiteVolume : prev);
        }
    }, [audioSettingsData]);

    useEffect(() => {
        if (advancedProvider !== 'gcloud') {
            return;
        }
        if (isLoadingGcloudVoices || gcloudVoices.length > 0 || gcloudVoicesRequestStartedRef.current) {
            return;
        }

        gcloudVoicesRequestStartedRef.current = true;
        setIsLoadingGcloudVoices(true);
        ttsService.getGcloudVoices('ru-RU')
            .then((response) => {
                const payload = response.data as {
                    voices?: GcloudVoice[];
                    available?: boolean;
                    error?: string;
                    hint?: string;
                    data?: {
                        voices?: GcloudVoice[];
                        available?: boolean;
                        error?: string;
                        hint?: string;
                    };
                };
                const voices = payload?.data?.voices || payload?.voices || [];
                const sortedVoices = sortGcloudVoicesByQuality(voices);
                const available = payload?.data?.available ?? payload?.available ?? sortedVoices.length > 0;
                const loadHint = payload?.data?.hint || payload?.hint || payload?.data?.error || payload?.error || '';
                setGcloudVoices(sortedVoices);
                setGcloudLoadHint(available ? '' : loadHint || 'Голоса недоступны. Проверьте Google Cloud API.');

                if (!gcloudSelectionInitializedRef.current && selectedGcloudVoices.length === 0 && sortedVoices.length > 0) {
                    const initialVoices = getPreferredDefaultVoiceNames(sortedVoices).slice(0, 3);
                    if (initialVoices.length > 0) {
                        setSelectedGcloudVoices(initialVoices);
                        gcloudSelectionInitializedRef.current = true;
                        ttsService.saveGcloudVoices(initialVoices).catch(() => {
                            toast.error('Не удалось сохранить голоса Google Cloud');
                        });
                    }
                }
            })
            .catch((error: unknown) => {
                logger.error('Error loading Google Cloud voices:', error);
                setGcloudLoadHint('Не удалось загрузить голоса Google Cloud. Проверьте ключ и доступ к API.');
                toast.error('Не удалось загрузить голоса Google Cloud');
            })
            .finally(() => {
                setIsLoadingGcloudVoices(false);
            });
    }, [advancedProvider, gcloudVoices.length, isLoadingGcloudVoices, selectedGcloudVoices.length]);

    useEffect(() => {
        const platformData = platformSettingsData as PlatformSettingsData | undefined;
        if (platformData?.enabled_platforms) {
            setPlatformSettings(prev => {
                const newPlatforms = platformData.enabled_platforms || [];
                const currentPlatforms = prev.enabled_platforms || [];
                if (JSON.stringify(currentPlatforms) !== JSON.stringify(newPlatforms)) {
                    return {
                        ...prev,
                        enabled_platforms: newPlatforms as ('twitch' | 'vk')[],
                        global_enabled: platformData.global_enabled ?? prev.global_enabled
                    };
                }
                return prev;
            });
        }
    }, [platformSettingsData]);

    useEffect(() => {
        const handleTtsSettingsChanged = (event: CustomEvent<{ enabledPlatforms?: ('twitch' | 'vk')[] }>): void => {
            const enabledPlatforms = Array.isArray(event.detail?.enabledPlatforms) ? event.detail.enabledPlatforms : [];
            setPlatformSettings(prev => {
                const next = {
                    ...prev,
                    enabled_platforms: enabledPlatforms as ('twitch' | 'vk')[]
                };
                queryClient.setQueryData(queryKeys.tts.platformSettings(), { success: true, data: next });
                return next;
            });
        };

        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        return () => window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
    }, [queryClient]);

    useEffect(() => {
        const modeData = modeSettingsData as ModeSettingsData | undefined;
        if (modeData?.tts_mode) {
            const nextTtsMode = modeData.tts_mode;
            setTtsTriggerMode(prev => prev !== nextTtsMode ? nextTtsMode : prev);
        }
    }, [modeSettingsData]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const normalizedMode = listeningMode === 'obs' ? 'obs' : 'website';
        const currentMode = window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE);
        if (currentMode !== normalizedMode) {
            window.localStorage.setItem(STORAGE_KEYS.TTS_LISTENING_MODE, normalizedMode);
            window.dispatchEvent(new CustomEvent('tts-listening-mode-changed', {
                detail: { mode: normalizedMode }
            }));
        }
    }, [listeningMode]);

    useEffect(() => {
        if (listeningMode === 'obs' && isAuthenticated && user?.id) {
            ttsService.generateObsUrl()
                .then(response => {
                    const obsResponse = response.data as ApiResponse<ObsTokenResponse>;
                    const token = obsResponse?.data?.obs_token || (obsResponse as unknown as ObsTokenResponse)?.obs_token;
                    if (token) {
                        const url = getTtsWebSocketUrl(token);
                        setObsUrl(url);
                        logger.log('OBS URL generated:', url);
                    }
                })
                .catch((err: unknown) => {
                    logger.error('Error generating OBS URL:', err);
                    toast.error('Ошибка генерации OBS URL');
                });
        } else if (listeningMode === 'website') {
            setObsUrl('');
        }
    }, [listeningMode, isAuthenticated, user?.id]);

    const handleTtsModeChange = useCallback((mode: 'all_messages' | 'channel_points'): void => {
        if (isSavingMode || saveTtsModeSettingsMutation.isPending) return;

        setIsSavingMode(true);
        saveTtsModeSettingsMutation.mutate({ tts_mode: mode }, {
            onSuccess: (response) => {
                setTtsTriggerMode(mode);
                const responseData = response?.data as TtsModeResponse | undefined;
                if (responseData?.message) {
                    toast.success(responseData.message);
                }
            },
            onError: (error: unknown) => {
                logger.error('Error changing TTS mode:', error);
            },
            onSettled: () => {
                setIsSavingMode(false);
            },
        });
    }, [isSavingMode, saveTtsModeSettingsMutation]);

    const resolveAvailableF5Mode = useCallback((preferredMode: 'cloud' | 'local'): 'cloud' | 'local' | null => {
        if (preferredMode === 'cloud' && canUseF5Cloud) {
            return 'cloud';
        }
        if (preferredMode === 'local' && canUseF5Local) {
            return 'local';
        }
        if (canUseF5Cloud) {
            return 'cloud';
        }
        if (canUseF5Local) {
            return 'local';
        }
        return null;
    }, [canUseF5Cloud, canUseF5Local]);

    const resolveAvailableQwenMode = useCallback((preferredMode: 'cloud' | 'local'): 'cloud' | 'local' | null => {
        if (preferredMode === 'cloud' && canUseQwenCloud) {
            return 'cloud';
        }
        if (preferredMode === 'local' && canUseQwenLocal) {
            return 'local';
        }
        if (canUseQwenCloud) {
            return 'cloud';
        }
        if (canUseQwenLocal) {
            return 'local';
        }
        return null;
    }, [canUseQwenCloud, canUseQwenLocal]);

    const ensureF5CloudIsHealthy = useCallback(async (): Promise<boolean> => {
        const health = await checkTtsHealth('f5', 'cloud');
        if (!health.isHealthy) {
            toast.error('F5 Cloud сейчас недоступен');
            return false;
        }
        return true;
    }, [checkTtsHealth]);

    const ensureQwenModeIsHealthy = useCallback(async (mode: 'cloud' | 'local'): Promise<boolean> => {
        const health = await checkTtsHealth('qwen', mode);
        if (!health.isHealthy) {
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            toast.error(mode === 'local' ? 'Локальный Qwen сервер сейчас недоступен' : 'Qwen Cloud сейчас недоступен');
            return false;
        }
        return true;
    }, [checkTtsHealth, queryClient]);

    const notifyUnavailableProvider = useCallback((reason?: string): boolean => {
        if (reason) {
            toast.warning(reason);
        }
        return false;
    }, []);

    const applySelectedProviderEngine = useCallback(async (
        provider: AdvancedProvider,
        options?: ApplySelectedProviderOptions,
    ): Promise<boolean> => {
        const showSuccessToast = options?.showSuccessToast ?? true;
        try {
            if (provider === 'gcloud') {
                await switchEngineMutation.mutateAsync('gcloud');
                setTtsEngine('gcloud');
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                if (showSuccessToast) {
                    toast.success('Провайдер Google Cloud активирован');
                }
                return true;
            }

            if (provider === 'f5') {
                const preferredMode = options?.f5ModeOverride ?? f5Mode;
                let mode = resolveAvailableF5Mode(preferredMode);
                if (!mode) {
                    return notifyUnavailableProvider(getF5UnavailableReason() || 'F5 сейчас недоступен');
                }

                if (mode === 'cloud') {
                    const cloudHealthy = await ensureF5CloudIsHealthy();
                    if (!cloudHealthy) {
                        if (canUseF5Local) {
                            mode = 'local';
                            setF5Mode('local');
                            toast.warning('F5 Cloud недоступен, переключено на локальный F5');
                        } else {
                            return notifyUnavailableProvider('F5 Cloud сейчас недоступен');
                        }
                    }
                }

                const engineType = `f5_${mode}` as 'f5_cloud' | 'f5_local';
                await switchEngineMutation.mutateAsync(engineType);
                setTtsEngine(engineType);
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                if (showSuccessToast) {
                    toast.success(mode === 'local' ? 'Провайдер F5 (локально) активирован' : 'Провайдер F5 (облако) активирован');
                }
                return true;
            }

            const preferredMode = options?.qwenModeOverride ?? qwenMode;
            let mode = resolveAvailableQwenMode(preferredMode);
            if (!mode) {
                return notifyUnavailableProvider(getQwenUnavailableReason() || 'Qwen сейчас недоступен');
            }
            if (mode === 'local') {
                const localHealthy = await ensureQwenModeIsHealthy('local');
                if (!localHealthy) {
                    if (options?.qwenModeOverride || !canUseQwenCloud) {
                        return false;
                    }
                    mode = 'cloud';
                    setQwenMode('cloud');
                    toast.warning('Локальный Qwen недоступен, переключено на Qwen Cloud');
                }
            } else if (options?.qwenModeOverride === 'cloud') {
                const cloudHealthy = await ensureQwenModeIsHealthy('cloud');
                if (!cloudHealthy) {
                    return false;
                }
            }
            const engineType = `qwen_${mode}` as 'qwen_cloud' | 'qwen_local';
            await switchEngineMutation.mutateAsync(engineType);
            setTtsEngine(engineType);
            queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
            if (showSuccessToast) {
                toast.success(mode === 'local' ? 'Режим Qwen Self-hosted активирован' : 'Режим Qwen Cloud активирован');
            }
            return true;
        } catch (error: unknown) {
            logger.error('Error applying selected provider engine:', error);
            toast.error('Ошибка переключения провайдера озвучки');
            return false;
        }
    }, [
        canUseF5Local,
        ensureF5CloudIsHealthy,
        ensureQwenModeIsHealthy,
        f5Mode,
        getF5UnavailableReason,
        getQwenUnavailableReason,
        queryClient,
        qwenMode,
        canUseQwenCloud,
        resolveAvailableF5Mode,
        resolveAvailableQwenMode,
        switchEngineMutation,
        notifyUnavailableProvider,
    ]);

    useEffect(() => {
        if (advancedProvider !== 'f5') {
            return;
        }
        const resolvedMode = resolveAvailableF5Mode(f5Mode);
        if (resolvedMode && resolvedMode !== f5Mode) {
            setF5Mode(resolvedMode);
        }
    }, [advancedProvider, f5Mode, resolveAvailableF5Mode]);

    useEffect(() => {
        if (advancedProvider !== 'qwen') {
            return;
        }
        const resolvedMode = resolveAvailableQwenMode(qwenMode);
        if (resolvedMode && resolvedMode !== qwenMode) {
            setQwenMode(resolvedMode);
        }
    }, [advancedProvider, qwenMode, resolveAvailableQwenMode]);

    const handleGlobalTtsToggleRef = useRef<() => void>(() => { });

    handleGlobalTtsToggleRef.current = (): void => {
        if (isEngineActionPending) {
            return;
        }
        if (!isTwitchConnected && !isVkConnected) {
            toast.error('Для использования TTS необходимо подключить хотя бы одну платформу');
            return;
        }

        const newState = !isAnyTtsEnabled;
        setTtsEnabled(newState);

        toggleTtsMutation.mutate(newState, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.tts.status() });
                window.dispatchEvent(new CustomEvent('tts-status-changed', { detail: { enabled: newState } }));
                if (newState) {
                    void applySelectedProviderEngine(advancedProvider, { showSuccessToast: false });
                } else {
                    toast.success('TTS выключен');
                }
            },
            onError: (error: unknown) => {
                setTtsEnabled(!newState);
                logger.error('Error toggling TTS:', error);
                toast.error('Ошибка переключения TTS');
            },
        });
    };

    const handleGlobalTtsToggle = useCallback((): void => {
        handleGlobalTtsToggleRef.current();
    }, []);

    const handleF5ModeChange = useCallback(async (mode: 'cloud' | 'local'): Promise<void> => {
        if (isEngineActionPending) {
            return;
        }
        if (mode === f5Mode) return;
        if (mode === 'local' && !canUseF5Local) {
            toast.error('Сначала настройте локальный F5-TTS во вкладке "Локальный TTS"');
            return;
        }
        if (mode === 'cloud' && !canUseF5Cloud) {
            toast.error('Доступ к F5 Cloud отсутствует');
            return;
        }

        if (mode === 'cloud' && ttsEnabled && advancedProvider === 'f5') {
            const cloudHealthy = await ensureF5CloudIsHealthy();
            if (!cloudHealthy) {
                return;
            }
        }

        const previousMode = f5Mode;
        setF5Mode(mode);
        if (!ttsEnabled || advancedProvider !== 'f5') {
            saveTtsSettingsMutation.mutate({ f5Mode: mode });
            return;
        }
        const applied = await applySelectedProviderEngine('f5', { f5ModeOverride: mode });
        if (!applied) {
            setF5Mode(previousMode);
        }
    }, [
        advancedProvider,
        applySelectedProviderEngine,
        canUseF5Cloud,
        canUseF5Local,
        ensureF5CloudIsHealthy,
        f5Mode,
        isEngineActionPending,
        saveTtsSettingsMutation,
        ttsEnabled,
    ]);

    const handleQwenModeChange = useCallback(async (mode: 'cloud' | 'local'): Promise<void> => {
        if (isEngineActionPending) {
            return;
        }
        if (mode === qwenMode) return;
        if (mode === 'local' && !canUseQwenLocal) {
            toast.error('Сначала настройте локальный Qwen TTS во вкладке "Локальный TTS"');
            return;
        }
        if (mode === 'cloud' && !canUseQwenCloud) {
            toast.error('Доступ к Qwen Cloud отсутствует');
            return;
        }
        if (
            mode === 'local'
            && !(await ensureQwenModeIsHealthy('local'))
        ) {
            return;
        }
        if (
            mode === 'cloud'
            && ttsEnabled
            && advancedProvider === 'qwen'
            && !(await ensureQwenModeIsHealthy('cloud'))
        ) {
            return;
        }

        const previousMode = qwenMode;
        setQwenMode(mode);
        if (!ttsEnabled || advancedProvider !== 'qwen') {
            saveTtsSettingsMutation.mutate({ qwenMode: mode });
            return;
        }
        const applied = await applySelectedProviderEngine('qwen', { qwenModeOverride: mode });
        if (!applied) {
            setQwenMode(previousMode);
        }
    }, [
        advancedProvider,
        applySelectedProviderEngine,
        canUseQwenCloud,
        canUseQwenLocal,
        ensureQwenModeIsHealthy,
        isEngineActionPending,
        qwenMode,
        saveTtsSettingsMutation,
        ttsEnabled,
    ]);

    const handleQwenModelChange = useCallback((model: string): void => {
        const nextModel = (model || '').trim();
        if (!nextModel || nextModel === qwenModel || saveTtsSettingsMutation.isPending) {
            return;
        }

        const previousModel = qwenModel;
        setQwenModel(nextModel);

        saveTtsSettingsMutation.mutate(
            { qwenModel: nextModel },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
                },
                onError: () => {
                    setQwenModel(previousModel);
                    toast.error('Не удалось сохранить модель Qwen');
                },
            },
        );
    }, [qwenModel, queryClient, saveTtsSettingsMutation]);

    const handleQwenVoiceValueBlur = useCallback((): void => {
        const trimmedValue = qwenVoiceValue.trim();
        saveTtsSettingsMutation.mutate(
            { qwenVoice: trimmedValue },
            {
                onError: () => {
                    toast.error('Не удалось сохранить параметры Qwen');
                },
            },
        );
    }, [qwenVoiceValue, saveTtsSettingsMutation]);

    const handleQwenVoicePresetChange = useCallback((value: string): void => {
        const nextValue = value.trim();
        setQwenVoiceValue(nextValue);
        saveTtsSettingsMutation.mutate(
            { qwenVoice: nextValue },
            {
                onError: () => {
                    toast.error('Не удалось сохранить параметры Qwen');
                },
            },
        );
    }, [saveTtsSettingsMutation]);

    const handleAdvancedProviderChange = useCallback(async (provider: AdvancedProvider): Promise<void> => {
        if (provider === advancedProvider) return;

        if (!ttsEnabled || isEngineActionPending) {
            setAdvancedProvider(provider);
            saveTtsSettingsMutation.mutate({ advancedProvider: provider });
            return;
        }
        const changed = await applySelectedProviderEngine(provider);
        if (changed) {
            setAdvancedProvider(provider);
        }
    }, [
        advancedProvider,
        applySelectedProviderEngine,
        isEngineActionPending,
        saveTtsSettingsMutation,
        ttsEnabled,
    ]);

    const openPlayerTab = useCallback((): void => {
        if (typeof window === 'undefined') return;

        const playerUrl = `${window.location.origin}/tts-player`;
        const playerWindow = window.open(playerUrl, 'tts-player-tab');
        if (!playerWindow) {
            toast.error('Разрешите pop-up для открытия TTS Player');
            return;
        }
        playerWindow.focus();
    }, []);

    const handleListeningModeChange = useCallback((mode: 'website' | 'obs'): void => {
        setListeningMode(mode);
        saveListeningModeMutation.mutate(mode);
    }, [saveListeningModeMutation]);

    const persistGcloudVoices = useCallback((voices: string[]): void => {
        if (gcloudSaveDebounceRef.current) {
            clearTimeout(gcloudSaveDebounceRef.current);
        }

        const uniqueVoices = Array.from(new Set(voices)).filter(Boolean);

        gcloudSaveDebounceRef.current = setTimeout(() => {
            setIsSavingGcloudVoices(true);
            ttsService.saveGcloudVoices(uniqueVoices)
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
                })
                .catch((error: unknown) => {
                    logger.error('Error saving Google Cloud voices:', error);
                    toast.error('Не удалось сохранить голоса Google Cloud');
                })
                .finally(() => {
                    setIsSavingGcloudVoices(false);
                });
        }, 250);
    }, [queryClient]);

    const handleGcloudVoiceToggle = useCallback((voiceName: string, checked: boolean): void => {
        setSelectedGcloudVoices(prev => {
            const next = checked
                ? Array.from(new Set([...prev, voiceName]))
                : prev.filter(name => name !== voiceName);

            if (next.length === 0) {
                toast.error('Нужно выбрать хотя бы один голос');
                return prev;
            }

            persistGcloudVoices(next);
            return next;
        });
    }, [persistGcloudVoices]);

    const handleGcloudMoodChange = useCallback((nextMood: GcloudMood): void => {
        if (nextMood === gcloudMood || saveTtsSettingsMutation.isPending) return;

        const previousMood = gcloudMood;
        setGcloudMood(nextMood);

        saveTtsSettingsMutation.mutate(
            { gcloudMood: nextMood },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tts.settings() });
                },
                onError: () => {
                    setGcloudMood(previousMood);
                    toast.error('Не удалось сохранить настроение озвучки');
                },
            },
        );
    }, [gcloudMood, queryClient, saveTtsSettingsMutation]);

    const handleGcloudPreview = useCallback(async (voiceName: string): Promise<void> => {
        if (previewingGcloudVoice === voiceName) return;
        const now = Date.now();
        if (now - lastGcloudPreviewAtRef.current < 1500) {
            toast.warning('Слишком часто. Подождите чуть-чуть перед следующим тестом.');
            return;
        }
        lastGcloudPreviewAtRef.current = now;

        setPreviewingGcloudVoice(voiceName);
        try {
            if (gcloudPreviewAudioRef.current) {
                gcloudPreviewAudioRef.current.pause();
                gcloudPreviewAudioRef.current.currentTime = 0;
            }

            const selectedVoice = gcloudVoices.find((voice) => voice.name === voiceName);
            const selectedModelName = selectedVoice?.modelName || selectedVoice?.model_name;
            const geminiModelName = (selectedModelName || '').toLowerCase().includes('gemini')
                ? selectedModelName
                : undefined;
            const response = await ttsService.previewGcloudVoice({
                voice_name: voiceName,
                text: 'Привет! Это тестовый голос Google Cloud.',
                mood: gcloudMood,
                model_name: geminiModelName,
            });
            const payload = response.data as {
                audio_url?: string;
                voice?: string;
                requested_model?: string;
                fallback_used?: boolean;
                data?: {
                    audio_url?: string;
                    voice?: string;
                    requested_model?: string;
                    fallback_used?: boolean;
                };
            };
            const audioUrl = payload?.data?.audio_url || payload?.audio_url;
            const fallbackUsed = Boolean(payload?.data?.fallback_used ?? payload?.fallback_used);
            const usedVoice = payload?.data?.voice || payload?.voice || voiceName;
            const requestedModel = payload?.data?.requested_model || payload?.requested_model;

            if (!audioUrl) {
                toast.error('Не удалось получить аудио для предпрослушки');
                setPreviewingGcloudVoice(null);
                return;
            }

            const audio = new Audio(audioUrl);
            gcloudPreviewAudioRef.current = audio;
            audio.volume = Math.min(1, Math.max(0, localVolume / 100));

            audio.onended = () => {
                setPreviewingGcloudVoice(null);
            };
            audio.onerror = () => {
                setPreviewingGcloudVoice(null);
                toast.error('Ошибка воспроизведения предпрослушки');
            };

            await audio.play();
            if (fallbackUsed) {
                toast.warning(`Gemini недоступен для этого запроса. Использован fallback голос: ${usedVoice}`);
            } else if (requestedModel) {
                logger.log('Google Cloud preview model:', requestedModel);
            }
        } catch (error: unknown) {
            logger.error('Error previewing Google Cloud voice:', error);
            const axiosError = error as AxiosError<{
                detail?: { error?: string; hint?: string } | string;
            }>;
            const detail = axiosError.response?.data?.detail;
            const detailText = typeof detail === 'string'
                ? detail
                : detail?.hint || detail?.error;
            toast.error(detailText || 'Не удалось воспроизвести голос');
            setPreviewingGcloudVoice(null);
        }
    }, [previewingGcloudVoice, localVolume, gcloudMood, gcloudVoices]);

    const handleTtsSettingChange = useCallback((key: keyof TtsSettingsState, value: boolean | number): void => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);

        if (settingsDebounceRef.current) {
            clearTimeout(settingsDebounceRef.current);
        }

        settingsDebounceRef.current = setTimeout(() => {
            // Updated to use camelCase matching backend Pydantic model
            const ttsSettingsPayload = {
                enable7TV: newSettings.enable7TV,
                enableTwitch: newSettings.enableTwitch,
                filterReplies: newSettings.filterReplies,
                filterMentions: newSettings.filterMentions,
                version: newSettings.version
            };
            saveTtsSettingsMutation.mutate(ttsSettingsPayload);
        }, 450);
    }, [ttsSettings, saveTtsSettingsMutation]);

    const handlePlatformToggle = useCallback((platform: 'twitch' | 'vk'): void => {
        const isConnected = platform === 'twitch' ? isTwitchConnected : isVkConnected;
        if (!isConnected) {
            toast.error(`Сначала подключите интеграцию с ${platform === 'twitch' ? 'Twitch' : 'VK Live'}`);
            return;
        }

        const currentPlatforms = platformSettings.enabled_platforms || [];
        const newEnabledPlatforms = currentPlatforms.includes(platform)
            ? currentPlatforms.filter(p => p !== platform)
            : [...currentPlatforms, platform];

        setPlatformSettings(prev => ({ ...prev, enabled_platforms: newEnabledPlatforms }));

        savePlatformSettingsMutation.mutate({ enabled_platforms: newEnabledPlatforms }, {
            onSuccess: () => {
                window.dispatchEvent(new CustomEvent('tts-settings-changed', {
                    detail: { enabledPlatforms: newEnabledPlatforms }
                }));
            },
            onError: () => setPlatformSettings(prev => ({ ...prev, enabled_platforms: currentPlatforms }))
        });
    }, [isTwitchConnected, isVkConnected, platformSettings.enabled_platforms, savePlatformSettingsMutation]);

    const handleBooleanTtsSettingChange = useCallback((key: BooleanTtsSettingKey, value: boolean): void => {
        handleTtsSettingChange(key, value);
    }, [handleTtsSettingChange]);

    const providerOptions = useMemo(() => ([
        {
            provider: 'f5' as const,
            title: 'F5 TTS',
            active: advancedProvider === 'f5',
            available: canUseF5TTS || isF5TTSDataLoading,
        },
        {
            provider: 'qwen' as const,
            title: 'Qwen 3 TTS',
            active: advancedProvider === 'qwen',
            available: canUseQwenTTS,
        },
        {
            provider: 'gcloud' as const,
            title: 'Google Cloud',
            active: advancedProvider === 'gcloud',
            available: canUseGcloudTTS || isLoadingGcloudVoices,
        },
    ]), [
        advancedProvider,
        canUseF5TTS,
        canUseGcloudTTS,
        canUseQwenTTS,
        isF5TTSDataLoading,
        isLoadingGcloudVoices,
    ]);

    const qwenModelOptions = useMemo(() => {
        const catalog = Array.isArray(qwenModelsData?.models) ? qwenModelsData.models : [];
        return catalog
            .map(normalizeQwenModelOption)
            .filter((option): option is QwenModelOption => Boolean(option));
    }, [qwenModelsData]);

    useEffect(() => {
        if (qwenModelOptions.length === 0) {
            autoAlignedQwenModelRef.current = null;
            return;
        }

        const hasSelectedModel = qwenModelOptions.some((option) => option.value === qwenModel);
        if (hasSelectedModel) {
            autoAlignedQwenModelRef.current = null;
            return;
        }

        const runtimeCurrentModel = typeof qwenModelsData?.current_model === 'string'
            ? qwenModelsData.current_model.trim()
            : '';
        const fallbackModel = qwenModelOptions.find((option) => option.value === runtimeCurrentModel)?.value
            || qwenModelOptions[0]?.value
            || QWEN_MODEL_DEFAULT;

        if (fallbackModel && fallbackModel !== qwenModel) {
            setQwenModel(fallbackModel);
            if (
                advancedProvider === 'qwen'
                && !saveTtsSettingsMutation.isPending
                && autoAlignedQwenModelRef.current !== `${qwenMode}:${fallbackModel}`
            ) {
                autoAlignedQwenModelRef.current = `${qwenMode}:${fallbackModel}`;
                saveTtsSettingsMutation.mutate(
                    { qwenModel: fallbackModel },
                    {
                        onError: () => {
                            autoAlignedQwenModelRef.current = null;
                            toast.error('Не удалось синхронизировать модель Qwen с доступным runtime');
                        },
                    },
                );
            }
        }
    }, [advancedProvider, qwenMode, qwenModel, qwenModelOptions, qwenModelsData?.current_model, saveTtsSettingsMutation]);

    const selectedQwenModelOption = useMemo(
        () =>
            getQwenModelOption(qwenModelOptions, qwenModel) ||
            getQwenModelOption(qwenModelOptions, QWEN_MODEL_DEFAULT),
        [qwenModel, qwenModelOptions],
    );
    const qwenSelectValue = useMemo(
        () => (qwenModelOptions.some((option) => option.value === qwenModel) ? qwenModel : ''),
        [qwenModel, qwenModelOptions],
    );
    const isQwenBaseModel = Boolean(
        selectedQwenModelOption?.supportsVoiceCloning || selectedQwenModelOption?.requiresRefAudio,
    );
    const isQwenPromptModel = Boolean(selectedQwenModelOption?.requiresPrompt);

    const providerOptionButtons = useMemo(() => (
        providerOptions.map((option) => (
            <ProviderOptionButton
                key={option.provider}
                provider={option.provider}
                title={option.title}
                active={option.active}
                available={option.available}
                disabled={isEngineActionPending}
                onSelect={(provider) => {
                    void handleAdvancedProviderChange(provider);
                }}
            />
        ))
    ), [handleAdvancedProviderChange, isEngineActionPending, providerOptions]);

    const sourcePlatformToggles = useMemo(() => (
        (['twitch', 'vk'] as const).map((platform) => (
            <SourcePlatformToggleRow
                key={platform}
                platform={platform}
                isConnected={platform === 'twitch' ? isTwitchConnected : isVkConnected}
                isEnabled={Boolean(platformSettings.enabled_platforms?.includes(platform))}
                onToggle={handlePlatformToggle}
            />
        ))
    ), [handlePlatformToggle, isTwitchConnected, isVkConnected, platformSettings.enabled_platforms]);

    const filterToggleRows = useMemo(() => ([
        {
            key: 'enable7TV' as const,
            label: '7TV смайлы',
            checked: ttsSettings.enable7TV,
        },
        {
            key: 'enableTwitch' as const,
            label: 'Twitch смайлы',
            checked: ttsSettings.enableTwitch,
        },
        {
            key: 'filterMentions' as const,
            label: 'Озвучивать «@»',
            checked: !ttsSettings.filterMentions,
            invert: true,
        },
    ].map((row) => (
        <TtsFilterSwitchRow
            key={row.key}
            label={row.label}
            settingKey={row.key}
            checked={row.checked}
            invert={row.invert}
            onToggle={handleBooleanTtsSettingChange}
        />
    ))), [handleBooleanTtsSettingChange, ttsSettings.enable7TV, ttsSettings.enableTwitch, ttsSettings.filterMentions]);

    const gcloudVoiceRows = useMemo(() => {
        if (isLoadingGcloudVoices) {
            return <div className="text-xs text-muted-foreground">Загрузка голосов...</div>;
        }

        if (gcloudVoices.length === 0) {
            return <div className="text-xs text-amber-300/90">{getGcloudUnavailableReason()}</div>;
        }

        return gcloudVoices.map((voice) => {
            const isSelected = selectedGcloudVoices.includes(voice.name);
            const voiceMeta = gcloudVoiceMetaMap.get(voice.name) || getGcloudVoiceMeta(voice);

            return (
                <div
                    key={voice.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                >
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={(val) => handleGcloudVoiceToggle(voice.name, Boolean(val))}
                        />
                        <div className="space-y-1">
                            <span className="block text-sm text-foreground" title={voice.name}>
                                {getGcloudVoiceDisplayName(voice.name)}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
                                    {voiceMeta.modelFamily}
                                </span>
                                <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
                                    {voiceMeta.genderLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleGcloudPreview(voice.name)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 transition-colors ${PROJECT_BLUE_SOLID_CLASS}`}
                    >
                        {previewingGcloudVoice === voice.name ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            );
        });
    }, [
        gcloudVoiceMetaMap,
        gcloudVoices,
        getGcloudUnavailableReason,
        handleGcloudPreview,
        handleGcloudVoiceToggle,
        isLoadingGcloudVoices,
        previewingGcloudVoice,
        selectedGcloudVoices,
    ]);

    const regenerateObsUrlMutation = useRegenerateTtsObsUrl({
        onSuccess: (response) => {
            const responseData = response?.data as ObsTokenResponse | undefined;
            const token = responseData?.obs_token;
            if (token) {
                const url = getTtsWebSocketUrl(token);
                setObsUrl(url);
                toast.success('Токен обновлен, URL скопирован в буфер обмена');
                navigator.clipboard.writeText(url);
                logger.log('OBS URL regenerated:', url);
            } else {
                toast.error('Токен не получен');
            }
        },
        onError: (error: unknown) => {
            logger.error('Error regenerating OBS URL:', error);
        },
    });

    const handleRegenerateObsUrl = useCallback((): void => {
        if (regenerateObsUrlMutation.isPending) return;
        setIsRegeneratingUrl(true);
        regenerateObsUrlMutation.mutate(undefined, {
            onSettled: () => {
                setIsRegeneratingUrl(false);
            },
        });
    }, [regenerateObsUrlMutation]);

    useEffect(() => {
        return () => {
            if (settingsDebounceRef.current) {
                clearTimeout(settingsDebounceRef.current);
            }
            if (gcloudSaveDebounceRef.current) {
                clearTimeout(gcloudSaveDebounceRef.current);
            }
        };
    }, []);

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Text to Speech">
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
                                Для использования TTS необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="gap-2"
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
            <PageWrapper title="Text to Speech">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Нет подключенных платформ
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для использования TTS необходимо подключить хотя бы одну платформу (Twitch или VK Live)
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/dashboard/settings')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Перейти к настройкам
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Text to Speech" className="min-h-0 px-0 py-0">
            <div className="mx-auto w-full max-w-6xl space-y-3">
                <TtsMasterToggleCard
                    enabled={isAnyTtsEnabled}
                    isPending={isGlobalTogglePending}
                    onToggle={handleGlobalTtsToggle}
                />

                {isAnyTtsEnabled && (
                    <>
                        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
                            <Card className={`${SURFACE_CARD_CLASS} min-w-0 flex flex-col`}>
                                <CardHeader className="border-b border-border/50 pb-3.5">
                                    <CardTitle className="text-base font-bold text-foreground">Озвучка</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col space-y-3.5 pt-4">
                                    <div className={SECTION_PANEL_CLASS}>
                                        <div className={SECTION_EYEBROW_CLASS}>Режим триггера</div>
                                        <div className="mt-2.5">
                                        <TtsChannelPointsMode
                                            ttsMode={ttsTriggerMode}
                                            onModeChange={handleTtsModeChange}
                                            isSaving={isSavingMode}
                                            showModeSelector={true}
                                            showRewards={true}
                                        />
                                        </div>
                                    </div>

                                    <div className={`${SECTION_PANEL_CLASS} space-y-3.5`}>
                                        <div className={SECTION_EYEBROW_CLASS}>Провайдер</div>

                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {providerOptionButtons}
                                        </div>

                                        {advancedProvider === 'f5' && (
                                            <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-foreground">Режим подключения</div>
                                                    {!canUseF5TTS && (
                                                        <p className="mt-1 text-xs text-muted-foreground">{getF5UnavailableReason()}</p>
                                                    )}
                                                </div>
                                                <div className="grid w-full grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleF5ModeChange('cloud')}
                                                        disabled={!canUseF5Cloud || isEngineActionPending}
                                                        className={`${SELECTOR_BUTTON_BASE_CLASS} ${f5Mode === 'cloud'
                                                            ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                            : SELECTOR_BUTTON_IDLE_CLASS
                                                            } ${!canUseF5Cloud ? 'cursor-not-allowed opacity-45' : ''}`}
                                                    >
                                                        Облако
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleF5ModeChange('local')}
                                                        disabled={!canUseF5Local || isEngineActionPending}
                                                        className={`${SELECTOR_BUTTON_BASE_CLASS} ${f5Mode === 'local'
                                                            ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                            : SELECTOR_BUTTON_IDLE_CLASS
                                                            } ${!canUseF5Local ? 'cursor-not-allowed opacity-45' : ''}`}
                                                    >
                                                        Self-hosted
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {advancedProvider === 'qwen' && (
                                            <div className="space-y-3 pt-1">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-foreground">Режим подключения</div>
                                                        {!canUseQwenTTS && (
                                                            <p className="mt-1 text-xs text-muted-foreground">{getQwenUnavailableReason()}</p>
                                                        )}
                                                    </div>
                                                    <div className="grid w-full grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleQwenModeChange('cloud')}
                                                            disabled={!canUseQwenCloud || isEngineActionPending}
                                                            className={`${SELECTOR_BUTTON_BASE_CLASS} ${qwenMode === 'cloud'
                                                                ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                                : SELECTOR_BUTTON_IDLE_CLASS
                                                                } ${!canUseQwenCloud ? 'cursor-not-allowed opacity-45' : ''}`}
                                                        >
                                                            Облако
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleQwenModeChange('local')}
                                                            disabled={!canUseQwenLocal || isEngineActionPending}
                                                            className={`${SELECTOR_BUTTON_BASE_CLASS} ${qwenMode === 'local'
                                                                ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                                : SELECTOR_BUTTON_IDLE_CLASS
                                                                } ${!canUseQwenLocal ? 'cursor-not-allowed opacity-45' : ''}`}
                                                        >
                                                            Self-hosted
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <Select
                                                        value={qwenSelectValue}
                                                        onValueChange={handleQwenModelChange}
                                                    >
                                                        <SelectTrigger
                                                            className="h-10 bg-background/70"
                                                            disabled={isLoadingQwenModels || qwenModelOptions.length === 0}
                                                        >
                                                            <SelectValue placeholder="Выбери модель Qwen" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {qwenModelOptions.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    {qwenModelsData?.available === false && !isLoadingQwenModels && qwenModelOptions.length === 0 && (
                                                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                                                            {qwenModelsData.detail?.message || 'Каталог моделей Qwen сейчас недоступен.'}
                                                        </div>
                                                    )}

                                                    <div className="min-h-[152px] pt-1">
                                                        {isQwenBaseModel ? (
                                                            <div className="flex h-[152px] items-center justify-center rounded-xl border border-border/60 bg-background/35 px-4 py-4 text-center">
                                                                <div className="flex items-center justify-center">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        onClick={() => navigate('/dashboard/tts/voices')}
                                                                        className="h-auto px-0 text-base text-sky-300 hover:bg-transparent hover:text-sky-200"
                                                                    >
                                                                        Перейти к управлению голосами
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : selectedQwenModelOption?.family === 'custom_voice' ? (
                                                            <div className="h-[152px] overflow-hidden rounded-xl border border-border/60 bg-background/35 p-3">
                                                                <div className="grid h-full grid-cols-2 gap-2 overflow-y-auto pr-1">
                                                                    {QWEN_CUSTOMVOICE_SPEAKERS.map((speaker) => {
                                                                        const isSelected = (qwenVoiceValue || QWEN_CUSTOMVOICE_SPEAKERS[0].value) === speaker.value;
                                                                        return (
                                                                            <button
                                                                                key={speaker.value}
                                                                                type="button"
                                                                                onClick={() => handleQwenVoicePresetChange(speaker.value)}
                                                                                className={`flex min-h-[48px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${isSelected
                                                                                    ? 'border-sky-500/50 bg-sky-500/12 text-sky-300'
                                                                                    : 'border-border/70 bg-background/70 text-muted-foreground hover:border-sky-500/35 hover:text-sky-200'
                                                                                    }`}
                                                                            >
                                                                                {speaker.label}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : isQwenPromptModel ? (
                                                            <div className="h-[152px]">
                                                                <Textarea
                                                                    id="qwen-prompt"
                                                                    value={qwenVoiceValue}
                                                                    onChange={(event) => setQwenVoiceValue(event.target.value)}
                                                                    onBlur={handleQwenVoiceValueBlur}
                                                                    placeholder="Опиши желаемый характер голоса для генерации"
                                                                    className="h-full min-h-0 resize-none bg-background/60"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="h-[152px]" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {advancedProvider === 'gcloud' && (
                                            <div className="space-y-3 rounded-lg border border-border/70 bg-background/50 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-foreground">Голоса Google Cloud</div>
                                                        {!canUseGcloudTTS && (
                                                            <p className="mt-1 text-xs text-muted-foreground">{getGcloudUnavailableReason()}</p>
                                                        )}
                                                    </div>
                                                    <div className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                                                        {isSavingGcloudVoices ? 'Сохранение...' : `${selectedGcloudVoices.length}/${gcloudVoices.length || 0} выбрано`}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className={SECTION_EYEBROW_CLASS}>Настроение</div>
                                                    <div className="inline-flex flex-wrap gap-2">
                                                        {GCLOUD_MOOD_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => handleGcloudMoodChange(option.value)}
                                                                className={`${SEGMENT_BUTTON_CLASS} ${gcloudMood === option.value
                                                                    ? PROJECT_BLUE_SOLID_CLASS
                                                                    : PROJECT_BLUE_TEXT_HOVER_CLASS
                                                                    }`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                                                    {gcloudVoiceRows}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`${SECTION_PANEL_CLASS} space-y-3.5`}>
                                        <div className={SECTION_EYEBROW_CLASS}>Вывод звука</div>

                                        <div className="grid w-full grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleListeningModeChange('website')}
                                                className={`${SELECTOR_BUTTON_BASE_CLASS} text-center ${listeningMode === 'website'
                                                    ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                    : SELECTOR_BUTTON_IDLE_CLASS
                                                    }`}
                                            >
                                                Браузер
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleListeningModeChange('obs')}
                                                className={`${SELECTOR_BUTTON_BASE_CLASS} text-center ${listeningMode === 'obs'
                                                    ? SELECTOR_BUTTON_ACTIVE_CLASS
                                                    : SELECTOR_BUTTON_IDLE_CLASS
                                                    }`}
                                            >
                                                OBS
                                            </button>
                                        </div>

                                        <div className="min-w-0 pt-1">
                                            <div className="grid min-h-[168px] min-w-0 grid-rows-[auto_40px_40px] gap-3 overflow-hidden rounded-xl border border-border/50 bg-background/35 px-4 py-3">
                                                {listeningMode === 'website' ? (
                                                    <>
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${PROJECT_BLUE_SUBTLE_CLASS}`}>
                                                                <Play className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-foreground">TTS Player</div>
                                                                <div className="mt-1 text-xs text-muted-foreground">Отдельная вкладка для браузерного воспроизведения</div>
                                                            </div>
                                                        </div>

                                                        <div aria-hidden="true" className="h-10" />
                                                        <div className="flex items-center">
                                                            <Button onClick={openPlayerTab} className="h-10 w-full px-4">
                                                                <Play className="mr-2 h-4 w-4" />
                                                                Открыть TTS Player
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${PROJECT_BLUE_SUBTLE_CLASS}`}>
                                                                <Settings className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-foreground">OBS endpoint</div>
                                                                <div className="mt-1 text-xs text-muted-foreground">Ссылка для подключения OBS-плеера</div>
                                                            </div>
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div
                                                                className="group relative flex h-10 min-w-0 cursor-pointer items-center overflow-hidden rounded-lg border border-border/70 bg-background/70 px-3"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(obsUrl);
                                                                    toast.success('Скопировано');
                                                                }}
                                                            >
                                                                <div className="min-w-0 flex-1 truncate pr-14 font-mono text-xs text-muted-foreground">
                                                                    {obsUrl || 'Генерация URL...'}
                                                                </div>
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                                                                    Copy
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center">
                                                            <Button
                                                                onClick={handleRegenerateObsUrl}
                                                                className="h-10 w-full px-4"
                                                                disabled={isRegeneratingUrl}
                                                            >
                                                                {isRegeneratingUrl ? 'Обновление...' : 'Сбросить токен'}
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex min-w-0 h-full flex-col gap-3">
                                <Card className={SURFACE_CARD_CLASS}>
                                    <CardHeader className="border-b border-border/50 pb-3.5">
                                        <CardTitle className="text-base font-bold text-foreground">Источники озвучки</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5 pt-4">
                                        {sourcePlatformToggles}
                                    </CardContent>
                                </Card>

                                <Card className={`${SURFACE_CARD_CLASS} flex-1`}>
                                    <CardHeader className="border-b border-border/50 pb-3.5">
                                        <CardTitle className="text-base font-bold text-foreground">Фильтры озвучки</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex h-full flex-col gap-2.5 pt-4">
                                        {filterToggleRows}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>


                        {/* Фильтры (Moved to bottom full-width) */}
                        <div className="w-full">
                            <TtsFilterManager className="w-full" />
                        </div>
                    </>
                )}
            </div>
        </PageWrapper >
    );
};

// Экспортируем обертку компонента
const TtsMainPage = () => <TtsMainPageContent />;
export default TtsMainPage;
