/**
 * Query Utilities - helper functions for React Query
 */

/**
 * Helper function to unwrap Axios response data
 * Converts Promise<AxiosResponse<T>> to Promise<T>
 */
export const unwrapResponse = <T>(promise: Promise<{ data: T }>): Promise<T> => {
    return promise.then((response) => response.data);
};
