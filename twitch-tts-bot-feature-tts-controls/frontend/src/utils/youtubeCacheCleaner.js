/**
 * Утилита для очистки кеша и куки YouTube
 */

export const clearYouTubeCache = () => {
    try {
        // Очищаем localStorage от YouTube данных
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
            if (key.includes('youtube') || 
                key.includes('yt') || 
                key.includes('google') ||
                key.includes('yt-') ||
                key.includes('yt_') ||
                key.includes('youtube-') ||
                key.includes('youtube_')) {
                localStorage.removeItem(key);
                // Removed localStorage key:', key);
            }
        });
        
        // Очищаем sessionStorage
        const sessionStorageKeys = Object.keys(sessionStorage);
        sessionStorageKeys.forEach(key => {
            if (key.includes('youtube') || 
                key.includes('yt') || 
                key.includes('google') ||
                key.includes('yt-') ||
                key.includes('yt_') ||
                key.includes('youtube-') ||
                key.includes('youtube_')) {
                sessionStorage.removeItem(key);
                // Removed sessionStorage key:', key);
            }
        });
        
        // Очищаем IndexedDB (если есть)
        if ('indexedDB' in window) {
            try {
                indexedDB.deleteDatabase('yt-player');
                indexedDB.deleteDatabase('youtube-player');
                indexedDB.deleteDatabase('google-player');
            } catch (error) {
                console.warn('Error clearing IndexedDB:', error);
            }
        }
        
        // Очищаем куки (если возможно)
        try {
            document.cookie.split(";").forEach(cookie => {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                if (name.includes('youtube') || 
                    name.includes('yt') || 
                    name.includes('google') ||
                    name.includes('yt-') ||
                    name.includes('yt_') ||
                    name.includes('youtube-') ||
                    name.includes('youtube_')) {
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.youtube.com";
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.google.com";
                    // Removed cookie:', name);
                }
            });
        } catch (error) {
            console.warn('Error clearing cookies:', error);
        }
        
        // YouTube cache and cookies cleared successfully');
        return true;
    } catch (error) {
        console.error('Error clearing YouTube cache:', error);
        return false;
    }
};

export default clearYouTubeCache;
