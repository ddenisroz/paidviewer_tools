import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';
import { useToast } from '../components/ui/toast';
import { expandQueryWithAliases } from '../constants/categoryAliases';
import { logger } from '../utils/prodLogger';
import { getQueryCache, setQueryCache } from '../utils/queryPersist';
import { useStreamHistory, useTwitchStreamInfo, useVkStreamInfo, useUpdateStream } from '../queries/stream/streamQueries';
import { streamService } from '../services/api/services/streamService';
import type { StreamData, StreamCategory, StreamHistory, UpdateStreamPayload } from '../types/stream';

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
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
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
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
    
    const catWords = catNormalized.split(/\s+/).filter(w => w.length > 0);
    const queryWords = queryNormalized.split(/\s+/).filter(w => w.length > 0);
    
    if (catWords.length > 0 && queryWords.length > 0 && catWords[0] === queryWords[0]) {
        const allWordsPresent = queryWords.every(qw => catWords.some(cw => cw === qw || cw.startsWith(qw)));
        if (allWordsPresent) return 2;
        return 3;
    }
    
    const exactMatches = queryWords.filter(qw => catWords.some(cw => cw === qw)).length;
    if (exactMatches === queryWords.length) {
        const wordsInOrder = queryWords.every((qw, idx) => {
            const catIdx = catWords.findIndex(cw => cw === qw);
            return catIdx >= idx;
        });
        return wordsInOrder ? 4 : 5;
    }
    
    const startsWithMatches = queryWords.filter(qw => catWords.some(cw => cw.startsWith(qw))).length;
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
    
    const partialMatches = queryWords.filter(qw => catWords.some(cw => cw.includes(qw))).length;
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
    const similarity = 1 - (distance / maxLength);
    
    if (similarity > 0.8) {
        return 25 + Math.floor(distance);
    }
    
    const wordFuzzyMatches = queryWords.filter(qw => {
        return catWords.some(cw => {
            const wordDist = levenshteinDistance(cw, qw);
            const wordMaxLen = Math.max(cw.length, qw.length);
            const wordSim = 1 - (wordDist / wordMaxLen);
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
    
    return [...categories].sort((a, b) => {
        const scoreA = calculateRelevance(a.name, query);
        const scoreB = calculateRelevance(b.name, query);
        
        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        
        return a.name.localeCompare(b.name);
    });
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
    saveChanges: (customPayload?: UpdateStreamPayload | null, statusType?: 'saveTitle' | 'saveCategory') => void;
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
    
    useEffect(() => {
        const cached = getQueryCache(['stream-data', user?.id]);
        if (cached && ((cached as StreamData).twitch?.title || (cached as StreamData).twitch?.category || (cached as StreamData).vk?.title || (cached as StreamData).vk?.category)) {
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

    const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useStreamHistory({
        enabled: isAuthenticated,
        refetchInterval: 30000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        setLoading(prev => ({ ...prev, history: isLoadingHistory }));
    }, [isLoadingHistory]);
    
    // React Query v5: onSuccess moved to useEffect
    useEffect(() => {
        if (historyData) {
            const historyResponse = historyData?.data || historyData;
            setStreamHistory(historyResponse);
        }
    }, [historyData]);

    const loadStreamHistory = useCallback(async (force: boolean = false): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }
        if (force) {
            await refetchHistory();
        }
    }, [isAuthenticated, refetchHistory]);

    const { data: twitchData, isLoading: isLoadingTwitch, refetch: refetchTwitch } = useTwitchStreamInfo({
        enabled: isAuthenticated && integrations.twitch?.enabled,
        refetchInterval: 60000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const { data: vkData, isLoading: isLoadingVk, refetch: refetchVk } = useVkStreamInfo({
        enabled: isAuthenticated && integrations.vk?.enabled,
        refetchInterval: 60000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const combinedStreamData = useMemo<StreamData>(() => {
        const data: StreamData = {
            twitch: { title: '', category: null },
            vk: { title: '', category: null },
        };

        if (twitchData?.data) {
            const twitch = twitchData.data as any;
            data.twitch.title = twitch.title || '';
            data.twitch.category = twitch.game_id ? { id: twitch.game_id, name: twitch.game } : null;
        }

        if (vkData?.data) {
            const vk = vkData.data as any;
            data.vk.title = vk.title || '';
            data.vk.category = vk.category_id ? { id: vk.category_id, name: vk.category } : null;
        }

        return data;
    }, [twitchData, vkData]);

    const isLoadingStreamData = isLoadingTwitch || isLoadingVk;
    useEffect(() => {
        setLoading(prev => ({ ...prev, streamData: isLoadingStreamData }));
    }, [isLoadingStreamData]);

    useEffect(() => {
        if (combinedStreamData && (combinedStreamData.twitch.title || combinedStreamData.vk.title || combinedStreamData.twitch.category || combinedStreamData.vk.category)) {
            setInitialData(combinedStreamData);
            setCurrentData(combinedStreamData);
            setQueryCache(['stream-data', user?.id], combinedStreamData);
            setRefreshTrigger(prev => prev + 1);
        }
    }, [combinedStreamData, user?.id]);

    const loadStreamData = useCallback(async (force: boolean = false): Promise<void> => {
        if (!isAuthenticated) {
            return;
        }
        if (force) {
            if (integrations.twitch?.enabled) {
                await refetchTwitch();
            }
            if (integrations.vk?.enabled) {
                await refetchVk();
            }
        }
    }, [isAuthenticated, integrations.twitch?.enabled, integrations.vk?.enabled, refetchTwitch, refetchVk]);

    const saveChanges = useCallback((customPayload: UpdateStreamPayload | null = null, statusType: 'saveTitle' | 'saveCategory' = 'saveTitle'): void => {
        setStatus(prev => ({ ...prev, [statusType]: 'loading' }));
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
                    const vkCategoryPayload = {
                        id: currentData.vk.category!.id,
                        name: currentData.vk.category!.name,
                        title: currentData.vk.category!.name,
                        type: currentData.vk.category!.type || "games"
                    };
                    
                    const coverUrl = currentData.vk.category!.box_art_url || currentData.vk.category!.cover_url || "";
                    if (coverUrl) {
                        (vkCategoryPayload as any).cover_url = coverUrl;
                    }
                    
                    payload.vk!.category = vkCategoryPayload;
                    payload.vk!.category_id = currentData.vk.category?.id;
                    changesFound = true;
                }
            }

            if (!changesFound) {
                setStatus(prev => ({ ...prev, [statusType]: 'idle' }));
                addToast({ type: 'info', title: 'Информация', message: 'Нет изменений для сохранения.' });
                return;
            }
        } else {
            changesFound = Object.keys(payload).length > 0;
        }

        if (!changesFound) {
            setStatus(prev => ({ ...prev, [statusType]: 'idle' }));
            addToast({ type: 'info', title: 'Информация', message: 'Нет изменений для сохранения.' });
            return;
        }

        logger.log('📤 [DataContext] Final payload before sending:', JSON.stringify(payload, null, 2));

        updateStreamMutation.mutate(payload, {
            onSuccess: () => {
                setStatus(prev => ({ ...prev, [statusType]: 'success' }));
                setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
            },
            onError: (error: any) => {
                setStatus(prev => ({ ...prev, [statusType]: 'error' }));
                logger.error('❌ [DATA CONTEXT] Error saving changes:', error);
                
                if (error.response?.status === 401) {
                    addToast({ 
                        type: 'error', 
                        title: 'Токен истек', 
                        message: 'Пожалуйста, переавторизуйтесь в Twitch для продолжения работы.' 
                    });
                } else {
                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить изменения. Данные откатываются...' });
                }
                
                logger.log('🔄 [DATA CONTEXT] Rolling back to server data...');
                loadStreamData(true);
                setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
            },
        });
    }, [initialData, currentData, integrations.twitch?.enabled, integrations.vk?.enabled, loadStreamData, addToast, updateStreamMutation]);
    
    const searchCategories = useCallback(async (platform: 'twitch' | 'vk', query: string): Promise<StreamCategory[]> => {
        logger.log('DataContext: Searching categories:', { 
            platform, 
            query, 
            enabled: integrations[platform]?.enabled,
            isAuthenticated,
            integrationsLoading 
        });
        
        if (!isAuthenticated) {
            logger.log('DataContext: User not authenticated, skipping search');
            addToast({ 
                type: 'error', 
                title: 'Требуется авторизация', 
                message: 'Пожалуйста, войдите в систему для поиска категорий.' 
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
        
        setLoading(prev => ({ ...prev, categories: true }));
        try {
            const expandedQueries = expandQueryWithAliases(query);
            logger.log('🔍 DataContext: Expanded queries:', { original: query, expanded: expandedQueries });
            
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
            logger.log('🔍 DataContext: All API responses received');
            
            const allCategories = new Map<string, StreamCategory>();
            
            for (const response of responses) {
                let categoryData: StreamCategory[] = [];
                
                if (platform === 'vk' && (response as any).data?.categories) {
                    categoryData = Array.isArray((response as any).data.categories) ? (response as any).data.categories : [];
                } else if (platform === 'twitch' && (response as any).data?.categories) {
                    categoryData = Array.isArray((response as any).data.categories) ? (response as any).data.categories : [];
                } else if (Array.isArray((response as any).data)) {
                    categoryData = (response as any).data;
                } else if ((response as any).data) {
                    categoryData = Array.isArray((response as any).data) ? (response as any).data : [];
                }
                
                categoryData.forEach(cat => {
                    if (cat.id && !allCategories.has(cat.id)) {
                        allCategories.set(cat.id, cat);
                    }
                });
            }
            
            let mergedCategories = Array.from(allCategories.values());
            mergedCategories = sortCategoriesByRelevance(mergedCategories, query);
            
            logger.log('🎯 DataContext: Smart search complete:', { 
                query, 
                totalFound: mergedCategories.length,
                top3: mergedCategories.slice(0, 3).map(c => c.name)
            });
            
            setCategories(prev => ({...prev, [platform]: mergedCategories}));
            
            return mergedCategories;
        } catch (error: any) {
            logger.error(`Error searching ${platform} categories:`, error);
            if (error.response?.status === 401) {
                logger.log('DataContext: Authentication required for category search');
                addToast({ 
                    type: 'error', 
                    title: 'Требуется авторизация', 
                    message: 'Пожалуйста, войдите в систему для поиска категорий.' 
                });
            } else {
                logger.log('DataContext: Other error during search:', error.message);
                addToast({ 
                    type: 'error', 
                    title: 'Ошибка поиска', 
                    message: `Не удалось найти категории: ${error.message}` 
                });
            }
            return [];
        } finally {
            setLoading(prev => ({ ...prev, categories: false }));
        }
    }, [integrations.twitch?.enabled, integrations.vk?.enabled, addToast, isAuthenticated, integrationsLoading]);

    const value = useMemo<DataContextValue>(() => ({
        initialData,
        currentData,
        setCurrentData,
        loading,
        status,
        saveChanges,
        categories,
        searchCategories,
        streamHistory,
        refreshTrigger
    }), [
        initialData, currentData, loading, status, saveChanges, categories, searchCategories, streamHistory, refreshTrigger
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

