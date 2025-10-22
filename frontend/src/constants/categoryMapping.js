// Маппинг категорий между Twitch и VK Live
// Категории с похожим содержанием но разными названиями и ID

export const categoryMapping = {
    // Twitch название -> VK название
    'Just Chatting': 'Говорим и смотрим',
    'Talk Shows & Podcasts': 'Говорим и смотрим', 
    'Music': 'Музыка',
    'Creative': 'Творчество',
    'Art': 'Творчество',
    'Gaming': 'Игры',
    'IRL': 'Реальная жизнь',
    'Sports': 'Спорт',
    'Travel & Outdoors': 'Путешествия',
    'Science & Technology': 'Технологии',
    'Food & Drink': 'Кулинария',
    'ASMR': 'АСМР',
    'Chess': 'Интеллектуальные игры',
    'Slots': 'Азартные игры',
    'Poker': 'Азартные игры',
    'Special Events': 'Мероприятия',
    
    // VK название -> Twitch название
    'Говорим и смотрим': 'Just Chatting',
    'Музыка': 'Music', 
    'Творчество': 'Art',
    'Игры': 'Gaming',
    'Реальная жизнь': 'IRL',
    'Спорт': 'Sports',
    'Путешествия': 'Travel & Outdoors',
    'Технологии': 'Science & Technology',
    'Кулинария': 'Food & Drink',
    'АСМР': 'ASMR',
    'Интеллектуальные игры': 'Chess',
    'Азартные игры': 'Slots',
    'Мероприятия': 'Special Events'
};

/**
 * Найти соответствующую категорию на другой платформе
 * @param {string} categoryName - название категории
 * @param {string} fromPlatform - исходная платформа (twitch/vk)  
 * @param {Array} targetCategories - список категорий целевой платформы
 * @returns {Object|null} - найденная категория или null
 */
export function findMappedCategory(categoryName, fromPlatform, targetCategories) {
    if (!categoryName || !targetCategories || !Array.isArray(targetCategories)) {
        return null;
    }

    // Ищем точное совпадение по имени
    let exactMatch = targetCategories.find(cat => 
        cat.name && cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (exactMatch) {
        return exactMatch;
    }

    // Ищем через маппинг
    const mappedName = categoryMapping[categoryName];
    if (mappedName) {
        const mappedCategory = targetCategories.find(cat => 
            cat.name && cat.name.toLowerCase() === mappedName.toLowerCase()
        );
        if (mappedCategory) {
            return mappedCategory;
        }
    }

    // Ищем частичное совпадение (включает в себя)
    const partialMatch = targetCategories.find(cat => 
        cat.name && (
            cat.name.toLowerCase().includes(categoryName.toLowerCase()) ||
            categoryName.toLowerCase().includes(cat.name.toLowerCase())
        )
    );
    
    if (partialMatch) {
        return partialMatch;
    }

    return null;
}

/**
 * Получить список похожих категорий для автокомплита
 * @param {string} categoryName - название категории
 * @param {string} fromPlatform - исходная платформа
 * @param {Array} targetCategories - список категорий целевой платформы
 * @returns {Array} - список похожих категорий
 */
export function getSimilarCategories(categoryName, fromPlatform, targetCategories) {
    if (!categoryName || !targetCategories || !Array.isArray(targetCategories)) {
        return [];
    }

    const similar = [];
    const lowerName = categoryName.toLowerCase();
    
    // Добавляем категории с похожими названиями
    targetCategories.forEach(cat => {
        if (cat.name) {
            const catLower = cat.name.toLowerCase();
            if (catLower.includes(lowerName) || lowerName.includes(catLower)) {
                similar.push(cat);
            }
        }
    });

    // Добавляем категории из маппинга
    const mappedName = categoryMapping[categoryName];
    if (mappedName) {
        const mapped = targetCategories.filter(cat => 
            cat.name && cat.name.toLowerCase().includes(mappedName.toLowerCase())
        );
        similar.push(...mapped);
    }

    // Убираем дубликаты
    return Array.from(new Set(similar.map(cat => cat.id)))
        .map(id => similar.find(cat => cat.id === id))
        .slice(0, 5); // Максимум 5 похожих
}

// Legacy экспорты для обратной совместимости (если где-то используются)
export const CATEGORY_MAPPING = categoryMapping;

export const CATEGORY_ICONS = {
  'just-chatting': '💬',
  'music': '🎵',
  'gaming': '🎮',
  'art': '🎨',
  'sports': '⚽',
  'science-tech': '🔬',
  'asmr': '🎧',
  'cooking': '👨‍🍳',
  'travel': '✈️',
  'education': '📚',
  'other': '📺'
};
