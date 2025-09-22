import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { twitchApi } from '../services/twitchApi';
import { useToast } from '../components/ui/toast';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { addToast } = useToast();
    const dataLoadedRef = useRef(false);

    const [streamTitle, setStreamTitle] = useState('');
    const [streamCategory, setStreamCategory] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [streamHistory, setStreamHistory] = useState([]);
    const [currentViewers, setCurrentViewers] = useState(0);

    const [loading, setLoading] = useState({
        streamData: true,
        history: true,
        categories: false,
    });
    
    const [status, setStatus] = useState({
        title: 'idle', // idle, loading, success, error
        category: 'idle',
    });

    const loadStreamData = useCallback(async (force = false) => {
        // Не загружаем данные для неавторизованных пользователей
        if (!isAuthenticated) {
            console.log('Not authenticated, skipping stream data load');
            return;
        }
        
        console.log('Loading stream data...', force ? '(forced)' : '(cached)');
        setLoading(prev => ({ ...prev, streamData: true }));
        try {
            const streamData = await twitchApi.getStreamInfo(force);
            console.log('Stream data loaded:', streamData);
            if (streamData) {
                console.log('Setting stream data:', {
                    title: streamData.title,
                    game_id: streamData.game_id,
                    game: streamData.game,
                    viewer_count: streamData.viewer_count
                });
                setStreamTitle(streamData.title || '');
                // Устанавливаем объект категории, а не только ID
                if (streamData.game_id && streamData.game) {
                    setStreamCategory({
                        id: streamData.game_id,
                        name: streamData.game,
                        box_art_url: streamData.category_info?.box_art_url
                    });
                } else {
                    setStreamCategory(null);
                }
                setCategorySearch(streamData.game || '');
                setCurrentViewers(streamData.viewer_count || 0);
            } else {
                console.log('No stream data received');
                // Устанавливаем пустые значения если данных нет
                setStreamTitle('');
                setStreamCategory(null);
                setCategorySearch('');
                setCurrentViewers(0);
            }
        } catch (error) {
            console.error('Error loading stream data:', error);
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось загрузить данные о стриме.'
            });
        } finally {
            setLoading(prev => ({ ...prev, streamData: false }));
        }
    }, [isAuthenticated, addToast]);

    const loadStreamHistory = useCallback(async () => {
        // Не загружаем данные для неавторизованных пользователей
        if (!isAuthenticated) {
            return;
        }
        
        setLoading(prev => ({ ...prev, history: true }));
        try {
            const response = await api.get('/api/stream/history');
            let historyData = response.data || [];

            if (historyData.length === 1) {
                const firstPoint = historyData[0];
                const firstPointTime = new Date(firstPoint.timestamp).getTime();
                
                if (!isNaN(firstPointTime)) {
                    const fakePrevPoint = {
                        ...firstPoint,
                        timestamp: new Date(firstPointTime - 60000).toISOString(),
                        viewers: 0 
                    };
                    historyData = [fakePrevPoint, firstPoint];
                }
            }

            setStreamHistory(Array.isArray(historyData) ? historyData : []);
        } catch (error) {
            console.error('Ошибка загрузки истории стрима:', error);
            setStreamHistory([]);
        } finally {
            setLoading(prev => ({ ...prev, history: false }));
        }
    }, [isAuthenticated]);
    
    const loadCategories = useCallback(async (search = '', force = false) => {
        // Не загружаем данные для неавторизованных пользователей
        if (!isAuthenticated) {
            return;
        }
        
        setLoading(prev => ({ ...prev, categories: true }));
        try {
            const categoriesData = await twitchApi.getCategories(search, force);
            console.log('Categories loaded:', categoriesData);
            if (categoriesData) {
                setCategories(categoriesData);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setLoading(prev => ({ ...prev, categories: false }));
        }
    }, [isAuthenticated]);

    const updateStreamTitle = useCallback(async (newTitle) => {
        setStatus(prev => ({ ...prev, title: 'loading' }));
        try {
            const response = await twitchApi.updateStreamTitle(newTitle);
            if (response.success) {
                setStatus(prev => ({ ...prev, title: 'success' }));
                await loadStreamData(true); // Force refresh
                setTimeout(() => setStatus(prev => ({ ...prev, title: 'idle' })), 1500);
                return { success: true };
            } else {
                setStatus(prev => ({ ...prev, title: 'error' }));
                setTimeout(() => setStatus(prev => ({ ...prev, title: 'idle' })), 3000);
                return { success: false, message: response.message };
            }
        } catch (error) {
            setStatus(prev => ({ ...prev, title: 'error' }));
            console.error('Error updating title:', error);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }, [loadStreamData]);
    
    const updateStreamCategory = useCallback(async (newCategoryId) => {
        setStatus(prev => ({ ...prev, category: 'loading' }));
        try {
            const response = await twitchApi.updateCategory(newCategoryId);
            if (response.success) {
                setStatus(prev => ({ ...prev, category: 'success' }));
                await loadStreamData(true); // Force refresh
                setTimeout(() => setStatus(prev => ({ ...prev, category: 'idle' })), 1500);
                return { success: true };
            } else {
                setStatus(prev => ({ ...prev, category: 'error' }));
                setTimeout(() => setStatus(prev => ({ ...prev, category: 'idle' })), 3000);
                return { success: false, message: response.message };
            }
        } catch (error) {
            setStatus(prev => ({ ...prev, category: 'error' }));
            console.error('Error updating category:', error);
            setTimeout(() => setStatus(prev => ({ ...prev, category: 'idle' })), 3000);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }, [loadStreamData]);

    useEffect(() => {
        if (isAuthenticated && user && !dataLoadedRef.current) {
            dataLoadedRef.current = true;
            loadStreamData();
            loadStreamHistory();
            loadCategories('');
        }
        if (!isAuthenticated) {
            dataLoadedRef.current = false;
        }
    }, [isAuthenticated, user, loadStreamData, loadStreamHistory, loadCategories]);

    useEffect(() => {
        if (isAuthenticated) {
            const interval = setInterval(() => {
                loadStreamData();
                loadStreamHistory();
            }, 60000); // Опрашивать каждые 60 секунд

            return () => clearInterval(interval);
        }
    }, [isAuthenticated, loadStreamData, loadStreamHistory]);

    const value = useMemo(() => ({
        streamTitle, setStreamTitle,
        streamCategory, setStreamCategory,
        categorySearch, setCategorySearch,
        categories, loadCategories,
        streamHistory, loadStreamHistory,
        currentViewers,
        loading,
        status,
        updateStreamTitle,
        updateStreamCategory,
        loadStreamData,
    }), [
        streamTitle, streamCategory, categorySearch, categories, 
        streamHistory, currentViewers, loading, status,
        loadCategories, loadStreamHistory, updateStreamTitle, 
        updateStreamCategory, loadStreamData
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
