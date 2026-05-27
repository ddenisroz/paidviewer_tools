import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import GlobalPlayer from './GlobalPlayer';

const usePlayerMock = vi.fn();
const useGlobalPlayerMock = vi.fn();
const youtubeComponentMock = vi.fn(({ videoId }: { videoId?: string }) => (
    <div data-testid="youtube-player" data-video-id={videoId || ''} />
));

vi.mock('react-youtube', () => ({
    default: (props: unknown) => youtubeComponentMock(props),
}));

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

    beforeEach(() => {
        markPlaybackStartedMock.mockReset();
        youtubeComponentMock.mockClear();
        useGlobalPlayerMock.mockReturnValue({
            playerRef: { current: null },
            handleReady: vi.fn(),
            handleEnded: vi.fn(),
            handleError: vi.fn(),
            handleStateChange: vi.fn(),
            handleApiPlay: vi.fn(),
            handleApiPause: vi.fn(),
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
            markPlaybackStarted: markPlaybackStartedMock,
            handlePlayerReady: vi.fn(),
            handlePlayerStateChange: vi.fn(),
            handlePlayerError: vi.fn(),
            playerContainerRef: null,
        });
    });

    it('enables native YouTube controls and does not render overlay hit-zones', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard/media']}>
                <GlobalPlayer />
            </MemoryRouter>
        );

        expect(screen.getByTestId('youtube-player')).toBeInTheDocument();
        expect(youtubeComponentMock).toHaveBeenCalled();

        const props = youtubeComponentMock.mock.calls[0][0] as {
            opts?: { playerVars?: { controls?: number } };
        };
        expect(props.opts?.playerVars?.controls).toBe(1);
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
});
