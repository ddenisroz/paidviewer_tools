import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { CirclePlay, Cloud, Copy, Info, Monitor, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';
import { TtsBlockedUsersCard } from '@/features/tts/components/TtsBlockedUsersCard';
import { TtsForbiddenWordsCard } from '@/features/tts/components/TtsForbiddenWordsCard';
import {
    useAddFilteredWord,
    useBlockUser,
    useBlockedUsers,
    useDeleteFilteredWord,
    useFilteredWords,
    useSaveTtsModeSettings,
    useSaveTtsPlatformSettings,
    useSaveTtsSettings,
    useSetTtsEngine,
    useSetTtsListeningMode,
    useToggleTts,
    useTtsModeSettings,
    useTtsPlatformSettings,
    useTtsSettings,
    useTtsStatus,
    useUnblockUser,
} from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import PageWrapper from '@/shared/components/PageWrapper';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { getFrontendBaseUrl } from '@/shared/utils/urlUtils';

import type { ApiResponse } from '@/types';
import type { TtsSettings, TtsStatus } from '@/types/tts';

type ListeningMode = 'website' | 'obs';
type TriggerMode = 'all_messages' | 'channel_points';
type EngineType = 'f5_cloud' | 'f5_local' | 'gcloud';
type Platform = 'twitch' | 'vk';
type BlockedPlatform = 'twitch' | 'vk' | 'youtube';

interface PlatformSettingsData {
    enabled_platforms?: Platform[];
    available_platforms?: Platform[];
}

interface GcloudVoice {
    name: string;
    ssmlGender?: string;
    modelName?: string;
    model_name?: string;
}

interface SettingsState {
    filterReplies: boolean;
    filterMentions: boolean;
    directInteractionsEnabled: boolean;
    skipCommands: boolean;
    disableVoiceSelection: boolean;
    speakSenderName: boolean;
    maxMessageLength: number;
}

interface ObsStatus {
    has_token?: boolean;
    source_connected?: boolean;
    dock_connected?: boolean;
}

interface TtsObsLinks {
    dock_token?: string | null;
    source_token?: string | null;
    dock_url?: string | null;
    source_url?: string | null;
    obs_token?: string | null;
    dock_connected?: boolean;
    source_connected?: boolean;
}

const unwrapPayload = <T,>(payload: ApiResponse<T> | T | undefined | null): T | undefined => {
    if (!payload) return undefined;
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
        return (payload as ApiResponse<T>).data;
    }
    return payload as T;
};

const buildTtsObsDockUrl = (token?: string | null): string => {
    const normalizedToken = (token || '').trim();
    if (!normalizedToken) return '';
    return `${getFrontendBaseUrl()}/tts/obs-dock?dock_token=${encodeURIComponent(normalizedToken)}`;
};

const buildTtsObsSourceUrl = (token?: string | null): string => {
    const normalizedToken = (token || '').trim();
    if (!normalizedToken) return '';
    return `${getFrontendBaseUrl()}/tts-obs/${encodeURIComponent(normalizedToken)}`;
};

const ENGINE_COPY: Record<EngineType, { label: string; icon: React.ElementType }> = {
    f5_cloud: { label: 'F5 TTS', icon: Cloud },
    f5_local: { label: 'Self-hosted', icon: Monitor },
    gcloud: { label: 'Google Cloud', icon: Sparkles },
};

const OBS_DOCK_HELP =
    'В OBS откройте Docks > Custom Browser Docks, задайте название док-панели и вставьте эту ссылку в поле URL.';
const OBS_AUDIO_HELP =
    'В OBS добавьте Browser Source, вставьте эту ссылку, включите звук источника и при необходимости мониторинг в Audio Mixer.';

const platformConfig: Array<{ platform: Platform; label: string; Icon: React.ElementType }> = [
    { platform: 'twitch', label: 'Twitch', Icon: TwitchIcon },
    { platform: 'vk', label: 'VK Live', Icon: VKIcon },
];

const TtsMainPage: React.FC = () => {
    const { user } = useAuth();
    const { integrations } = useIntegrations();
    const userId = user?.id;

    const { data: statusResponse } = useTtsStatus(null, { enabled: Boolean(userId) });
    const { data: settingsResponse } = useTtsSettings({ enabled: Boolean(userId) });
    const { data: platformResponse } = useTtsPlatformSettings({ enabled: Boolean(userId) });
    const { data: modeResponse } = useTtsModeSettings({ enabled: Boolean(userId) });

    const saveSettingsMutation = useSaveTtsSettings();
    const savePlatformMutation = useSaveTtsPlatformSettings();
    const saveModeMutation = useSaveTtsModeSettings();
    const toggleTtsMutation = useToggleTts();
    const setEngineMutation = useSetTtsEngine();
    const setListeningModeMutation = useSetTtsListeningMode();
    const addFilteredWordMutation = useAddFilteredWord();
    const deleteFilteredWordMutation = useDeleteFilteredWord();
    const blockUserMutation = useBlockUser();
    const unblockUserMutation = useUnblockUser();

    const status =
        unwrapPayload<TtsStatus>(statusResponse as ApiResponse<TtsStatus> | TtsStatus | undefined) ||
        (statusResponse as TtsStatus | undefined);
    const settings =
        unwrapPayload<TtsSettings>(settingsResponse as ApiResponse<TtsSettings> | TtsSettings | undefined) ||
        (settingsResponse as TtsSettings | undefined);
    const platformSettings = unwrapPayload<PlatformSettingsData>(
        platformResponse as ApiResponse<PlatformSettingsData> | PlatformSettingsData | undefined
    );
    const modeSettings = unwrapPayload<{ tts_mode?: TriggerMode }>(
        modeResponse as ApiResponse<{ tts_mode?: TriggerMode }> | { tts_mode?: TriggerMode } | undefined
    );
    const { data: gcloudVoices = [] } = useQuery<GcloudVoice[]>({
        queryKey: ['tts', 'gcloud-voices', 'ru-RU'],
        enabled: Boolean(userId),
        staleTime: 10 * 60 * 1000,
        queryFn: async () => {
            const response = await ttsService.getGcloudVoices('ru-RU');
            const payload = response.data as { data?: { voices?: GcloudVoice[] }; voices?: GcloudVoice[] };
            return payload.data?.voices || payload.voices || [];
        },
    });
    const { data: obsUrlResponse } = useQuery<TtsObsLinks>({
        queryKey: ['tts', 'obs-url'],
        enabled: Boolean(userId),
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const response = await ttsService.getObsLinks();
            return (
                unwrapPayload<TtsObsLinks>(response.data as ApiResponse<TtsObsLinks> | TtsObsLinks) || {}
            );
        },
    });
    const { data: obsStatusResponse } = useQuery<ApiResponse<ObsStatus> | ObsStatus>({
        queryKey: ['tts', 'obs-status'],
        enabled: Boolean(userId),
        refetchInterval: 3000,
        queryFn: async () => {
            const response = await ttsService.getObsStatus();
            return response.data as ApiResponse<ObsStatus> | ObsStatus;
        },
    });
    const { data: filteredWords = [], isLoading: filteredWordsLoading } = useFilteredWords({ enabled: Boolean(userId) });
    const { data: blockedUsers = [], isLoading: blockedUsersLoading } = useBlockedUsers({ enabled: Boolean(userId) });

    const [settingsState, setSettingsState] = useState<SettingsState>({
        filterReplies: false,
        filterMentions: false,
        directInteractionsEnabled: true,
        skipCommands: true,
        disableVoiceSelection: false,
        speakSenderName: false,
        maxMessageLength: 150,
    });
    const [selectedEngine, setSelectedEngine] = useState<EngineType>('f5_cloud');
    const [listeningMode, setListeningMode] = useState<ListeningMode>('website');
    const [ttsMode, setTtsMode] = useState<TriggerMode>('all_messages');
    const [enabledPlatforms, setEnabledPlatforms] = useState<Platform[]>([]);
    const [selectedGcloudVoice, setSelectedGcloudVoice] = useState('');
    const [gcloudMood, setGcloudMood] = useState<'neutral' | 'sad' | 'happy'>('neutral');
    const [newForbiddenWord, setNewForbiddenWord] = useState('');
    const [forbiddenWordsOpen, setForbiddenWordsOpen] = useState(false);
    const [blockedUsername, setBlockedUsername] = useState('');
    const [blockedPlatform, setBlockedPlatform] = useState<BlockedPlatform>('twitch');
    const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
    const forbiddenWordFormRef = useRef<HTMLDivElement | null>(null);
    const savedMaxMessageLengthRef = useRef(150);

    const connectedPlatforms = useMemo(
        () =>
            platformConfig
                .filter(({ platform }) => (platform === 'twitch' ? integrations.twitch.enabled : integrations.vk.enabled))
                .map(({ platform }) => platform),
        [integrations.twitch.enabled, integrations.vk.enabled]
    );

    useEffect(() => {
        if (!settings) return;
        const maxMessageLength = Math.max(50, Math.min(250, Number(settings.maxMessageLength ?? settings.max_message_length ?? 150)));
        const filterReplies = Boolean(settings.filterReplies ?? settings.filter_replies ?? false);
        const filterMentions = Boolean(settings.filterMentions ?? settings.filter_mentions ?? false);
        setSettingsState({
            filterReplies,
            filterMentions,
            directInteractionsEnabled: Boolean(
                settings.directInteractionsEnabled ??
                    settings.direct_interactions_enabled ??
                    (!filterReplies && !filterMentions)
            ),
            skipCommands: Boolean(settings.skipCommands ?? settings.skip_commands ?? true),
            disableVoiceSelection: Boolean(settings.disableVoiceSelection ?? settings.disable_voice_selection ?? false),
            speakSenderName: Boolean(settings.speakSenderName ?? settings.speak_sender_name ?? false),
            maxMessageLength,
        });
        savedMaxMessageLengthRef.current = maxMessageLength;
        setListeningMode(
            (settings.listeningMode as ListeningMode) || (settings.listening_mode as ListeningMode) || 'website'
        );
        setSelectedGcloudVoice(settings.gcloudVoices?.[0] || settings.gcloud_voices?.[0] || '');
        setGcloudMood(settings.gcloudMood || settings.gcloud_mood || 'neutral');
    }, [settings]);

    useEffect(() => {
        if (!status) return;
        if (status.engine_type === 'f5_local' || status.engine_type === 'f5_cloud' || status.engine_type === 'gcloud') {
            setSelectedEngine(status.engine_type);
            return;
        }
        if (status.advanced_provider === 'gcloud') {
            setSelectedEngine('gcloud');
            return;
        }
        setSelectedEngine(status.has_local_setup_f5 && status.f5_mode === 'local' ? 'f5_local' : 'f5_cloud');
    }, [status]);

    useEffect(() => {
        if (modeSettings?.tts_mode === 'channel_points' || modeSettings?.tts_mode === 'all_messages') {
            setTtsMode(modeSettings.tts_mode);
        }
    }, [modeSettings]);

    useEffect(() => {
        const available = platformSettings?.available_platforms?.length ? platformSettings.available_platforms : connectedPlatforms;
        const nextPlatforms = (platformSettings?.enabled_platforms || []).filter((platform) => available.includes(platform));
        setEnabledPlatforms(nextPlatforms);
    }, [connectedPlatforms, platformSettings]);

    const obsStatus = unwrapPayload<ObsStatus>(obsStatusResponse as ApiResponse<ObsStatus> | ObsStatus | undefined) || {};
    const isModeSaving = saveModeMutation.isPending;
    const isEngineBusy = setEngineMutation.isPending;
    const isEnabled = Boolean(status?.enabled);
    const hasLocalSetup = Boolean(status?.has_local_setup_f5 || status?.has_local_setup);
    const obsDockUrl = obsUrlResponse?.dock_url || buildTtsObsDockUrl(obsUrlResponse?.dock_token || obsUrlResponse?.obs_token);
    const obsSourceUrl = obsUrlResponse?.source_url || buildTtsObsSourceUrl(obsUrlResponse?.source_token || obsUrlResponse?.obs_token);

    const gcloudVoiceOptions = useMemo(
        () =>
            gcloudVoices.map((voice) => ({
                value: voice.name,
                label: `${voice.name}${voice.ssmlGender ? ` / ${voice.ssmlGender}` : ''}${
                    voice.modelName || voice.model_name ? ` / ${voice.modelName || voice.model_name}` : ''
                }`,
            })),
        [gcloudVoices]
    );
    const saveBoolean = (key: keyof SettingsState, value: boolean): void => {
        const nextState = { ...settingsState, [key]: value };
        setSettingsState(nextState);
        saveSettingsMutation.mutate({ [key]: value } as Partial<TtsSettings>);
    };

    const saveDirectInteractions = (enabled: boolean): void => {
        setSettingsState((prev) => ({
            ...prev,
            directInteractionsEnabled: enabled,
            filterReplies: !enabled,
            filterMentions: !enabled,
        }));
        saveSettingsMutation.mutate({
            filterReplies: !enabled,
            filterMentions: !enabled,
        });
    };

    const handleMaxLengthPreviewChange = (value: number): void => {
        const nextValue = Math.max(50, Math.min(250, Number.isFinite(value) ? Math.round(value) : 150));
        setSettingsState((prev) => ({ ...prev, maxMessageLength: nextValue }));
    };

    const commitMaxLengthChange = (value: number): void => {
        const nextValue = Math.max(50, Math.min(250, Number.isFinite(value) ? Math.round(value) : 150));
        if (nextValue === savedMaxMessageLengthRef.current) return;

        saveSettingsMutation.mutate(
            { maxMessageLength: nextValue },
            {
                onSuccess: () => {
                    savedMaxMessageLengthRef.current = nextValue;
                },
            }
        );
    };

    const handlePlatformToggle = (platform: Platform, enabled: boolean): void => {
        if (!connectedPlatforms.includes(platform)) return;
        const nextPlatforms = enabled
            ? Array.from(new Set([...enabledPlatforms, platform]))
            : enabledPlatforms.filter((item) => item !== platform);
        setEnabledPlatforms(nextPlatforms);
        savePlatformMutation.mutate({ enabled_platforms: nextPlatforms });
    };

    const handleListeningModeChange = (mode: ListeningMode): void => {
        if (mode === listeningMode || setListeningModeMutation.isPending) return;
        setListeningMode(mode);
        setListeningModeMutation.mutate(mode);
    };

    const handleEngineChange = (engine: EngineType): void => {
        if (engine === selectedEngine || isEngineBusy) return;
        if (engine === 'f5_local' && !hasLocalSetup) {
            toast.error('Сначала настройте Self Hosted TTS.');
            return;
        }
        setSelectedEngine(engine);
        setEngineMutation.mutate(engine);
    };

    const handleTtsToggle = (): void => {
        if (!toggleTtsMutation.isPending) toggleTtsMutation.mutate(!isEnabled);
    };

    const handleModeChange = (nextMode: TriggerMode): void => {
        setTtsMode(nextMode);
        saveModeMutation.mutate({ tts_mode: nextMode });
    };

    const handleGcloudVoiceChange = (voiceName: string): void => {
        setSelectedGcloudVoice(voiceName);
        saveSettingsMutation.mutate({
            advancedProvider: 'gcloud',
            gcloudVoices: voiceName ? [voiceName] : [],
            gcloudMood,
        });
    };

    const handleGcloudMoodChange = (mood: 'neutral' | 'sad' | 'happy'): void => {
        setGcloudMood(mood);
        saveSettingsMutation.mutate({
            advancedProvider: 'gcloud',
            gcloudVoices: selectedGcloudVoice ? [selectedGcloudVoice] : [],
            gcloudMood: mood,
        });
    };

    const handleAddForbiddenWord = (): void => {
        const word = newForbiddenWord.trim();
        if (!word || addFilteredWordMutation.isPending) return;
        addFilteredWordMutation.mutate({ word }, { onSuccess: () => setNewForbiddenWord('') });
    };

    const handleAddBlockedUser = (): void => {
        const username = blockedUsername.trim();
        if (!username || blockUserMutation.isPending) return;
        blockUserMutation.mutate(
            { username, platform: blockedPlatform },
            { onSuccess: () => setBlockedUsername('') }
        );
    };

    const handleCopyUrl = async (url: string): Promise<void> => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Ссылка скопирована');
        } catch {
            toast.error('Не удалось скопировать ссылку');
        }
    };

    const renderToggle = (label: string, checked: boolean, onChange: (value: boolean) => void) => (
        <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/35 px-3">
            <span className="text-sm font-bold text-foreground">{label}</span>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );

    return (
        <PageWrapper contentClassName="space-y-3">
            <Card className="card-glass border-border/70">
                <CardContent className="flex items-center justify-between gap-4 p-3.5">
                    <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-muted-foreground/45'}`} />
                        <div className="text-base font-bold text-foreground">Озвучка сообщений</div>
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={handleTtsToggle} disabled={toggleTtsMutation.isPending} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-3">
                <div className="min-w-0">
                    <Card className="card-glass flex h-full min-h-[388px] flex-col border-border/70">
                        <CardHeader className="border-b border-white/5 px-3.5 pb-2.5 pt-3.5">
                            <CardTitle className="text-base font-bold">Озвучка</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden p-3.5">
                            <TtsChannelPointsMode
                                ttsMode={ttsMode}
                                onModeChange={handleModeChange}
                                isSaving={isModeSaving}
                            />

                            <div className="grid grid-cols-3 gap-2">
                                {(Object.entries(ENGINE_COPY) as Array<[EngineType, (typeof ENGINE_COPY)[EngineType]]>).map(
                                    ([engine, meta]) => {
                                        const disabled = engine === 'f5_local' && !hasLocalSetup;
                                        const active = selectedEngine === engine;
                                        return (
                                            <button
                                                key={engine}
                                                type="button"
                                                onClick={() => handleEngineChange(engine)}
                                                disabled={disabled || isEngineBusy}
                                                className={`h-10 rounded-lg border px-3 text-left text-sm font-bold transition-colors ${
                                                    active
                                                        ? 'border-sky-500/60 bg-sky-500/10 text-sky-50'
                                                        : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                                                } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                                            >
                                                {meta.label}
                                            </button>
                                        );
                                    }
                                )}
                            </div>

                            <div className="grid grid-cols-[118px_minmax(0,1fr)] items-center gap-3">
                                <div className="text-sm font-bold leading-tight text-foreground">Режим подключения</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['website', 'obs'] as ListeningMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleListeningModeChange(mode)}
                                            disabled={setListeningModeMutation.isPending}
                                            className={`h-10 rounded-lg border px-3 text-sm font-bold transition-colors ${
                                                listeningMode === mode
                                                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-50'
                                                    : 'border-border/70 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground'
                                            }`}
                                        >
                                            {mode === 'website' ? 'Браузер' : 'OBS'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex min-h-[112px] flex-1">
                                {listeningMode === 'obs' ? (
                                    <div className="w-full space-y-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                                        <TooltipProvider delayDuration={150}>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                    <span>Док-панель OBS</span>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button type="button" className="rounded-full text-muted-foreground transition-colors hover:text-foreground">
                                                                <Info className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                                            {OBS_DOCK_HELP}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input value={obsDockUrl || 'Ссылка док-панели OBS пока недоступна'} readOnly className="h-9 min-w-0 font-mono text-xs" />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => void handleCopyUrl(obsDockUrl)}
                                                        aria-label="Скопировать ссылку док-панели OBS"
                                                        disabled={!obsDockUrl}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                    <span>Источник звука OBS</span>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button type="button" className="rounded-full text-muted-foreground transition-colors hover:text-foreground">
                                                                <Info className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                                            {OBS_AUDIO_HELP}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input value={obsSourceUrl || 'Ссылка источника звука OBS пока недоступна'} readOnly className="h-9 min-w-0 font-mono text-xs" />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => void handleCopyUrl(obsSourceUrl)}
                                                        aria-label="Скопировать ссылку источника звука OBS"
                                                        disabled={!obsSourceUrl}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </TooltipProvider>
                                        <div className="flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-2.5 py-1">
                                                <span className={`h-2.5 w-2.5 rounded-full ${obsStatus.dock_connected ? 'bg-emerald-400' : 'bg-muted-foreground/45'}`} />
                                                OBS dock
                                            </span>
                                            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-2.5 py-1">
                                                <span className={`h-2.5 w-2.5 rounded-full ${obsStatus.source_connected ? 'bg-emerald-400' : 'bg-muted-foreground/45'}`} />
                                                OBS audio
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <div className="flex w-full flex-col items-center justify-center gap-3 text-center">
                                            <div className="order-2 font-brand text-base font-bold leading-tight text-emerald-100">
                                                Начать слушать чат
                                            </div>
                                            <a
                                                href="/tts/player"
                                                target="_blank"
                                                rel="noreferrer"
                                                aria-label="Открыть TTS Player"
                                                title="Открыть TTS Player"
                                                className="order-1 inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 text-emerald-100 shadow-lg shadow-emerald-950/30 transition-colors hover:bg-emerald-500/30"
                                            >
                                                <CirclePlay className="h-7 w-7" />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedEngine === 'gcloud' ? (
                                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
                                    <Select value={selectedGcloudVoice} onValueChange={handleGcloudVoiceChange}>
                                        <SelectTrigger className="h-10 rounded-lg">
                                            <SelectValue placeholder="Голос" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gcloudVoiceOptions.map((voice) => (
                                                <SelectItem key={voice.value} value={voice.value}>
                                                    {voice.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {(['neutral', 'happy', 'sad'] as const).map((mood) => (
                                            <Button
                                                key={mood}
                                                type="button"
                                                variant={gcloudMood === mood ? 'default' : 'secondary'}
                                                onClick={() => handleGcloudMoodChange(mood)}
                                                className="h-10 px-2 text-xs"
                                            >
                                                {mood === 'neutral' ? 'Neutral' : mood === 'happy' ? 'Happy' : 'Sad'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                </div>

                <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                    <Card className="card-glass border-border/70">
                        <CardHeader className="border-b border-white/5 px-3.5 pb-2.5 pt-3.5">
                            <CardTitle className="text-base font-bold">Источники озвучки</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3.5">
                            {platformConfig.map(({ platform, label, Icon }) => {
                                const connected = connectedPlatforms.includes(platform);
                                const enabled = connected && enabledPlatforms.includes(platform);
                                return (
                                    <div
                                        key={platform}
                                        className={`flex h-11 items-center justify-between rounded-lg border border-border/70 bg-background/35 px-3 ${
                                            connected ? '' : 'opacity-40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`h-5 w-5 ${platform === 'twitch' ? 'text-purple-400' : 'text-[#FF4444]'}`} />
                                            <div className="text-sm font-bold text-foreground">{label}</div>
                                        </div>
                                        <Switch
                                            checked={enabled}
                                            onCheckedChange={(value) => handlePlatformToggle(platform, value)}
                                            disabled={!connected || savePlatformMutation.isPending}
                                        />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="card-glass flex min-h-0 flex-col border-border/70">
                        <CardHeader className="border-b border-white/5 px-3.5 pb-2.5 pt-3.5">
                            <CardTitle className="text-base font-bold">Фильтры озвучки</CardTitle>
                        </CardHeader>
                        <CardContent className="grid flex-1 grid-cols-2 content-start gap-2 p-3.5">
                            {renderToggle('Прямые обращения', settingsState.directInteractionsEnabled, saveDirectInteractions)}
                            {renderToggle('Озвучивать команды', !settingsState.skipCommands, (value) =>
                                saveBoolean('skipCommands', !value)
                            )}
                            {renderToggle('Выбор голоса', !settingsState.disableVoiceSelection, (value) =>
                                saveBoolean('disableVoiceSelection', !value)
                            )}
                            {renderToggle('Озвучивать ник отправителя', settingsState.speakSenderName, (value) =>
                                saveBoolean('speakSenderName', value)
                            )}
                            <div className="col-span-2 rounded-lg border border-border/70 bg-background/35 px-3 py-3">
                                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                                    <span>Макс. длина</span>
                                    <span>{settingsState.maxMessageLength} символов</span>
                                </div>
                                <Slider
                                    value={[settingsState.maxMessageLength]}
                                    min={50}
                                    max={250}
                                    step={10}
                                    onValueChange={(values) => handleMaxLengthPreviewChange(values[0])}
                                    onValueCommit={(values) => commitMaxLengthChange(values[0])}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
                <TtsForbiddenWordsCard
                    words={filteredWords}
                    isLoading={filteredWordsLoading}
                    isOpen={forbiddenWordsOpen}
                    newWord={newForbiddenWord}
                    addingWord={addFilteredWordMutation.isPending}
                    formRef={forbiddenWordFormRef}
                    onOpenChange={setForbiddenWordsOpen}
                    onWordChange={setNewForbiddenWord}
                    onAdd={handleAddForbiddenWord}
                    onRemove={(wordId) => deleteFilteredWordMutation.mutate(wordId)}
                />
                <TtsBlockedUsersCard
                    users={blockedUsers}
                    isLoading={blockedUsersLoading}
                    isOpen={blockedUsersOpen}
                    username={blockedUsername}
                    platform={blockedPlatform}
                    addingUser={blockUserMutation.isPending}
                    onOpenChange={setBlockedUsersOpen}
                    onUsernameChange={setBlockedUsername}
                    onPlatformChange={setBlockedPlatform}
                    onAdd={handleAddBlockedUser}
                    onRemove={(blockedUser) =>
                        unblockUserMutation.mutate({
                            username: blockedUser.username,
                            platform: blockedUser.platform,
                            channel_name: blockedUser.channel_name,
                        })
                    }
                />
            </div>
        </PageWrapper>
    );
};

export default TtsMainPage;
