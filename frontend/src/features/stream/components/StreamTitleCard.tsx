import React, { useEffect, useMemo, useState } from 'react';

import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { logger } from '@/shared/utils/prodLogger';
import { CheckCircle, Loader2, PenLine, Save } from 'lucide-react';

import { StreamCardLayout } from './StreamCardLayout';

const StreamTitleCard: React.FC = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();

    const { combine_titles } = getCombineSettings();

    // Local state for immediate optimisic UI updates
    const [localCombine, setLocalCombine] = useState(combine_titles);

    useEffect(() => {
        setLocalCombine(combine_titles);
    }, [combine_titles]);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);

    const isLinked = localCombine && bothEnabled;
    const linkedInputPadding = 'pl-10';
    const isSaving = status.saveTitle === 'loading';
    const isSaved = status.saveTitle === 'success';

    const handleToggleLink = async (value: boolean) => {
        setLocalCombine(value);
        const success = await updateSetting('combine_titles', value);

        if (!success) {
            setLocalCombine(!value); // Revert on failure
            return;
        }

        // If enabling link, sync titles (take Twitch title as master) without auto-saving
        if (value && bothEnabled) {
            const masterTitle = currentData.twitch?.title;
            if (masterTitle) {
                setCurrentData(prev => ({
                    ...prev,
                    vk: { ...prev.vk, title: masterTitle }
                }));
            }
        }
    };

    const handleTitleChange = (platform: 'twitch' | 'vk', value: string) => {
        if (platform === 'twitch') {
            setCurrentData(prev => {
                const newData = { ...prev, twitch: { ...prev.twitch!, title: value } };
                if (isLinked) {
                    newData.vk = { ...prev.vk!, title: value };
                }
                return newData;
            });
        } else {
            setCurrentData(prev => ({ ...prev, vk: { ...prev.vk!, title: value } }));
        }
    };

    const handleSave = async (platform: 'twitch' | 'vk') => {
        const title = platform === 'twitch' ? currentData.twitch?.title : currentData.vk?.title;
        if (title === undefined) return;

        try {
            if (isLinked) {
                await saveChanges({
                    twitch: { title: currentData.twitch?.title },
                    vk: { title: currentData.twitch?.title } // Sync VK to Twitch
                }, 'saveTitle');
            } else {
                const payload: any = {};
                payload[platform] = { title };
                await saveChanges(payload, 'saveTitle');
            }
        } catch (error) {
            logger.error('Error saving title:', error);
        }
    };

    const handleSaveAll = () => {
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
    const handleInputBlur = (platform: 'twitch' | 'vk') => {
        handleSave(platform);
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const isChanged = useMemo(() => {
        return (twitchEnabled && initialData.twitch?.title !== currentData.twitch?.title) ||
            (vkEnabled && initialData.vk?.title !== currentData.vk?.title);
    }, [initialData, currentData, twitchEnabled, vkEnabled]);

    const footer = (
        <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm font-medium shadow-sm transition-all duration-300"
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
                                onFocus={handleInputFocus}
                                placeholder={isLinked ? "Общее название стрима..." : (twitchEnabled ? "Название на Twitch..." : "нет подключения")}
                                className={`h-10 ${linkedInputPadding} pr-4 transition-[padding] duration-300 ease-in-out ${!twitchEnabled && !isLinked ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
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
                                    onFocus={handleInputFocus}
                                    placeholder={vkEnabled ? "Название на VK Live..." : "нет подключения"}
                                    className={`h-10 pl-10 pr-4 transition-[padding] duration-300 ease-in-out ${!vkEnabled ? 'bg-muted/50 cursor-not-allowed opacity-50' : 'bg-slate-900/50'}`}
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
