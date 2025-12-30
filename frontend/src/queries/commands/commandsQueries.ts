/**
 * Commands Queries - централизованные React Query queries для Commands
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { commandsService } from '../../services/api/services/commandsService';
import { logger } from '../../utils/prodLogger';
import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';


import type { ApiResponse, Command as ChatCommand } from '../../types';
import type { AxiosError } from 'axios';

interface CommandsData {
  basic_commands: ChatCommand[];
  custom_commands: ChatCommand[];
}

interface CommandsApiResponse {
  basic_commands: ChatCommand[];
  custom_commands: ChatCommand[];
}

/**
 * Получить все команды
 */
export const useCommands = (options?: Omit<UseQueryOptions<CommandsData, AxiosError>, 'queryKey' | 'queryFn'>) => {
  return useQuery<CommandsData, AxiosError>({
    queryKey: queryKeys.commands.list(),
    queryFn: async () => {
      const response = await unwrapResponse(commandsService.getCommands());
      const data = response as unknown as CommandsApiResponse;
      // Возвращаем данные в том же формате, что ожидают компоненты
      return {
        basic_commands: (data?.basic_commands || []) as ChatCommand[],
        custom_commands: (data?.custom_commands || []) as ChatCommand[],
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
export const useCreateCommand = (options?: Omit<UseMutationOptions<ApiResponse<ChatCommand>, AxiosError, Partial<ChatCommand>, unknown>, 'mutationFn'>) => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ChatCommand>, AxiosError, Partial<ChatCommand>, unknown>({
    mutationFn: (command: Partial<ChatCommand>) => unwrapResponse(commandsService.createCommand(command)),
    onSuccess: (_response, _command, _context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (!options?.onSuccess) {
        toast.success('Команда создана');
      }
    },
    onError: (error: AxiosError, _command, _context) => {
      logger.error('Error creating command:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as Record<string, unknown>)?.detail as string || (error.response?.data as Record<string, unknown>)?.message as string || 'Ошибка создания команды';
        toast.error(errorMessage);
      }
    },
    ...options,
  });
};

/**
 * Создать override для команды
 */
export const useCreateCommandOverride = (options?: Omit<UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>, 'mutationFn'>) => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse, AxiosError, Record<string, unknown>, unknown>({
    mutationFn: (override: Record<string, unknown>) => unwrapResponse(commandsService.createOverride(override)),
    onSuccess: (_response, _override, _context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (!options?.onSuccess) {
        toast.success('Персональная настройка создана');
      }
    },
    onError: (error: AxiosError, _override, _context) => {
      logger.error('Error creating command override:', error);
      if (!options?.onError) {
        const errorMessage = (error.response?.data as Record<string, unknown>)?.detail as string || (error.response?.data as Record<string, unknown>)?.message as string || 'Ошибка создания персональной настройки';
        
        // Специальная обработка ошибки "уже существует"
        if (error.response?.status === 400 && errorMessage.includes('уже существует')) {
          toast.error('Персональная настройка уже существует. Перезагрузите список команд.');
          queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
        } else {
          toast.error(errorMessage);
        }
      }
    },
    ...options,
  });
};

/**
 * Обновить команду
 */
export const useUpdateCommand = (options?: Omit<UseMutationOptions<ApiResponse<ChatCommand>, AxiosError, { commandId: number; command: Partial<ChatCommand> }, unknown>, 'mutationFn'>) => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ChatCommand>, AxiosError, { commandId: number; command: Partial<ChatCommand> }, unknown>({
    mutationFn: ({ commandId, command }: { commandId: number; command: Partial<ChatCommand> }) => unwrapResponse(commandsService.updateCommand(commandId, command)),
    onSuccess: (_response, _variables, _context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (!options?.onSuccess) {
        toast.success('Команда обновлена');
      }
    },
    onError: (error: AxiosError, _variables, _context) => {
      logger.error('Error updating command:', error);
      if (!options?.onError) {
        toast.error('Ошибка обновления команды');
      }
    },
    ...options,
  });
};

/**
 * Удалить команду
 */
export const useDeleteCommand = (options?: Omit<UseMutationOptions<ApiResponse, AxiosError, number, unknown>, 'mutationFn'>) => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse, AxiosError, number, unknown>({
    mutationFn: (commandId: number) => unwrapResponse(commandsService.deleteCommand(commandId)),
    onSuccess: (_response, _commandId, _context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
      if (!options?.onSuccess) {
        toast.success('Команда удалена');
      }
    },
    onError: (error: AxiosError, _commandId, _context) => {
      logger.error('Error deleting command:', error);
      if (!options?.onError) {
        toast.error('Ошибка удаления команды');
      }
    },
    ...options,
  });
};

/**
 * Переключить команду
 */
export const useToggleCommand = (options?: Omit<UseMutationOptions<ApiResponse, AxiosError, { commandName: string; data: Record<string, unknown> }, { previousCommands?: CommandsData }>, 'mutationFn'>) => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse, AxiosError, { commandName: string; data: Record<string, unknown> }, { previousCommands?: CommandsData }>({
    mutationFn: ({ commandName, data }: { commandName: string; data: Record<string, unknown> }) => unwrapResponse(commandsService.toggleCommand(commandName, data)),
    onMutate: async (variables) => {
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
      
      return { previousCommands };
    },
    onError: (err: AxiosError, variables, context: { previousCommands?: CommandsData } | undefined) => {
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

