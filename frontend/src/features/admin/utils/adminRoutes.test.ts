import { describe, expect, it } from 'vitest';

import {
  ADMIN_BASE_PATH,
  getAdminTabHref,
  isAdminPath,
  normalizeAdminTab,
  resolveAdminTabFromPath,
} from './adminRoutes';

describe('adminRoutes', () => {
  it('normalizes known tabs and legacy aliases', () => {
    expect(normalizeAdminTab('runtime')).toBe('runtime');
    expect(normalizeAdminTab('Voices')).toBe('tts');
    expect(normalizeAdminTab('monitoring')).toBe('runtime');
    expect(normalizeAdminTab('users')).toBe('accounts');
  });

  it('resolves admin tab from canonical paths', () => {
    expect(resolveAdminTabFromPath(`${ADMIN_BASE_PATH}/tts`)).toBe('tts');
    expect(resolveAdminTabFromPath('/dashboard')).toBe('overview');
  });

  it('builds hrefs and path guards consistently', () => {
    expect(getAdminTabHref('overview')).toBe(ADMIN_BASE_PATH);
    expect(getAdminTabHref('channels')).toBe(`${ADMIN_BASE_PATH}?tab=channels`);
    expect(isAdminPath('/dashboard/admin')).toBe(true);
    expect(isAdminPath('/dashboard/admin?tab=tts')).toBe(true);
    expect(isAdminPath('/dashboard/dolbaebadmintts/runtime')).toBe(false);
    expect(isAdminPath('/dashboard/settings')).toBe(false);
  });
});
