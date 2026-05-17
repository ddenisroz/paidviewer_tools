/**
 * Performance Optimization Utilities
 *
 * This file contains utilities and patterns for React performance optimization
 * following the requirements from task 7.2
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounce hook for expensive operations
 * Useful for search inputs, auto-save, etc.
 *
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
): (...args: Parameters<T>) => void {
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    return useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callback(...args);
            }, delay);
        },
        [callback, delay]
    ) as (...args: Parameters<T>) => void;
}

/**
 * Throttle hook for high-frequency events
 * Useful for scroll handlers, resize handlers, etc.
 *
 * @param callback - Function to throttle
 * @param delay - Minimum delay between calls in milliseconds
 * @returns Throttled function
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
): (...args: Parameters<T>) => void {
    const lastRun = useRef(Date.now());
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    return useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastRun = now - lastRun.current;

            if (timeSinceLastRun >= delay) {
                callback(...args);
                lastRun.current = now;
            } else {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    callback(...args);
                    lastRun.current = Date.now();
                }, delay - timeSinceLastRun);
            }
        },
        [callback, delay]
    ) as (...args: Parameters<T>) => void;
}

/**
 * Memoize expensive computations
 * Wrapper around useMemo with better type inference
 *
 * @param factory - Factory function that returns the value
 * @param deps - Dependencies array
 * @returns Memoized value
 */
export function useMemoizedValue<T>(factory: () => T, deps: React.DependencyList): T {
    const valueRef = useRef<T | undefined>(undefined);
    const depsRef = useRef<React.DependencyList | null>(null);
    const currentDeps = depsRef.current;
    const hasChanged =
        currentDeps == null ||
        deps.length !== currentDeps.length ||
        deps.some((dep, index) => !Object.is(dep, currentDeps[index]));

    if (hasChanged) {
        depsRef.current = [...deps];
        valueRef.current = factory();
    }

    return valueRef.current as T;
}

/**
 * Stable callback reference
 * Wrapper around useCallback with better type inference
 *
 * @param callback - Callback function
 * @param deps - Dependencies array
 * @returns Stable callback reference
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
    callback: T,
    _deps: React.DependencyList
): T {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const stableCallbackRef = useRef<T | null>(null);
    if (!stableCallbackRef.current) {
        stableCallbackRef.current = ((...args: Parameters<T>) => callbackRef.current(...args)) as T;
    }

    return stableCallbackRef.current;
}

/**
 * Intersection Observer hook for lazy loading
 * Useful for infinite scroll, lazy image loading, etc.
 *
 * @param options - IntersectionObserver options
 * @returns [ref, isIntersecting]
 */
export function useIntersectionObserver(options: IntersectionObserverInit = {}): [React.RefCallback<Element>, boolean] {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [node, setNode] = useState<Element | null>(null);

    useEffect(() => {
        if (!node) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsIntersecting(entry.isIntersecting);
        }, options);

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [node, options]);

    return [setNode, isIntersecting];
}

/**
 * Performance monitoring hook
 * Logs component render times in development
 *
 * @param componentName - Name of the component
 * @param enabled - Whether to enable monitoring (default: development only)
 */
export function usePerformanceMonitor(
    componentName: string,
    enabled: boolean = process.env.NODE_ENV === 'development'
): void {
    const renderCount = useRef(0);
    const startTime = useRef(performance.now());

    useEffect(() => {
        if (!enabled) return;

        renderCount.current += 1;
        const endTime = performance.now();
        const renderTime = endTime - startTime.current;

        if (renderTime > 16) {
            // Longer than one frame (60fps)
            console.warn(
                `[Performance] ${componentName} render #${renderCount.current} took ${renderTime.toFixed(2)}ms`
            );
        }

        startTime.current = performance.now();
    });
}

/**
 * Batch state updates to reduce re-renders
 * Useful when multiple state updates happen in quick succession
 *
 * @param updates - Object with state updates
 * @param delay - Delay before applying updates (default: 0 = next tick)
 * @returns Function to trigger batch update
 */
export function useBatchedUpdates<T extends Record<string, unknown>>(
    delay: number = 0
): [(updates: Partial<T>) => void, Partial<T>] {
    const [pendingUpdates, setPendingUpdates] = useState<Partial<T>>({});
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const batchUpdate = useCallback(
        (updates: Partial<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            setPendingUpdates((prev) => ({ ...prev, ...updates }));

            timeoutRef.current = setTimeout(() => {
                setPendingUpdates({});
            }, delay);
        },
        [delay]
    );

    return [batchUpdate, pendingUpdates];
}

/**
 * Memoize array/object to prevent unnecessary re-renders
 * Uses deep comparison for arrays and objects
 *
 * @param value - Value to memoize
 * @returns Memoized value
 */
export function useDeepMemo<T>(value: T): T {
    const ref = useRef<T>(value);

    if (!deepEqual(ref.current, value)) {
        ref.current = value;
    }

    return ref.current;
}

/**
 * Deep equality check for objects and arrays
 */
function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(objA[key], objB[key])) return false;
    }

    return true;
}

/**
 * Performance optimization patterns documentation
 *
 * CONTEXT PROVIDERS:
 * - All context providers should wrap their value in useMemo
 * - Example: const value = useMemo(() => ({ user, login, logout }), [user]);
 *
 * EXPENSIVE COMPUTATIONS:
 * - Use useMemo for filtering, sorting, searching large arrays
 * - Example: const filtered = useMemo(() => items.filter(predicate), [items, predicate]);
 *
 * CALLBACK STABILITY:
 * - Use useCallback for functions passed as props
 * - Example: const handleClick = useCallback(() => {...}, [deps]);
 *
 * COMPONENT MEMOIZATION:
 * - Wrap expensive components with React.memo
 * - Example: export default React.memo(MyComponent);
 *
 * VIRTUALIZATION:
 * - Use @tanstack/react-virtual for long lists
 * - Renders only visible items
 *
 * CODE SPLITTING:
 * - Use React.lazy for route-based code splitting
 * - Example: const Page = lazy(() => import('./Page'));
 */
