import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle, Loader2, Save, Tag } from 'lucide-react';

import { categoryMapping } from '@/constants/categoryMapping';
import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import { StreamCardLayout } from './StreamCardLayout';
import { StreamCategoryDropdown } from './StreamCategoryDropdown';

import type { StreamCategory } from '@/types/stream';

const StreamCategoryCard: React.FC = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status, categories, loading, searchCategories } =
        useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_categories: combineCategories } = getCombineSettings();

    const [localCombineCategories, setLocalCombineCategories] = useState(combineCategories);

    useEffect(() => {
        if (isSyncingRef.current) return;
        setLocalCombineCategories(combineCategories);
    }, [combineCategories]);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);
    const isLinked = useMemo(() => localCombineCategories && bothEnabled, [localCombineCategories, bothEnabled]);
    const [searchTerms, setSearchTerms] = useState<{ twitch: string; vk: string }>({ twitch: '', vk: '' });
    const [showDropdown, setShowDropdown] = useState<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedTwitchSearch = useDebounce(searchTerms.twitch, 450);
    const debouncedVkSearch = useDebounce(searchTerms.vk, 450);

    const twitchInputRef = useRef<HTMLInputElement>(null);
    const vkInputRef = useRef<HTMLInputElement>(null);
    const isEditingRef = useRef<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });
    const isSyncingRef = useRef(false);
    const skipNextSyncRef = useRef(false);
    const suppressSyncUntilRef = useRef(0);
    const suppressBlurRestoreRef = useRef(false);

    const getCategoryName = (category: StreamCategory | undefined | null) => category?.name || category?.title || '';

    // Handle Toggle
    const handleToggleChange = async (value: boolean) => {
        if (value === localCombineCategories) return;
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        skipNextSyncRef.current = true;
        suppressSyncUntilRef.current = Date.now() + 600;
        const previousValue = localCombineCategories;
        const prevSearchTerms = searchTerms;
        setLocalCombineCategories(value);
        isEditingRef.current = { twitch: false, vk: false };
        setShowDropdown({ twitch: false, vk: false });

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        const twitchCat = currentData.twitch?.category as StreamCategory | undefined;
        const vkCat = currentData.vk?.category as StreamCategory | undefined;
        const twitchName = getCategoryName(twitchCat);
        const vkName = getCategoryName(vkCat);

        if (value && bothEnabled) {
            const combinedName = twitchName || vkName;
            setSearchTerms({ twitch: combinedName, vk: combinedName });
        } else {
            setSearchTerms({ twitch: twitchName, vk: vkName });
        }

        try {
            const success = await updateSetting('combine_categories', value);
            if (!success) {
                setLocalCombineCategories(previousValue);
                setSearchTerms(prevSearchTerms);
                return;
            }
        } catch (error) {
            logger.error('[SYNC ERROR]', error);
            setLocalCombineCategories(previousValue);
            setSearchTerms(prevSearchTerms);
            toast.error('Ошибка синхронизации категорий.');
        } finally {
            isSyncingRef.current = false;
        }
    };

    // Load initial search terms
    useEffect(() => {
        if (Date.now() < suppressSyncUntilRef.current) {
            return;
        }
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }
        if (isSyncingRef.current) return;
        const twitchCat = currentData.twitch?.category as StreamCategory | undefined;
        const vkCat = currentData.vk?.category as StreamCategory | undefined;
        const nextTwitch = getCategoryName(twitchCat);
        const nextVk = getCategoryName(vkCat);

        setSearchTerms((prev) => {
            let changed = false;
            const next = { ...prev };

            if (isLinked && bothEnabled) {
                const combinedName = nextTwitch || nextVk;
                if (
                    !isEditingRef.current.twitch &&
                    !isEditingRef.current.vk &&
                    !showDropdown.twitch &&
                    !showDropdown.vk
                ) {
                    if (prev.twitch !== combinedName || prev.vk !== combinedName) {
                        next.twitch = combinedName;
                        next.vk = combinedName;
                        changed = true;
                    }
                }
                return changed ? next : prev;
            }

            if (!isEditingRef.current.twitch && !showDropdown.twitch && prev.twitch !== nextTwitch) {
                next.twitch = nextTwitch;
                changed = true;
            }
            if (!isEditingRef.current.vk && !showDropdown.vk && prev.vk !== nextVk) {
                next.vk = nextVk;
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [
        currentData.twitch?.category,
        currentData.vk?.category,
        showDropdown.twitch,
        showDropdown.vk,
        isLinked,
        bothEnabled,
    ]);

    // Trigger searches
    useEffect(() => {
        const query = debouncedTwitchSearch.trim();
        if (query.length >= 1 && showDropdown.twitch && twitchEnabled) {
            searchCategories('twitch', query);
        }
    }, [debouncedTwitchSearch, showDropdown.twitch, searchCategories, twitchEnabled]);

    useEffect(() => {
        const query = debouncedVkSearch.trim();
        if (query.length >= 1 && showDropdown.vk && vkEnabled) {
            searchCategories('vk', query);
        }
    }, [debouncedVkSearch, showDropdown.vk, searchCategories, vkEnabled]);

    // Click Outside Handling
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            const isClickInsidePortal = target.closest('[data-category-dropdown="true"]');
            const isTwitchInput = twitchInputRef.current && twitchInputRef.current.contains(target);
            const isVkInput = vkInputRef.current && vkInputRef.current.contains(target);

            if (!isClickInsidePortal && !isTwitchInput && !isVkInput) {
                setShowDropdown({ twitch: false, vk: false });

                // Revert search terms if not selected
                const twitchCat = currentData.twitch?.category as StreamCategory | undefined;
                const vkCat = currentData.vk?.category as StreamCategory | undefined;
                setSearchTerms({
                    twitch: getCategoryName(twitchCat),
                    vk: getCategoryName(vkCat),
                });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [currentData]);

    const handleSearchChange = (platform: string, value: string) => {
        const nextValue = value;
        if (isLinked && bothEnabled && platform === 'twitch') {
            isEditingRef.current = { twitch: true, vk: true };
            setSearchTerms({ twitch: nextValue, vk: nextValue });
            setShowDropdown({ twitch: true, vk: false });
        } else {
            isEditingRef.current = { ...isEditingRef.current, [platform]: true } as { twitch: boolean; vk: boolean };
            setSearchTerms((prev) => ({ ...prev, [platform]: nextValue }));
            setShowDropdown({ twitch: false, vk: false, [platform]: true });
        }
    };

    const handleStreamCategorySelect = async (platform: string, category: StreamCategory) => {
        setIsUserDirty(true);
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        isEditingRef.current = { twitch: false, vk: false };
        skipNextSyncRef.current = true;
        suppressSyncUntilRef.current = Date.now() + 600;

        let mappedStreamCategory: StreamCategory | undefined;

        if (isLinked && bothEnabled && platform === 'twitch') {
            const mappedName = categoryMapping[category.name];
            const searchQuery = mappedName || category.name;
            try {
                const searchResults = (await searchCategories('vk', searchQuery)) as StreamCategory[];
                if (searchResults && searchResults.length > 0) {
                    mappedStreamCategory = searchResults[0];
                }
            } catch (e) {
                console.error(e);
            }

            if (mappedStreamCategory) {
                setCurrentData((prev) => ({
                    ...prev,
                    twitch: { ...prev.twitch, category },
                    vk: { ...prev.vk, category: mappedStreamCategory as StreamCategory },
                }));
                toast.success(`Категория синхронизирована.`);
            } else {
                setCurrentData((prev) => ({
                    ...prev,
                    twitch: { ...prev.twitch, category },
                }));
                toast.warning(`Категория для VK не найдена.`);
            }
        } else {
            setCurrentData((prev) => ({
                ...prev,
                [platform]: { ...prev[platform as 'twitch' | 'vk'], category },
            }));
        }

        if (isLinked && bothEnabled) {
            const vkName = mappedStreamCategory?.name || mappedStreamCategory?.title || category.name;
            setSearchTerms({ twitch: category.name, vk: vkName });
        } else {
            setSearchTerms((prev) => ({ ...prev, [platform]: category.name }));
        }
        setShowDropdown({ twitch: false, vk: false });
    };

    const handleSave = async () => {
        const payload: Record<string, unknown> = {};
        const getCatId = (cat: unknown) => (cat as StreamCategory | undefined)?.id || null;
        const twitchCat = currentData.twitch?.category as StreamCategory | undefined;
        let vkCat = currentData.vk?.category as StreamCategory | undefined;

        if (isLinked && bothEnabled && twitchCat) {
            const mappedName = categoryMapping[twitchCat.name] || twitchCat.name || twitchCat.title || '';
            if (mappedName) {
                try {
                    const searchResults = (await searchCategories('vk', mappedName)) as StreamCategory[];
                    if (searchResults?.[0]) {
                        vkCat = searchResults[0];
                        setCurrentData((prev) => ({
                            ...prev,
                            vk: { ...prev.vk, category: searchResults[0] },
                        }));
                    }
                } catch (error) {
                    logger.error('[SYNC ERROR] VK category lookup failed before save:', error);
                }
            }
        }

        if (twitchEnabled) payload.twitch = { category_id: getCatId(twitchCat) };
        if (vkEnabled) {
            if (vkCat) {
                payload.vk = {
                    category: {
                        id: vkCat.id,
                        name: vkCat.name || vkCat.title || '',
                        title: vkCat.name || vkCat.title || '',
                        type: vkCat.type || 'games',
                        cover_url: vkCat.box_art_url || vkCat.cover_url || '',
                    },
                    category_id: vkCat.id,
                };
            }
        }

        if (Object.keys(payload).length > 0) {
            const success = await saveChanges(payload, 'saveCategory');
            if (success) {
                setIsUserDirty(false);
                isEditingRef.current = { twitch: false, vk: false };
                suppressBlurRestoreRef.current = true;
                const active = document.activeElement as HTMLElement | null;
                active?.blur();
            }
        }
    };

    const isChanged = useMemo(() => {
        const getId = (c: StreamCategory | null | undefined) => (c?.id ? String(c.id) : null);
        return (
            (twitchEnabled && getId(initialData.twitch?.category) !== getId(currentData.twitch?.category)) ||
            (vkEnabled && getId(initialData.vk?.category) !== getId(currentData.vk?.category))
        );
    }, [initialData, currentData, twitchEnabled, vkEnabled]);

    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);
    const twitchInputPadding = isLinked && bothEnabled ? 'pl-[4.75rem]' : 'pl-[3.15rem]';
    const vkInputPadding = 'pl-[3.15rem]';
    const STREAM_FIELD_CLASS = 'border-border/70 bg-background/60 text-foreground placeholder:text-muted-foreground';
    const isSaving = status.saveCategory === 'loading';
    const isSaved = status.saveCategory === 'success';
    const showVkField = !(isLinked && bothEnabled);
    const [isUserDirty, setIsUserDirty] = useState(false);

    const Footer = (
        <Button
            onClick={handleSave}
            disabled={isSaving || !isChanged || !isUserDirty}
            size="sm"
            className={`w-full flex items-center gap-2 h-7 text-sm font-medium shadow-sm transition-all duration-300 ${
                isSaving || !isChanged || !isUserDirty
                    ? 'bg-blue-800/35 text-blue-100/90 border border-blue-600/40'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
        >
            {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSaved ? (
                <CheckCircle className="h-5 w-5" />
            ) : (
                <Save className="h-5 w-5" />
            )}
            {isSaving ? 'Сохранение...' : isSaved ? 'Сохранено' : 'Сохранить'}
        </Button>
    );

    return (
        <StreamCardLayout
            title="Категория стрима"
            icon={<Tag className="h-5 w-5 text-green-500" />}
            isLinked={isLinked}
            onToggleLink={handleToggleChange}
            bothEnabled={bothEnabled}
            footer={isDataLoaded && hasAnyIntegration ? Footer : undefined}
        >
            {!isDataLoaded ? (
                <div className="flex-1 flex flex-col p-2 space-y-4">
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                        <div className="h-10 bg-white/5 rounded-md animate-pulse" />
                    </div>
                </div>
            ) : (
                <div className="flex-1">
                    {/* Twitch / General Field */}
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
                                ref={twitchInputRef}
                                id="stream-category-twitch"
                                name="stream-category-twitch"
                                value={searchTerms.twitch}
                                onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                onFocus={() => {
                                    isEditingRef.current = { twitch: true, vk: isLinked && bothEnabled };
                                    if (twitchEnabled) setShowDropdown({ twitch: true, vk: false });
                                }}
                                onBlur={() => {
                                    if (suppressBlurRestoreRef.current) {
                                        suppressBlurRestoreRef.current = false;
                                        return;
                                    }
                                    isEditingRef.current =
                                        isLinked && bothEnabled
                                            ? { twitch: false, vk: false }
                                            : { ...isEditingRef.current, twitch: false };
                                    if (!showDropdown.twitch) {
                                        const twitchName = getCategoryName(
                                            currentData.twitch?.category as StreamCategory | undefined
                                        );
                                        setSearchTerms((prev) => ({ ...prev, twitch: twitchName }));
                                    }
                                }}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder={
                                    isLinked
                                        ? 'Поиск общей категории...'
                                        : twitchEnabled
                                          ? 'Поиск категории Twitch...'
                                          : 'нет подключения'
                                }
                                className={`h-10 ${twitchInputPadding} pr-4 ${STREAM_FIELD_CLASS} ${!twitchEnabled && !isLinked ? 'bg-muted/40 cursor-not-allowed opacity-60' : ''}`}
                                disabled={!twitchEnabled && !isLinked}
                            />

                            {showDropdown.twitch && (
                                <StreamCategoryDropdown
                                    platform="twitch"
                                    isOpen={showDropdown.twitch}
                                    isLoading={loading.categories}
                                    search={searchTerms.twitch}
                                    onSelect={handleStreamCategorySelect}
                                    results={(categories as { twitch?: StreamCategory[] })?.twitch || []}
                                    inputRef={twitchInputRef.current}
                                />
                            )}
                        </div>
                    </div>

                    <div
                        className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${showVkField ? 'mt-4 max-h-[20rem] opacity-100' : 'mt-0 max-h-0 opacity-0'}`}
                        aria-hidden={!showVkField}
                    >
                        <div>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-100 flex items-center z-20">
                                    <VKIcon className="w-6 h-6 text-white/80" />
                                </div>

                                <Input
                                    ref={vkInputRef}
                                    id="stream-category-vk"
                                    name="stream-category-vk"
                                    value={searchTerms.vk}
                                    onChange={(e) => handleSearchChange('vk', e.target.value)}
                                    onFocus={() => {
                                        isEditingRef.current = { ...isEditingRef.current, vk: true };
                                        if (vkEnabled) {
                                            setShowDropdown({ twitch: false, vk: true });
                                        }
                                    }}
                                    onBlur={() => {
                                        if (suppressBlurRestoreRef.current) {
                                            suppressBlurRestoreRef.current = false;
                                            return;
                                        }
                                        isEditingRef.current = { ...isEditingRef.current, vk: false };
                                        if (!showDropdown.vk) {
                                            const vkName = getCategoryName(
                                                currentData.vk?.category as StreamCategory | undefined
                                            );
                                            setSearchTerms((prev) => ({ ...prev, vk: vkName }));
                                        }
                                    }}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    placeholder={vkEnabled ? 'Поиск категории VK Live...' : 'нет подключения'}
                                    className={`h-10 ${vkInputPadding} pr-4 ${STREAM_FIELD_CLASS} ${!vkEnabled ? 'bg-muted/40 cursor-not-allowed opacity-60' : ''}`}
                                    disabled={!vkEnabled || !showVkField}
                                />

                                {showDropdown.vk && showVkField && (
                                    <StreamCategoryDropdown
                                        platform="vk"
                                        isOpen={showDropdown.vk}
                                        isLoading={loading.categories}
                                        search={searchTerms.vk}
                                        onSelect={handleStreamCategorySelect}
                                        results={(categories as { vk?: StreamCategory[] })?.vk || []}
                                        inputRef={vkInputRef.current}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </StreamCardLayout>
    );
};

export default StreamCategoryCard;
