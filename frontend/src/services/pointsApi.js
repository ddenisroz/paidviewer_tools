import { API_BASE_URL } from '../constants';
import { API_PATHS, TEXT } from '../constants/uiConstants';

/**
 * Centralized API service for Channel Points management
 * Handles both Twitch and VK Live platforms
 */
class PointsAPI {
    /**
     * Get all rewards for a platform
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @returns {Promise<Object>} Response with rewards array
     */
    async getRewards(platform) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Failed to load ${platform} rewards`);
        }

        return response.json();
    }

    /**
     * Create a new reward
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @param {Object} rewardData - Reward data (title, description, cost, etc.)
     * @returns {Promise<Object>} Created reward
     */
    async createReward(platform, rewardData) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewardData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create reward');
        }

        return response.json();
    }

    /**
     * Update an existing reward
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @param {string} rewardId - Reward ID
     * @param {Object} rewardData - Updated reward data
     * @returns {Promise<Object>} Updated reward
     */
    async updateReward(platform, rewardId, rewardData) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${rewardId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewardData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update reward');
        }

        return response.json();
    }

    /**
     * Delete a reward
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @param {string} rewardId - Reward ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteReward(platform, rewardId) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/${rewardId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete reward');
        }

        return response.json();
    }

    /**
     * Toggle reward enabled status (VK Live only)
     * @param {string} rewardId - Reward ID
     * @param {boolean} isEnabled - New enabled status
     * @returns {Promise<Object>} Toggle result
     */
    async toggleReward(rewardId, isEnabled) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/vk/${rewardId}/toggle`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_enabled: isEnabled })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to toggle reward');
        }

        return response.json();
    }

    /**
     * Get pending redemptions for a platform
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @returns {Promise<Object>} Redemptions list
     */
    async getRedemptions(platform) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/redemptions`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Failed to load ${platform} redemptions`);
        }

        return response.json();
    }

    /**
     * Process a redemption (approve/reject)
     * @param {'twitch'|'vk'} platform - Platform identifier
     * @param {string} redemptionId - Redemption ID
     * @param {'FULFILLED'|'CANCELED'} status - New status
     * @returns {Promise<Object>} Processing result
     */
    async processRedemption(platform, redemptionId, status) {
        const response = await fetch(`${API_BASE_URL}/api/points/rewards/${platform}/redemptions/${redemptionId}/process`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to process redemption');
        }

        return response.json();
    }
}

export const pointsApi = new PointsAPI();
export default pointsApi;

