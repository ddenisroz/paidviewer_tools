export const WEBSOCKET_CONSTANTS = {
    RECONNECT: {
        MAX_ATTEMPTS: 5,
        INITIAL_DELAY: 1000,
        MAX_DELAY: 30000,
        BACKOFF_MULTIPLIER: 2,
    },
    WIDGET: {
        MAX_RECONNECT_ATTEMPTS: 10,
    },
    SCROLL: {
        MAX_ATTEMPTS: 10,
        FINAL_DELAY: 50,
    },
} as const;
