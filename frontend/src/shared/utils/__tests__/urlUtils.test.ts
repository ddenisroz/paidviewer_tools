import { beforeEach, describe, expect, it } from 'vitest';

import { getAndClearReturnUrl } from '@/utils/urlUtils';

describe('urlUtils.getAndClearReturnUrl', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns safe internal relative path', () => {
        localStorage.setItem('returnUrl', '/dashboard/tts?tab=voices');
        expect(getAndClearReturnUrl()).toBe('/dashboard/tts?tab=voices');
    });

    it('rejects absolute external url', () => {
        localStorage.setItem('returnUrl', 'https://evil.example/phish');
        expect(getAndClearReturnUrl()).toBeNull();
    });

    it('rejects protocol-relative url', () => {
        localStorage.setItem('returnUrl', '//evil.example/phish');
        expect(getAndClearReturnUrl()).toBeNull();
    });

    it('rejects javascript payload', () => {
        localStorage.setItem('returnUrl', '/javascript:alert(1)');
        expect(getAndClearReturnUrl()).toBeNull();
    });

    it('clears stored value after read', () => {
        localStorage.setItem('returnUrl', '/some-page');
        getAndClearReturnUrl();
        expect(localStorage.getItem('returnUrl')).toBeNull();
    });

    it('supports legacy oauth return-url key', () => {
        localStorage.setItem('oauth_return_url', '/dashboard/chat-analysis');
        localStorage.setItem('oauth_return_timestamp', Date.now().toString());
        expect(getAndClearReturnUrl()).toBe('/dashboard/chat-analysis');
    });

    it('rejects expired legacy oauth return-url key', () => {
        localStorage.setItem('oauth_return_url', '/dashboard/chat-analysis');
        localStorage.setItem('oauth_return_timestamp', String(Date.now() - 6 * 60 * 1000));
        expect(getAndClearReturnUrl()).toBeNull();
    });
});
