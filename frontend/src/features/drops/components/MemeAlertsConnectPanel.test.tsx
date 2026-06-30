import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemeAlertsConnectPanel } from './MemeAlertsConnectPanel';

describe('MemeAlertsConnectPanel', () => {
    it('renders providers as a vertical list with connected state', () => {
        const { container } = render(
            <MemeAlertsConnectPanel
                connecting={false}
                connectedProvider="twitch"
                popupState="idle"
                authStatusText=""
                onConnect={vi.fn()}
            />
        );

        expect(screen.getByText('Twitch')).toBeInTheDocument();
        expect(screen.getByText('Google')).toBeInTheDocument();
        expect(screen.getByText('VK Live')).toBeInTheDocument();
        expect(screen.getByText('Подключено')).toBeInTheDocument();
        expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
        expect(container.querySelector('.space-y-2')).toBeTruthy();
    });
});
