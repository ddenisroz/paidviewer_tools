import { describe, expect, it } from 'vitest';

import { getSafeBackendAuthUrl, getSafeNavigationUrl } from '@/shared/utils/navigationSafety';

describe('getSafeNavigationUrl', () => {
    it('allows same-origin relative path', () => {
        const result = getSafeNavigationUrl('/auth/donationalerts/login');
        expect(result).not.toBeNull();
        expect(result?.includes('/auth/donationalerts/login')).toBe(true);
    });

    it('allows external https url', () => {
        const result = getSafeNavigationUrl('https://www.donationalerts.com/oauth/authorize');
        expect(result).toBe('https://www.donationalerts.com/oauth/authorize');
    });

    it('blocks javascript url', () => {
        expect(getSafeNavigationUrl('javascript:alert(1)')).toBeNull();
    });

    it('blocks external http url', () => {
        expect(getSafeNavigationUrl('http://evil.example/phish')).toBeNull();
    });
});

describe('getSafeBackendAuthUrl', () => {
    it('builds auth url for valid base and path', () => {
        const result = getSafeBackendAuthUrl('https://api.example.com', '/auth/twitch/login');
        expect(result).toBe('https://api.example.com/auth/twitch/login');
    });

    it('rejects non-auth path', () => {
        expect(getSafeBackendAuthUrl('https://api.example.com', '/api/auth/status')).toBeNull();
    });

    it('rejects invalid base protocol', () => {
        expect(getSafeBackendAuthUrl('javascript:alert(1)', '/auth/twitch/login')).toBeNull();
    });
});
