import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';

const {
    integrationsMock,
    platformCapabilitiesMock,
    refetchModeSettingsMock,
    createRewardMutateMock,
    attachRewardMutateMock,
    deleteRewardMutateMock,
    platformRewardsMock,
    toastErrorMock,
} = vi.hoisted(() => ({
    integrationsMock: {
        twitch: { enabled: false },
        vk: { enabled: false },
    },
    platformCapabilitiesMock: {
        twitch: {
            roles: true,
            badges: true,
            reply_context: true,
            mention_context: true,
            moderation_actions: true,
            rewards: true,
            bot_status: true,
            supported_roles: ['owner', 'moderator', 'vip', 'subscriber', 'viewer'],
            moderation_actions_available: ['timeout', 'ban', 'mod', 'vip'],
        },
        vk: {
            roles: true,
            badges: false,
            reply_context: true,
            mention_context: true,
            moderation_actions: false,
            rewards: true,
            bot_status: true,
            supported_roles: ['owner', 'moderator', 'viewer'],
            moderation_actions_available: [],
        },
    },
    refetchModeSettingsMock: vi.fn(),
    createRewardMutateMock: vi.fn(),
    attachRewardMutateMock: vi.fn(),
    deleteRewardMutateMock: vi.fn(),
    platformRewardsMock: [] as Array<{
        id: string;
        title?: string;
        name?: string;
        cost: number;
        platform: 'twitch';
        is_user_input_required?: boolean;
    }>,
    toastErrorMock: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
    useAuth: vi.fn(() => ({
        user: { id: 1 },
    })),
}));

vi.mock('@/context/IntegrationsContext', () => ({
    useIntegrations: vi.fn(() => ({
        integrations: integrationsMock,
        platformCapabilities: platformCapabilitiesMock,
    })),
}));

vi.mock('@/queries/points/pointsQueries', () => ({
    usePlatformRewards: vi.fn(() => ({
        data: { success: true, rewards: platformRewardsMock },
        isLoading: false,
    })),
}));

vi.mock('@/queries/tts/ttsQueries', () => ({
    useTtsModeSettings: vi.fn(() => ({
        data: { success: true, tts_reward_ids: {}, platforms: { twitch: { reward_configured: false } } },
        isLoading: false,
        refetch: refetchModeSettingsMock,
    })),
    useCreateTtsReward: vi.fn(() => ({
        mutate: createRewardMutateMock,
        isPending: false,
    })),
    useAttachTtsReward: vi.fn((options?: { onSuccess?: (...args: unknown[]) => void }) => ({
        mutate: (variables: unknown, mutationOptions?: { onSettled?: () => void }) => {
            attachRewardMutateMock(variables);
            options?.onSuccess?.({ success: true }, variables, undefined, undefined);
            mutationOptions?.onSettled?.();
        },
        isPending: false,
    })),
    useDeleteTtsReward: vi.fn(() => ({
        mutate: deleteRewardMutateMock,
        isPending: false,
    })),
}));

vi.mock('@/utils/toastManager', () => ({
    toast: {
        error: toastErrorMock,
        success: vi.fn(),
    },
}));

const renderComponent = (props?: Partial<React.ComponentProps<typeof TtsChannelPointsMode>>) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <TtsChannelPointsMode
                ttsMode="channel_points"
                onModeChange={vi.fn()}
                isSaving={false}
                showRewards
                {...props}
            />
        </QueryClientProvider>
    );
};

const openTwitchSetupDialog = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Настроить' }));
    return user;
};

describe('TtsChannelPointsMode', () => {
    beforeEach(() => {
        integrationsMock.twitch.enabled = true;
        integrationsMock.vk.enabled = false;
        platformRewardsMock.length = 0;
        refetchModeSettingsMock.mockReset();
        createRewardMutateMock.mockReset();
        attachRewardMutateMock.mockClear();
        deleteRewardMutateMock.mockReset();
        toastErrorMock.mockReset();
    });

    it('does not render the no-reward channel-points warning', () => {
        renderComponent();

        expect(screen.queryByText(/Без выбранной награды/)).not.toBeInTheDocument();
    });

    it('shows create and attach modes in the Twitch setup dialog', async () => {
        renderComponent();

        await openTwitchSetupDialog();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Создать' }).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: 'Привязать' })).toBeInTheDocument();
    });

    it('filters attach rewards by title and name', async () => {
        platformRewardsMock.push(
            {
                id: 'tts-1',
                title: 'TTS Message',
                name: 'Voice reward',
                cost: 500,
                platform: 'twitch',
                is_user_input_required: true,
            },
            {
                id: 'song-1',
                title: 'Song Request',
                name: 'Music',
                cost: 100,
                platform: 'twitch',
                is_user_input_required: true,
            }
        );
        renderComponent();
        const user = await openTwitchSetupDialog();

        await user.click(screen.getByRole('button', { name: 'Привязать' }));
        await user.type(screen.getByPlaceholderText('Название существующей награды'), 'song');

        expect(screen.getByText('Song Request')).toBeInTheDocument();
        expect(screen.queryByText('TTS Message')).not.toBeInTheDocument();
    });

    it('blocks attaching a Twitch reward without user input', async () => {
        platformRewardsMock.push({
            id: 'no-input',
            title: 'No Input Reward',
            cost: 100,
            platform: 'twitch',
            is_user_input_required: false,
        });
        renderComponent();
        const user = await openTwitchSetupDialog();

        await user.click(screen.getByRole('button', { name: 'Привязать' }));
        await user.click(screen.getByText('No Input Reward'));

        expect(attachRewardMutateMock).not.toHaveBeenCalled();
        expect(toastErrorMock).toHaveBeenCalledWith('Для TTS нужна награда с обязательным вводом сообщения');
    });

    it('attaches a selected Twitch reward and refetches mode settings', async () => {
        platformRewardsMock.push({
            id: 'tts-1',
            title: 'TTS Message',
            cost: 500,
            platform: 'twitch',
            is_user_input_required: true,
        });
        renderComponent();
        const user = await openTwitchSetupDialog();

        await user.click(screen.getByRole('button', { name: 'Привязать' }));
        await user.click(screen.getByText('TTS Message'));
        const dialog = screen.getByRole('dialog');
        const attachButtons = within(dialog).getAllByRole('button', { name: 'Привязать' });
        await user.click(attachButtons[attachButtons.length - 1]);

        expect(attachRewardMutateMock).toHaveBeenCalledWith({ platform: 'twitch', reward_id: 'tts-1' });
        expect(refetchModeSettingsMock).toHaveBeenCalled();
    });

    it('allows channel points mode when only VK Live is connected', () => {
        integrationsMock.twitch.enabled = false;
        integrationsMock.vk.enabled = true;

        renderComponent({ ttsMode: 'all_messages', showRewards: false });

        const channelPointsButton = screen.getByRole('button', { name: 'За баллы канала' });

        expect(channelPointsButton).not.toBeDisabled();
    });

    it('keeps channel points mode disabled when no connected reward platform exists', () => {
        integrationsMock.twitch.enabled = false;
        integrationsMock.vk.enabled = false;

        renderComponent({ ttsMode: 'all_messages', showRewards: false });

        const channelPointsButton = screen.getByRole('button', { name: 'За баллы канала' });

        expect(channelPointsButton).toBeDisabled();
    });
});
