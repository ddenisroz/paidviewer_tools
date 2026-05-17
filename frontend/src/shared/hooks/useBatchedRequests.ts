/**
 * useBatchedRequests Hook
 * Batches multiple API requests into a single call
 */
import { useCallback, useRef } from 'react';

interface BatchConfig<T, R> {
    batchFn: (items: T[]) => Promise<R[]>;
    maxBatchSize?: number;
    batchDelay?: number;
}

/**
 * Hook that batches multiple requests into a single API call
 * Useful for reducing API calls when fetching multiple items
 */
export function useBatchedRequests<T, R>({ batchFn, maxBatchSize = 10, batchDelay = 50 }: BatchConfig<T, R>) {
    const batchQueue = useRef<{
        items: T[];
        resolvers: Array<(value: R) => void>;
        rejecters: Array<(error: unknown) => void>;
    }>({
        items: [],
        resolvers: [],
        rejecters: [],
    });

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const processBatch = useCallback(async () => {
        const { items, resolvers, rejecters } = batchQueue.current;

        if (items.length === 0) return;

        // Clear the queue
        batchQueue.current = {
            items: [],
            resolvers: [],
            rejecters: [],
        };

        try {
            const results = await batchFn(items);

            // Resolve all promises with their corresponding results
            results.forEach((result, index) => {
                resolvers[index]?.(result);
            });
        } catch (error) {
            // Reject all promises with the error
            rejecters.forEach((reject) => reject(error));
        }
    }, [batchFn]);

    const scheduleBatch = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            processBatch();
        }, batchDelay);
    }, [batchDelay, processBatch]);

    const request = useCallback(
        (item: T): Promise<R> => {
            return new Promise((resolve, reject) => {
                batchQueue.current.items.push(item);
                batchQueue.current.resolvers.push(resolve);
                batchQueue.current.rejecters.push(reject);

                // If batch is full, process immediately
                if (batchQueue.current.items.length >= maxBatchSize) {
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                    }
                    processBatch();
                } else {
                    scheduleBatch();
                }
            });
        },
        [maxBatchSize, processBatch, scheduleBatch]
    );

    return { request };
}
