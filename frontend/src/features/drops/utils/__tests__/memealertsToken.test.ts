import { describe, expect, it } from 'vitest';

import { parseMemeAlertsTokenPayload } from '@/features/drops/utils/memealertsToken';

describe('parseMemeAlertsTokenPayload', () => {
    it('accepts MemeAlerts redirect URLs without protocol', () => {
        const parsed = parseMemeAlertsTokenPayload(
            'memealerts.com/auth/redirect?accessToken=access.jwt.token&refreshToken=refresh.jwt.token&obsToken='
        );

        expect(parsed).toEqual({
            accessToken: 'access.jwt.token',
            refreshToken: 'refresh.jwt.token',
            streamerId: undefined,
        });
    });

    it('accepts callback URLs with token params inside hash query', () => {
        const parsed = parseMemeAlertsTokenPayload(
            'http://localhost/memealerts/callback#/auth/redirect?accessToken=hash.jwt.token&refreshToken=hash.refresh.token'
        );

        expect(parsed).toEqual({
            accessToken: 'hash.jwt.token',
            refreshToken: 'hash.refresh.token',
            streamerId: undefined,
        });
    });

    it('accepts raw hash query text copied from callback URL', () => {
        const parsed = parseMemeAlertsTokenPayload(
            '#/auth/redirect?accessToken=raw.jwt.token&refreshToken=raw.refresh.token'
        );

        expect(parsed).toEqual({
            accessToken: 'raw.jwt.token',
            refreshToken: 'raw.refresh.token',
            streamerId: undefined,
        });
    });

    it('extracts streamer id hints from callback params', () => {
        const parsed = parseMemeAlertsTokenPayload(
            'https://memealerts.com/auth/redirect?accessToken=opaque-token-value-1234567890&streamerId=507f1f77bcf86cd799439011'
        );

        expect(parsed).toEqual({
            accessToken: 'opaque-token-value-1234567890',
            refreshToken: undefined,
            streamerId: '507f1f77bcf86cd799439011',
        });
    });
});
