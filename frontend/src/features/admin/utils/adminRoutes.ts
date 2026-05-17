export type AdminTabId = 'runtime' | 'accounts' | 'voices';

export const ADMIN_BASE_PATH = '/dashboard/admin';

const LEGACY_TAB_MAP: Record<string, AdminTabId> = {
    overview: 'runtime',
    dashboard: 'runtime',
    bots: 'runtime',
    workers: 'runtime',
    monitoring: 'runtime',
    runtime: 'runtime',
    channels: 'accounts',
    logs: 'runtime',
    users: 'accounts',
    accounts: 'accounts',
    whitelist: 'accounts',
    tts: 'voices',
    voices: 'voices',
    voice: 'voices',
    samples: 'voices',
};

const ADMIN_TABS: AdminTabId[] = ['runtime', 'accounts', 'voices'];

export const isAdminTabId = (value: string | null | undefined): value is AdminTabId =>
    Boolean(value && ADMIN_TABS.includes(value as AdminTabId));

export const normalizeAdminTab = (value: string | null | undefined): AdminTabId => {
    if (!value) {
        return 'runtime';
    }

    const normalized = value.trim().toLowerCase();
    if (isAdminTabId(normalized)) {
        return normalized;
    }

    return LEGACY_TAB_MAP[normalized] || 'runtime';
};

export const resolveAdminTabFromPath = (pathname: string): AdminTabId => {
    const normalizedPath = pathname.replace(/\/+$/, '');
    const basePath = normalizedPath.startsWith(ADMIN_BASE_PATH) ? ADMIN_BASE_PATH : null;

    if (!basePath) {
        return 'runtime';
    }

    const tail = normalizedPath.slice(basePath.length).replace(/^\/+/, '');
    if (!tail) {
        return 'runtime';
    }

    const [segment] = tail.split('/');
    return normalizeAdminTab(segment);
};

export const getAdminTabHref = (tab: AdminTabId): string =>
    tab === 'runtime' ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}?tab=${tab}`;

export const isAdminPath = (pathname: string): boolean => pathname.startsWith(ADMIN_BASE_PATH);
