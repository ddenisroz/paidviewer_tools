// src/components/chatbox/PlatformSettings.tsx
/**
 * Platform settings for ChatBox.
 */

import React from 'react';

interface PlatformSettingsProps {
    platform: string;
    showBadges: boolean;
    showTimestamp: boolean;
    onPlatformChange: (platform: string) => void;
    onShowBadgesChange: (show: boolean) => void;
    onShowTimestampChange: (show: boolean) => void;
}

const platforms = [
    { value: 'all', label: 'Все платформы' },
    { value: 'twitch', label: 'Twitch' },
    { value: 'vk', label: 'VK Live' },
    { value: 'youtube', label: 'YouTube' },
];

export const PlatformSettings: React.FC<PlatformSettingsProps> = ({
    platform,
    showBadges,
    showTimestamp,
    onPlatformChange,
    onShowBadgesChange,
    onShowTimestampChange,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Платформа</label>
                <select
                    value={platform}
                    onChange={(e) => onPlatformChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                    {platforms.map((p) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Показывать бейджи</label>
                <input
                    type="checkbox"
                    checked={showBadges}
                    onChange={(e) => onShowBadgesChange(e.target.checked)}
                    className="w-5 h-5 rounded"
                />
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Показывать время</label>
                <input
                    type="checkbox"
                    checked={showTimestamp}
                    onChange={(e) => onShowTimestampChange(e.target.checked)}
                    className="w-5 h-5 rounded"
                />
            </div>
        </div>
    );
};

export default PlatformSettings;
