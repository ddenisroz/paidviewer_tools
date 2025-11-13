/**
 * Тесты для TtsContext
 * Проверяет корректность работы TTS контекста после миграции на TypeScript
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TtsProvider, useTts } from '../../context/TtsContext';
import { AuthContext } from '../../context/AuthContext';
import * as ttsQueries from '../../queries/tts/ttsQueries';

// Мокаем React Query hooks
jest.mock('../../queries/tts/ttsQueries', () => ({
  useTtsStatus: jest.fn(),
  useTtsHealth: jest.fn(),
  useToggleTts: jest.fn(),
  useGlobalVoices: jest.fn(),
}));

// Мокаем useLocation
const mockLocation = { pathname: '/dashboard/tts' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => mockLocation,
}));

// Мокаем useToast
jest.mock('../../components/ui/toast', () => ({
  useToast: () => ({
    addToast: jest.fn(),
  }),
}));

// Мокаем useButtonPosition
jest.mock('../../hooks/useButtonPosition', () => ({
  useButtonPosition: () => ({
    getButtonPosition: jest.fn(),
  }),
}));

const mockUser = {
  id: 1,
  username: 'testuser',
  is_guest: false,
};

const createWrapper = (user = mockUser) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{
        user,
        isAuthenticated: true,
        isGuest: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAuthStatus: jest.fn(),
      } as any}>
        <TtsProvider>
          {children}
        </TtsProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('TtsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настройка моков по умолчанию
    (ttsQueries.useTtsStatus as jest.Mock).mockReturnValue({
      data: { data: { enabled: false, is_whitelisted: true } },
      refetch: jest.fn(),
    });
    
    (ttsQueries.useTtsHealth as jest.Mock).mockReturnValue({
      data: { data: { tts_engine_loaded: true } },
      isLoading: false,
    });
    
    (ttsQueries.useToggleTts as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    
    (ttsQueries.useGlobalVoices as jest.Mock).mockReturnValue({
      data: { voices: [] },
    });
  });

  test('предоставляет корректные значения по умолчанию', () => {
    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('ttsEnabled');
    expect(result.current).toHaveProperty('isWhitelisted');
    expect(result.current).toHaveProperty('voices');
    expect(result.current).toHaveProperty('engineStatus');
    expect(result.current).toHaveProperty('isInitialized');
    expect(result.current).toHaveProperty('toggleTts');
    expect(result.current).toHaveProperty('loadVoices');
    expect(result.current).toHaveProperty('initializeTts');
  });

  test('инициализируется при наличии пользователя', async () => {
    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
  });

  test('обновляет ttsEnabled из статуса', async () => {
    (ttsQueries.useTtsStatus as jest.Mock).mockReturnValue({
      data: { data: { enabled: true, is_whitelisted: true } },
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.ttsEnabled).toBe(true);
    });
  });

  test('обновляет engineStatus из health check', async () => {
    (ttsQueries.useTtsHealth as jest.Mock).mockReturnValue({
      data: { data: { tts_engine_loaded: true } },
      isLoading: false,
    });

    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engineStatus.loaded).toBe(true);
    });
  });

  test('toggleTts вызывает mutation', async () => {
    const mockMutate = jest.fn();
    (ttsQueries.useToggleTts as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    (ttsQueries.useTtsHealth as jest.Mock).mockReturnValue({
      data: { data: { tts_engine_loaded: true } },
      isLoading: false,
    });

    (ttsQueries.useTtsStatus as jest.Mock).mockReturnValue({
      data: { data: { enabled: false, is_whitelisted: true } },
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engineStatus.loaded).toBe(true);
    });

    await result.current.toggleTts();

    expect(mockMutate).toHaveBeenCalledWith(true);
  });

  test('не вызывает toggleTts если движок не готов', async () => {
    const mockMutate = jest.fn();
    (ttsQueries.useToggleTts as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    (ttsQueries.useTtsHealth as jest.Mock).mockReturnValue({
      data: { data: { tts_engine_loaded: false } },
      isLoading: false,
    });

    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.engineStatus.loaded).toBe(false);
    });

    await result.current.toggleTts();

    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('обрабатывает событие tts-status-changed', async () => {
    const { result } = renderHook(() => useTts(), {
      wrapper: createWrapper(),
    });

    const event = new CustomEvent('tts-status-changed', {
      detail: { enabled: true },
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(result.current.ttsEnabled).toBe(true);
    });
  });
});

