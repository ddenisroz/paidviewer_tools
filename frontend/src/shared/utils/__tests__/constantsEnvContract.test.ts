import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('frontend env contract', () => {
    beforeEach(() => {
        vi.resetModules();
        window.history.replaceState({}, '', '/dashboard');
        vi.stubEnv('VITE_TTS_SERVICE_URL', '');
        vi.stubEnv('VITE_API_BASE_URL', '');
        vi.stubEnv('VITE_API_URL', '');
        vi.stubEnv('VITE_WS_BASE_URL', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('uses same-origin defaults without frontend API env overrides', async () => {
        vi.stubEnv('VITE_BOT_SERVICE_URL', '');
        vi.stubEnv('VITE_BOT_SERVICE_WS_URL', '');

        const constants = await import('@/constants');
        const expectedOrigin = window.location.origin;
        const expectedWs = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

        expect(constants.API_BASE_URL).toBe(expectedOrigin);
        expect(constants.WS_BASE_URL).toBe(expectedWs);
    });

    it('uses explicit backend env overrides when they are configured', async () => {
        vi.stubEnv('VITE_BOT_SERVICE_URL', 'http://localhost:8000');
        vi.stubEnv('VITE_BOT_SERVICE_WS_URL', 'ws://localhost:8000');

        const constants = await import('@/constants');
        expect(constants.API_BASE_URL).toBe('http://localhost:8000');
        expect(constants.WS_BASE_URL).toBe('ws://localhost:8000');
    });
});
