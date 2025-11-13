import { NavigateOptions, To, useNavigate } from 'react-router-dom';

// Remove global declaration to avoid conflict with DOM types

export function useViewTransition(): (to: To, options?: NavigateOptions) => void {
  const navigate = useNavigate();
  const transitionNavigate = (to: To, options: NavigateOptions = {}) => {
    if ('startViewTransition' in document && typeof (document as any).startViewTransition === 'function') {
      (document as any).startViewTransition(() => {
        navigate(to, options);
      });
    } else {
      navigate(to, options);
    }
  };
  return transitionNavigate;
}


