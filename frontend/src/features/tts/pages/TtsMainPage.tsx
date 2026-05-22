import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Cloud, Copy, ExternalLink, Monitor, Sparkles } from 'lucide-react';
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
import { getApiBaseUrl } from '@/shared/utils/urlUtils';

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

const unwrapPayload = <T,>(payload: ApiResponse<T> | T | undefined | null): T | undefined => {
    if (!payload) return undefined;
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
        return (payload as ApiResponse<T>).data;
    }
    return payload as T;
};

const buildTtsObsUrl = (token?: string | null): string => {
    const normalizedToken = (token || '').trim();
    if (!normalizedToken) return '';
    return `${getApiBaseUrl()}/tts-obs/${normalizedToken}`;
};

const ENGINE_COPY: Record<EngineType, { label: string; icon: React.ElementType }> = {
    f5_cloud: { label: 'F5 TTS', icon: Cloud },
    f5_local: { label: 'Self-hosted', icon: Monitor },
    gcloud: { label: 'Google Cloud', icon: Sparkles },
};

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
    const { data: obsUrlResponse, refetch: refetchObsUrl } = useQuery<{ obs_token?: string | null }>({
        queryKey: ['tts', 'obs-url'],
        enabled: Boolean(userId),
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const response = await ttsService.getObsUrl();
            return (
                unwrapPayload<{ obs_token?: string | null }>(
                    response.data as ApiResponse<{ obs_token?: string | null }> | { obs_token?: string | null }
                ) || {}
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

    const connectedPlatforms = useMemo(
        () =>
            platformConfig
                .filter(({ platform }) => (platform === 'twitch' ? integrations.twitch.enabled : integrations.vk.enabled))
                .map(({ platform }) => platform),
        [integrations.twitch.enabled, integrations.vk.enabled]
    );

    useEffect(() => {
        if (!settings) return;
        setSettingsState({
            filterReplies: Boolean(settings.filterReplies ?? settings.filter_replies ?? false),
            filterMentions: Boolean(settings.filterMentions ?? settings.filter_mentions ?? false),
            skipCommands: Boolean(settings.skipCommands ?? settings.skip_commands ?? true),
            disableVoiceSelection: Boolean(settings.disableVoiceSelection ?? settings.disable_voice_selection ?? false),
            speakSenderName: Boolean(settings.speakSenderName ?? settings.speak_sender_name ?? false),
            maxMessageLength: Math.max(50, Math.min(250, Number(settings.maxMessageLength ?? settings.max_message_length ?? 150))),
        });
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
    const isSaving = saveSettingsMutation.isPending || savePlatformMutation.isPending || saveModeMutation.isPending;
    const isEngineBusy = setEngineMutation.isPending;
    const isEnabled = Boolean(status?.enabled);
    const hasLocalSetup = Boolean(status?.has_local_setup_f5 || status?.has_local_setup);
    const obsUrl = buildTtsObsUrl(obsUrlResponse?.obs_token);

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

    const handleMaxLengthChange = (value: number): void => {
        const nextValue = Math.max(50, Math.min(250, Number.isFinite(value) ? Math.round(value) : 150));
        setSettingsState((prev) => ({ ...prev, maxMessageLength: nextValue }));
        saveSettingsMutation.mutate({ maxMessageLength: nextValue });
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
            toast.error('Сначала настройте локальный F5 на вкладке Self-Host.');
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

    const handleGenerateObsUrl = async (): Promise<void> => {
        try {
            await ttsService.generateObsUrl();
            await refetchObsUrl();
            toast.success('OBS source создан');
        } catch {
            toast.error('Не удалось создать OBS source');
        }
    };

    const handleCopyObsUrl = async (): Promise<void> => {
        if (!obsUrl) return;
        try {
            await navigator.clipboard.writeText(obsUrl);
            toast.success('Ссылка скопирована');
        } catch {
            toast.error('Не удалось скопировать ссылку');
        }
    };

    const renderToggle = (label: string, checked: boolean, onChange: (value: boolean) => void) => (
        <div className="flex h-12 items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/35 px-3">
            <span className="text-sm font-bold text-foreground">{label}</span>
            <Switch checked={checked} onCheckedChange={onChange} disabled={saveSettingsMutation.isPending} />
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

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
                <div className="space-y-3">
                    <Card className="card-glass border-border/70">
                        <CardHeader className="border-b border-white/5 pb-3">
                            <CardTitle className="text-base font-bold">Озвучка</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[360px] space-y-3.5 overflow-y-auto p-4">
                            <TtsChannelPointsMode
                                ttsMode={ttsMode}
                                onModeChange={handleModeChange}
                                isSaving={isSaving}
                            />

                            <div className="grid gap-2 sm:grid-cols-3">
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
                                                className={`h-11 rounded-lg border px-3 text-left text-sm font-bold transition-colors ${
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

                            <div className="grid gap-3 md:grid-cols-[128px_minmax(0,1fr)] md:items-center">
                                <div className="text-sm font-bold leading-tight text-foreground">Режим подключения</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['website', 'obs'] as ListeningMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleListeningModeChange(mode)}
                                            disabled={setListeningModeMutation.isPending}
                                            className={`h-11 rounded-lg border px-3 text-sm font-bold transition-colors ${
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

                            <div className="min-h-[96px]">
                                {listeningMode === 'obs' ? (
                                    <div className="space-y-3 rounded-lg border border-border/70 bg-background/35 p-3">
                                        <div className="flex items-center gap-2">
                                            <Input value={obsUrl || 'OBS source не создан'} readOnly className="h-9 min-w-0 font-mono text-xs" />
                                            {obsUrl ? (
                                                <Button type="button" variant="outline" size="icon" onClick={() => void handleCopyObsUrl()}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => void handleGenerateObsUrl()}>
                                                    Создать
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1">
                                                <span className={`h-2.5 w-2.5 rounded-full ${obsStatus.source_connected ? 'bg-emerald-400' : 'bg-muted-foreground/45'}`} />
                                                OBS Source
                                            </span>
                                            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1">
                                                <span className={`h-2.5 w-2.5 rounded-full ${obsStatus.dock_connected ? 'bg-emerald-400' : 'bg-muted-foreground/45'}`} />
                                                Док-панель
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        <a
                                            href="/tts/player"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-400/60 bg-emerald-500/15 px-4 text-sm font-bold text-emerald-100 transition-colors hover:bg-emerald-500/25"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Открыть TTS Player
                                        </a>
                                    </div>
                                )}
                            </div>

                            {selectedEngine === 'gcloud' ? (
                                <div className="grid gap-3 rounded-lg border border-border/70 bg-background/35 p-3 md:grid-cols-2">
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

                <div className="space-y-3">
                    <Card className="card-glass border-border/70">
                        <CardHeader className="border-b border-white/5 pb-3">
                            <CardTitle className="text-base font-bold">Источники озвучки</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2.5 p-4">
                            {platformConfig.map(({ platform, label, Icon }) => {
                                const connected = connectedPlatforms.includes(platform);
                                const enabled = connected && enabledPlatforms.includes(platform);
                                return (
                                    <div
                                        key={platform}
                                        className={`flex items-center justify-between rounded-lg border border-border/70 bg-background/35 px-4 py-3 ${
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

                    <Card className="card-glass border-border/70">
                        <CardHeader className="border-b border-white/5 pb-3">
                            <CardTitle className="text-base font-bold">Фильтры озвучки</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
                            {renderToggle('Озвучивать упоминания', !settingsState.filterMentions, (value) =>
                                saveBoolean('filterMentions', !value)
                            )}
                            {renderToggle('Озвучивать ответы', !settingsState.filterReplies, (value) =>
                                saveBoolean('filterReplies', !value)
                            )}
                            {renderToggle('Озвучивать команды', !settingsState.skipCommands, (value) =>
                                saveBoolean('skipCommands', !value)
                            )}
                            {renderToggle('Выбор голоса', !settingsState.disableVoiceSelection, (value) =>
                                saveBoolean('disableVoiceSelection', !value)
                            )}
                            {renderToggle('Озвучивать ник отправителя', settingsState.speakSenderName, (value) =>
                                saveBoolean('speakSenderName', value)
                            )}
                            <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-3 sm:col-span-2">
                                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                                    <span>Макс. длина</span>
                                    <span>{settingsState.maxMessageLength} символов</span>
                                </div>
                                <Slider
                                    value={[settingsState.maxMessageLength]}
                                    min={50}
                                    max={250}
                                    step={10}
                                    onValueChange={(values) => handleMaxLengthChange(values[0])}
                                    disabled={saveSettingsMutation.isPending}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid items-start gap-3 xl:grid-cols-2">
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
