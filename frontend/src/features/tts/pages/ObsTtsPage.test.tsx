import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ObsTtsPage from './ObsTtsPage';

class MockWebSocket {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(public url: string) {}

    close(): void {
        this.readyState = 3;
    }

    send(): void {}
}

describe('ObsTtsPage', () => {
    beforeEach(() => {
        vi.stubGlobal('WebSocket', MockWebSocket);
        vi.stubGlobal(
            'Audio',
            class {
                preload = 'auto';
                onended: (() => void) | null = null;
                onerror: (() => void) | null = null;
                pause(): void {}
                play(): Promise<void> {
                    return Promise.resolve();
                }
            }
        );
    });

    it('renders a transparent source-only surface with status marker', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/tts-obs/test-token']}>
                <Routes>
                    <Route path="/tts-obs/:token" element={<ObsTtsPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(container.firstElementChild).toHaveAttribute('data-tts-source-status', 'connecting');
        expect(container.firstElementChild?.textContent).toBe('');
        expect(document.documentElement.style.background).toBe('transparent');
        expect(document.body.style.background).toBe('transparent');
    });
});
