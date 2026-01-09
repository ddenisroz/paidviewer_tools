// src/components/ui/toast.tsx
/**
 * Toast component using sonner library.
 */

import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export const Toaster = () => {
    return (
        <SonnerToaster
            position="bottom-right"
            toastOptions={{
                style: {
                    background: 'var(--bg-secondary, #1a1a2e)',
                    color: 'var(--text-primary, #ffffff)',
                    border: '1px solid var(--border-color, #333)',
                },
            }}
        />
    );
};

export default Toaster;
