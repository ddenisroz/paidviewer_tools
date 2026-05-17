import { useEffect, useRef } from 'react';

import type { StreamData } from '@/types/stream';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

interface UseStreamTitleResetTimerArgs {
    initialData: StreamData;
    setCurrentData: Dispatch<SetStateAction<StreamData>>;
    isLinked: boolean;
    bothEnabled: boolean;
    twitchEnabled: boolean;
    vkEnabled: boolean;
    syncInProgressRef: MutableRefObject<boolean>;
    lastSyncedTitleRef: MutableRefObject<string>;
    isEditingRef: MutableRefObject<boolean>;
    setIsUserDirty: (value: boolean) => void;
}

export function useStreamTitleResetTimer({
    initialData,
    setCurrentData,
    isLinked,
    bothEnabled,
    twitchEnabled,
    vkEnabled,
    syncInProgressRef,
    lastSyncedTitleRef,
    isEditingRef,
    setIsUserDirty,
}: UseStreamTitleResetTimerArgs) {
    const resetTimerRef = useRef<number | null>(null);

    const clearTitleResetTimer = () => {
        if (resetTimerRef.current === null) return;
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
    };

    const restoreInitialTitles = () => {
        const initialTwitch = initialData.twitch?.title || '';
        const initialVk = initialData.vk?.title || '';
        const linkedRestoreTitle = initialTwitch || initialVk;

        syncInProgressRef.current = true;
        lastSyncedTitleRef.current = isLinked && bothEnabled ? linkedRestoreTitle : '';
        setCurrentData((prev) => {
            const next = { ...prev };
            if (isLinked && bothEnabled) {
                if (prev.twitch) next.twitch = { ...prev.twitch, title: linkedRestoreTitle };
                if (prev.vk) next.vk = { ...prev.vk, title: linkedRestoreTitle };
                return next;
            }
            if (twitchEnabled && prev.twitch) next.twitch = { ...prev.twitch, title: initialTwitch };
            if (vkEnabled && prev.vk) next.vk = { ...prev.vk, title: initialVk };
            return next;
        });
        setIsUserDirty(false);
        isEditingRef.current = false;
        window.setTimeout(() => {
            syncInProgressRef.current = false;
        }, 0);
    };

    const scheduleTitleReset = () => {
        clearTitleResetTimer();
        resetTimerRef.current = window.setTimeout(() => {
            resetTimerRef.current = null;
            restoreInitialTitles();
        }, 10000);
    };

    useEffect(() => {
        return () => {
            if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
        };
    }, []);

    return { clearTitleResetTimer, scheduleTitleReset };
}
