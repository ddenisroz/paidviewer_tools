// frontend/src/utils/oauthRedirect.js
/**
 * Утилиты для сохранения и восстановления URL перед OAuth редиректом
 * 
 * Использует localStorage для сохранения текущей страницы перед OAuth,
 * чтобы вернуть пользователя обратно после успешной авторизации.
 */

const RETURN_URL_KEY = 'oauth_return_url';
const RETURN_URL_TIMESTAMP = 'oauth_return_timestamp';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 минут

/**
 * Сохранить текущий URL перед OAuth редиректом
 */
export function saveReturnUrl() {
    try {
        const currentPath = window.location.pathname + window.location.search;
        
        // Не сохраняем если мы уже на главной или логине
        if (currentPath === '/dashboard' || currentPath === '/login' || currentPath === '/' || currentPath.startsWith('/dashboard?')) {
            console.log('🔄 [OAuth] Skipping save - already on main page or has query params');
            return;
        }
        
        localStorage.setItem(RETURN_URL_KEY, currentPath);
        localStorage.setItem(RETURN_URL_TIMESTAMP, Date.now().toString());
        console.log('💾 [OAuth] Saved return URL:', currentPath);
    } catch (error) {
        console.error('❌ [OAuth] Failed to save return URL:', error);
    }
}

/**
 * Получить и удалить сохраненный URL
 * @returns {string|null} Сохраненный URL или null
 */
export function getAndClearReturnUrl() {
    try {
        const returnUrl = localStorage.getItem(RETURN_URL_KEY);
        const timestamp = localStorage.getItem(RETURN_URL_TIMESTAMP);
        
        // Очищаем сразу
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_TIMESTAMP);
        
        if (!returnUrl) {
            console.log('ℹ️ [OAuth] No saved return URL');
            return null;
        }
        
        // Проверяем возраст
        if (timestamp) {
            const age = Date.now() - parseInt(timestamp, 10);
            if (age > MAX_AGE_MS) {
                console.log('⏰ [OAuth] Return URL expired, ignoring');
                return null;
            }
        }
        
        // Не возвращаем на /dashboard или корень (включая query params)
        if (returnUrl === '/dashboard' || returnUrl === '/' || returnUrl.startsWith('/dashboard?') || returnUrl.startsWith('/login')) {
            console.log('🔄 [OAuth] Return URL is main page or login, ignoring');
            return null;
        }
        
        console.log('✅ [OAuth] Retrieved return URL:', returnUrl);
        return returnUrl;
    } catch (error) {
        console.error('❌ [OAuth] Failed to get return URL:', error);
        return null;
    }
}

/**
 * Очистить сохраненный URL (если OAuth отменен)
 */
export function clearReturnUrl() {
    try {
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_TIMESTAMP);
        console.log('🗑️ [OAuth] Cleared return URL');
    } catch (error) {
        console.error('❌ [OAuth] Failed to clear return URL:', error);
    }
}

