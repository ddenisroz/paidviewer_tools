import React from 'react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';

import type { OAuthAvailability, OAuthPlatform } from '../hooks/useOAuthAvailability';

interface LoginOAuthButtonsProps {
    availability: OAuthAvailability | null;
    onLogin: (platform: OAuthPlatform) => void;
}

const OAUTH_UNAVAILABLE_LABELS: Record<OAuthPlatform, string> = {
    twitch: 'Twitch не настроен',
    vk: 'VK Live не настроен',
};

const LOGIN_BUTTONS = [
    {
        platform: 'twitch',
        label: 'Войти через Twitch',
        Icon: TwitchIcon,
        enabledClassName: 'bg-[#9146FF] hover:bg-[#7a3adc] text-white',
    },
    {
        platform: 'vk',
        label: 'Войти через VK Live',
        Icon: VKIcon,
        enabledClassName: 'bg-[#FF4444] hover:bg-[#d93a3a] text-white',
    },
] as const;

const LoginOAuthButtons: React.FC<LoginOAuthButtonsProps> = ({ availability, onLogin }) => {
    const isLoading = availability === null;

    return (
        <div className="space-y-4 animate-fade-in">
            {LOGIN_BUTTONS.map(({ platform, label, Icon, enabledClassName }) => {
                const isAvailable = availability?.[platform] ?? false;
                const isDisabled = isLoading || !isAvailable;
                const buttonLabel = isLoading
                    ? 'Проверка входа...'
                    : isAvailable
                        ? label
                        : OAUTH_UNAVAILABLE_LABELS[platform];

                return (
                    <button
                        key={platform}
                        type="button"
                        onClick={() => onLogin(platform)}
                        disabled={isDisabled}
                        title={isDisabled ? 'OAuth не настроен на сервере' : undefined}
                        className={`w-full font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base ${
                            isDisabled
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : enabledClassName
                        }`}
                    >
                        <Icon className="mr-2 h-5 w-5" />
                        {buttonLabel}
                    </button>
                );
            })}
        </div>
    );
};

export default LoginOAuthButtons;
