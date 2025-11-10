/**
 * Типы для API responses
 * Используются в JSDoc комментариях и для будущей миграции на TypeScript
 */

import { AxiosResponse } from 'axios';

/**
 * Базовый тип для API ответа
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Тип для пагинации
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Тип для пагинированного ответа
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Тип для ошибки API
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Тип для Axios response с типизированными данными
 */
export type TypedAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;

