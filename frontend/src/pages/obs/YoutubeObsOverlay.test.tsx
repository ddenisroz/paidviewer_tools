import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import YoutubeObsOverlay from './YoutubeObsOverlay';

const youtubeServiceMock = vi.hoisted(() => ({
    getObsState: vi.fn(),
}));

vi.mock('@/services/api/services/youtubeService', () => ({
    youtubeService: youtubeServiceMock,
}));

class MockWebSocket {
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(public url: string) {}

    send(): void {}
    close(): void {}
}

const baseState = {
    queue: [],
    current_video: {
        id: 5,
        video_id: 'yt-paid-video',
        title: 'Paid Overlay Video',
        duration: '3:45',
        thumbnail_url: 'https://example.com/thumb.jpg',
        url: 'https://youtube.com/watch?v=yt-paid-video',
        channel_name: 'YouTube',
        platform: 'web',
        requester_name: 'Paid Donor',
        position: 1,
        is_paid: true,
        paid_source: 'donationalerts',
    },
    is_playing: true,
    skip_votes: {
        current: 2,
        required: 4,
        video_id: 5,
    },
} as const;

describe('YoutubeObsOverlay', () => {
    beforeEach(() => {
        vi.stubGlobal('WebSocket', MockWebSocket);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders requester, paid badge and skip votes in track mode', async () => {
        youtubeServiceMock.getObsState.mockResolvedValueOnce({
            data: {
                ...baseState,
                settings: {
                    obs_overlay_mode: 'track',
                },
            },
        });

        render(
            <MemoryRouter initialEntries={['/youtube-obs/test-token']}>
                <Routes>
                    <Route path="/youtube-obs/:token" element={<YoutubeObsOverlay />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Paid Overlay Video')).toBeInTheDocument();
        });

        expect(screen.getByText('Заказал: Paid Donor')).toBeInTheDocument();
        expect(screen.getByText('Платные заказы')).toBeInTheDocument();
        expect(screen.getByText('Пропуск: 2/4')).toBeInTheDocument();
        expect(screen.queryByTitle('Paid Overlay Video')).not.toBeInTheDocument();
    });

    it('renders the iframe layout in video mode with the same meta block', async () => {
        youtubeServiceMock.getObsState.mockResolvedValueOnce({
            data: {
                ...baseState,
                settings: {
                    obs_overlay_mode: 'video',
                },
            },
        });

        const { container } = render(
            <MemoryRouter initialEntries={['/youtube-obs/test-token']}>
                <Routes>
                    <Route path="/youtube-obs/:token" element={<YoutubeObsOverlay />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Paid Overlay Video')).toBeInTheDocument();
        });

        expect(container.querySelector('iframe')).toBeInTheDocument();
        expect(screen.getByText('Заказал: Paid Donor')).toBeInTheDocument();
        expect(screen.getByText('Платные заказы')).toBeInTheDocument();
        expect(screen.getByText('Пропуск: 2/4')).toBeInTheDocument();
    });
});
