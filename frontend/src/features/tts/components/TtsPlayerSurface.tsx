import React, { useEffect, useRef, useState } from 'react';

import { SkipForward, Square, Volume2 } from 'lucide-react';

import { useTtsPlayer } from '@/context/TtsPlayerContext';
import { useSaveTtsAudioSettings, useTtsAudioSettings } from '@/queries/tts/ttsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Slider } from '@/shared/components/ui/slider';

type TtsPlayerSurfaceVariant = 'full' | 'dock';

interface TtsPlayerSurfaceProps {
    variant?: TtsPlayerSurfaceVariant;
}

const STATUS_CLASS: Record<string, string> = {
    not_voiced: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    failed: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    queued: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    playing: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    played: 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100',
};

const STATUS_LABEL: Record<string, string> = {
    not_voiced: 'Не озвучено',
    failed: 'Не озвучено',
    queued: 'Ждет',
    playing: 'Ждет',
    played: 'Озвучено',
};

const formatMessage = (text: string, maxLength = 180): string => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
};

const formatQueuedAt = (date: Date): string =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const TtsPlayerSurface: React.FC<TtsPlayerSurfaceProps> = ({ variant = 'full' }) => {
    const {
        liveMessages,
        currentItem,
        queue,
        isAudioUnlocked,
        isPrimaryPlayerTab,
        isSocketConnected,
        clearQueue,
        skipCurrent,
        unlockAudio,
    } = useTtsPlayer();

    const { data: audioSettingsResponse } = useTtsAudioSettings();
    const saveAudioSettingsMutation = useSaveTtsAudioSettings();
    const [websiteVolume, setWebsiteVolume] = useState<number>(50);
    const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const settings = audioSettingsResponse?.data as { websiteVolume?: number } | undefined;
        if (typeof settings?.websiteVolume === 'number') {
            setWebsiteVolume(settings.websiteVolume);
        }
    }, [audioSettingsResponse]);

    useEffect(() => {
        return () => {
            if (volumeDebounceRef.current) {
                clearTimeout(volumeDebounceRef.current);
            }
        };
    }, []);

    const handleVolumeChange = (value: number): void => {
        setWebsiteVolume(value);
        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }
        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ websiteVolume: value });
        }, 250);
    };

    const hasItems = Boolean(currentItem) || queue.length > 0;
    const compact = variant === 'dock';
    const messages = liveMessages.slice(0, compact ? 18 : 28);

    return (
        <main className={compact ? 'mx-auto grid w-full max-w-[520px] gap-3 p-3' : 'mx-auto grid w-full max-w-5xl gap-4 p-4'}>
            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">TTS Player</CardTitle>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            <span className={`h-2.5 w-2.5 rounded-full ${isSocketConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {isSocketConnected ? 'online' : 'offline'}
                            {isPrimaryPlayerTab ? <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> : null}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className={compact ? 'space-y-3 p-3' : 'grid gap-3 p-4 md:grid-cols-[auto_minmax(260px,1fr)_auto]'}>
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="destructive" className="h-10" onClick={clearQueue} disabled={!hasItems}>
                            <Square className="mr-2 h-4 w-4" />
                            Стоп
                        </Button>
                        <Button type="button" variant="secondary" className="h-10" onClick={skipCurrent} disabled={!hasItems}>
                            <SkipForward className="mr-2 h-4 w-4" />
                            Скип
                        </Button>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                                <Volume2 className="h-4 w-4 text-emerald-300" />
                                Громкость
                            </span>
                            <span className="text-sm font-bold text-foreground">{websiteVolume}%</span>
                        </div>
                        <Slider
                            value={[websiteVolume]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(values) => handleVolumeChange(values[0])}
                        />
                    </div>

                    {!isAudioUnlocked ? (
                        <Button type="button" variant="outline" className="h-10" onClick={() => void unlockAudio()}>
                            Включить звук
                        </Button>
                    ) : null}
                </CardContent>
            </Card>

            <Card className="card-glass border-border/70">
                <CardHeader className="border-b border-white/5 pb-3">
                    <CardTitle className="text-base">Сообщения чата</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                    {messages.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
                            Жду сообщения
                        </div>
                    ) : (
                        messages.map((message) => {
                            const statusClass = STATUS_CLASS[message.status] || STATUS_CLASS.not_voiced;
                            const statusLabel = STATUS_LABEL[message.status] || STATUS_LABEL.not_voiced;
                            return (
                                <div key={message.id} className={`rounded-lg border px-3 py-2 ${statusClass}`}>
                                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                                        <span className="truncate font-bold">
                                            {[message.username, message.platform].filter(Boolean).join(' / ') || 'чат'}
                                        </span>
                                        <span className="shrink-0">{formatQueuedAt(message.timestamp)}</span>
                                    </div>
                                    <p className="text-sm font-semibold">{formatMessage(message.text, compact ? 120 : 180)}</p>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wide opacity-80">{statusLabel}</div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </main>
    );
};

export default TtsPlayerSurface;
