import { act, render, waitFor } from '@testing-library/react';
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
        vi.clearAllMocks();
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
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('keeps dashboard preview idle until a run is requested', async () => {
        const { container, unmount } = render(
            <MemoryRouter initialEntries={['/drops-widget/test-token?preview=true&background=green']}>
                <Routes>
                    <Route path="/drops-widget/:token" element={<DropsWidget />} />
                </Routes>
            </MemoryRouter>
        );

        expect(container.firstElementChild).toHaveAttribute('data-drops-phase', 'idle');

        await waitFor(() => {
            expect(dropsServiceMock.getUserFromToken).toHaveBeenCalled();
        });

        expect(container.firstElementChild).toHaveAttribute('data-drops-phase', 'idle');

        act(() => {
            unmount();
        });
    });

    it('leaves idle state and starts the roulette when preview run is requested', async () => {
        const { container, unmount } = render(
            <MemoryRouter initialEntries={['/drops-widget/test-token?preview=true&quality=common&run=1']}>
                <Routes>
                    <Route path="/drops-widget/:token" element={<DropsWidget />} />
                </Routes>
            </MemoryRouter>
        );

        expect(container.firstElementChild).toHaveAttribute('data-drops-phase', 'idle');

        await waitFor(() => {
            expect(container.firstElementChild).not.toHaveAttribute('data-drops-phase', 'idle');
        }, {
            timeout: 1500,
        });

        expect(container.firstElementChild).not.toHaveAttribute('data-drops-phase', 'idle');

        act(() => {
            unmount();
        });
    });
});
