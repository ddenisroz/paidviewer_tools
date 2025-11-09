/**
 * Commands Queries - централизованные React Query queries для Commands
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { commandsService } from '../../services/api/services/commandsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

/**
 * Получить все команды
 */
export const useCommands = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.commands.list(),
    queryFn: async () => {
      const response = await commandsService.getCommands();
      // Возвращаем данные в том же формате, что ожидают компоненты
      return {
        basic_commands: response.data.basic_commands || [],
        custom_commands: response.data.custom_commands || [],
      };
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    onError: (error) => {
      logger.error('Error loading commands:', error);
      toast.error('Ошибка загрузки команд');
    },
    ...options,
  });
};

/**
 * Создать команду
 */
export const useCreateCommand = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command) => commandsService.createCommand(command),
    onSuccess: (response, command, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      // Вызываем onSuccess из options если он есть
      if (options.onSuccess) {
        options.onSuccess(response, command, context);
      } else {
        toast.success('Команда создана');
      }
    },
    onError: (error, command, context) => {
      logger.error('Error creating command:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка создания команды';
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(error, command, context);
      } else {
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Создать override для команды
 */
export const useCreateCommandOverride = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (override) => commandsService.createOverride(override),
    onSuccess: (response, override, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      // Вызываем onSuccess из options если он есть (позволяет переопределить поведение)
      if (options.onSuccess) {
        options.onSuccess(response, override, context);
      } else {
        toast.success('Персональная настройка создана');
      }
    },
    onError: (error, override, context) => {
      logger.error('Error creating command override:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Ошибка создания персональной настройки';
      
      // Специальная обработка ошибки "уже существует"
      if (error.response?.status === 400 && errorMessage.includes('уже существует')) {
        toast.error('Персональная настройка уже существует. Перезагрузите список команд.');
        queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      }
      
      // Вызываем onError из options если он есть
      if (options.onError) {
        options.onError(error, override, context);
      } else if (!errorMessage.includes('уже существует')) {
        // Показываем toast только если это не ошибка "уже существует" (она обработана выше)
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Обновить команду
 */
export const useUpdateCommand = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commandId, command }) => commandsService.updateCommand(commandId, command),
    onSuccess: (response, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (options.onSuccess) {
        options.onSuccess(response, variables, context);
      } else {
        toast.success('Команда обновлена');
      }
    },
    onError: (error, variables, context) => {
      logger.error('Error updating command:', error);
      if (options.onError) {
        options.onError(error, variables, context);
      } else {
        toast.error('Ошибка обновления команды');
      }
    },
    ...options,
  });
};

/**
 * Удалить команду
 */
export const useDeleteCommand = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commandId) => commandsService.deleteCommand(commandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      toast.success('Команда удалена');
    },
    onError: (error) => {
      logger.error('Error deleting command:', error);
      toast.error('Ошибка удаления команды');
    },
    ...options,
  });
};

/**
 * Переключить команду
 */
export const useToggleCommand = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commandName, data }) => commandsService.toggleCommand(commandName, data),
    onMutate: async ({ commandName, data }) => {
      // Оптимистичное обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.commands.list() });
      const previousCommands = queryClient.getQueryData(queryKeys.commands.list());
      
      queryClient.setQueryData(queryKeys.commands.list(), (old) => {
        if (!old) return old;
        return {
          basic_commands: old.basic_commands?.map(cmd =>
            cmd.command_name === commandName ? { ...cmd, ...data } : cmd
          ) || [],
          custom_commands: old.custom_commands?.map(cmd =>
            cmd.command_name === commandName ? { ...cmd, ...data } : cmd
          ) || [],
        };
      });
      
      return { previousCommands };
    },
    onError: (err, variables, context) => {
      // Откатываем при ошибке
      if (context?.previousCommands) {
        queryClient.setQueryData(queryKeys.commands.list(), context.previousCommands);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
    },
    ...options,
  });
};

