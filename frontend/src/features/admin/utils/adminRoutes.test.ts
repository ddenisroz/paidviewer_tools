import { describe, expect, it } from 'vitest';

import {
    ADMIN_BASE_PATH,
    getAdminTabHref,
    isAdminPath,
    normalizeAdminTab,
    resolveAdminTabFromPath,
} from './adminRoutes';

describe('adminRoutes', () => {
    it('normalizes the reduced admin surface and legacy aliases', () => {
        expect(normalizeAdminTab('runtime')).toBe('runtime');
        expect(normalizeAdminTab('bots')).toBe('runtime');
        expect(normalizeAdminTab('Voices')).toBe('voices');
        expect(normalizeAdminTab('tts')).toBe('voices');
        expect(normalizeAdminTab('logs')).toBe('runtime');
        expect(normalizeAdminTab('users')).toBe('accounts');
        expect(normalizeAdminTab('whitelist')).toBe('accounts');
    });

    it('resolves admin tab from canonical and legacy paths', () => {
        expect(resolveAdminTabFromPath(`${ADMIN_BASE_PATH}/tts`)).toBe('voices');
        expect(resolveAdminTabFromPath(`${ADMIN_BASE_PATH}/users`)).toBe('accounts');
        expect(resolveAdminTabFromPath('/dashboard')).toBe('runtime');
    });

    it('builds hrefs and path guards consistently', () => {
        expect(getAdminTabHref('runtime')).toBe(ADMIN_BASE_PATH);
        expect(getAdminTabHref('accounts')).toBe(`${ADMIN_BASE_PATH}?tab=accounts`);
        expect(getAdminTabHref('voices')).toBe(`${ADMIN_BASE_PATH}?tab=voices`);
        expect(isAdminPath('/dashboard/admin')).toBe(true);
        expect(isAdminPath('/dashboard/admin?tab=logs')).toBe(true);
        expect(isAdminPath('/dashboard/dolbaebadmintts/runtime')).toBe(false);
        expect(isAdminPath('/dashboard/settings')).toBe(false);
    });
});
