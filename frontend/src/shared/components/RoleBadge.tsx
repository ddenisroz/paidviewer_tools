import React from 'react';

import { Crown, Shield, Star, User } from 'lucide-react';

interface VkRoleBadgeProps {
    role?: string | null;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

const VK_ROLE_MAP: Record<string, { label: string; color: string; bg: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }> = {
    broadcaster: {
        label: 'Streamer',
        color: '#F97316',
        bg: 'rgba(249, 115, 22, 0.18)',
        Icon: Crown
    },
    owner: {
        label: 'Streamer',
        color: '#F97316',
        bg: 'rgba(249, 115, 22, 0.18)',
        Icon: Crown
    },
    moderator: {
        label: 'Moderator',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.18)',
        Icon: Shield
    },
    vip: {
        label: 'vip',
        color: '#FACC15',
        bg: 'rgba(250, 204, 21, 0.18)',
        Icon: Star
    },
    subscriber: {
        label: 'Subscriber',
        color: '#60A5FA',
        bg: 'rgba(96, 165, 250, 0.18)',
        Icon: User
    }
};

export const VkRoleBadge: React.FC<VkRoleBadgeProps> = ({ role, size = 14, className, style }) => {
    if (!role) return null;

    const normalized = role.toLowerCase();
    const config = VK_ROLE_MAP[normalized];

    if (!config) {
        return (
            <span
                className={className}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontSize: `${Math.max(10, Math.round(size * 0.7))}px`,
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#F87171',
                    ...style
                }}
            >
                {role}
            </span>
        );
    }

    const Icon = config.Icon;
    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: `${Math.max(10, Math.round(size * 0.7))}px`,
                textTransform: 'uppercase',
                backgroundColor: config.bg,
                color: config.color,
                ...style
            }}
        >
            <Icon style={{ width: `${size}px`, height: `${size}px` }} />
            <span>{config.label}</span>
        </span>
    );
};
