// src/hooks/useBotStatus.ts
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/api/services/chatService';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

export const useBotStatus = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const username = user?.username || user?.id; // Fallback to id if username is not available

    // React Query: загружаем статус бота
    const botStatusQuery = useQuery<boolean>({
        queryKey: ['bot-status', username],
        queryFn: async () => {
            if (!username) return false;
            const response = await chatService.getBotStatusForUser(username as string);
            return (response.data as any)?.is_enabled || false;
        },
        enabled: !!username,
        staleTime: 15 * 1000, // 15 секунд - соответствует старому кэшу
        refetchInterval: 30 * 1000, // Автоматически обновляем каждые 30 секунд
        refetchOnMount: false, // Не делаем дополнительный запрос (refetchInterval уже обновляет)
        refetchOnWindowFocus: false,
        retry: 1,
    });
    
    const { data: botEnabled = false, isLoading: loading, refetch } = botStatusQuery;
    
    // React Query v5: onError moved to useEffect
    useEffect(() => {
        if (botStatusQuery.error) {
            logger.error("Failed to fetch bot status", botStatusQuery.error);
        }
    }, [botStatusQuery.error]);

    // React Query мутация: переключение статуса бота
    const toggleBotMutation = useMutation({
        mutationFn: async (enabled: boolean) => {
            return await chatService.toggleBotTts({ is_enabled: enabled });
        },
        onMutate: async (enabled: boolean) => {
            // Отменяем исходящие запросы
            await queryClient.cancelQueries({ queryKey: ['bot-status', username] });
            
            // Snapshot предыдущего значения
            const previousStatus = queryClient.getQueryData<boolean>(['bot-status', username]);
            
            // Optimistically update
            queryClient.setQueryData(['bot-status', username], enabled);
            
            return { previousStatus };
        },
        onError: (error: Error, enabled: boolean, context: { previousStatus?: boolean } | undefined) => {
            // Rollback при ошибке
            if (context?.previousStatus !== undefined) {
                queryClient.setQueryData(['bot-status', username], context.previousStatus);
            }
            logger.error('Failed to toggle TTS:', error);
            toast.error('Ошибка при переключении TTS');
        },
        onSuccess: (data, enabled: boolean) => {
            toast.success(`TTS ${enabled ? 'включен' : 'выключен'}`);
            // Инвалидируем кеш для обновления данных с сервера
            queryClient.invalidateQueries({ queryKey: ['bot-status', username] });
        },
    });

    const handleBotToggle = async (enabled: boolean) => {
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

