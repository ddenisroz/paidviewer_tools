import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useIntegrations } from './IntegrationsContext';
import { botService } from '../services/microservices';
import { useToast } from '../components/ui/toast';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
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
        streamData: true,
        history: true,
        categories: false,
    });
    
    const [status, setStatus] = useState({
        saveTitle: 'idle', // idle, loading, success, error
        saveCategory: 'idle', // idle, loading, success, error
    });

    // --- DATA LOADING ---
    const loadStreamData = useCallback(async (force = false) => {
        if (!isAuthenticated) return;
        setLoading(prev => ({ ...prev, streamData: true }));

        try {
            const data = {
                twitch: { title: '', category: null },
                vk: { title: '', category: null },
            };

            if (integrations.twitch.enabled) {
                const twitchData = await botService.get('/api/twitch/stream-info', { params: { force } });
                if (twitchData.data) {
                    data.twitch.title = twitchData.data.title || '';
                    data.twitch.category = { id: twitchData.data.game_id, name: twitchData.data.game };
                }
            }

            if (integrations.vk.enabled) {
                const vkData = await botService.get('/api/vk/stream-info');
                if (vkData.data) {
                    data.vk.title = vkData.data.title || '';
                    data.vk.category = { id: vkData.data.category_id, name: vkData.data.category };
                }
            }
            
            setInitialData(data);
            setCurrentData(data);

        } catch (error) {
            console.error('Error loading stream data:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить данные о стриме.' });
        } finally {
            setLoading(prev => ({ ...prev, streamData: false }));
        }
    }, [isAuthenticated, integrations, addToast]);


    // --- DATA SAVING ---
    const saveChanges = useCallback(async (customPayload = null, statusType = 'saveTitle') => {
        setStatus(prev => ({ ...prev, [statusType]: 'loading' }));
        let payload = customPayload;
        let changesFound = false;

        if (!payload) {
            // Если payload не передан, создаем его автоматически
            payload = { twitch: {}, vk: {} };

            // Compare Twitch data
            if (integrations.twitch.enabled) {
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
            if (integrations.vk.enabled) {
                if (initialData.vk.title !== currentData.vk.title) {
                    payload.vk.title = currentData.vk.title;
                    changesFound = true;
                }
                if (initialData.vk.category?.id !== currentData.vk.category?.id) {
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

        try {
            await botService.post('/api/stream/update', payload);
            setStatus(prev => ({ ...prev, [statusType]: 'success' }));
            addToast({ type: 'success', title: 'Успех', message: 'Изменения сохранены.' });
            await loadStreamData(true); // Refresh data
        } catch (error) {
            setStatus(prev => ({ ...prev, [statusType]: 'error' }));
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить изменения.' });
        } finally {
            setTimeout(() => setStatus(prev => ({ ...prev, [statusType]: 'idle' })), 3000);
        }
    }, [initialData, currentData, integrations, loadStreamData, addToast]);
    
    // --- CATEGORY SEARCH ---
    const searchCategories = useCallback(async (platform, query) => {
        if (!integrations[platform]?.enabled) return;
        setLoading(prev => ({ ...prev, categories: true }));
        try {
            const response = await botService.get(`/api/${platform}/categories`, { params: { search: query } });
            // Обрабатываем разные форматы ответов API
            let categoryData = [];
            if (platform === 'vk' && response.data?.data) {
                // VK API возвращает {data: [...]}
                categoryData = Array.isArray(response.data.data) ? response.data.data : [];
            } else if (Array.isArray(response.data)) {
                // Twitch API возвращает массив напрямую
                categoryData = response.data;
            } else if (response.data) {
                // Fallback для других форматов
                categoryData = Array.isArray(response.data) ? response.data : [];
            }
            
            setCategories(prev => ({...prev, [platform]: categoryData}));
        } catch (error) {
            console.error(`Error searching ${platform} categories:`, error);
        } finally {
            setLoading(prev => ({ ...prev, categories: false }));
        }
    }, [integrations]);
    
    
    useEffect(() => {
        if (isAuthenticated && user) {
            loadStreamData();
        }
    }, [isAuthenticated, user, integrations, loadStreamData]);
    

    const value = useMemo(() => ({
        initialData,
        currentData,
        setCurrentData,
        loading,
        status,
        saveChanges,
        categories,
        searchCategories
    }), [
        initialData, currentData, loading, status, saveChanges, categories, searchCategories
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
