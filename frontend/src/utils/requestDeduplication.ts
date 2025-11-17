/**
 * Request Deduplication Utility
 * Prevents duplicate API calls for the same resource
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest<any>> = new Map();
  private readonly CACHE_DURATION = 100; // 100ms window for deduplication

  /**
   * Deduplicate requests with the same key
   * If a request is already in flight, return the existing promise
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const pending = this.pendingRequests.get(key);

    // If there's a pending request within the cache duration, return it
    if (pending && now - pending.timestamp < this.CACHE_DURATION) {
      return pending.promise;
    }

    // Create new request
    const promise = requestFn()
      .finally(() => {
        // Clean up after request completes
        setTimeout(() => {
          this.pendingRequests.delete(key);
        }, this.CACHE_DURATION);
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: now,
    });

    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Clear specific request by key
   */
  clearKey(key: string): void {
    this.pendingRequests.delete(key);
  }
}

export const requestDeduplicator = new RequestDeduplicator();
