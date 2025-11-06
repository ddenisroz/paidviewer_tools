// src/hooks/useBotStatus.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

export const useBotStatus = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const username = user?.username || user?.id; // Fallback to id if username is not available

    // React Query: загружаем статус бота
    const { data: botEnabled = false, isLoading: loading, refetch } = useQuery({
        queryKey: ['bot-status', username],
        queryFn: async () => {
            if (!username) return false;
            const response = await api.get(`/api/status/${username}`);
            return response.data.is_enabled || false;
        },
        enabled: !!username,
        staleTime: 15 * 1000, // 15 секунд - соответствует старому кэшу
        refetchInterval: 30 * 1000, // Автоматически обновляем каждые 30 секунд
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        retry: 1,
        onError: (error) => {
            logger.error("Failed to fetch bot status", error);
        },
    });

    // React Query мутация: переключение статуса бота
    const toggleBotMutation = useMutation({
        mutationFn: async (enabled) => {
            return await api.post(`/api/bot/tts/toggle`, { is_enabled: enabled });
        },
        onMutate: async (enabled) => {
            // Отменяем исходящие запросы
            await queryClient.cancelQueries({ queryKey: ['bot-status', username] });
            
            // Snapshot предыдущего значения
            const previousStatus = queryClient.getQueryData(['bot-status', username]);
            
            // Optimistically update
            queryClient.setQueryData(['bot-status', username], enabled);
            
            return { previousStatus };
        },
        onError: (error, enabled, context) => {
            // Rollback при ошибке
            if (context?.previousStatus !== undefined) {
                queryClient.setQueryData(['bot-status', username], context.previousStatus);
            }
            logger.error('Failed to toggle TTS:', error);
            toast.error('Ошибка при переключении TTS');
        },
        onSuccess: (data, enabled) => {
            toast.success(`TTS ${enabled ? 'включен' : 'выключен'}`);
            // Инвалидируем кеш для обновления данных с сервера
            queryClient.invalidateQueries({ queryKey: ['bot-status', username] });
        },
    });

    const handleBotToggle = async (enabled) => {
        if (!username) return;
        toggleBotMutation.mutate(enabled);
    };

    return { 
        botEnabled, 
        loading, 
        handleBotToggle,
        refetch 
    };
};
