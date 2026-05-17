import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast as sonnerToast } from 'sonner';
import { toast } from '../toastManager';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
    },
}));

describe('ToastManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        toast.dismissAll();
    });

    describe('Basic functionality', () => {
        it('shows success toast', () => {
            toast.success('Test success');
            expect(sonnerToast.success).toHaveBeenCalledWith(
                'Test success',
                expect.objectContaining({
                    duration: 2000,
                })
            );
        });

        it('shows error toast with longer duration', () => {
            toast.error('Test error');
            expect(sonnerToast.error).toHaveBeenCalledWith(
                'Test error',
                expect.objectContaining({
                    duration: 4000,
                })
            );
        });

        it('shows warning toast', () => {
            toast.warning('Test warning');
            expect(sonnerToast.warning).toHaveBeenCalledWith(
                'Test warning',
                expect.objectContaining({
                    duration: 3000,
                })
            );
        });

        it('shows info toast', () => {
            toast.info('Test info');
            expect(sonnerToast.info).toHaveBeenCalledWith(
                'Test info',
                expect.objectContaining({
                    duration: 2000,
                })
            );
        });
    });

    describe('Custom options', () => {
        it('accepts custom duration', () => {
            toast.success('Test', { duration: 5000 });
            expect(sonnerToast.success).toHaveBeenCalledWith(
                'Test',
                expect.objectContaining({
                    duration: 5000,
                })
            );
        });

        it('accepts description', () => {
            toast.success('Test', { description: 'Details' });
            expect(sonnerToast.success).toHaveBeenCalledWith(
                'Test',
                expect.objectContaining({
                    description: 'Details',
                })
            );
        });

        it('accepts action', () => {
            const onClick = vi.fn();
            toast.error('Test', {
                action: {
                    label: 'Retry',
                    onClick,
                },
            });
            expect(sonnerToast.error).toHaveBeenCalledWith(
                'Test',
                expect.objectContaining({
                    action: {
                        label: 'Retry',
                        onClick,
                    },
                })
            );
        });
    });

    describe('Grouping similar toasts', () => {
        it('groups identical messages', () => {
            vi.clearAllMocks();

            toast.success('File uploaded');
            expect(sonnerToast.success).toHaveBeenCalledTimes(1);
            expect(sonnerToast.success).toHaveBeenLastCalledWith('File uploaded', expect.any(Object));

            // Second call within grouping window
            toast.success('File uploaded');
            expect(sonnerToast.success).toHaveBeenCalledTimes(2);
            expect(sonnerToast.success).toHaveBeenLastCalledWith('File uploaded (2)', expect.any(Object));

            // Third call
            toast.success('File uploaded');
            expect(sonnerToast.success).toHaveBeenCalledTimes(3);
            expect(sonnerToast.success).toHaveBeenLastCalledWith('File uploaded (3)', expect.any(Object));
        });

        it('normalizes messages for grouping', () => {
            vi.clearAllMocks();

            toast.success('User 123 created');
            toast.success('User 456 created');

            // Should group because numbers are normalized
            expect(sonnerToast.success).toHaveBeenCalledTimes(2);
            expect(sonnerToast.success).toHaveBeenLastCalledWith('User 456 created (2)', expect.any(Object));
        });

        it('does not group different message types', () => {
            vi.clearAllMocks();

            toast.success('Test message');
            toast.error('Test message');

            // Should not group because types are different
            expect(sonnerToast.success).toHaveBeenCalledTimes(1);
            expect(sonnerToast.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('Dismiss functionality', () => {
        it('dismisses all toasts', () => {
            toast.dismissAll();
            expect(sonnerToast.dismiss).toHaveBeenCalledWith();
        });

        it('dismisses specific toast', () => {
            const id = 'test-id';
            toast.dismiss(id);
            expect(sonnerToast.dismiss).toHaveBeenCalledWith(id);
        });
    });

    describe('Message normalization', () => {
        it('removes quotes for grouping', () => {
            vi.clearAllMocks();

            toast.success('"File" uploaded');
            toast.success("'File' uploaded");

            // Should group because quotes are removed
            expect(sonnerToast.success).toHaveBeenCalledTimes(2);
            expect(sonnerToast.success).toHaveBeenLastCalledWith("'File' uploaded (2)", expect.any(Object));
        });

        it('is case insensitive for grouping', () => {
            vi.clearAllMocks();

            toast.success('Test Message');
            toast.success('test message');

            // Should group because case is normalized
            expect(sonnerToast.success).toHaveBeenCalledTimes(2);
            expect(sonnerToast.success).toHaveBeenLastCalledWith('test message (2)', expect.any(Object));
        });
    });

    describe('Edge cases', () => {
        it('handles empty messages', () => {
            toast.success('');
            expect(sonnerToast.success).toHaveBeenCalledWith('', expect.any(Object));
        });

        it('handles very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            toast.success(longMessage);
            expect(sonnerToast.success).toHaveBeenCalledWith(longMessage, expect.any(Object));
        });

        it('handles special characters', () => {
            const specialMessage = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            toast.success(specialMessage);
            expect(sonnerToast.success).toHaveBeenCalledWith(specialMessage, expect.any(Object));
        });
    });
});
