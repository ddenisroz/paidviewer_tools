// src/components/lootbox/LootboxHeader.tsx
import React from 'react';

interface LootboxHeaderProps {
    selectedPlatform: 'twitch' | 'vk';
    onPlatformChange: (platform: 'twitch' | 'vk') => void;
}

const LootboxHeader: React.FC<LootboxHeaderProps> = ({ selectedPlatform, onPlatformChange }) => {
    return (
        <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white">[REWARD] Система Лутбоксов</h2>
            <p className="text-gray-400 text-lg">Зарабатывайте награды за активность!</p>

            <div className="flex justify-center">
                <div className="bg-gray-800 rounded-lg p-1 flex">
                    <button
                        onClick={() => onPlatformChange('twitch')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            selectedPlatform === 'twitch'
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Twitch
                    </button>
                    <button
                        onClick={() => onPlatformChange('vk')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            selectedPlatform === 'vk' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        VK Live
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LootboxHeader;
