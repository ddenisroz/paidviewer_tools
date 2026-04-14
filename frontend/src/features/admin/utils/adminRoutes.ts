export type AdminTabId = 'overview' | 'runtime' | 'tts' | 'accounts' | 'channels' | 'logs';

export const ADMIN_BASE_PATH = '/dashboard/admin';

const LEGACY_TAB_MAP: Record<string, AdminTabId> = {
  dashboard: 'overview',
  bots: 'runtime',
  workers: 'runtime',
  monitoring: 'runtime',
  voices: 'tts',
  users: 'accounts',
  channels: 'channels',
  logs: 'logs',
};

const ADMIN_TABS: AdminTabId[] = ['overview', 'runtime', 'tts', 'accounts', 'channels', 'logs'];

export const isAdminTabId = (value: string | null | undefined): value is AdminTabId =>
  Boolean(value && ADMIN_TABS.includes(value as AdminTabId));

export const normalizeAdminTab = (value: string | null | undefined): AdminTabId => {
  if (!value) {
    return 'overview';
  }

  const normalized = value.trim().toLowerCase();
  if (isAdminTabId(normalized)) {
    return normalized;
  }

  return LEGACY_TAB_MAP[normalized] || 'overview';
};

export const resolveAdminTabFromPath = (pathname: string): AdminTabId => {
  const normalizedPath = pathname.replace(/\/+$/, '');
  const basePath = normalizedPath.startsWith(ADMIN_BASE_PATH) ? ADMIN_BASE_PATH : null;

  if (!basePath) {
    return 'overview';
  }

  const tail = normalizedPath.slice(basePath.length).replace(/^\/+/, '');
  if (!tail) {
    return 'overview';
  }

  const [segment] = tail.split('/');
  return normalizeAdminTab(segment);
};

export const getAdminTabHref = (tab: AdminTabId): string =>
  tab === 'overview' ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}?tab=${tab}`;

export const isAdminPath = (pathname: string): boolean =>
  pathname.startsWith(ADMIN_BASE_PATH);
