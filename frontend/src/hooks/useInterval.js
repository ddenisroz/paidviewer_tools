import { useEffect, useRef, useCallback } from 'react';

/**
 * Modern hook for setInterval with automatic cleanup
 * Replaces manual setInterval/clearInterval patterns
 * 
 * @param {Function} callback - Function to execute
 * @param {number} delay - Interval in milliseconds (null to disable)
 * @returns {Object} { clear, reset } - Control functions
 * 
 * @example
 * const { clear, reset } = useInterval(() => {
 *   console.log('Repeating action');
 * }, 1000);
 */
export const useInterval = (callback, delay) => {
  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const set = useCallback(() => {
    if (delay === null) return;
    
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, delay);
  }, [delay]);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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

