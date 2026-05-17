import { useState } from 'react';

import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';

import type { SyncStatus } from '@/shared/components/ui/sync-status-indicator';
import type { ApiResponse } from '@/types/api';

interface OptimisticMutationOptions<TData, TError, TVariables, TContext> extends Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    'onMutate' | 'onSuccess' | 'onError' | 'onSettled'
> {
    /**
     * Query key to update optimistically
     */
    queryKey: unknown[];

    /**
     * Function to update the cache optimistically
     * Should return the new data based on the mutation variables
     */
    optimisticUpdate?: (oldData: ApiResponse | undefined, variables: TVariables) => ApiResponse | undefined;

    /**
     * Whether to show toast notifications (default: true)
     */
    showToast?: boolean;

    /**
     * Custom onMutate handler
     */
    onMutate?: (variables: TVariables) => Promise<TContext> | TContext;

    /**
     * Custom onSuccess handler
     */
    onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;

    /**
     * Custom onError handler
     */
    onError?: (error: TError, variables: TVariables, context: TContext) => void;

    /**
     * Custom onSettled handler
     */
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext) => void;
}

export const useOptimisticMutation = <TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
    options: OptimisticMutationOptions<TData, TError, TVariables, TContext>
) => {
    const queryClient = useQueryClient();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    const {
        queryKey,
        optimisticUpdate,
        showToast: _showToast = true,
        onMutate,
        onSuccess,
        onError,
        onSettled,
        ...mutationOptions
    } = options;

    const mutation = useMutation<TData, TError, TVariables, TContext & { previousData?: unknown }>({
        ...mutationOptions,

        onMutate: async (variables: TVariables) => {
            // Set syncing status
            setSyncStatus('syncing');

            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey });

            // Snapshot previous value
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update if function provided
            if (optimisticUpdate && previousData) {
                const newData = optimisticUpdate(previousData as ApiResponse, variables);
                queryClient.setQueryData(queryKey, newData);
            }

            // Call custom onMutate if provided
            const context = onMutate ? await onMutate(variables) : ({} as TContext);

            // Return context for rollback
            return { previousData, ...context } as TContext & { previousData?: unknown };
        },

        onSuccess: (data: TData, variables: TVariables, context: TContext & { previousData?: unknown }) => {
            // Set synced status
            setSyncStatus('synced');

            // Auto-hide after 2 seconds
            setTimeout(() => setSyncStatus('idle'), 2000);

            // Call custom onSuccess if provided
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },

        onError: (
            error: TError,
            variables: TVariables,
            context: (TContext & { previousData?: unknown }) | undefined
        ) => {
            // Rollback on error
            if (context && 'previousData' in context) {
                queryClient.setQueryData(queryKey, context.previousData);
            }

            // Set error status
            setSyncStatus('error');

            // Auto-hide after 3 seconds
            setTimeout(() => setSyncStatus('idle'), 3000);

            // Call custom onError if provided
            if (onError && context) {
                onError(error, variables, context);
            }
        },

        onSettled: (
            data: TData | undefined,
            error: TError | null,
            variables: TVariables,
            context: (TContext & { previousData?: unknown }) | undefined
        ) => {
            // Refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey });

            // Call custom onSettled if provided
            if (onSettled && context) {
                onSettled(data, error, variables, context);
            }
        },
    });

    return {
        ...mutation,
        syncStatus,
    };
};

/**
 * Example usage:
 *
 * const { mutate, syncStatus } = useOptimisticMutation({
 *   mutationFn: (title: string) => api.updateStreamTitle(title),
 *   queryKey: ['stream', 'info'],
 *   optimisticUpdate: (oldData, newTitle) => ({
 *     ...oldData,
 *     title: newTitle
 *   }),
 *   successMessage: 'Title updated',
 *   errorMessage: 'Failed to update title'
 * });
 *
 * // In component:
 * <SyncStatusIndicator status={syncStatus} />
 * <button onClick={() => mutate('New Title')}>Update</button>
 */
