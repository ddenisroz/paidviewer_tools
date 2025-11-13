import { logger } from '../../utils/prodLogger';

declare global {
  interface Window {
    WidgetConfigManager: WidgetConfigManager;
  }
}

type WidgetType = 'chat' | 'lootbox' | string;

class WidgetConfigManager {
  private configs: Map<string, any>;
  private defaultConfigs: Map<string, any>;

  constructor() {
    this.configs = new Map();
    this.defaultConfigs = new Map();
  }

  async loadConfig(widgetType: WidgetType, configId: string = 'default', userId: string | number | null = null): Promise<any> {
    try {
      const cacheKey = `${widgetType}_${configId}_${userId || 'default'}`;
      if (this.configs.has(cacheKey)) {
        return this.configs.get(cacheKey);
      }
      let url = `/api/widgets/${widgetType}/config/${configId}`;
      if (userId) url += `?user_id=${userId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const config = (data as any).config || data;
        this.configs.set(cacheKey, config);
        return config;
      }
    } catch {
      // Fallback to default
    }
    return this.getDefaultConfig(widgetType);
  }

  async saveConfig(widgetType: WidgetType, config: any, configId: string | null = null, userId: string | number | null = null): Promise<any> {
    try {
      const response = await fetch(`/api/widgets/${widgetType}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: configId, widget_type: widgetType, config }),
      });
      if (response.ok) {
        const result = await response.json();
        const cacheKey = `${widgetType}_${(result as any).id}_${userId || 'default'}`;
        this.configs.set(cacheKey, config);
        return result;
      }
    } catch (error) {
      logger.error('Error saving config:', error);
      throw error;
    }
  }

  getDefaultConfig(widgetType: WidgetType): any {
    if (this.defaultConfigs.has(widgetType)) {
      return this.defaultConfigs.get(widgetType);
    }
    let defaultConfig: any;
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
          colors: { moderator: '#00ff00', vip: '#ff6b6b', subscriber: '#4ecdc4', normal: '#ffffff' },
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
          colors: { common: '#9CA3AF', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B' },
        };
        break;
      default:
        defaultConfig = {};
    }
    this.defaultConfigs.set(widgetType, defaultConfig);
    return defaultConfig;
  }

  applyConfig(config: Record<string, any>, prefix: string = ''): void {
    const root = document.documentElement;
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
          const cssVar = `--${prefix}${key}-${subKey}`;
          root.style.setProperty(cssVar, String(subValue));
        });
      } else {
        const cssVar = `--${prefix}${key}`;
        root.style.setProperty(cssVar, String(value));
      }
    });
  }

  exportConfig(config: any, filename: string = 'widget-config.json'): void {
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  importConfig(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(String(e.target?.result));
          resolve(config);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }

  clearCache(): void {
    this.configs.clear();
  }
}

window.WidgetConfigManager = new WidgetConfigManager();

export default WidgetConfigManager;


