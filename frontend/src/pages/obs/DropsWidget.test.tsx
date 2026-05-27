import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DropsWidget from './DropsWidget';

const dropsServiceMock = vi.hoisted(() => ({
    getUserFromToken: vi.fn(),
    getConfigWithToken: vi.fn(),
    getRewardsForWidget: vi.fn(),
    getMythicalSession: vi.fn(),
}));

vi.mock('@/services/api/services/dropsService', () => ({
    dropsService: dropsServiceMock,
}));

describe('DropsWidget preview mode', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        dropsServiceMock.getUserFromToken.mockResolvedValue({
            data: {
                success: true,
                data: {
                    user_id: 1,
                    channel_name: 'yourchy',
                    platform: 'twitch',
                },
            },
        });
        dropsServiceMock.getConfigWithToken.mockResolvedValue({
            data: {
                success: true,
                data: {
                    widget_spinning_duration_ms: 5000,
                    widget_opening_duration_ms: 700,
                    widget_result_duration_ms: 5000,
                    widget_sound_volume: 1,
                },
            },
        });
        dropsServiceMock.getRewardsForWidget.mockResolvedValue({
            data: {
                success: true,
                data: [],
            },
        });
        dropsServiceMock.getMythicalSession.mockResolvedValue({
            data: {
                success: false,
            },
        });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('leaves idle state and starts the roulette in preview mode', async () => {
        const { container, unmount } = render(
            <MemoryRouter initialEntries={['/drops-widget/test-token?preview=true&quality=common']}>
                <Routes>
                    <Route path="/drops-widget/:token" element={<DropsWidget />} />
                </Routes>
            </MemoryRouter>
        );

        expect(container.firstElementChild).toHaveAttribute('data-drops-phase', 'idle');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(450);
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(container.firstElementChild).not.toHaveAttribute('data-drops-phase', 'idle');

        act(() => {
            unmount();
        });
    });
});
