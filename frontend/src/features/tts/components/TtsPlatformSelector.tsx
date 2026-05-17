import React, { useEffect, useState } from 'react';

import { Mic, MicOff, Monitor, Volume2 } from 'lucide-react';

import { useTts } from '@/context/TtsContext';
import { useSaveTtsPlatformSettings, useTtsPlatformSettings } from '@/queries/tts/ttsQueries';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { logger } from '@/shared/utils/prodLogger';

const STORAGE_TTS_PLATFORMS = 'tts_enabled_platforms';

type PlatformId = 'twitch' | 'vk';

const TtsPlatformSelector: React.FC = () => {
    const { ttsEnabled, toggleTts, isToggling } = useTts();
    const { data: platformSettingsResponse } = useTtsPlatformSettings({
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });
    const platformSettingsData = platformSettingsResponse?.data;

    const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);

    const persistEnabledPlatforms = (platforms: string[]) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(STORAGE_TTS_PLATFORMS, JSON.stringify(platforms));
    };

    useEffect(() => {
        if (platformSettingsData) {
            const data = platformSettingsData as { enabled_platforms?: string[] };
            const normalizedPlatforms = Array.isArray(data.enabled_platforms)
                ? data.enabled_platforms
                : ['twitch', 'vk'];
            setEnabledPlatforms(normalizedPlatforms);
            persistEnabledPlatforms(normalizedPlatforms);
            logger.log('[REFRESH] [TTS SELECTOR] State updated from React Query:', {
                enabled_platforms: normalizedPlatforms,
                twitch_enabled: normalizedPlatforms.includes('twitch'),
                vk_enabled: normalizedPlatforms.includes('vk'),
            });
        }
    }, [platformSettingsData]);

    const savePlatformSettingsMutation = useSaveTtsPlatformSettings({
        onSuccess: (_response, variables) => {
            const vars = variables as { enabled_platforms: string[] };
            setEnabledPlatforms(vars.enabled_platforms);
            persistEnabledPlatforms(vars.enabled_platforms);

            window.dispatchEvent(
                new CustomEvent('tts-settings-changed', {
                    detail: { enabledPlatforms: vars.enabled_platforms },
                })
            );
            logger.log('[REFRESH] [TTS SELECTOR] Dispatched settings update:', vars.enabled_platforms);
        },
        onError: (error) => {
            logger.error('Error saving TTS settings:', error);
        },
    });

    const saving = savePlatformSettingsMutation.isPending;

    const saveSettings = (platforms: string[]) => {
        savePlatformSettingsMutation.mutate({
            enabled_platforms: platforms,
        });
    };

    const togglePlatform = (platform: string) => {
        const nextPlatforms = [...enabledPlatforms];
        const index = nextPlatforms.indexOf(platform);

        if (index > -1) {
            nextPlatforms.splice(index, 1);
        } else {
            nextPlatforms.push(platform);
        }

        saveSettings(nextPlatforms);
    };

    useEffect(() => {
        const handleTtsSettingsChanged = (event: CustomEvent<{ enabledPlatforms: string[] }>) => {
            const { enabledPlatforms } = event.detail;
            logger.log('[REFRESH] [TTS SELECTOR] Received settings update from shortcuts:', enabledPlatforms);
            setEnabledPlatforms(enabledPlatforms);
            persistEnabledPlatforms(enabledPlatforms);
        };

        window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        return () => {
            window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
        };
    }, []);

    const platforms: {
        id: PlatformId;
        name: string;
        icon: React.ComponentType<{ className?: string }>;
        description: string;
    }[] = [
        {
            id: 'twitch',
            name: 'Twitch',
            icon: TwitchIcon,
            description: 'Озвучивать сообщения из Twitch чата',
        },
        {
            id: 'vk',
            name: 'VK Live',
            icon: VKIcon,
            description: 'Озвучивать сообщения из VK Live чата',
        },
    ];

    const styleMap: Record<
        PlatformId,
        {
            accentText: string;
            accentBg: string;
            accentBorder: string;
            pill: string;
            toggleOn: string;
        }
    > = {
        twitch: {
            accentText: 'text-purple-300',
            accentBg: 'bg-purple-500/15',
            accentBorder: 'border-purple-500/30',
            pill: 'bg-purple-500/15 text-purple-200 border border-purple-500/30',
            toggleOn: 'bg-green-600',
        },
        vk: {
            accentText: 'text-red-300',
            accentBg: 'bg-red-500/15',
            accentBorder: 'border-red-500/30',
            pill: 'bg-red-500/15 text-red-200 border border-red-500/30',
            toggleOn: 'bg-green-600',
        },
    };

    return (
        <div className="card-glass rounded-2xl border border-border">
            <div className="p-6 border-b border-border/60">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground flex items-center">
                            <Volume2 className="w-5 h-5 mr-2 text-primary" />
                            Платформы TTS
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Выберите источники для озвучки</p>
                    </div>

                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">TTS</span>
                        <button
                            onClick={() => toggleTts()}
                            disabled={saving || isToggling}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                ttsEnabled ? 'bg-primary' : 'bg-muted'
                            } ${saving || isToggling ? 'opacity-50' : ''}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                                    ttsEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 border-b border-border/60">
                <div
                    className={`flex items-center p-4 rounded-lg border ${
                        ttsEnabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/40 border-border'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${ttsEnabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
                        {ttsEnabled ? (
                            <Mic className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <MicOff className="w-5 h-5 text-muted-foreground" />
                        )}
                    </div>

                    <div className="ml-3 flex-1">
                        <p className={`font-medium ${ttsEnabled ? 'text-emerald-200' : 'text-muted-foreground'}`}>
                            {ttsEnabled ? 'TTS включен' : 'TTS выключен'}
                        </p>
                        <p className={`text-sm ${ttsEnabled ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                            {ttsEnabled
                                ? `Активно на ${enabledPlatforms.length} платформ(е/ах)`
                                : 'Включите главный переключатель'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <h4 className="text-md font-medium text-foreground mb-4">Выбор платформ</h4>

                <div className="space-y-4">
                    {platforms.map((platform) => {
                        const isEnabled = enabledPlatforms.includes(platform.id);
                        const isActive = ttsEnabled && isEnabled;
                        const styles = styleMap[platform.id];
                        const Icon = platform.icon;

                        return (
                            <div
                                key={platform.id}
                                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                                    isActive
                                        ? `${styles.accentBorder} bg-background/40`
                                        : 'border-border bg-background/20'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg ${isActive ? styles.accentBg : 'bg-muted'}`}>
                                        <Icon
                                            className={`w-5 h-5 ${isActive ? styles.accentText : 'text-muted-foreground'}`}
                                        />
                                    </div>

                                    <div>
                                        <h5 className="font-medium text-foreground">{platform.name}</h5>
                                        <p className="text-sm text-muted-foreground">{platform.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            isActive
                                                ? styles.pill
                                                : 'bg-muted/60 text-muted-foreground border border-border'
                                        }`}
                                    >
                                        {isActive ? 'Активно' : 'Выкл'}
                                    </span>

                                    <button
                                        onClick={() => togglePlatform(platform.id)}
                                        disabled={saving || !ttsEnabled}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            isEnabled && ttsEnabled ? styles.toggleOn : 'bg-muted'
                                        } ${saving || !ttsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                                                isEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {ttsEnabled && enabledPlatforms.length === 0 && (
                <div className="p-4 border-t border-yellow-500/20 bg-yellow-500/10">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Monitor className="h-5 w-5 text-yellow-300" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-100">
                                TTS включен, но платформы не выбраны
                            </h3>
                            <div className="mt-2 text-sm text-yellow-200/80">
                                <p>Включите хотя бы одну платформу для начала озвучки.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TtsPlatformSelector;
