import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TtsChannelPointsMode from '@/features/tts/components/TtsChannelPointsMode';

const {
  integrationsMock,
  platformCapabilitiesMock,
  refetchModeSettingsMock,
  createRewardMutateMock,
  deleteRewardMutateMock,
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
  deleteRewardMutateMock: vi.fn(),
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

vi.mock('@/queries/tts/ttsQueries', () => ({
  useTtsModeSettings: vi.fn(() => ({
    data: { data: { tts_reward_ids: {} } },
    isLoading: false,
    refetch: refetchModeSettingsMock,
  })),
  useCreateTtsReward: vi.fn(() => ({
    mutate: createRewardMutateMock,
    isPending: false,
  })),
  useDeleteTtsReward: vi.fn(() => ({
    mutate: deleteRewardMutateMock,
    isPending: false,
  })),
}));

vi.mock('@/utils/toastManager', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TtsChannelPointsMode
        ttsMode="all_messages"
        onModeChange={vi.fn()}
        isSaving={false}
        showRewards={false}
      />
    </QueryClientProvider>,
  );
};

describe('TtsChannelPointsMode', () => {
  beforeEach(() => {
    integrationsMock.twitch.enabled = false;
    integrationsMock.vk.enabled = false;
    refetchModeSettingsMock.mockReset();
    createRewardMutateMock.mockReset();
    deleteRewardMutateMock.mockReset();
  });

  it('allows channel points mode when only VK Live is connected', () => {
    integrationsMock.vk.enabled = true;

    renderComponent();

    const channelPointsDescription = screen.getByText('Только с наградой');
    const channelPointsButton = channelPointsDescription.closest('button');

    expect(channelPointsButton).not.toBeDisabled();
  });

  it('keeps channel points mode disabled when no connected reward platform exists', () => {
    renderComponent();

    const disabledDescription = screen.getByText('Подключите Twitch или VK Live');
    const channelPointsButton = disabledDescription.closest('button');

    expect(channelPointsButton).toBeDisabled();
  });
});
