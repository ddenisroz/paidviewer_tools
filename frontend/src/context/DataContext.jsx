import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';
import { botService } from '../services/microservices';
import { useToast } from '../components/ui/toast';
import { expandQueryWithAliases } from '../constants/categoryAliases';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

/**
 * Вычисляет релевантность категории для запроса
 * Чем меньше score, тем выше релевантность
 * УПРОЩЕННАЯ И УЛУЧШЕННАЯ ВЕРСИЯ
 */
function calculateRelevance(categoryName, query) {
    const catLower = categoryName.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // 1. Точное совпадение - наивысший приоритет
    if (catLower === queryLower) return 0;
    
    // 2. Начинается с запроса - очень высокий приоритет
    if (catLower.startsWith(queryLower)) return 1;
    
    // Разбиваем на слова
    const catWords = catLower.split(/[\s:,\-–—()]+/).filter(w => w.length > 0);
    const queryWords = queryLower.split(/[\s:,\-–—()]+/).filter(w => w.length > 0);
    
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
    
    // 7. Содержит всю строку запроса целиком
    if (catLower.includes(queryLower)) {
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
    if (queryLower.length <= 5) {
        let matchCount = 0;
        let lastIndex = -1;
        for (const char of queryLower) {
            const index = catLower.indexOf(char, lastIndex + 1);
            if (index > lastIndex) {
                matchCount++;
                lastIndex = index;
            }
        }
        const fuzzyScore = matchCount / queryLower.length;
        if (fuzzyScore > 0.8) return 30;
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

    // State for initial data loaded from server
    const [initialData, setInitialData] = useState({
        twitch: { title: '', category: null },
        vk: { title: '', category: null },
    });

    // State for current data being edited by user
    const [currentData, setCurrentData] = useState({
        twitch: { title: '', category: null },
        vk: { title: '', category: null },
    });
    
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

    // --- DATA LOADING ---
    const loadStreamHistory = useCallback(async () => {
        if (!isAuthenticated) {
            return;
        }
        
        try {
            setLoading(prev => ({ ...prev, history: true }));
            const response = await botService.get('/api/stream/history');
            setStreamHistory(response.data);
        } finally {
            setLoading(prev => ({ ...prev, history: false }));
        }
    }, [isAuthenticated]);

    const loadStreamData = useCallback(async (force = false) => {
        if (!isAuthenticated) {
            // Not authenticated, skipping
            return;
        }
        
        // Loading stream data
        setLoading(prev => ({ ...prev, streamData: true }));

        try {
            const data = {
                twitch: { title: '', category: null },
                vk: { title: '', category: null },
            };

            // Создаем промисы для параллельной загрузки
            const promises = [];

            if (integrations.twitch?.enabled) {
                promises.push(
                    botService.get('/api/twitch/stream-info', { params: { force } })
                        .then(twitchData => ({ platform: 'twitch', data: twitchData.data }))
                        .catch(error => {
                            console.error('Error loading Twitch data:', error);
                            return { platform: 'twitch', data: null };
                        })
                );
            }

            if (integrations.vk?.enabled) {
                promises.push(
                    botService.get('/api/vk/stream-info', { params: { force } })
                        .then(vkData => ({ platform: 'vk', data: vkData.data }))
                        .catch(error => {
                            console.error('Error loading VK data:', error);
                            return { platform: 'vk', data: null };
                        })
                );
            }

            // Ждем все промисы и обрабатываем результаты
            if (promises.length > 0) {
                const results = await Promise.all(promises);
                // API results processed
                results.forEach(result => {
                    if (result.data) {
                        if (result.platform === 'twitch') {
                            data.twitch.title = result.data.title || '';
                            data.twitch.category = { id: result.data.game_id, name: result.data.game };
                            // Twitch data loaded
                        } else if (result.platform === 'vk') {
                            data.vk.title = result.data.title || '';
                            data.vk.category = { id: result.data.category_id, name: result.data.category };
                            // VK data loaded
                        }
                    }
                });
            } else {
                // No integrations enabled
            }
            
            // Final data processed
            setInitialData(data);
            setCurrentData(data);
            
            // Принудительно обновляем компоненты
            setRefreshTrigger(prev => prev + 1);
            // Data updated

        } catch (error) {
            console.error('Error loading stream data:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить данные о стриме.' });
        } finally {
            setLoading(prev => ({ ...prev, streamData: false }));
        }
    }, [isAuthenticated, integrations.twitch?.enabled, integrations.vk?.enabled, addToast]);


    // --- DATA SAVING ---
    const saveChanges = useCallback(async (customPayload = null, statusType = 'saveTitle') => {
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
                    payload.vk.category_id = currentData.vk.category?.id;
                    payload.vk.category_name = currentData.vk.category?.name;  // Добавляем name для полной загрузки
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

        try {
            await botService.post('/api/stream/update', payload);
            setStatus(prev => ({ ...prev, [statusType]: 'success' }));
            addToast({ type: 'success', title: 'Успех', message: 'Изменения сохранены.' });
            await loadStreamData(true); // Refresh data
        } catch (error) {
            setStatus(prev => ({ ...prev, [statusType]: 'error' }));
            
            console.error('❌ [DATA CONTEXT] Error saving changes:', error);
            
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
            console.log('🔄 [DATA CONTEXT] Rolling back to server data...');
            await loadStreamData(true); // Перезагружаем данные с сервера
        } finally {
            setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
        }
    }, [initialData, currentData, integrations.twitch?.enabled, integrations.vk?.enabled, loadStreamData, addToast]);
    
    // --- CATEGORY SEARCH ---
    const searchCategories = useCallback(async (platform, query) => {
        console.log('DataContext: Searching categories:', { 
            platform, 
            query, 
            enabled: integrations[platform]?.enabled,
            isAuthenticated,
            integrationsLoading 
        });
        
        if (!isAuthenticated) {
            console.log('DataContext: User not authenticated, skipping search');
            addToast({ 
                type: 'error', 
                title: 'Требуется авторизация', 
                message: 'Пожалуйста, войдите в систему для поиска категорий.' 
            });
            return;
        }
        
        if (integrationsLoading) {
            console.log('DataContext: Integrations still loading, skipping search');
            return;
        }
        
        if (!integrations[platform]?.enabled) {
            console.log('DataContext: Platform not enabled, skipping search');
            return;
        }
        
        setLoading(prev => ({ ...prev, categories: true }));
        try {
            // 🔍 УМНЫЙ ПОИСК: Расширяем запрос с учетом алиасов (dbd → Dead by Daylight, общение → Just Chatting)
            const expandedQueries = expandQueryWithAliases(query);
            console.log('🔍 DataContext: Expanded queries:', { original: query, expanded: expandedQueries });
            
            // Делаем параллельные запросы для всех расширенных вариантов
            const requests = expandedQueries.map(searchQuery =>
                botService.get(`/api/${platform}/categories`, { 
                    params: { search: searchQuery },
                    headers: { 'Content-Type': 'application/json' }
                }).catch(err => {
                    console.warn(`Search failed for query "${searchQuery}":`, err);
                    return { data: { categories: [] } };
                })
            );
            
            const responses = await Promise.all(requests);
            console.log('🔍 DataContext: All API responses received');
            
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
            
            console.log('🎯 DataContext: Smart search complete:', { 
                query, 
                totalFound: mergedCategories.length,
                top3: mergedCategories.slice(0, 3).map(c => c.name)
            });
            
            setCategories(prev => ({...prev, [platform]: mergedCategories}));
        } catch (error) {
            console.error(`Error searching ${platform} categories:`, error);
            if (error.response?.status === 401) {
                console.log('DataContext: Authentication required for category search');
                addToast({ 
                    type: 'error', 
                    title: 'Требуется авторизация', 
                    message: 'Пожалуйста, войдите в систему для поиска категорий.' 
                });
            } else {
                console.log('DataContext: Other error during search:', error.message);
                addToast({ 
                    type: 'error', 
                    title: 'Ошибка поиска', 
                    message: `Не удалось найти категории: ${error.message}` 
                });
            }
        } finally {
            setLoading(prev => ({ ...prev, categories: false }));
        }
    }, [integrations.twitch?.enabled, integrations.vk?.enabled, addToast, isAuthenticated, integrationsLoading]);
    
    
    // Мемоизируем условия для предотвращения лишних вызовов
    const shouldLoadData = useMemo(() => {
        return isAuthenticated && !integrationsLoading && (integrations.twitch?.enabled || integrations.vk?.enabled);
    }, [isAuthenticated, integrationsLoading, integrations.twitch?.enabled, integrations.vk?.enabled]);

    useEffect(() => {
        if (shouldLoadData) {
            loadStreamHistory();
            loadStreamData();
        }
    }, [shouldLoadData]); // Убираем loadStreamData и loadStreamHistory из зависимостей

    // Автообновление данных каждые 30 секунд
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const interval = setInterval(() => {
            loadStreamHistory();
        }, 30000); // 30 секунд
        
        return () => clearInterval(interval);
    }, [isAuthenticated, loadStreamHistory]);
    

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
