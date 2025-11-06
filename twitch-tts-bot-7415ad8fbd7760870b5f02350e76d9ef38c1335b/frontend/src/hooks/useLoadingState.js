import { useState, useEffect } from 'react';

export const useLoadingState = (isChecking) => { // Убрали isHealthy и engineLoaded
    const [showLoader, setShowLoader] = useState(true);
    const [minLoadingTime, setMinLoadingTime] = useState(true);

    // Минимальное время показа прелоадера (500ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinLoadingTime(false);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    // Показываем прелоадер если:
    // 1. Идет проверка health
    // 2. Не прошло минимальное время
    useEffect(() => {
        const shouldShowLoader = isChecking || minLoadingTime;
        setShowLoader(shouldShowLoader);
    }, [isChecking, minLoadingTime]); // Зависим только от isChecking и minLoadingTime

    return showLoader;
};
