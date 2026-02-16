import React, { useEffect, useMemo, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CheckCircle, Loader2, PenLine, Save } from 'lucide-react';

import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
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
    const twitchInputPadding = isLinked && bothEnabled ? 'pl-[4.5rem]' : 'pl-12';
    const vkInputPadding = 'pl-12';
    const isSaving = status.saveTitle === 'loading';
    const isSaved = status.saveTitle === 'success';
    const normalizeTitle = (value?: string) => (value ?? '').trim();
    const focusRestoreRef = useRef<{ twitch: string; vk: string }>({ twitch: '', vk: '' });
    const clearedOnFocusRef = useRef<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });

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
        if (lastSyncedTitleRef.current === masterTitle && twitchTitle === masterTitle && vkTitle === masterTitle) return;

        if (twitchTitle !== masterTitle || vkTitle !== masterTitle) {
            syncInProgressRef.current = true;
            lastSyncedTitleRef.current = masterTitle;
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch!, title: masterTitle },
                vk: { ...prev.vk!, title: masterTitle }
            }));
            setTimeout(() => {
                syncInProgressRef.current = false;
            }, 0);
        }
    }, [isLinked, bothEnabled, currentData.twitch?.title, currentData.vk?.title, setCurrentData]);

    const handleToggleLink = async (value: boolean) => {
        setLocalCombine(value);
        skipNextSyncRef.current = true;
        suppressSyncUntilRef.current = Date.now() + 300;

        // If enabling link, sync titles (take Twitch title as master) and auto-save
        if (value && bothEnabled) {
            const masterTitle = currentData.twitch?.title || currentData.vk?.title || '';
            if (masterTitle) {
                syncInProgressRef.current = true;
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch!, title: masterTitle },
                    vk: { ...prev.vk!, title: masterTitle }
                }));
                const hasChange = masterTitle !== initialData.twitch?.title || masterTitle !== initialData.vk?.title;
                if (hasChange) {
                    await saveChanges({
                        twitch: { title: masterTitle },
                        vk: { title: masterTitle }
                    }, 'saveTitle');
                }
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
        isEditingRef.current = true;
        lastSyncedTitleRef.current = value;
        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch!, title: value },
                vk: { ...prev.vk!, title: value }
            }));
            return;
        }

        if (platform === 'twitch') {
            setCurrentData(prev => ({ ...prev, twitch: { ...prev.twitch!, title: value } }));
            return;
        }

        setCurrentData(prev => ({ ...prev, vk: { ...prev.vk!, title: value } }));
    };

    const getTitleValue = (platform: 'twitch' | 'vk') =>
        platform === 'twitch' ? (currentData.twitch?.title || '') : (currentData.vk?.title || '');
    const getInitialTitleValue = (platform: 'twitch' | 'vk') =>
        platform === 'twitch' ? (initialData.twitch?.title || '') : (initialData.vk?.title || '');
    const hasPlatformChange = (platform: 'twitch' | 'vk') =>
        normalizeTitle(getTitleValue(platform)) !== normalizeTitle(getInitialTitleValue(platform));

    const handleSave = async (platform: 'twitch' | 'vk') => {
        const title = platform === 'twitch' ? currentData.twitch?.title : currentData.vk?.title;
        if (title === undefined) return;

        try {
            if (isLinked) {
                if (!isChanged) return;
                await saveChanges({
                    twitch: { title: currentData.twitch?.title },
                    vk: { title: currentData.twitch?.title } // Sync VK to Twitch
                }, 'saveTitle');
            } else {
                if (!hasPlatformChange(platform)) return;
                const payload: Partial<Record<'twitch' | 'vk', { title: string }>> = {};
                payload[platform] = { title };
                await saveChanges(payload, 'saveTitle');
            }
        } catch (error) {
            logger.error('Error saving title:', error);
        }
    };

    const handleSaveAll = () => {
        if (!isChanged) return;
        if (isLinked) {
            handleSave('twitch');
        } else {
            if (twitchEnabled) handleSave('twitch');
            if (vkEnabled) handleSave('vk');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent, platform: 'twitch' | 'vk') => {
        if (e.key === 'Enter') {
            (e.currentTarget as HTMLInputElement).blur();
            handleSave(platform);
        }
    };

    // Helper for input blur
    const restoreValueIfNeeded = (platform: 'twitch' | 'vk') => {
        if (!clearedOnFocusRef.current[platform]) return false;
        const currentValue = getTitleValue(platform);
        if (currentValue.trim() !== '') {
            clearedOnFocusRef.current[platform] = false;
            return false;
        }
        const restoreValue = focusRestoreRef.current[platform];
        if (!restoreValue) {
            clearedOnFocusRef.current[platform] = false;
            return true;
        }
        lastSyncedTitleRef.current = restoreValue;
        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch!, title: restoreValue },
                vk: { ...prev.vk!, title: restoreValue }
            }));
        } else if (platform === 'twitch') {
            setCurrentData(prev => ({ ...prev, twitch: { ...prev.twitch!, title: restoreValue } }));
        } else {
            setCurrentData(prev => ({ ...prev, vk: { ...prev.vk!, title: restoreValue } }));
        }
        clearedOnFocusRef.current[platform] = false;
        return true;
    };

    const handleInputBlur = (platform: 'twitch' | 'vk') => {
        isEditingRef.current = false;
        const restored = restoreValueIfNeeded(platform);
        if (restored) return;
        handleSave(platform);
    };

    const handleInputFocus = (platform: 'twitch' | 'vk', e: React.FocusEvent<HTMLInputElement>) => {
        isEditingRef.current = true;
        const currentValue = getTitleValue(platform);
        focusRestoreRef.current[platform] = currentValue;
        if (currentValue.trim() !== '') {
            clearedOnFocusRef.current[platform] = true;
            handleTitleChange(platform, '');
        } else {
            clearedOnFocusRef.current[platform] = false;
        }
        e.target.setSelectionRange(0, 0);
    };

    const isChanged = useMemo(() => {
        const twitchChanged = twitchEnabled &&
            normalizeTitle(initialData.twitch?.title) !== normalizeTitle(currentData.twitch?.title);
        const vkChanged = vkEnabled &&
            normalizeTitle(initialData.vk?.title) !== normalizeTitle(currentData.vk?.title);
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
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch!, title: restoreValue },
                    vk: { ...prev.vk!, title: restoreValue }
                }));
            }
            return;
        }

        if (twitchEnabled && !currentTwitch && initialTwitch) {
            setCurrentData(prev => ({ ...prev, twitch: { ...prev.twitch!, title: initialTwitch } }));
        }
        if (vkEnabled && !currentVk && initialVk) {
            setCurrentData(prev => ({ ...prev, vk: { ...prev.vk!, title: initialVk } }));
        }
    }, [initialData, currentData, twitchEnabled, vkEnabled, isLinked, bothEnabled, setCurrentData]);

    const footer = (
        <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-7 text-sm font-medium shadow-sm transition-all duration-300"
            onClick={handleSaveAll}
            disabled={isSaving || !isChanged}
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
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-100 flex items-center gap-1 z-20">
                            <TwitchIcon className="w-6 h-6 text-white/80" />
                            <VKIcon
                                className={`w-6 h-6 text-white/80 transition-opacity duration-200 ${isLinked && bothEnabled ? 'opacity-100' : 'opacity-0'}`}
                            />
                        </div>
                                <Input
                                    id="stream-title-twitch"
                                    name="stream-title-twitch"
                                    value={currentData.twitch?.title || ''}
                                    onChange={(e) => handleTitleChange('twitch', e.target.value)}
                                    onKeyDown={(e) => handleKeyPress(e, 'twitch')}
                                    onBlur={() => handleInputBlur('twitch')}
                                    onFocus={(e) => handleInputFocus('twitch', e)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    placeholder={isLinked ? "Общее название стрима..." : (twitchEnabled ? "Название на Twitch..." : "нет подключения")}
                                    className={`h-10 ${twitchInputPadding} pr-4 transition-[padding] duration-300 ease-in-out ${!twitchEnabled && !isLinked ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
                                    disabled={!twitchEnabled && !isLinked}
                                />
                    </div>
                </div>

                {/* VK Input - Collapsible */}
                <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isLinked && bothEnabled ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'}`}>
                    <div className="overflow-hidden min-h-0">
                        <div className="space-y-4 pt-0 relative mt-4 min-h-0">
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
                                    onBlur={() => handleInputBlur('vk')}
                                    onFocus={(e) => handleInputFocus('vk', e)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    placeholder={vkEnabled ? "Название на VK Live..." : "нет подключения"}
                                    className={`h-10 ${vkInputPadding} pr-4 transition-[padding] duration-300 ease-in-out ${!vkEnabled ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
                                    disabled={!vkEnabled}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </StreamCardLayout>
    );
};

export default StreamTitleCard;
