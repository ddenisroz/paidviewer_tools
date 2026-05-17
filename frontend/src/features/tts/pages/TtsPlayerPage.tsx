import React, { useEffect, useRef, useState } from 'react';

import { SkipForward, Square, Volume2 } from 'lucide-react';

import { STORAGE_KEYS } from '@/constants';
import { useTtsPlayer } from '@/context/TtsPlayerContext';
import { useSaveTtsAudioSettings, useTtsAudioSettings } from '@/queries/tts/ttsQueries';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Slider } from '@/shared/components/ui/slider';

type ListeningMode = 'website' | 'obs';

const getStoredListeningMode = (): ListeningMode => {
    if (typeof window === 'undefined') return 'website';
    return window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE) === 'obs' ? 'obs' : 'website';
};

const formatMessage = (text: string, maxLength = 150): string => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
};

const formatQueuedAt = (date: Date): string =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const TtsPlayerPage: React.FC = () => {
    const {
        queue,
        currentItem,
        isPrimaryPlayerTab,
        isAudioUnlocked,
        clearQueue,
        skipCurrent,
        unlockAudio,
    } = useTtsPlayer();

    const { data: audioSettingsResponse } = useTtsAudioSettings();
    const saveAudioSettingsMutation = useSaveTtsAudioSettings();
    const [listeningMode, setListeningMode] = useState<ListeningMode>(getStoredListeningMode);
    const [websiteVolume, setWebsiteVolume] = useState<number>(50);
    const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const settings = audioSettingsResponse?.data as { websiteVolume?: number } | undefined;
        if (typeof settings?.websiteVolume === 'number') {
            setWebsiteVolume(settings.websiteVolume);
        }
    }, [audioSettingsResponse]);

    useEffect(() => {
        const handleModeChange = (event: CustomEvent<{ mode?: string }>) => {
            setListeningMode(event.detail?.mode === 'obs' ? 'obs' : 'website');
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEYS.TTS_LISTENING_MODE) return;
            setListeningMode(event.newValue === 'obs' ? 'obs' : 'website');
        };

        window.addEventListener('tts-listening-mode-changed', handleModeChange as EventListener);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('tts-listening-mode-changed', handleModeChange as EventListener);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

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
    const canControlPlayback = listeningMode === 'website' && isPrimaryPlayerTab && hasItems;
    const showUnlockOverlay = listeningMode === 'website' && !isAudioUnlocked;

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            {showUnlockOverlay ? (
                <button
                    type="button"
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95"
                    onClick={() => void unlockAudio()}
                >
                    <span className="rounded-xl border border-border/70 bg-card px-5 py-3 text-sm font-bold text-foreground">
                        Включить звук
                    </span>
                </button>
            ) : null}

            <main className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card className="card-glass border-border/70">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">TTS Player</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="destructive"
                                className="h-12 rounded-xl"
                                onClick={clearQueue}
                                disabled={!hasItems}
                            >
                                <Square className="mr-2 h-4 w-4" />
                                Стоп
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="h-12 rounded-xl"
                                onClick={skipCurrent}
                                disabled={!canControlPlayback}
                            >
                                <SkipForward className="mr-2 h-4 w-4" />
                                Скип
                            </Button>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
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
                                disabled={listeningMode !== 'website'}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-glass min-h-[520px] border-border/70">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base">Очередь на озвучку</CardTitle>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
                                {(currentItem ? 1 : 0) + queue.length}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        {!hasItems ? (
                            <div className="flex h-[410px] items-center justify-center rounded-xl border border-dashed border-border/70">
                                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/45" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {currentItem ? (
                                    <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="text-xs font-bold uppercase tracking-wide text-emerald-200">
                                                Играет
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatQueuedAt(currentItem.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-foreground">
                                            {formatMessage(currentItem.text)}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {[currentItem.username, currentItem.platform].filter(Boolean).join(' / ')}
                                        </p>
                                    </div>
                                ) : null}

                                {queue.map((item) => {
                                    const isGenerated = Boolean(item.audioUrl);
                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-xl border border-border/70 bg-background/35 px-4 py-3"
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span
                                                    className={`text-xs font-bold uppercase tracking-wide ${
                                                        isGenerated ? 'text-sky-200' : 'text-amber-200'
                                                    }`}
                                                >
                                                    {isGenerated ? 'Готово' : 'Генерация'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatQueuedAt(item.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-foreground">{formatMessage(item.text)}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {[item.username, item.platform].filter(Boolean).join(' / ')}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default TtsPlayerPage;
