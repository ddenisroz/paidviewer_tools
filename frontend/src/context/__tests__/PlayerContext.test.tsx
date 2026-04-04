import React from 'react';

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, expect, it } from 'vitest';

import { PlayerProvider, usePlayer } from '@/context/PlayerContext';

const {
  refetchQueueMock,
  mutateSkipMock,
  saveSettingsMock,
} = vi.hoisted(() => ({
  refetchQueueMock: vi.fn(async () => undefined),
  mutateSkipMock: vi.fn(),
  saveSettingsMock: vi.fn(async () => undefined),
}));

vi.mock('@/queries/youtube/youtubeQueries', () => ({
  useYoutubeQueue: vi.fn(() => ({
    data: null,
    isLoading: false,
    refetch: refetchQueueMock,
    error: null,
  })),
  useSkipYoutubeVideo: vi.fn(() => ({
    mutate: mutateSkipMock,
    isPending: false,
  })),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
  })),
}));

vi.mock('@/context/ChatContext', () => ({
  useChat: vi.fn(() => ({
    lastJsonMessage: null,
    isConnected: false,
  })),
}));

vi.mock('@/services/api/services/youtubeService', () => ({
  youtubeService: {
    saveSettings: saveSettingsMock,
  },
}));

vi.mock('react-use', () => ({
  useInterval: vi.fn(),
}));

type PlayerContextSnapshot = ReturnType<typeof usePlayer>;

let latestContext: PlayerContextSnapshot | null = null;

function PlayerContextProbe() {
  const context = usePlayer();
  latestContext = context;

  return (
    <>
      <div data-testid="user-paused">{String(context.userPaused)}</div>
      <div data-testid="volume">{String(context.volume)}</div>
      <div data-testid="minimized">{String(context.isMinimized)}</div>
    </>
  );
}

function renderPlayerProvider() {
  render(
    <MemoryRouter initialEntries={['/dashboard/youtube']}>
      <PlayerProvider>
        <PlayerContextProbe />
      </PlayerProvider>
    </MemoryRouter>,
  );
}

function createMockPlayer() {
  return {
    pauseVideo: vi.fn(),
    playVideo: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 100),
    mute: vi.fn(),
    unMute: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    loadVideoById: vi.fn(),
    cueVideoById: vi.fn(),
  };
}

describe('PlayerContext', () => {
  beforeEach(() => {
    latestContext = null;
    refetchQueueMock.mockClear();
    mutateSkipMock.mockClear();
    saveSettingsMock.mockClear();
    window.localStorage.clear();
    window.ytUserStarted = false;
  });

  it('does not latch userPaused on system pause events', () => {
    renderPlayerProvider();
    const mockPlayer = createMockPlayer();

    act(() => {
      latestContext?.setPlayerRef(mockPlayer);
    });

    act(() => {
      latestContext?.togglePlayPause();
    });

    act(() => {
      latestContext?.handlePlayerStateChange({ data: 1, target: mockPlayer });
    });

    expect(screen.getByTestId('user-paused')).toHaveTextContent('false');

    act(() => {
      latestContext?.releasePlayerRef('global');
    });

    act(() => {
      latestContext?.handlePlayerStateChange({ data: 2, target: mockPlayer });
    });

    expect(screen.getByTestId('user-paused')).toHaveTextContent('false');
  });

  it('keeps userPaused for explicit user pause events', () => {
    renderPlayerProvider();
    const mockPlayer = createMockPlayer();

    act(() => {
      latestContext?.setPlayerRef(mockPlayer);
    });

    act(() => {
      latestContext?.togglePlayPause();
      latestContext?.handlePlayerStateChange({ data: 1, target: mockPlayer });
    });

    act(() => {
      latestContext?.togglePlayPause();
    });

    act(() => {
      latestContext?.handlePlayerStateChange({ data: 2, target: mockPlayer });
    });

    expect(screen.getByTestId('user-paused')).toHaveTextContent('true');
  });

  it('syncs volume, minimized state, and remote play intent via storage events', () => {
    renderPlayerProvider();
    const mockPlayer = createMockPlayer();

    act(() => {
      latestContext?.setPlayerRef(mockPlayer);
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'yt_volume',
        newValue: '42',
      }));
    });

    expect(screen.getByTestId('volume')).toHaveTextContent('42');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'yt_player_minimized',
        newValue: '1',
      }));
    });

    expect(screen.getByTestId('minimized')).toHaveTextContent('true');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'yt_playback_sync',
        newValue: JSON.stringify({ command: 'play', timestamp: Date.now() }),
      }));
    });

    expect(mockPlayer.playVideo).toHaveBeenCalled();
    expect(refetchQueueMock).toHaveBeenCalled();
    expect(window.ytUserStarted).toBe(true);
  });
});
