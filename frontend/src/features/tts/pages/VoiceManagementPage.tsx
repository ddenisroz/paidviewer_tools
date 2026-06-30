import React, { useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, Settings2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { useWhitelistStatus } from '@/queries/tts/ttsQueries';
import { ttsService } from '@/services/api/services/ttsService';
import {
    deleteUserVoice,
    getGlobalVoices,
    getUserVoices,
    testVoice,
    updateUserVoiceSettings,
    uploadUserVoice,
} from '@/services/unified-api';
import PageWrapper from '@/shared/components/PageWrapper';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { resolveAudioUrl } from '@/shared/utils/urlUtils';

import type { TtsVoice } from '@/types/tts';

type SpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
const SPEED_PRESET_ORDER: SpeedPreset[] = ['very_slow', 'slow', 'normal', 'fast', 'very_fast'];

interface EnabledVoicesPayload {
    enabled_voice_ids?: number[];
    data?: number[];
}

interface WhitelistPayload {
    is_whitelisted?: boolean;
    can_manage_voices?: boolean;
    message?: string;
}

const SPEED_LABELS: Record<SpeedPreset, string> = {
    very_slow: 'Очень медленно',
    slow: 'Медленно',
    normal: 'Обычно',
    fast: 'Быстро',
    very_fast: 'Очень быстро',
};

const DEFAULT_PREVIEW_TEXT = 'Привет! Это проверка голоса в F5 TTS.';
const VOICE_CARD_CLASS =
    'group rounded-xl border border-border/70 bg-[linear-gradient(180deg,rgba(20,26,38,0.92),rgba(14,17,27,0.96))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-sky-400/45 hover:bg-[linear-gradient(180deg,rgba(24,31,46,0.96),rgba(14,17,27,0.98))]';

const unwrapVoiceList = (payload: unknown): TtsVoice[] => {
    if (Array.isArray(payload)) return payload as TtsVoice[];
    if (payload && typeof payload === 'object') {
        const candidate = payload as { data?: unknown; voices?: unknown };
        if (Array.isArray(candidate.data)) return candidate.data as TtsVoice[];
        if (Array.isArray(candidate.voices)) return candidate.voices as TtsVoice[];
    }
    return [];
};

const getVoiceSpeed = (voice: TtsVoice): SpeedPreset =>
    (voice.user_settings?.speed_preset || voice.speed_preset || 'normal') as SpeedPreset;

const getVoiceCfg = (voice: TtsVoice): number => Number(voice.user_settings?.cfg_strength ?? voice.cfg_strength ?? 2.5);
const getSpeedPresetIndex = (speed: SpeedPreset): number => Math.max(0, SPEED_PRESET_ORDER.indexOf(speed));
const getSpeedPresetByIndex = (index: number): SpeedPreset =>
    SPEED_PRESET_ORDER[Math.max(0, Math.min(SPEED_PRESET_ORDER.length - 1, Math.round(index)))] || 'normal';
const serializeVoiceSettings = (cfg: number, speed: SpeedPreset, text: string): string =>
    JSON.stringify({
        cfg: Number(cfg.toFixed(1)),
        speed,
        text: text.trim(),
    });

const VoiceCard: React.FC<{
    voice: TtsVoice;
    inPool: boolean;
    isMine: boolean;
    isMutating: boolean;
    onTogglePool: (voiceId: number, inPool: boolean) => void;
    onPlay: (voice: TtsVoice) => void;
    onSettings: (voice: TtsVoice) => void;
    onDelete?: (voice: TtsVoice) => void;
}> = ({ voice, inPool, isMine, isMutating, onTogglePool, onPlay, onSettings, onDelete }) => (
    <div className={VOICE_CARD_CLASS}>
        <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-foreground">{voice.name}</span>
                    <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                        {isMine ? 'Мой' : 'F5'}
                    </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-md border border-border/60 bg-background/55 px-1.5 py-0.5">
                        {SPEED_LABELS[getVoiceSpeed(voice)]}
                    </span>
                    <span className="rounded-md border border-border/60 bg-background/55 px-1.5 py-0.5">
                        CFG {getVoiceCfg(voice).toFixed(1)}
                    </span>
                </div>
            </div>
            <Switch checked={inPool} onCheckedChange={() => onTogglePool(voice.id, inPool)} disabled={isMutating} />
        </div>

        <div className={`mt-3 grid ${isMine ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]'} gap-2`}>
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-start gap-2 border-border/70 bg-card/70 px-2.5"
                onClick={() => onSettings(voice)}
            >
                <Settings2 className="h-3.5 w-3.5" />
                Настройки
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => onPlay(voice)}>
                <Play className="h-3.5 w-3.5" />
            </Button>
            {isMine && onDelete ? (
                <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 text-red-300 hover:text-red-200"
                    onClick={() => onDelete(voice)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            ) : null}
        </div>
    </div>
);

const VoiceSection: React.FC<{
    title: string;
    voices: TtsVoice[];
    enabledVoiceIds: number[];
    isMine: boolean;
    isLoading: boolean;
    isMutating: boolean;
    emptyLabel: string;
    action?: React.ReactNode;
    onTogglePool: (voiceId: number, inPool: boolean) => void;
    onPlay: (voice: TtsVoice) => void;
    onSettings: (voice: TtsVoice) => void;
    onDelete?: (voice: TtsVoice) => void;
}> = ({
    title,
    voices,
    enabledVoiceIds,
    isMine,
    isLoading,
    isMutating,
    emptyLabel,
    action,
    onTogglePool,
    onPlay,
    onSettings,
    onDelete,
}) => (
    <Card className="border-border/70 bg-card/85">
        <CardHeader className="border-b border-white/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base font-bold">{title}</CardTitle>
                {action}
            </div>
        </CardHeader>
        <CardContent className="p-4">
            {isLoading ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Загрузка...
                </div>
            ) : voices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    {emptyLabel}
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                    {voices.map((voice) => (
                        <VoiceCard
                            key={`${isMine ? 'user' : 'global'}-${voice.id}`}
                            voice={voice}
                            inPool={enabledVoiceIds.includes(voice.id)}
                            isMine={isMine}
                            isMutating={isMutating}
                            onTogglePool={onTogglePool}
                            onPlay={onPlay}
                            onSettings={onSettings}
                            onDelete={isMine ? onDelete : undefined}
                        />
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
);

const VoiceManagementPage: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const queryClient = useQueryClient();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const settingsSaveTimeoutRef = useRef<number | null>(null);
    const savedSettingsRef = useRef('');

    const [uploadOpen, setUploadOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<TtsVoice | null>(null);
    const [voiceName, setVoiceName] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadNameTouched, setUploadNameTouched] = useState(false);
    const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
    const [settingsCfg, setSettingsCfg] = useState(2.5);
    const [settingsSpeed, setSettingsSpeed] = useState<SpeedPreset>('normal');

    const { data: whitelistResponse, refetch: refetchWhitelist } = useWhitelistStatus({ enabled: Boolean(userId) });
    const whitelist = ((whitelistResponse as { data?: WhitelistPayload })?.data || whitelistResponse) as
        | WhitelistPayload
        | undefined;
    const canManageVoices = Boolean(userId);

    const {
        data: globalVoices = [],
        isLoading: isLoadingGlobal,
        refetch: refetchGlobalVoices,
    } = useQuery<TtsVoice[]>({
        queryKey: ['tts', 'voice-management', 'global'],
        enabled: canManageVoices,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const response = await getGlobalVoices('f5');
            return unwrapVoiceList(response.data);
        },
    });

    const { data: userVoices = [], isLoading: isLoadingUser, refetch: refetchUserVoices } = useQuery<TtsVoice[]>({
        queryKey: ['tts', 'voice-management', 'user', userId],
        enabled: canManageVoices && Boolean(userId),
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            if (!userId) return [];
            const response = await getUserVoices(userId, 'f5');
            return unwrapVoiceList(response.data);
        },
    });

    const { data: enabledVoiceIds = [], refetch: refetchEnabledVoices } = useQuery<number[]>({
        queryKey: ['tts', 'voice-management', 'enabled', userId],
        enabled: canManageVoices && Boolean(userId),
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            if (!userId) return [];
            const response = await ttsService.getEnabledVoices(userId, 'f5');
            const payload = response.data as EnabledVoicesPayload;
            return payload.enabled_voice_ids || payload.data || [];
        },
    });

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            if (settingsSaveTimeoutRef.current !== null) {
                window.clearTimeout(settingsSaveTimeoutRef.current);
            }
        };
    }, []);

    const resetUploadForm = (): void => {
        setVoiceName('');
        setUploadFile(null);
        setUploadNameTouched(false);
    };

    const trimmedVoiceName = voiceName.trim();
    const uploadNameError = uploadNameTouched && !trimmedVoiceName;

    const openVoiceSettings = (voice: TtsVoice): void => {
        const cfg = getVoiceCfg(voice);
        const speed = getVoiceSpeed(voice);
        const text = voice.reference_text || DEFAULT_PREVIEW_TEXT;
        setSelectedVoice(voice);
        setSettingsCfg(cfg);
        setSettingsSpeed(speed);
        setPreviewText(text);
        savedSettingsRef.current = serializeVoiceSettings(cfg, speed, text);
        setSettingsOpen(true);
    };

    const uploadVoiceMutation = useMutation({
        mutationFn: async () => {
            if (!userId || !uploadFile || !trimmedVoiceName) {
                throw new Error('Укажите имя и файл.');
            }
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('name', trimmedVoiceName);
            return uploadUserVoice(userId, formData, 'f5');
        },
        onSuccess: async () => {
            resetUploadForm();
            setUploadOpen(false);
            await Promise.all([refetchUserVoices(), refetchEnabledVoices()]);
            toast.success('Голос загружен');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Не удалось загрузить голос');
        },
    });

    const togglePoolMutation = useMutation({
        mutationFn: async ({ voiceId, inPool }: { voiceId: number; inPool: boolean }) => {
            if (!userId) throw new Error('Пользователь не найден.');
            const nextIds = inPool
                ? enabledVoiceIds.filter((id) => id !== voiceId)
                : Array.from(new Set([...enabledVoiceIds, voiceId]));
            await ttsService.saveEnabledVoices(userId, nextIds, 'f5');
            return nextIds;
        },
        onMutate: async ({ voiceId, inPool }) => {
            if (!userId) return { previousIds: enabledVoiceIds };
            await queryClient.cancelQueries({ queryKey: ['tts', 'voice-management', 'enabled', userId] });
            const previousIds = queryClient.getQueryData<number[]>(['tts', 'voice-management', 'enabled', userId]) || [];
            const nextIds = inPool
                ? previousIds.filter((id) => id !== voiceId)
                : Array.from(new Set([...previousIds, voiceId]));
            queryClient.setQueryData(['tts', 'voice-management', 'enabled', userId], nextIds);
            return { previousIds };
        },
        onError: (_error, _variables, context) => {
            if (userId) {
                queryClient.setQueryData(['tts', 'voice-management', 'enabled', userId], context?.previousIds || []);
            }
            toast.error('Не удалось обновить пул');
        },
        onSettled: async () => {
            await refetchEnabledVoices();
        },
    });

    const deleteVoiceMutation = useMutation({
        mutationFn: async (voice: TtsVoice) => {
            if (!userId) throw new Error('Пользователь не найден.');
            await deleteUserVoice(String(voice.id), userId, 'f5');
        },
        onSuccess: async () => {
            await Promise.all([refetchUserVoices(), refetchEnabledVoices()]);
            toast.success('Голос удален');
        },
        onError: () => {
            toast.error('Не удалось удалить голос');
        },
    });

    const playVoiceMutation = useMutation({
        mutationFn: async (voice: TtsVoice) => {
            const response = await testVoice(voice.id, previewText, 'f5', {
                cfg_strength: selectedVoice?.id === voice.id ? settingsCfg : getVoiceCfg(voice),
                speed_preset: selectedVoice?.id === voice.id ? settingsSpeed : getVoiceSpeed(voice),
            });
            const payload = response.data as { data?: { audio_url?: string }; audio_url?: string };
            const audioUrl = payload.data?.audio_url || payload.audio_url;
            if (!audioUrl) throw new Error('Сервис не вернул аудио.');
            return resolveAudioUrl(audioUrl);
        },
        onSuccess: async (audioUrl) => {
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            await audio.play();
        },
        onError: () => {
            toast.error('Не удалось воспроизвести голос');
        },
    });

    const saveSettingsMutation = useMutation({
        mutationFn: async (payload: {
            voiceId: number;
            cfgStrength: number;
            speedPreset: SpeedPreset;
            referenceText: string;
        }) => {
            if (!userId) throw new Error('Голос не выбран.');
            return updateUserVoiceSettings(
                payload.voiceId,
                userId,
                {
                    cfg_strength: payload.cfgStrength,
                    speed_preset: payload.speedPreset,
                    reference_text: payload.referenceText.trim() || undefined,
                },
                'f5'
            );
        },
        onSuccess: async (_response, variables) => {
            savedSettingsRef.current = serializeVoiceSettings(
                variables.cfgStrength,
                variables.speedPreset,
                variables.referenceText
            );
            await Promise.all([refetchGlobalVoices(), refetchUserVoices(), refetchEnabledVoices()]);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки');
        },
    });

    const saveVoiceSettings = (nextCfg: number, nextSpeed: SpeedPreset, nextText: string): void => {
        if (!selectedVoice || !userId) return;
        const serialized = serializeVoiceSettings(nextCfg, nextSpeed, nextText);
        if (serialized === savedSettingsRef.current || saveSettingsMutation.isPending) return;
        saveSettingsMutation.mutate({
            voiceId: selectedVoice.id,
            cfgStrength: nextCfg,
            speedPreset: nextSpeed,
            referenceText: nextText,
        });
    };

    const scheduleVoiceSettingsSave = (nextCfg: number, nextSpeed: SpeedPreset, nextText: string, delayMs = 450): void => {
        if (settingsSaveTimeoutRef.current !== null) {
            window.clearTimeout(settingsSaveTimeoutRef.current);
        }
        settingsSaveTimeoutRef.current = window.setTimeout(() => {
            saveVoiceSettings(nextCfg, nextSpeed, nextText);
            settingsSaveTimeoutRef.current = null;
        }, delayMs);
    };

    const isMutating =
        uploadVoiceMutation.isPending ||
        togglePoolMutation.isPending ||
        deleteVoiceMutation.isPending ||
        saveSettingsMutation.isPending;

    const handleUploadSubmit = (): void => {
        setUploadNameTouched(true);
        if (!trimmedVoiceName) {
            toast.error('Введите название голоса');
            return;
        }
        if (!uploadFile) {
            toast.error('Выберите файл голоса');
            return;
        }
        uploadVoiceMutation.mutate();
    };

    if (!canManageVoices) {
        return (
            <PageWrapper contentClassName="space-y-3">
                <Card className="border-border/70 bg-card/85">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="text-sm font-bold text-foreground">
                            {whitelist?.message || 'Войдите в аккаунт, чтобы управлять голосами'}
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => void refetchWhitelist()}>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Обновить
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper contentClassName="space-y-3">
            <div className="space-y-3">
                <VoiceSection
                    title="Глобальные голоса"
                    voices={globalVoices}
                    enabledVoiceIds={enabledVoiceIds}
                    isMine={false}
                    isLoading={isLoadingGlobal}
                    isMutating={isMutating}
                    emptyLabel="Глобальных голосов нет"
                    onTogglePool={(voiceId, inPool) => togglePoolMutation.mutate({ voiceId, inPool })}
                    onPlay={(voice) => playVoiceMutation.mutate(voice)}
                    onSettings={openVoiceSettings}
                />
                <VoiceSection
                    title="Мои голоса"
                    voices={userVoices}
                    enabledVoiceIds={enabledVoiceIds}
                    isMine
                    isLoading={isLoadingUser}
                    isMutating={isMutating}
                    emptyLabel="Загрузите первый голос"
                    action={
                        <Button type="button" size="sm" className="h-8 gap-2" onClick={() => setUploadOpen(true)}>
                            <Upload className="h-4 w-4" />
                            Загрузить голос
                        </Button>
                    }
                    onTogglePool={(voiceId, inPool) => togglePoolMutation.mutate({ voiceId, inPool })}
                    onPlay={(voice) => playVoiceMutation.mutate(voice)}
                    onSettings={openVoiceSettings}
                    onDelete={(voice) => deleteVoiceMutation.mutate(voice)}
                />
            </div>

            <Dialog
                open={uploadOpen}
                onOpenChange={(open) => {
                    setUploadOpen(open);
                    if (!open) resetUploadForm();
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Загрузить голос</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="voice-upload-name">Название голоса</Label>
                            <Input
                                id="voice-upload-name"
                                value={voiceName}
                                onChange={(event) => {
                                    setVoiceName(event.target.value);
                                    if (event.target.value.trim()) setUploadNameTouched(false);
                                }}
                                onBlur={() => setUploadNameTouched(true)}
                                placeholder="Название голоса"
                                className={cn(uploadNameError && 'border-red-500/70 focus-visible:ring-red-500/40')}
                            />
                            {uploadNameError ? <p className="text-xs text-red-300">Введите название голоса</p> : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="voice-upload-file">Файл</Label>
                            <Input
                                id="voice-upload-file"
                                type="file"
                                accept=".wav,.mp3,.flac,.ogg,.m4a,.aac"
                                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                resetUploadForm();
                                setUploadOpen(false);
                            }}
                        >
                            Отмена
                        </Button>
                        <Button type="button" disabled={uploadVoiceMutation.isPending} onClick={handleUploadSubmit}>
                            Загрузить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Настройки голоса</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                            <div className="text-sm font-bold text-foreground">{selectedVoice?.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Параметры применяются к вашему пулу.</div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>CFG</Label>
                                <span className="text-sm font-bold text-foreground">{settingsCfg.toFixed(1)}</span>
                            </div>
                            <Slider
                                value={[settingsCfg]}
                                min={1}
                                max={5}
                                step={0.1}
                                onValueChange={(value) => setSettingsCfg(value[0] ?? 2.5)}
                                onValueCommit={(value) => {
                                    const nextCfg = value[0] ?? 2.5;
                                    setSettingsCfg(nextCfg);
                                    saveVoiceSettings(nextCfg, settingsSpeed, previewText);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Скорость</Label>
                                <span className="text-sm font-bold text-foreground">{SPEED_LABELS[settingsSpeed]}</span>
                            </div>
                            <Slider
                                value={[getSpeedPresetIndex(settingsSpeed)]}
                                min={0}
                                max={SPEED_PRESET_ORDER.length - 1}
                                step={1}
                                onValueChange={(value) => setSettingsSpeed(getSpeedPresetByIndex(value[0] ?? 2))}
                                onValueCommit={(value) => {
                                    const nextSpeed = getSpeedPresetByIndex(value[0] ?? 2);
                                    setSettingsSpeed(nextSpeed);
                                    saveVoiceSettings(settingsCfg, nextSpeed, previewText);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="voice-preview-text">Текст прослушки</Label>
                            <Textarea
                                id="voice-preview-text"
                                value={previewText}
                                onChange={(event) => {
                                    const nextText = event.target.value;
                                    setPreviewText(nextText);
                                    scheduleVoiceSettingsSave(settingsCfg, settingsSpeed, nextText);
                                }}
                                className="min-h-20"
                            />
                        </div>
                    </div>
                    <div className={cn('flex items-center justify-between gap-3 pt-2')}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => selectedVoice && playVoiceMutation.mutate(selectedVoice)}
                            disabled={!selectedVoice || playVoiceMutation.isPending}
                            className="gap-2"
                        >
                            <Play className="h-4 w-4" />
                            Прослушать
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {saveSettingsMutation.isPending ? 'Сохраняем…' : 'Сохранение автоматически'}
                        </span>
                    </div>
                </DialogContent>
            </Dialog>
        </PageWrapper>
    );
};

export default VoiceManagementPage;
