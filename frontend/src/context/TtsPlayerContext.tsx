import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router-dom';

import { STORAGE_KEYS, WS_BASE_URL } from '@/constants';
import { logger } from '@/shared/utils/prodLogger';
import { resolveAudioUrl as resolveBackendAudioUrl } from '@/shared/utils/urlUtils';
import { getChatWebSocketToken } from '@/shared/utils/websocketAuth';

import { AuthContext } from './AuthContext';

interface TtsQueueItem {
    id: string;
    text: string;
    audioUrl: string;
    volume: number;
    status: 'generated' | 'playing' | 'played' | 'failed';
    username?: string;
    platform?: string;
    spokenText?: string;
    originalText?: string;
    traceId?: string;
    sourceMessageId?: string;
    timestamp: Date;
}

type TtsMessageStatus = 'not_voiced' | 'queued' | 'playing' | 'played' | 'failed';

interface TtsLiveChatMessage {
    id: string;
    sourceMessageId?: string;
    username?: string;
    platform?: string;
    text: string;
    status: TtsMessageStatus;
    reasonCode?: string;
    audioUrl?: string;
    timestamp: Date;
}

interface TtsPlayerContextValue {
    queue: TtsQueueItem[];
    currentItem: TtsQueueItem | null;
    liveMessages: TtsLiveChatMessage[];
    isPlaying: boolean;
    isPaused: boolean;
    isPrimaryPlayerTab: boolean;
    isAudioUnlocked: boolean;
    isSocketConnected: boolean;
    addToQueue: (item: Omit<TtsQueueItem, 'id' | 'timestamp' | 'status'>) => void;
    clearQueue: () => void;
    skipCurrent: () => void;
    startPlayback: () => void;
    stopPlayback: () => void;
    playFromQueue: (index: number) => void;
    togglePause: () => void;
    requestPrimaryPlayerTab: () => void;
    unlockAudio: () => Promise<void>;
    setOutputVolume: (value: number) => void;
}

const TtsPlayerContext = createContext<TtsPlayerContextValue | undefined>(undefined);

interface TtsPlayerProviderProps {
    children: ReactNode;
}

const TTS_PLAYER_LOCK_KEY = 'tts_player_active_tab';
const TTS_PLAYER_LOCK_HEARTBEAT_MS = 2000;
const TTS_PLAYER_LOCK_TTL_MS = 6500;
const TTS_PLAYER_AUDIO_UNLOCKED_KEY = 'tts_player_audio_unlocked';
const SOCKET_EVENT_DEDUPE_TTL_MS = 5000;

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

const getStoredAudioUnlocked = (): boolean => {
    // Browser audio activation is per document and cannot be restored safely
    // from localStorage after reload/opening a fresh player tab.
    return false;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
        return JSON.parse(window.atob(padded)) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const getObsDockToken = (search: string): string | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(search);
    const token = (params.get('dock_token') || params.get('obs_token') || params.get('token') || '').trim();
    return token || null;
};

const getObsDockUserId = (token: string | null): number | null => {
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const rawUserId = payload?.user_id;
    const userId = typeof rawUserId === 'number' ? rawUserId : Number(rawUserId);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
};

export const TtsPlayerProvider: React.FC<TtsPlayerProviderProps> = ({ children }) => {
    const location = useLocation();
    const isPlayerRoute = location.pathname === '/tts/player' || location.pathname === '/tts/obs-dock';
    const obsDockToken = useMemo(() => getObsDockToken(location.search), [location.search]);
    const obsDockUserId = useMemo(() => getObsDockUserId(obsDockToken), [obsDockToken]);
    const [queue, setQueue] = useState<TtsQueueItem[]>([]);
    const [currentItem, setCurrentItem] = useState<TtsQueueItem | null>(null);
    const [liveMessages, setLiveMessages] = useState<TtsLiveChatMessage[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [listeningMode, setListeningMode] = useState<'website' | 'obs'>(getStoredListeningMode);
    const [isPrimaryPlayerTab, setIsPrimaryPlayerTab] = useState<boolean>(false);
    const [ttsEnabled, setTtsEnabled] = useState<boolean>(getStoredTtsEnabled);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(getStoredAudioUnlocked);
    const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

    const audioContext = useRef<AudioContext | null>(null);
    const currentSource = useRef<AudioBufferSourceNode | null>(null);
    const currentGainNode = useRef<GainNode | null>(null);
    const audioElement = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<TtsQueueItem[]>([]);
    const isStartingPlaybackRef = useRef<boolean>(false);
    const playbackActiveRef = useRef<boolean>(false);
    const playbackRequestIdRef = useRef<number>(0);
    const listeningModeRef = useRef<'website' | 'obs'>(listeningMode);
    const isPrimaryPlayerTabRef = useRef<boolean>(isPrimaryPlayerTab);
    const ttsEnabledRef = useRef<boolean>(ttsEnabled);
    const isAudioUnlockedRef = useRef<boolean>(isAudioUnlocked);
    const outputVolumeRef = useRef<number>(50);
    const tabIdRef = useRef<string>(`tts-player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const presenceWebSocketRef = useRef<WebSocket | null>(null);
    const presenceReconnectTimerRef = useRef<number | null>(null);
    const presenceShouldReconnectRef = useRef<boolean>(false);
    const recentSocketEventsRef = useRef<Map<string, number>>(new Map());
    const playNextRef = useRef<(() => void) | null>(null);
    const retryCount = useRef<number>(0);
    const MAX_RETRIES = 3;
    const authContext = useContext(AuthContext);
    const isAuthenticated = Boolean(authContext?.isAuthenticated);
    const user = authContext?.user ?? null;
    const isTokenObsDock = Boolean(obsDockToken && location.pathname === '/tts/obs-dock');

    const sendDockControlCommand = useCallback((command: 'start' | 'stop' | 'skip' | 'clear'): void => {
        const socket = presenceWebSocketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify({ type: 'tts_control', command }));
    }, []);

    const invalidatePlaybackRequests = useCallback(() => {
        playbackRequestIdRef.current += 1;
        isStartingPlaybackRef.current = false;
        playbackActiveRef.current = false;
    }, []);

    const stopActivePlayback = useCallback(() => {
        if (currentSource.current) {
            try {
                currentSource.current.onended = null;
                currentSource.current.stop();
            } catch {
                // no-op: source could already be stopped
            }
            currentSource.current = null;
            currentGainNode.current = null;
        }
        if (audioElement.current) {
            try {
                audioElement.current.onended = null;
                audioElement.current.onerror = null;
                audioElement.current.pause();
                audioElement.current.currentTime = 0;
            } catch {
                // no-op: element could already be detached
            }
            audioElement.current = null;
        }
    }, []);

    const setOutputVolume = useCallback((value: number): void => {
        const nextVolume = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 50)));
        outputVolumeRef.current = nextVolume;
        if (currentGainNode.current) {
            currentGainNode.current.gain.value = nextVolume / 100;
        }
        if (audioElement.current) {
            audioElement.current.volume = nextVolume / 100;
        }
    }, []);

    const markAudioLocked = useCallback((): void => {
        setIsAudioUnlocked(false);
        isAudioUnlockedRef.current = false;
        try {
            window.localStorage.removeItem(TTS_PLAYER_AUDIO_UNLOCKED_KEY);
        } catch {
            // ignore storage cleanup failures
        }
    }, []);

    const unlockAudio = useCallback(async (): Promise<void> => {
        const AudioContextClass =
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
            markAudioLocked();
            return;
        }

        if (!audioContext.current || audioContext.current.state === 'closed') {
            audioContext.current = new AudioContextClass();
            logger.info('[AUDIO] [TTS Player] AudioContext created');
        }

        try {
            if (audioContext.current.state === 'suspended') {
                await audioContext.current.resume();
            }

            if (audioContext.current.state !== 'running') {
                logger.warn('[AUDIO] [TTS Player] AudioContext is not running yet; waiting for user gesture');
                markAudioLocked();
                return;
            }

            // Silent short pulse to reliably unlock output path after user gesture.
            const osc = audioContext.current.createOscillator();
            const gain = audioContext.current.createGain();
            gain.gain.value = 0.00001;
            osc.frequency.value = 220;
            osc.connect(gain);
            gain.connect(audioContext.current.destination);
            osc.start();
            osc.stop(audioContext.current.currentTime + 0.01);

            setIsAudioUnlocked(true);
            isAudioUnlockedRef.current = true;
            window.localStorage.setItem(TTS_PLAYER_AUDIO_UNLOCKED_KEY, 'true');
            logger.info('[AUDIO] [TTS Player] Audio unlocked');
        } catch (error) {
            markAudioLocked();
            logger.debug('[AUDIO] [TTS Player] Audio unlock deferred until user gesture: %s', error);
        }
    }, [markAudioLocked]);

    const readAudioContextState = useCallback((): AudioContextState | undefined => audioContext.current?.state, []);

    const ensureAudioReady = useCallback(async (): Promise<boolean> => {
        if (readAudioContextState() === 'running') {
            return true;
        }

        await unlockAudio();
        return readAudioContextState() === 'running';
    }, [readAudioContextState, unlockAudio]);

    const resetPlaybackUi = useCallback(() => {
        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
    }, []);

    const releasePlaybackAttempt = useCallback(() => {
        isStartingPlaybackRef.current = false;
        playbackActiveRef.current = false;
    }, []);

    const releasePlaybackStart = useCallback(() => {
        isStartingPlaybackRef.current = false;
    }, []);

    const scheduleNextPlayback = useCallback((delayMs = 100) => {
        window.setTimeout(() => playNextRef.current?.(), delayMs);
    }, []);

    const isWebsitePlaybackReady = useCallback(
        () => ttsEnabledRef.current && listeningModeRef.current === 'website' && isPrimaryPlayerTabRef.current,
        []
    );

    const resolveAudioUrl = useCallback((rawAudioUrl: string): string => {
        return resolveBackendAudioUrl(rawAudioUrl);
    }, []);

    const findLiveMessageIndex = (
        messages: TtsLiveChatMessage[],
        payload: {
            source_message_id?: string;
            id?: string;
            message_id?: string;
            username?: string;
            author?: string;
            author_name?: string;
            platform?: string;
            text?: string;
            message?: string;
            content?: string;
        }
    ): number => {
        const sourceMessageId = String(payload.source_message_id || payload.message_id || payload.id || '').trim();
        if (sourceMessageId) {
            const byId = messages.findIndex(
                (message) => message.sourceMessageId === sourceMessageId || message.id === sourceMessageId
            );
            if (byId >= 0) return byId;
        }

        const text = String(payload.text || payload.message || payload.content || '').trim();
        const username = String(payload.username || payload.author_name || payload.author || '').trim().toLowerCase();
        const platform = String(payload.platform || '').trim().toLowerCase();
        if (!text) return -1;

        return messages.findIndex((message) => {
            const sameText = message.text.trim() === text;
            const sameUser = !username || (message.username || '').toLowerCase() === username;
            const samePlatform = !platform || (message.platform || '').toLowerCase() === platform;
            return sameText && sameUser && samePlatform;
        });
    };

    const upsertLiveMessageStatus = useCallback(
        (
            payload: {
                source_message_id?: string;
                id?: string;
                message_id?: string;
                username?: string;
                author?: string;
                author_name?: string;
                platform?: string;
                text?: string;
                message?: string;
                content?: string;
                original_text?: string;
                spoken_text?: string;
                audio_url?: string;
            },
            status: TtsMessageStatus,
            reasonCode?: string
        ) => {
            const text = String(
                payload.original_text || payload.text || payload.message || payload.content || payload.spoken_text || ''
            ).trim();
            const sourceMessageId = String(payload.source_message_id || payload.message_id || payload.id || '').trim();

            setLiveMessages((prev) => {
                const index = findLiveMessageIndex(prev, {
                    ...payload,
                    text,
                    source_message_id: sourceMessageId,
                });
                if (index >= 0) {
                    return prev.map((message, messageIndex) =>
                        messageIndex === index
                            ? {
                                  ...message,
                                  status,
                                  reasonCode,
                                  audioUrl: payload.audio_url ? resolveAudioUrl(payload.audio_url) : message.audioUrl,
                                  sourceMessageId: sourceMessageId || message.sourceMessageId,
                              }
                            : message
                    );
                }

                if (!text) return prev;

                return [
                    {
                        id: sourceMessageId || `${Date.now()}-${Math.random()}`,
                        sourceMessageId: sourceMessageId || undefined,
                        username: payload.username || payload.author_name || payload.author,
                        platform: payload.platform,
                        text,
                        status,
                        reasonCode,
                        audioUrl: payload.audio_url ? resolveAudioUrl(payload.audio_url) : undefined,
                        timestamp: new Date(),
                    },
                    ...prev,
                ].slice(0, 80);
            });
        },
        [resolveAudioUrl]
    );

    const updateQueueItemLiveStatus = useCallback(
        (item: TtsQueueItem, status: TtsMessageStatus, reasonCode?: string) => {
            upsertLiveMessageStatus(
                {
                    source_message_id: item.sourceMessageId,
                    username: item.username,
                    platform: item.platform,
                    text: item.originalText || item.spokenText || item.text,
                },
                status,
                reasonCode
            );
        },
        [upsertLiveMessageStatus]
    );

    const enqueueSocketAudio = useCallback(
        (payload: {
            audio_url?: string;
            text?: string;
            volume?: number;
            username?: string;
            platform?: string;
            spoken_text?: string;
            original_text?: string;
            trace_id?: string;
            source_message_id?: string;
        }) => {
            if (!payload.audio_url) {
                return;
            }

            const now = Date.now();
            for (const [key, ts] of recentSocketEventsRef.current.entries()) {
                if (now - ts > SOCKET_EVENT_DEDUPE_TTL_MS) {
                    recentSocketEventsRef.current.delete(key);
                }
            }

            const eventKey =
                payload.source_message_id?.trim() ||
                payload.trace_id?.trim() ||
                `${payload.audio_url}|${payload.username || ''}|${payload.text || ''}`;
            if (eventKey && recentSocketEventsRef.current.has(eventKey)) {
                logger.info('[TTS Player] Skipped duplicate socket audio event', {
                    source_message_id: payload.source_message_id,
                    trace_id: payload.trace_id,
                });
                return;
            }
            if (eventKey) {
                recentSocketEventsRef.current.set(eventKey, now);
            }

            upsertLiveMessageStatus(
                {
                    source_message_id: payload.source_message_id,
                    username: payload.username,
                    platform: payload.platform,
                    text: payload.original_text || payload.spoken_text || payload.text,
                    original_text: payload.original_text,
                    spoken_text: payload.spoken_text,
                    audio_url: payload.audio_url,
                },
                'queued'
            );

            if (!ttsEnabledRef.current) {
                return;
            }

            if (listeningModeRef.current !== 'website' && !isTokenObsDock) {
                return;
            }

            const normalizedVolume = outputVolumeRef.current;
            const spokenText = payload.spoken_text || payload.text || 'TTS Message';

            const newItem: TtsQueueItem = {
                id: `${Date.now()}-${Math.random()}`,
                text: spokenText,
                audioUrl: resolveAudioUrl(payload.audio_url),
                volume: normalizedVolume,
                status: 'generated',
                username: payload.username,
                platform: payload.platform,
                spokenText,
                originalText: payload.original_text,
                traceId: payload.trace_id,
                sourceMessageId: payload.source_message_id,
                timestamp: new Date(),
            };

            const nextQueue = [...queueRef.current, newItem];
            queueRef.current = nextQueue;
            setQueue(nextQueue);
            if (listeningModeRef.current === 'website') {
                window.setTimeout(() => playNextRef.current?.(), 0);
            }
            logger.info('[TTS Player] Enqueued socket audio', {
                trace_id: newItem.traceId,
                source_message_id: newItem.sourceMessageId,
                username: newItem.username,
                platform: newItem.platform,
                spoken_text: newItem.spokenText,
                original_text: newItem.originalText,
            });
        },
        [isTokenObsDock, resolveAudioUrl, upsertLiveMessageStatus]
    );

    const addLiveChatMessage = useCallback(
        (payload: {
            id?: string;
            message_id?: string;
            username?: string;
            author?: string;
            author_name?: string;
            platform?: string;
            text?: string;
            message?: string;
            content?: string;
            timestamp?: number | string;
        }) => {
            const text = String(payload.text || payload.message || payload.content || '').trim();
            if (!text) return;

            const rawTimestamp = payload.timestamp;
            const parsedTimestamp =
                typeof rawTimestamp === 'number'
                    ? new Date(rawTimestamp)
                    : typeof rawTimestamp === 'string'
                      ? new Date(rawTimestamp)
                      : new Date();

            const sourceMessageId = String(payload.message_id || payload.id || '').trim();
            const item: TtsLiveChatMessage = {
                id: sourceMessageId || `${Date.now()}-${Math.random()}`,
                sourceMessageId: sourceMessageId || undefined,
                username: payload.username || payload.author_name || payload.author,
                platform: payload.platform,
                text,
                status: 'queued',
                timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp,
            };

            setLiveMessages((prev) => {
                const existingIndex = prev.findIndex(
                    (existing) =>
                        existing.id === item.id ||
                        Boolean(item.sourceMessageId && existing.sourceMessageId === item.sourceMessageId)
                );
                if (existingIndex >= 0) {
                    return prev.map((existing) =>
                        existing.id === item.id ||
                        Boolean(item.sourceMessageId && existing.sourceMessageId === item.sourceMessageId)
                            ? {
                                  ...existing,
                                  username: existing.username || item.username,
                                  platform: existing.platform || item.platform,
                                  text: existing.text || item.text,
                              }
                            : existing
                    );
                }
                return [item, ...prev].slice(0, 80);
            });
        },
        []
    );

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
        isAudioUnlockedRef.current = isAudioUnlocked;
    }, [isAudioUnlocked]);

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
            window.localStorage.setItem(
                TTS_PLAYER_LOCK_KEY,
                JSON.stringify({
                    tabId: tabIdRef.current,
                    ts: Date.now(),
                })
            );
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

        const shouldHoldLock = listeningMode === 'website';
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
    }, [listeningMode, releasePlayerLock, syncPrimaryPlayerTab]);

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
            setIsSocketConnected(false);
            if (presenceWebSocketRef.current) {
                const ws = presenceWebSocketRef.current;
                presenceWebSocketRef.current = null;
                ws.close();
            }
        };

        const playerUserId = user?.id || obsDockUserId;
        const shouldConnect = Boolean(isPlayerRoute && playerUserId && (isAuthenticated || obsDockToken));

        presenceShouldReconnectRef.current = shouldConnect;

        if (!shouldConnect) {
            closePresenceSocket();
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBaseUrl = WS_BASE_URL || `${protocol}//${window.location.host}`;

        const connectPresenceSocket = async () => {
            if (!presenceShouldReconnectRef.current || !playerUserId) {
                return;
            }

            const currentSocket = presenceWebSocketRef.current;
            if (
                currentSocket &&
                (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)
            ) {
                return;
            }

            const wsToken = isAuthenticated ? await getChatWebSocketToken() : null;
            const params = new URLSearchParams({
                client_role: 'tts_player',
                presence_only: '1',
            });
            if (wsToken) {
                params.set('ws_token', wsToken);
            } else if (obsDockToken) {
                params.set('obs_token', obsDockToken);
            }
            const wsUrl = `${wsBaseUrl}/ws/chat/${playerUserId}?${params.toString()}`;
            const ws = new WebSocket(wsUrl);
            presenceWebSocketRef.current = ws;

            ws.onopen = () => {
                setIsSocketConnected(true);
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
                            spoken_text?: string;
                            original_text?: string;
                            trace_id?: string;
                            source_message_id?: string;
                            status?: TtsMessageStatus;
                            reason_code?: string;
                            id?: string;
                            message_id?: string;
                            message?: string;
                            content?: string;
                            author?: string;
                            author_name?: string;
                            timestamp?: number | string;
                        };
                        audio_url?: string;
                        text?: string;
                        volume?: number;
                        username?: string;
                        platform?: string;
                        spoken_text?: string;
                        original_text?: string;
                        trace_id?: string;
                        source_message_id?: string;
                        status?: TtsMessageStatus;
                        reason_code?: string;
                        id?: string;
                        message_id?: string;
                        message?: string;
                        content?: string;
                        author?: string;
                        author_name?: string;
                        timestamp?: number | string;
                    };
                    if (message.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'ping' }));
                        return;
                    }

                    if (message.type === 'tts_audio') {
                        const payload = message.data || message;
                        enqueueSocketAudio(payload);
                        return;
                    }

                    if (message.type === 'tts_status') {
                        const payload = message.data || message;
                        upsertLiveMessageStatus(
                            {
                                source_message_id: payload.source_message_id,
                                id: payload.id,
                                message_id: payload.message_id,
                                text: payload.text,
                                message: payload.message,
                                content: payload.content,
                                username: payload.username,
                                author: payload.author,
                                author_name: payload.author_name,
                                platform: payload.platform,
                            },
                            payload.status || 'not_voiced',
                            payload.reason_code
                        );
                        return;
                    }

                    if (message.type === 'message') {
                        const payload = message.data || message;
                        addLiveChatMessage(payload);
                    }
                } catch {
                    // ignore malformed presence payloads
                }
            };

            ws.onerror = () => {
                logger.warn('[TTS Player] Presence WebSocket error');
            };

            ws.onclose = () => {
                setIsSocketConnected(false);
                if (presenceWebSocketRef.current === ws) {
                    presenceWebSocketRef.current = null;
                }

                if (!presenceShouldReconnectRef.current) {
                    return;
                }

                clearReconnectTimer();
                presenceReconnectTimerRef.current = window.setTimeout(() => {
                    void connectPresenceSocket();
                }, 1500);
            };
        };

        void connectPresenceSocket();

        return () => {
            presenceShouldReconnectRef.current = false;
            closePresenceSocket();
        };
    }, [
        isAuthenticated,
        user?.id,
        obsDockToken,
        obsDockUserId,
        isPlayerRoute,
        enqueueSocketAudio,
        addLiveChatMessage,
        upsertLiveMessageStatus,
    ]);

    useEffect(() => {
        if (isTokenObsDock) {
            setListeningMode('obs');
            listeningModeRef.current = 'obs';
        }
    }, [isTokenObsDock]);

    useEffect(() => {
        if (!isAuthenticated || listeningMode !== 'website' || !isPrimaryPlayerTab) {
            return;
        }

        const tryUnlock = () => {
            void unlockAudio();
        };

        // Try once immediately (may fail silently until first gesture).
        tryUnlock();

        if (!isAudioUnlocked) {
            document.addEventListener('click', tryUnlock);
            document.addEventListener('keydown', tryUnlock);
            document.addEventListener('pointerdown', tryUnlock);
        }

        return () => {
            document.removeEventListener('click', tryUnlock);
            document.removeEventListener('keydown', tryUnlock);
            document.removeEventListener('pointerdown', tryUnlock);
        };
    }, [isAuthenticated, listeningMode, isPrimaryPlayerTab, isAudioUnlocked, unlockAudio]);

    useEffect(() => {
        return () => {
            if (audioContext.current && audioContext.current.state !== 'closed') {
                audioContext.current.close();
            }
        };
    }, []);

    const retryPlaybackItem = useCallback(
        (item: TtsQueueItem, reasonCode: string) => {
            retryCount.current++;
            logger.warn(`[TTS Player] Retrying (${retryCount.current}/${MAX_RETRIES})...`);
            updateQueueItemLiveStatus(item, 'queued', reasonCode);
            const retryQueue = [item, ...queueRef.current];
            queueRef.current = retryQueue;
            setQueue(retryQueue);
            scheduleNextPlayback(500);
        },
        [scheduleNextPlayback, updateQueueItemLiveStatus]
    );

    const failPlaybackItem = useCallback(
        (item: TtsQueueItem, reasonCode: string) => {
            logger.error('[TTS Player] Max retries reached, skipping item');
            retryCount.current = 0;
            updateQueueItemLiveStatus(item, 'failed', reasonCode);
            scheduleNextPlayback();
        },
        [scheduleNextPlayback, updateQueueItemLiveStatus]
    );

    const retryOrFailPlaybackItem = useCallback(
        (item: TtsQueueItem, reasonCode: string) => {
            if (retryCount.current < MAX_RETRIES) {
                retryPlaybackItem(item, reasonCode);
                return;
            }
            failPlaybackItem(item, reasonCode);
        },
        [failPlaybackItem, retryPlaybackItem]
    );

    const finishPlaybackItem = useCallback(
        (item: TtsQueueItem, requestId: number, fallback = false) => {
            if (requestId !== playbackRequestIdRef.current) return;
            logger.debug(fallback ? '[AUDIO] [TTS Player] Audio finished (fallback)' : '[AUDIO] [TTS Player] Audio finished');
            retryCount.current = 0;
            currentSource.current = null;
            currentGainNode.current = null;
            audioElement.current = null;
            playbackActiveRef.current = false;
            updateQueueItemLiveStatus(item, 'played');
            resetPlaybackUi();
            scheduleNextPlayback();
        },
        [resetPlaybackUi, scheduleNextPlayback, updateQueueItemLiveStatus]
    );

    const playWithWebAudio = useCallback(
        async (nextItem: TtsQueueItem, requestId: number): Promise<boolean> => {
            const context = audioContext.current;
            if (!context || context.state === 'closed') throw new Error('AudioContext not available');
            if (context.state === 'suspended') await context.resume();

            logger.debug(`[RECEIVE] [TTS Player] Fetching audio from: ${nextItem.audioUrl}`);
            const response = await fetch(nextItem.audioUrl, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const audioBuffer = await context.decodeAudioData(await response.arrayBuffer());
            if (requestId !== playbackRequestIdRef.current || listeningModeRef.current !== 'website') return false;

            stopActivePlayback();
            const source = context.createBufferSource();
            const gainNode = context.createGain();
            source.buffer = audioBuffer;
            gainNode.gain.value = outputVolumeRef.current / 100;
            source.connect(gainNode);
            gainNode.connect(context.destination);
            source.onended = () => finishPlaybackItem(nextItem, requestId);
            currentSource.current = source;
            currentGainNode.current = gainNode;
            source.start(0);
            logger.info('[OK] [TTS Player] Playing TTS via Web Audio API');
            return true;
        },
        [finishPlaybackItem, stopActivePlayback]
    );

    const playWithAudioElement = useCallback(
        async (nextItem: TtsQueueItem, requestId: number): Promise<boolean> => {
            if (requestId !== playbackRequestIdRef.current || listeningModeRef.current !== 'website') return false;
            stopActivePlayback();
            const audio = new Audio(nextItem.audioUrl);
            audio.volume = outputVolumeRef.current / 100;
            audio.onended = () => finishPlaybackItem(nextItem, requestId, true);
            audio.onerror = () => {
                if (requestId !== playbackRequestIdRef.current) return;
                logger.error('[TTS Player] Audio playback error');
                audioElement.current = null;
                playbackActiveRef.current = false;
                resetPlaybackUi();
                retryOrFailPlaybackItem(nextItem, 'playback_error');
            };
            audioElement.current = audio;

            try {
                await audio.play();
                if (requestId !== playbackRequestIdRef.current) {
                    audio.pause();
                    return false;
                }
                retryCount.current = 0;
                logger.info('[OK] [TTS Player] Playing TTS via Audio element');
                return true;
            } catch (playErr) {
                logger.error('[TTS Player] Failed to play audio:', playErr);
                audioElement.current = null;
                playbackActiveRef.current = false;
                resetPlaybackUi();
                markAudioLocked();
                retryOrFailPlaybackItem(nextItem, 'playback_blocked');
                return false;
            }
        },
        [finishPlaybackItem, markAudioLocked, resetPlaybackUi, retryOrFailPlaybackItem, stopActivePlayback]
    );

    const popNextQueueItem = useCallback((): TtsQueueItem | null => {
        const currentQueue = queueRef.current;
        if (currentQueue.length === 0) return null;
        const nextItem = { ...currentQueue[0], status: 'playing' as const };
        const remainingQueue = currentQueue.slice(1);
        queueRef.current = remainingQueue;
        setCurrentItem(nextItem);
        setIsPlaying(true);
        setIsPaused(false);
        setQueue(remainingQueue);
        return nextItem;
    }, []);

    const playNext = useCallback(async () => {
        if (isStartingPlaybackRef.current || playbackActiveRef.current) return;
        isStartingPlaybackRef.current = true;
        playbackActiveRef.current = true;
        const requestId = ++playbackRequestIdRef.current;

        if (!isWebsitePlaybackReady()) {
            resetPlaybackUi();
            releasePlaybackAttempt();
            return;
        }

        const needsAudioReady = !isAudioUnlockedRef.current || audioContext.current?.state !== 'running';
        if ((needsAudioReady && !(await ensureAudioReady())) || !isAudioUnlockedRef.current) {
            resetPlaybackUi();
            releasePlaybackAttempt();
            return;
        }

        const nextItem = popNextQueueItem();
        if (!nextItem) {
            resetPlaybackUi();
            releasePlaybackAttempt();
            return;
        }

        try {
            const started = await playWithWebAudio(nextItem, requestId);
            if (started) {
                releasePlaybackStart();
            } else {
                releasePlaybackAttempt();
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.warn('[TTS Player] Web Audio API failed, falling back to Audio element:', errorMessage);
            const started = await playWithAudioElement(nextItem, requestId);
            if (started) {
                releasePlaybackStart();
            } else {
                releasePlaybackAttempt();
            }
        }
    }, [
        ensureAudioReady,
        isWebsitePlaybackReady,
        playWithAudioElement,
        playWithWebAudio,
        popNextQueueItem,
        releasePlaybackAttempt,
        releasePlaybackStart,
        resetPlaybackUi,
    ]);

    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);
    const clearQueue = useCallback(() => {
        sendDockControlCommand('clear');
        invalidatePlaybackRequests();
        stopActivePlayback();

        queueRef.current = [];
        setQueue([]);
        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
        logger.info('[DELETE] [TTS Player] Queue cleared');
    }, [invalidatePlaybackRequests, sendDockControlCommand, stopActivePlayback]);

    useEffect(() => {
        if (!ttsEnabled) {
            clearQueue();
        }
    }, [ttsEnabled, clearQueue]);

    useEffect(() => {
        if (isPrimaryPlayerTab) {
            return;
        }

        invalidatePlaybackRequests();
        stopActivePlayback();
        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
    }, [invalidatePlaybackRequests, isPrimaryPlayerTab, stopActivePlayback]);

    useEffect(() => {
        if (
            queue.length > 0 &&
            !isPlaying &&
            !currentItem &&
            ttsEnabled &&
            listeningMode === 'website' &&
            isPrimaryPlayerTab &&
            isAudioUnlocked
        ) {
            playNext();
        }
    }, [queue.length, isPlaying, currentItem, ttsEnabled, listeningMode, isPrimaryPlayerTab, isAudioUnlocked, playNext]);

    useEffect(() => {
        if (listeningMode !== 'website' && !isTokenObsDock) {
            clearQueue();
        }
    }, [listeningMode, clearQueue, isTokenObsDock]);

    const addToQueue = useCallback((item: Omit<TtsQueueItem, 'id' | 'timestamp' | 'status'>) => {
        if (!ttsEnabledRef.current) {
            logger.debug('[TTS Player] Skipping queue item (TTS disabled)');
            return;
        }

        if (listeningModeRef.current !== 'website') {
            logger.debug('[TTS Player] Skipping queue item (listening mode is not website)');
            return;
        }

        if (!isPrimaryPlayerTabRef.current) {
            logger.debug('[TTS Player] Skipping queue item (player tab is passive)');
            return;
        }

        const newItem: TtsQueueItem = {
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            status: 'generated',
        };

        const nextQueue = [...queueRef.current, newItem];
        queueRef.current = nextQueue;
        setQueue(nextQueue);
        logger.debug(`[LOG] [TTS Player] Added to queue: ${newItem.text.substring(0, 50)}...`);
    }, []);

    const skipCurrent = useCallback(() => {
        sendDockControlCommand('skip');
        if (currentItem) {
            upsertLiveMessageStatus(
                {
                    source_message_id: currentItem.sourceMessageId,
                    username: currentItem.username,
                    platform: currentItem.platform,
                    text: currentItem.originalText || currentItem.spokenText || currentItem.text,
                },
                'failed',
                'skipped'
            );
        }
        invalidatePlaybackRequests();
        stopActivePlayback();

        setCurrentItem(null);
        setIsPlaying(false);
        setIsPaused(false);
        setTimeout(() => playNext(), 100);
        logger.info('[SKIP] [TTS Player] Skipped current item');
    }, [
        currentItem,
        invalidatePlaybackRequests,
        playNext,
        sendDockControlCommand,
        stopActivePlayback,
        upsertLiveMessageStatus,
    ]);

    const playFromQueue = useCallback(
        (index: number) => {
            const currentQueue = queueRef.current;
            if (index < 0 || index >= currentQueue.length) {
                return;
            }

            const newQueue = currentQueue.slice(index);
            queueRef.current = newQueue;
            setQueue(newQueue);

            invalidatePlaybackRequests();
            stopActivePlayback();

            setCurrentItem(null);
            setIsPlaying(false);
            setIsPaused(false);

            setTimeout(() => playNext(), 100);
            logger.info(`[QUEUE] [TTS Player] Jumped to item #${index + 1}`);
        },
        [invalidatePlaybackRequests, stopActivePlayback, playNext]
    );

    const togglePause = useCallback(() => {
        if (isTokenObsDock) {
            sendDockControlCommand(isPaused ? 'start' : 'stop');
            setIsPaused((value) => !value);
            setIsPlaying((value) => !value);
            return;
        }

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
                    audioElement.current
                        .play()
                        .then(() => {
                            setIsPlaying(true);
                            setIsPaused(false);
                        })
                        .catch(() => {
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
    }, [currentItem, isPaused, isTokenObsDock, sendDockControlCommand]);

    const startPlayback = useCallback(() => {
        if (isTokenObsDock) {
            sendDockControlCommand('start');
            setIsPaused(false);
            setIsPlaying(true);
            return;
        }

        if (isPaused && currentItem) {
            togglePause();
            return;
        }
        window.setTimeout(() => playNextRef.current?.(), 0);
    }, [currentItem, isPaused, isTokenObsDock, sendDockControlCommand, togglePause]);

    const stopPlayback = useCallback(() => {
        if (isTokenObsDock) {
            sendDockControlCommand('stop');
            setIsPaused(true);
            setIsPlaying(false);
            return;
        }

        if (!currentItem) return;
        if (!isPaused) {
            togglePause();
        }
    }, [currentItem, isPaused, isTokenObsDock, sendDockControlCommand, togglePause]);

    const value: TtsPlayerContextValue = {
        queue,
        currentItem,
        liveMessages,
        isPlaying,
        isPaused,
        isPrimaryPlayerTab,
        isAudioUnlocked,
        isSocketConnected,
        addToQueue,
        clearQueue,
        skipCurrent,
        startPlayback,
        stopPlayback,
        playFromQueue,
        togglePause,
        requestPrimaryPlayerTab,
        unlockAudio,
        setOutputVolume,
    };

    return <TtsPlayerContext.Provider value={value}>{children}</TtsPlayerContext.Provider>;
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

