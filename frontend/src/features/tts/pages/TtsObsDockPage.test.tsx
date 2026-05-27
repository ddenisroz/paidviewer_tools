import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TtsObsDockPage from './TtsObsDockPage';

vi.mock('@/features/tts/components/TtsPlayerSurface', () => ({
    default: ({ variant }: { variant: string }) => <div data-testid="tts-player-surface">{variant}</div>,
}));

describe('TtsObsDockPage', () => {
    it('renders the dock surface on a transparent page', () => {
        render(<TtsObsDockPage />);

        expect(screen.getByTestId('tts-player-surface')).toHaveTextContent('dock');
        expect(document.documentElement.style.background).toBe('transparent');
        expect(document.body.style.background).toBe('transparent');
        expect(document.body.style.margin).toBe('0px');
    });
});
