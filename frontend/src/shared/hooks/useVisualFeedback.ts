/**
 * Visual Feedback Hook
 * Provides utilities for visual feedback (ripple effects, success animations, etc.)
 * Requirements: 4.2, 4.3
 */

import { useCallback, useRef } from 'react';

import { toast } from 'sonner';

interface RippleOptions {
    color?: string;
    duration?: number;
}

interface SuccessToastOptions {
    title: string;
    description?: string;
    duration?: number;
}

export const useVisualFeedback = () => {
    const rippleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Create a ripple effect on an element
     * Provides immediate visual feedback within 200ms
     */
    const createRipple = useCallback((event: React.MouseEvent<HTMLElement>, options: RippleOptions = {}) => {
        const { color = 'rgba(255, 255, 255, 0.5)', duration = 600 } = options;

        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      transform: scale(0);
      opacity: 0.6;
      animation: ripple ${duration}ms ease-out;
    `;

        // Ensure parent has position relative
        if (getComputedStyle(button).position === 'static') {
            button.style.position = 'relative';
        }
        button.style.overflow = 'hidden';

        button.appendChild(ripple);

        // Clean up after animation
        if (rippleTimeoutRef.current) {
            clearTimeout(rippleTimeoutRef.current);
        }

        rippleTimeoutRef.current = setTimeout(() => {
            ripple.remove();
        }, duration);
    }, []);

    /**
     * Show success toast with checkmark animation
     * Provides feedback within 200ms
     */
    const showSuccessToast = useCallback((options: SuccessToastOptions) => {
        const { title, description, duration = 3000 } = options;

        toast.success(title, {
            description,
            duration,
            className: 'success-fade-in',
        });
    }, []);

    /**
     * Show error toast with shake animation
     */
    const showErrorToast = useCallback((title: string, description?: string) => {
        toast.error(title, {
            description,
            duration: 4000,
            className: 'shake-animation',
        });
    }, []);

    /**
     * Show loading toast
     */
    const showLoadingToast = useCallback((title: string, description?: string) => {
        return toast.loading(title, {
            description,
        });
    }, []);

    /**
     * Dismiss a toast
     */
    const dismissToast = useCallback((toastId: string | number) => {
        toast.dismiss(toastId);
    }, []);

    /**
     * Add button press animation
     */
    const addButtonPressEffect = useCallback((element: HTMLElement) => {
        element.classList.add('button-press');
        setTimeout(() => {
            element.classList.remove('button-press');
        }, 200);
    }, []);

    /**
     * Add success pulse animation to an element
     */
    const addSuccessPulse = useCallback((element: HTMLElement) => {
        element.classList.add('success-pulse');
        setTimeout(() => {
            element.classList.remove('success-pulse');
        }, 400);
    }, []);

    /**
     * Add shake animation for errors
     */
    const addShakeAnimation = useCallback((element: HTMLElement) => {
        element.classList.add('shake-animation');
        setTimeout(() => {
            element.classList.remove('shake-animation');
        }, 400);
    }, []);

    /**
     * Show success ripple effect
     */
    const showSuccessRipple = useCallback((element: HTMLElement) => {
        element.classList.add('success-ripple');
        setTimeout(() => {
            element.classList.remove('success-ripple');
        }, 600);
    }, []);

    return {
        createRipple,
        showSuccessToast,
        showErrorToast,
        showLoadingToast,
        dismissToast,
        addButtonPressEffect,
        addSuccessPulse,
        addShakeAnimation,
        showSuccessRipple,
    };
};

export default useVisualFeedback;
