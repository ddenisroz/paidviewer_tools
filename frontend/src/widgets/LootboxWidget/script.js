class LootboxWidget {
    constructor() {
        this.config = null;
        this.ws = null;
        this.isAnimating = false;
        this.animationFrames = {
            common: ['closed.png', 'opening1.png', 'opening2.png', 'opened.png'],
            rare: ['closed.png', 'opening1.png', 'opening2.png', 'opening3.png', 'opened.png'],
            epic: ['closed.png', 'opening1.png', 'opening2.png', 'opening3.png', 'opening4.png', 'opened.png'],
            legendary: ['closed.png', 'opening1.png', 'opening2.png', 'opening3.png', 'opening4.png', 'opening5.png', 'opened.png']
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Получаем user_id из URL параметров
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user');
            
            // Загружаем конфигурацию
            this.config = await this.loadConfig(userId);
            
            // Применяем настройки
            this.applyConfig();
            
            // Подключаемся к WebSocket
            this.connectWebSocket(userId);
            
            // Добавляем тестовую кнопку для демонстрации
            this.addTestControls();
            
        } catch (error) {
            console.error('Error initializing lootbox widget:', error);
        }
    }
    
    async loadConfig(userId) {
        const urlParams = new URLSearchParams(window.location.search);
        const configId = urlParams.get('config') || 'default';
        
        try {
            let url = `/api/widgets/lootbox/config/${configId}`;
            if (userId) {
                url += `?user_id=${userId}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.config;
            }
        } catch (error) {
            // Using default config');
        }
        
        return this.getDefaultConfig();
    }
    
    getDefaultConfig() {
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
            colors: {
                common: '#9CA3AF',
                rare: '#3B82F6',
                epic: '#8B5CF6',
                legendary: '#F59E0B'
            }
        };
    }
    
    applyConfig() {
        const config = this.config;
        
        // Применяем CSS переменные
        window.WidgetConfigManager.applyConfig(config);
        
        // Настраиваем отображение эффектов
        document.documentElement.style.setProperty('--show-particles', config.showParticles ? '1' : '0');
        document.documentElement.style.setProperty('--show-glow', config.showGlow ? '1' : '0');
    }
    
    connectWebSocket(userId) {
        const wsBaseUrl = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
        const wsUrl = `${wsBaseUrl}/ws/lootbox-widget/${userId || 'default'}`;
        this.ws = new window.WidgetWebSocket(wsUrl);
        
        this.ws.on('message', (data) => {
            if (data.type === 'lootbox_opened') {
                this.showLootboxAnimation(data);
            }
        });
        
        this.ws.on('connected', () => {
            // Lootbox widget connected');
        });
        
        this.ws.on('disconnected', () => {
            // Lootbox widget disconnected');
        });
    }
    
    addTestControls() {
        // Добавляем тестовые кнопки для демонстрации
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
            { rarity: 'legendary', username: 'Moderator', reward: '5000 баллов' }
        ];
        
        testCases.forEach(testCase => {
            const button = document.createElement('button');
            button.textContent = `${testCase.rarity.toUpperCase()} - ${testCase.username}`;
            button.style.cssText = `
                padding: 8px 12px;
                background: #333;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            button.onclick = () => this.showLootboxAnimation({
                username: testCase.username,
                rarity: testCase.rarity,
                lootbox_type: testCase.rarity,
                reward: testCase.reward
            });
            testContainer.appendChild(button);
        });
        
        document.body.appendChild(testContainer);
    }
    
    async showLootboxAnimation(data) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        const { username, rarity, lootbox_type, reward } = data;
        
        // Обновляем информацию
        document.getElementById('username').textContent = username;
        document.getElementById('reward').textContent = reward || this.getRandomReward(rarity);
        document.getElementById('rarity').textContent = rarity;
        document.getElementById('rarity').className = `rarity rarity-${rarity}`;
        
        // Настраиваем эффекты по редкости
        const glowElement = document.getElementById('lootbox-glow');
        glowElement.className = `lootbox-glow glow-${rarity}`;
        
        // Воспроизводим звук
        if (this.config.soundEnabled) {
            this.playSound(rarity);
        }
        
        // Запускаем анимацию кадров
        await this.animateFrames(rarity);
        
        // Запускаем эффекты
        this.startEffects();
        
        // Показываем виджет
        document.getElementById('lootbox-container').classList.remove('hidden');
        
        // Скрываем через 5 секунд
        setTimeout(() => {
            this.hideWidget();
        }, 5000);
    }
    
    getRandomReward(rarity) {
        const rewards = {
            common: [
                "100 баллов", "Обычная награда", "Монета", "Зелье здоровья",
                "Простой предмет", "Базовое оружие", "Обычная броня"
            ],
            rare: [
                "500 баллов", "Редкая награда", "Золотая монета", "Зелье маны",
                "Магический предмет", "Редкое оружие", "Синяя броня", "Кристалл"
            ],
            epic: [
                "1000 баллов", "Эпическая награда", "Драгоценный камень", "Эликсир",
                "Легендарный предмет", "Эпическое оружие", "Фиолетовая броня", "Руна силы"
            ],
            legendary: [
                "5000 баллов", "Легендарная награда", "Мифический артефакт", "Божественный эликсир",
                "Уникальный предмет", "Легендарное оружие", "Золотая броня", "Древняя руна"
            ]
        };
        
        const rarityRewards = rewards[rarity] || rewards.common;
        return rarityRewards[Math.floor(Math.random() * rarityRewards.length)];
    }
    
    async animateFrames(rarity) {
        const frames = this.animationFrames[rarity] || this.animationFrames.common;
        const imageElement = document.getElementById('lootbox-image');
        
        for (let i = 0; i < frames.length; i++) {
            imageElement.src = `/images/lootboxes/${rarity}/${frames[i]}`;
            await this.sleep(200); // 200ms между кадрами
        }
    }
    
    startEffects() {
        const container = document.getElementById('lootbox-animation');
        container.classList.add('lootbox-opening');
        
        // Создаем частицы
        if (this.config.showParticles) {
            this.createParticles();
        }
        
        // Убираем класс анимации через время анимации
        setTimeout(() => {
            container.classList.remove('lootbox-opening');
        }, this.config.animationDuration * 1000);
    }
    
    createParticles() {
        const particlesContainer = document.getElementById('lootbox-particles');
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Случайная позиция
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 100 + Math.random() * 50;
            const x = Math.cos(angle) * distance + 100;
            const y = Math.sin(angle) * distance + 100;
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.animationDelay = Math.random() * 0.5 + 's';
            
            particlesContainer.appendChild(particle);
            
            // Удаляем частицу после анимации
            setTimeout(() => {
                particle.remove();
            }, 1500);
        }
    }
    
    playSound(rarity) {
        const audio = document.getElementById('sound-effect');
        const soundMap = {
            common: '/sounds/lootbox_open.mp3',
            rare: '/sounds/rare_sound.mp3',
            epic: '/sounds/epic_sound.mp3',
            legendary: '/sounds/legendary_sound.mp3'
        };
        
        audio.src = soundMap[rarity] || soundMap.common;
        audio.play().catch(e => // Audio play failed:', e));
    }
    
    hideWidget() {
        document.getElementById('lootbox-container').classList.add('hidden');
        this.isAnimating = false;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запускаем виджет
document.addEventListener('DOMContentLoaded', () => {
    new LootboxWidget();
});
