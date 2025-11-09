/**
 * Commands Service - инкапсуляция всех Commands API вызовов
 */
import { apiClient } from '../client';

/**
 * Commands Service
 */
export const commandsService = {
  /**
   * Получить все команды
   * @returns {Promise<AxiosResponse>}
   */
  async getCommands() {
    return apiClient.get('/api/commands');
  },

  /**
   * Создать команду
   * @param {Object} command - Данные команды
   * @returns {Promise<AxiosResponse>}
   */
  async createCommand(command) {
    return apiClient.post('/api/commands', command);
  },

  /**
   * Создать override для команды
   * @param {Object} override - Данные override
   * @returns {Promise<AxiosResponse>}
   */
  async createOverride(override) {
    return apiClient.post('/api/commands/override', override);
  },

  /**
   * Обновить команду
   * @param {number} commandId - ID команды
   * @param {Object} command - Данные команды
   * @returns {Promise<AxiosResponse>}
   */
  async updateCommand(commandId, command) {
    return apiClient.put(`/api/commands/${commandId}`, command);
  },

  /**
   * Удалить команду
   * @param {number} commandId - ID команды
   * @returns {Promise<AxiosResponse>}
   */
  async deleteCommand(commandId) {
    return apiClient.delete(`/api/commands/${commandId}`);
  },

  /**
   * Переключить команду
   * @param {string} commandName - Имя команды
   * @param {Object} data - Данные для обновления
   * @returns {Promise<AxiosResponse>}
   */
  async toggleCommand(commandName, data) {
    // Backend использует PUT для обновления команд
    return apiClient.put(`/api/commands/${commandName}`, data);
  },
};

