// src/hooks/useBotStatus.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';

// Кэш для статуса бота
const botStatusCache = new Map();
const CACHE_DURATION = 15000; // 15 секунд

export const useBotStatus = () => {
    const { user } = useAuth();
    const username = user?.username || user?.id; // Fallback to id if username is not available
    const [botEnabled, setBotEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const lastFetchRef = useRef(0);

    const fetchStatus = useCallback(async (force = false) => {
        if (!username) {
            setLoading(false);
            return;
        }
        
        const now = Date.now();
        const cacheKey = username;
        const cached = botStatusCache.get(cacheKey);
        
        // Используем кэш если он свежий и не принудительное обновление
        if (!force && cached && (now - cached.timestamp) < CACHE_DURATION) {
            setBotEnabled(cached.data);
            setLoading(false);
            return;
        }
        
        // Проверяем, не делаем ли мы слишком частые запросы
        if (!force && (now - lastFetchRef.current) < 3000) { // Минимум 3 секунды между запросами
            return;
        }
        
        lastFetchRef.current = now;
        setLoading(true);
        
        try {
            const response = await api.get(`/api/status/${username}`);
            const data = response.data.is_enabled || false;
            
            // Сохраняем в кэш
            botStatusCache.set(cacheKey, {
                data,
                timestamp: now
            });
            
            setBotEnabled(data);
        } catch (error) {
            console.error("Failed to fetch bot status", error);
            // Используем кэшированные данные при ошибке
            if (cached) {
                setBotEnabled(cached.data);
            } else {
                setBotEnabled(false);
            }
        } finally {
            setLoading(false);
        }
    }, [username]);

    const handleBotToggle = useCallback(async (enabled) => {
        if (!username) return;
        
        setBotEnabled(enabled);
        
        // Обновляем кэш
        const cacheKey = username;
        const cached = botStatusCache.get(cacheKey);
        if (cached) {
            cached.data = enabled;
        }
        
        try {
            const response = await api.post(`/api/bot/tts/toggle`, { is_enabled: enabled });
            toast.success(`TTS ${enabled ? 'включен' : 'выключен'}`);
        } catch (error) {
            console.error('Failed to toggle TTS:', error);
            setBotEnabled(!enabled); // Revert on error
            if (cached) {
                cached.data = !enabled;
            }
            toast.error('Ошибка при переключении TTS');
        }
    }, [username]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { 
        botEnabled, 
        loading, 
        handleBotToggle,
        refetch: fetchStatus 
    };
};
