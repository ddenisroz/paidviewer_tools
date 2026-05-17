import { logger } from '@/shared/utils/prodLogger';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | string;
/* eslint-disable @typescript-eslint/no-non-null-assertion */

interface LootboxConfig {
    width: number;
    height: number;
    backgroundColor: string;
    borderRadius: number;
    borderColor: string;
    borderWidth: number;
    animationDuration: number;
    showParticles: boolean;
    showGlow: boolean;
    soundEnabled: boolean;
    colors: Record<'common' | 'rare' | 'epic' | 'legendary', string>;
}

class LootboxWidget {
    private config: LootboxConfig | null;
    private ws: { on: (event: string, handler: (data?: Record<string, unknown>) => void) => void } | null;
    private isAnimating: boolean;
    private animationFrames: Record<Rarity, string[]>;

    constructor() {
        this.config = null;
        this.ws = null;
        this.isAnimating = false;
        this.animationFrames = {
            common: ['closed.png', 'opening1.png', 'opening2.png', 'opened.png'],
            rare: ['closed.png', 'opening1.png', 'opening2.png', 'opening3.png', 'opened.png'],
            epic: ['closed.png', 'opening1.png', 'opening2.png', 'opening3.png', 'opening4.png', 'opened.png'],
            legendary: [
                'closed.png',
                'opening1.png',
                'opening2.png',
                'opening3.png',
                'opening4.png',
                'opening5.png',
                'opened.png',
            ],
        };
        this.init();
    }

    private async init(): Promise<void> {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user');
            this.config = await this.loadConfig(userId);
            this.applyConfig();
            this.connectWebSocket(userId);
            this.addTestControls();
        } catch (error) {
            logger.error('Error initializing lootbox widget:', error);
        }
    }

    private async loadConfig(userId: string | null): Promise<LootboxConfig> {
        const urlParams = new URLSearchParams(window.location.search);
        const configId = urlParams.get('config') || 'default';
        try {
            let url = `/api/widgets/lootbox/config/${configId}`;
            if (userId) url += `?user_id=${userId}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return (data.config || data) as LootboxConfig;
            }
        } catch {
            // fallback
        }
        return this.getDefaultConfig();
    }

    private getDefaultConfig(): LootboxConfig {
        return {
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
    }

    private applyConfig(): void {
        const config = this.config!;
        const WidgetConfigManagerInstance = (
            window as Window & { WidgetConfigManager?: { applyConfig: (config: Record<string, unknown>) => void } }
        ).WidgetConfigManager;
        if (WidgetConfigManagerInstance) {
            WidgetConfigManagerInstance.applyConfig(config as unknown as Record<string, unknown>);
        }
        document.documentElement.style.setProperty('--show-particles', config.showParticles ? '1' : '0');
        document.documentElement.style.setProperty('--show-glow', config.showGlow ? '1' : '0');
    }

    private connectWebSocket(userId: string | null): void {
        const wsBaseUrl =
            window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
        const wsUrl = `${wsBaseUrl}/ws/lootbox-widget/${userId || 'default'}`;
        const WidgetWebSocketClass = (
            window as Window & {
                WidgetWebSocket?: new (url: string) => {
                    on: (event: string, handler: (data?: Record<string, unknown>) => void) => void;
                };
            }
        ).WidgetWebSocket;
        if (!WidgetWebSocketClass) {
            logger.error('WidgetWebSocket not available');
            return;
        }
        this.ws = new WidgetWebSocketClass(wsUrl);
        if (this.ws) {
            this.ws.on('message', (data?: Record<string, unknown>) => {
                if (data && data.type === 'lootbox_opened') {
                    this.showLootboxAnimation(data);
                }
            });
        }
    }

    private addTestControls(): void {
        const testContainer = document.createElement('div');
        testContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 1000;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    `;
        const testCases = [
            { rarity: 'common', username: 'Viewer123', reward: '100 баллов' },
            { rarity: 'rare', username: 'VIP_User', reward: '500 баллов' },
            { rarity: 'epic', username: 'Subscriber', reward: '1000 баллов' },
            { rarity: 'legendary', username: 'Moderator', reward: '5000 баллов' },
        ];
        testCases.forEach((testCase) => {
            const button = document.createElement('button');
            button.textContent = `${String(testCase.rarity).toUpperCase()} - ${testCase.username}`;
            button.style.cssText = `
        padding: 8px 12px;
        background: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
            button.onclick = () =>
                this.showLootboxAnimation({
                    username: testCase.username,
                    rarity: testCase.rarity,
                    lootbox_type: testCase.rarity,
                    reward: testCase.reward,
                });
            testContainer.appendChild(button);
        });
        document.body.appendChild(testContainer);
    }

    private async showLootboxAnimation(data: Record<string, unknown>): Promise<void> {
        if (this.isAnimating) return;
        this.isAnimating = true;
        const username = String(data.username || 'Unknown');
        const rarity = String(data.rarity || 'common') as Rarity;
        const reward = String(data.reward || this.getRandomReward(rarity));

        const usernameEl = document.getElementById('username') as HTMLElement | null;
        const rewardEl = document.getElementById('reward') as HTMLElement | null;
        const rarityEl = document.getElementById('rarity') as HTMLElement | null;
        const glowElement = document.getElementById('lootbox-glow') as HTMLElement | null;

        if (usernameEl) usernameEl.textContent = username;
        if (rewardEl) rewardEl.textContent = reward;
        if (rarityEl) {
            rarityEl.textContent = rarity;
            rarityEl.className = `rarity rarity-${rarity}`;
        }
        if (glowElement) {
            glowElement.className = `lootbox-glow glow-${rarity}`;
        }

        if (this.config!.soundEnabled) {
            this.playSound(rarity);
        }
        await this.animateFrames(rarity);
        this.startEffects();
        const containerEl = document.getElementById('lootbox-container');
        if (containerEl) {
            containerEl.classList.remove('hidden');
        }
        setTimeout(() => {
            this.hideWidget();
        }, 5000);
    }

    private getRandomReward(rarity: Rarity): string {
        const rewards: Record<Rarity, string[]> = {
            common: [
                '100 баллов',
                'Обычная награда',
                'Монета',
                'Зелье здоровья',
                'Простой предмет',
                'Базовое оружие',
                'Обычная броня',
            ],
            rare: [
                '500 баллов',
                'Редкая награда',
                'Золотая монета',
                'Зелье маны',
                'Магический предмет',
                'Редкое оружие',
                'Синяя броня',
                'Кристалл',
            ],
            epic: [
                '1000 баллов',
                'Эпическая награда',
                'Драгоценный камень',
                'Эликсир',
                'Легендарный предмет',
                'Эпическое оружие',
                'Фиолетовая броня',
                'Руна силы',
            ],
            legendary: [
                '5000 баллов',
                'Легендарная награда',
                'Мифический артефакт',
                'Божественный эликсир',
                'Уникальный предмет',
                'Легендарное оружие',
                'Золотая броня',
                'Древняя руна',
            ],
        };
        const rarityRewards = rewards[rarity] || rewards.common;
        return rarityRewards[Math.floor(Math.random() * rarityRewards.length)];
    }

    private async animateFrames(rarity: Rarity): Promise<void> {
        const frames = this.animationFrames[rarity] || this.animationFrames.common;
        const imageElement = document.getElementById('lootbox-image') as HTMLImageElement;

        // [OK] OPTIMIZATION: Preload all frames for smooth animation
        const preloadedImages = await this.preloadFrames(rarity, frames);

        for (let i = 0; i < frames.length; i++) {
            // Use preloaded images for instant display
            if (preloadedImages[i]) {
                imageElement.src = preloadedImages[i].src;
            } else {
                imageElement.src = `/images/lootboxes/${rarity}/${frames[i]}`;
            }
            await this.sleep(200);
        }
    }

    private async preloadFrames(rarity: Rarity, frames: string[]): Promise<HTMLImageElement[]> {
        // [OK] OPTIMIZATION: Preload images in parallel for faster loading
        const promises = frames.map((frame) => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load ${frame}`));
                img.src = `/images/lootboxes/${rarity}/${frame}`;
            });
        });

        try {
            return await Promise.all(promises);
        } catch (error) {
            logger.error('Error preloading frames:', error);
            return [];
        }
    }

    private startEffects(): void {
        const container = document.getElementById('lootbox-animation') as HTMLElement;
        container.classList.add('lootbox-opening');
        if (this.config!.showParticles) {
            this.createParticles();
        }
        setTimeout(() => {
            container.classList.remove('lootbox-opening');
        }, this.config!.animationDuration * 1000);
    }

    private createParticles(): void {
        const particlesContainer = document.getElementById('lootbox-particles') as HTMLElement;
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 100 + Math.random() * 50;
            const x = Math.cos(angle) * distance + 100;
            const y = Math.sin(angle) * distance + 100;
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.animationDelay = `${Math.random() * 0.5}s`;
            particlesContainer.appendChild(particle);
            setTimeout(() => {
                particle.remove();
            }, 1500);
        }
    }

    private playSound(rarity: Rarity): void {
        const audio = document.getElementById('sound-effect') as HTMLAudioElement;
        const soundMap: Record<string, string> = {
            common: '/sounds/lootbox_open.mp3',
            rare: '/sounds/rare_sound.mp3',
            epic: '/sounds/epic_sound.mp3',
            legendary: '/sounds/legendary_sound.mp3',
        };
        audio.src = soundMap[rarity] || soundMap.common;
        audio.play().catch(() => {});
    }

    private hideWidget(): void {
        const containerEl = document.getElementById('lootbox-container');
        if (containerEl) {
            containerEl.classList.add('hidden');
        }
        this.isAnimating = false;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LootboxWidget();
});
