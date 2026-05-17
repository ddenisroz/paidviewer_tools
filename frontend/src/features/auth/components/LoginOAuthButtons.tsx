import React from 'react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';

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
        enabledClassName: 'border-[#a970ff]/80 bg-[#9146ff] text-white hover:border-[#c7a6ff] hover:bg-[#7a3adc]',
    },
    {
        platform: 'vk',
        label: 'Войти через VK Live',
        Icon: VKIcon,
        enabledClassName: 'border-[#ff6868]/80 bg-[#ff4444] text-white hover:border-[#ff9494] hover:bg-[#d93a3a]',
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
                    <Button
                        key={platform}
                        type="button"
                        variant={isDisabled ? 'outline' : 'default'}
                        size="lg"
                        onClick={() => onLogin(platform)}
                        disabled={isDisabled}
                        title={isDisabled ? 'OAuth не настроен на сервере' : undefined}
                        className={`w-full text-base font-semibold ${
                            isDisabled ? 'border-border/70 bg-[#0b0712] text-muted-foreground' : enabledClassName
                        }`}
                    >
                        <Icon className="mr-2 h-5 w-5" />
                        {buttonLabel}
                    </Button>
                );
            })}
        </div>
    );
};

export default LoginOAuthButtons;
