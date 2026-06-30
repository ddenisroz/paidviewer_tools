import React from 'react';

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, expect, it } from 'vitest';

import { PlayerProvider, usePlayer } from '@/context/PlayerContext';

const { refetchQueueMock, mutateSkipMock, saveSettingsMock } = vi.hoisted(() => ({
    refetchQueueMock: vi.fn(async () => undefined),
    mutateSkipMock: vi.fn(),
    saveSettingsMock: vi.fn(async () => undefined),
}));

const chatState = vi.hoisted(() => ({
    lastJsonMessage: null as { type?: string } | null,
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
        lastJsonMessage: chatState.lastJsonMessage,
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
            <div data-testid="muted">{String(context.isMuted)}</div>
            <div data-testid="minimized">{String(context.isMinimized)}</div>
        </>
    );
}

function renderPlayerProvider() {
    return render(
        <MemoryRouter initialEntries={['/dashboard/youtube']}>
            <PlayerProvider>
                <PlayerContextProbe />
            </PlayerProvider>
        </MemoryRouter>
    );
}

function createMockPlayer() {
    return {
        pauseVideo: vi.fn(),
        playVideo: vi.fn(),
        setVolume: vi.fn(),
        getVolume: vi.fn(() => 100),
        isMuted: vi.fn(() => false),
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
        chatState.lastJsonMessage = null;
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

    it('latches native iframe pauses as user pauses', () => {
        renderPlayerProvider();
        const mockPlayer = createMockPlayer();

        act(() => {
            latestContext?.setPlayerRef(mockPlayer);
        });

        act(() => {
            latestContext?.handlePlayerStateChange({ data: 1, target: mockPlayer });
        });

        act(() => {
            latestContext?.handlePlayerStateChange({ data: 2, target: mockPlayer });
        });

        expect(screen.getByTestId('user-paused')).toHaveTextContent('true');
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

    it('syncs volume and remote play intent via storage events without persisting mini-player state', () => {
        renderPlayerProvider();
        const mockPlayer = createMockPlayer();

        act(() => {
            latestContext?.setPlayerRef(mockPlayer);
        });

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'yt_volume',
                    newValue: '42',
                })
            );
        });

        expect(screen.getByTestId('volume')).toHaveTextContent('42');

        expect(screen.getByTestId('minimized')).toHaveTextContent('false');

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'yt_playback_sync',
                    newValue: JSON.stringify({ command: 'play', timestamp: Date.now() }),
                })
            );
        });

        expect(mockPlayer.playVideo).toHaveBeenCalled();
        expect(refetchQueueMock).toHaveBeenCalled();
        expect(window.ytUserStarted).toBe(true);
    });

    it('syncs native youtube volume and mute state back into the app controls', () => {
        renderPlayerProvider();
        const mockPlayer = createMockPlayer();

        act(() => {
            latestContext?.setPlayerRef(mockPlayer);
        });

        mockPlayer.getVolume.mockReturnValue(37);
        mockPlayer.isMuted.mockReturnValue(true);

        act(() => {
            latestContext?.updateTime();
        });

        expect(screen.getByTestId('volume')).toHaveTextContent('37');
        expect(screen.getByTestId('muted')).toHaveTextContent('true');
    });

    it('reloads queue only for the canonical youtube_queue_updated event', () => {
        const view = renderPlayerProvider();

        refetchQueueMock.mockClear();

        act(() => {
            chatState.lastJsonMessage = { type: 'youtube_queue_update' };
        });
        view.rerender(
            <MemoryRouter initialEntries={['/dashboard/youtube']}>
                <PlayerProvider>
                    <PlayerContextProbe />
                </PlayerProvider>
            </MemoryRouter>
        );

        expect(refetchQueueMock).not.toHaveBeenCalled();

        act(() => {
            chatState.lastJsonMessage = { type: 'youtube_queue_updated' };
        });
        view.rerender(
            <MemoryRouter initialEntries={['/dashboard/youtube']}>
                <PlayerProvider>
                    <PlayerContextProbe />
                </PlayerProvider>
            </MemoryRouter>
        );

        expect(refetchQueueMock).toHaveBeenCalledTimes(1);
    });
});
