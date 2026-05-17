import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    isApiError,
    isAxiosApiError,
    isErrorWithMessage,
    getErrorMessage,
    getErrorCode,
    getErrorStatus,
    getErrorDetails,
    hasProperty,
    hasData,
    isString,
    isNumber,
    isBoolean,
    isObject,
    isArray,
} from '../errorUtils';
import type { ApiError, ApiErrorCode } from '@/types/api';

describe('errorUtils', () => {
    describe('isApiError', () => {
        it('returns true for backend ApiError format', () => {
            const error: ApiError = {
                error_code: 'NOT_FOUND',
                message: 'Resource not found',
            };
            expect(isApiError(error)).toBe(true);
        });

        it('returns true for ApiError with details', () => {
            const error: ApiError = {
                error_code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                details: { field: 'email' },
            };
            expect(isApiError(error)).toBe(true);
        });

        it('returns false for Axios error', () => {
            const error = {
                response: {
                    data: { message: 'Error' },
                    status: 400,
                },
            };
            expect(isApiError(error)).toBe(false);
        });

        it('returns false for regular Error', () => {
            const error = new Error('Regular error');
            expect(isApiError(error)).toBe(false);
        });

        it('returns false for null', () => {
            expect(isApiError(null)).toBe(false);
        });
    });

    describe('isAxiosApiError', () => {
        it('returns true for Axios error', () => {
            const error = {
                response: {
                    data: { message: 'Error' },
                    status: 400,
                },
            };
            expect(isAxiosApiError(error)).toBe(true);
        });

        it('returns false for non-Axios error', () => {
            const error = new Error('Regular error');
            expect(isAxiosApiError(error)).toBe(false);
        });

        it('returns false for null', () => {
            expect(isAxiosApiError(null)).toBe(false);
        });
    });

    describe('isErrorWithMessage', () => {
        it('returns true for error with message', () => {
            const error = { message: 'Error message' };
            expect(isErrorWithMessage(error)).toBe(true);
        });

        it('returns false for error without message', () => {
            const error = { code: 500 };
            expect(isErrorWithMessage(error)).toBe(false);
        });

        it('returns false for null', () => {
            expect(isErrorWithMessage(null)).toBe(false);
        });
    });

    describe('getErrorMessage', () => {
        it('extracts message from backend ApiError', () => {
            const error: ApiError = {
                error_code: 'NOT_FOUND',
                message: 'Resource not found',
            };
            expect(getErrorMessage(error)).toBe('Resource not found');
        });

        it('extracts message from Axios error with ApiError in response', () => {
            const error = {
                response: {
                    data: {
                        error_code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                    },
                },
            };
            expect(getErrorMessage(error)).toBe('Invalid input');
        });

        it('extracts message from Axios error detail', () => {
            const error = {
                response: {
                    data: { detail: 'API error detail' },
                },
            };
            expect(getErrorMessage(error)).toBe('API error detail');
        });

        it('extracts message from Axios error message', () => {
            const error = {
                response: {
                    data: { message: 'API error message' },
                },
            };
            expect(getErrorMessage(error)).toBe('API error message');
        });

        it('extracts message from error.message', () => {
            const error = { message: 'Error message' };
            expect(getErrorMessage(error)).toBe('Error message');
        });

        it('handles empty error.message', () => {
            const error = { message: '' };
            expect(getErrorMessage(error)).toBe('Произошла неизвестная ошибка');
        });

        it('handles string error', () => {
            expect(getErrorMessage('String error')).toBe('String error');
        });

        it('handles empty string error', () => {
            expect(getErrorMessage('')).toBe('Произошла неизвестная ошибка');
        });

        it('returns default message for unknown error', () => {
            expect(getErrorMessage(123)).toBe('Произошла неизвестная ошибка');
        });

        it('returns default message for null', () => {
            expect(getErrorMessage(null)).toBe('Произошла неизвестная ошибка');
        });
    });

    describe('getErrorCode', () => {
        it('extracts error_code from backend ApiError', () => {
            const error: ApiError = {
                error_code: 'NOT_FOUND',
                message: 'Resource not found',
            };
            expect(getErrorCode(error)).toBe('NOT_FOUND');
        });

        it('extracts error_code from Axios error with ApiError in response', () => {
            const error = {
                response: {
                    data: {
                        error_code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                    },
                },
            };
            expect(getErrorCode(error)).toBe('VALIDATION_ERROR');
        });

        it('returns undefined for non-ApiError', () => {
            const error = { message: 'Error' };
            expect(getErrorCode(error)).toBeUndefined();
        });
    });

    describe('getErrorStatus', () => {
        it('extracts status from Axios error', () => {
            const error = {
                response: {
                    status: 404,
                },
            };
            expect(getErrorStatus(error)).toBe(404);
        });

        it('returns undefined for non-Axios error', () => {
            const error = { message: 'Error' };
            expect(getErrorStatus(error)).toBeUndefined();
        });
    });

    describe('getErrorDetails', () => {
        it('extracts details from backend ApiError', () => {
            const error: ApiError = {
                error_code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                details: { field: 'email', reason: 'invalid format' },
            };
            expect(getErrorDetails(error)).toEqual({ field: 'email', reason: 'invalid format' });
        });

        it('extracts details from Axios error with ApiError in response', () => {
            const error = {
                response: {
                    data: {
                        error_code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                        details: { field: 'username' },
                    },
                },
            };
            expect(getErrorDetails(error)).toEqual({ field: 'username' });
        });

        it('returns undefined for error without details', () => {
            const error: ApiError = {
                error_code: 'NOT_FOUND',
                message: 'Resource not found',
            };
            expect(getErrorDetails(error)).toBeUndefined();
        });
    });

    describe('hasProperty', () => {
        it('returns true if property exists', () => {
            const obj = { name: 'test', age: 25 };
            expect(hasProperty(obj, 'name')).toBe(true);
        });

        it('returns false if property does not exist', () => {
            const obj = { name: 'test' };
            expect(hasProperty(obj, 'age')).toBe(false);
        });
    });

    describe('hasData', () => {
        it('returns true if response has data', () => {
            const response = { data: { id: 1 } };
            expect(hasData(response)).toBe(true);
        });

        it('returns false if response has no data', () => {
            const response = { status: 200 };
            expect(hasData(response)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasData(null)).toBe(false);
        });
    });

    describe('Type validators', () => {
        describe('isString', () => {
            it('returns true for string', () => {
                expect(isString('test')).toBe(true);
            });

            it('returns false for non-string', () => {
                expect(isString(123)).toBe(false);
                expect(isString(null)).toBe(false);
            });
        });

        describe('isNumber', () => {
            it('returns true for number', () => {
                expect(isNumber(123)).toBe(true);
                expect(isNumber(0)).toBe(true);
            });

            it('returns false for non-number', () => {
                expect(isNumber('123')).toBe(false);
                expect(isNumber(null)).toBe(false);
            });
        });

        describe('isBoolean', () => {
            it('returns true for boolean', () => {
                expect(isBoolean(true)).toBe(true);
                expect(isBoolean(false)).toBe(true);
            });

            it('returns false for non-boolean', () => {
                expect(isBoolean(1)).toBe(false);
                expect(isBoolean('true')).toBe(false);
            });
        });

        describe('isObject', () => {
            it('returns true for object', () => {
                expect(isObject({})).toBe(true);
                expect(isObject({ key: 'value' })).toBe(true);
            });

            it('returns false for non-object', () => {
                expect(isObject(null)).toBe(false);
                expect(isObject([])).toBe(false);
                expect(isObject('string')).toBe(false);
            });
        });

        describe('isArray', () => {
            it('returns true for array', () => {
                expect(isArray([])).toBe(true);
                expect(isArray([1, 2, 3])).toBe(true);
            });

            it('returns false for non-array', () => {
                expect(isArray({})).toBe(false);
                expect(isArray('string')).toBe(false);
                expect(isArray(null)).toBe(false);
            });
        });
    });

    // Property-Based Tests
    // Feature: frontend-typescript-linting, Property 6: API Error Type Consistency
    describe('Property-Based Tests', () => {
        describe('Property 6: API Error Type Consistency', () => {
            // Arbitrary for ApiErrorCode
            const apiErrorCodeArbitrary = fc.constantFrom(
                'INTERNAL_ERROR',
                'AUTHENTICATION_ERROR',
                'AUTHORIZATION_ERROR',
                'TOKEN_EXPIRED',
                'INVALID_TOKEN',
                'SESSION_EXPIRED',
                'NOT_FOUND',
                'ALREADY_EXISTS',
                'VALIDATION_ERROR',
                'INVALID_INPUT',
                'PLATFORM_ERROR',
                'PLATFORM_CONNECTION_ERROR',
                'PLATFORM_API_ERROR',
                'BOT_ERROR',
                'BOT_NOT_CONNECTED',
                'BOT_ALREADY_CONNECTED',
                'TTS_ERROR',
                'TTS_SERVICE_UNAVAILABLE',
                'TTS_VOICE_NOT_FOUND',
                'DATABASE_ERROR',
                'DATABASE_CONNECTION_ERROR',
                'RATE_LIMIT_EXCEEDED',
                'EXTERNAL_SERVICE_ERROR'
            ) as fc.Arbitrary<ApiErrorCode>;

            // Arbitrary for ApiError
            const apiErrorArbitrary = fc.record({
                error_code: apiErrorCodeArbitrary,
                message: fc.string({ minLength: 1 }),
                details: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
                timestamp: fc.option(fc.string(), { nil: undefined }),
            }) as fc.Arbitrary<ApiError>;

            it('should always identify valid ApiError objects', () => {
                fc.assert(
                    fc.property(apiErrorArbitrary, (error) => {
                        return isApiError(error) === true;
                    }),
                    { numRuns: 100 }
                );
            });

            it('should always extract message from ApiError', () => {
                fc.assert(
                    fc.property(apiErrorArbitrary, (error) => {
                        const message = getErrorMessage(error);
                        return message === error.message;
                    }),
                    { numRuns: 100 }
                );
            });

            it('should always extract error_code from ApiError', () => {
                fc.assert(
                    fc.property(apiErrorArbitrary, (error) => {
                        const code = getErrorCode(error);
                        return code === error.error_code;
                    }),
                    { numRuns: 100 }
                );
            });

            it('should always extract details from ApiError when present', () => {
                fc.assert(
                    fc.property(apiErrorArbitrary, (error) => {
                        const details = getErrorDetails(error);
                        if (error.details !== undefined) {
                            return details === error.details;
                        }
                        return details === undefined;
                    }),
                    { numRuns: 100 }
                );
            });

            it('should handle Axios errors with ApiError in response', () => {
                const axiosErrorArbitrary = fc.record({
                    response: fc.record({
                        data: apiErrorArbitrary,
                        status: fc.integer({ min: 400, max: 599 }),
                    }),
                    message: fc.option(fc.string(), { nil: undefined }),
                });

                fc.assert(
                    fc.property(axiosErrorArbitrary, (error) => {
                        const message = getErrorMessage(error);
                        const code = getErrorCode(error);
                        const details = getErrorDetails(error);

                        return (
                            message === error.response.data.message &&
                            code === error.response.data.error_code &&
                            (error.response.data.details === undefined
                                ? details === undefined
                                : details === error.response.data.details)
                        );
                    }),
                    { numRuns: 100 }
                );
            });

            it('should never return undefined message for ApiError', () => {
                fc.assert(
                    fc.property(apiErrorArbitrary, (error) => {
                        const message = getErrorMessage(error);
                        return typeof message === 'string' && message.length > 0;
                    }),
                    { numRuns: 100 }
                );
            });

            it('should always return a string message for any error type', () => {
                const anyErrorArbitrary = fc.oneof(
                    apiErrorArbitrary,
                    fc.record({ message: fc.string() }),
                    fc.string(),
                    fc.integer(),
                    fc.constant(null),
                    fc.constant(undefined)
                );

                fc.assert(
                    fc.property(anyErrorArbitrary, (error) => {
                        const message = getErrorMessage(error);
                        return typeof message === 'string' && message.length > 0;
                    }),
                    { numRuns: 100 }
                );
            });
        });
    });
});
