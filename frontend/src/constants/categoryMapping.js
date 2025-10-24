// Маппинг категорий между Twitch и VK Live
// Категории с похожим содержанием но разными названиями и ID

export const categoryMapping = {
    // === ОСНОВНЫЕ КАТЕГОРИИ (Twitch → VK) ===
    'Just Chatting': 'Говорим и смотрим',
    'Talk Shows & Podcasts': 'Говорим и смотрим',
    'Podcasts & Talk Shows': 'Говорим и смотрим',
    'Music': 'Музыка',
    'Creative': 'Творчество',
    'Art': 'Творчество',
    'Makers & Crafting': 'Творчество',
    'Digital Art': 'Творчество',
    'Gaming': 'Игры',
    'Games': 'Игры',
    'Retro': 'Игры',
    'IRL': 'Говорим и смотрим',  // In Real Life → на VK ближайшая "Говорим и смотрим" (Just Chatting аналог)
    'Real Life': 'Говорим и смотрим',
    'Sports': 'Спорт',
    'Travel & Outdoors': 'Путешествия',
    'Science & Technology': 'Технологии',
    'Software and Game Development': 'Технологии',
    'Software Development': 'Технологии',
    'Food & Drink': 'Кулинария',
    'Cooking': 'Кулинария',
    'ASMR': 'АСМР',
    'Chess': 'Интеллектуальные игры',
    'Slots': 'Азартные игры',
    'Casino': 'Азартные игры',
    'Poker': 'Азартные игры',
    'Blackjack': 'Азартные игры',
    'Roulette': 'Азартные игры',
    'Special Events': 'Мероприятия',
    'Events': 'Мероприятия',
    
    // === ДОПОЛНИТЕЛЬНЫЕ КАТЕГОРИИ (Twitch → VK) ===
    'Animals, Aquariums, and Zoos': 'Животные',
    'Animals': 'Животные',
    'Pets & Animals': 'Животные',
    'Anime': 'Аниме',
    'Beauty & Makeup': 'Красота',
    'Fitness & Health': 'Спорт',
    'Fitness': 'Спорт',
    'Health & Fitness': 'Спорт',
    'Yoga': 'Спорт',
    'Workout': 'Спорт',
    'Pools, Hot Tubs, and Beaches': 'IRL',
    'Politics': 'Общественное',
    'News': 'Новости',
    'Esports': 'Киберспорт',
    'Educational': 'Обучение',
    'Education': 'Обучение',
    'Always On': 'Круглосуточно',
    '24/7': 'Круглосуточно',
    'Tabletop RPGs': 'Настольные игры',
    'Board Games': 'Настольные игры',
    'Card Games': 'Настольные игры',
    'Magic: The Gathering': 'Настольные игры',
    'Yu-Gi-Oh!': 'Настольные игры',
    
    // === ИГРОВЫЕ ЖАНРЫ (Twitch → VK, если есть отдельные категории) ===
    'RPG': 'RPG',
    'Strategy Games': 'Стратегии',
    'Strategy': 'Стратегии',
    'Simulation': 'Симуляторы',
    'Simulators': 'Симуляторы',
    'Racing': 'Гонки',
    'Racing Games': 'Гонки',
    'Fighting Games': 'Файтинги',
    'Fighting': 'Файтинги',
    'First-Person Shooter': 'Шутеры',
    'FPS': 'Шутеры',
    'Shooter': 'Шутеры',
    'Battle Royale': 'Battle Royale',
    'MOBA': 'MOBA',
    'MMORPG': 'MMORPG',
    'MMO': 'MMORPG',
    'Horror': 'Хоррор',
    'Survival Horror': 'Хоррор',
    'Action': 'Экшн',
    'Adventure': 'Приключения',
    'Platformer': 'Платформеры',
    'Puzzle': 'Головоломки',
    'Puzzle Games': 'Головоломки',
    'Rhythm Games': 'Ритм-игры',
    'Rhythm': 'Ритм-игры',
    'Indie Games': 'Инди',
    'Indie': 'Инди',
    
    // === ОБРАТНЫЙ МАППИНГ (VK → Twitch) ===
    'Говорим и смотрим': 'Just Chatting',
    'Музыка': 'Music',
    'Творчество': 'Art',
    'Игры': 'Gaming',
    // 'IRL' убран - нет прямого аналога на VK
    'Спорт': 'Sports',
    'Путешествия': 'Travel & Outdoors',
    'Технологии': 'Science & Technology',
    'Кулинария': 'Food & Drink',
    'АСМР': 'ASMR',
    'Интеллектуальные игры': 'Chess',
    'Азартные игры': 'Slots',
    'Мероприятия': 'Special Events',
    'Животные': 'Animals, Aquariums, and Zoos',
    'Аниме': 'Anime',
    'Красота': 'Beauty & Makeup',
    'Общественное': 'Politics',
    'Новости': 'News',
    'Киберспорт': 'Esports',
    'Обучение': 'Educational',
    'Круглосуточно': 'Always On',
    'Реальная жизнь': 'IRL',  // VK → Twitch (если на VK есть такая категория)

    'Настольные игры': 'Tabletop RPGs',
    'Стратегии': 'Strategy Games',
    'Симуляторы': 'Simulation',
    'Гонки': 'Racing',
    'Файтинги': 'Fighting Games',
    'Шутеры': 'First-Person Shooter',
    'Battle Royale': 'Battle Royale',
    'MOBA': 'MOBA',
    'MMORPG': 'MMORPG',
    'Хоррор': 'Horror',
    'Экшн': 'Action',
    'Приключения': 'Adventure',
    'Платформеры': 'Platformer',
    'Головоломки': 'Puzzle',
    'Ритм-игры': 'Rhythm Games',
    'Инди': 'Indie Games',
    
    // === СПЕЦИФИЧНЫЕ КАТЕГОРИИ (если названия отличаются) ===
    // Twitch использует полные названия, VK может использовать сокращенные
    'Call of Duty: Modern Warfare': 'Call of Duty',
    'Call of Duty: Warzone': 'Call of Duty',
    'Grand Theft Auto V': 'GTA V',
    'The Elder Scrolls V: Skyrim': 'Skyrim',
    'The Witcher 3: Wild Hunt': 'The Witcher 3',
    'Red Dead Redemption 2': 'Red Dead Redemption',
    'Assassin\'s Creed Valhalla': 'Assassin\'s Creed',
    'Tom Clancy\'s Rainbow Six Siege': 'Rainbow Six Siege',
    'VALORANT': 'Valorant',
    'Counter-Strike: Global Offensive': 'CS:GO',
    'League of Legends': 'League of Legends',
    'Dota 2': 'Dota 2',
    'Minecraft': 'Minecraft',
    'Fortnite': 'Fortnite',
    'Apex Legends': 'Apex Legends',
    'Overwatch 2': 'Overwatch',
    'World of Warcraft': 'World of Warcraft',
    'Escape from Tarkov': 'Escape from Tarkov',
    'Rust': 'Rust',
    'Dead by Daylight': 'Dead by Daylight',
    'Among Us': 'Among Us',
    'Fall Guys': 'Fall Guys',
    'Rocket League': 'Rocket League',
    'FIFA 23': 'FIFA',
    'FC 24': 'FC 24',
    'NBA 2K': 'NBA 2K',
    'Cyberpunk 2077': 'Cyberpunk 2077',
    'Elden Ring': 'Elden Ring',
    'Hogwarts Legacy': 'Hogwarts Legacy',
    'Starfield': 'Starfield',
    'Diablo IV': 'Diablo',
    'Path of Exile': 'Path of Exile',
    'Lost Ark': 'Lost Ark',
    'Final Fantasy XIV': 'Final Fantasy XIV',
    'Black Desert Online': 'Black Desert',
    'Old School RuneScape': 'RuneScape',
    'World of Tanks': 'World of Tanks',
    'War Thunder': 'War Thunder',
    'Warframe': 'Warframe',
    'Destiny 2': 'Destiny 2',
    'Hearthstone': 'Hearthstone',
    'StarCraft II': 'StarCraft',
    'Age of Empires IV': 'Age of Empires',
    'Civilization VI': 'Civilization',
    'Cities: Skylines': 'Cities Skylines',
    'Euro Truck Simulator 2': 'Euro Truck Simulator',
    'American Truck Simulator': 'American Truck Simulator',
    'Farming Simulator': 'Farming Simulator',
    'Microsoft Flight Simulator': 'Flight Simulator',
    'The Sims 4': 'The Sims',
    'Stardew Valley': 'Stardew Valley',
    'Terraria': 'Terraria',
    'Valheim': 'Valheim',
    'Satisfactory': 'Satisfactory',
    'Factorio': 'Factorio',
    'RimWorld': 'RimWorld',
    'Project Zomboid': 'Project Zomboid',
    'DayZ': 'DayZ',
    'ARK: Survival Evolved': 'ARK',
    'Conan Exiles': 'Conan Exiles',
    'Palworld': 'Palworld',
    'Lethal Company': 'Lethal Company',
    'Content Warning': 'Content Warning',
    'Phasmophobia': 'Phasmophobia',
    'The Forest': 'The Forest',
    'Sons of the Forest': 'Sons of the Forest',
    'Resident Evil 4': 'Resident Evil',
    'Silent Hill 2': 'Silent Hill',
    'Outlast': 'Outlast',
    'Five Nights at Freddy\'s': 'FNAF',
    'Poppy Playtime': 'Poppy Playtime',
    'Genshin Impact': 'Genshin Impact',
    'Honkai: Star Rail': 'Honkai Star Rail',
    'Baldur\'s Gate 3': 'Baldur\'s Gate',
    'Divinity: Original Sin 2': 'Divinity',
    'Disco Elysium': 'Disco Elysium',
    'Hollow Knight': 'Hollow Knight',
    'Celeste': 'Celeste',
    'Hades': 'Hades',
    'Dead Cells': 'Dead Cells',
    'The Binding of Isaac': 'Isaac',
    'Slay the Spire': 'Slay the Spire',
    'Vampire Survivors': 'Vampire Survivors',
    'Brotato': 'Brotato',
    'Roblox': 'Roblox',
    'VRChat': 'VRChat',
    'Beat Saber': 'Beat Saber',
    'Half-Life: Alyx': 'Half-Life Alyx',
    'Pavlov VR': 'Pavlov',
    'Geoguessr': 'Geoguessr',
    'Only Up!': 'Only Up',
    'Goose Goose Duck': 'Goose Goose Duck',
    'Gartic Phone': 'Gartic Phone',
    'Jackbox Party Packs': 'Jackbox',
    'Music Production': 'Музыка',
    'DJ': 'Музыка',
    'Karaoke': 'Караоке',
    'Meditation': 'Медитация',
    'Wellness': 'Здоровье',
    'Mental Health': 'Психология'
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

    // УБРАЛИ частичное совпадение - оно приводит к неправильным результатам!
    // Например: "IRL" находил "IRL: Italian Ritual Live"
    // Теперь ТОЛЬКО точное совпадение или маппинг!

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
