// src/components/StreamCategoryCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle, Link, Loader, Save, Tag, Unlink } from 'lucide-react';
import ReactDOM from 'react-dom';

import { categoryMapping, findMappedCategory } from '@/constants/categoryMapping';
import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

interface Category {
    id: string | number;
    name: string;
    box_art_url?: string;
    cover_url?: string;
    title?: string;
    type?: string;
}

interface CategoryDropdownProps {
    platform: string;
    search: string;
    onSelect: (platform: string, category: Category) => void;
    results: Category[];
    inputRef: HTMLInputElement | null;
}

// Portal dropdown для отображения поверх всех элементов
const CategoryDropdown: React.FC<CategoryDropdownProps> = ({ platform, search, onSelect, results, inputRef }) => {
    if (!search || !Array.isArray(results) || results.length === 0 || !inputRef) return null;

    // Получаем позицию инпута для отображения дропдауна
    const rect = inputRef.getBoundingClientRect();

    const dropdownContent = (
        <div
            data-category-dropdown="true"
            className="fixed bg-background border border-border rounded-md shadow-lg max-h-[280px] overflow-y-auto"
            style={{
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 9999
            }}
        >
            {results.map((cat) => (
                <div
                    key={cat.id}
                    className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors duration-200"
                    onClick={() => {
                        logger.log('[CATEGORY DROPDOWN] Category clicked:', { platform, category: cat.name, id: cat.id });
                        onSelect(platform, cat);
                    }}
                >
                    <div className="flex-shrink-0">
                        {cat.box_art_url ? (
                            <img
                                src={cat.box_art_url.replace('{width}x{height}', '40x56')}
                                alt={cat.name}
                                className="w-8 h-10 rounded object-cover border border-border/50"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="w-8 h-10 bg-muted/50 rounded flex items-center justify-center border border-border/50">
                                <Tag className="w-4 h-4 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <span className="flex-1 truncate">{cat.name}</span>
                </div>
            ))}
        </div>
    );

    // Рендерим через портал в body для отображения поверх всех окон
    return ReactDOM.createPortal(dropdownContent, document.body);
};

interface StreamCategoryCardProps {
    onLinkStateChange?: (isLinked: boolean) => void;
}

const StreamCategoryCard: React.FC<StreamCategoryCardProps> = ({ onLinkStateChange }) => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status, categories, searchCategories } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_categories: combineCategories, combine_titles: combineTitles } = getCombineSettings();

    // ANTI-FLASH: Мемоизируем useMemo для вычисления isLinked напрямую из combineCategories
    // Это гарантирует, что значение всегда соответствует и нет моргания переключателя
    const isLinked = useMemo(() => combineCategories || false, [combineCategories]);
    const [searchTerms, setSearchTerms] = useState<{ twitch: string; vk: string }>({ twitch: '', vk: '' });
    const [showDropdown, setShowDropdown] = useState<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedTwitchSearch = useDebounce(searchTerms.twitch, 300); // 300ms задержка поиска
    const debouncedVkSearch = useDebounce(searchTerms.vk, 300);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const twitchInputRef = useRef<HTMLInputElement>(null);
    const vkInputRef = useRef<HTMLInputElement>(null);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);

    // Вычисляем размеры карточки
    // Высота 320px используется для объединенного режима (когда есть оба инпута)
    // Высота 280px используется когда один инпут (или режим связывания)
    const cardStyle = useMemo(() => {
        if (bothEnabled && !isLinked) {
            // В раздельном режиме - два инпута
            return {
                width: '100%',
                minHeight: '320px'
            };
        } else if (bothEnabled && isLinked) {
            // В объединенном режиме - категория, идентичная на обе платформы
            // Если связаны только тайтлы (категории нет) - оставляем высоту больше
            // Если связано всё - уменьшаем высоту
            const bothCardsLinked = combineTitles && combineCategories;
            return {
                width: '100%',
                minHeight: bothCardsLinked ? '280px' : '320px'
            };
        } else {
            // Один инпут
            return {
                width: '100%',
                minHeight: '280px'
            };
        }
    }, [bothEnabled, isLinked, combineTitles, combineCategories]);

    // Component state processed

    // ANTI-FLASH: Уведомляем родительский компонент об изменении isLinked
    // isLinked теперь вычисляется напрямую из combineCategories через useMemo, поэтому нет задержек синхронизации
    useEffect(() => {
        if (onLinkStateChange) {
            onLinkStateChange(isLinked);
        }
    }, [isLinked, onLinkStateChange]);

    // Обработчик изменения переключателя
    const handleToggleChange = async (value: boolean) => {
        const success = await updateSetting('combine_categories', value);
        if (success) {
            // isLinked теперь вычисляется из combineCategories через useMemo, поэтому обновление произойдет автоматически

            // При включении объединения - синхронизируем категорию Twitch на VK Live (или находим по маппингу)
            if (value && bothEnabled) {
                const twitchCategory = currentData.twitch?.category;

                if (twitchCategory) {
                    const twitchCat = twitchCategory as Category;
                    logger.log('[AUTO-SYNC] ===== START AUTO-SYNC =====');
                    logger.log('[AUTO-SYNC] Twitch category:', twitchCategory);
                    logger.log('[AUTO-SYNC] Twitch category name:', twitchCat.name);

                    // Проверяем маппинг категорий (Just Chatting > Разговорный жанр)
                    const mappedName = categoryMapping[twitchCat.name];
                    logger.log('[AUTO-SYNC] Mapping lookup result:', {
                        twitchName: twitchCat.name,
                        mappedName: mappedName,
                        hasMappedName: !!mappedName
                    });

                    let searchResults: Category[] | null = null;
                    let vkCategory: Category | null = null;

                    // Пытаемся найти по маппингу
                    if (mappedName) {
                        logger.log('[AUTO-SYNC] Trying mapped name:', mappedName);
                        searchResults = await searchCategories('vk', mappedName) as Category[];
                        logger.log('[AUTO-SYNC] Mapped search results:', searchResults);
                        logger.log('[AUTO-SYNC] Mapped search results count:', searchResults?.length || 0);
                        logger.log('[AUTO-SYNC] First result:', searchResults?.[0]);

                        if (searchResults && searchResults.length > 0) {
                            const candidate = searchResults[0];
                            logger.log('[AUTO-SYNC] Candidate category:', candidate);

                            // Для проверки нормализуем текст (удаляем символы!)
                            const catNormalized = candidate.name.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = mappedName.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();

                            // Разбиваем на слова для нечеткого сравнения
                            const catWords = catNormalized.split(/\s+/);
                            const queryWords = queryNormalized.split(/\s+/);

                            // Good match если:
                            // 1. Полное совпадение
                            // 2. Хотя бы 75% слов запроса есть в найденном
                            // 3. Первое слово совпадает (для вариантов "IRL" > "Реальная жизнь" не сработает, но тут OK)
                            const matchingWords = queryWords.filter(qw => catWords.includes(qw)).length;
                            const matchRatio = matchingWords / queryWords.length;

                            const isGoodMatch = catNormalized === queryNormalized ||
                                matchRatio >= 0.75 ||
                                (catWords[0] === queryWords[0] && matchingWords > 0);

                            if (isGoodMatch) {
                                vkCategory = candidate;
                                logger.log('[OK] [AUTO-SYNC] Found via mapping (good match):', vkCategory.name);
                            } else {
                                // Если маппинг задан жестко - берем даже если сомнительное совпадение
                                // (маппинг имеет высокий приоритет - доверяем ему)
                                vkCategory = candidate;
                                logger.log('[WARN] [AUTO-SYNC] Using mapped category despite low text match:', {
                                    mapped: mappedName,
                                    found: candidate.name,
                                    reason: 'Manual mapping takes priority'
                                });
                            }
                        }
                    }

                    // Если не нашли по маппингу - пробуем оригинальное название
                    if (!vkCategory) {
                        logger.log('[AUTO-SYNC] Trying original name:', twitchCat.name);
                        searchResults = await searchCategories('vk', twitchCat.name) as Category[];
                        logger.log('[AUTO-SYNC] Original search results:', searchResults?.length || 0);

                        if (searchResults && searchResults.length > 0) {
                            const candidate = searchResults[0];

                            // Проверяем соответствие - нормализуем текст (удаляем символы!)
                            const catNormalized = candidate.name.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = twitchCat.name.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();

                            // Разбиваем на слова для нечеткого сравнения
                            const catWords = catNormalized.split(/\s+/);
                            const queryWords = queryNormalized.split(/\s+/);

                            // Good match считается если:
                            // 1. Полное совпадение
                            // 2. Все слова запроса есть в найденном (более строгая проверка)
                            const isGoodMatch = catNormalized === queryNormalized ||
                                (queryWords.every(qw => catWords.includes(qw)) && queryWords.length >= 2);

                            if (isGoodMatch) {
                                vkCategory = candidate;
                                logger.log('[OK] [AUTO-SYNC] Found via original name (good match):', vkCategory.name);
                            } else {
                                logger.warn('[WARN] [AUTO-SYNC] Found category but relevance too low:', {
                                    query: twitchCat.name,
                                    found: candidate.name,
                                    normalized: { query: queryNormalized, category: catNormalized }
                                });
                            }
                        }
                    }

                    if (searchResults && searchResults.length > 0) {
                        logger.log('[AUTO-SYNC] Top 3 results:', searchResults.slice(0, 3).map(c => ({ name: c.name, id: c.id })));
                    }

                    if (vkCategory) {
                        // Нашли VK категорию!
                        logger.log('[OK] [AUTO-SYNC] Found VK category by name:', {
                            twitch: twitchCat.name,
                            vk: vkCategory.name,
                            vkId: vkCategory.id
                        });

                        setCurrentData(prev => ({
                            ...prev,
                            vk: { ...prev.vk, category: { ...vkCategory, id: String(vkCategory.id) } }
                        }));

                        const vkPayload = {
                            category: {
                                id: String(vkCategory.id),
                                name: vkCategory.name || vkCategory.title || "",
                                title: vkCategory.name || vkCategory.title || "",
                                type: vkCategory.type || "games",
                                cover_url: vkCategory.cover_url
                            },
                            category_id: String(vkCategory.id)
                        };

                        // Обновляем запрос: Twitch категорию, VK категорию (полное тело для сохранения)
                        const payload = {
                            twitch: { category_id: String(twitchCat.id) },
                            vk: vkPayload
                        };

                        logger.log('[SAVE] [AUTO-SYNC] Final payload (both platforms):', payload);

                        // Уведомляем об успешной синхронизации
                        toast.success(`Категории синхронизированы: Twitch > VK Live (${vkCategory.name})`);

                        saveChanges(payload, 'saveCategory');
                    } else {
                        // Не нашли VK категорию - меняем только Twitch, VK оставляем как было
                        logger.warn('[WARN] [AUTO-SYNC] Could not find VK category for:', twitchCat.name);
                        logger.warn('[TIP] [AUTO-SYNC] Only Twitch category will be updated. VK category unchanged.');

                        const payload = {
                            twitch: { category_id: String(twitchCat.id) }
                            // VK не добавляем - сохраняем как было!
                        };

                        logger.log('[SAVE] [AUTO-SYNC] Final payload (Twitch only):', payload);

                        // Уведомляем что VK категория осталась прежней
                        toast.warning(`VK Live категория для "${twitchCat.name}" не найдена. Обновлена только Twitch категория.`);

                        saveChanges(payload, 'saveCategory');
                    }
                }
            }
        }
    };

    // Debug logging disabled for performance

    // Синхронизируем searchTerms при переключении и загрузке данных
    useEffect(() => {
        const twitchCat = currentData.twitch?.category as Category | undefined;
        const vkCat = currentData.vk?.category as Category | undefined;
        const twitchCategoryName = twitchCat?.name || '';
        const vkCategoryName = vkCat?.name || '';

        setSearchTerms({
            twitch: twitchCategoryName,
            vk: vkCategoryName,
        });
    }, [currentData.twitch?.category, currentData.vk?.category]);

    useEffect(() => {
        // Only search when the dropdown is open and there's a search term
        if (debouncedTwitchSearch && debouncedTwitchSearch.length >= 2 && showDropdown.twitch && twitchEnabled) {
            logger.log('[SEARCH] Debounced Twitch search:', debouncedTwitchSearch);
            searchCategories('twitch', debouncedTwitchSearch);
        }
    }, [debouncedTwitchSearch, showDropdown.twitch, searchCategories, twitchEnabled]);

    useEffect(() => {
        // Only search when the dropdown is open and there's a search term
        if (debouncedVkSearch && debouncedVkSearch.length >= 2 && showDropdown.vk && vkEnabled) {
            logger.log('[SEARCH] Debounced VK search:', debouncedVkSearch);
            searchCategories('vk', debouncedVkSearch);
        }
    }, [debouncedVkSearch, showDropdown.vk, searchCategories, vkEnabled]);

    // Handle click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Проверяем, что клик не внутри dropdown (Portal) и не внутри карточки поиска
            const isClickInsidePortal = (event.target as Element).closest('[data-category-dropdown]');
            const isClickInsideCard = dropdownRef.current && dropdownRef.current.contains(event.target as Node);

            if (!isClickInsidePortal && !isClickInsideCard) {
                // logger.log('StreamCategoryCard: Click outside, closing dropdowns');
                // Возвращаем к исходному значению при клике вне области
                const twitchCat = currentData.twitch?.category as Category | undefined;
                const vkCat = currentData.vk?.category as Category | undefined;
                const originalTwitch = twitchCat?.name || '';
                const originalVk = vkCat?.name || '';
                setSearchTerms({ twitch: originalTwitch, vk: originalVk });
                setShowDropdown({ twitch: false, vk: false });
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [currentData]);

    // Handle focus events to manage dropdown state
    useEffect(() => {
        const handleFocusIn = (event: FocusEvent) => {
            if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
                // logger.log('StreamCategoryCard: Focus inside dropdown area');
                // Не закрываем dropdown при фокусе внутри карточки
            }
        };

        const handleFocusOut = (event: FocusEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // logger.log('StreamCategoryCard: Focus outside dropdown area');
                // Закрываем dropdown только если фокус ушел полностью из карточки
                setTimeout(() => {
                    if (!dropdownRef.current?.contains(document.activeElement)) {
                        const twitchCat = currentData.twitch?.category as Category | undefined;
                        const vkCat = currentData.vk?.category as Category | undefined;
                        const originalTwitch = twitchCat?.name || '';
                        const originalVk = vkCat?.name || '';
                        setSearchTerms({ twitch: originalTwitch, vk: originalVk });
                        setShowDropdown({ twitch: false, vk: false });
                    }
                }, 100);
            }
        };

        document.addEventListener("focusin", handleFocusIn);
        document.addEventListener("focusout", handleFocusOut);
        return () => {
            document.removeEventListener("focusin", handleFocusIn);
            document.removeEventListener("focusout", handleFocusOut);
        };
    }, [currentData]);

    const handleSearchChange = (platform: string, value: string) => {
        logger.log('[INPUT] Search change:', { platform, value, length: value.length });

        // Не удаляем пробелы - это мешает при наборе составных названий
        const trimmedValue = value; // убрал .trim() - мешает печатать!

        if (isLinked && bothEnabled) {
            setSearchTerms({ twitch: trimmedValue, vk: trimmedValue });
            setShowDropdown({ twitch: true, vk: true });
        } else {
            setSearchTerms(prev => ({ ...prev, [platform]: trimmedValue }));
            // Открываем dropdown только конкретно для этого input
            setShowDropdown({ twitch: false, vk: false, [platform]: true });
        }
    };

    const handleSearchFocus = (platform: string) => {
        // logger.log('StreamCategoryCard: Search focus:', { platform });
        // Открываем dropdown только конкретно для текущего инпута
        setShowDropdown({ twitch: false, vk: false, [platform]: true });

        // Очищаем поле при фокусе, если в нем текущее значение категории
        const platformData = currentData[platform as 'twitch' | 'vk'];
        const platformCat = platformData?.category as Category | undefined;
        const currentCategoryName = platformCat?.name || '';
        if (searchTerms[platform as keyof typeof searchTerms] === currentCategoryName) {
            // logger.log('StreamCategoryCard: Clearing field on focus');
            setSearchTerms(prev => ({ ...prev, [platform]: '' }));

            // Выделяем текст чтобы было удобно печатать
            setTimeout(() => {
                const input = document.querySelector(`input[data-platform="${platform}"]`) as HTMLInputElement;
                if (input) {
                    input.select();
                }
            }, 0);
        }
    };



    const handleSearchKeyDown = (platform: string, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            // logger.log('StreamCategoryCard: ESC pressed, reverting to original value');
            const platformData = currentData[platform as 'twitch' | 'vk'];
            const platformCat = platformData?.category as Category | undefined;
            const originalValue = platformCat?.name || '';
            setSearchTerms(prev => ({ ...prev, [platform]: originalValue }));
            setShowDropdown(prev => ({ ...prev, [platform]: false }));
            e.currentTarget.blur(); // Снимаем фокус с поля
        }
    };

    const handleCategorySelect = async (platform: string, category: Category) => {
        // Очищаем таймер автосброса, если пользователь выбирает категорию
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        logger.log('[HANDLE SELECT] Category selected:', { platform, category: category.name, id: category.id, isLinked, bothEnabled });

        if (isLinked && bothEnabled) {
            // В объединенном режиме ищем соответствующую категорию для второй платформы
            const otherPlatform: 'twitch' | 'vk' = platform === 'twitch' ? 'vk' : 'twitch';
            const categoriesTyped = categories as { twitch?: Category[]; vk?: Category[] };
            const otherCategories = categoriesTyped[otherPlatform] || [];

            // Ищем соответствующую категорию во второй платформе
            let mappedCategory = findMappedCategory(category.name, platform as 'twitch' | 'vk', otherCategories);
            logger.log('[HANDLE SELECT] Mapped category (from cache):', { otherPlatform, mappedCategory: mappedCategory?.name });

            // Если не нашли в кэше - ищем через API!
            if (!mappedCategory) {
                // Пытаемся мапить (если есть)
                const mappedName = categoryMapping[category.name];
                const searchQuery = mappedName || category.name; // Если нет маппинга - ищем по оригинальному названию

                logger.log('[HANDLE SELECT] Not found in cache - searching API:', {
                    hasMappedName: !!mappedName,
                    mappedName,
                    searchQuery
                });

                try {
                    const searchResults = await searchCategories(otherPlatform, searchQuery) as Category[];
                    logger.log('[HANDLE SELECT] API search results:', searchResults?.length || 0);

                    if (searchResults && searchResults.length > 0) {
                        // Пробуем найти идеальное совпадение
                        mappedCategory = searchResults.find(cat =>
                            cat.name && cat.name.toLowerCase() === searchQuery.toLowerCase()
                        ) || null;

                        if (!mappedCategory) {
                            // Если точного нет - используем первое совпадение (если релевантно)
                            const candidate = searchResults[0];
                            const catNormalized = candidate.name.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = searchQuery.toLowerCase().replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();

                            // Проверка соответствия (не берем мусор!)
                            if (catNormalized === queryNormalized ||
                                catNormalized.startsWith(queryNormalized) ||
                                queryNormalized.split(/\s+/).every(word => catNormalized.includes(word))) {
                                mappedCategory = candidate;
                                logger.log('[HANDLE SELECT] Using first result (relevant):', mappedCategory.name);
                            } else {
                                logger.warn('[HANDLE SELECT] First result not relevant:', {
                                    query: searchQuery,
                                    found: candidate.name
                                });
                            }
                        } else {
                            logger.log('[HANDLE SELECT] Found exact match via API:', mappedCategory.name);
                        }
                    } else {
                        logger.warn('[HANDLE SELECT] No results from API for:', searchQuery);
                    }
                } catch (error) {
                    logger.error('[HANDLE SELECT] Error searching for category:', error);
                }
            }

            if (mappedCategory) {
                // Нашли соответствующую категорию - устанавливаем парную категорию для второй платформы
                logger.log('[HANDLE SELECT] Setting linked categories');
                setCurrentData(prev => ({
                    ...prev,
                    [platform as 'twitch' | 'vk']: { ...prev[platform as 'twitch' | 'vk'], category },
                    [otherPlatform]: { ...prev[otherPlatform], category: mappedCategory },
                }));

                // Уведомляем об успешной синхронизации
                toast.success(`Категория синхронизирована: ${category.name} > ${mappedCategory.name}`);
            } else {
                // Не нашли соответствующую категорию - не беда!
                // Пользователь может выбрать вторую категорию во втором дропдауне
                logger.log('[HANDLE SELECT] Mapping not found - only updating selected platform');
                setCurrentData(prev => ({
                    ...prev,
                    [platform as 'twitch' | 'vk']: { ...prev[platform as 'twitch' | 'vk'], category },
                    // Второй платформу оставим старой категорией
                }));

                // Уведомляем что вторая не найдена и не будет изменена
                const platformNames: { [key: string]: string } = {
                    'twitch': 'Twitch',
                    'vk': 'VK Live'
                };
                toast.warning(`Категория "${category.name}" изменена только на ${platformNames[platform]}. Для ${platformNames[otherPlatform]} выберите категорию вручную.`);
            }
        } else {
            logger.log('[HANDLE SELECT] Setting single platform category');
            setCurrentData(prev => ({
                ...prev,
                [platform as 'twitch' | 'vk']: { ...prev[platform as 'twitch' | 'vk'], category },
            }));
        }
        setSearchTerms(prev => ({ ...prev, [platform]: category.name })); // Update search bar with selected category
        setShowDropdown({ twitch: false, vk: false });
        logger.log('[HANDLE SELECT] Category selection completed');

        // Отладка проверки состояния после обновления стейта (через useState асинхронно)
        setTimeout(() => {
            logger.log('[GAME] [HANDLE SELECT] Final state after selection:', {
                platform,
                categoryName: category.name,
                categoryId: category.id
            });
        }, 100);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isChanged && status.saveCategory !== 'loading' && status.saveCategory !== 'success') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode: 'both' | 'individual') => {
        logger.log('[DB] [SAVE] handleSave called:', { mode, isChanged, twitchEnabled, vkEnabled });

        // Очищаем таймер автосброса (пользователь сохранил вручную)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('[TIMEOUT] [AUTO-RESET] Timer cleared - user saved manually');
        }

        const payload: Record<string, unknown> = {};

        // Helper to get category ID
        const getCatId = (cat: unknown): string | number | null => (cat as Category | undefined)?.id || null;

        if (mode === 'both') {
            // Объединенный режим - сохраняем соответствующие категории для обоих платформ
            if (twitchEnabled && getCatId(currentData.twitch?.category) !== getCatId(initialData.twitch?.category)) {
                payload.twitch = { category_id: getCatId(currentData.twitch?.category) };
            }
            if (vkEnabled && getCatId(currentData.vk?.category) !== getCatId(initialData.vk?.category)) {
                // VK требует полных данных категории
                const vkCat = currentData.vk?.category as Category | undefined;

                // Защита: проверим, что это не Twitch ID (UUID vs numeric string)
                // VK ID - UUID в кавычках (например, "08c87647-7076-4e2c-8e1b-bc695c78728a")
                // Twitch ID - цифровая string (например, "1469308723")
                const isVkUUID = vkCat?.id && String(vkCat.id).includes('-');

                if (!isVkUUID && vkCat?.id) {
                    logger.error('[ERROR] [SAVE] VK category has Twitch-like ID! Skipping VK update to prevent error:', vkCat.id);
                    logger.warn('[INFO] [SAVE] Only Twitch will be updated. Please select VK category manually or use toggle.');

                    // Уведомляем пользователя
                    toast.warning('VK Live категория не обновлена (некорректный ID). Обновлена только Twitch категория.');
                } else {
                    const vkCategoryPayload: Record<string, unknown> = {
                        id: vkCat?.id || "",
                        name: vkCat?.name || vkCat?.title || "",
                        title: vkCat?.name || vkCat?.title || "",
                        type: vkCat?.type || "games"
                    };

                    // Добавляем cover_url только если он есть (VK API не принимает пустую строку)
                    const coverUrl = vkCat?.box_art_url || vkCat?.cover_url || "";
                    if (coverUrl) {
                        vkCategoryPayload.cover_url = coverUrl;
                    }

                    payload.vk = {
                        category: vkCategoryPayload,
                        category_id: vkCat?.id || null // Fallback для совместимости
                    };
                }
            }
        } else {
            // Раздельный режим - сохраняем только измененные платформы
            if (twitchEnabled && getCatId(currentData.twitch?.category) !== getCatId(initialData.twitch?.category)) {
                payload.twitch = { category_id: getCatId(currentData.twitch?.category) };
                logger.log('[DB] [SAVE] Added Twitch to payload:', payload.twitch);
            }
            if (vkEnabled && getCatId(currentData.vk?.category) !== getCatId(initialData.vk?.category)) {
                // VK требует полных данных категории (даже в раздельном режиме!)
                const vkCat = currentData.vk?.category as Category | undefined;

                // Защита: проверим, что это не Twitch ID (UUID vs numeric string)
                const isVkUUID = vkCat?.id && String(vkCat.id).includes('-');

                if (!isVkUUID && vkCat?.id) {
                    logger.error('[ERROR] [SAVE] VK category has Twitch-like ID! Skipping VK update:', vkCat.id);

                    // Уведомляем пользователя
                    toast.warning('VK Live категория не обновлена (некорректный ID). Пожалуйста, выберите VK категорию вручную.');
                } else {
                    const vkCategoryPayload: Record<string, unknown> = {
                        id: vkCat?.id || "",
                        name: vkCat?.name || vkCat?.title || "",
                        title: vkCat?.name || vkCat?.title || "",
                        type: vkCat?.type || "games"
                    };

                    // Добавляем cover_url только если он есть (VK API не принимает пустую строку)
                    const coverUrl = vkCat?.box_art_url || vkCat?.cover_url || "";
                    if (coverUrl) {
                        vkCategoryPayload.cover_url = coverUrl;
                    }

                    payload.vk = {
                        category: vkCategoryPayload,
                        category_id: vkCat?.id || null // Fallback для совместимости
                    };
                    logger.log('[DB] [SAVE] Added VK to payload (full object):', payload.vk);
                }
            }
        }

        logger.log('[DB] [SAVE] Final payload:', payload);

        if (Object.keys(payload).length > 0) {
            logger.log('[DB] [SAVE] Calling saveChanges...');
            saveChanges(payload, 'saveCategory');
        } else {
            logger.log('[WARN] [SAVE] Payload is empty, not saving');
        }
    };

    // LEGACY: Проверка изменения категорий (сложная!)
    const isChanged = useMemo(() => {
        const getCategoryId = (category: unknown): string | number | null => {
            return (category as Category | undefined)?.id || null;
        };

        const twitchInitialId = getCategoryId(initialData.twitch?.category);
        const twitchCurrentId = getCategoryId(currentData.twitch?.category);
        const vkInitialId = getCategoryId(initialData.vk?.category);
        const vkCurrentId = getCategoryId(currentData.vk?.category);

        const categoryChanged =
            (twitchEnabled && twitchInitialId !== twitchCurrentId) ||
            (vkEnabled && vkInitialId !== vkCurrentId);

        logger.log('[DEBUG] [IS CHANGED] Simple check:', {
            twitchEnabled,
            vkEnabled,
            twitchInitial: twitchInitialId,
            twitchCurrent: twitchCurrentId,
            vkInitial: vkInitialId,
            vkCurrent: vkCurrentId,
            result: categoryChanged
        });
        return categoryChanged;
    }, [initialData.twitch?.category, initialData.vk?.category, currentData.twitch?.category, currentData.vk?.category, twitchEnabled, vkEnabled]);

    // Таймер автосброса после 10 секунд, если пользователь не сохранил
    // [START] FIX: Запускаем таймер автосброса только когда пользователь убрал фокус с инпута поиска
    const handleInputBlur = () => {
        // Очищаем предыдущий таймер
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        // Если есть несохраненные изменения - запускаем таймер через 200ms (чтобы кликнуть опцию не мешало)
        if (isChanged && status.saveCategory !== 'loading' && status.saveCategory !== 'success') {
            logger.log('[TIMEOUT] [AUTO-RESET] Input blurred - starting 10s timer to reset unsaved changes');

            // Используем useTimeout для автосброса
            autoSaveTimerRef.current = setTimeout(() => {
                // Проверяем, что изменения всё ещё есть (пользователь не сохранил)
                const stillChanged =
                    (twitchEnabled && JSON.stringify(initialData.twitch?.category) !== JSON.stringify(currentData.twitch?.category)) ||
                    (vkEnabled && JSON.stringify(initialData.vk?.category) !== JSON.stringify(currentData.vk?.category));

                if (!stillChanged) {
                    logger.log('[TIMEOUT] [AUTO-RESET] Skipping reset - changes were already saved');
                    return;
                }

                logger.log('[TIMEOUT] [AUTO-RESET] 10 seconds passed - resetting to initial data');

                // Сбрасываем к исходным данным
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch, category: initialData.twitch?.category },
                    vk: { ...prev.vk, category: initialData.vk?.category }
                }));

                // Обновляем поиск
                const initTwitchCat = initialData.twitch?.category as Category | undefined;
                const initVkCat = initialData.vk?.category as Category | undefined;
                setSearchTerms({
                    twitch: initTwitchCat?.name || '',
                    vk: initVkCat?.name || ''
                });

                // Уведомляем пользователя
                toast.info('Изменения категорий сброшены (вы не сохранили в течение 10 секунд)');
            }, 10000); // 10 секунд
        }
    };

    // Очищаем таймер при получении фокуса (пользователь снова начал редактировать)
    const handleInputFocus = () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('[TIMEOUT] [AUTO-RESET] Input focused - clearing timer');
        }
    };

    // Cleanup таймеры при размонтировании
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, []);

    // [START] ANTI-FLASH: Показываем skeleton пока данные не загружены
    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);

    return (
        <Card className="flex flex-col overflow-hidden h-full" style={cardStyle}>
            <CardHeader className="flex-shrink-0 pb-3"><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-green-500" /> Категория стрима</CardTitle></CardHeader>
            <CardContent ref={dropdownRef} className="p-3 flex-1 flex flex-col overflow-y-auto" >
                {!isDataLoaded ? (
                    // Показываем стандартный placeholder пока данные загружаются
                    <div className="flex-1 flex items-center justify-center opacity-50">
                        <div className="animate-pulse space-y-3 w-full max-w-2xl">
                            <div className="h-10 bg-muted rounded"></div>
                            <div className="h-10 bg-muted rounded"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Toggle объединения полей */}
                        {bothEnabled && (
                            <div className="flex items-center justify-between p-2 bg-background/10 rounded-lg mb-2">
                                <Label htmlFor="link-categories" className="flex items-center gap-2 cursor-pointer text-sm">
                                    {isLinked ? <Link className="h-4 w-4 text-green-500" /> : <Unlink className="h-4 w-4" />}
                                    Связать категории
                                </Label>
                                <Switch
                                    id="link-categories"
                                    checked={isLinked}
                                    onCheckedChange={handleToggleChange}
                                    disabled={!bothEnabled}
                                />
                            </div>
                        )}
                        {/* Поля ввода */}
                        <div className="flex-1 flex items-center">
                            {isLinked && bothEnabled ? (
                                <div className="space-y-2 w-full mx-auto max-w-2xl">
                                    <Label className="flex items-center gap-2 text-sm">
                                        <TwitchIcon /><VKIcon /> Общая категория
                                    </Label>
                                    <div className="flex gap-2 items-center relative">
                                        {currentData.twitch?.category && (currentData.twitch.category as Category).box_art_url && (
                                            <img
                                                src={(currentData.twitch.category as Category).box_art_url?.replace('{width}x{height}', '32x44')}
                                                alt={(currentData.twitch.category as Category).name}
                                                className="w-6 h-8 rounded object-cover border border-border/50 flex-shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 relative">
                                            <Input
                                                value={searchTerms.twitch}
                                                onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                                onFocus={() => {
                                                    handleInputFocus(); // Очищаем таймер автосброса
                                                    // Открываем dropdown
                                                    setShowDropdown({ twitch: true, vk: true });
                                                    // Очищаем поле при фокусе если в нем назвние текущей категории
                                                    const currentCategoryName = (currentData.twitch?.category as Category | undefined)?.name || '';
                                                    if (searchTerms.twitch === currentCategoryName) {
                                                        setSearchTerms(prev => ({ ...prev, twitch: '', vk: '' }));
                                                        // Выделяем поле чтобы было удобно
                                                        setTimeout(() => {
                                                            if (twitchInputRef.current) {
                                                                twitchInputRef.current.select();
                                                            }
                                                        }, 0);
                                                    }
                                                }}
                                                onBlur={handleInputBlur} // Запускаем таймер автосброса при потере фокуса
                                                onClick={() => {
                                                    // Для клика также очищаем, если это не выделение
                                                    const currentCategoryName = (currentData.twitch?.category as Category | undefined)?.name || '';
                                                    if (searchTerms.twitch === currentCategoryName) {
                                                        setSearchTerms(prev => ({ ...prev, twitch: '', vk: '' }));
                                                    }
                                                }}
                                                onKeyPress={handleKeyPress}
                                                placeholder="Поиск категории стрима..."
                                                className="h-10 text-base w-full"
                                                ref={twitchInputRef}
                                            />
                                            {showDropdown.twitch && (
                                                <CategoryDropdown
                                                    platform="twitch"
                                                    search={searchTerms.twitch}
                                                    onSelect={handleCategorySelect}
                                                    results={(categories as { twitch?: Category[] })?.twitch || []}
                                                    inputRef={twitchInputRef.current}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col space-y-2 w-full mx-auto max-w-2xl">
                                    {/* Поле Twitch */}
                                    <div className={`space-y-2 relative ${!twitchEnabled ? 'opacity-50' : ''}`}>
                                        <Label className="flex items-center gap-2 text-sm">
                                            <TwitchIcon /> Twitch
                                            {!twitchEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                        </Label>
                                        <div className="flex gap-2 items-center">
                                            {currentData.twitch?.category && (currentData.twitch.category as Category).box_art_url && (
                                                <img
                                                    src={(currentData.twitch.category as Category).box_art_url?.replace('{width}x{height}', '32x44')}
                                                    alt={(currentData.twitch.category as Category).name}
                                                    className="w-6 h-8 rounded object-cover border border-border/50 flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 relative">
                                                <Input
                                                    value={searchTerms.twitch}
                                                    onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                                    onFocus={() => {
                                                        handleInputFocus(); // Очищаем таймер автосброса
                                                        if (twitchEnabled) handleSearchFocus('twitch');
                                                    }}
                                                    onBlur={handleInputBlur} // Запускаем таймер автосброса при потере фокуса
                                                    onClick={() => { if (twitchEnabled) handleSearchFocus('twitch'); }}
                                                    onKeyDown={(e) => handleSearchKeyDown('twitch', e)}
                                                    onKeyPress={handleKeyPress}
                                                    placeholder={twitchEnabled ? "Поиск категории на Twitch..." : "Интеграция отключена"}
                                                    className={`h-10 text-base w-full ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                                    disabled={!twitchEnabled}
                                                    data-platform="twitch"
                                                    ref={twitchInputRef}
                                                />
                                                {showDropdown.twitch && twitchEnabled && (
                                                    <CategoryDropdown
                                                        platform="twitch"
                                                        search={searchTerms.twitch}
                                                        onSelect={handleCategorySelect}
                                                        results={(categories as { twitch?: Category[] })?.twitch || []}
                                                        inputRef={twitchInputRef.current}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Поле VK Live */}
                                    <div className={`space-y-2 relative ${!vkEnabled ? 'opacity-50' : ''}`}>
                                        <Label className="flex items-center gap-2 text-sm">
                                            <VKIcon /> VK Live
                                            {!vkEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                        </Label>
                                        <div className="flex gap-2 items-center">
                                            {currentData.vk?.category && ((currentData.vk.category as Category).box_art_url || (currentData.vk.category as Category).cover_url) && (
                                                <img
                                                    src={(currentData.vk.category as Category).box_art_url || (currentData.vk.category as Category).cover_url}
                                                    alt={(currentData.vk.category as Category).name}
                                                    className="w-6 h-8 rounded object-cover border border-border/50 flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 relative">
                                                <Input
                                                    value={searchTerms.vk}
                                                    onChange={(e) => handleSearchChange('vk', e.target.value)}
                                                    onFocus={() => {
                                                        handleInputFocus(); // Очищаем таймер автосброса
                                                        if (vkEnabled) handleSearchFocus('vk');
                                                    }}
                                                    onBlur={handleInputBlur} // Запускаем таймер автосброса при потере фокуса
                                                    onClick={() => { if (vkEnabled) handleSearchFocus('vk'); }}
                                                    onKeyDown={(e) => handleSearchKeyDown('vk', e)}
                                                    onKeyPress={handleKeyPress}
                                                    placeholder={vkEnabled ? "Поиск категории на VK Live..." : "Интеграция отключена"}
                                                    className={`h-10 text-base w-full ${!vkEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                                    disabled={!vkEnabled}
                                                    data-platform="vk"
                                                    ref={vkInputRef}
                                                />
                                                {showDropdown.vk && vkEnabled && (
                                                    <CategoryDropdown
                                                        platform="vk"
                                                        search={searchTerms.vk}
                                                        onSelect={handleCategorySelect}
                                                        results={(categories as { vk?: Category[] })?.vk || []}
                                                        inputRef={vkInputRef.current}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>

            {/* Кнопка сохранения - вынесена из CardContent */}
            {isDataLoaded && hasAnyIntegration && (
                <div className="p-3 pt-0 flex-shrink-0">
                    <Button
                        onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                        disabled={status.saveCategory === 'loading' || status.saveCategory === 'success' || !isChanged}
                        size="sm"
                        className="w-full flex items-center gap-2"
                    >
                        {status.saveCategory === 'loading' ? (
                            <Loader className="h-4 w-4 animate-spin" />
                        ) : status.saveCategory === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {status.saveCategory === 'loading' ? 'Сохранение...' : status.saveCategory === 'success' ? 'Сохранено' : 'Сохранить'}
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default StreamCategoryCard;
