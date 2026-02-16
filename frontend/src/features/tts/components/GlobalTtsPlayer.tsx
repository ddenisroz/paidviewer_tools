import React, { useEffect, useMemo, useState } from 'react';

import { ChevronDown, List, Mic, Pause, Play, SkipForward, Square, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

import { STORAGE_KEYS } from '@/constants';
import { useTts } from '@/context/TtsContext';
import { useTtsPlayer } from '@/context/TtsPlayerContext';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';

const getStoredListeningMode = (): 'website' | 'obs' => {
    if (typeof window === 'undefined') return 'website';
    const stored = window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE);
    return stored === 'obs' ? 'obs' : 'website';
};

const GlobalTtsPlayer: React.FC = () => {
    const {
        queue,
        currentItem,
        isPlaying,
        isPaused,
        clearQueue,
        skipCurrent,
        playFromQueue,
        togglePause
    } = useTtsPlayer();
    const { ttsEnabled } = useTts();
    const [showQueue, setShowQueue] = useState(false);
    const [renderQueue, setRenderQueue] = useState(false);
    const [miniPlayerContainer, setMiniPlayerContainer] = useState<HTMLElement | null>(null);
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>(getStoredListeningMode);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        setMiniPlayerContainer(document.getElementById('tts-mini-player-slot'));
    }, []);

    useEffect(() => {
        if (showQueue) {
            setRenderQueue(true);
            return;
        }
        const timer = window.setTimeout(() => setRenderQueue(false), 180);
        return () => window.clearTimeout(timer);
    }, [showQueue]);

    useEffect(() => {
        if (!currentItem && queue.length === 0 && showQueue) {
            setShowQueue(false);
        }
    }, [currentItem, queue.length, showQueue]);

    useEffect(() => {
        const handleListeningModeChange = (event: CustomEvent<{ mode?: string }>) => {
            const mode = event.detail?.mode === 'obs' ? 'obs' : 'website';
            setListeningMode(mode);
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEYS.TTS_LISTENING_MODE) return;
            const mode = event.newValue === 'obs' ? 'obs' : 'website';
            setListeningMode(mode);
        };

        window.addEventListener('tts-listening-mode-changed', handleListeningModeChange as EventListener);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('tts-listening-mode-changed', handleListeningModeChange as EventListener);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const formatText = (text: string, maxLength: number = 100) => {
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
    };

    const platformLabel = currentItem?.platform ? currentItem.platform.toUpperCase() : null;
    const isPlaybackAvailable = ttsEnabled && listeningMode === 'website';
    const isIdle = !currentItem;
    const canOpenQueue = Boolean(currentItem) || queue.length > 0;
    const canClear = queue.length > 0 || Boolean(currentItem);
    const canSkip = Boolean(currentItem) && isPlaybackAvailable;

    const secondaryText = isIdle
        ? (ttsEnabled ? (listeningMode === 'obs' ? 'Режим OBS' : 'Ожидание сообщений') : 'Озвучка выключена')
        : `${currentItem.username || 'System'}${currentItem.platform ? ` (${currentItem.platform})` : ''}`;

    const headerLine = useMemo(() => {
        const parts: string[] = ['TTS'];
        if (platformLabel) parts.push(platformLabel);
        if (isIdle) {
            parts.push(ttsEnabled ? (listeningMode === 'obs' ? 'OBS' : 'ожидание') : 'выключено');
        } else {
            parts.push(currentItem?.username || 'System');
        }
        return parts.join(' · ');
    }, [currentItem?.username, isIdle, listeningMode, platformLabel, ttsEnabled]);

    const shouldRender = ttsEnabled || currentItem || queue.length > 0;
    if (!shouldRender) {
        return null;
    }

    const bodyText = isIdle
        ? (ttsEnabled ? 'Готов к озвучке новых сообщений' : 'Включите озвучку, чтобы получать сообщения')
        : currentItem.text;

    const playerUi = (
        <div className="relative w-full">
            {renderQueue && (queue.length > 0 || currentItem) && (
                <div
                    className={cn(
                        "absolute bottom-full mb-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl origin-bottom transition-all duration-200",
                        showQueue ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98] pointer-events-none"
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                            Очередь TTS ({queue.length})
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={skipCurrent}
                                className="h-6 w-6 p-0 hover:bg-white/10 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Пропустить"
                                disabled={!canSkip}
                            >
                                <SkipForward className="w-4 h-4 text-white/70" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearQueue}
                                className="h-6 w-6 p-0 hover:bg-white/10 rounded-full"
                                title="Очистить очередь"
                                disabled={!canClear}
                            >
                                <Trash2 className="w-4 h-4 text-white/70" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowQueue(false)}
                                className="h-6 w-6 p-0 hover:bg-white/10 rounded-full"
                                title="Скрыть"
                            >
                                <ChevronDown className="w-4 h-4 text-white/70" />
                            </Button>
                        </div>
                    </div>

                    <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {currentItem && (
                            <div className="px-3 py-2 border-b border-white/10 bg-white/5">
                                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Сейчас играет</div>
                                <div className="flex items-start gap-2">
                                    <div className="mt-1 flex gap-0.5">
                                        <span className={cn("w-1 h-3 rounded-full", isPlaying ? "bg-purple-400 animate-pulse" : "bg-white/30")} />
                                        <span className={cn("w-1 h-3 rounded-full", isPlaying ? "bg-purple-400 animate-pulse" : "bg-white/30")} style={{ animationDelay: '120ms' }} />
                                        <span className={cn("w-1 h-3 rounded-full", isPlaying ? "bg-purple-400 animate-pulse" : "bg-white/30")} style={{ animationDelay: '240ms' }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white/90 text-xs font-medium truncate" title={currentItem.text}>
                                            {formatText(currentItem.text, 70)}
                                        </p>
                                        <p className="text-white/50 text-[10px] truncate" title={secondaryText}>
                                            {secondaryText}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {queue.length === 0 && (
                            <div className="px-3 py-4 text-xs text-white/50 text-center">
                                Очередь пуста
                            </div>
                        )}

                        {queue.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                className="flex w-full items-start gap-2 px-3 py-2 border-b border-white/5 last:border-0 text-left hover:bg-white/5 transition-colors"
                                onClick={() => {
                                    playFromQueue(index);
                                    setShowQueue(false);
                                }}
                                title="Проиграть отсюда"
                            >
                                <span className="text-[10px] font-mono text-white/30 w-4 text-right">{index + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-white/90 text-xs font-medium truncate">
                                        {formatText(item.text, 70)}
                                    </p>
                                    {item.username && (
                                        <p className="text-white/50 text-[10px] truncate">
                                            {item.username}{item.platform ? ` (${item.platform})` : ''}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div
                className={cn(
                    "rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-lg transition-opacity",
                    isPlaybackAvailable ? "opacity-100" : "opacity-70"
                )}
            >
                <div className="flex items-center gap-2.5 p-2.5">
                    <div className="group/thumb relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black/50">
                        <div className="w-full h-full flex items-center justify-center text-white/70 bg-black/40">
                            <Mic className="w-5 h-5" />
                        </div>
                        <div
                            className={cn(
                                "absolute inset-0 flex items-center justify-center",
                                isPlaying ? "bg-black/30" : "bg-black/40"
                            )}
                        >
                            {isPlaying && (
                                <div className="flex gap-0.5">
                                    <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold text-white/90 truncate" title={headerLine}>
                                {headerLine}
                            </p>
                            <div className="flex items-center gap-1">
                                {canOpenQueue && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQueue(!showQueue)}
                                        className={cn(
                                            "relative h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white/60 hover:text-white",
                                            showQueue && "bg-white/10 text-white"
                                        )}
                                        title={showQueue ? "Скрыть очередь" : "Показать очередь"}
                                    >
                                        <List className="w-3.5 h-3.5" />
                                        {queue.length > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-purple-500 text-[9px] font-semibold text-white flex items-center justify-center shadow">
                                                {queue.length}
                                            </span>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={togglePause}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isPaused || !isPlaying ? 'Продолжить' : 'Пауза'}
                                    disabled={!currentItem || !isPlaybackAvailable}
                                >
                                    {isPaused || !isPlaying ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearQueue}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Стоп"
                                    disabled={!canClear}
                                >
                                    <Square className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>

                        <p
                            className="mt-1 text-[11px] text-white/60 truncate"
                            title={isIdle ? undefined : currentItem?.text}
                        >
                            {bodyText}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    if (miniPlayerContainer) {
        return createPortal(playerUi, miniPlayerContainer);
    }

    return (
        <div className="fixed bottom-4 right-4 z-40 w-[min(420px,calc(100vw-2rem))] pointer-events-auto">
            {playerUi}
        </div>
    );
};

export default GlobalTtsPlayer;
