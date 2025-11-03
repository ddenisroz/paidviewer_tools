/**
 * Unified API Client
 * Единый клиент для всех API запросов
 * 
 * Features:
 * - Automatic retry for transient errors
 * - Centralized error handling
 * - Request/Response logging
 * - AbortController support
 * - TypeScript-ready structure
 */

import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from '../constants';
import { logger } from '../utils/prodLogger';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Delay helper for retry logic
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryableError = (error) => {
  if (!error.response) {
    // Network errors are retryable
    return true;
  }
  
  return RETRY_CONFIG.retryableStatuses.includes(error.response.status);
};

/**
 * Format error for user display
 */
const formatError = (error) => {
  if (!error.response) {
    return {
      message: 'Не удалось подключиться к серверу. Проверьте интернет-соединение.',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }
  
  const { status, data } = error.response;
  
  // StandardResponse format
  if (data.success === false && data.error) {
    return {
      message: data.error.message,
      code: data.error.code,
      status,
      details: data.error.details,
    };
  }
  
  // Legacy format
  return {
    message: data?.detail || data?.message || `Ошибка ${status}`,
    code: data?.code || 'UNKNOWN_ERROR',
    status,
  };
};

/**
 * ApiClient class
 */
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    // Create axios instance
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Request counter for logging
    this.requestId = 0;
    
    // Setup interceptors
    this._setupRequestInterceptor();
    this._setupResponseInterceptor();
  }
  
  /**
   * Setup request interceptor
   */
  _setupRequestInterceptor() {
    this.client.interceptors.request.use(
      (config) => {
        // Generate request ID for tracking
        config.requestId = ++this.requestId;
        config.startTime = Date.now();
        
        // Log request
        logger.debug(
          `[${config.requestId}] → ${config.method.toUpperCase()} ${config.url}`,
          config.params || config.data
        );
        
        return config;
      },
      (error) => {
        logger.error('[REQUEST] Error:', error);
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Setup response interceptor
   */
  _setupResponseInterceptor() {
    this.client.interceptors.response.use(
      (response) => {
        // Calculate request duration
        const duration = Date.now() - response.config.startTime;
        
        // Log response
        logger.debug(
          `[${response.config.requestId}] ← ${response.status} (${duration}ms)`,
          response.data
        );
        
        // Return only data (не весь response объект)
        return response.data;
      },
      async (error) => {
        return this._handleResponseError(error);
      }
    );
  }
  
  /**
   * Handle response errors with retry logic
   */
  async _handleResponseError(error) {
    const { config } = error;
    
    // Initialize retry count if not exists
    config.retryCount = config.retryCount || 0;
    
    // Check if we should retry
    const shouldRetry = 
      isRetryableError(error) && 
      config.retryCount < RETRY_CONFIG.maxRetries &&
      !config.skipRetry; // Allow opt-out
    
    if (shouldRetry) {
      config.retryCount++;
      
      // Calculate exponential backoff delay
      const retryDelay = RETRY_CONFIG.retryDelay * Math.pow(2, config.retryCount - 1);
      
      logger.warn(
        `[${config.requestId}] Retry ${config.retryCount}/${RETRY_CONFIG.maxRetries} after ${retryDelay}ms`
      );
      
      await delay(retryDelay);
      
      // Retry the request
      return this.client(config);
    }
    
    // Format error
    const formattedError = formatError(error);
    
    // Log error
    logger.error(
      `[${config?.requestId}] ✗ ${formattedError.code}: ${formattedError.message}`,
      formattedError.details
    );
    
    // Handle specific status codes
    if (error.response) {
      const { status } = error.response;
      
      // 401 Unauthorized - redirect to login
      if (status === 401 && !config.skipAuthRedirect) {
        logger.warn('[AUTH] Unauthorized - redirecting to login');
        // Don't show toast for 401 (auth pages will handle it)
        window.location.href = '/login';
        return Promise.reject(formattedError);
      }
      
      // 403 Forbidden
      if (status === 403) {
        toast.error('Недостаточно прав для выполнения операции');
        return Promise.reject(formattedError);
      }
      
      // 404 Not Found
      if (status === 404 && !config.skipToast) {
        toast.error(formattedError.message);
        return Promise.reject(formattedError);
      }
      
      // 429 Rate Limit
      if (status === 429) {
        const retryAfter = formattedError.details?.retry_after_seconds || 60;
        toast.error(`Слишком много запросов. Подождите ${retryAfter} секунд.`);
        return Promise.reject(formattedError);
      }
      
      // 500+ Server errors
      if (status >= 500 && !config.skipToast) {
        toast.error('Ошибка сервера. Попробуйте позже.');
        return Promise.reject(formattedError);
      }
    }
    
    // Show toast for other errors (unless opted out)
    if (!config.skipToast) {
      toast.error(formattedError.message);
    }
    
    return Promise.reject(formattedError);
  }
  
  /**
   * GET request
   */
  get(url, config = {}) {
    return this.client.get(url, config);
  }
  
  /**
   * POST request
   */
  post(url, data = null, config = {}) {
    return this.client.post(url, data, config);
  }
  
  /**
   * PUT request
   */
  put(url, data = null, config = {}) {
    return this.client.put(url, data, config);
  }
  
  /**
   * PATCH request
   */
  patch(url, data = null, config = {}) {
    return this.client.patch(url, data, config);
  }
  
  /**
   * DELETE request
   */
  delete(url, config = {}) {
    return this.client.delete(url, config);
  }
  
  /**
   * Create AbortController for cancellable requests
   */
  createCancelToken() {
    return axios.CancelToken.source();
  }
  
  /**
   * Check if error is cancellation
   */
  isCancel(error) {
    return axios.isCancel(error);
  }
}

/**
 * Admin API Client (with admin-specific headers)
 */
class AdminApiClient extends ApiClient {
  constructor() {
    super(API_BASE_URL);
    
    // Add admin-specific request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Admin endpoints might need special headers in the future
        return config;
      }
    );
  }
}

// Export singleton instances
export const api = new ApiClient();
export const adminApi = new AdminApiClient();

// Export class for testing
export { ApiClient };

// Export helper functions
export { formatError };

export default api;

