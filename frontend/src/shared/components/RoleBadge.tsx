import React from 'react';

import { Crown, ShieldCheck, Star, User } from 'lucide-react';

interface VkRoleBadgeProps {
    role?: string | null;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

const VK_ROLE_MAP: Record<
    string,
    { label: string; color: string; bg: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }
> = {
    broadcaster: {
        label: 'Streamer',
        color: '#F97316',
        bg: 'rgba(249, 115, 22, 0.18)',
        Icon: Crown,
    },
    owner: {
        label: 'Streamer',
        color: '#F97316',
        bg: 'rgba(249, 115, 22, 0.18)',
        Icon: Crown,
    },
    moderator: {
        label: 'Moderator',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.18)',
        Icon: ShieldCheck,
    },
    vip: {
        label: 'vip',
        color: '#FACC15',
        bg: 'rgba(250, 204, 21, 0.18)',
        Icon: Star,
    },
    subscriber: {
        label: 'Subscriber',
        color: '#60A5FA',
        bg: 'rgba(96, 165, 250, 0.18)',
        Icon: User,
    },
};

const VK_ROLE_ALIASES: Record<string, string> = {
    mod: 'moderator',
    channel_moderator: 'moderator',
    channelmod: 'moderator',
    streamer: 'broadcaster',
    creator: 'broadcaster',
    channel_owner: 'owner',
};

export const VkRoleBadge: React.FC<VkRoleBadgeProps> = ({ role, size = 14, className, style }) => {
    if (!role) return null;

    const normalized = role.toLowerCase();
    const resolvedRole = VK_ROLE_ALIASES[normalized] || normalized;
    const config = VK_ROLE_MAP[resolvedRole];

    if (!config) {
        return (
            <span
                className={className}
                title={role}
                aria-label={role}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: `${size + 8}px`,
                    height: `${size + 8}px`,
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#F87171',
                    ...style,
                }}
            >
                <ShieldCheck style={{ width: `${size}px`, height: `${size}px` }} />
            </span>
        );
    }

    const Icon = config.Icon;
    return (
        <span
            className={className}
            title={config.label}
            aria-label={config.label}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: `${size + 8}px`,
                height: `${size + 8}px`,
                borderRadius: '6px',
                backgroundColor: config.bg,
                color: config.color,
                ...style,
            }}
        >
            <Icon style={{ width: `${size}px`, height: `${size}px` }} />
        </span>
    );
};
