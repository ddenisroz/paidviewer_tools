// @ts-nocheck - Example file with intentional type issues for demonstration
/**
 * State Synchronization Example
 * 
 * This example demonstrates how to use the state synchronization system:
 * 1. Optimistic updates with rollback
 * 2. WebSocket state sync
 * 3. State reconciliation on reconnection
 * 4. Sync status indicators
 */
import React from 'react';

import { ManualSyncButton, SyncProgressIndicator } from '../components/ui/sync-progress-indicator';
import { SyncStatusIndicator, useSyncStatus } from '../components/ui/sync-status-indicator';
import { useAuth } from '../context/AuthContext';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { useStateReconciliation } from '../hooks/useStateReconciliation';
import { useWebSocketSync } from '../hooks/useWebSocketSync';
import { queryKeys } from '../queries/queryKeys';
import { streamService } from '../services/api/services/streamService';

export const StateSyncExample: React.FC = () => {
  const { user } = useAuth();

  // 1. Setup WebSocket sync
  useWebSocketSync({
    userId: user?.id || '',
    showNotifications: false, // We'll show custom notifications
  });

  // 2. Setup state reconciliation
  const { isReconciling, lastReconciliation, reconcileState } = useStateReconciliation({
    userId: user?.id || '',
    showNotifications: true,
    onReconciliationComplete: () => {
      console.log('State reconciled successfully');
    },
  });

  // 3. Setup optimistic mutation with sync status
  const { status: syncStatus, updateStatus } = useSyncStatus();
  
  const updateTitleMutation = useOptimisticMutation({
    mutationFn: (title: string) => streamService.updateTwitchStreamTitle(title),
    queryKey: queryKeys.stream.twitchInfo(),
    optimisticUpdate: (oldData, newTitle) => ({
      ...oldData,
      data: {
        ...oldData.data,
        title: newTitle,
      },
    }),
    onMutate: () => {
      updateStatus('syncing');
    },
    onSuccess: () => {
      updateStatus('synced');
    },
    onError: () => {
      updateStatus('error', 'Не удалось обновить название');
    },
  });

  const [title, setTitle] = React.useState('');

  const handleUpdateTitle = () => {
    if (title.trim()) {
      updateTitleMutation.mutate(title);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">State Synchronization Example</h1>

      {/* Reconciliation Status */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">State Reconciliation</h2>
        
        <SyncProgressIndicator
          isReconciling={isReconciling}
          lastReconciliation={lastReconciliation}
          variant="banner"
        />

        <div className="mt-4">
          <ManualSyncButton
            onSync={reconcileState}
            isReconciling={isReconciling}
            lastReconciliation={lastReconciliation}
          />
        </div>
      </div>

      {/* Optimistic Update Example */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Optimistic Update Example</h2>
        
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Stream Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="Enter new stream title"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleUpdateTitle}
              disabled={updateTitleMutation.isPending || !title.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Update Title
            </button>

            <SyncStatusIndicator status={syncStatus} />
          </div>

          {updateTitleMutation.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              Error: {(updateTitleMutation.error as unknown)?.message || 'Failed to update title'}
            </div>
          )}
        </div>
      </div>

      {/* WebSocket Status */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">WebSocket Status</h2>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">User ID:</span> {user?.id}
          </div>
          <div>
            <span className="font-medium">Last Reconciliation:</span>{' '}
            {lastReconciliation
              ? lastReconciliation.toLocaleString('ru-RU')
              : 'Never'}
          </div>
          <div>
            <span className="font-medium">Sync Status:</span>{' '}
            <SyncStatusIndicator status={syncStatus} showLabel={true} />
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-semibold">How It Works</h2>
        
        <div className="space-y-3 text-sm">
          <div>
            <strong>1. Optimistic Updates:</strong>
            <p className="text-gray-600">
              When you update the title, the UI updates immediately (optimistic).
              If the server request fails, the change is rolled back automatically.
            </p>
          </div>

          <div>
            <strong>2. WebSocket Sync:</strong>
            <p className="text-gray-600">
              When settings change on the backend, all connected tabs receive
              updates via WebSocket and update their state automatically.
            </p>
          </div>

          <div>
            <strong>3. State Reconciliation:</strong>
            <p className="text-gray-600">
              When WebSocket reconnects after a disconnection, all queries are
              invalidated and refetched to ensure consistency with the server.
            </p>
          </div>

          <div>
            <strong>4. Sync Status:</strong>
            <p className="text-gray-600">
              Visual indicators show when data is being saved, successfully saved,
              or if there's an error.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Integration Guide:
 * 
 * 1. Add WebSocket sync to your App.tsx or top-level component:
 * 
 *    useWebSocketSync({
 *      userId: user?.id || '',
 *      showNotifications: true
 *    });
 * 
 * 2. Add state reconciliation:
 * 
 *    const { isReconciling } = useStateReconciliation({
 *      userId: user?.id || ''
 *    });
 * 
 * 3. Use optimistic mutations in your components:
 * 
 *    const mutation = useOptimisticMutation({
 *      mutationFn: (data) => api.updateSomething(data),
 *      queryKey: ['something'],
 *      optimisticUpdate: (old, newData) => ({ ...old, ...newData })
 *    });
 * 
 * 4. Show sync status:
 * 
 *    <SyncStatusIndicator status={mutation.syncStatus} />
 * 
 * 5. Backend: Add broadcast calls in API endpoints:
 * 
 *    from utils.websocket_broadcast import broadcast_settings_change
 *    
 *    await broadcast_settings_change(user_id, "settings", settings_data)
 */
