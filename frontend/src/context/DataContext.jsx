import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';
import { useToast } from '../components/ui/toast';
import { expandQueryWithAliases } from '../constants/categoryAliases';
import { logger } from '../utils/prodLogger';
import { getQueryCache, setQueryCache } from '../utils/queryPersist';
import { useStreamHistory, useTwitchStreamInfo, useVkStreamInfo, useUpdateStream, useTwitchCategories, useVkCategories } from '../queries/stream/streamQueries';
import { streamService } from '../services/api/services/streamService';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

/**
 * Нормализует строку для сравнения (убирает дефисы, тире, множественные пробелы)
 */
function normalizeString(str) {
    return str
        .toLowerCase()
        .replace(/[\-–—]/g, ' ')  // Заменяем дефисы и тире на пробелы
        .replace(/\s+/g, ' ')      // Убираем множественные пробелы
        .trim();
}

/**
 * Вычисляет расстояние Левенштейна между двумя строками (для fuzzy matching)
 * @param {string} a - Первая строка
 * @param {string} b - Вторая строка
 * @returns {number} - Количество изменений (вставок, удалений, замен)
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    
    // Инициализация первой строки и столбца
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Заполнение матрицы
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // замена
                    matrix[i][j - 1] + 1,     // вставка
                    matrix[i - 1][j] + 1      // удаление
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Вычисляет релевантность категории для запроса
 * Чем меньше score, тем выше релевантность
 * УПРОЩЕННАЯ И УЛУЧШЕННАЯ ВЕРСИЯ
 */
function calculateRelevance(categoryName, query) {
    const catLower = categoryName.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Нормализованные версии (дефисы → пробелы, множественные пробелы → один)
    const catNormalized = normalizeString(categoryName);
    const queryNormalized = normalizeString(query);
    
    // 1. Точное совпадение (с нормализацией) - наивысший приоритет
    if (catNormalized === queryNormalized) return 0;
    
    // 1.5. Точное совпадение БЕЗ нормализации (например, одинаковые дефисы)
    if (catLower === queryLower) return 0.5;
    
    // 2. Начинается с запроса (с нормализацией) - очень высокий приоритет
    if (catNormalized.startsWith(queryNormalized)) return 1;
    
    // Разбиваем на слова (используем НОРМАЛИЗОВАННЫЕ строки!)
    const catWords = catNormalized.split(/\s+/).filter(w => w.length > 0);
    const queryWords = queryNormalized.split(/\s+/).filter(w => w.length > 0);
    
    // 3. Первое слово категории точно совпадает с первым словом запроса
    if (catWords.length > 0 && queryWords.length > 0 && catWords[0] === queryWords[0]) {
        // Если все остальные слова тоже есть - супер приоритет
        const allWordsPresent = queryWords.every(qw => catWords.some(cw => cw === qw || cw.startsWith(qw)));
        if (allWordsPresent) return 2;
        return 3;
    }
    
    // 4. Все слова запроса есть в категории (точные совпадения)
    const exactMatches = queryWords.filter(qw => catWords.some(cw => cw === qw)).length;
    if (exactMatches === queryWords.length) {
        // Проверяем порядок слов
        const wordsInOrder = queryWords.every((qw, idx) => {
            const catIdx = catWords.findIndex(cw => cw === qw);
            return catIdx >= idx;
        });
        return wordsInOrder ? 4 : 5;
    }
    
    // 5. Все слова начинаются с запроса
    const startsWithMatches = queryWords.filter(qw => catWords.some(cw => cw.startsWith(qw))).length;
    if (startsWithMatches === queryWords.length) {
        return 6;
    }
    
    // 6. Большинство слов совпадают
    if (exactMatches > queryWords.length / 2) {
        return 7 + (queryWords.length - exactMatches);
    }
    
    // 7. Содержит всю строку запроса целиком (с нормализацией)
    if (catNormalized.includes(queryNormalized)) {
        return 10;
    }
    
    // 8. Хотя бы одно слово полностью совпадает
    if (exactMatches > 0) {
        return 12 + (5 - exactMatches); // Чем больше совпадений, тем лучше
    }
    
    // 9. Хотя бы одно слово начинается с запроса
    if (startsWithMatches > 0) {
        return 15 + (5 - startsWithMatches);
    }
    
    // 10. Частичные совпадения внутри слов
    const partialMatches = queryWords.filter(qw => catWords.some(cw => cw.includes(qw))).length;
    if (partialMatches > 0) {
        return 20 + (5 - partialMatches);
    }
    
    // 11. Нечеткое совпадение по символам (только для коротких запросов)
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
    
    // 12. Fuzzy matching по расстоянию Левенштейна (для опечаток)
    // "conter strike" vs "counter strike" → distance = 1
    const distance = levenshteinDistance(catNormalized, queryNormalized);
    const maxLength = Math.max(catNormalized.length, queryNormalized.length);
    const similarity = 1 - (distance / maxLength);
    
    // Если похожесть > 80% (1-2 опечатки в слове из 10-15 символов)
    if (similarity > 0.8) {
        return 25 + Math.floor(distance); // Чем меньше расстояние, тем выше приоритет
    }
    
    // Fuzzy matching для отдельных слов (по словам)
    const wordFuzzyMatches = queryWords.filter(qw => {
        return catWords.some(cw => {
            const wordDist = levenshteinDistance(cw, qw);
            const wordMaxLen = Math.max(cw.length, qw.length);
            const wordSim = 1 - (wordDist / wordMaxLen);
            return wordSim > 0.75; // 75% похожести для слова
        });
    }).length;
    
    if (wordFuzzyMatches === queryWords.length) {
        // Все слова найдены с небольшими опечатками
        return 28;
    } else if (wordFuzzyMatches > queryWords.length / 2) {
        // Больше половины слов найдены
        return 30 + (queryWords.length - wordFuzzyMatches);
    }
    
    // Не релевантно
    return 100;
}

/**
 * Сортирует категории по релевантности к запросу
 */
function sortCategoriesByRelevance(categories, query) {
    if (!query || query.trim() === '') return categories;
    
    return [...categories].sort((a, b) => {
        const scoreA = calculateRelevance(a.name, query);
        const scoreB = calculateRelevance(b.name, query);
        
        if (scoreA !== scoreB) {
            return scoreA - scoreB; // Меньший score = выше приоритет
        }
        
        // При одинаковом score сортируем по алфавиту
        return a.name.localeCompare(b.name);
    });
}

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { addToast } = useToast();

    // 🚀 ANTI-FLASH: Инициализируем данные из кэша для предотвращения мерцания
    const getCachedStreamData = useCallback(() => {
        const cached = getQueryCache(['stream-data', user?.id]);
        if (cached) {
            return cached;
        }
        return {
            twitch: { title: '', category: null },
            vk: { title: '', category: null },
        };
    }, [user?.id]);

    // State for initial data loaded from server
    const [initialData, setInitialData] = useState(getCachedStreamData);

    // State for current data being edited by user
    const [currentData, setCurrentData] = useState(getCachedStreamData);
    
    // 🔄 Обновляем данные из кэша при изменении user или интеграций
    useEffect(() => {
        const cached = getQueryCache(['stream-data', user?.id]);
        if (cached && (cached.twitch?.title || cached.twitch?.category || cached.vk?.title || cached.vk?.category)) {
            setInitialData(cached);
            setCurrentData(cached);
        }
    }, [user?.id, integrations.twitch?.enabled, integrations.vk?.enabled]);
    
    // State for category search results
    const [categories, setCategories] = useState({
        twitch: [],
        vk: [],
    });

    const [loading, setLoading] = useState({
        streamData: false,
        history: false,
        categories: false,
    });
    
    // State for stream history data
    const [streamHistory, setStreamHistory] = useState(null);
    
    const [status, setStatus] = useState({
        saveTitle: 'idle', // idle, loading, success, error
        saveCategory: 'idle', // idle, loading, success, error
    });
    
    // Force re-render trigger
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // React Query mutation для обновления стрима
    const updateStreamMutation = useUpdateStream({
        onSuccess: () => {
            // Автоматически инвалидирует кэш и обновляет данные
        },
    });

    // React Query hook для истории стримов
    const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useStreamHistory({
        enabled: isAuthenticated,
        refetchInterval: 30000, // 30 секунд
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            const historyResponse = data?.data || data;
            setStreamHistory(historyResponse);
        },
    });

    // Обновляем loading состояние из React Query
    useEffect(() => {
        setLoading(prev => ({ ...prev, history: isLoadingHistory }));
    }, [isLoadingHistory]);

    // Обертка для совместимости
    const loadStreamHistory = useCallback(async (force = false) => {
        if (!isAuthenticated) {
            return;
        }
        if (force) {
            await refetchHistory();
        }
    }, [isAuthenticated, refetchHistory]);

    // React Query hooks для данных стрима
    const { data: twitchData, isLoading: isLoadingTwitch, refetch: refetchTwitch } = useTwitchStreamInfo({
        enabled: isAuthenticated && integrations.twitch?.enabled,
        refetchInterval: 60000, // 1 минута
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const { data: vkData, isLoading: isLoadingVk, refetch: refetchVk } = useVkStreamInfo({
        enabled: isAuthenticated && integrations.vk?.enabled,
        refetchInterval: 60000, // 1 минута
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // Объединяем данные из обеих платформ
    const combinedStreamData = useMemo(() => {
        const data = {
            twitch: { title: '', category: null },
            vk: { title: '', category: null },
        };

        if (twitchData?.data) {
            const twitch = twitchData.data;
            data.twitch.title = twitch.title || '';
            data.twitch.category = twitch.game_id ? { id: twitch.game_id, name: twitch.game } : null;
        }

        if (vkData?.data) {
            const vk = vkData.data;
            data.vk.title = vk.title || '';
            data.vk.category = vk.category_id ? { id: vk.category_id, name: vk.category } : null;
        }

        return data;
    }, [twitchData, vkData]);

    // Обновляем loading состояние
    const isLoadingStreamData = isLoadingTwitch || isLoadingVk;
    useEffect(() => {
        setLoading(prev => ({ ...prev, streamData: isLoadingStreamData }));
    }, [isLoadingStreamData]);

    // Обновляем initialData и currentData при изменении данных
    useEffect(() => {
        if (combinedStreamData && (combinedStreamData.twitch.title || combinedStreamData.vk.title || combinedStreamData.twitch.category || combinedStreamData.vk.category)) {
            setInitialData(combinedStreamData);
            setCurrentData(combinedStreamData);
            // Сохраняем в кэш для быстрой загрузки при перезагрузке
            setQueryCache(['stream-data', user?.id], combinedStreamData);
            setRefreshTrigger(prev => prev + 1);
        }
    }, [combinedStreamData, user?.id]);

    // Обертка для совместимости
    const loadStreamData = useCallback(async (force = false) => {
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


    // --- DATA SAVING ---
    const saveChanges = useCallback((customPayload = null, statusType = 'saveTitle') => {
        setStatus(prev => ({ ...prev, [statusType]: 'loading' }));
        let payload = customPayload;
        let changesFound = false;

        if (!payload) {
            // Если payload не передан, создаем его автоматически
            payload = { twitch: {}, vk: {} };

            // Compare Twitch data
            if (integrations.twitch?.enabled) {
                if (initialData.twitch.title !== currentData.twitch.title) {
                    payload.twitch.title = currentData.twitch.title;
                    changesFound = true;
                }
                if (initialData.twitch.category?.id !== currentData.twitch.category?.id) {
                    payload.twitch.category_id = currentData.twitch.category?.id;
                    changesFound = true;
                }
            }
            
            // Compare VK data
            if (integrations.vk?.enabled) {
                if (initialData.vk.title !== currentData.vk.title) {
                    payload.vk.title = currentData.vk.title;
                    changesFound = true;
                }
                if (initialData.vk.category?.id !== currentData.vk.category?.id) {
                    // Отправляем ПОЛНЫЙ объект категории (VK API требует все поля!)
                    const vkCategoryPayload = {
                        id: currentData.vk.category?.id,
                        name: currentData.vk.category?.name,
                        title: currentData.vk.category?.name, // VK API использует 'title' вместо 'name'
                        type: currentData.vk.category?.type || "games"
                    };
                    
                    // Добавляем cover_url ТОЛЬКО если он не пустой (VK API не принимает пустые строки!)
                    const coverUrl = currentData.vk.category?.box_art_url || currentData.vk.category?.cover_url || "";
                    if (coverUrl) {
                        vkCategoryPayload.cover_url = coverUrl;
                    }
                    
                    payload.vk.category = vkCategoryPayload;
                    // Fallback для обратной совместимости
                    payload.vk.category_id = currentData.vk.category?.id;
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

        // Используем React Query mutation
        updateStreamMutation.mutate(payload, {
            onSuccess: () => {
                setStatus(prev => ({ ...prev, [statusType]: 'success' }));
                // Данные автоматически обновятся через инвалидацию кэша
                setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
            },
            onError: (error) => {
                setStatus(prev => ({ ...prev, [statusType]: 'error' }));
                logger.error('❌ [DATA CONTEXT] Error saving changes:', error);
                
                // Проверяем, является ли ошибка связанной с истекшим токеном
                if (error.response?.status === 401) {
                    addToast({ 
                        type: 'error', 
                        title: 'Токен истек', 
                        message: 'Пожалуйста, переавторизуйтесь в Twitch для продолжения работы.' 
                    });
                } else {
                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить изменения. Данные откатываются...' });
                }
                
                // ВАЖНО: При ошибке откатываем к реальным данным из API
                logger.log('🔄 [DATA CONTEXT] Rolling back to server data...');
                loadStreamData(true); // Перезагружаем данные с сервера
                setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
            },
        });
    }, [initialData, currentData, integrations.twitch?.enabled, integrations.vk?.enabled, loadStreamData, addToast, updateStreamMutation]);
    
    // --- CATEGORY SEARCH ---
    const searchCategories = useCallback(async (platform, query) => {
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
            // 🔍 УМНЫЙ ПОИСК: Расширяем запрос с учетом алиасов (dbd → Dead by Daylight, общение → Just Chatting)
            const expandedQueries = expandQueryWithAliases(query);
            logger.log('🔍 DataContext: Expanded queries:', { original: query, expanded: expandedQueries });
            
            // Делаем параллельные запросы для всех расширенных вариантов
            // Используем React Query queries для поиска категорий
            // Для каждого расширенного запроса делаем запрос через сервис
            const requests = expandedQueries.map(async (searchQuery) => {
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
            
            // Объединяем результаты всех запросов
            const allCategories = new Map(); // Используем Map для удаления дубликатов по ID
            
            for (const response of responses) {
                let categoryData = [];
                
                if (platform === 'vk' && response.data?.categories) {
                    categoryData = Array.isArray(response.data.categories) ? response.data.categories : [];
                } else if (platform === 'twitch' && response.data?.categories) {
                    categoryData = Array.isArray(response.data.categories) ? response.data.categories : [];
                } else if (Array.isArray(response.data)) {
                    categoryData = response.data;
                } else if (response.data) {
                    categoryData = Array.isArray(response.data) ? response.data : [];
                }
                
                // Добавляем категории в Map (автоматически убирает дубликаты)
                categoryData.forEach(cat => {
                    if (cat.id && !allCategories.has(cat.id)) {
                        allCategories.set(cat.id, cat);
                    }
                });
            }
            
            // Конвертируем Map обратно в массив
            let mergedCategories = Array.from(allCategories.values());
            
            // 🎯 СОРТИРОВКА ПО РЕЛЕВАНТНОСТИ
            mergedCategories = sortCategoriesByRelevance(mergedCategories, query);
            
            logger.log('🎯 DataContext: Smart search complete:', { 
                query, 
                totalFound: mergedCategories.length,
                top3: mergedCategories.slice(0, 3).map(c => c.name)
            });
            
            setCategories(prev => ({...prev, [platform]: mergedCategories}));
            
            // Возвращаем результаты для использования в других компонентах (например, auto-sync)
            return mergedCategories;
        } catch (error) {
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
    
    
    // Данные загружаются автоматически через React Query hooks
    // Не нужно дополнительного useEffect для загрузки
    

    const value = useMemo(() => ({
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
