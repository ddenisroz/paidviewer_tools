/**
 * Централизованные query keys для React Query.
 * Используются для типизированной инвалидации и синхронизации кэша.
 */
export const queryKeys = {
    // Auth
    auth: {
        all: ['auth'] as const,
        status: () => ['auth', 'status'] as const,
        user: () => ['auth', 'user'] as const,
        me: () => ['auth', 'me'] as const,
    },

    // TTS
    tts: {
        all: ['tts'] as const,
        status: (channelName?: string | null) => ['tts', 'status', channelName] as const,
        settings: () => ['tts', 'settings'] as const,
        audioSettings: () => ['tts', 'audio-settings'] as const,
        platformSettings: () => ['tts', 'platform-settings'] as const,
        modeSettings: () => ['tts', 'mode-settings'] as const,
        obsUrl: () => ['tts', 'obs-url'] as const,
        health: () => ['tts', 'health'] as const,
        voices: {
            all: () => ['tts', 'voices'] as const,
            global: () => ['tts', 'voices', 'global'] as const,
            user: (userId?: number) => ['tts', 'voices', 'user', userId] as const,
        },
        filteredWords: () => ['tts', 'filtered-words'] as const,
        blockedUsers: () => ['tts', 'blocked-users'] as const,
        localTtsConfig: (provider: 'f5' = 'f5') => ['tts', 'local-tts-config', provider] as const,
        workers: (provider?: 'f5') => ['tts', 'workers', provider] as const,
        whitelistStatus: () => ['tts', 'voices-whitelist-status'] as const,
    },

    // YouTube
    youtube: {
        all: ['youtube'] as const,
        queue: () => ['youtube', 'queue'] as const,
        settings: () => ['youtube', 'settings'] as const,
        obsUrl: () => ['youtube', 'obs-url'] as const,
    },

    // Drops
    drops: {
        all: ['drops'] as const,
        config: (channelName?: string | null) => ['drops', 'config', channelName] as const,
        qualities: () => ['drops', 'qualities'] as const,
        rewards: (channelName?: string | null) => ['drops', 'rewards', channelName] as const,
        history: (channelName?: string | null) => ['drops', 'history', channelName] as const,
        widgetUrl: () => ['drops', 'widget-url'] as const,
    },

    // Commands
    commands: {
        all: ['commands'] as const,
        list: () => ['commands'] as const,
        history: (params?: Record<string, unknown>) => ['commands', 'history', params] as const,
    },

    // Chat
    chat: {
        all: ['chat'] as const,
        history: () => ['chat', 'history'] as const,
        status: () => ['chat', 'status'] as const,
        botStatus: (username?: string | number) => ['bot-status', username] as const,
    },

    // Points
    points: {
        all: ['points'] as const,
        platformRewards: (platform?: string) => ['points', 'platform-rewards', platform] as const,
    },

    // Stream
    stream: {
        all: ['stream'] as const,
        twitchInfo: () => ['stream', 'twitch-info'] as const,
        vkInfo: () => ['stream', 'vk-info'] as const,
        history: () => ['stream', 'history'] as const,
        twitchCategories: (search?: string) => ['stream', 'twitch-categories', search] as const,
        vkCategories: (search?: string) => ['stream', 'vk-categories', search] as const,
    },

    // User Settings
    userSettings: {
        all: ['user-settings'] as const,
        settings: () => ['user-settings'] as const,
    },

    // Integrations
    integrations: {
        all: ['integrations'] as const,
        list: () => ['integrations'] as const,
    },

    // Chatbox
    chatbox: {
        all: ['chatbox'] as const,
        settings: () => ['chatbox-settings'] as const,
    },

    // Admin
    admin: {
        all: ['admin'] as const,
        overview: () => ['admin', 'overview'] as const,
        runtimeOverview: () => ['admin', 'runtime-overview'] as const,
        ttsOverview: () => ['admin', 'tts-overview'] as const,
        accountsOverview: (params?: Record<string, unknown>) => ['admin', 'accounts-overview', params] as const,
        channelsOverview: (params?: Record<string, unknown>) => ['admin', 'channels-overview', params] as const,
        logsOverview: (params?: Record<string, unknown>) => ['admin', 'logs-overview', params] as const,
        list: () => ['admin', 'list'] as const,
        whitelist: () => ['admin', 'whitelist'] as const,
        cacheStats: () => ['admin', 'cache-stats'] as const,
        botsStatus: () => ['admin', 'bots-status'] as const,
        systemLogs: () => ['admin', 'system-logs'] as const,
        monitoringMetrics: () => ['admin', 'monitoring-metrics'] as const,
        blockedChannels: () => ['admin', 'blocked-channels'] as const,
        adminLogs: () => ['admin', 'admin-logs'] as const,
        logsStats: () => ['admin', 'logs-stats'] as const,
        logsActions: () => ['admin', 'logs-actions'] as const,
        databaseStats: () => ['admin', 'database-stats'] as const,
        backups: () => ['admin', 'backups'] as const,
        users: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,
        sessions: () => ['admin', 'sessions'] as const,
        ttsStatus: () => ['admin', 'tts-status'] as const,
        workers: () => ['admin', 'workers'] as const,
    },
};
