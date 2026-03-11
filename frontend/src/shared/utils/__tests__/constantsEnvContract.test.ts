import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('frontend env contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_BOT_SERVICE_URL', 'http://localhost:8000');
    vi.stubEnv('VITE_TTS_SERVICE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not require VITE_TTS_SERVICE_URL for constants initialization', async () => {
    const constants = await import('@/constants');
    expect(constants.API_BASE_URL).toBe('http://localhost:8000');
    expect(constants.WS_BASE_URL).toBe('ws://localhost:8000');
  });
});

