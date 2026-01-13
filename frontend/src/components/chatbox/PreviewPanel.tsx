// src/components/chatbox/PreviewPanel.tsx
/**
 * Preview panel for ChatBox settings.
 */

import React from 'react';

import { ChatBoxSettings } from '@/utils/chatboxHelpers';

interface PreviewPanelProps {
    settings: ChatBoxSettings;
}

const sampleMessages = [
    { author: 'StreamerName', message: 'Привет всем!', badges: ['broadcaster'] },
    { author: 'ViewerOne', message: 'Привет! Как дела?', badges: [] },
    { author: 'Moderator', message: 'Всё отлично!', badges: ['moderator'] },
];

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ settings }) => {
    return (
        <div
            className="rounded-lg p-4 h-64 overflow-y-auto"
            style={{
                backgroundColor: settings.backgroundColor,
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
            }}
        >
            <div className="space-y-2">
                {sampleMessages.map((msg, index) => (
                    <div
                        key={index}
                        className={`${settings.animation === 'fade' ? 'animate-fade-in' : ''}`}
                    >
                        {settings.showTimestamp && (
                            <span className="text-gray-500 text-xs mr-2">12:34</span>
                        )}
                        {settings.showBadges && msg.badges.length > 0 && (
                            <span className="mr-1">
                                {msg.badges.includes('broadcaster') && '[STREAMER]'}
                                {msg.badges.includes('moderator') && '[MOD]'}
                            </span>
                        )}
                        <span className="font-bold" style={{ color: '#9146FF' }}>
                            {msg.author}:
                        </span>{' '}
                        <span style={{ color: settings.textColor }}>
                            {msg.message}
                        </span>
                    </div>
                ))}
            </div>
        </div >
    );
};

export default PreviewPanel;
