import { useState, useEffect } from 'react';

/**
 * Хук для управления анимацией появления страницы
 * Анимация проигрывается только при первой загрузке страницы или после перезагрузки
 * 
 * @param {string} pageKey - Уникальный ключ страницы для кэширования
 * @param {number} delay - Задержка перед показом анимации (мс)
 * @returns {{ shouldAnimate: boolean, contentLoaded: boolean }}
 */
export const usePageAnimation = (pageKey, delay = 100) => {
    const [shouldAnimate, setShouldAnimate] = useState(true);
    const [contentLoaded, setContentLoaded] = useState(false);

    useEffect(() => {
        // Проверяем localStorage: была ли страница уже загружена в этой сессии
        const cacheKey = `page_animation_${pageKey}`;
        const wasCached = sessionStorage.getItem(cacheKey);

        if (wasCached) {
            // Если страница уже была загружена в этой сессии, не показываем анимацию
            setShouldAnimate(false);
            setContentLoaded(true);
        } else {
            // Первая загрузка страницы в этой сессии - показываем анимацию
            setShouldAnimate(true);
            
            // Сразу помечаем страницу как загруженную
            sessionStorage.setItem(cacheKey, 'true');
            
            let timer;
            // Небольшая задержка чтобы браузер успел отрисовать элементы в начальном состоянии
            const rafId1 = requestAnimationFrame(() => {
                timer = setTimeout(() => {
                    setContentLoaded(true);
                }, delay);
            });

            return () => {
                cancelAnimationFrame(rafId1);
                if (timer) clearTimeout(timer);
            };
        }
    }, [pageKey, delay]);

    return { shouldAnimate, contentLoaded };
};

/**
 * Хелпер для получения классов анимации
 * 
 * @param {boolean} shouldAnimate - Нужно ли показывать анимацию
 * @param {boolean} contentLoaded - Загружен ли контент
 * @param {number} delay - Задержка (мс)
 * @returns {{ className: string, style: object }} Объект с className и style
 */
export const getAnimationClasses = (shouldAnimate, contentLoaded, delay = 0) => {
    if (!shouldAnimate) {
        // Если анимация отключена, сразу показываем контент
        return { className: 'opacity-100 translate-y-0', style: {} };
    }
    
    // Если анимация включена, используем transition
    const className = `transition-all duration-500 ${contentLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`;
    const style = delay > 0 ? { transitionDelay: `${delay}ms` } : {};
    
    return { className, style };
};

