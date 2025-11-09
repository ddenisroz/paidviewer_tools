import { useEffect, useRef, useCallback } from 'react';

/**
 * Modern hook for setTimeout with automatic cleanup
 * Replaces manual setTimeout/clearTimeout patterns
 * 
 * @param {Function} callback - Function to execute
 * @param {number} delay - Delay in milliseconds (null to disable)
 * @returns {Object} { clear, reset } - Control functions
 * 
 * @example
 * const { clear, reset } = useTimeout(() => {
 *   console.log('Delayed action');
 * }, 1000);
 */
export const useTimeout = (callback, delay) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const set = useCallback(() => {
    if (delay === null) return;
    
    timeoutRef.current = setTimeout(() => {
      callbackRef.current();
    }, delay);
  }, [delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    set();
  }, [clear, set]);

  useEffect(() => {
    set();
    return clear;
  }, [delay, set, clear]);

  return { clear, reset };
};

