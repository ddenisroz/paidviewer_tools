import { describe, expect, it } from 'vitest';

import { resolveAudioUrl } from '@/shared/utils/urlUtils';

describe('resolveAudioUrl', () => {
    const apiBaseUrl = 'https://bot.example.com';

    it('returns absolute URL as-is', () => {
        expect(resolveAudioUrl('https://cdn.example.com/audio/test.wav', apiBaseUrl)).toBe(
            'https://cdn.example.com/audio/test.wav'
        );
    });

    it('resolves root-relative URL via backend base URL', () => {
        expect(resolveAudioUrl('/api/tts/audio/test.wav', apiBaseUrl)).toBe(
            'https://bot.example.com/api/tts/audio/test.wav'
        );
    });

    it('resolves plain relative path via backend base URL', () => {
        expect(resolveAudioUrl('audio/test.wav', apiBaseUrl)).toBe('https://bot.example.com/audio/test.wav');
    });
});
