import React, { useEffect, useMemo, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CheckCircle, Loader2, PenLine, Save } from 'lucide-react';

import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useStreamTitleResetTimer } from '@/features/stream/hooks/useStreamTitleResetTimer';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { logger } from '@/shared/utils/prodLogger';

import { StreamCardLayout } from './StreamCardLayout';

const StreamTitleCard: React.FC = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();

    const { combine_titles } = getCombineSettings();
    const isEditingRef = useRef(false);
    const syncInProgressRef = useRef(false);
    const lastSyncedTitleRef = useRef('');
    const skipNextSyncRef = useRef(false);
    const suppressSyncUntilRef = useRef(0);

    // Local state for immediate optimisic UI updates
    const [localCombine, setLocalCombine] = useState(combine_titles);

    useEffect(() => {
        setLocalCombine(combine_titles);
    }, [combine_titles]);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);

    const isLinked = localCombine && bothEnabled;
    const twitchInputPadding = isLinked && bothEnabled ? 'pl-[4.75rem]' : 'pl-[3.15rem]';
    const vkInputPadding = 'pl-[3.15rem]';
    const STREAM_FIELD_CLASS = 'border-border/70 bg-background/60 text-foreground placeholder:text-muted-foreground';
    const isSaving = status.saveTitle === 'loading';
    const isSaved = status.saveTitle === 'success';
    const showVkField = !(isLinked && bothEnabled);
    const [isUserDirty, setIsUserDirty] = useState(false);
    const normalizeTitle = (value?: string) => (value ?? '').trim();
    const saveButtonRef = useRef<HTMLButtonElement | null>(null);
    const suppressBlurRestoreRef = useRef(false);
    const { clearTitleResetTimer, scheduleTitleReset } = useStreamTitleResetTimer({
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
    });

    useEffect(() => {
        if (Date.now() < suppressSyncUntilRef.current) {
            return;
        }
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }
        if (!isLinked || !bothEnabled) return;
        if (isEditingRef.current || syncInProgressRef.current) return;
        const twitchTitle = currentData.twitch?.title || '';
        const vkTitle = currentData.vk?.title || '';
        const masterTitle = twitchTitle || vkTitle;
        if (!masterTitle) return;
        if (lastSyncedTitleRef.current === masterTitle && twitchTitle === masterTitle && vkTitle === masterTitle)
            return;

        if (twitchTitle !== masterTitle || vkTitle !== masterTitle) {
            syncInProgressRef.current = true;
            lastSyncedTitleRef.current = masterTitle;
            setCurrentData((prev) => ({
                ...prev,
                twitch: { ...prev.twitch!, title: masterTitle },
                vk: { ...prev.vk!, title: masterTitle },
            }));
            setTimeout(() => {
                syncInProgressRef.current = false;
            }, 0);
        }
    }, [isLinked, bothEnabled, currentData.twitch?.title, currentData.vk?.title, setCurrentData]);

    const handleToggleLink = async (value: boolean) => {
        if (value === localCombine) return;
        setLocalCombine(value);
        skipNextSyncRef.current = true;
        suppressSyncUntilRef.current = Date.now() + 300;

        // If enabling link, sync both values instantly in UI.
        // Persisting stream data remains explicit via Save button.
        if (value && bothEnabled) {
            const masterTitle = currentData.twitch?.title || currentData.vk?.title || '';
            if (masterTitle) {
                syncInProgressRef.current = true;
                setCurrentData((prev) => ({
                    ...prev,
                    twitch: { ...prev.twitch!, title: masterTitle },
                    vk: { ...prev.vk!, title: masterTitle },
                }));
                setTimeout(() => {
                    syncInProgressRef.current = false;
                }, 0);
            }
        }

        try {
            const success = await updateSetting('combine_titles', value);
            if (!success) {
                setLocalCombine(!value); // Revert on failure
            }
        } catch {
            setLocalCombine(!value);
        }
    };

    const handleTitleChange = (platform: 'twitch' | 'vk', value: string) => {
        clearTitleResetTimer();
        setIsUserDirty(true);
        isEditingRef.current = true;
        lastSyncedTitleRef.current = value;
        if (isLinked && bothEnabled) {
            setCurrentData((prev) => ({
                ...prev,
                twitch: { ...prev.twitch!, title: value },
                vk: { ...prev.vk!, title: value },
            }));
            return;
        }

        if (platform === 'twitch') {
            setCurrentData((prev) => ({ ...prev, twitch: { ...prev.twitch!, title: value } }));
            return;
        }

        setCurrentData((prev) => ({ ...prev, vk: { ...prev.vk!, title: value } }));
    };

    const getTitleValue = (platform: 'twitch' | 'vk') =>
        platform === 'twitch' ? currentData.twitch?.title || '' : currentData.vk?.title || '';
    const getInitialTitleValue = (platform: 'twitch' | 'vk') =>
        platform === 'twitch' ? initialData.twitch?.title || '' : initialData.vk?.title || '';
    const hasPlatformChange = (platform: 'twitch' | 'vk') =>
        normalizeTitle(getTitleValue(platform)) !== normalizeTitle(getInitialTitleValue(platform));

    const handleSave = async (platform: 'twitch' | 'vk') => {
        const title = platform === 'twitch' ? currentData.twitch?.title : currentData.vk?.title;
        if (title === undefined) return;

        try {
            let success = false;
            if (isLinked) {
                if (!isChanged) return;
                const linkedTitle = currentData.twitch?.title ?? currentData.vk?.title ?? '';
                success = await saveChanges(
                    {
                        twitch: { title: linkedTitle },
                        vk: { title: linkedTitle },
                    },
                    'saveTitle'
                );
            } else {
                if (!hasPlatformChange(platform)) return;
                const payload: Partial<Record<'twitch' | 'vk', { title: string }>> = {};
                payload[platform] = { title };
                success = await saveChanges(payload, 'saveTitle');
            }

            if (success) {
                clearTitleResetTimer();
                setIsUserDirty(false);
                isEditingRef.current = false;
                suppressBlurRestoreRef.current = true;
                const active = document.activeElement as HTMLElement | null;
                active?.blur();
            }
        } catch (error) {
            logger.error('Error saving title:', error);
        }
    };

    const handleSaveAll = async () => {
        if (!isChanged) return;
        if (isLinked) {
            await handleSave('twitch');
            return;
        }
        if (twitchEnabled) await handleSave('twitch');
        if (vkEnabled) await handleSave('vk');
    };

    const handleKeyPress = (e: React.KeyboardEvent, platform: 'twitch' | 'vk') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            isEditingRef.current = false;
            void handleSave(platform);
        }
    };

    const handleInputBlur = (platform: 'twitch' | 'vk', e: React.FocusEvent<HTMLInputElement>) => {
        isEditingRef.current = false;

        if (suppressBlurRestoreRef.current) {
            suppressBlurRestoreRef.current = false;
            return;
        }

        const nextFocused = e.relatedTarget as Node | null;
        if (nextFocused && saveButtonRef.current?.contains(nextFocused)) {
            return;
        }

        if (isChanged && isUserDirty && !isSaving) {
            scheduleTitleReset();
        }
    };

    const handleInputFocus = (platform: 'twitch' | 'vk', e: React.FocusEvent<HTMLInputElement>) => {
        clearTitleResetTimer();
        isEditingRef.current = true;
        lastSyncedTitleRef.current = getTitleValue(platform);
        e.target.select();
    };

    const isChanged = useMemo(() => {
        const twitchChanged =
            twitchEnabled && normalizeTitle(initialData.twitch?.title) !== normalizeTitle(currentData.twitch?.title);
        const vkChanged = vkEnabled && normalizeTitle(initialData.vk?.title) !== normalizeTitle(currentData.vk?.title);
        return twitchChanged || vkChanged;
    }, [initialData, currentData, twitchEnabled, vkEnabled]);

    useEffect(() => {
        if (isEditingRef.current) return;
        if (!twitchEnabled && !vkEnabled) return;
        const initialTwitch = normalizeTitle(initialData.twitch?.title);
        const currentTwitch = normalizeTitle(currentData.twitch?.title);
        const initialVk = normalizeTitle(initialData.vk?.title);
        const currentVk = normalizeTitle(currentData.vk?.title);

        if (isLinked && bothEnabled) {
            const needsRestore = !currentTwitch && !currentVk && (initialTwitch || initialVk);
            if (needsRestore) {
                const restoreValue = initialTwitch || initialVk;
                setCurrentData((prev) => ({
                    ...prev,
                    twitch: { ...prev.twitch!, title: restoreValue },
                    vk: { ...prev.vk!, title: restoreValue },
                }));
            }
            return;
        }

        if (twitchEnabled && !currentTwitch && initialTwitch) {
            setCurrentData((prev) => ({ ...prev, twitch: { ...prev.twitch!, title: initialTwitch } }));
        }
        if (vkEnabled && !currentVk && initialVk) {
            setCurrentData((prev) => ({ ...prev, vk: { ...prev.vk!, title: initialVk } }));
        }
    }, [initialData, currentData, twitchEnabled, vkEnabled, isLinked, bothEnabled, setCurrentData]);

    const footer = (
        <Button
            ref={saveButtonRef}
            className={`w-full h-7 text-sm font-medium shadow-sm transition-all duration-300 ${
                isSaving || !isChanged || !isUserDirty
                    ? 'bg-blue-800/35 text-blue-100/90 border border-blue-600/40'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
            onClick={() => void handleSaveAll()}
            disabled={isSaving || !isChanged || !isUserDirty}
        >
            {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isSaved ? (
                <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
                <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Сохранение...' : isSaved ? 'Сохранено' : 'Сохранить'}
        </Button>
    );

    return (
        <StreamCardLayout
            title="Название стрима"
            icon={<PenLine className="h-5 w-5 text-green-500" />}
            isLinked={isLinked || false}
            bothEnabled={bothEnabled}
            onToggleLink={handleToggleLink}
            footer={footer}
        >
            <div className="flex-1">
                {/* Twitch / Main Input */}
                <div className="space-y-4 relative">
                    <div className="relative">
                        <div
                            className={`absolute left-3 top-1/2 z-20 flex -translate-y-1/2 items-center pointer-events-none ${isLinked && bothEnabled ? 'w-[3.75rem] gap-2' : 'w-6'}`}
                        >
                            <TwitchIcon width={24} height={24} className="text-white/80 shrink-0" />
                            {isLinked && bothEnabled && (
                                <VKIcon width={24} height={24} className="text-white/80 shrink-0" />
                            )}
                        </div>
                        <Input
                            id="stream-title-twitch"
                            name="stream-title-twitch"
                            value={currentData.twitch?.title || ''}
                            onChange={(e) => handleTitleChange('twitch', e.target.value)}
                            onKeyDown={(e) => handleKeyPress(e, 'twitch')}
                            onBlur={(e) => handleInputBlur('twitch', e)}
                            onFocus={(e) => handleInputFocus('twitch', e)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder={
                                isLinked
                                    ? 'Общее название стрима...'
                                    : twitchEnabled
                                      ? 'Название на Twitch...'
                                      : 'нет подключения'
                            }
                            className={`h-10 ${twitchInputPadding} pr-4 ${STREAM_FIELD_CLASS} ${!twitchEnabled && !isLinked ? 'bg-muted/40 cursor-not-allowed opacity-60' : ''}`}
                            disabled={!twitchEnabled && !isLinked}
                        />
                    </div>
                </div>

                <div
                    className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${showVkField ? 'mt-4 max-h-20 opacity-100' : 'mt-0 max-h-0 opacity-0'}`}
                    aria-hidden={!showVkField}
                >
                    <div>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-100 flex items-center z-20">
                                <VKIcon className="w-6 h-6 text-white/80" />
                            </div>
                            <Input
                                id="stream-title-vk"
                                name="stream-title-vk"
                                value={currentData.vk?.title || ''}
                                onChange={(e) => handleTitleChange('vk', e.target.value)}
                                onKeyDown={(e) => handleKeyPress(e, 'vk')}
                                onBlur={(e) => handleInputBlur('vk', e)}
                                onFocus={(e) => handleInputFocus('vk', e)}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder={vkEnabled ? 'Название на VK Live...' : 'нет подключения'}
                                className={`h-10 ${vkInputPadding} pr-4 ${STREAM_FIELD_CLASS} ${!vkEnabled ? 'bg-muted/40 cursor-not-allowed opacity-60' : ''}`}
                                disabled={!vkEnabled || !showVkField}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </StreamCardLayout>
    );
};

export default StreamTitleCard;
