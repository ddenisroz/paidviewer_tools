/**
 * @deprecated Этот файл оставлен для обратной совместимости
 * Используйте новые сервисы из services/api/services/
 * 
 * Миграция:
 * - botService -> apiClient из services/api/client
 * - ttsService -> ttsService из services/api/services/ttsService
 * - Функции -> сервисы из services/api/services/
 */

import { apiClient, ttsApiClient } from './api/client';
import {
  ttsService as newTtsService,
  youtubeService,
  dropsService,
  commandsService,
  streamService,
  authService,
  pointsService,
  chatService,
  integrationsService,
  chatboxService,
} from './api/services';

// Экспорт для обратной совместимости
export const botService = apiClient;
export const ttsService = ttsApiClient;

// Экспорт TTS_SERVICE_URL для обратной совместимости
export { TTS_SERVICE_URL } from '../constants';

// Экспорт старых функций через новые сервисы
export const loginTwitch = () => authService.loginWithTwitch();
export const loginVk = () => authService.loginWithVk();
export const logout = () => authService.logout();
export const getUser = () => authService.getCurrentUser();

export const connectBot = () => chatService.connectBot();
export const disconnectBot = () => chatService.disconnectBot();
export const getBotStatus = () => chatService.getBotStatus();

export const enableTts = () => newTtsService.enable();
export const disableTts = () => newTtsService.disable();
export const getTtsStatus = (channelName = null) => newTtsService.getStatus(channelName);
export const generateObsUrl = () => newTtsService.generateObsUrl();
export const getTtsHealth = () => newTtsService.getHealth();
export const getGlobalVoices = () => newTtsService.getGlobalVoices();

// Экспорт всех сервисов для постепенной миграции
export {
  apiClient,
  ttsApiClient,
  newTtsService as ttsServiceNew,
  youtubeService,
  dropsService,
  commandsService,
  streamService,
  authService,
  pointsService,
  chatService,
  integrationsService,
  chatboxService,
};

// Экспорт для совместимости
export const microservicesAPI = apiClient;

