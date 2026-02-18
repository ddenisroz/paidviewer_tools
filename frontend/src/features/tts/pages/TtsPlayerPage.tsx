import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Pause, Play, SkipForward, Square, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const formatMessage = (text: string, maxLength: number = 180): string => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
};

const TtsPlayerPage: React.FC = () => {
    const {
        queue,
        currentItem,
        isPlaying,
        isPaused,
        isPrimaryPlayerTab,
        isAudioUnlocked,
        clearQueue,
        skipCurrent,
        playFromQueue,
        togglePause,
        requestPrimaryPlayerTab,
        unlockAudio
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
            const mode = event.detail?.mode === 'obs' ? 'obs' : 'website';
            setListeningMode(mode);
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEYS.TTS_LISTENING_MODE) return;
            const mode = event.newValue === 'obs' ? 'obs' : 'website';
            setListeningMode(mode);
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

    const queueCountLabel = useMemo(() => {
        if (!currentItem && queue.length === 0) return 'Empty';
        if (queue.length === 0) return 'No queue';
        return `${queue.length} queued`;
    }, [currentItem, queue.length]);

    const canControlPlayback = Boolean(currentItem) && listeningMode === 'website' && isPrimaryPlayerTab;
    const showUnlockOverlay = listeningMode === 'website' && !isAudioUnlocked;

    return (
        <div className="relative min-h-screen bg-background p-4 sm:p-6">
            {showUnlockOverlay && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-background/88 backdrop-blur-sm"
                    onPointerDown={() => void unlockAudio()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void unlockAudio();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Активировать звук TTS плеера"
                >
                    <div className="mx-4 w-full max-w-md rounded-xl border border-border/80 bg-card/95 p-5 text-center shadow-xl">
                        <p className="text-base font-semibold text-foreground">Активируйте звук</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Нажмите в любом месте, чтобы разрешить воспроизведение TTS в браузере.
                        </p>
                    </div>
                </div>
            )}
            <div className="mx-auto w-full max-w-5xl">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
                    <Card className="card-glass lg:col-span-2 lg:min-h-[520px]">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base sm:text-lg">TTS Player</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 lg:space-y-5">
                            {listeningMode === 'obs' && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                    OBS mode is active. Switch mode in <Link to="/dashboard/tts" className="underline">TTS settings</Link>.
                                </div>
                            )}

                            {listeningMode === 'website' && !isPrimaryPlayerTab && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                    Another TTS Player tab is active.
                                    <button
                                        type="button"
                                        onClick={requestPrimaryPlayerTab}
                                        className="ml-2 underline"
                                    >
                                        Take control
                                    </button>
                                </div>
                            )}

                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <p className="text-xs text-muted-foreground">{queueCountLabel}</p>
                                <p className="mt-1 break-words text-sm text-foreground">
                                    {currentItem ? formatMessage(currentItem.text) : 'Waiting for messages...'}
                                </p>
                                {currentItem && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {currentItem.username || 'System'}{currentItem.platform ? ` - ${currentItem.platform}` : ''}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={togglePause}
                                    disabled={!canControlPlayback}
                                    className="w-full"
                                >
                                    {isPaused || !isPlaying ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}
                                    {isPaused || !isPlaying ? 'Play' : 'Pause'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={skipCurrent}
                                    disabled={!canControlPlayback}
                                    className="w-full"
                                >
                                    <SkipForward className="mr-1 h-4 w-4" />
                                    Skip
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={clearQueue}
                                    disabled={!currentItem && queue.length === 0}
                                    className="w-full"
                                >
                                    <Square className="mr-1 h-4 w-4" />
                                    Stop
                                </Button>
                            </div>

                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                        <Volume2 className="h-3.5 w-3.5" />
                                        Browser volume
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">{websiteVolume}%</span>
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

                    <Card className="card-glass lg:col-span-1 lg:min-h-[520px]">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Queue ({queue.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 lg:max-h-[440px] lg:overflow-y-auto lg:pr-1">
                            {queue.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Queue is empty</p>
                            ) : (
                                queue.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => playFromQueue(index)}
                                        disabled={!isPrimaryPlayerTab}
                                        className="w-full rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-left transition-colors hover:bg-muted/30"
                                    >
                                        <p className="break-words text-sm text-foreground">{formatMessage(item.text, 120)}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {item.username || 'System'}{item.platform ? ` - ${item.platform}` : ''}
                                        </p>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default TtsPlayerPage;
