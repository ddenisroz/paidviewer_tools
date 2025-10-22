# 🔍 Умный поиск категорий

Система поддерживает умный поиск категорий с автоматическим распознаванием:
- **Сокращений** (dbd → Dead by Daylight, rdr2 → Red Dead Redemption 2)
- **Частичных названий** (fifa → FC 24, фифа → EA SPORTS FC)
- **Переводов** (общение → Just Chatting, дота → Dota 2)
- **Маппинга между платформами** (Just Chatting ↔ Говорим и смотрим)
- **Релевантной сортировкой** результатов (по точности совпадения)

**Не обязательно вводить полное название!** Система найдет категорию даже по части слова или аббревиатуре.

## 📋 Поддерживаемые сокращения

### Популярные игры
| Сокращение | Полное название |
|------------|-----------------|
| `dbd` | Dead by Daylight |
| `rdr2` | Red Dead Redemption 2 |
| `rdr` | Red Dead Redemption, Red Dead Redemption 2 |
| `gta`, `gtav` | Grand Theft Auto V, GTA V |
| `gtao` | GTA Online |
| `cod` | Call of Duty, Warzone |
| `cs`, `cs2`, `csgo` | Counter-Strike, Counter-Strike 2, CS:GO |
| `lol` | League of Legends |
| `dota`, `dota2` | Dota 2 |
| `wow` | World of Warcraft |
| `ow`, `ow2` | Overwatch, Overwatch 2 |
| `val`, `valorant` | VALORANT |
| `apex` | Apex Legends |
| `fortnite`, `fn` | Fortnite |
| `minecraft`, `mc` | Minecraft |
| `pubg` | PUBG: BATTLEGROUNDS |
| `eft`, `tarkov` | Escape from Tarkov |
| `rust` | Rust |
| `ark` | ARK |
| `poe` | Path of Exile |
| `fifa`, `фифа`, `fc`, `fc24`, `fc25` | FC 24, FC 25, FIFA, EA SPORTS FC |
| `rl` | Rocket League |
| `hs` | Hearthstone |
| `diablo`, `d4`, `d3`, `d2` | Diablo IV, III, II |
| `bf` | Battlefield |
| `r6`, `siege` | Rainbow Six Siege |
| `destiny`, `destiny2` | Destiny 2 |
| `tf2` | Team Fortress 2 |
| `l4d`, `l4d2` | Left 4 Dead, Left 4 Dead 2 |
| `cyberpunk`, `cp2077` | Cyberpunk 2077 |
| `eldenring`, `er` | Elden Ring |
| `darksouls`, `ds`, `ds3` | Dark Souls, Dark Souls III |
| `sekiro` | Sekiro: Shadows Die Twice |
| `witcher`, `witcher3`, `w3` | The Witcher 3 |
| `skyrim` | The Elder Scrolls V: Skyrim |
| `fallout`, `fo4`, `fo76` | Fallout, Fallout 4, Fallout 76 |
| `gow` | God of War |
| `tlou` | The Last of Us |
| `spiderman` | Marvel's Spider-Man |
| `hogwarts`, `hl` | Hogwarts Legacy |
| `resident`, `re`, `re4` | Resident Evil, Resident Evil 4 |
| `silenthill`, `sh` | Silent Hill |
| `phasmophobia`, `phasmo` | Phasmophobia |
| `lethal` | Lethal Company |
| `fnaf` | Five Nights at Freddy's |
| `7dtd` | 7 Days to Die |
| `dayz` | DayZ |
| `terraria` | Terraria |
| `stardew`, `sdv` | Stardew Valley |
| `sims`, `sims4` | The Sims 4 |
| `cities` | Cities: Skylines |
| `civ`, `civ6` | Civilization VI |
| `aoe`, `aoe2`, `aoe4` | Age of Empires II, IV |
| `ff`, `ff14`, `ffxiv` | Final Fantasy, Final Fantasy XIV |
| `pokemon` | Pokémon |
| `zelda`, `botw`, `totk` | The Legend of Zelda |
| `mario` | Super Mario |
| `smash` | Super Smash Bros. |
| `mk` | Mortal Kombat |
| `sf`, `sf6` | Street Fighter, Street Fighter 6 |
| `tekken` | Tekken |
| `amongus`, `among` | Among Us |
| `fallguys` | Fall Guys |
| `roblox` | Roblox |
| `vrchat` | VRChat |
| `beatsaber` | Beat Saber |

### Русские названия популярных игр (Twitch → VK Live)
| Русский запрос | English результат |
|----------------|-------------------|
| `дота` | Dota 2 |
| `кс`, `контр`, `cs2` | Counter-Strike, Counter-Strike 2, CS:GO |
| `майнкрафт`, `майн` | Minecraft |
| `варфейс` | Warface |
| `танки`, `wot` | World of Tanks |
| `корабли`, `wows` | World of Warships |
| `варкрафт`, `вов` | World of Warcraft |
| `ведьмак` | The Witcher 3 |
| `скайрим` | The Elder Scrolls V: Skyrim |
| `фоллаут` | Fallout, Fallout 4 |
| `сталкер` | S.T.A.L.K.E.R. |
| `метро` | Metro Exodus |
| `раст` | Rust |
| `тарков`, `побег`, `eft` | Escape from Tarkov |
| `апекс` | Apex Legends |
| `форт`, `фортнайт` | Fortnite |
| `валорант` | VALORANT |
| `овервотч` | Overwatch 2 |
| `хартстоун`, `hs` | Hearthstone |
| `варфрейм` | Warframe |
| `дестини` | Destiny 2 |
| `роблокс` | Roblox |
| `амонг` | Among Us |
| `фазмо` | Phasmophobia |
| `хогвартс`, `hl` | Hogwarts Legacy |
| `элден`, `er` | Elden Ring |
| `киберпанк`, `cp2077` | Cyberpunk 2077 |
| `ракет`, `rl` | Rocket League |
| `террария` | Terraria |
| `геншин` | Genshin Impact |
| `лол`, `lol` | League of Legends |
| `пубг`, `pubg` | PUBG: BATTLEGROUNDS |
| `гта`, `gta5` | Grand Theft Auto V |
| `паладинс` | Paladins |
| `смайт` | SMITE |
| `хотс`, `hots` | Heroes of the Storm |
| `старкрафт`, `sc2` | StarCraft II |
| `диабло`, `d4` | Diablo IV |
| `симс`, `sims4` | The Sims 4 |
| `симулятор` | Farming Simulator, Euro Truck Simulator 2 |
| `евротрак`, `ets2` | Euro Truck Simulator 2 |
| `американтрак`, `ats` | American Truck Simulator |
| `спинтайрс` | Spintires |
| `сноуранер` | SnowRunner |
| `аркрыцари` | ARK: Survival Evolved |
| `7днейдосмерти`, `7dtd` | 7 Days to Die |
| `дейз` | DayZ |
| `зомбоид` | Project Zomboid |
| `лес` | The Forest |
| `сыновьялеса` | Sons of the Forest |
| `саншайн` | Satisfactory |
| `факторио` | Factorio |
| `римворлд` | RimWorld |
| `кислород` | Oxygen Not Included |
| `города`, `csl` | Cities: Skylines |
| `цивилизация`, `civ6` | Civilization VI |
| `война`, `tw3` | Total War: Warhammer III |
| `аоэ`, `aoe4` | Age of Empires IV |
| `хои`, `hoi4` | Hearts of Iron IV |
| `еу`, `eu4` | Europa Universalis IV |
| `стелларис` | Stellaris |
| `крусейдер`, `ck3` | Crusader Kings III |
| `ресидент`, `re4` | Resident Evil 4 |
| `сайлент`, `sh2` | Silent Hill 2 |
| `хоррор` | Horror Games |
| `фнаф`, `fnaf` | Five Nights at Freddy's |
| `летал` | Lethal Company |
| `контент` | Content Warning |
| `девушки` | The Binding of Isaac |
| `исаак` | The Binding of Isaac |
| `хадес` | Hades |
| `холлоу` | Hollow Knight |
| `селеста` | Celeste |
| `капхед` | Cuphead |
| `андертейл` | Undertavle |
| `дельтарун` | Deltarune |
| `стардью`, `sdv` | Stardew Valley |
| `портал` | Portal 2 |
| `халфлайф` | Half-Life |
| `биошок` | BioShock |
| `дишоноред` | Dishonored |
| `прей` | Prey |
| `хитман` | Hitman 3 |
| `асасин`, `ac` | Assassin's Creed |
| `фаркрай` | Far Cry |
| `радуга`, `r6s` | Rainbow Six Siege |
| `дивизион` | The Division 2 |
| `фифа`, `fifa`, `fc` | FC 24, FC 25 |
| `нба`, `nba` | NBA 2K |
| `формула`, `f1` | F1 24 |
| `форза` | Forza Horizon 5 |
| `гранд`, `gt7` | Gran Turismo 7 |
| `нфс`, `nfs` | Need for Speed |
| `флайт`, `msfs` | Microsoft Flight Simulator |
| `мортал`, `mk` | Mortal Kombat |
| `стрит`, `sf6` | Street Fighter 6 |
| `теккен` | Tekken 8 |
| `смешбросы`, `smash` | Super Smash Bros. Ultimate |
| `покемон` | Pokémon |
| `зельда`, `botw`, `totk` | The Legend of Zelda |
| `марио` | Super Mario |
| `сплатун` | Splatoon 3 |
| `метроид` | Metroid |
| `байонетта` | Bayonetta |
| `финалка`, `ff14` | Final Fantasy XIV |
| `моник` | Monster Hunter |
| `персона` | Persona |
| `якудза` | Yakuza |
| `нир` | NieR: Automata |
| `блэк`, `bdo` | Black Desert Online |
| `лост`, `lostark` | Lost Ark |
| `нью`, `newworld` | New World |
| `рунескейп`, `osrs` | Old School RuneScape |

### Категории стрима (переводы RU ↔ EN + маппинг Twitch ↔ VK)
| Запрос | Twitch | VK Live |
|--------|--------|---------|
| `общение`, `разговоры`, `болталка`, `чат` | Just Chatting, Talk Shows & Podcasts | Говорим и смотрим |
| `музыка`, `music` | Music | Музыка |
| `творчество`, `искусство`, `рисование`, `art`, `creative` | Art, Creative, Makers & Crafting | Творчество |
| `готовка`, `готовим`, `еда`, `cooking`, `food` | Cooking, Food & Drink | Кулинария |
| `игры`, `gaming`, `games` | Gaming, Games | Игры |
| `реальная`, `жизнь`, `ирл`, `irl` | IRL | Реальная жизнь |
| `спорт`, `sports` | Sports | Спорт |
| `фитнес`, `fitness` | Fitness & Health | - |
| `казино`, `слоты`, `азартные`, `casino`, `slots` | Slots, Casino, Poker | Азартные игры |
| `покер`, `poker` | Poker | Азартные игры |
| `шахматы`, `интеллектуальные`, `chess` | Chess | Интеллектуальные игры, Шахматы |
| `наука`, `технологии`, `science`, `tech` | Science & Technology | Технологии |
| `путешествия`, `природа`, `travel` | Travel & Outdoors | Путешествия |
| `мероприятия`, `события`, `events` | Special Events | Мероприятия |
| `аниме`, `anime` | Anime | - |
| `асмр`, `asmr` | ASMR | АСМР |
| `красота`, `beauty` | Beauty & Makeup | - |
| `подкаст`, `podcast`, `talk` | Podcasts, Talk Shows & Podcasts | Говорим и смотрим |

**💡 Особенность:** При поиске по русскому слову (например, "общение") система автоматически найдет:
- На Twitch: "Just Chatting" + "Talk Shows & Podcasts"
- На VK Live: "Говорим и смотрим"

## 🎯 Примеры использования

### На фронтенде (поле поиска)

#### Twitch:
```
Введите: dbd
→ Результат: Dead by Daylight (первым в списке)

Введите: fifa ИЛИ фифа
→ Результат: FC 24, FC 25, FIFA (частичный поиск работает!)

Введите: общение
→ Результат: Just Chatting, Talk Shows & Podcasts (находит по русскому слову!)

Введите: rdr2
→ Результат: Red Dead Redemption 2

Введите: творчество
→ Результат: Art, Creative, Makers & Crafting (кроссплатформенный маппинг)

Введите: кс
→ Результат: Counter-Strike, Counter-Strike 2, CS:GO (русский вариант!)
```

#### VK Live:
```
Введите: dbd
→ Результат: Dead by Daylight (первым в списке)

Введите: chatting
→ Результат: Говорим и смотрим (находит по английскому слову!)

Введите: gaming
→ Результат: Игры (кроссплатформенный маппинг)

Введите: творчество
→ Результат: Творчество
```

### В чате (команды)

#### На Twitch:
```
!category dbd
→ Категория изменена на "Dead by Daylight"

!game общение
→ Категория изменена на "Just Chatting"

!category творчество
→ Категория изменена на "Art"
```

#### На VK Live:
```
!category dbd
→ Категория изменена на "Dead by Daylight"

!game chatting
→ Категория изменена на "Говорим и смотрим"

!category gaming
→ Категория изменена на "Игры"
```

### При включенном режиме "Объединить поля"
```
Введите в любом поле: общение
→ Twitch: "Just Chatting"
→ VK Live: "Говорим и смотрим"
(автоматически подбирает соответствующие категории для каждой платформы!)
```

## 🔧 Как это работает

### 1. Расширение запроса с маппингом
Когда вы вводите сокращение или перевод, система автоматически расширяет его **с учетом маппинга между Twitch и VK**:
- `dbd` → `["dbd", "Dead by Daylight"]`
- `общение` → `["общение", "Just Chatting", "Говорим и смотрим", "Talk Shows & Podcasts"]`
- `творчество` → `["творчество", "Art", "Creative", "Творчество", "Makers & Crafting"]`
- `gaming` → `["gaming", "Gaming", "Игры", "Games"]`

**Кроссплатформенная магия:** Если вы ищете "общение" на Twitch, система найдет "Just Chatting" (EN), а на VK Live - "Говорим и смотрим" (RU)!

### 2. Параллельный поиск
Система делает параллельные запросы для всех вариантов и объединяет результаты.

### 3. Умная сортировка по релевантности
Результаты сортируются по сложному алгоритму:
- **0 баллов** = точное совпадение ("counter strike" → "Counter-Strike")
- **1 балл** = совпадение с начала строки ("dead" → "Dead by Daylight")
- **1.5 балла** = все слова подряд ("counter strike" → "Counter-Strike", "Counter Strike 2")
- **2 балла** = все слова есть, но не подряд ("counter strike" → "Counter-Strike: Global Offensive")
- **3-5 баллов** = все слова найдены (частично)
- **5-10 баллов** = отдельные слова совпадают ("counter" → "Counter Bottle Shooter")
- **15 баллов** = содержит подстроку
- **20-30 баллов** = нечеткое совпадение (fuzzy match, опечатки)
- **100 баллов** = не релевантно

**⚡ Важно:** Если вы вводите "counter strike", то "Counter-Strike" будет **всегда выше**, чем "Counter Bottle Shooter", потому что все слова запроса точно совпадают и идут подряд!

### 4. Удаление дубликатов
Если одна и та же категория найдена по разным запросам, она показывается только один раз.

## 📝 Добавление новых сокращений

### Frontend
Отредактируйте `frontend/src/constants/categoryAliases.js`:
```javascript
export const categoryAliases = {
    // ... существующие ...
    'новое_сокращение': ['Полное Название', 'Альтернативное Название'],
};
```

### Backend (для команд в чате)
Отредактируйте `bot_service/utils/category_search.py`:
```python
CATEGORY_ALIASES = {
    # ... существующие ...
    'новое_сокращение': ['Полное Название', 'Альтернативное Название'],
}
```

## 💡 Советы

1. **Не обязательно знать полное название** - просто введите "fifa", "кс", "дота" - система найдет
2. **Используйте короткие сокращения** для быстрой смены категорий в чате (dbd, rdr2, cs2)
3. **Пишите на русском или английском** - система понимает оба языка и автоматически найдет правильную категорию для каждой платформы
4. **Не бойтесь опечаток** - fuzzy search найдет категорию даже с ошибками (например, "overatch" → Overwatch)
5. **Первый результат = самый релевантный** - обычно это то, что вы ищете
6. **Кроссплатформенный маппинг работает автоматически** - введите "общение" и система сама подберет "Just Chatting" для Twitch и "Говорим и смотрим" для VK Live!

## 🚀 Производительность

- ⚡ Параллельные запросы выполняются одновременно
- 🧠 Локальная сортировка на клиенте (быстро)
- 📦 Кеширование результатов
- 🎯 Ограничение: первые 50 категорий на запрос

