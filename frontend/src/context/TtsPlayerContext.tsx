import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { API_BASE_URL, STORAGE_KEYS, TTS_SERVICE_URL, WS_BASE_URL } from '@/constants';
import { logger } from '@/shared/utils/prodLogger';

import { useAuth } from './AuthContext';

interface TtsQueueItem {
    id: string;
    text: string;
    audioUrl: string;
    volume: number;
    username?: string;
    platform?: string;
    timestamp: Date;
}

interface TtsPlayerContextValue {
    queue: TtsQueueItem[];
    currentItem: TtsQueueItem | null;
    isPlaying: boolean;
    isPaused: boolean;
    isPrimaryPlayerTab: boolean;
    addToQueue: (item: Omit<TtsQueueItem, 'id' | 'timestamp'>) => void;
    clearQueue: () => void;
    skipCurrent: () => void;
    playFromQueue: (index: number) => void;
    togglePause: () => void;
    requestPrimaryPlayerTab: () => void;
}

const TtsPlayerContext = createContext<TtsPlayerContextValue | undefined>(undefined);

interface TtsPlayerProviderProps {
    children: ReactNode;
}

const TTS_PLAYER_ROUTE = '/tts-player';
const TTS_PLAYER_LOCK_KEY = 'tts_player_active_tab';
const TTS_PLAYER_LOCK_HEARTBEAT_MS = 2000;
const TTS_PLAYER_LOCK_TTL_MS = 6500;

const getStoredListeningMode = (): 'website' | 'obs' => {
    if (typeof window === 'undefined') return 'website';
    const stored = window.localStorage.getItem(STORAGE_KEYS.TTS_LISTENING_MODE);
    return stored === 'obs' ? 'obs' : 'website';
};

const getStoredTtsEnabled = (): boolean => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('tts_enabled');
    if (stored === null) return true;
    return stored === 'true';
};


export const TtsPlayerProvider: React.FC<TtsPlayerProviderProps> = ({ children }) => {
    const location = useLocation();
    const [queue, setQueue] = useState<TtsQueueItem[]>([]);
    const [currentItem, setCurrentItem] = useState<TtsQueueItem | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>(getStoredListeningMode);
    const [isPrimaryPlayerTab, setIsPrimaryPlayerTab] = useState<boolean>(false);
    const [ttsEnabled, setTtsEnabled] = useState<boolean>(getStoredTtsEnabled);

    const audioContext = useRef<AudioContext | null>(null);
    const currentSource = useRef<AudioBufferSourceNode | null>(null);
    const audioElement = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<TtsQueueItem[]>([]);
    const listeningModeRef = useRef<'website' | 'obs'>(listeningMode);
    const isPrimaryPlayerTabRef = useRef<boolean>(isPrimaryPlayerTab);
    const ttsEnabledRef = useRef<boolean>(ttsEnabled);
    const isPlayerRouteRef = useRef<boolean>(location.pathname === TTS_PLAYER_ROUTE);
    const tabIdRef = useRef<string>(`tts-player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const presenceWebSocketRef = useRef<WebSocket | null>(null);
    const presenceReconnectTimerRef = useRef<number | null>(null);
    const presenceShouldReconnectRef = useRef<boolean>(false);
    const retryCount = useRef<number>(0);
    const MAX_RETRIES = 3;
    const { isAuthenticated, user } = useAuth();
    const isPlayerRoute = location.pathname === TTS_PLAYER_ROUTE;

    const resolveAudioUrl = useCallback((rawAudioUrl: string): string => {
        let audioUrl = rawAudioUrl;
        if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
            return audioUrl;
        }

        if (audioUrl.startsWith('/audio/') && TTS_SERVICE_URL) {
            return `${TTS_SERVICE_URL}${audioUrl}`;
        }

        if (audioUrl.startsWith('/')) {
            return `${API_BASE_URL}${audioUrl}`;
        }

        if (TTS_SERVICE_URL) {
            return `${TTS_SERVICE_URL}/${audioUrl.replace(/^\/+/, '')}`;
        }

        return audioUrl;
    }, []);

    const enqueueSocketAudio = useCallback((payload: {
        audio_url?: string;
        text?: string;
        volume?: number;
        username?: string;
        platform?: string;
    }) => {
        if (!payload.audio_url) {
            return;
        }

        if (!ttsEnabledRef.current) {
            return;
        }

        if (listeningModeRef.current !== 'website' || !isPlayerRouteRef.current) {
            return;
        }

        if (!isPrimaryPlayerTabRef.current) {
            return;
        }

        const normalizedVolume = typeof payload.volume === 'number'
            ? Math.max(0, Math.min(100, Math.round(payload.volume)))
            : 50;

        const newItem: TtsQueueItem = {
            id: `${Date.now()}-${Math.random()}`,
            text: payload.text || 'TTS Message',
            audioUrl: resolveAudioUrl(payload.audio_url),
            volume: normalizedVolume,
            username: payload.username,
            platform: payload.platform,
            timestamp: new Date()
        };

        setQueue((prev) => [...prev, newItem]);
    }, [resolveAudioUrl]);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        listeningModeRef.current = listeningMode;
    }, [listeningMode]);

    useEffect(() => {
        isPrimaryPlayerTabRef.current = isPrimaryPlayerTab;
    }, [isPrimaryPlayerTab]);

    useEffect(() => {
        ttsEnabledRef.current = ttsEnabled;
    }, [ttsEnabled]);

    useEffect(() => {
        isPlayerRouteRef.current = isPlayerRoute;
    }, [isPlayerRoute]);

    const readPlayerLock = useCallback((): { tabId: string; ts: number } | null => {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage.getItem(TTS_PLAYER_LOCK_KEY);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
            if (typeof parsed.tabId !== 'string' || typeof parsed.ts !== 'number') {
                return null;
            }
            return { tabId: parsed.tabId, ts: parsed.ts };
        } catch {
            return null;
        }
    }, []);

    const writePlayerLock = useCallback(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(TTS_PLAYER_LOCK_KEY, JSON.stringify({
                tabId: tabIdRef.current,
                ts: Date.now()
            }));
            setIsPrimaryPlayerTab(true);
        } catch {
            setIsPrimaryPlayerTab(true);
        }
    }, []);

    const releasePlayerLock = useCallback(() => {
        if (typeof window === 'undefined') {
            setIsPrimaryPlayerTab(false);
            return;
        }

        const current = readPlayerLock();
        if (current?.tabId === tabIdRef.current) {
            try {
                window.localStorage.removeItem(TTS_PLAYER_LOCK_KEY);
            } catch {
                // ignore storage cleanup failures
            }
        }

        setIsPrimaryPlayerTab(false);
    }, [readPlayerLock]);

    const syncPrimaryPlayerTab = useCallback(() => {
        if (typeof window === 'undefined') return;

        const current = readPlayerLock();
        const now = Date.now();
        const isExpired = !current || now - current.ts > TTS_PLAYER_LOCK_TTL_MS;
        const isOwnedByCurrentTab = current?.tabId === tabIdRef.current;

        if (isOwnedByCurrentTab || isExpired) {
            writePlayerLock();
            return;
        }

        setIsPrimaryPlayerTab(false);
    }, [readPlayerLock, writePlayerLock]);

    const requestPrimaryPlayerTab = useCallback(() => {
        writePlayerLock();
    }, [writePlayerLock]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const shouldHoldLock = listeningMode === 'website' && isPlayerRoute;
        if (!shouldHoldLock) {
            releasePlayerLock();
            return;
        }

        syncPrimaryPlayerTab();

        const handleStorage = (event: StorageEvent) => {
            if (event.key === TTS_PLAYER_LOCK_KEY) {
                syncPrimaryPlayerTab();
            }
        };

        const handleBeforeUnload = () => {
            releasePlayerLock();
        };

        const heartbeat = window.setInterval(syncPrimaryPlayerTab, TTS_PLAYER_LOCK_HEARTBEAT_MS);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.clearInterval(heartbeat);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            releasePlayerLock();
        };
    }, [listeningMode, isPlayerRoute, releasePlayerLock, syncPrimaryPlayerTab]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleTtsStatusChange = (event: CustomEvent<{ enabled?: boolean }>) => {
            if (typeof event.detail?.enabled !== 'boolean') return;
            setTtsEnabled(event.detail.enabled);
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== 'tts_enabled') return;
            if (event.newValue === null) {
                setTtsEnabled(true);
                return;
            }
            setTtsEnabled(event.newValue === 'true');
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const clearReconnectTimer = () => {
            if (presenceReconnectTimerRef.current !== null) {
                window.clearTimeout(presenceReconnectTimerRef.current);
                presenceReconnectTimerRef.current = null;
            }
        };

        const closePresenceSocket = () => {
            clearReconnectTimer();
            if (presenceWebSocketRef.current) {
                const ws = presenceWebSocketRef.current;
                presenceWebSocketRef.current = null;
                ws.close();
            }
        };

        const shouldConnect = Boolean(
            isAuthenticated &&
            user?.id &&
            listeningMode === 'website' &&
            isPlayerRoute
        );

        presenceShouldReconnectRef.current = shouldConnect;

        if (!shouldConnect) {
            closePresenceSocket();
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBaseUrl = WS_BASE_URL || `${protocol}//${window.location.hostname}:8000`;

        const connectPresenceSocket = () => {
            if (!presenceShouldReconnectRef.current || !user?.id) {
                return;
            }

            const currentSocket = presenceWebSocketRef.current;
            if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) {
                return;
            }

            const wsUrl = `${wsBaseUrl}/ws/chat/${user.id}?client_role=tts_player&presence_only=1`;
            const ws = new WebSocket(wsUrl);
            presenceWebSocketRef.current = ws;

            ws.onopen = () => {
                logger.info('[TTS Player] Presence WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as {
                        type?: string;
                        data?: {
                            audio_url?: string;
                            text?: string;
                            volume?: number;
                            username?: string;
                            platform?: string;
                        };
                        audio_url?: string;
                        text?: string;
                        volume?: number;
                        username?: string;
                        platform?: string;
                    };
                    if (message.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'ping' }));
                        return;
                    }

                    if (message.type === 'tts_audio') {
                        const payload = message.data || message;
                        enqueueSocketAudio(payload);
                    }
                } catch {
                    // ignore malformed presence payloads
                }
            };

            ws.onerror = () => {
                logger.warn('[TTS Player] Presence WebSocket error');
            };

            ws.onclose = () => {
                if (presenceWebSocketRef.current === ws) {
                    presenceWebSocketRef.current = null;
                }

                if (!presenceShouldReconnectRef.current) {
                    return;
                }

                clearReconnectTimer();
                presenceReconnectTimerRef.current = window.setTimeout(() => {
                    connectPresenceSocket();
                }, 1500);
            };
        };

        connectPresenceSocket();

        return () => {
            presenceShouldReconnectRef.current = false;
            closePresenceSocket();
        };
    }, [isAuthenticated, user?.id, listeningMode, isPlayerRoute, enqueueSocketAudio]);

    useEffect(() => {
        if (!isAuthenticated || listeningMode !== 'website' || !isPlayerRoute || !isPrimaryPlayerTab) {
            return;
        }

        const initAudioContext = async (tryResume: boolean) => {
            if (!audioContext.current || audioContext.current.state === 'closed') {
                const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioContext.current = new AudioContextClass();
                    logger.info('[AUDIO] [TTS Player] AudioContext created');
                }
            }

            if (tryResume && audioContext.current && audioContext.current.state === 'suspended') {
                try {
                    await audioContext.current.resume();
                    logger.info('[AUDIO] [TTS Player] AudioContext resumed');
                } catch (error) {
                    logger.debug('[AUDIO] [TTS Player] AudioContext resume deferred until user gesture: %s', error);
                }
            }
        };

        void initAudioContext(true);

        const handleUserInteraction = () => {
            void initAudioContext(true);
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('pointerdown', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);
        document.addEventListener('pointerdown', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('pointerdown', handleUserInteraction);

            if (audioContext.current && audioContext.current.state !== 'closed') {
                audioContext.current.close();
            }
        };
    }, [isAuthenticated, listeningMode, isPlayerRoute, isPrimaryPlayerTab]);


    const playNext = useCallback(async () => {
        if (!ttsEnabledRef.current) {
            setQueue([]);
            setCurrentItem(null);
            setIsPlaying(false);
            setIsPaused(false);
            return;
        }

        if (listeningModeRef.current !== 'website' || !isPlayerRouteRef.current) {
            setQueue([]);
            setCurrentItem(null);
            setIsPlaying(false);
            setIsPaused(false);
            return;
        }

        if (!isPrimaryPlayerTabRef.current) {
            setQueue([]);
            setCurrentItem(null);
            setIsPlaying(false);
            setIsPaused(false);
            return;
        }

        const currentQueue = queueRef.current;

        if (currentQueue.length === 0) {
            setCurrentItem(null);
            setIsPlaying(false);
            setIsPaused(false);
            return;
        }

        const nextItem = currentQueue[0];
        setCurrentItem(nextItem);
        setIsPlaying(true);
        setIsPaused(false);
        setQueue(prev => prev.slice(1));

        try {
            if (audioContext.current && audioContext.current.state !== 'closed') {
                if (audioContext.current.state === 'suspended') {
                    await audioContext.current.resume();
                }

                logger.debug(`[RECEIVE] [TTS Player] Fetching audio from: ${nextItem.audioUrl}`);
                const response = await fetch(nextItem.audioUrl, { credentials: 'include' });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);

                if (listeningModeRef.current !== 'website' || !isPlayerRouteRef.current) {
                    setIsPlaying(false);
                    setCurrentItem(null);
                    return;
                }

                const source = audioContext.current.createBufferSource();
                const gainNode = audioContext.current.createGain();

                source.buffer = audioBuffer;
                gainNode.gain.value = nextItem.volume / 100;

                source.connect(gainNode);
                gainNode.connect(audioContext.current.destination);

                source.onended = () => {
                    logger.debug('[AUDIO] [TTS Player] Audio finished');
                    retryCount.current = 0;
                    currentSource.current = null;
                    setIsPlaying(false);
                    setIsPaused(false);
                    setCurrentItem(null);
                    setTimeout(() => playNext(), 100);
                };

                currentSource.current = source;
                source.start(0);
                logger.info('[OK] [TTS Player] Playing TTS via Web Audio API');
            } else {
                throw new Error('AudioContext not available');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.warn('[TTS Player] Web Audio API failed, falling back to Audio element:', errorMessage);

            if (listeningModeRef.current !== 'website' || !isPlayerRouteRef.current) {
                setIsPlaying(false);
                setCurrentItem(null);
                return;
            }

            const audio = new Audio(nextItem.audioUrl);
            audio.volume = nextItem.volume / 100;

            audio.onended = () => {
                logger.debug('[AUDIO] [TTS Player] Audio finished (fallback)');
                retryCount.current = 0;
                audioElement.current = null;
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentItem(null);
                setTimeout(() => playNext(), 100);
            };

            audio.onerror = () => {
                logger.error('[TTS Player] Audio playback error');
                audioElement.current = null;
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentItem(null);

                if (retryCount.current < MAX_RETRIES) {
                    retryCount.current++;
                    logger.warn(`[TTS Player] Retrying (${retryCount.current}/${MAX_RETRIES})...`);
                    setQueue(prev => [nextItem, ...prev]);
                    setTimeout(() => playNext(), 500);
                } else {
                    logger.error('[TTS Player] Max retries reached, skipping item');
                    retryCount.current = 0;
                    setTimeout(() => playNext(), 100);
                }
            };

            audioElement.current = audio;

            try {
                await audio.play();
                retryCount.current = 0;
                logger.info('[OK] [TTS Player] Playing TTS via Audio element');
            } catch (playErr) {
                logger.error('[TTS Player] Failed to play audio:', playErr);
                audioElement.current = null;
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentItem(null);

                if (retryCount.current < MAX_RETRIES) {
                    retryCount.current++;
                    logger.warn(`[TTS Player] Retrying (${retryCount.current}/${MAX_RETRIES})...`);
                    setQueue(prev => [nextItem, ...prev]);
                    setTimeout(() => playNext(), 500);
                } else {
                    logger.error('[TTS Player] Max retries reached, skipping item');
                    retryCount.current = 0;
                    setTimeout(() => playNext(), 100);
                }
            }
        }
    }, []);

    const clearQueue = useCallback(() => {
        if (currentSource.current) {
            currentSource.current.stop();
            currentSource.current = null;
        }
        if (audioElement.current) {
            audioElement.current.pause();
            audioElement.current = null;
        }

        setQueue([]);
        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
        logger.info('[DELETE] [TTS Player] Queue cleared');
    }, []);

    useEffect(() => {
        if (!ttsEnabled) {
            clearQueue();
        }
    }, [ttsEnabled, clearQueue]);

    useEffect(() => {
        if (!isPrimaryPlayerTab) {
            clearQueue();
        }
    }, [isPrimaryPlayerTab, clearQueue]);

    useEffect(() => {
        if (queue.length > 0 && !isPlaying && !currentItem) {
            playNext();
        }
    }, [queue.length, isPlaying, currentItem, playNext]);

    useEffect(() => {
        if (listeningMode !== 'website' || !isPlayerRoute) {
            clearQueue();
        }
    }, [listeningMode, clearQueue, isPlayerRoute]);

    const addToQueue = useCallback((item: Omit<TtsQueueItem, 'id' | 'timestamp'>) => {
        if (!ttsEnabledRef.current) {
            logger.debug('[TTS Player] Skipping queue item (TTS disabled)');
            return;
        }

        if (listeningModeRef.current !== 'website') {
            logger.debug('[TTS Player] Skipping queue item (listening mode is not website)');
            return;
        }

        if (!isPlayerRouteRef.current) {
            logger.debug('[TTS Player] Skipping queue item (player tab is not active)');
            return;
        }

        if (!isPrimaryPlayerTabRef.current) {
            logger.debug('[TTS Player] Skipping queue item (player tab is passive)');
            return;
        }

        const newItem: TtsQueueItem = {
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date()
        };

        setQueue(prev => [...prev, newItem]);
        logger.debug(`[LOG] [TTS Player] Added to queue: ${newItem.text.substring(0, 50)}...`);
    }, []);

    const skipCurrent = useCallback(() => {
        if (currentSource.current) {
            currentSource.current.stop();
            currentSource.current = null;
        }
        if (audioElement.current) {
            audioElement.current.pause();
            audioElement.current = null;
        }

        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
        setTimeout(() => playNext(), 100);
        logger.info('[SKIP] [TTS Player] Skipped current item');
    }, [playNext]);

    const playFromQueue = useCallback((index: number) => {
        const currentQueue = queueRef.current;
        if (index < 0 || index >= currentQueue.length) {
            return;
        }

        const newQueue = currentQueue.slice(index);
        queueRef.current = newQueue;
        setQueue(newQueue);

        if (currentSource.current) {
            currentSource.current.stop();
            currentSource.current = null;
        }
        if (audioElement.current) {
            audioElement.current.pause();
            audioElement.current = null;
        }

        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);

        setTimeout(() => playNext(), 100);
        logger.info(`[QUEUE] [TTS Player] Jumped to item #${index + 1}`);
    }, [playNext]);

    const togglePause = useCallback(() => {
        if (!currentItem) return;

        const handlePause = async () => {
            if (audioContext.current && audioContext.current.state !== 'closed') {
                if (audioContext.current.state === 'running') {
                    await audioContext.current.suspend();
                    setIsPlaying(false);
                    setIsPaused(true);
                    return;
                }
                if (audioContext.current.state === 'suspended') {
                    await audioContext.current.resume();
                    setIsPlaying(true);
                    setIsPaused(false);
                    return;
                }
            }

            if (audioElement.current) {
                if (audioElement.current.paused) {
                    audioElement.current.play().then(() => {
                        setIsPlaying(true);
                        setIsPaused(false);
                    }).catch(() => {
                        logger.warn('[TTS Player] Failed to resume audio element');
                    });
                } else {
                    audioElement.current.pause();
                    setIsPlaying(false);
                    setIsPaused(true);
                }
            }
        };

        void handlePause();
    }, [currentItem]);

    const value: TtsPlayerContextValue = {
        queue,
        currentItem,
        isPlaying,
        isPaused,
        isPrimaryPlayerTab,
        addToQueue,
        clearQueue,
        skipCurrent,
        playFromQueue,
        togglePause,
        requestPrimaryPlayerTab
    };

    return (
        <TtsPlayerContext.Provider value={value}>
            {children}
        </TtsPlayerContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTtsPlayer = (): TtsPlayerContextValue => {
    const context = useContext(TtsPlayerContext);
    if (!context) {
        throw new Error('useTtsPlayer must be used within a TtsPlayerProvider');
    }
    return context;
};

export default TtsPlayerContext;
