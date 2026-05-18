/**
 * Commands Queries - централизованные React Query queries для Commands
 */
import { useMutation, UseMutationOptions, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { commandsService } from '@/services/api/services/commandsService';
import { logger } from '@/shared/utils/prodLogger';

import { queryKeys } from '../queryKeys';
import { unwrapResponse } from '../queryUtils';

import type { ApiResponse, Command as ChatCommand, CommandInvocation } from '../../types';
import type { AxiosError } from 'axios';

interface CommandsData {
    basic_commands: ChatCommand[];
    custom_commands: ChatCommand[];
}

interface ApiCommandResponse {
    id: number;
    command_name: string;
    response_text: string;
    platforms: string;
    allowed_roles: string;
    cooldown_seconds: number;
    is_enabled: boolean;
    description?: string;
    command_type?: string;
    parent_command_id?: number;
    alias?: string;
    created_at?: string;
    updated_at?: string;
    last_used?: string;
    usage_count?: number;
    tags?: string[];
    extra_settings?: Record<string, unknown>;
}

interface CommandsApiResponse {
    basic_commands: ApiCommandResponse[];
    custom_commands: ApiCommandResponse[];
}

const getCommandErrorMessage = (error: AxiosError, fallback: string): string => {
    const payload = (error.response?.data || {}) as Record<string, unknown>;
    return (payload.detail as string) || (payload.message as string) || fallback;
};

/**
 * Map API command response to frontend ChatCommand type
 */
const mapApiCommandToFrontend = (cmd: ApiCommandResponse): ChatCommand => {
    // Convert platforms string to single platform value
    const platformsLower = (cmd.platforms || 'all').toLowerCase();
    let platform: 'twitch' | 'vk' | 'youtube' | 'all' = 'all';
    if (platformsLower === 'twitch') platform = 'twitch';
    else if (platformsLower === 'vk') platform = 'vk';
    else if (platformsLower === 'youtube') platform = 'youtube';

    // Convert allowed_roles to user_level
    const rolesLower = (cmd.allowed_roles || 'all').toLowerCase();
    let user_level: 'everyone' | 'subscriber' | 'moderator' | 'broadcaster' = 'everyone';
    if (rolesLower.includes('broadcaster')) user_level = 'broadcaster';
    else if (rolesLower.includes('moderator')) user_level = 'moderator';
    else if (rolesLower.includes('vip') || rolesLower.includes('subscriber')) user_level = 'subscriber';

    return {
        id: cmd.id,
        name: cmd.command_name,
        description: cmd.description,
        response: cmd.response_text || '',
        enabled: cmd.is_enabled,
        cooldown: cmd.cooldown_seconds || 0,
        alias: cmd.alias || undefined,
        parent_command_id: cmd.parent_command_id,
        user_level,
        platform,
        created_at: cmd.created_at,
        updated_at: cmd.updated_at,
        last_used: cmd.last_used,
        usage_count: cmd.usage_count || 0,
        tags: cmd.tags || [],
        command_type: cmd.command_type as 'global' | 'override' | 'custom' | undefined,
        extra_settings: cmd.extra_settings || {},
    };
};

/**
 * Получить все команды
 */
export const useCommands = (options?: Omit<UseQueryOptions<CommandsData, AxiosError>, 'queryKey' | 'queryFn'>) => {
    return useQuery<CommandsData, AxiosError>({
        queryKey: queryKeys.commands.list(),
        queryFn: async () => {
            const response = await unwrapResponse(commandsService.getCommands());
            const data = response as unknown as CommandsApiResponse;
            return {
                basic_commands: (data?.basic_commands || []).map(mapApiCommandToFrontend),
                custom_commands: (data?.custom_commands || []).map(mapApiCommandToFrontend),
            };
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        retry: 1,
        ...options,
    });
};

export const useCommandsHistory = (
    params: Record<string, unknown> = {},
    options?: Omit<UseQueryOptions<CommandInvocation[], AxiosError>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<CommandInvocation[], AxiosError>({
        queryKey: queryKeys.commands.history(params),
        queryFn: async () => {
            const response = await unwrapResponse(commandsService.getHistory(params));
            return (response?.data || []) as unknown as CommandInvocation[];
        },
        staleTime: 15 * 1000,
        gcTime: 5 * 60 * 1000,
        ...options,
    });
};

/**
 * Создать команду
 */
export const useCreateCommand = (
    options?: Omit<
        UseMutationOptions<ApiResponse<ChatCommand>, AxiosError, Partial<ChatCommand>, unknown>,
        'mutationFn'
    >
) => {
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
                toast.error(getCommandErrorMessage(error, 'Ошибка создания команды'));
            }
        },
        ...options,
    });
};

/**
 * Создать override для команды
 */
export const useCreateCommandOverride = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, Record<string, unknown>, unknown>, 'mutationFn'>
) => {
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
                const errorMessage = getCommandErrorMessage(error, 'Ошибка создания персональной настройки');
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
export const useUpdateCommand = (
    options?: Omit<
        UseMutationOptions<
            ApiResponse<ChatCommand>,
            AxiosError,
            { commandId: number; command: Partial<ChatCommand> },
            unknown
        >,
        'mutationFn'
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse<ChatCommand>,
        AxiosError,
        { commandId: number; command: Partial<ChatCommand> },
        unknown
    >({
        mutationFn: ({ commandId, command }) => unwrapResponse(commandsService.updateCommand(commandId, command)),
        onSuccess: (_response, _variables, _context) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.commands.list() });
            if (!options?.onSuccess) {
                toast.success('Команда обновлена');
            }
        },
        onError: (error: AxiosError, _variables, _context) => {
            logger.error('Error updating command:', error);
            if (!options?.onError) {
                toast.error(getCommandErrorMessage(error, 'Ошибка обновления команды'));
            }
        },
        ...options,
    });
};

/**
 * Удалить команду
 */
export const useDeleteCommand = (
    options?: Omit<UseMutationOptions<ApiResponse, AxiosError, number, unknown>, 'mutationFn'>
) => {
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
export const useToggleCommand = (
    options?: Omit<
        UseMutationOptions<
            ApiResponse,
            AxiosError,
            { commandName: string; data: Record<string, unknown> },
            { previousCommands?: CommandsData }
        >,
        'mutationFn'
    >
) => {
    const queryClient = useQueryClient();

    return useMutation<
        ApiResponse,
        AxiosError,
        { commandName: string; data: Record<string, unknown> },
        { previousCommands?: CommandsData }
    >({
        mutationFn: ({ commandName, data }) => unwrapResponse(commandsService.toggleCommand(commandName, data)),
        onMutate: async (variables) => {
            const { commandName, data } = variables;
            await queryClient.cancelQueries({ queryKey: queryKeys.commands.list() });
            const previousCommands = queryClient.getQueryData<CommandsData>(queryKeys.commands.list());

            queryClient.setQueryData(queryKeys.commands.list(), (old: CommandsData | undefined) => {
                if (!old) return old;
                return {
                    basic_commands:
                        old.basic_commands?.map((cmd) => (cmd.name === commandName ? { ...cmd, ...data } : cmd)) || [],
                    custom_commands:
                        old.custom_commands?.map((cmd) => (cmd.name === commandName ? { ...cmd, ...data } : cmd)) || [],
                };
            });

            return { previousCommands };
        },
        onError: (err: AxiosError, variables, context) => {
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
