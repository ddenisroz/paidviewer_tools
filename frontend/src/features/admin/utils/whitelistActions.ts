import { adminService } from '@/services/api/services/adminService';

interface ChannelResult {
    label: string;
    value: string;
}

export interface AddToWhitelistResult {
    success: true;
    platforms: string[];
    errors: string[] | null;
}

const getApiError = (error: unknown): string => {
    const typedError = error as { response?: { data?: { error?: string } }; message?: string };
    return typedError.response?.data?.error || typedError.message || 'Ошибка';
};

const normalizeChannels = (twitchChannel: string, vkChannel: string): ChannelResult[] => {
    const channels: ChannelResult[] = [];
    if (twitchChannel.trim()) channels.push({ label: 'Twitch', value: twitchChannel.trim() });
    if (vkChannel.trim()) channels.push({ label: 'VK', value: vkChannel.trim() });
    return channels;
};

export const addChannelsToWhitelist = async (
    twitchChannel: string,
    vkChannel: string
): Promise<AddToWhitelistResult> => {
    const results: string[] = [];
    const errors: string[] = [];
    const channels = normalizeChannels(twitchChannel, vkChannel);

    for (const channel of channels) {
        try {
            await adminService.addToWhitelist({
                username: channel.value,
                platform: channel.label === 'Twitch' ? 'twitch' : 'vk',
            });
            results.push(`${channel.label}: ${channel.value}`);
        } catch (error) {
            errors.push(`${channel.label}: ${getApiError(error)}`);
        }
    }

    if (results.length === 0) {
        throw new Error(errors.length > 0 ? errors.join('; ') : 'Укажите хотя бы один канал');
    }

    return {
        success: true,
        platforms: results,
        errors: errors.length > 0 ? errors : null,
    };
};
