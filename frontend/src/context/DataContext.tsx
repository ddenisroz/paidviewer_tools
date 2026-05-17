import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useLocation } from 'react-router-dom';

import { expandQueryWithAliases, getCategoriesByAlias } from '@/constants/categoryAliases';
import {
    useStreamHistory,
    useTwitchStreamInfo,
    useUpdateStream,
    useVkStreamInfo,
} from '@/queries/stream/streamQueries';
import { streamService } from '@/services/api/services/streamService';
import { useToast } from '@/shared/components/ui/toast';
import { logger } from '@/shared/utils/prodLogger';
import { getQueryCache, getQueryCacheWithMaxAge, setQueryCache } from '@/shared/utils/queryPersist';

import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';

import type { StreamCategory, StreamData, StreamHistory, UpdateStreamPayload } from '@/types/stream';

function normalizeString(str: string): string {
    return str.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getCategoryInitials(categoryName: string): string {
    return normalizeString(categoryName)
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0] ?? '')
        .join('');
}

function getAudienceScore(category: StreamCategory): number {
    const categoryRecord = category as unknown as Record<string, unknown>;
    const rawValue = categoryRecord.viewers ?? categoryRecord.viewer_count ?? 0;
    const normalized = Number(rawValue);
    return Number.isFinite(normalized) ? normalized : 0;
}

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }

    return matrix[b.length][a.length];
}

function calculateRelevance(categoryName: string, query: string): number {
    const catLower = categoryName.toLowerCase();
    const queryLower = query.toLowerCase();

    const catNormalized = normalizeString(categoryName);
    const queryNormalized = normalizeString(query);

    if (catNormalized === queryNormalized) return 0;
    if (catLower === queryLower) return 0.5;
    if (catNormalized.startsWith(queryNormalized)) return 1;

    if (queryNormalized.length >= 2 && queryNormalized.length <= 4) {
        const categoryInitials = getCategoryInitials(categoryName);
        if (categoryInitials === queryNormalized) return 0.75;
        if (categoryInitials.startsWith(queryNormalized)) return 0.9;
    }

    const catWords = catNormalized.split(/\s+/).filter((w) => w.length > 0);
    const queryWords = queryNormalized.split(/\s+/).filter((w) => w.length > 0);

    if (catWords.length > 0 && queryWords.length > 0 && catWords[0] === queryWords[0]) {
        const allWordsPresent = queryWords.every((qw) => catWords.some((cw) => cw === qw || cw.startsWith(qw)));
        if (allWordsPresent) return 2;
        return 3;
    }

    const exactMatches = queryWords.filter((qw) => catWords.some((cw) => cw === qw)).length;
    if (exactMatches === queryWords.length) {
        const wordsInOrder = queryWords.every((qw, idx) => {
            const catIdx = catWords.findIndex((cw) => cw === qw);
            return catIdx >= idx;
        });
        return wordsInOrder ? 4 : 5;
    }

    const startsWithMatches = queryWords.filter((qw) => catWords.some((cw) => cw.startsWith(qw))).length;
    if (startsWithMatches === queryWords.length) {
        return 6;
    }

    if (exactMatches > queryWords.length / 2) {
        return 7 + (queryWords.length - exactMatches);
    }

    if (catNormalized.includes(queryNormalized)) {
        return 10;
    }

    if (exactMatches > 0) {
        return 12 + (5 - exactMatches);
    }

    if (startsWithMatches > 0) {
        return 15 + (5 - startsWithMatches);
    }

    const partialMatches = queryWords.filter((qw) => catWords.some((cw) => cw.includes(qw))).length;
    if (partialMatches > 0) {
        return 20 + (5 - partialMatches);
    }

    if (queryNormalized.length <= 5) {
        let matchCount = 0;
        let lastIndex = -1;
        for (const char of queryNormalized) {
            const index = catNormalized.indexOf(char, lastIndex + 1);
            if (index > lastIndex) {
                matchCount++;
                lastIndex = index;
            }
        }
        const fuzzyScore = matchCount / queryNormalized.length;
        if (fuzzyScore > 0.8) return 30;
    }

    const distance = levenshteinDistance(catNormalized, queryNormalized);
    const maxLength = Math.max(catNormalized.length, queryNormalized.length);
    const similarity = 1 - distance / maxLength;

    if (similarity > 0.8) {
        return 25 + Math.floor(distance);
    }

    const wordFuzzyMatches = queryWords.filter((qw) => {
        return catWords.some((cw) => {
            const wordDist = levenshteinDistance(cw, qw);
            const wordMaxLen = Math.max(cw.length, qw.length);
            const wordSim = 1 - wordDist / wordMaxLen;
            return wordSim > 0.75;
        });
    }).length;

    if (wordFuzzyMatches === queryWords.length) {
        return 28;
    } else if (wordFuzzyMatches > queryWords.length / 2) {
        return 30 + (queryWords.length - wordFuzzyMatches);
    }

    return 100;
}

function sortCategoriesByRelevance(categories: StreamCategory[], query: string): StreamCategory[] {
    if (!query || query.trim() === '') return categories;

    const aliasTargets = new Set(getCategoriesByAlias(query).map((aliasName) => normalizeString(aliasName)));

    return [...categories].sort((a, b) => {
        let scoreA = calculateRelevance(a.name, query);
        let scoreB = calculateRelevance(b.name, query);

        if (aliasTargets.size > 0) {
            if (aliasTargets.has(normalizeString(a.name))) {
                scoreA -= 2;
            }
            if (aliasTargets.has(normalizeString(b.name))) {
                scoreB -= 2;
            }
        }

        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }

        const audienceA = getAudienceScore(a);
        const audienceB = getAudienceScore(b);
        if (audienceA !== audienceB) {
            return audienceB - audienceA;
        }

        return a.name.localeCompare(b.name);
    });
}

function areStreamDataEqual(a: StreamData | null | undefined, b: StreamData | null | undefined): boolean {
    if (!a || !b) return false;
    return (
        (a.twitch?.title || '') === (b.twitch?.title || '') &&
        (a.vk?.title || '') === (b.vk?.title || '') &&
        (a.twitch?.category?.id || null) === (b.twitch?.category?.id || null) &&
        (a.vk?.category?.id || null) === (b.vk?.category?.id || null)
    );
}

type StreamPlatform = 'twitch' | 'vk';

const STREAM_PLATFORMS: StreamPlatform[] = ['twitch', 'vk'];

function isStreamPlatform(value: unknown): value is StreamPlatform {
    return value === 'twitch' || value === 'vk';
}

function cloneStreamData(data: StreamData): StreamData {
    return {
        twitch: { ...data.twitch },
        vk: { ...data.vk },
    };
}

function buildStreamCategory(
    categoryId: unknown,
    rawCategory: unknown,
    fallbackName?: unknown,
    assets?: { box_art_url?: unknown; cover_url?: unknown }
): StreamCategory | null {
    const categoryRecord =
        typeof rawCategory === 'object' && rawCategory !== null ? (rawCategory as Record<string, unknown>) : null;

    const resolvedId = categoryId ?? categoryRecord?.id ?? '';
    const resolvedName = String(
        categoryRecord?.title ??
            categoryRecord?.name ??
            fallbackName ??
            (typeof rawCategory === 'string' ? rawCategory : '')
    ).trim();
    const boxArtUrl = String(categoryRecord?.box_art_url ?? assets?.box_art_url ?? '').trim();
    const coverUrl = String(categoryRecord?.cover_url ?? assets?.cover_url ?? '').trim();

    if (!resolvedName && !resolvedId) {
        return null;
    }

    return {
        id: String(resolvedId ?? ''),
        name: resolvedName,
        title: resolvedName || undefined,
        box_art_url: boxArtUrl || undefined,
        cover_url: coverUrl || undefined,
    };
}

function applyPayloadFieldsForPlatform(
    target: StreamData,
    source: StreamData,
    payload: UpdateStreamPayload,
    platform: StreamPlatform
): void {
    const platformPayload = payload[platform];
    if (!platformPayload) {
        return;
    }

    if (Object.prototype.hasOwnProperty.call(platformPayload, 'title')) {
        target[platform].title = source[platform]?.title || '';
    }

    if (
        Object.prototype.hasOwnProperty.call(platformPayload, 'category_id') ||
        Object.prototype.hasOwnProperty.call(platformPayload, 'category')
    ) {
        target[platform].category = source[platform]?.category || null;
    }
}

interface LoadingState {
    streamData: boolean;
    history: boolean;
    categories: boolean;
}

interface StatusState {
    saveTitle: 'idle' | 'loading' | 'success' | 'error';
    saveCategory: 'idle' | 'loading' | 'success' | 'error';
}

interface CategoriesState {
    twitch: StreamCategory[];
    vk: StreamCategory[];
}

interface DataContextValue {
    initialData: StreamData;
    currentData: StreamData;
    setCurrentData: React.Dispatch<React.SetStateAction<StreamData>>;
    loading: LoadingState;
    status: StatusState;
    saveChanges: (
        customPayload?: UpdateStreamPayload | null,
        statusType?: 'saveTitle' | 'saveCategory'
    ) => Promise<boolean>;
    categories: CategoriesState;
    searchCategories: (platform: 'twitch' | 'vk', query: string) => Promise<StreamCategory[]>;
    streamHistory: StreamHistory | null;
    refreshTrigger: number;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const useData = (): DataContextValue => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

interface DataProviderProps {
    children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { addToast } = useToast();
    const location = useLocation();
    const isDashboardHome = location.pathname === '/dashboard';

    const getCachedStreamData = useCallback((): StreamData => {
        const cached = getQueryCache(['stream-data', user?.id]);
        if (cached) {
            return cached as StreamData;
        }
        return {
            twitch: { title: '', category: null },
            vk: { title: '', category: null },
        };
    }, [user?.id]);

    const [initialData, setInitialData] = useState<StreamData>(getCachedStreamData);
    const [currentData, setCurrentData] = useState<StreamData>(getCachedStreamData);
    const initialDataRef = useRef(initialData);
    const currentDataRef = useRef(currentData);
    const lastServerDataRef = useRef<StreamData | null>(null);

    useEffect(() => {
        initialDataRef.current = initialData;
    }, [initialData]);

    useEffect(() => {
        currentDataRef.current = currentData;
    }, [currentData]);

    useEffect(() => {
        const cached = getQueryCache(['stream-data', user?.id]);
        if (
            cached &&
            ((cached as StreamData).twitch?.title ||
                (cached as StreamData).twitch?.category ||
                (cached as StreamData).vk?.title ||
                (cached as StreamData).vk?.category)
        ) {
            setInitialData(cached as StreamData);
            setCurrentData(cached as StreamData);
        }
    }, [user?.id, integrations.twitch?.enabled, integrations.vk?.enabled]);

    const [categories, setCategories] = useState<CategoriesState>({
        twitch: [],
        vk: [],
    });

    const [loading, setLoading] = useState<LoadingState>({
        streamData: false,
        history: false,
        categories: false,
    });

    const [streamHistory, setStreamHistory] = useState<StreamHistory | null>(null);

    const [status, setStatus] = useState<StatusState>({
        saveTitle: 'idle',
        saveCategory: 'idle',
    });

    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const updateStreamMutation = useUpdateStream({
        onSuccess: () => {
            // Автоматически инвалидирует кэш и обновляет данные
        },
    });

    const {
        data: historyData,
        isLoading: isLoadingHistory,
        refetch: _refetchHistory,
    } = useStreamHistory({
        enabled: !!isAuthenticated && isDashboardHome,
        refetchInterval: isDashboardHome ? 60000 : false,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        setLoading((prev) => ({ ...prev, history: isLoadingHistory }));
    }, [isLoadingHistory]);

    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (historyData) {
            const historyResponse = historyData?.data || historyData;
            setStreamHistory(historyResponse);
        }
    }, [historyData]);

    const {
        data: twitchData,
        isLoading: isLoadingTwitch,
        refetch: refetchTwitch,
    } = useTwitchStreamInfo({
        enabled: !!isAuthenticated && isDashboardHome && !!integrations.twitch?.enabled,
        refetchInterval: false,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const {
        data: vkData,
        isLoading: isLoadingVk,
        refetch: refetchVk,
    } = useVkStreamInfo({
        enabled: !!isAuthenticated && isDashboardHome && !!integrations.vk?.enabled,
        refetchInterval: false,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const combinedStreamData = useMemo<StreamData>(() => {
        const data: StreamData = {
            twitch: { title: '', category: null },
            vk: { title: '', category: null },
        };

        if (twitchData?.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const twitch = twitchData.data as any;
            data.twitch.title = twitch.title || '';
            data.twitch.category = buildStreamCategory(
                twitch.game_id ?? twitch.category_id,
                twitch.category,
                twitch.game || twitch.game_name || twitch.category_name,
                {
                    box_art_url: twitch.game_box_art_url || twitch.box_art_url,
                    cover_url: twitch.cover_url,
                }
            );
        }

        if (vkData?.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vk = vkData.data as any;
            data.vk.title = vk.title || '';
            data.vk.category = buildStreamCategory(vk.category_id, vk.category, vk.category_name, {
                box_art_url: vk.category?.box_art_url,
                cover_url: vk.category?.cover_url || vk.category_img_url,
            });
        }

        return data;
    }, [twitchData, vkData]);

    const isLoadingStreamData = isLoadingTwitch || isLoadingVk;
    useEffect(() => {
        setLoading((prev) => ({ ...prev, streamData: isLoadingStreamData }));
    }, [isLoadingStreamData]);

    // Track if it's the first load to allow initial population
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    useEffect(() => {
        if (
            combinedStreamData &&
            (combinedStreamData.twitch.title ||
                combinedStreamData.vk.title ||
                combinedStreamData.twitch.category ||
                combinedStreamData.vk.category)
        ) {
            const lastServerData = lastServerDataRef.current;
            if (lastServerData && areStreamDataEqual(lastServerData, combinedStreamData)) {
                return;
            }
            lastServerDataRef.current = combinedStreamData;

            const latestInitialData = initialDataRef.current;
            const latestCurrentData = currentDataRef.current;
            // Check if user has unsaved changes
            // We compare strict equality of objects/strings to ensure we don't overwrite if user is typing
            // Note: This simple check assumes equality works.
            // Better: Compare serialized or field-by-field if structure is complex.
            // For now, we assume if initialData matches currentData, it's pristine.

            const isTwitchExistent = !!latestInitialData.twitch;
            const isVkExistent = !!latestInitialData.vk;

            // Check if modified (simplified check)
            let isModified = false;

            if (isTwitchExistent) {
                if (latestInitialData.twitch.title !== latestCurrentData.twitch.title) isModified = true;
                if (latestInitialData.twitch.category?.id !== latestCurrentData.twitch.category?.id) isModified = true;
            }
            if (isVkExistent) {
                if (latestInitialData.vk.title !== latestCurrentData.vk.title) isModified = true;
                if (latestInitialData.vk.category?.id !== latestCurrentData.vk.category?.id) isModified = true;
            }

            // Only overwrite currentData if NOT modified OR it's the first load
            if (!isModified || isFirstLoad) {
                setCurrentData(combinedStreamData);
                if (isFirstLoad) {
                    setIsFirstLoad(false);
                }
            }

            // Always update initialData to the fresh server state
            setInitialData(combinedStreamData);
            setQueryCache(['stream-data', user?.id], combinedStreamData);
            if (!areStreamDataEqual(latestInitialData, combinedStreamData)) {
                setRefreshTrigger((prev) => prev + 1);
            }
        }
    }, [combinedStreamData, user?.id, isFirstLoad]);

    const loadStreamData = useCallback(
        async (force: boolean = false): Promise<void> => {
            if (!isAuthenticated) {
                return;
            }
            if (force) {
                const promises: Promise<unknown>[] = [];
                if (integrations.twitch?.enabled) promises.push(refetchTwitch());
                if (integrations.vk?.enabled) promises.push(refetchVk());
                await Promise.all(promises);
            }
        },
        [isAuthenticated, integrations.twitch?.enabled, integrations.vk?.enabled, refetchTwitch, refetchVk]
    );

    const saveChanges = useCallback(
        async (
            customPayload: UpdateStreamPayload | null = null,
            statusType: 'saveTitle' | 'saveCategory' = 'saveTitle'
        ): Promise<boolean> => {
            setStatus((prev) => ({ ...prev, [statusType]: 'loading' }));
            let payload: UpdateStreamPayload | null = customPayload;
            let changesFound = false;

            if (!payload) {
                payload = { twitch: {}, vk: {} };

                if (integrations.twitch?.enabled) {
                    if (initialData.twitch.title !== currentData.twitch.title) {
                        payload.twitch!.title = currentData.twitch.title;
                        changesFound = true;
                    }
                    if (initialData.twitch.category?.id !== currentData.twitch.category?.id) {
                        payload.twitch!.category_id = currentData.twitch.category?.id;
                        changesFound = true;
                    }
                }

                if (integrations.vk?.enabled) {
                    if (initialData.vk.title !== currentData.vk.title) {
                        payload.vk!.title = currentData.vk.title;
                        changesFound = true;
                    }
                    if (initialData.vk.category?.id !== currentData.vk.category?.id) {
                        const vkCategoryPayload: {
                            id: string;
                            name: string;
                            title: string;
                            type: string;
                            cover_url?: string;
                        } = {
                            id: currentData.vk.category!.id,
                            name: currentData.vk.category!.name,
                            title: currentData.vk.category!.name,
                            type: (currentData.vk.category as { type?: string }).type || 'games',
                            cover_url:
                                (currentData.vk.category as { box_art_url?: string; cover_url?: string }).box_art_url ||
                                (currentData.vk.category as { cover_url?: string }).cover_url ||
                                '',
                        };

                        payload.vk!.category = vkCategoryPayload;
                        payload.vk!.category_id = currentData.vk.category?.id;
                        changesFound = true;
                    }
                }

                if (!changesFound) {
                    setStatus((prev) => ({ ...prev, [statusType]: 'idle' }));
                    addToast({ type: 'info', title: 'Информация', message: 'Нет изменений для сохранения.' });
                    return false;
                }
            } else {
                changesFound = Object.keys(payload).length > 0;
            }

            if (!changesFound) {
                setStatus((prev) => ({ ...prev, [statusType]: 'idle' }));
                addToast({ type: 'info', title: 'Информация', message: 'Нет изменений для сохранения.' });
                return false;
            }

            logger.log('[SEND] [DataContext] Final payload before sending:', JSON.stringify(payload, null, 2));

            try {
                await updateStreamMutation.mutateAsync(payload as unknown as Record<string, unknown>);

                const latest = currentDataRef.current;
                const previousInitial = initialDataRef.current;
                const nextInitial = cloneStreamData(previousInitial);
                for (const platform of STREAM_PLATFORMS) {
                    applyPayloadFieldsForPlatform(nextInitial, latest, payload as UpdateStreamPayload, platform);
                }

                setStatus((prev) => ({ ...prev, [statusType]: 'success' }));
                setInitialData(nextInitial);
                setQueryCache(['stream-data', user?.id], nextInitial);
                setTimeout(() => setStatus((prev) => ({ ...prev, [statusType]: 'idle' })), 3000);
                return true;
            } catch (error: unknown) {
                setStatus((prev) => ({ ...prev, [statusType]: 'error' }));
                logger.error('[ERROR] [DATA CONTEXT] Error saving changes:', error);

                const errorResponse = error as {
                    response?: {
                        status?: number;
                        data?: {
                            message?: unknown;
                            detail?: unknown;
                            updated_platforms?: unknown[];
                            failed_platforms?: unknown[];
                        };
                    };
                };
                const errorData = errorResponse.response?.data;
                const detailObject =
                    errorData?.detail != null && typeof errorData.detail === 'object'
                        ? (errorData.detail as Record<string, unknown>)
                        : undefined;
                const backendMessageRaw = errorData?.message ?? detailObject?.message ?? errorData?.detail;
                const backendMessage =
                    typeof backendMessageRaw === 'string'
                        ? backendMessageRaw
                        : backendMessageRaw != null && typeof backendMessageRaw === 'object'
                          ? JSON.stringify(backendMessageRaw)
                          : undefined;
                const rawUpdatedPlatforms = Array.isArray(errorData?.updated_platforms)
                    ? errorData.updated_platforms
                    : Array.isArray(detailObject?.updated_platforms)
                      ? (detailObject.updated_platforms as unknown[])
                      : [];
                const rawFailedPlatforms = Array.isArray(errorData?.failed_platforms)
                    ? errorData.failed_platforms
                    : Array.isArray(detailObject?.failed_platforms)
                      ? (detailObject.failed_platforms as unknown[])
                      : [];
                const updatedPlatforms = rawUpdatedPlatforms.filter(isStreamPlatform);
                const failedPlatforms = rawFailedPlatforms.filter(isStreamPlatform);
                const hasPartialSuccess = updatedPlatforms.length > 0;

                if (errorResponse.response?.status === 401) {
                    addToast({
                        type: 'error',
                        title: 'Токен истек',
                        message: 'Пожалуйста, переавторизуйтесь в Twitch для продолжения работы.',
                    });
                } else {
                    addToast({
                        type: 'error',
                        title: 'Ошибка',
                        message: backendMessage || 'Не удалось сохранить изменения. Данные откатываются...',
                    });
                }

                if (hasPartialSuccess) {
                    logger.log('[PARTIAL] [DATA CONTEXT] Applying partial stream update result', {
                        updatedPlatforms,
                        failedPlatforms,
                    });

                    const latest = currentDataRef.current;
                    const previousInitial = initialDataRef.current;
                    const nextInitial = cloneStreamData(previousInitial);
                    const nextCurrent = cloneStreamData(latest);

                    for (const platform of updatedPlatforms) {
                        applyPayloadFieldsForPlatform(nextInitial, latest, payload as UpdateStreamPayload, platform);
                    }

                    for (const platform of failedPlatforms) {
                        applyPayloadFieldsForPlatform(
                            nextCurrent,
                            previousInitial,
                            payload as UpdateStreamPayload,
                            platform
                        );
                    }

                    setInitialData(nextInitial);
                    setCurrentData(nextCurrent);
                    setQueryCache(['stream-data', user?.id], nextInitial);
                } else {
                    logger.log('[REFRESH] [DATA CONTEXT] Rolling back to server data...');
                    const rollbackSnapshot = initialDataRef.current;
                    setCurrentData(rollbackSnapshot);
                    setQueryCache(['stream-data', user?.id], rollbackSnapshot);
                }

                loadStreamData(true);
                setTimeout(() => setStatus((prev) => ({ ...prev, [statusType]: 'idle' })), 3000);
                return false;
            }
        },
        [
            initialData,
            currentData,
            integrations.twitch?.enabled,
            integrations.vk?.enabled,
            user?.id,
            loadStreamData,
            addToast,
            updateStreamMutation,
        ]
    );

    const searchCategories = useCallback(
        async (platform: 'twitch' | 'vk', query: string): Promise<StreamCategory[]> => {
            logger.log('DataContext: Searching categories:', {
                platform,
                query,
                enabled: integrations[platform]?.enabled,
                isAuthenticated,
                integrationsLoading,
            });

            if (!isAuthenticated) {
                logger.log('DataContext: User not authenticated, skipping search');
                addToast({
                    type: 'error',
                    title: 'Требуется авторизация',
                    message: 'Пожалуйста, войдите в систему для поиска категорий.',
                });
                return [];
            }

            if (integrationsLoading) {
                logger.log('DataContext: Integrations still loading, skipping search');
                return [];
            }

            if (!integrations[platform]?.enabled) {
                logger.log('DataContext: Platform not enabled, skipping search');
                return [];
            }

            const cacheKey = ['stream-categories', platform, query.toLowerCase()];
            const cachedCategories = getQueryCacheWithMaxAge<StreamCategory[]>(cacheKey, 10 * 60 * 1000);
            if (cachedCategories && cachedCategories.length > 0) {
                setCategories((prev) => ({ ...prev, [platform]: cachedCategories }));
                return cachedCategories;
            }

            setLoading((prev) => ({ ...prev, categories: true }));
            try {
                const expandedQueries = expandQueryWithAliases(query);
                logger.log('[DEBUG] DataContext: Expanded queries:', { original: query, expanded: expandedQueries });

                const requests = expandedQueries.map(async (searchQuery: string) => {
                    try {
                        if (platform === 'twitch') {
                            const response = await streamService.getTwitchCategories(searchQuery);
                            return response.data;
                        } else if (platform === 'vk') {
                            const response = await streamService.getVkCategories(searchQuery);
                            return response.data;
                        }
                        return { categories: [] };
                    } catch (err) {
                        logger.warn(`Search failed for query "${searchQuery}":`, err);
                        return { categories: [] };
                    }
                });

                const responses = await Promise.all(requests);
                logger.log('[DEBUG] DataContext: All API responses received');

                const allCategories = new Map<string, StreamCategory>();

                for (const response of responses) {
                    let categoryData: StreamCategory[] = [];

                    // API returns {"categories": [...]} directly in response.data
                    // So response here is already the unwrapped data object
                    const responseObj = response as { categories?: StreamCategory[] };
                    if (responseObj.categories && Array.isArray(responseObj.categories)) {
                        categoryData = responseObj.categories;
                    } else if (Array.isArray(response)) {
                        categoryData = response as StreamCategory[];
                    }

                    categoryData.forEach((cat) => {
                        if (cat.id && !allCategories.has(cat.id)) {
                            allCategories.set(cat.id, cat);
                        }
                    });
                }

                let mergedCategories = Array.from(allCategories.values());
                mergedCategories = sortCategoriesByRelevance(mergedCategories, query);

                logger.log('[TARGET] DataContext: Smart search complete:', {
                    query,
                    totalFound: mergedCategories.length,
                    top3: mergedCategories.slice(0, 3).map((c) => c.name),
                });

                setCategories((prev) => ({ ...prev, [platform]: mergedCategories }));
                setQueryCache(cacheKey, mergedCategories);

                return mergedCategories;
            } catch (error: unknown) {
                logger.error(`Error searching ${platform} categories:`, error);
                const errorResponse = error as { response?: { status?: number }; message?: string };
                if (errorResponse.response?.status === 401) {
                    logger.log('DataContext: Authentication required for category search');
                    addToast({
                        type: 'error',
                        title: 'Требуется авторизация',
                        message: 'Пожалуйста, войдите в систему для поиска категорий.',
                    });
                } else {
                    logger.log('DataContext: Other error during search:', errorResponse.message);
                    addToast({
                        type: 'error',
                        title: 'Ошибка поиска',
                        message: `Не удалось найти категории: ${errorResponse.message || 'Неизвестная ошибка'}`,
                    });
                }
                return [];
            } finally {
                setLoading((prev) => ({ ...prev, categories: false }));
            }
        },
        [integrations, addToast, isAuthenticated, integrationsLoading]
    );

    const value = useMemo<DataContextValue>(
        () => ({
            initialData,
            currentData,
            setCurrentData,
            loading,
            status,
            saveChanges,
            categories,
            searchCategories,
            streamHistory,
            refreshTrigger,
        }),
        [
            initialData,
            currentData,
            loading,
            status,
            saveChanges,
            categories,
            searchCategories,
            streamHistory,
            refreshTrigger,
        ]
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
