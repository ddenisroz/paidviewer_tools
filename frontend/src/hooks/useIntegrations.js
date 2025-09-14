import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';

// Кэш для интеграций
const integrationsCache = new Map();
const CACHE_DURATION = 30000; // 30 секунд

export const useIntegrations = () => {
    const { user } = useAuth();
    const username = user?.username || user?.id; // Fallback to id if username is not available
    const [integrations, setIntegrations] = useState({ twitch_enabled: false, vk_enabled: false });
    const [isLoading, setIsLoading] = useState(true);
    const lastFetchRef = useRef(0);

    const fetchIntegrations = async (force = false) => {
        if (!username) {
            return;
        }
        
        const now = Date.now();
        const cacheKey = username;
        const cached = integrationsCache.get(cacheKey);
        
        // Используем кэш если он свежий и не принудительное обновление
        if (!force && cached && (now - cached.timestamp) < CACHE_DURATION) {
            setIntegrations(cached.data);
            setIsLoading(false);
            return;
        }
        
        // Проверяем, не делаем ли мы слишком частые запросы
        if (!force && (now - lastFetchRef.current) < 5000) { // Минимум 5 секунд между запросами
            return;
        }
        
        lastFetchRef.current = now;
        setIsLoading(true);
        
        try {
            const response = await api.get(`/api/settings/${username}/integrations`);
            const data = response.data;
            
            // Сохраняем в кэш
            integrationsCache.set(cacheKey, {
                data,
                timestamp: now
            });
            
            setIntegrations(data);
        } catch (error) {
            console.error('Failed to fetch integrations', error);
            // Используем кэшированные данные при ошибке
            if (cached) {
                setIntegrations(cached.data);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, [username]);

    const updateTwitchIntegration = async (enabled) => {
        if (!username) return;
        
        // Немедленно обновляем UI
        setIntegrations(prev => ({ ...prev, twitch_enabled: enabled }));
        
        // Обновляем кэш
        const cacheKey = username;
        const cached = integrationsCache.get(cacheKey);
        if (cached) {
            cached.data.twitch_enabled = enabled;
        }
        
        try {
            const response = await api.post(`/api/settings/${username}/integrations/twitch`, { enabled });
            toast.success(`Интеграция с Twitch ${enabled ? 'включена' : 'выключена'}`);
            
            // Обновляем кэш без принудительного запроса
            if (cached) {
                cached.data.twitch_enabled = enabled;
            }
            
            // Если интеграция отключена, сбрасываем TTS статус
            if (!enabled) {
                // Уведомляем другие компоненты о сбросе TTS
                window.dispatchEvent(new CustomEvent('ttsReset'));
            }
        } catch (error) {
            console.error('Failed to update Twitch integration:', error);
            // Откатываем изменения при ошибке
            setIntegrations(prev => ({ ...prev, twitch_enabled: !enabled }));
            if (cached) {
                cached.data.twitch_enabled = !enabled;
            }
            toast.error('Ошибка при обновлении интеграции с Twitch');
        }
    };

    const updateVkIntegration = async (enabled) => {
        if (!username) return;
        
        // Немедленно обновляем UI
        setIntegrations(prev => ({ ...prev, vk_enabled: enabled }));
        
        // Обновляем кэш
        const cacheKey = username;
        const cached = integrationsCache.get(cacheKey);
        if (cached) {
            cached.data.vk_enabled = enabled;
        }
        
        try {
            await api.post(`/api/settings/${username}/integrations/vk`, { enabled });
            toast.success(`Интеграция с VK Video Live ${enabled ? 'включена' : 'выключена'}`);
            
            // Обновляем кэш без принудительного запроса
            if (cached) {
                cached.data.vk_enabled = enabled;
            }
        } catch (error) {
            // Откатываем изменения при ошибке
            setIntegrations(prev => ({ ...prev, vk_enabled: !enabled }));
            if (cached) {
                cached.data.vk_enabled = !enabled;
            }
            toast.error('Ошибка при обновлении интеграции с VK Video Live');
        }
    };

    return { 
        integrations, 
        isLoading, 
        updateTwitchIntegration, 
        updateVkIntegration, 
        refetch: fetchIntegrations 
    };
};
