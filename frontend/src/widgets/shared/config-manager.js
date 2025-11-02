import { logger } from '../../utils/prodLogger';

/**
 * Менеджер конфигураций для виджетов
 */
class WidgetConfigManager {
    constructor() {
        this.configs = new Map();
        this.defaultConfigs = new Map();
    }
    
    /**
     * Загружает конфигурацию виджета
     */
    async loadConfig(widgetType, configId = 'default', userId = null) {
        try {
            // Сначала проверяем кэш
            const cacheKey = `${widgetType}_${configId}_${userId || 'default'}`;
            if (this.configs.has(cacheKey)) {
                return this.configs.get(cacheKey);
            }
            
            // Загружаем с сервера
            let url = `/api/widgets/${widgetType}/config/${configId}`;
            if (userId) {
                url += `?user_id=${userId}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const config = data.config || data;
                this.configs.set(cacheKey, config);
                return config;
            }
        } catch (error) {
            // Using default config
        }
        
        // Возвращаем конфигурацию по умолчанию
        return this.getDefaultConfig(widgetType);
    }
    
    /**
     * Сохраняет конфигурацию виджета
     */
    async saveConfig(widgetType, config, configId = null, userId = null) {
        try {
            const response = await fetch(`/api/widgets/${widgetType}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: configId,
                    widget_type: widgetType,
                    config: config
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                const cacheKey = `${widgetType}_${result.id}_${userId || 'default'}`;
                this.configs.set(cacheKey, config);
                return result;
            }
        } catch (error) {
            logger.error('Error saving config:', error);
            throw error;
        }
    }
    
    /**
     * Получает конфигурацию по умолчанию для типа виджета
     */
    getDefaultConfig(widgetType) {
        if (this.defaultConfigs.has(widgetType)) {
            return this.defaultConfigs.get(widgetType);
        }
        
        let defaultConfig;
        
        switch (widgetType) {
            case 'chat':
                defaultConfig = {
                    width: 400,
                    height: 300,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backgroundImage: 'none',
                    borderRadius: 8,
                    borderColor: '#333',
                    borderWidth: 2,
                    messageBg: 'rgba(255, 255, 255, 0.1)',
                    messageBorderRadius: 4,
                    messageMargin: 4,
                    messagePadding: 8,
                    fontFamily: 'Arial, sans-serif',
                    fontSize: 14,
                    fontWeight: 'normal',
                    textColor: '#ffffff',
                    animationDuration: 0.3,
                    animationType: 'slide-in',
                    maxMessages: 50,
                    showTimestamps: false,
                    showUserRoles: true,
                    colors: {
                        moderator: '#00ff00',
                        vip: '#ff6b6b',
                        subscriber: '#4ecdc4',
                        normal: '#ffffff'
                    }
                };
                break;
                
            case 'lootbox':
                defaultConfig = {
                    width: 400,
                    height: 300,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderRadius: 8,
                    borderColor: '#333',
                    borderWidth: 2,
                    animationDuration: 2.0,
                    showParticles: true,
                    showGlow: true,
                    soundEnabled: true,
                    colors: {
                        common: '#9CA3AF',
                        rare: '#3B82F6',
                        epic: '#8B5CF6',
                        legendary: '#F59E0B'
                    }
                };
                break;
                
            default:
                defaultConfig = {};
        }
        
        this.defaultConfigs.set(widgetType, defaultConfig);
        return defaultConfig;
    }
    
    /**
     * Применяет конфигурацию к CSS переменным
     */
    applyConfig(config, prefix = '') {
        const root = document.documentElement;
        
        Object.entries(config).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Обрабатываем вложенные объекты (например, colors)
                Object.entries(value).forEach(([subKey, subValue]) => {
                    const cssVar = `--${prefix}${key}-${subKey}`;
                    root.style.setProperty(cssVar, subValue);
                });
            } else {
                // Обрабатываем простые значения
                const cssVar = `--${prefix}${key}`;
                root.style.setProperty(cssVar, value);
            }
        });
    }
    
    /**
     * Экспортирует конфигурацию в JSON
     */
    exportConfig(config, filename = 'widget-config.json') {
        const configJson = JSON.stringify(config, null, 2);
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * Импортирует конфигурацию из файла
     */
    importConfig(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    resolve(config);
                } catch (error) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }
    
    /**
     * Очищает кэш конфигураций
     */
    clearCache() {
        this.configs.clear();
    }
}

// Создаем глобальный экземпляр
window.WidgetConfigManager = new WidgetConfigManager();
