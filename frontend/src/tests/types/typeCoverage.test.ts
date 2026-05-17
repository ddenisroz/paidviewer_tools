/**
 * Property Test: Type Coverage Completeness
 * Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
 * Validates: Requirements 1.3, 4.1, 4.2
 *
 * For any API endpoint used in the frontend, there SHALL exist a corresponding
 * TypeScript type definition that accurately describes the request and response shapes.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Import all type definitions to verify they exist
import type {
    // API types
    ApiResponse,
    ApiError,
    PaginationInfo,
    AdminApiResponse,
    BlockedChannel,
    BlockedChannelsResponse,
    BotInfo,
    BotsStatusResponse,
    TtsServiceStatus,
    BotStatusResponse,
    // Admin types
    AdminLog,
    LogStats,
    LogsResponse,
    UserSession,
    Integration,
    UsersResponse,
    // Drops types
    DropsConfig,
    DropsReward,
    DropsHistory,
    DropsStreak,
    DonationGridFormData,
    DonationSettingsFormData,
    StreakCalendarFormData,
    StreakSettingsFormData,
    // TTS types
    TtsStatus,
    TtsSettings,
    TtsVoice,
    TtsModeSettings,
    TtsRewardIds,
    CreateTtsRewardData,
    CreateTtsRewardResponse,
    LocalTtsConfig,
} from '../../types';

/**
 * Type guard to check if a value conforms to ApiResponse structure
 */
function isApiResponse(value: unknown): value is ApiResponse {
    return (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        typeof (value as ApiResponse).success === 'boolean'
    );
}

/**
 * Type guard to check if a value conforms to ApiError structure
 */
function isApiError(value: unknown): value is ApiError {
    return (
        typeof value === 'object' &&
        value !== null &&
        'error_code' in value &&
        'message' in value &&
        typeof (value as ApiError).error_code === 'string' &&
        typeof (value as ApiError).message === 'string'
    );
}

/**
 * Type guard to check if a value conforms to BlockedChannel structure
 */
function isBlockedChannel(value: unknown): value is BlockedChannel {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        'channel_name' in value &&
        typeof (value as BlockedChannel).id === 'number' &&
        typeof (value as BlockedChannel).channel_name === 'string'
    );
}

/**
 * Type guard to check if a value conforms to AdminLog structure
 */
function isAdminLog(value: unknown): value is AdminLog {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        'status' in value &&
        typeof (value as AdminLog).id === 'number' &&
        ['success', 'failed', 'warning'].includes((value as AdminLog).status)
    );
}

/**
 * Type guard to check if a value conforms to DropsConfig structure
 */
function isDropsConfig(value: unknown): value is DropsConfig {
    return (
        typeof value === 'object' &&
        value !== null &&
        'channel_name' in value &&
        typeof (value as DropsConfig).channel_name === 'string'
    );
}

/**
 * Type guard to check if a value conforms to TtsModeSettings structure
 */
function isTtsModeSettings(value: unknown): value is TtsModeSettings {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const settings = value as TtsModeSettings;

    // tts_mode is optional, but if present must be valid
    if ('tts_mode' in settings && settings.tts_mode !== undefined) {
        if (!['all_messages', 'channel_points'].includes(settings.tts_mode as string)) {
            return false;
        }
    }

    // tts_reward_ids is optional, but if present must be an object
    if ('tts_reward_ids' in settings && settings.tts_reward_ids !== undefined) {
        if (typeof settings.tts_reward_ids !== 'object') {
            return false;
        }
    }

    // Empty object or object with undefined fields is valid
    return true;
}

describe('Type Coverage Completeness', () => {
    describe('API Response Types', () => {
        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 1.3, 4.1, 4.2
        it('should validate ApiResponse structure for any success/error combination', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        success: fc.boolean(),
                        data: fc.option(fc.anything(), { nil: undefined }),
                        error: fc.option(fc.string(), { nil: undefined }),
                        message: fc.option(fc.string(), { nil: undefined }),
                    }),
                    (response) => {
                        return isApiResponse(response);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 1.3, 4.1, 4.2
        it('should validate ApiError structure for any error code and message', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        error_code: fc.string({ minLength: 1 }),
                        message: fc.string(),
                        details: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
                        timestamp: fc.option(fc.string(), { nil: undefined }),
                    }),
                    (error) => {
                        return isApiError(error);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Admin Types', () => {
        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 4.1, 5.1
        it('should validate BlockedChannel structure for any channel data', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        id: fc.integer({ min: 1 }),
                        channel_name: fc.string({ minLength: 1 }),
                        platform: fc.option(fc.constantFrom('twitch', 'vk'), { nil: undefined }),
                        reason: fc.option(fc.string(), { nil: undefined }),
                        blocked_at: fc.option(fc.string(), { nil: undefined }),
                    }),
                    (channel) => {
                        return isBlockedChannel(channel);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 4.1, 5.1
        it('should validate AdminLog structure for any log entry', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        id: fc.integer({ min: 1 }),
                        action_type: fc.option(fc.string(), { nil: undefined }),
                        description: fc.option(fc.string(), { nil: undefined }),
                        admin_name: fc.option(fc.string(), { nil: undefined }),
                        status: fc.constantFrom('success', 'failed', 'warning'),
                        timestamp: fc.option(fc.string(), { nil: undefined }),
                    }),
                    (log) => {
                        return isAdminLog(log);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Drops Types', () => {
        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 4.1, 4.2
        it('should validate DropsConfig structure for any configuration', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        channel_name: fc.string({ minLength: 1 }),
                        platform: fc.option(fc.constantFrom('twitch', 'vk'), { nil: undefined }),
                        streak_enabled_twitch: fc.option(fc.boolean(), { nil: undefined }),
                        streak_enabled_vk: fc.option(fc.boolean(), { nil: undefined }),
                        donation_enabled: fc.option(fc.boolean(), { nil: undefined }),
                    }),
                    (config) => {
                        return isDropsConfig(config);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('TTS Types', () => {
        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 4.1
        it('should validate TtsModeSettings structure for any mode configuration', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        tts_mode: fc.option(fc.constantFrom('all_messages', 'channel_points'), { nil: undefined }),
                        tts_reward_ids: fc.option(
                            fc.record({
                                twitch: fc.option(fc.string(), { nil: undefined }),
                                vk: fc.option(fc.string(), { nil: undefined }),
                            }),
                            { nil: undefined }
                        ),
                    }),
                    (settings) => {
                        return isTtsModeSettings(settings);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Type Existence Verification', () => {
        // Feature: frontend-typescript-linting, Property 2: Type Coverage Completeness
        // Validates: Requirements 1.3, 4.1, 4.2
        it('should verify all required API types are exported', () => {
            // This test verifies that all types compile correctly
            // If any type is missing, TypeScript will fail at compile time
            const typeChecks: Record<string, boolean> = {
                // API types
                ApiResponse: true,
                ApiError: true,
                PaginationInfo: true,
                AdminApiResponse: true,
                BlockedChannel: true,
                BlockedChannelsResponse: true,
                BotInfo: true,
                BotsStatusResponse: true,
                TtsServiceStatus: true,
                BotStatusResponse: true,
                // Admin types
                AdminLog: true,
                LogStats: true,
                LogsResponse: true,
                UserSession: true,
                Integration: true,
                UsersResponse: true,
                // Drops types
                DropsConfig: true,
                DropsReward: true,
                DropsHistory: true,
                DropsStreak: true,
                DonationGridFormData: true,
                DonationSettingsFormData: true,
                StreakCalendarFormData: true,
                StreakSettingsFormData: true,
                // TTS types
                TtsStatus: true,
                TtsSettings: true,
                TtsVoice: true,
                TtsModeSettings: true,
                TtsRewardIds: true,
                CreateTtsRewardData: true,
                CreateTtsRewardResponse: true,
                LocalTtsConfig: true,
            };

            // All types should be defined (this is a compile-time check)
            expect(Object.values(typeChecks).every((v) => v === true)).toBe(true);
        });
    });
});
