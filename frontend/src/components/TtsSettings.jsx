import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

const TtsSettings = ({ channelName }) => {
    const [settings, setSettings] = useState({ read_emotes: false });
    const [loading, setLoading] = useState(true);
    const { get, post } = useApi();

    const fetchSettings = useCallback(async () => {
        if (!channelName) return;
        setLoading(true);
        try {
            const response = await get(`/api/${channelName}/settings`);
            setSettings(response.data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    }, [channelName, get]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleToggleReadEmotes = async () => {
        if (!channelName) return;
        const newReadEmotes = !settings.read_emotes;
        try {
            await post(`/api/${channelName}/settings`, { read_emotes: newReadEmotes });
            setSettings(prev => ({ ...prev, read_emotes: newReadEmotes }));
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    if (loading) {
        return <div>Loading settings...</div>;
    }

    return (
        <div className="p-4 bg-gray-800 text-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">TTS Settings for {channelName}</h2>
            <div className="flex items-center justify-between">
                <span className="font-medium">Read Emotes</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.read_emotes}
                        onChange={handleToggleReadEmotes}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
    );
};

export default TtsSettings;
