import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MiniPlayerUI } from './MiniPlayerUI';

const baseVideo = {
    id: 1,
    video_id: 'yt-1',
    title: 'Ambient Test',
    duration: '12:34',
    requester_name: 'yourchy',
    thumbnail_url: 'https://example.com/thumb.jpg',
    is_paid: true,
    paid_source: 'donationalerts',
} as const;

describe('MiniPlayerUI', () => {
    it('shows requester, paid badge and current/total timer for the active video', () => {
        render(
            <MiniPlayerUI
                displayVideo={baseVideo}
                isPlaying
                isMuted={false}
                volume={70}
                currentTime={120}
                durationSeconds={754}
                skipVotes={{ current: 2, required: 5, video_id: 1 }}
                queue={[]}
                showQueue={false}
                onToggleQueue={vi.fn()}
                onTogglePlayPause={vi.fn()}
                onNextVideo={vi.fn()}
                onToggleMute={vi.fn()}
                onVolumeChange={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText('Заказал: yourchy')).toBeInTheDocument();
        expect(screen.getByText('Платные заказы')).toBeInTheDocument();
        expect(screen.getByText('2:00 / 12:34')).toBeInTheDocument();
    });

    it('toggles queue panel and renders paid queue items', () => {
        render(
            <MiniPlayerUI
                displayVideo={baseVideo}
                isPlaying={false}
                isMuted={false}
                volume={50}
                queue={[
                    {
                        id: 2,
                        video_id: 'yt-2',
                        title: 'Queued Paid',
                        requester_name: 'viewer2',
                        is_paid: true,
                        paid_source: 'donationalerts',
                    },
                ]}
                showQueue
                onToggleQueue={vi.fn()}
                onSelectQueueItem={vi.fn()}
                onTogglePlayPause={vi.fn()}
                onNextVideo={vi.fn()}
                onToggleMute={vi.fn()}
                onVolumeChange={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText('Очередь')).toBeInTheDocument();
        expect(screen.getByText('Queued Paid')).toBeInTheDocument();
        expect(screen.getByText('Платный')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Скрыть'));
    });

    it('keeps the sidebar mini-player constrained to the 205x100 docked layout', () => {
        render(
            <MiniPlayerUI
                displayVideo={baseVideo}
                isPlaying
                isMuted={false}
                volume={40}
                currentTime={30}
                durationSeconds={754}
                queue={[]}
                showQueue={false}
                onToggleQueue={vi.fn()}
                onTogglePlayPause={vi.fn()}
                onNextVideo={vi.fn()}
                onToggleMute={vi.fn()}
                onVolumeChange={vi.fn()}
                onClose={vi.fn()}
                variant="sidebar"
            />
        );

        const variantRoot = document.querySelector('[data-mini-player-variant="sidebar"]');
        const card = document.querySelector('[data-mini-player-card="sidebar"]');

        expect(variantRoot?.className).toContain('w-full');
        expect(card?.className).toContain('h-[108px]');
        expect(screen.getByTitle('Скрыть мини-плеер')).toBeInTheDocument();
        expect(screen.queryByTitle('Следующее видео')).not.toBeInTheDocument();
        expect(screen.queryByText('Заказал: yourchy')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Play')).not.toBeInTheDocument();
    });
});
