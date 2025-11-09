/**
 * Централизованные query keys для React Query
 * Используются для инвалидации и синхронизации кэша
 */

/**
 * Query Keys Factory Pattern
 * Позволяет создавать типизированные ключи для queries
 */

/**
 * Централизованные query keys для React Query
 * Factory pattern для создания ключей
 */

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'],
    user: () => ['auth', 'user'],
    me: () => ['auth', 'me'],
  },

  // TTS
  tts: {
    all: ['tts'],
    status: (channelName) => ['tts', 'status', channelName],
    settings: () => ['tts', 'settings'],
    audioSettings: () => ['tts', 'audio-settings'],
    platformSettings: () => ['tts', 'platform-settings'],
    modeSettings: () => ['tts', 'mode-settings'],
    obsUrl: () => ['tts', 'obs-url'],
    health: () => ['tts', 'health'],
    voices: {
      all: () => ['tts', 'voices'],
      global: () => ['tts', 'voices', 'global'],
      user: (userId) => ['tts', 'voices', 'user', userId],
    },
    filteredWords: () => ['tts', 'filtered-words'],
    blockedUsers: () => ['tts', 'blocked-users'],
    localTtsConfig: () => ['tts', 'local-tts-config'],
    whitelistStatus: () => ['tts', 'voices-whitelist-status'],
  },

  // YouTube
  youtube: {
    all: ['youtube'],
    queue: () => ['youtube', 'queue'],
    settings: () => ['youtube', 'settings'],
    obsUrl: () => ['youtube', 'obs-url'],
  },

        // Drops
        drops: {
          all: ['drops'],
          config: (channelName) => ['drops', 'config', channelName],
          qualities: () => ['drops', 'qualities'],
          rewards: (channelName) => ['drops', 'rewards', channelName],
          history: (channelName) => ['drops', 'history', channelName],
          widgetUrl: () => ['drops', 'widget-url'],
        },

  // Commands
  commands: {
    all: ['commands'],
    list: () => ['commands'],
  },

  // Stream
  stream: {
    all: ['stream'],
    info: {
      twitch: () => ['stream', 'info', 'twitch'],
      vk: () => ['stream', 'info', 'vk'],
    },
    history: () => ['stream', 'history'],
    categories: {
      twitch: (search) => ['stream', 'categories', 'twitch', search],
      vk: (search) => ['stream', 'categories', 'vk', search],
    },
  },

  // Points
  points: {
    all: ['points'],
    rewards: (platform) => ['points', 'rewards', platform],
  },

  // Chat
  chat: {
    all: ['chat'],
    history: () => ['chat', 'history'],
    botStatus: () => ['chat', 'bot-status'],
  },

  // Chatbox
  chatbox: {
    all: ['chatbox'],
    settings: () => ['chatbox', 'settings'],
  },

  // Integrations
  integrations: {
    all: ['integrations'],
    list: () => ['integrations'],
  },

  // User Settings
  userSettings: {
    all: ['user-settings'],
    settings: () => ['user-settings'],
  },
};

