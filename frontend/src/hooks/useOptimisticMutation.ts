/**
 * useOptimisticMutation - Enhanced mutation hook with optimistic updates and sync status
 * 
 * This hook wraps React Query's useMutation to provide:
 * - Automatic optimistic updates
 * - Rollback on error
 * - Sync status tracking
 * - Visual feedback
 */
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import type { SyncStatus } from '../components/ui/sync-status-indicator';

interface OptimisticMutationOptions<TData, TError, TVariables, TContext> 
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  /**
   * Query key to update optimistically
   */
  queryKey: any[];
  
  /**
   * Function to update the cache optimistically
   * Should return the new data based on the mutation variables
   */
  optimisticUpdate?: (oldData: any, variables: TVariables) => any;
  
  /**
   * Whether to show toast notifications (default: true)
   */
  showToast?: boolean;
  
  /**
   * Custom success message
   */
  successMessage?: string;
  
  /**
   * Custom error message
   */
  errorMessage?: string;
}

export const useOptimisticMutation = <TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
  options: OptimisticMutationOptions<TData, TError, TVariables, TContext>
) => {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  
  const {
    queryKey,
    optimisticUpdate,
    showToast = true,
    successMessage,
    errorMessage,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    ...mutationOptions
  } = options;

  const mutation = useMutation<TData, TError, TVariables, any>({
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
        const newData = optimisticUpdate(previousData, variables);
        queryClient.setQueryData(queryKey, newData);
      }
      
      // Call custom onMutate if provided
      const context = onMutate ? await onMutate(variables) : undefined;
      
      // Return context for rollback
      return { previousData, ...context };
    },
    
    onSuccess: (data: TData, variables: TVariables, context: any) => {
      // Set synced status
      setSyncStatus('synced');
      
      // Auto-hide after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
      
      // Call custom onSuccess if provided
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    
    onError: (error: TError, variables: TVariables, context: any) => {
      // Rollback on error
      if (context && 'previousData' in context) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      // Set error status
      setSyncStatus('error');
      
      // Auto-hide after 3 seconds
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      // Call custom onError if provided
      if (onError) {
        onError(error, variables, context);
      }
    },
    
    onSettled: (data: TData | undefined, error: TError | null, variables: TVariables, context: any) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
      
      // Call custom onSettled if provided
      if (onSettled) {
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
