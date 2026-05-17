// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 минут - данные считаются свежими
            gcTime: 10 * 60 * 1000, // 10 минут (было cacheTime)
            refetchOnWindowFocus: false, // Не обновлять при фокусе окна
            retry: 1, // 1 повтор при ошибке
            refetchOnReconnect: true, // Обновлять при восстановлении сети
            // Дополнительные оптимизации
            refetchOnMount: false, // Не перезапрашивать при монтировании если данные свежие
            refetchInterval: false, // Отключаем автоматическое обновление
            networkMode: 'online', // Запросы только при наличии сети
        },
        mutations: {
            retry: 0, // Мутации не повторяем
            networkMode: 'online', // Мутации только при наличии сети
        },
    },
});
