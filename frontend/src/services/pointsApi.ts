import { API_BASE_URL } from '../constants';

type Platform = 'twitch' | 'vk';

interface ApiError extends Error {
  status?: number;
  response?: Response;
}

async function handleJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }
  let errorMessage = fallbackMessage;
  try {
    const errorData = await response.json() as { detail?: string; message?: string };
    errorMessage = errorData?.detail || errorData?.message || fallbackMessage;
  } catch {
    try {
      const text = await response.text();
      errorMessage = text || fallbackMessage;
    } catch {
      // ignore
    }
  }
  const error: ApiError = new Error(errorMessage);
  error.status = response.status;
  error.response = response;
  throw error;
}

class PointsAPI {
  async getRewards<T = unknown>(platform: Platform): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleJsonResponse<T>(response, `Failed to load ${platform} rewards`);
  }

  async createReward<T = unknown>(platform: Platform, rewardData: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/create`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rewardData),
    });
    return handleJsonResponse<T>(response, 'Failed to create reward');
  }

  async updateReward<T = unknown>(platform: Platform, rewardId: string, rewardData: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${rewardId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rewardData),
    });
    return handleJsonResponse<T>(response, 'Failed to update reward');
  }

  async deleteReward<T = unknown>(platform: Platform, rewardId: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${rewardId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleJsonResponse<T>(response, 'Failed to delete reward');
  }

  async toggleReward<T = unknown>(platform: Platform, rewardId: string, isEnabled: boolean): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${rewardId}/toggle`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: isEnabled }),
    });
    return handleJsonResponse<T>(response, 'Failed to toggle reward');
  }

  async getVKDemands<T = unknown>(): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/vk/demands`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleJsonResponse<T>(response, 'Failed to load VK demands');
  }

  async processVKDemands<T = unknown>(action: 'accept' | 'reject', demandIds: string[]): Promise<T> {
    const response = await fetch(`${API_BASE_URL}/api/points/rewards/vk/demands/process`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, demand_ids: demandIds }),
    });
    return handleJsonResponse<T>(response, 'Failed to process demands');
  }
}

export const pointsApi = new PointsAPI();
export default pointsApi;


