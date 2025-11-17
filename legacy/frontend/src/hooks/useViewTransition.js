// hooks/useViewTransition.js
import { useNavigate } from 'react-router-dom';

/**
 * Хук для плавной навигации с View Transitions API
 * Современный способ для анимированных переходов между страницами
 */
export function useViewTransition() {
  const navigate = useNavigate();
  
  const transitionNavigate = (to, options = {}) => {
    // Проверяем поддержку View Transitions API
    if (!document.startViewTransition) {
      // Fallback для браузеров без поддержки
      navigate(to, options);
      return;
    }
    
    // Используем View Transitions API для плавного перехода
    document.startViewTransition(() => {
      navigate(to, options);
    });
  };
  
  return transitionNavigate;
}

