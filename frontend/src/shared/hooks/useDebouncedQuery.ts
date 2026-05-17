/**
 * useDebouncedQuery Hook
 * Debounces query execution to reduce unnecessary API calls
 */
import { useEffect, useState } from 'react';

import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

interface UseDebouncedQueryOptions<TData, TError> extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
    debounceMs?: number;
    searchTerm?: string;
}

/**
 * Hook that debounces query execution
 * Useful for search inputs and other user-triggered queries
 */
export function useDebouncedQuery<TData = unknown, TError = unknown>({
    queryKey,
    queryFn,
    debounceMs = 300,
    searchTerm,
    enabled = true,
    ...options
}: UseDebouncedQueryOptions<TData, TError>) {
    const [debouncedSearchTerm] = useDebounce(searchTerm, debounceMs);
    const [isDebouncing, setIsDebouncing] = useState(false);

    useEffect(() => {
        if (searchTerm !== debouncedSearchTerm) {
            setIsDebouncing(true);
        } else {
            setIsDebouncing(false);
        }
    }, [searchTerm, debouncedSearchTerm]);

    const query = useQuery<TData, TError>({
        queryKey: [...queryKey, debouncedSearchTerm],
        queryFn,
        enabled: enabled && !isDebouncing,
        ...options,
    });

    return {
        ...query,
        isDebouncing,
    };
}
