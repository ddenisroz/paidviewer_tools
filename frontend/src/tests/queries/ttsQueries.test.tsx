/**
 * Тесты для TTS React Query hooks
 * Проверяет корректность работы queries после миграции на TypeScript
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTtsStatus, useToggleTts, useWhitelistStatus } from '../../queries/tts/ttsQueries';
import { ttsService } from '../../services/api/services/ttsService';

// Мокаем ttsService
jest.mock('../../services/api/services/ttsService', () => ({
  ttsService: {
    getStatus: jest.fn(),
    toggleStatus: jest.fn(),
    getWhitelistStatus: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('TTS Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useTtsStatus', () => {
    test('загружает статус TTS корректно', async () => {
      const mockStatus = {
        enabled: true,
        is_whitelisted: true,
        platform: 'twitch',
      };

      (ttsService.getStatus as jest.Mock).mockResolvedValue({
        data: mockStatus,
      });

      const { result } = renderHook(() => useTtsStatus('testchannel'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(mockStatus);
      expect(ttsService.getStatus).toHaveBeenCalledWith('testchannel');
    });

    test('обрабатывает ошибки корректно', async () => {
      const mockError = new Error('Failed to fetch status');
      (ttsService.getStatus as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useTtsStatus('testchannel'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(mockError);
    });
  });

  describe('useToggleTts', () => {
    test('переключает статус TTS корректно', async () => {
      (ttsService.toggleStatus as jest.Mock).mockResolvedValue({
        data: { success: true, enabled: true },
      });

      const { result } = renderHook(() => useToggleTts(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(ttsService.toggleStatus).toHaveBeenCalledWith(true);
    });

    test('обрабатывает ошибки при переключении', async () => {
      const mockError = new Error('Failed to toggle');
      (ttsService.toggleStatus as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useToggleTts(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(true);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(mockError);
    });
  });

  describe('useWhitelistStatus', () => {
    test('загружает статус whitelist корректно', async () => {
      const mockStatus = {
        is_whitelisted: true,
        can_manage_voices: true,
        platform: 'twitch',
      };

      (ttsService.getWhitelistStatus as jest.Mock).mockResolvedValue({
        data: mockStatus,
      });

      const { result } = renderHook(() => useWhitelistStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(mockStatus);
    });
  });
});

