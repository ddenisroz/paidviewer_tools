import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { twitchApi } from '../services/twitchApi';
import { useToast } from '../components/ui/toast';
import { useNotification } from './NotificationContext';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { addToast } = useToast();
    const { showNotification } = useNotification();
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
            return;
        }
        
        setLoading(prev => ({ ...prev, streamData: true }));
        try {
            const streamData = await twitchApi.getStreamInfo(force);
            if (streamData) {
                setStreamTitle(streamData.title || '');
                setStreamCategory(streamData.game_id || '');
                setCategorySearch(streamData.game || '');
                setCurrentViewers(streamData.viewers || 0);
            }
        } catch (error) {
            console.error('Error loading stream data:', error);
            showNotification("Ошибка загрузки данных о стриме.", 'error');
        } finally {
            setLoading(prev => ({ ...prev, streamData: false }));
        }
    }, [isAuthenticated]);

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

            setStreamHistory(historyData);
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
                showNotification(response.message || 'Название обновлено', 'success');
                await loadStreamData(true); // Force refresh
                setTimeout(() => setStatus(prev => ({ ...prev, title: 'idle' })), 2000);
                return { success: true };
            } else {
                setStatus(prev => ({ ...prev, title: 'error' }));
                showNotification(response.message || 'Ошибка обновления', 'error');
                setTimeout(() => setStatus(prev => ({ ...prev, title: 'idle' })), 3000);
                return { success: false, message: response.message };
            }
        } catch (error) {
            setStatus(prev => ({ ...prev, title: 'error' }));
            console.error('Error updating title:', error);
            showNotification(error.response?.data?.message || error.message || 'Ошибка обновления названия', 'error');
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }, [loadStreamData]);
    
    const updateStreamCategory = useCallback(async (newCategoryId) => {
        setStatus(prev => ({ ...prev, category: 'loading' }));
        try {
            const response = await twitchApi.updateCategory(newCategoryId);
            if (response.success) {
                setStatus(prev => ({ ...prev, category: 'success' }));
                showNotification(response.message || 'Категория обновлена', 'success');
                await loadStreamData(true); // Force refresh
                setTimeout(() => setStatus(prev => ({ ...prev, category: 'idle' })), 2000);
                return { success: true };
            } else {
                setStatus(prev => ({ ...prev, category: 'error' }));
                showNotification(response.message || 'Ошибка обновления', 'error');
                setTimeout(() => setStatus(prev => ({ ...prev, category: 'idle' })), 3000);
                return { success: false, message: response.message };
            }
        } catch (error) {
            setStatus(prev => ({ ...prev, category: 'error' }));
            console.error('Error updating category:', error);
            showNotification(error.response?.data?.message || error.message || 'Ошибка обновления категории', 'error');
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
