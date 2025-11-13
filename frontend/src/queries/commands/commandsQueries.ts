/**
 * Commands Queries - централизованные React Query queries для Commands
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { commandsService } from '../../services/api/services/commandsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import type { AxiosError } from 'axios';
import type { ApiResponse, Command } from '../../types';

interface CommandsData {
  basic_commands: Command[];
  custom_commands: Command[];
}

/**
 * Получить все команды
 */
export const useCommands = (options?: Omit<UseQueryOptions<CommandsData, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<CommandsData, AxiosError>({
    queryKey: queryKeys.commands.list(),
    queryFn: async () => {
      const response = await commandsService.getCommands();
      // Возвращаем данные в том же формате, что ожидают компоненты
      return {
        basic_commands: ((response.data as any)?.basic_commands || []) as Command[],
        custom_commands: ((response.data as any)?.custom_commands || []) as Command[],
      };
    },
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
};

/**
 * Создать команду
 */
export const useCreateCommand = (options?: UseMutationOptions<any, AxiosError, Partial<Command>, unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command: Partial<Command>) => commandsService.createCommand(command),
    onSuccess: (response, command, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      // Вызываем onSuccess из options если он есть
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, command, context);
      } else {
        toast.success('Команда создана');
      }
    },
    onError: (error: AxiosError, command, context) => {
      logger.error('Error creating command:', error);
      const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Ошибка создания команды';
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(error, command, context);
      } else {
        toast.error(errorMessage);
      }
    },
    ...(options || {}),
  });
};

/**
 * Создать override для команды
 */
export const useCreateCommandOverride = (options?: UseMutationOptions<any, AxiosError, Record<string, any>, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: (override: Record<string, any>) => commandsService.createOverride(override),
    onSuccess: (response, override, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      // Вызываем onSuccess из options если он есть (позволяет переопределить поведение)
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, override, context);
      } else {
        toast.success('Персональная настройка создана');
      }
    },
    onError: (error: AxiosError, override, context) => {
      logger.error('Error creating command override:', error);
      const errorMessage = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || 'Ошибка создания персональной настройки';
      
      // Специальная обработка ошибки "уже существует"
      if (error.response?.status === 400 && errorMessage.includes('уже существует')) {
        toast.error('Персональная настройка уже существует. Перезагрузите список команд.');
        queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      }
      
      // Вызываем onError из options если он есть
      if (options?.onError) {
        (options.onError as any)(error, override, context);
      } else if (!errorMessage.includes('уже существует')) {
        // Показываем toast только если это не ошибка "уже существует" (она обработана выше)
        toast.error(errorMessage);
      }
    },
    ...(options || {}),
  });
};

/**
 * Обновить команду
 */
export const useUpdateCommand = (options?: UseMutationOptions<any, AxiosError, { commandId: number; command: Partial<Command> }, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: ({ commandId, command }: { commandId: number; command: Partial<Command> }) => commandsService.updateCommand(commandId, command),
    onSuccess: (response, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, variables, context);
      } else {
        toast.success('Команда обновлена');
      }
    },
    onError: (error: AxiosError, variables, context) => {
      logger.error('Error updating command:', error);
      if (options?.onError) {
        (options.onError as any)(error, variables, context);
      } else {
        toast.error('Ошибка обновления команды');
      }
    },
    ...(options || {}),
  });
};

/**
 * Удалить команду
 */
export const useDeleteCommand = (options?: UseMutationOptions<any, AxiosError, number, unknown>) => {
  const queryClient = useQueryClient();
  

  return useMutation({
    mutationFn: (commandId: number) => commandsService.deleteCommand(commandId),
    onSuccess: (response, commandId, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (options?.onSuccess) {
        (options.onSuccess as any)(response, commandId, context);
      } else {
        toast.success('Команда удалена');
      }
    },
    onError: (error: AxiosError, commandId, context) => {
      logger.error('Error deleting command:', error);
      if (options?.onError) {
        (options.onError as any)(error, commandId, context);
      } else {
        toast.error('Ошибка удаления команды');
      }
    },
    ...(options || {}),
  });
};

/**
 * Переключить команду
 */
export const useToggleCommand = (options?: UseMutationOptions<any, AxiosError, { commandName: string; data: Record<string, any> }, { previousCommands?: CommandsData }>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commandName, data }: { commandName: string; data: Record<string, any> }) => commandsService.toggleCommand(commandName, data),
    onMutate: async (variables) => {
      // Вызываем onMutate из options если есть
      const customContext = options?.onMutate ? await (options.onMutate as any)(variables) : undefined;
      
      // Оптимистичное обновление
      const { commandName, data } = variables;
      await queryClient.cancelQueries({ queryKey: queryKeys.commands.list() });
      const previousCommands = queryClient.getQueryData<CommandsData>(queryKeys.commands.list());
      
      queryClient.setQueryData(queryKeys.commands.list(), (old: CommandsData | undefined) => {
        if (!old) return old;
        return {
          basic_commands: old.basic_commands?.map(cmd =>
            cmd.name === commandName ? { ...cmd, ...data } : cmd
          ) || [],
          custom_commands: old.custom_commands?.map(cmd =>
            cmd.name === commandName ? { ...cmd, ...data } : cmd
          ) || [],
        };
      });
      
      return { previousCommands, ...(customContext || {}) };
    },
    onError: (err: AxiosError, variables, context: { previousCommands?: CommandsData } | undefined) => {
      // Откатываем при ошибке
      if (context?.previousCommands) {
        queryClient.setQueryData(queryKeys.commands.list(), context.previousCommands);
      }
      // Вызываем onError из options если есть
      if (options?.onError) {
        (options.onError as any)(err, variables, context);
      }
    },
    onSettled: (data, error, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      // Вызываем onSettled из options если есть
      if (options?.onSettled) {
        (options.onSettled as any)(data, error, variables, context);
      }
    },
    ...(options || {}),
  });
};

