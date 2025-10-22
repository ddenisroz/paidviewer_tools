// Утилиты для работы с лутбоксами на основе картинок
import { API_BASE_URL } from '../constants';

/**
 * Получает набор картинок для анимации лутбокса по типу
 * @param {string} lootboxType - Тип лутбокса (common, rare, epic, legendary)
 * @returns {Array} - Массив путей к картинкам
 */
export const getLootboxImages = (lootboxType) => {
  const imageSets = {
    common: [
      '/src/images/lootboxes/common/closed.png',
      '/src/images/lootboxes/common/opening1.png',
      '/src/images/lootboxes/common/opening2.png',
      '/src/images/lootboxes/common/opened.png'
    ],
    rare: [
      '/src/images/lootboxes/rare/closed.png',
      '/src/images/lootboxes/rare/opening1.png',
      '/src/images/lootboxes/rare/opening2.png',
      '/src/images/lootboxes/rare/opening3.png',
      '/src/images/lootboxes/rare/opened.png'
    ],
    epic: [
      '/src/images/lootboxes/epic/closed.png',
      '/src/images/lootboxes/epic/opening1.png',
      '/src/images/lootboxes/epic/opening2.png',
      '/src/images/lootboxes/epic/opening3.png',
      '/src/images/lootboxes/epic/opening4.png',
      '/src/images/lootboxes/epic/opened.png'
    ],
    legendary: [
      '/src/images/lootboxes/legendary/closed.png',
      '/src/images/lootboxes/legendary/opening1.png',
      '/src/images/lootboxes/legendary/opening2.png',
      '/src/images/lootboxes/legendary/opening3.png',
      '/src/images/lootboxes/legendary/opening4.png',
      '/src/images/lootboxes/legendary/opening5.png',
      '/src/images/lootboxes/legendary/opened.png'
    ]
  };

  return imageSets[lootboxType] || imageSets.common;
};

/**
 * Получает CSS классы для эффектов в зависимости от редкости
 * @param {string} rarity - Редкость лутбокса
 * @returns {string} - CSS классы
 */
export const getRarityEffects = (rarity) => {
  const effects = {
    common: '',
    rare: 'lootbox-glow-rare',
    epic: 'lootbox-glow-epic',
    legendary: 'lootbox-glow-legendary'
  };
  
  return effects[rarity] || '';
};

/**
 * Получает размер лутбокса в зависимости от контекста
 * @param {string} context - Контекст отображения (grid, modal, carousel)
 * @returns {string} - Размер лутбокса
 */
export const getLootboxSize = (context) => {
  const sizes = {
    grid: 'medium',
    modal: 'large',
    carousel: 'small',
    compact: 'small'
  };
  
  return sizes[context] || 'medium';
};

/**
 * Создает конфигурацию анимации для лутбокса
 * @param {Object} lootbox - Объект лутбокса
 * @param {string} context - Контекст отображения
 * @returns {Object} - Конфигурация анимации
 */
export const createLootboxImageConfig = (lootbox, context = 'grid') => {
  return {
    images: getLootboxImages(lootbox.rarity),
    title: lootbox.name || 'Лутбокс',
    rarity: lootbox.rarity || 'common',
    size: getLootboxSize(context),
    effects: getRarityEffects(lootbox.rarity)
  };
};

/**
 * Группирует лутбоксы по редкости для отображения
 * @param {Array} lootboxes - Массив лутбоксов
 * @returns {Object} - Группированные лутбоксы
 */
export const groupLootboxesByRarity = (lootboxes) => {
  return lootboxes.reduce((groups, lootbox) => {
    const rarity = lootbox.rarity || 'common';
    if (!groups[rarity]) {
      groups[rarity] = [];
    }
    groups[rarity].push(lootbox);
    return groups;
  }, {});
};

/**
 * Создает анимацию открытия лутбокса
 * @param {HTMLElement} element - DOM элемент лутбокса
 * @param {Function} onComplete - Callback при завершении анимации
 */
export const animateLootboxOpening = (element, onComplete) => {
  if (!element) return;
  
  element.classList.add('animate-lootbox-open');
  
  // Убираем класс анимации после завершения
  setTimeout(() => {
    element.classList.remove('animate-lootbox-open');
    if (onComplete) onComplete();
  }, 1200);
};

/**
 * Создает анимацию появления лутбокса
 * @param {HTMLElement} element - DOM элемент лутбокса
 * @param {number} delay - Задержка перед анимацией (мс)
 */
export const animateLootboxAppear = (element, delay = 0) => {
  if (!element) return;
  
  setTimeout(() => {
    element.classList.add('animate-lootbox-appear');
  }, delay);
};

/**
 * Получает картинки для лутбокса (теперь без вариантов)
 * @param {string} rarity - Редкость лутбокса
 * @returns {Array} - Массив путей к картинкам
 */
export const getRandomLootboxImages = (rarity) => {
  return getLootboxImages(rarity);
};

/**
 * Создает данные лутбоксов из API
 * @returns {Promise<Array>} - Массив лутбоксов из базы данных
 */
export const createLootboxesFromAPI = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/drops/lootboxes`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.lootboxes || [];
    } else {
      // Ошибка загрузки лутбоксов из API
      return [];
    }
  } catch (error) {
    // Ошибка загрузки лутбоксов
    return [];
  }
};

/**
 * Проверяет, загружены ли все картинки лутбокса
 * @param {Array} imagePaths - Массив путей к картинкам
 * @returns {Promise<boolean>} - Все ли картинки загружены
 */
export const preloadLootboxImages = (imagePaths) => {
  return Promise.all(
    imagePaths.map(path => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(path);
        img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
        img.src = path;
      });
    })
  );
};

/**
 * Создает эффект блеска при открытии лутбокса
 * @param {HTMLElement} element - DOM элемент лутбокса
 */
export const createSparkleEffect = (element) => {
  if (!element) return;
  
  const sparkle = document.createElement('div');
  sparkle.className = 'absolute inset-0 pointer-events-none animate-sparkle';
        sparkle.textContent = '✨';
  sparkle.style.fontSize = '2rem';
  sparkle.style.display = 'flex';
  sparkle.style.alignItems = 'center';
  sparkle.style.justifyContent = 'center';
  
  element.appendChild(sparkle);
  
  // Удаляем эффект после анимации
  setTimeout(() => {
    if (sparkle.parentNode) {
      sparkle.parentNode.removeChild(sparkle);
    }
  }, 600);
};
