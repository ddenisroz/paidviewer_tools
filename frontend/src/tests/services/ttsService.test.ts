/**
 * Тесты для ttsService
 * Проверяет корректность работы сервиса после миграции на TypeScript
 */

import { ttsService } from '../../services/api/services/ttsService';
import { ttsApiClient } from '../../services/api/client';

// Мокаем ttsApiClient
jest.mock('../../services/api/client', () => ({
  ttsApiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('ttsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    test('получает статус TTS корректно', async () => {
      const mockResponse = {
        data: {
          enabled: true,
          is_whitelisted: true,
          platform: 'twitch',
        },
      };

      (ttsApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ttsService.getStatus('testchannel');

      expect(ttsApiClient.get).toHaveBeenCalledWith('/api/tts/status', {
        params: { channel_name: 'testchannel' },
      });
      expect(result).toEqual(mockResponse);
    });

    test('обрабатывает ошибки корректно', async () => {
      const mockError = new Error('Failed to fetch status');
      (ttsApiClient.get as jest.Mock).mockRejectedValue(mockError);

      await expect(ttsService.getStatus('testchannel')).rejects.toThrow('Failed to fetch status');
    });
  });

  describe('toggleStatus', () => {
    test('переключает статус TTS корректно', async () => {
      const mockResponse = {
        data: {
          success: true,
          enabled: true,
        },
      };

      (ttsApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ttsService.toggleStatus(true);

      expect(ttsApiClient.post).toHaveBeenCalledWith('/api/tts/toggle', {
        enabled: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getWhitelistStatus', () => {
    test('получает статус whitelist корректно', async () => {
      const mockResponse = {
        data: {
          is_whitelisted: true,
          can_manage_voices: true,
          platform: 'twitch',
        },
      };

      (ttsApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ttsService.getWhitelistStatus();

      expect(ttsApiClient.get).toHaveBeenCalledWith('/api/tts/whitelist/status');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getEnabledVoices', () => {
    test('получает включенные голоса корректно', async () => {
      const mockResponse = {
        data: {
          enabled_voice_ids: [1, 2, 3],
        },
      };

      (ttsApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ttsService.getEnabledVoices(1);

      expect(ttsApiClient.get).toHaveBeenCalledWith('/api/tts/user/1/enabled-voices');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('saveEnabledVoices', () => {
    test('сохраняет включенные голоса корректно', async () => {
      const mockResponse = {
        data: {
          success: true,
        },
      };

      (ttsApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ttsService.saveEnabledVoices(1, [1, 2, 3]);

      expect(ttsApiClient.post).toHaveBeenCalledWith('/api/tts/user/1/enabled-voices', {
        voice_ids: [1, 2, 3],
      });
      expect(result).toEqual(mockResponse);
    });
  });
});

