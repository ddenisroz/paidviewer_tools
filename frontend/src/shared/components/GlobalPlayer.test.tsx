import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import GlobalPlayer from './GlobalPlayer';

const usePlayerMock = vi.fn();
const useGlobalPlayerMock = vi.fn();
const youtubePlayerConstructorMock = vi.fn();
const youtubePlayerMock = {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 100),
    isMuted: vi.fn(() => false),
    mute: vi.fn(),
    unMute: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 300),
    getPlayerState: vi.fn(() => 1),
    seekTo: vi.fn(),
    loadVideoById: vi.fn(),
    cueVideoById: vi.fn(),
    destroy: vi.fn(),
};

vi.mock('@/context/PlayerContext', () => ({
    usePlayer: () => usePlayerMock(),
}));

vi.mock('@/services/api/services/youtubeService', () => ({
    youtubeService: {
        clearQueue: vi.fn(),
        playQueueItem: vi.fn(),
    },
}));

vi.mock('@/utils/toastManager', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('./player', () => ({
    MiniPlayerUI: () => <div data-testid="mini-player-ui" />,
    useGlobalPlayer: () => useGlobalPlayerMock(),
}));

describe('GlobalPlayer', () => {
    const markPlaybackStartedMock = vi.fn();
    const handleStateChangeMock = vi.fn();

    beforeEach(() => {
        markPlaybackStartedMock.mockReset();
        handleStateChangeMock.mockReset();
        youtubePlayerConstructorMock.mockClear();
        Object.values(youtubePlayerMock).forEach((mock) => mock.mockClear());
        youtubePlayerMock.getVolume.mockReturnValue(100);
        youtubePlayerMock.isMuted.mockReturnValue(false);
        youtubePlayerMock.getCurrentTime.mockReturnValue(0);
        youtubePlayerMock.getDuration.mockReturnValue(300);
        youtubePlayerMock.getPlayerState.mockReturnValue(1);
        window.YT = {
            Player: youtubePlayerConstructorMock.mockImplementation(function (_elementId, options) {
                window.setTimeout(() => {
                    options.events.onReady({ target: youtubePlayerMock });
                }, 0);
                return youtubePlayerMock;
            }),
        };
        useGlobalPlayerMock.mockReturnValue({
            playerRef: { current: null },
            handleReady: vi.fn(),
            handleError: vi.fn(),
            handleStateChange: handleStateChangeMock,
        });

        usePlayerMock.mockReturnValue({
            currentVideo: {
                id: 1,
                video_id: 'test-video-id',
                title: 'Native Player',
                url: 'https://www.youtube.com/watch?v=test-video-id',
                thumbnail_url: 'https://example.com/thumb.jpg',
                requester_name: 'yourchy',
            },
            isPlaying: true,
            volume: 100,
            currentTime: 0,
            duration: 300,
            isMuted: false,
            isVisible: true,
            isMinimized: false,
            isTheaterMode: false,
            queue: [],
            skipVotes: null,
            togglePlayPause: vi.fn(),
            setVolume: vi.fn(),
            toggleMute: vi.fn(),
            nextVideo: vi.fn(),
            loadQueue: vi.fn(),
            minimizePlayer: vi.fn(),
            maximizePlayer: vi.fn(),
            setPlayerRef: vi.fn(),
            updateTime: vi.fn(),
            markPlaybackStarted: markPlaybackStartedMock,
            handlePlayerReady: vi.fn(),
            handlePlayerStateChange: vi.fn(),
            handlePlayerError: vi.fn(),
            playerContainerRef: null,
        });
    });

    it('enables native YouTube controls and does not render overlay hit-zones', async () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/media']}>
                <GlobalPlayer />
            </MemoryRouter>
        );

        expect(document.getElementById('global-youtube-player')).toBeInTheDocument();
        await waitFor(() => expect(youtubePlayerConstructorMock).toHaveBeenCalled());

        const options = youtubePlayerConstructorMock.mock.calls[0][1] as {
            playerVars?: { controls?: number; enablejsapi?: number; rel?: number };
        };
        expect(options.playerVars?.controls).toBe(1);
        expect(options.playerVars?.enablejsapi).toBe(1);
        expect(options.playerVars?.rel).toBe(0);
        expect(document.querySelectorAll('[data-player-hit-zone]')).toHaveLength(0);
    });

    it('still marks interaction when the native player surface is touched', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/media']}>
                <GlobalPlayer />
            </MemoryRouter>
        );

        const overlay = document.querySelector('[data-player-container="overlay"]');
        expect(overlay).toBeTruthy();

        fireEvent.pointerDown(overlay!);
        expect(markPlaybackStartedMock).toHaveBeenCalledTimes(1);
    });

    it('forwards native YouTube iframe state changes into the shared player state', async () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/media']}>
                <GlobalPlayer />
            </MemoryRouter>
        );

        await waitFor(() => expect(youtubePlayerConstructorMock).toHaveBeenCalled());
        const options = youtubePlayerConstructorMock.mock.calls[0][1] as {
            events?: { onStateChange?: (event: { data: number; target: typeof youtubePlayerMock }) => void };
        };

        options.events?.onStateChange?.({ data: 1, target: youtubePlayerMock });

        expect(handleStateChangeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: 1,
                target: expect.objectContaining({
                    playVideo: expect.any(Function),
                    pauseVideo: expect.any(Function),
                }),
            })
        );
    });

    it('forwards YouTube iframe postMessage state changes into the shared player state', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/media']}>
                <GlobalPlayer />
            </MemoryRouter>
        );

        window.dispatchEvent(
            new MessageEvent('message', {
                origin: 'https://www.youtube.com',
                data: JSON.stringify({ event: 'onStateChange', info: 2 }),
            })
        );

        expect(handleStateChangeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: 2,
                target: expect.objectContaining({
                    playVideo: expect.any(Function),
                    pauseVideo: expect.any(Function),
                }),
            })
        );
    });
});
