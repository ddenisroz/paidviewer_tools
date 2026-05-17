import { NavigateOptions, To, useNavigate } from 'react-router-dom';

// Remove global declaration to avoid conflict with DOM types

export function useViewTransition(): (to: To, options?: NavigateOptions) => void {
    const navigate = useNavigate();
    const transitionNavigate = (to: To, options: NavigateOptions = {}) => {
        const doc = document as Document & { startViewTransition?: (callback: () => void) => void };
        if ('startViewTransition' in document && typeof doc.startViewTransition === 'function') {
            doc.startViewTransition(() => {
                navigate(to, options);
            });
        } else {
            navigate(to, options);
        }
    };
    return transitionNavigate;
}
