// src/components/StreamCategoryCard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tag, CheckCircle, XCircle, Save, Loader, Link, Unlink } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';
import { useData } from '../context/DataContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useUserSettings } from '../context/UserSettingsContext';
import { useAuth } from '../context/AuthContext';
import { findMappedCategory, categoryMapping } from '../constants/categoryMapping';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

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

    // Получаем позицию инпута для правильного позиционирования
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
                        logger.log('🎮 [CATEGORY DROPDOWN] Category clicked:', { platform, category: cat.name, id: cat.id });
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
    
    // Рендерим через портал в body для отображения поверх всех элементов
    return ReactDOM.createPortal(dropdownContent, document.body);
};

interface StreamCategoryCardProps {
    onLinkStateChange?: (isLinked: boolean) => void;
}

const StreamCategoryCard: React.FC<StreamCategoryCardProps> = ({ onLinkStateChange }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status, categories, searchCategories } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_categories: combineCategories, combine_titles: combineTitles } = getCombineSettings();
    // 🚀 ANTI-FLASH: Используем useMemo для вычисления isLinked напрямую из combineCategories
    // Это гарантирует, что значение всегда синхронизировано и нет видимого переключения
    const isLinked = useMemo(() => combineCategories || false, [combineCategories]);
    const [searchTerms, setSearchTerms] = useState<{ twitch: string; vk: string }>({ twitch: '', vk: '' });
    const [showDropdown, setShowDropdown] = useState<{ twitch: boolean; vk: boolean }>({ twitch: false, vk: false });
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedTwitchSearch = useDebounce(searchTerms.twitch, 300); // Быстрая отзывчивость
    const debouncedVkSearch = useDebounce(searchTerms.vk, 300);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const twitchInputRef = useRef<HTMLInputElement>(null);
    const vkInputRef = useRef<HTMLInputElement>(null);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);

    // Адаптивные размеры карточки
    // Высота НЕ уменьшается при объединении одной карточки
    // Высота уменьшается ТОЛЬКО когда обе карточки (название И категория) объединены
    const cardStyle = useMemo(() => {
        if (bothEnabled && !isLinked) {
            // В раздельном режиме - две платформы
            return { 
                width: '100%',
                minHeight: '320px'
            };
        } else if (bothEnabled && isLinked) {
            // В объединенном режиме - проверяем, объединены ли ОБЕ карточки
            // Если объединена только одна (название ИЛИ категория) - оставляем полную высоту
            // Если объединены обе - уменьшаем высоту
            const bothCardsLinked = combineTitles && combineCategories;
            return { 
                width: '100%',
                minHeight: bothCardsLinked ? '280px' : '320px'
            };
        } else {
            // Одна платформа
            return { 
                width: '100%',
                minHeight: '280px'
            };
        }
    }, [bothEnabled, isLinked, combineTitles, combineCategories]);

    // Component state processed

    // 🚀 ANTI-FLASH: Уведомляем родительский компонент об изменении isLinked
    // isLinked теперь вычисляется напрямую из combineCategories через useMemo, поэтому нет видимого переключения
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
            
            // При включении объединения - синхронизируем категорию Twitch на VK Live (или близкую по маппингу)
            if (value && bothEnabled) {
                const twitchCategory = currentData.twitch?.category;
                
                if (twitchCategory) {
                    logger.log('🔍 [AUTO-SYNC] ===== START AUTO-SYNC =====');
                    logger.log('🔍 [AUTO-SYNC] Twitch category:', twitchCategory);
                    logger.log('🔍 [AUTO-SYNC] Twitch category name:', (twitchCategory as any).name);
                    
                    // Применяем маппинг категорий (Just Chatting → Говорим и смотрим)
                    const mappedName = categoryMapping[(twitchCategory as any).name];
                    logger.log('🔍 [AUTO-SYNC] Mapping lookup result:', {
                        twitchName: (twitchCategory as any).name,
                        mappedName: mappedName,
                        hasMappedName: !!mappedName
                    });
                    
                    let searchResults: Category[] | null = null;
                    let vkCategory: Category | null = null;
                    
                    // Сначала пробуем маппинг
                    if (mappedName) {
                        logger.log('🔍 [AUTO-SYNC] Trying mapped name:', mappedName);
                        searchResults = await searchCategories('vk', mappedName) as Category[];
                        logger.log('🔍 [AUTO-SYNC] Mapped search results:', searchResults);
                        logger.log('🔍 [AUTO-SYNC] Mapped search results count:', searchResults?.length || 0);
                        logger.log('🔍 [AUTO-SYNC] First result:', searchResults?.[0]);
                        
                        if (searchResults && searchResults.length > 0) {
                            const candidate = searchResults[0];
                            logger.log('🔍 [AUTO-SYNC] Candidate category:', candidate);
                            
                            // Для маппинга используем МЯГКУЮ проверку (доверяем маппингу!)
                            const catNormalized = candidate.name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = mappedName.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            
                            // Разбиваем на слова для точного сравнения
                            const catWords = catNormalized.split(/\s+/);
                            const queryWords = queryNormalized.split(/\s+/);
                            
                            // Good match если:
                            // 1. Точное совпадение
                            // 2. Хотя бы 75% слов запроса есть в категории
                            // 3. Первое слово совпадает (для маппинга "IRL" → "Реальная жизнь" не сработает, но это OK)
                            const matchingWords = queryWords.filter(qw => catWords.includes(qw)).length;
                            const matchRatio = matchingWords / queryWords.length;
                            
                            const isGoodMatch = catNormalized === queryNormalized || 
                                              matchRatio >= 0.75 ||
                                              (catWords[0] === queryWords[0] && matchingWords > 0);
                            
                            if (isGoodMatch) {
                                vkCategory = candidate;
                                logger.log('✅ [AUTO-SYNC] Found via mapping (good match):', vkCategory.name);
                            } else {
                                // Для маппинга берем первый результат даже если релевантность низкая
                                // (маппинг создан вручную - доверяем ему)
                                vkCategory = candidate;
                                logger.log('⚠️ [AUTO-SYNC] Using mapped category despite low text match:', {
                                    mapped: mappedName,
                                    found: candidate.name,
                                    reason: 'Manual mapping takes priority'
                                });
                            }
                        }
                    }
                    
                    // Если по маппингу не нашли - пробуем оригинальное название
                    if (!vkCategory) {
                        logger.log('🔍 [AUTO-SYNC] Trying original name:', (twitchCategory as any).name);
                        searchResults = await searchCategories('vk', (twitchCategory as any).name) as Category[];
                        logger.log('🔍 [AUTO-SYNC] Original search results:', searchResults?.length || 0);
                        
                        if (searchResults && searchResults.length > 0) {
                            const candidate = searchResults[0];
                            
                            // Проверяем релевантность - используем только если высокая (СТРОГАЯ проверка!)
                            const catNormalized = candidate.name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = (twitchCategory as any).name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            
                            // Разбиваем на слова для точного сравнения
                            const catWords = catNormalized.split(/\s+/);
                            const queryWords = queryNormalized.split(/\s+/);
                            
                            // Good match ТОЛЬКО если:
                            // 1. Точное совпадение
                            // 2. Все слова запроса есть в категории (для многословных запросов)
                            const isGoodMatch = catNormalized === queryNormalized || 
                                              (queryWords.every(qw => catWords.includes(qw)) && queryWords.length >= 2);
                            
                            if (isGoodMatch) {
                                vkCategory = candidate;
                                logger.log('✅ [AUTO-SYNC] Found via original name (good match):', vkCategory.name);
                            } else {
                                logger.warn('⚠️ [AUTO-SYNC] Found category but relevance too low:', {
                                    query: (twitchCategory as any).name,
                                    found: candidate.name,
                                    normalized: { query: queryNormalized, category: catNormalized }
                                });
                            }
                        }
                    }
                    
                    if (searchResults && searchResults.length > 0) {
                        logger.log('🔍 [AUTO-SYNC] Top 3 results:', searchResults.slice(0, 3).map(c => ({ name: c.name, id: c.id })));
                    }
                    
                    if (vkCategory) {
                        // Нашли VK категорию!
                        logger.log('✅ [AUTO-SYNC] Found VK category by name:', {
                            twitch: (twitchCategory as any).name,
                            vk: vkCategory.name,
                            vkId: vkCategory.id
                        });
                    
                    setCurrentData((prev: any) => ({
                        ...prev,
                        vk: { ...prev.vk, category: vkCategory }
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
                        
                        // Отправляем только Twitch категорию, VK категорию меняем только если нашли подходящую
                        const payload = {
                            twitch: { category_id: (twitchCategory as any).id },
                            vk: vkPayload
                        };
                        
                        logger.log('💾 [AUTO-SYNC] Final payload (both platforms):', payload);
                        
                        // Уведомление об успешной автосинхронизации
                        toast.success(`Категории синхронизированы: Twitch → VK Live (${vkCategory.name})`);
                        
                        saveChanges(payload, 'saveCategory');
                    } else {
                        // НЕ НАШЛИ VK категорию - меняем ТОЛЬКО Twitch, VK оставляем как есть
                        logger.warn('⚠️ [AUTO-SYNC] Could not find VK category for:', (twitchCategory as any).name);
                        logger.warn('💡 [AUTO-SYNC] Only Twitch category will be updated. VK category unchanged.');
                        
                    const payload: any = {
                            twitch: { category_id: (twitchCategory as any).id }
                            // VK НЕ включаем - оставляем как было!
                        };
                        
                        logger.log('💾 [AUTO-SYNC] Final payload (Twitch only):', payload);
                        
                        // Уведомление что VK категория не найдена
                        toast.warning(`VK Live категория для "${(twitchCategory as any).name}" не найдена. Обновлена только Twitch категория.`);
                        
                    saveChanges(payload, 'saveCategory');
                    }
                }
            }
        }
    };

    // Debug logging disabled for performance

    // Инициализация searchTerms при монтировании и изменении данных
    useEffect(() => {
        const twitchCategoryName = currentData.twitch?.category ? ((currentData.twitch.category as any).name || '') : '';
        const vkCategoryName = currentData.vk?.category ? ((currentData.vk.category as any).name || '') : '';
        
        setSearchTerms({
            twitch: twitchCategoryName,
            vk: vkCategoryName,
        });
    }, [currentData.twitch?.category, currentData.vk?.category]);
    
    useEffect(() => {
        // Only search when the dropdown is open and there's a search term
        if (debouncedTwitchSearch && debouncedTwitchSearch.length >= 2 && showDropdown.twitch && twitchEnabled) {
            logger.log('🔍 Debounced Twitch search:', debouncedTwitchSearch);
            searchCategories('twitch', debouncedTwitchSearch);
        }
    }, [debouncedTwitchSearch, showDropdown.twitch, searchCategories, twitchEnabled]);

    useEffect(() => {
        // Only search when the dropdown is open and there's a search term
        if (debouncedVkSearch && debouncedVkSearch.length >= 2 && showDropdown.vk && vkEnabled) {
            logger.log('🔍 Debounced VK search:', debouncedVkSearch);
            searchCategories('vk', debouncedVkSearch);
        }
    }, [debouncedVkSearch, showDropdown.vk, searchCategories, vkEnabled]);

    // Handle click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Проверяем, что клик не внутри dropdown (Portal) и не внутри основной области
            const isClickInsidePortal = (event.target as Element).closest('[data-category-dropdown]');
            const isClickInsideCard = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
            
            if (!isClickInsidePortal && !isClickInsideCard) {
                // logger.log('StreamCategoryCard: Click outside, closing dropdowns');
                // Возвращаем к исходным значениям при клике вне области
                const originalTwitch = currentData.twitch?.category ? ((currentData.twitch.category as any).name || '') : '';
                const originalVk = currentData.vk?.category ? ((currentData.vk.category as any).name || '') : '';
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
                // Не закрываем dropdown при фокусе внутри области
            }
        };

        const handleFocusOut = (event: FocusEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // logger.log('StreamCategoryCard: Focus outside dropdown area');
                // Закрываем dropdown только если фокус ушел полностью из области
                setTimeout(() => {
                    if (!dropdownRef.current?.contains(document.activeElement)) {
                        const originalTwitch = currentData.twitch?.category ? ((currentData.twitch.category as any).name || '') : '';
                        const originalVk = currentData.vk?.category ? ((currentData.vk.category as any).name || '') : '';
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
        logger.log('⌨️ Search change:', { platform, value, length: value.length });
        
        // НЕ убираем пробелы - они нужны для поиска категорий с пробелами
        const trimmedValue = value; // Убрали .trim() - пробелы разрешены!
        
        if (isLinked && bothEnabled) {
            setSearchTerms({ twitch: trimmedValue, vk: trimmedValue });
            setShowDropdown({ twitch: true, vk: true });
        } else {
            setSearchTerms(prev => ({ ...prev, [platform]: trimmedValue }));
            // Закрываем dropdown других платформ при вводе в текущий input
            setShowDropdown({ twitch: false, vk: false, [platform]: true });
        }
    };

    const handleSearchFocus = (platform: string) => {
        // logger.log('StreamCategoryCard: Search focus:', { platform });
        // Закрываем dropdown других платформ при открытии текущей
        setShowDropdown({ twitch: false, vk: false, [platform]: true });
        
        // Очищаем поле при фокусе, если в нем текущее значение категории
        const currentCategoryName = (currentData as any)[platform]?.category ? (((currentData as any)[platform].category as any).name || '') : '';
        if (searchTerms[platform as keyof typeof searchTerms] === currentCategoryName) {
            // logger.log('StreamCategoryCard: Clearing field on focus');
            setSearchTerms(prev => ({ ...prev, [platform]: '' }));
            
            // Выделяем весь текст для быстрого удаления
            setTimeout(() => {
                const input = document.querySelector(`input[data-platform="${platform}"]`) as HTMLInputElement;
                if (input) {
                    input.select();
                }
            }, 0);
        }
    };

    const handleSearchBlur = (platform: string) => {
        // logger.log('StreamCategoryCard: Search blur:', { platform });
        // Не закрываем dropdown при потере фокуса - только при клике вне области
        // Это предотвращает закрытие при клике в поле ввода
    };

    const handleSearchKeyDown = (platform: string, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            // logger.log('StreamCategoryCard: ESC pressed, reverting to original value');
            const originalValue = (currentData as any)[platform]?.category ? (((currentData as any)[platform].category as any).name || '') : '';
            setSearchTerms(prev => ({ ...prev, [platform]: originalValue }));
            setShowDropdown(prev => ({ ...prev, [platform]: false }));
            e.currentTarget.blur(); // Убираем фокус с поля
        }
    };

    const handleCategorySelect = async (platform: string, category: Category) => {
        // Очищаем таймер автосброса, пока пользователь выбирает категорию
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        
        logger.log('🎮 [HANDLE SELECT] Category selected:', { platform, category: category.name, id: category.id, isLinked, bothEnabled });
        
        if (isLinked && bothEnabled) {
            // В объединенном режиме ищем соответствующую категорию для другой платформы
            const otherPlatform: 'twitch' | 'vk' = platform === 'twitch' ? 'vk' : 'twitch';
            const otherCategories = (categories as any)[otherPlatform] || [];
            
            // Ищем соответствующую категорию на другой платформе
            let mappedCategory = findMappedCategory(category.name, platform as 'twitch' | 'vk', otherCategories);
            logger.log('🎮 [HANDLE SELECT] Mapped category (from cache):', { otherPlatform, mappedCategory: mappedCategory?.name });
            
            // Если не нашли в кеше - ИЩЕМ ЧЕРЕЗ API!
            if (!mappedCategory) {
                // Пробуем маппинг (если есть)
                const mappedName = categoryMapping[category.name];
                const searchQuery = mappedName || category.name; // Если нет маппинга - ищем по оригинальному названию
                
                logger.log('🎮 [HANDLE SELECT] Not found in cache - searching API:', {
                    hasMappedName: !!mappedName,
                    mappedName,
                    searchQuery
                });
                
                try {
                    const searchResults = await searchCategories(otherPlatform, searchQuery) as Category[];
                    logger.log('🎮 [HANDLE SELECT] API search results:', searchResults?.length || 0);
                    
                    if (searchResults && searchResults.length > 0) {
                        // Проверяем точное совпадение
                        mappedCategory = searchResults.find(cat => 
                            cat.name && cat.name.toLowerCase() === searchQuery.toLowerCase()
                        ) || null;
                        
                        if (!mappedCategory) {
                            // Если точного нет - используем первый результат (если релевантен)
                            const candidate = searchResults[0];
                            const catNormalized = candidate.name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            const queryNormalized = searchQuery.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
                            
                            // Проверяем релевантность (не берем мусор!)
                            if (catNormalized === queryNormalized || 
                                catNormalized.startsWith(queryNormalized) ||
                                queryNormalized.split(/\s+/).every(word => catNormalized.includes(word))) {
                                mappedCategory = candidate;
                                logger.log('🎮 [HANDLE SELECT] Using first result (relevant):', mappedCategory.name);
                            } else {
                                logger.warn('🎮 [HANDLE SELECT] First result not relevant:', {
                                    query: searchQuery,
                                    found: candidate.name
                                });
                            }
                        } else {
                            logger.log('🎮 [HANDLE SELECT] Found exact match via API:', mappedCategory.name);
                        }
                    } else {
                        logger.warn('🎮 [HANDLE SELECT] No results from API for:', searchQuery);
                    }
                } catch (error) {
                    logger.error('🎮 [HANDLE SELECT] Error searching for category:', error);
                }
            }
            
            if (mappedCategory) {
                // Нашли соответствующую категорию - устанавливаем разные категории для разных платформ
                logger.log('🎮 [HANDLE SELECT] Setting linked categories');
                setCurrentData((prev: any) => ({
                    ...prev,
                    [platform]: { ...prev[platform], category },
                    [otherPlatform]: { ...prev[otherPlatform], category: mappedCategory },
                }));
                
                // Уведомление об успешной синхронизации
                toast.success(`Категория синхронизирована: ${category.name} → ${mappedCategory.name}`);
            } else {
                // Не нашли соответствующую категорию - НЕ копируем!
                // Пользователь может вручную выбрать категорию на другой платформе
                logger.log('🎮 [HANDLE SELECT] Mapping not found - only updating selected platform');
                setCurrentData((prev: any) => ({
                    ...prev,
                    [platform]: { ...prev[platform], category },
                    // Другая платформа остается неизменной
                }));
                
                // Уведомление что категория не найдена на другой платформе
                const platformNames: { [key: string]: string } = {
                    'twitch': 'Twitch',
                    'vk': 'VK Live'
                };
                toast.warning(`Категория "${category.name}" обновлена только на ${platformNames[platform]}. Для ${platformNames[otherPlatform]} категория не найдена — выберите вручную.`);
            }
        } else {
            logger.log('🎮 [HANDLE SELECT] Setting single platform category');
            setCurrentData((prev: any) => ({
                ...prev,
                [platform]: { ...prev[platform], category },
            }));
        }
        setSearchTerms(prev => ({ ...prev, [platform]: category.name })); // Update search bar with selected category
        setShowDropdown({ twitch: false, vk: false });
        logger.log('🎮 [HANDLE SELECT] Category selection completed');
        
        // Логируем итоговое состояние после небольшой задержки (чтобы useState обновился)
        setTimeout(() => {
            logger.log('🎮 [HANDLE SELECT] Final state after selection:', {
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
        logger.log('💾 [SAVE] handleSave called:', { mode, isChanged, twitchEnabled, vkEnabled });
        
        // Очищаем таймер автосброса (пользователь сохраняет вручную)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('⏰ [AUTO-RESET] Timer cleared - user saved manually');
        }
        
        const payload: any = {};
        
        if (mode === 'both') {
            // Объединенный режим - сохраняем соответствующие категории для каждой платформы
            if (twitchEnabled && (currentData.twitch?.category ? ((currentData.twitch.category as any).id || null) : null) !== (initialData.twitch?.category ? ((initialData.twitch.category as any).id || null) : null)) {
                payload.twitch = { category_id: currentData.twitch?.category ? ((currentData.twitch.category as any).id || null) : null };
            }
            if (vkEnabled && (currentData.vk?.category ? ((currentData.vk.category as any).id || null) : null) !== (initialData.vk?.category ? ((initialData.vk.category as any).id || null) : null)) {
                // VK требует полный объект категории
                const vkCat = currentData.vk?.category as Category | undefined;
                
                // ЗАЩИТА: Проверяем, что это не Twitch ID (UUID vs numeric string)
                // VK ID - UUID с дефисами (например, "08c87647-7076-4e2c-8e1b-bc695c78728a")
                // Twitch ID - числовой string (например, "1469308723")
                const isVkUUID = vkCat?.id && String(vkCat.id).includes('-');
                
                if (!isVkUUID && vkCat?.id) {
                    logger.error('❌ [SAVE] VK category has Twitch-like ID! Skipping VK update to prevent error:', vkCat.id);
                    logger.warn('💡 [SAVE] Only Twitch will be updated. Please select VK category manually or use toggle.');
                    
                    // Уведомление пользователю
                    toast.warning('VK Live категория не обновлена (неверный формат). Обновлена только Twitch категория.');
                } else {
                    const vkCategoryPayload = {
                        id: vkCat?.id || "",
                        name: vkCat?.name || vkCat?.title || "",
                        title: vkCat?.name || vkCat?.title || "",
                        type: vkCat?.type || "games"
                    };
                    
                    // Добавляем cover_url только если он не пустой (VK API не принимает пустые строки)
                    const coverUrl = vkCat?.box_art_url || vkCat?.cover_url || "";
                    if (coverUrl) {
                        (vkCategoryPayload as any).cover_url = coverUrl;
                    }
                    
                payload.vk = { 
                        category: vkCategoryPayload,
                        category_id: vkCat?.id || null // Fallback для совместимости
                };
                }
            }
        } else {
            // Индивидуальный режим - сохраняем только измененные категории
            if (twitchEnabled && (currentData.twitch?.category ? ((currentData.twitch.category as any).id || null) : null) !== (initialData.twitch?.category ? ((initialData.twitch.category as any).id || null) : null)) {
                payload.twitch = { category_id: currentData.twitch?.category ? ((currentData.twitch.category as any).id || null) : null };
                logger.log('💾 [SAVE] Added Twitch to payload:', payload.twitch);
            }
            if (vkEnabled && (currentData.vk?.category ? ((currentData.vk.category as any).id || null) : null) !== (initialData.vk?.category ? ((initialData.vk.category as any).id || null) : null)) {
                // VK требует полный объект категории (даже в раздельном режиме!)
                const vkCat = currentData.vk?.category as Category | undefined;
                
                // ЗАЩИТА: Проверяем, что это не Twitch ID (UUID vs numeric string)
                const isVkUUID = vkCat?.id && String(vkCat.id).includes('-');
                
                if (!isVkUUID && vkCat?.id) {
                    logger.error('❌ [SAVE] VK category has Twitch-like ID! Skipping VK update:', vkCat.id);
                    
                    // Уведомление пользователю
                    toast.warning('VK Live категория не обновлена (неверный формат). Пожалуйста, выберите VK категорию вручную.');
                } else {
                    const vkCategoryPayload = {
                        id: vkCat?.id || "",
                        name: vkCat?.name || vkCat?.title || "",
                        title: vkCat?.name || vkCat?.title || "",
                        type: vkCat?.type || "games"
                    };
                    
                    // Добавляем cover_url только если он не пустой (VK API не принимает пустые строки)
                    const coverUrl = vkCat?.box_art_url || vkCat?.cover_url || "";
                    if (coverUrl) {
                        (vkCategoryPayload as any).cover_url = coverUrl;
                    }
                    
                payload.vk = { 
                        category: vkCategoryPayload,
                        category_id: vkCat?.id || null // Fallback для совместимости
                };
                    logger.log('💾 [SAVE] Added VK to payload (full object):', payload.vk);
                }
            }
        }
        
        logger.log('💾 [SAVE] Final payload:', payload);
        
        if (Object.keys(payload).length > 0) {
            logger.log('💾 [SAVE] Calling saveChanges...');
            saveChanges(payload, 'saveCategory');
        } else {
            logger.log('⚠️ [SAVE] Payload is empty, not saving');
        }
    };

    // LEGACY: Простая проверка изменений (работает!)
    const isChanged = useMemo(() => {
        const getCategoryId = (category: any): string | null => {
            return category ? (category as any).id : null;
        };

        const twitchInitialId = getCategoryId(initialData.twitch?.category);
        const twitchCurrentId = getCategoryId(currentData.twitch?.category);
        const vkInitialId = getCategoryId(initialData.vk?.category);
        const vkCurrentId = getCategoryId(currentData.vk?.category);

        const categoryChanged = 
            (twitchEnabled && twitchInitialId !== twitchCurrentId) ||
            (vkEnabled && vkInitialId !== vkCurrentId);

        logger.log('🔍 [IS CHANGED] Simple check:', {
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

    // Автосброс изменений через 10 секунд, если пользователь не сохранил
    // 🚀 FIX: Запускаем таймер автосброса только после того, как пользователь убрал фокус с инпута категории
    const handleInputBlur = () => {
        // Очищаем предыдущий таймер
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        
        // Если есть несохранённые изменения - запускаем таймер через 200ms (для обработки клика по категории)
        if (isChanged && status.saveCategory !== 'loading' && status.saveCategory !== 'success') {
            logger.log('⏰ [AUTO-RESET] Input blurred - starting 10s timer to reset unsaved changes');
            
            // Используем useTimeout для автоматической очистки
            autoSaveTimerRef.current = setTimeout(() => {
                // Проверяем, что изменения все еще есть (пользователь не сохранил)
                const stillChanged = 
                    (twitchEnabled && JSON.stringify(initialData.twitch?.category) !== JSON.stringify(currentData.twitch?.category)) ||
                    (vkEnabled && JSON.stringify(initialData.vk?.category) !== JSON.stringify(currentData.vk?.category));
                
                if (!stillChanged) {
                    logger.log('⏰ [AUTO-RESET] Skipping reset - changes were already saved');
                    return;
                }
                
                logger.log('⏰ [AUTO-RESET] 10 seconds passed - resetting to initial data');
                
                // Сбрасываем к исходным данным
                setCurrentData((prev: any) => ({
                    ...prev,
                    twitch: { ...prev.twitch, category: initialData.twitch?.category },
                    vk: { ...prev.vk, category: initialData.vk?.category }
                }));
                
                // Обновляем инпуты
                setSearchTerms({
                    twitch: initialData.twitch?.category ? ((initialData.twitch.category as any).name || '') : '',
                    vk: initialData.vk?.category ? ((initialData.vk.category as any).name || '') : ''
                });
                
                // Уведомление пользователю
                toast.info('Изменения категории отменены (не были сохранены в течение 10 секунд)');
            }, 10000); // 10 секунд
        }
    };
    
    // Очищаем таймер при получении фокуса (пользователь снова начал редактировать)
    const handleInputFocus = () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('⏰ [AUTO-RESET] Input focused - clearing timer');
        }
    };
    
    // Cleanup таймера при размонтировании
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, []);

    // 🚀 ANTI-FLASH: Показываем skeleton пока данные не загружены
    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);

    return (
        <Card className="flex flex-col overflow-hidden" style={cardStyle}>
            <CardHeader className="flex-shrink-0 pb-3"><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-green-500"/> Смена категории</CardTitle></CardHeader>
            <CardContent ref={dropdownRef} className="p-3 flex-1 flex flex-col overflow-y-auto" >
                {!isDataLoaded ? (
                    // Показываем минимальный placeholder пока данные загружаются
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
                            Объединить поля
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
                                {currentData.twitch?.category && (currentData.twitch.category as any).box_art_url && (
                                    <img 
                                        src={(currentData.twitch.category as any).box_art_url.replace('{width}x{height}', '32x44')} 
                                        alt={(currentData.twitch.category as any).name} 
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
                                            // Очищаем поле при фокусе если в нем название текущей категории
                                            const currentCategoryName = currentData.twitch?.category ? ((currentData.twitch.category as any).name || '') : '';
                                            if (searchTerms.twitch === currentCategoryName) {
                                                setSearchTerms(prev => ({ ...prev, twitch: '', vk: '' }));
                                                // Выделяем весь текст для удобства
                                                setTimeout(() => {
                                                    if (twitchInputRef.current) {
                                                        twitchInputRef.current.select();
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        onBlur={handleInputBlur} // Запускаем таймер автосброса при потере фокуса
                                        onClick={() => {
                                            // При клике также очищаем, если еще не очищено
                                            const currentCategoryName = currentData.twitch?.category ? ((currentData.twitch.category as any).name || '') : '';
                                            if (searchTerms.twitch === currentCategoryName) {
                                                setSearchTerms(prev => ({ ...prev, twitch: '', vk: '' }));
                                            }
                                        }}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Найти общую категорию..."
                                        className="h-10 text-base w-full"
                                        ref={twitchInputRef}
                                    />
                                    {showDropdown.twitch && (
                                        <CategoryDropdown 
                                            platform="twitch" 
                                            search={searchTerms.twitch} 
                                            onSelect={handleCategorySelect} 
                                            results={(categories as any)?.twitch || []}
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
                                    {currentData.twitch?.category && (currentData.twitch.category as any).box_art_url && (
                                        <img 
                                            src={(currentData.twitch.category as any).box_art_url.replace('{width}x{height}', '32x44')} 
                                            alt={(currentData.twitch.category as any).name} 
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
                                            placeholder={twitchEnabled ? "Найти категорию на Twitch..." : "Интеграция отключена"}
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
                                                results={(categories as any)?.twitch || []}
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
                                    {currentData.vk?.category && (currentData.vk.category as any).box_art_url && (
                                        <img 
                                            src={(currentData.vk.category as any).box_art_url} 
                                            alt={(currentData.vk.category as any).name} 
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
                                            placeholder={vkEnabled ? "Найти категорию на VK Live..." : "Интеграция отключена"}
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
                                                results={(categories as any)?.vk || []}
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
            
            {/* Кнопка сохранения - вынесена ИЗ CardContent */}
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


