// Маппинг категорий между Twitch и VK Live
// Категории с похожим содержанием но разными названиями и ID

// Кеш для нормализованных результатов поиска (для производительности)
const normalizationCache = new Map();

/**
 * Нормализация названия категории для лучшего поиска
 * @param {string} name - оригинальное название
 * @returns {string} - нормализованное название
 */
function normalizeCategoryName(name) {
    if (!name) return '';
    
    // Проверяем кеш
    if (normalizationCache.has(name)) {
        return normalizationCache.get(name);
    }
    
    const normalized = name
        .toLowerCase()
        .trim()
        // Убираем специальные символы (кроме пробелов и тире)
        .replace(/[:\u2019''`]/g, '')  // Убираем двоеточия и апострофы
        .replace(/\s+/g, ' ')  // Множественные пробелы → один
        .replace(/\s*-\s*/g, ' ')  // Тире с пробелами → пробел
        .replace(/&/g, 'and');  // & → and
    
    // Сохраняем в кеш (максимум 1000 записей)
    if (normalizationCache.size < 1000) {
        normalizationCache.set(name, normalized);
    }
    
    return normalized;
}

export const categoryMapping = {
    // === ОСНОВНЫЕ КАТЕГОРИИ (Twitch → VK) ===
    // Общение / Just Chatting
    'Just Chatting': 'Говорим и смотрим',
    'Talk Shows & Podcasts': 'Говорим и смотрим',
    'Podcasts & Talk Shows': 'Говорим и смотрим',
    'Chatting': 'Говорим и смотрим',
    'Chat': 'Говорим и смотрим',
    'Talking': 'Говорим и смотрим',
    'IRL': 'Говорим и смотрим',  // In Real Life
    'Real Life': 'Говорим и смотрим',
    'Variety': 'Говорим и смотрим',
    
    // Музыка
    'Music': 'Музыка',
    'Music & Performing Arts': 'Музыка',
    'Performing Arts': 'Музыка',
    'DJ': 'Музыка',
    'Music Production': 'Музыка',
    'Karaoke': 'Караоке',
    'Караоке': 'Караоке',
    
    // Творчество / Искусство
    'Creative': 'Творчество',
    'Art': 'Творчество',
    'Makers & Crafting': 'Творчество',
    'Digital Art': 'Творчество',
    'Drawing & Painting': 'Творчество',
    'Drawing': 'Творчество',
    'Painting': 'Творчество',
    'Crafts & DIY': 'Творчество',
    'DIY': 'Творчество',
    'Photography': 'Творчество',
    'Handmade': 'Творчество',
    
    // Игры
    'Gaming': 'Игры',
    'Games': 'Игры',
    'Game': 'Игры',
    'Video Games': 'Игры',
    'Retro': 'Игры',
    'Retro Gaming': 'Игры',
    
    // Спорт
    'Sports': 'Спорт',
    'Sport': 'Спорт',
    'Fitness & Health': 'Спорт',
    'Fitness': 'Спорт',
    'Health & Fitness': 'Спорт',
    'Yoga': 'Спорт',
    'Workout': 'Спорт',
    'Training': 'Спорт',
    'Gym': 'Спорт',
    
    // Путешествия
    'Travel & Outdoors': 'Путешествия',
    'Travel': 'Путешествия',
    'Outdoors': 'Путешествия',
    'Nature': 'Путешествия',
    'Hiking': 'Путешествия',
    
    // Технологии / Наука
    'Science & Technology': 'Технологии',
    'Technology': 'Технологии',
    'Tech': 'Технологии',
    'Science': 'Технологии',
    'Software and Game Development': 'Технологии',
    'Software Development': 'Технологии',
    'Programming': 'Технологии',
    'Coding': 'Технологии',
    'Development': 'Технологии',
    'IT': 'Технологии',
    'Computers': 'Технологии',
    
    // Кулинария
    'Food & Drink': 'Кулинария',
    'Cooking': 'Кулинария',
    'Food': 'Кулинария',
    'Baking': 'Кулинария',
    'Recipes': 'Кулинария',
    
    // ASMR
    'ASMR': 'АСМР',
    'Relaxation': 'АСМР',
    
    // Интеллектуальные игры
    'Chess': 'Интеллектуальные игры',
    'Board Games': 'Настольные игры',
    'Tabletop Games': 'Настольные игры',
    'Tabletop RPGs': 'Настольные игры',
    'Card Games': 'Настольные игры',
    'Magic: The Gathering': 'Настольные игры',
    'Yu-Gi-Oh!': 'Настольные игры',
    
    // Азартные игры
    'Slots': 'Азартные игры',
    'Casino': 'Азартные игры',
    'Poker': 'Азартные игры',
    'Blackjack': 'Азартные игры',
    'Roulette': 'Азартные игры',
    'Gambling': 'Азартные игры',
    
    // События / Мероприятия
    'Special Events': 'Мероприятия',
    'Events': 'Мероприятия',
    'Conventions': 'Мероприятия',
    'Conferences': 'Мероприятия',
    
    // === ДОПОЛНИТЕЛЬНЫЕ КАТЕГОРИИ (Twitch → VK) ===
    // Животные
    'Animals, Aquariums, and Zoos': 'Животные',
    'Animals': 'Животные',
    'Pets & Animals': 'Животные',
    'Pets': 'Животные',
    'Wildlife': 'Животные',
    'Aquariums': 'Животные',
    'Zoos': 'Животные',
    
    // Аниме
    'Anime': 'Аниме',
    'Manga': 'Аниме',
    'Japanese Animation': 'Аниме',
    
    // Красота
    'Beauty & Makeup': 'Красота',
    'Beauty': 'Красота',
    'Makeup': 'Красота',
    'Fashion': 'Красота',
    'Style': 'Красота',
    'Hair & Beauty': 'Красота',
    
    // Бассейны / IRL
    'Pools, Hot Tubs, and Beaches': 'Говорим и смотрим',  // На VK это скорее Just Chatting категория
    'Hot Tubs': 'Говорим и смотрим',
    'Beaches': 'Путешествия',
    
    // Общественное / Политика
    'Politics': 'Общественное',
    'Social': 'Общественное',
    'Current Events': 'Общественное',
    'Discussion': 'Общественное',
    
    // Новости
    'News': 'Новости',
    'News & Politics': 'Новости',
    
    // Киберспорт
    'Esports': 'Киберспорт',
    'E-sports': 'Киберспорт',
    'Competitive Gaming': 'Киберспорт',
    'Pro Gaming': 'Киберспорт',
    'Tournaments': 'Киберспорт',
    
    // Обучение
    'Educational': 'Обучение',
    'Education': 'Обучение',
    'Learning': 'Обучение',
    'Tutorial': 'Обучение',
    'Tutorials': 'Обучение',
    'Teaching': 'Обучение',
    'Study': 'Обучение',
    
    // Круглосуточно
    'Always On': 'Круглосуточно',
    '24/7': 'Круглосуточно',
    'Marathon': 'Круглосуточно',
    
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
    // Основные категории VK → Twitch
    'Говорим и смотрим': 'Just Chatting',
    'Общение': 'Just Chatting',
    'Разговоры': 'Just Chatting',
    'Чат': 'Just Chatting',
    
    'Музыка': 'Music',
    'Пение': 'Music',
    'Вокал': 'Music',
    
    'Творчество': 'Art',
    'Искусство': 'Art',
    'Рисование': 'Art',
    'Живопись': 'Art',
    'Ручная работа': 'Art',
    
    'Игры': 'Gaming',
    'Видеоигры': 'Gaming',
    'Геймплей': 'Gaming',
    
    'Спорт': 'Sports',
    'Фитнес': 'Fitness & Health',
    'Тренировки': 'Fitness & Health',
    'Йога': 'Yoga',
    
    'Путешествия': 'Travel & Outdoors',
    'Туризм': 'Travel & Outdoors',
    'Природа': 'Travel & Outdoors',
    
    'Технологии': 'Science & Technology',
    'Наука': 'Science & Technology',
    'IT': 'Science & Technology',
    'Программирование': 'Software Development',
    'Разработка': 'Software Development',
    
    'Кулинария': 'Food & Drink',
    'Готовка': 'Cooking',
    'Еда': 'Food & Drink',
    'Выпечка': 'Food & Drink',
    
    'АСМР': 'ASMR',
    
    'Интеллектуальные игры': 'Chess',
    'Шахматы': 'Chess',
    
    'Азартные игры': 'Slots',
    'Казино': 'Casino',
    'Покер': 'Poker',
    
    'Мероприятия': 'Special Events',
    'События': 'Special Events',
    'Конференции': 'Special Events',
    
    'Животные': 'Animals, Aquariums, and Zoos',
    'Питомцы': 'Pets & Animals',
    'Дикая природа': 'Animals',
    
    'Аниме': 'Anime',
    'Манга': 'Anime',
    
    'Красота': 'Beauty & Makeup',
    'Макияж': 'Beauty & Makeup',
    'Мода': 'Beauty & Makeup',
    'Стиль': 'Beauty & Makeup',
    
    'Общественное': 'Politics',
    'Политика': 'Politics',
    'Дискуссия': 'Politics',
    
    'Новости': 'News',
    
    'Киберспорт': 'Esports',
    'Турниры': 'Esports',
    
    'Обучение': 'Educational',
    'Образование': 'Educational',
    'Уроки': 'Educational',
    'Учеба': 'Educational',
    
    'Круглосуточно': 'Always On',
    'Марафон': 'Always On',
    
    'Реальная жизнь': 'IRL',
    'IRL': 'IRL',

    // Жанры игр VK → Twitch
    'Настольные игры': 'Board Games',
    'Стратегии': 'Strategy Games',
    'Симуляторы': 'Simulation',
    'Гонки': 'Racing',
    'Файтинги': 'Fighting Games',
    'Шутеры': 'First-Person Shooter',
    'Battle Royale': 'Battle Royale',
    'MOBA': 'MOBA',
    'MMORPG': 'MMORPG',
    'Хоррор': 'Horror',
    'Ужасы': 'Horror',
    'Экшн': 'Action',
    'Экшен': 'Action',
    'Приключения': 'Adventure',
    'Платформеры': 'Platformer',
    'Головоломки': 'Puzzle',
    'Пазлы': 'Puzzle',
    'Ритм-игры': 'Rhythm Games',
    'Инди': 'Indie Games',
    'Инди-игры': 'Indie Games',
    
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
    'Meditation': 'Медитация',
    'Wellness': 'Здоровье',
    'Mental Health': 'Психология',
    'Psychology': 'Психология',
    
    // === СОВРЕМЕННЫЕ ИГРЫ 2024-2025 ===
    'The First Descendant': 'The First Descendant',
    'Black Myth: Wukong': 'Black Myth Wukong',
    'Black Myth Wukong': 'Black Myth Wukong',
    'Wukong': 'Black Myth Wukong',
    'Helldivers 2': 'Helldivers',
    'Helldivers II': 'Helldivers',
    'Dragon Age: The Veilguard': 'Dragon Age',
    'Dragon Age Veilguard': 'Dragon Age',
    'S.T.A.L.K.E.R. 2: Heart of Chornobyl': 'STALKER 2',
    'STALKER 2': 'STALKER 2',
    'Silent Hill 2 Remake': 'Silent Hill',
    'Metaphor: ReFantazio': 'Metaphor',
    'Metaphor ReFantazio': 'Metaphor',
    'Like a Dragon: Infinite Wealth': 'Like a Dragon',
    'Yakuza': 'Like a Dragon',
    'Tekken 8': 'Tekken',
    'Street Fighter 6': 'Street Fighter',
    'Mortal Kombat 1': 'Mortal Kombat',
    'Granblue Fantasy: Relink': 'Granblue Fantasy',
    'Granblue Fantasy Relink': 'Granblue Fantasy',
    'Final Fantasy VII Rebirth': 'Final Fantasy',
    'FF7 Rebirth': 'Final Fantasy',
    'Persona 3 Reload': 'Persona',
    'Persona 3': 'Persona',
    'Persona 5 Royal': 'Persona',
    'Manor Lords': 'Manor Lords',
    'Hades II': 'Hades',
    'Hades 2': 'Hades',
    'Animal Well': 'Animal Well',
    'Balatro': 'Balatro',
    'Unicorn Overlord': 'Unicorn Overlord',
    'The Finals': 'The Finals',
    'XDefiant': 'XDefiant',
    'Wuthering Waves': 'Wuthering Waves',
    'Zenless Zone Zero': 'Zenless Zone Zero',
    'ZZZ': 'Zenless Zone Zero',
    'Throne and Liberty': 'Throne and Liberty',
    'Blue Protocol': 'Blue Protocol',
    'Enshrouded': 'Enshrouded',
    'Nightingale': 'Nightingale',
    'Last Epoch': 'Last Epoch',
    'Gray Zone Warfare': 'Gray Zone Warfare',
    'Arena Breakout': 'Arena Breakout',
    'Marvel Rivals': 'Marvel Rivals',
    'Spider-Man 2': 'Spider-Man',
    'Marvel\'s Spider-Man 2': 'Spider-Man',
    'Alan Wake 2': 'Alan Wake',
    'Alan Wake II': 'Alan Wake',
    'Atomic Heart': 'Atomic Heart',
    'Lies of P': 'Lies of P',
    'Lords of the Fallen': 'Lords of the Fallen',
    'Remnant 2': 'Remnant',
    'Remnant II': 'Remnant',
    'Armored Core VI': 'Armored Core',
    'Armored Core 6': 'Armored Core',
    'Robocop: Rogue City': 'Robocop',
    'Payday 3': 'Payday',
    'Call of Duty: Modern Warfare III': 'Call of Duty',
    'Call of Duty: MW3': 'Call of Duty',
    'COD MW3': 'Call of Duty',
    'MW3': 'Call of Duty',
    'Counter-Strike 2': 'CS2',
    'CS2': 'CS2',
    'Counter Strike 2': 'CS2',
    'Deadlock': 'Deadlock',
    'Halo Infinite': 'Halo',
    'Warzone 2': 'Call of Duty',
    'DMZ': 'Call of Duty',
    'Call of Duty: Black Ops 6': 'Call of Duty',
    'Black Ops 6': 'Call of Duty',
    'BO6': 'Call of Duty',
    
    // === ДОПОЛНИТЕЛЬНЫЕ ВАРИАЦИИ ПОПУЛЯРНЫХ ИГР ===
    'GTA 5': 'GTA V',
    'GTA V': 'GTA V',
    'GTA Online': 'GTA V',
    'CS GO': 'CS:GO',
    'CSGO': 'CS:GO',
    'Counter Strike GO': 'CS:GO',
    'LoL': 'League of Legends',
    'League': 'League of Legends',
    'Dota': 'Dota 2',
    'WoW': 'World of Warcraft',
    'EFT': 'Escape from Tarkov',
    'Tarkov': 'Escape from Tarkov',
    'PUBG': 'PUBG: BATTLEGROUNDS',
    'PUBG Battlegrounds': 'PUBG: BATTLEGROUNDS',
    'Valorant': 'VALORANT',  // Добавляем вариант без капса
    'Val': 'VALORANT',
    'Apex': 'Apex Legends',
    'OW2': 'Overwatch 2',
    'Overwatch': 'Overwatch 2',
    'R6': 'Rainbow Six Siege',
    'R6 Siege': 'Rainbow Six Siege',
    'Siege': 'Rainbow Six Siege',
    'DBD': 'Dead by Daylight',
    'BG3': 'Baldur\'s Gate 3',
    'Baldurs Gate 3': 'Baldur\'s Gate 3',
    'Baldurs Gate': 'Baldur\'s Gate 3',
    'POE': 'Path of Exile',
    'PoE': 'Path of Exile',
    'FF14': 'Final Fantasy XIV',
    'FFXIV': 'Final Fantasy XIV',
    'FF 14': 'Final Fantasy XIV',
    'RDR2': 'Red Dead Redemption 2',
    'RDR 2': 'Red Dead Redemption 2',
    'Red Dead 2': 'Red Dead Redemption 2',
    'Sims 4': 'The Sims 4',
    'TS4': 'The Sims 4',
    'ETS2': 'Euro Truck Simulator 2',
    'ATS': 'American Truck Simulator',
    'MSFS': 'Microsoft Flight Simulator',
    'FS': 'Microsoft Flight Simulator',
    'Flight Sim': 'Microsoft Flight Simulator',
    'ARK': 'ARK: Survival Evolved',
    'Ark Survival': 'ARK: Survival Evolved',
    'Cities Skylines': 'Cities: Skylines',
    'CS Skylines': 'Cities: Skylines',
    'FNAF': 'Five Nights at Freddy\'s',
    'Five Nights at Freddys': 'Five Nights at Freddy\'s',
    'OSRS': 'Old School RuneScape',
    'RS': 'Old School RuneScape',
    'RuneScape': 'Old School RuneScape',
    'WoT': 'World of Tanks',
    'SC2': 'StarCraft II',
    'Starcraft 2': 'StarCraft II',
    'HS': 'Hearthstone',
    'AoE4': 'Age of Empires IV',
    'Age of Empires 4': 'Age of Empires IV',
    'Civ 6': 'Civilization VI',
    'Civilization 6': 'Civilization VI',
    'BDO': 'Black Desert Online'
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

    // Нормализуем входное название для лучшего поиска
    const normalizedInput = normalizeCategoryName(categoryName);

    // 1. Ищем точное совпадение по оригинальному имени
    let exactMatch = targetCategories.find(cat => 
        cat.name && cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (exactMatch) {
        return exactMatch;
    }

    // 2. Ищем точное совпадение по нормализованному имени
    let normalizedMatch = targetCategories.find(cat => 
        cat.name && normalizeCategoryName(cat.name) === normalizedInput
    );
    
    if (normalizedMatch) {
        return normalizedMatch;
    }

    // 3. Ищем через маппинг (оригинальное название)
    const mappedName = categoryMapping[categoryName];
    if (mappedName) {
        const mappedCategory = targetCategories.find(cat => 
            cat.name && cat.name.toLowerCase() === mappedName.toLowerCase()
        );
        if (mappedCategory) {
            return mappedCategory;
        }
    }

    // 4. Ищем через маппинг (нормализованное название)
    // Проверяем все ключи маппинга на совпадение с нормализованным вводом
    for (const [key, value] of Object.entries(categoryMapping)) {
        if (normalizeCategoryName(key) === normalizedInput) {
            const mappedCategory = targetCategories.find(cat => 
                cat.name && (
                    cat.name.toLowerCase() === value.toLowerCase() ||
                    normalizeCategoryName(cat.name) === normalizeCategoryName(value)
                )
            );
            if (mappedCategory) {
                return mappedCategory;
            }
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
