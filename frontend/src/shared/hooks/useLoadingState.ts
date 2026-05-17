import { useEffect, useState } from 'react';

export const useLoadingState = (isChecking: boolean): boolean => {
    const [showLoader, setShowLoader] = useState<boolean>(true);
    const [minLoadingTime, setMinLoadingTime] = useState<boolean>(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMinLoadingTime(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const shouldShowLoader = isChecking || minLoadingTime;
        setShowLoader(shouldShowLoader);
    }, [isChecking, minLoadingTime]);

    return showLoader;
};
