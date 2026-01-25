import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Gamepad2, Loader, Loader2, Save, Tag } from 'lucide-react';
import type { StreamCategory } from '@/types/stream';

import { categoryMapping } from '@/constants/categoryMapping';
import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { StreamCardLayout } from './StreamCardLayout';
import { StreamCategoryDropdown } from './StreamCategoryDropdown';

interface StreamCategoryCardProps {
}

const StreamCategoryCard: React.FC<StreamCategoryCardProps> = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status, categories, searchCategories } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_categories: combineCategories } = getCombineSettings();

    const [localCombineCategories, setLocalCombineCategories] = useState(combineCategories);

    useEffect(() => {
        setLocalCombineCategories(combineCategories);
    }, [combineCategories]);

    const isLinked = useMemo(() => localCombineCategories || false, [localCombineCategories]);
    const [searchTerms, setSearchTerms] = useState<{ twitch: string; vk: string }>({ twitch: '', vk: '' });
    const [showDropdown, setShowDropdown] = useState<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedTwitchSearch = useDebounce(searchTerms.twitch, 300);
    const debouncedVkSearch = useDebounce(searchTerms.vk, 300);

    const twitchInputRef = useRef<HTMLInputElement>(null);
    const vkInputRef = useRef<HTMLInputElement>(null);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);

    // Handle Toggle
    const handleToggleChange = (value: boolean) => {
        setLocalCombineCategories(value);
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        setTimeout(async () => {
            try {
                const success = await updateSetting('combine_categories', value);
                if (!success) throw new Error("Failed to update setting");

                if (value && bothEnabled) {
                    const twitchStreamCategory = currentData.twitch?.category as StreamCategory;
                    if (twitchStreamCategory) {
                        // Logic to sync/map categories
                        const mappedName = categoryMapping[twitchStreamCategory.name];
                        let vkStreamCategory: StreamCategory | null = null;

                        if (mappedName) {
                            const searchResults = await searchCategories('vk', mappedName) as StreamCategory[];
                            if (searchResults && searchResults.length > 0) vkStreamCategory = searchResults[0];
                        }

                        if (!vkStreamCategory) {
                            const searchResults = await searchCategories('vk', twitchStreamCategory.name) as StreamCategory[];
                            if (searchResults && searchResults.length > 0) vkStreamCategory = searchResults[0];
                        }

                        if (vkStreamCategory) {
                            setCurrentData(prev => ({
                                ...prev,
                                vk: { ...prev.vk, category: { ...vkStreamCategory!, id: String(vkStreamCategory!.id) } }
                            }));
                            const payload = {
                                twitch: { category_id: String(twitchStreamCategory.id) },
                                vk: {
                                    category: {
                                        id: String(vkStreamCategory.id),
                                        name: vkStreamCategory.name || vkStreamCategory.title || "",
                                        title: vkStreamCategory.name || vkStreamCategory.title || "",
                                        type: vkStreamCategory.type || "games",
                                        cover_url: vkStreamCategory.cover_url
                                    },
                                    category_id: String(vkStreamCategory.id)
                                }
                            };
                            await saveChanges(payload, 'saveCategory');
                        }
                    }
                }
            } catch (error) {
                logger.error('[SYNC ERROR]', error);
                setLocalCombineCategories(!value);
                updateSetting('combine_categories', !value);
                toast.error('Ошибка синхронизации категорий.');
            }
        }, 100);
    };

    // Load initial search terms
    useEffect(() => {
        const twitchCat = currentData.twitch?.category as StreamCategory | undefined;
        const vkCat = currentData.vk?.category as StreamCategory | undefined;
        setSearchTerms({
            twitch: twitchCat?.name || '',
            vk: vkCat?.name || '',
        });
    }, [currentData.twitch?.category, currentData.vk?.category]);

    // Trigger searches
    useEffect(() => {
        if (debouncedTwitchSearch && debouncedTwitchSearch.length >= 2 && showDropdown.twitch && twitchEnabled) {
            searchCategories('twitch', debouncedTwitchSearch);
        }
    }, [debouncedTwitchSearch, showDropdown.twitch, searchCategories, twitchEnabled]);

    useEffect(() => {
        if (debouncedVkSearch && debouncedVkSearch.length >= 2 && showDropdown.vk && vkEnabled) {
            searchCategories('vk', debouncedVkSearch);
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
                    twitch: twitchCat?.name || '',
                    vk: vkCat?.name || ''
                });
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [currentData]);


    const handleSearchChange = (platform: string, value: string) => {
        const trimmedValue = value;
        if (isLinked && bothEnabled && platform === 'twitch') {
            setSearchTerms({ twitch: trimmedValue, vk: trimmedValue });
            setShowDropdown({ twitch: true, vk: true });
        } else {
            setSearchTerms(prev => ({ ...prev, [platform]: trimmedValue }));
            setShowDropdown({ twitch: false, vk: false, [platform]: true });
        }
    };

    const handleStreamCategorySelect = async (platform: string, category: StreamCategory) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        if (isLinked && bothEnabled && platform === 'twitch') {
            // Linked Logic
            const otherPlatform = 'vk';
            let mappedStreamCategory: StreamCategory | undefined;

            // For now just update what we selected
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, category },
            }));

            const mappedName = categoryMapping[category.name];
            const searchQuery = mappedName || category.name;
            try {
                const searchResults = await searchCategories('vk', searchQuery) as StreamCategory[];
                if (searchResults && searchResults.length > 0) {
                    mappedStreamCategory = searchResults[0];
                }
            } catch (e) { console.error(e); }

            if (mappedStreamCategory) {
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch, category },
                    vk: { ...prev.vk, category: mappedStreamCategory },
                }));
                toast.success(`Категория синхронизирована.`);
            } else {
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch, category },
                }));
                toast.warning(`Категория для VK не найдена.`);
            }

        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform]: { ...prev[platform as 'twitch' | 'vk'], category },
            }));
        }

        setSearchTerms(prev => ({ ...prev, [platform]: category.name }));
        setShowDropdown({ twitch: false, vk: false });
    };

    const handleSave = async (mode: 'both' | 'individual') => {
        const payload: Record<string, unknown> = {};
        const getCatId = (cat: unknown) => (cat as StreamCategory | undefined)?.id || null;

        if (mode === 'both') {
            if (twitchEnabled) payload.twitch = { category_id: getCatId(currentData.twitch?.category) };
            if (vkEnabled) {
                const vkCat = currentData.vk?.category as StreamCategory;
                if (vkCat) {
                    payload.vk = {
                        category: {
                            id: vkCat.id,
                            name: vkCat.name || vkCat.title || "",
                            title: vkCat.name || vkCat.title || "",
                            type: vkCat.type || "games",
                            cover_url: vkCat.box_art_url || vkCat.cover_url || ""
                        },
                        category_id: vkCat.id
                    };
                }
            }
        } else {
            if (twitchEnabled) payload.twitch = { category_id: getCatId(currentData.twitch?.category) };
            if (vkEnabled) {
                const vkCat = currentData.vk?.category as StreamCategory;
                if (vkCat) {
                    payload.vk = {
                        category: {
                            id: vkCat.id,
                            name: vkCat.name || vkCat.title || "",
                            title: vkCat.name || vkCat.title || "",
                            type: vkCat.type || "games",
                            cover_url: vkCat.box_art_url || vkCat.cover_url || ""
                        },
                        category_id: vkCat.id
                    };
                }
            }
        }

        if (Object.keys(payload).length > 0) {
            await saveChanges(payload, 'saveCategory');
        }
    };



    const isChanged = useMemo(() => {
        const getId = (c: any) => c?.id;
        return (twitchEnabled && getId(initialData.twitch?.category) !== getId(currentData.twitch?.category)) ||
            (vkEnabled && getId(initialData.vk?.category) !== getId(currentData.vk?.category));
    }, [initialData, currentData, twitchEnabled, vkEnabled]);

    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);

    const Footer = (
        <Button
            onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
            disabled={(status as any).saving || !isChanged}
            size="sm"
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm font-medium shadow-sm transition-all duration-300"
        >
            {(status as any).saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : status.saveCategory === 'success' ? (
                <CheckCircle className="h-5 w-5" />
            ) : (
                <Save className="h-5 w-5" />
            )}
            {(status as any).saving ? 'Сохранение...' : 'Сохранить'}
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
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-100 flex items-center gap-1.5 z-20">
                                {isLinked && bothEnabled ? (
                                    <>
                                        <TwitchIcon className="w-5 h-5 text-white/80" />
                                        <VKIcon className="w-5 h-5 text-white/80" />
                                    </>
                                ) : (
                                    <TwitchIcon className="w-5 h-5 text-white/80" />
                                )}
                            </div>



                            <Input
                                ref={twitchInputRef}
                                value={searchTerms.twitch}
                                onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                onFocus={() => {
                                    if (twitchEnabled) setShowDropdown({ twitch: true, vk: false });
                                    if (searchTerms.twitch === (currentData.twitch?.category as StreamCategory)?.name) {
                                        setSearchTerms(prev => ({ ...prev, twitch: '' }));
                                    }
                                }}
                                placeholder={isLinked ? "Поиск общей категории..." : (twitchEnabled ? "Поиск категории Twitch..." : "нет подключения")}
                                className={`h-10 pl-[4.5rem] pr-4 ${!twitchEnabled && !isLinked ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
                                disabled={!twitchEnabled && !isLinked}
                            />

                            {showDropdown.twitch && (
                                <StreamCategoryDropdown
                                    platform="twitch"
                                    search={searchTerms.twitch}
                                    onSelect={handleStreamCategorySelect}
                                    results={(categories as { twitch?: StreamCategory[] })?.twitch || []}
                                    inputRef={twitchInputRef.current}
                                />
                            )}
                        </div>
                    </div>

                    {/* VK Field - Collapsible */}
                    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isLinked && bothEnabled ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'}`}>
                        <div className="overflow-hidden min-h-0">
                            <div className="space-y-4 pt-0 relative mt-4 min-h-0">
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-100 flex items-center z-20">
                                        <VKIcon className="w-5 h-5 text-white/80" />
                                    </div>



                                    <Input
                                        ref={vkInputRef}
                                        value={searchTerms.vk}
                                        onChange={(e) => handleSearchChange('vk', e.target.value)}
                                        onFocus={() => {
                                            if (vkEnabled) setShowDropdown({ twitch: false, vk: true });
                                            if (searchTerms.vk === (currentData.vk?.category as StreamCategory)?.name) {
                                                setSearchTerms(prev => ({ ...prev, vk: '' }));
                                            }
                                        }}
                                        placeholder={vkEnabled ? "Поиск категории VK Live..." : "нет подключения"}
                                        className={`h-10 pl-12 pr-4 ${!vkEnabled ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
                                        disabled={!vkEnabled}
                                    />

                                    {showDropdown.vk && (
                                        <StreamCategoryDropdown
                                            platform="vk"
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
                </div>
            )}
        </StreamCardLayout>
    );
};

export default StreamCategoryCard;
