import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Loader, Save } from 'lucide-react';

import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useTimeout } from '@/shared/hooks/useTimeout';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';
import { StreamCardLayout } from './StreamCardLayout';
import { Edit3 } from 'lucide-react';

interface StreamTitleCardProps {
}

const StreamTitleCard: React.FC<StreamTitleCardProps> = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_titles: combineTitles } = getCombineSettings();

    // LOCAL BUFFER: Local state for instant UI response
    const [localCombineTitles, setLocalCombineTitles] = useState(combineTitles);

    useEffect(() => {
        setLocalCombineTitles(combineTitles);
    }, [combineTitles]);

    const isLinked = useMemo(() => localCombineTitles || false, [localCombineTitles]);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);

    // Handle Toggle Change
    const handleToggleChange = (value: boolean) => {
        setLocalCombineTitles(value);

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        setResetTimerDelay(null);

        // Delayed sync logic
        setTimeout(async () => {
            try {
                const success = await updateSetting('combine_titles', value);
                if (!success) throw new Error("Failed to update setting");

                if (value && bothEnabled) {
                    const twitchTitle = currentData.twitch?.title || '';
                    setCurrentData(prev => ({
                        ...prev,
                        vk: { ...prev.vk, title: twitchTitle }
                    }));

                    const payload = {
                        twitch: { title: twitchTitle },
                        vk: { title: twitchTitle }
                    };
                    await saveChanges(payload, 'saveTitle');
                }
            } catch (error) {
                logger.error('[SYNC ERROR]', error);
                setLocalCombineTitles(!value);
                updateSetting('combine_titles', !value);
                toast.error('Не удалось синхронизировать.');
            }
        }, 100);
    };

    const handleTitleChange = (platform: string, value: string) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, title: value },
                vk: { ...prev.vk, title: value },
            }));
        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform as 'twitch' | 'vk']: { ...prev[platform as 'twitch' | 'vk'], title: value },
            }));
        }
    };

    const [resetTimerDelay, setResetTimerDelay] = useState<number | null>(null);

    useTimeout(() => {
        const stillChanged =
            (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
            (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''));

        if (!stillChanged) return;

        setCurrentData(prev => ({
            ...prev,
            twitch: { ...prev.twitch, title: initialData.twitch?.title || '' },
            vk: { ...prev.vk, title: initialData.vk?.title || '' }
        }));

        toast.info('Изменения сброшены (вы не сохранили в течение 10 секунд)');
        setResetTimerDelay(null);
    }, resetTimerDelay);

    const handleInputBlur = () => {
        if (isChanged && status.saveTitle !== 'loading' && status.saveTitle !== 'success') {
            setResetTimerDelay(10000);
        }
    };

    const handleInputFocus = () => {
        setResetTimerDelay(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isChanged && status.saveTitle !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode: 'both' | 'individual') => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        const payload: { twitch?: { title: string }; vk?: { title: string } } = {};

        if (mode === 'both') {
            const title = currentData.twitch?.title || '';
            const hasChanges = title !== (initialData.twitch?.title || '') || title !== (initialData.vk?.title || '');
            if (hasChanges) {
                if (twitchEnabled) payload.twitch = { title };
                if (vkEnabled) payload.vk = { title };
            }
        } else {
            if (twitchEnabled && (currentData.twitch?.title || '') !== (initialData.twitch?.title || '')) {
                payload.twitch = { title: currentData.twitch?.title || '' };
            }
            if (vkEnabled && (currentData.vk?.title || '') !== (initialData.vk?.title || '')) {
                payload.vk = { title: currentData.vk?.title || '' };
            }
        }

        if (Object.keys(payload).length > 0) {
            saveChanges(payload, 'saveTitle');
        }
    };

    const isChanged = useMemo(() => {
        if (isLinked && bothEnabled) {
            const currentTitle = currentData.twitch?.title || '';
            const initialTwitchTitle = initialData.twitch?.title || '';
            return currentTitle !== initialTwitchTitle;
        } else {
            return (
                (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
                (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''))
            );
        }
    }, [initialData, currentData, twitchEnabled, vkEnabled, isLinked, bothEnabled]);

    // Data Load Check
    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);

    const Footer = (
        <Button
            onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
            disabled={status.saveTitle === 'loading' || status.saveTitle === 'success' || !isChanged}
            size="sm"
            className="w-full flex items-center gap-2"
        >
            {status.saveTitle === 'loading' ? (
                <Loader className="h-4 w-4 animate-spin" />
            ) : status.saveTitle === 'success' ? (
                <CheckCircle className="h-4 w-4" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {status.saveTitle === 'loading' ? 'Сохранение...' : status.saveTitle === 'success' ? 'Сохранено' : 'Сохранить'}
        </Button>
    );

    return (
        <StreamCardLayout
            title="Название стрима"
            icon={<Edit3 className="h-5 w-5 text-green-500" />}
            isLinked={isLinked}
            onToggleLink={handleToggleChange}
            bothEnabled={bothEnabled}
            footer={isDataLoaded && hasAnyIntegration ? Footer : undefined}
        >
            {!isDataLoaded ? (
                <div className="flex-1 flex flex-col p-2 space-y-4">
                    <div className="flex-1 flex flex-col justify-center space-y-4">
                        <div className="space-y-2">
                            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                            <div className="h-10 bg-white/5 rounded-md animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                            <div className="h-10 bg-white/5 rounded-md animate-pulse" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1">
                    {/* First Input (Twitch or Combined) */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm text-muted-foreground transition-all duration-300">
                            {isLinked && bothEnabled ? (
                                <><span className="text-foreground">Общее название</span></>
                            ) : (
                                <><span className={!twitchEnabled ? "text-muted-foreground" : "text-foreground"}>Twitch</span></>
                            )}
                        </Label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-70">
                                {isLinked && bothEnabled ? (
                                    <div className="flex -space-x-1">
                                        <TwitchIcon className="w-4 h-4" />
                                        <VKIcon className="w-4 h-4" />
                                    </div>
                                ) : (
                                    <TwitchIcon className="w-4 h-4" />
                                )}
                            </div>
                            <Input
                                value={currentData.twitch?.title || ''}
                                onChange={(e) => handleTitleChange('twitch', e.target.value)}
                                onKeyPress={handleKeyPress}
                                onBlur={handleInputBlur}
                                onFocus={handleInputFocus}
                                placeholder={isLinked ? "Общее название..." : "Название на Twitch..."}
                                className={`h-10 pl-10 transition-all duration-300 ${!twitchEnabled && !isLinked ? 'bg-muted cursor-not-allowed opacity-50' : ''}`}
                                disabled={!twitchEnabled && !isLinked}
                            />
                        </div>
                    </div>

                    {/* Second Input (VK Only) - Collapsible */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isLinked && bothEnabled ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                        <div className="overflow-hidden">
                            <div className="space-y-2 pt-4">
                                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className={!vkEnabled ? "text-muted-foreground" : "text-foreground"}>VK Live</span>
                                </Label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-70">
                                        <VKIcon className="w-4 h-4" />
                                    </div>
                                    <Input
                                        value={currentData.vk?.title || ''}
                                        onChange={(e) => handleTitleChange('vk', e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        onBlur={handleInputBlur}
                                        onFocus={handleInputFocus}
                                        placeholder="Название на VK Live..."
                                        className={`h-10 pl-10 ${!vkEnabled ? 'bg-muted cursor-not-allowed opacity-50' : ''}`}
                                        disabled={!vkEnabled}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </StreamCardLayout>
    );
};

export default StreamTitleCard;
