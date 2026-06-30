import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DndContext } from '@dnd-kit/core';

import QueueList from './QueueList';

const video = {
    id: 1,
    video_id: 'queue-video-1',
    title: 'Queue Test',
    duration: '3:45',
    thumbnail_url: 'https://example.com/thumb.jpg',
    url: 'https://youtube.com/watch?v=queue-video-1',
    channel_name: 'YouTube',
    platform: 'web',
    requester_name: 'Paid Donor',
    position: 1,
    is_paid: true,
    points_cost: null,
    paid_source: 'donationalerts',
    paid_amount: 250,
    paid_currency: 'RUB',
    source_alert_id: 'alert-1',
    added_at: null,
    played_at: null,
} as const;

describe('QueueList', () => {
    it('renders requester column content and paid badge', () => {
        render(
            <DndContext>
                <QueueList queue={[video]} currentVideo={null} onRemove={vi.fn()} onPlay={vi.fn()} onBan={vi.fn()} />
            </DndContext>
        );

        expect(screen.getAllByText('Paid Donor').length).toBeGreaterThan(0);
        expect(screen.getByText('Платные заказы')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Queue Test/i })).toHaveAttribute(
            'href',
            'https://youtube.com/watch?v=queue-video-1'
        );
    });
});
