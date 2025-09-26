// src/components/StreamCategoryCard.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tag, CheckCircle, XCircle, Save, Loader, Link, Unlink } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { useData } from '../context/DataContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { findMappedCategory } from '../constants/categoryMapping';

const CategoryDropdown = ({ platform, search, onSelect, results }) => {
    if (!search || !Array.isArray(results) || results.length === 0) return null;

    return (
        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {results.map((cat) => (
                <div
                    key={cat.id}
                    className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors duration-200"
                    onClick={() => onSelect(platform, cat)}
                >
                    <div className="flex-shrink-0">
                        {cat.box_art_url ? (
                            <img 
                                src={cat.box_art_url.replace('{width}x{height}', '40x56')} 
                                alt={cat.name}
                                className="w-8 h-10 rounded object-cover border border-border/50"
                                onError={(e) => {
                                    e.target.style.display = 'none';
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
};

const StreamCategoryCard = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status, categories, searchCategories } = useData();

    const [isLinked, setIsLinked] = useState(false);
    const [searchTerms, setSearchTerms] = useState({ twitch: '', vk: '' });
    const [showDropdown, setShowDropdown] = useState({ twitch: false, vk: false });

    const debouncedTwitchSearch = useDebounce(searchTerms.twitch, 300);
    const debouncedVkSearch = useDebounce(searchTerms.vk, 300);
    const dropdownRef = useRef(null);

    const twitchEnabled = integrations.twitch?.enabled;
    const vkEnabled = integrations.vk?.enabled;
    const bothEnabled = twitchEnabled && vkEnabled;
    const hasAnyIntegration = twitchEnabled || vkEnabled;

    useEffect(() => {
        setSearchTerms({
            twitch: currentData.twitch.category?.name || '',
            vk: currentData.vk.category?.name || '',
        });
    }, [currentData]);
    
    useEffect(() => {
        // Only search when the dropdown is open to avoid unnecessary API calls
        if (debouncedTwitchSearch && showDropdown.twitch) searchCategories('twitch', debouncedTwitchSearch);
    }, [debouncedTwitchSearch, showDropdown.twitch, searchCategories]);

    useEffect(() => {
        // Only search when the dropdown is open to avoid unnecessary API calls
        if (debouncedVkSearch && showDropdown.vk) searchCategories('vk', debouncedVkSearch);
    }, [debouncedVkSearch, showDropdown.vk, searchCategories]);

    // Handle click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown({ twitch: false, vk: false });
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearchChange = (platform, value) => {
        if (isLinked && bothEnabled) {
            setSearchTerms({ twitch: value, vk: value });
            setShowDropdown({ twitch: true, vk: true });
        } else {
            setSearchTerms(prev => ({ ...prev, [platform]: value }));
            setShowDropdown(prev => ({ ...prev, [platform]: true }));
        }
    };

    const handleCategorySelect = (platform, category) => {
        if (isLinked && bothEnabled) {
            // В объединенном режиме ищем соответствующую категорию для другой платформы
            const otherPlatform = platform === 'twitch' ? 'vk' : 'twitch';
            const otherCategories = categories[otherPlatform] || [];
            
            // Ищем соответствующую категорию на другой платформе
            const mappedCategory = findMappedCategory(category.name, platform, otherCategories);
            
            if (mappedCategory) {
                // Нашли соответствующую категорию - устанавливаем разные категории для разных платформ
                setCurrentData(prev => ({
                    ...prev,
                    [platform]: { ...prev[platform], category },
                    [otherPlatform]: { ...prev[otherPlatform], category: mappedCategory },
                }));
            } else {
                // Не нашли соответствующую категорию - устанавливаем одинаковую (как было раньше)
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch, category },
                    vk: { ...prev.vk, category },
                }));
            }
        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform]: { ...prev[platform], category },
            }));
        }
        setSearchTerms(prev => ({ ...prev, [platform]: category.name })); // Update search bar with selected category
        setShowDropdown({ twitch: false, vk: false });
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && isChanged && status.saveCategory !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode) => {
        const payload = {};
        
        if (mode === 'both') {
            // Объединенный режим - сохраняем соответствующие категории для каждой платформы
            if (twitchEnabled && currentData.twitch.category?.id !== initialData.twitch.category?.id) {
                payload.twitch = { category_id: currentData.twitch.category.id };
            }
            if (vkEnabled && currentData.vk.category?.id !== initialData.vk.category?.id) {
                payload.vk = { category_id: currentData.vk.category.id };
            }
        } else {
            // Индивидуальный режим - сохраняем только измененные категории
            if (twitchEnabled && currentData.twitch.category?.id !== initialData.twitch.category?.id) {
                payload.twitch = { category_id: currentData.twitch.category?.id };
            }
            if (vkEnabled && currentData.vk.category?.id !== initialData.vk.category?.id) {
                payload.vk = { category_id: currentData.vk.category?.id };
            }
        }
        
        if (Object.keys(payload).length > 0) {
            saveChanges(payload, 'saveCategory');
        }
    };

    const isChanged = useMemo(() => {
        // Проверяем изменения только в категориях
        const categoryChanged = 
            (twitchEnabled && initialData.twitch.category?.id !== currentData.twitch.category?.id) ||
            (vkEnabled && initialData.vk.category?.id !== currentData.vk.category?.id);
        return categoryChanged;
    }, [initialData.twitch.category?.id, initialData.vk.category?.id, currentData.twitch.category?.id, currentData.vk.category?.id, twitchEnabled, vkEnabled]);

    if (!hasAnyIntegration) {
        return (
            <Card className="h-full border-red-500/50 bg-red-500/5 opacity-60">
                 <CardHeader><CardTitle className="flex items-center gap-2 text-red-500"><Tag /> Смена категории</CardTitle></CardHeader>
                 <CardContent className="flex items-center justify-center h-full min-h-[300px]">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-sm text-muted-foreground px-4">Авторизуйтесь для полного функционала</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col min-h-[400px]">
            <CardHeader className="flex-shrink-0"><CardTitle className="flex items-center gap-2"><Tag className="text-green-500"/> Смена категории</CardTitle></CardHeader>
            <CardContent ref={dropdownRef} className="p-6 flex-1 flex flex-col justify-between min-h-0">
                {/* Toggle объединения полей */}
                {bothEnabled && (
                    <div className="flex items-center justify-between p-3 bg-background/10 rounded-lg">
                        <Label htmlFor="link-categories" className="flex items-center gap-2 cursor-pointer font-medium">
                            {isLinked ? <Link className="h-4 w-4 text-green-500" /> : <Unlink className="h-4 w-4" />}
                            Объединить поля
                        </Label>
                        <Switch 
                            id="link-categories" 
                            checked={isLinked} 
                            onCheckedChange={setIsLinked} 
                            disabled={!bothEnabled} 
                        />
                    </div>
                )}
                {/* Поля ввода */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full space-y-4">
                    {isLinked && bothEnabled ? (
                        <div className="space-y-3 relative">
                            <Label className="flex items-center gap-2 font-medium">
                                <TwitchIcon /><VKIcon /> Общая категория
                            </Label>
                                <div className="flex gap-3 items-center relative">
                                    {currentData.twitch.category?.box_art_url && (
                                        <img 
                                            src={currentData.twitch.category.box_art_url.replace('{width}x{height}', '40x56')} 
                                            alt={currentData.twitch.category.name} 
                                            className="w-8 h-10 rounded object-cover border border-border/50 flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 relative">
                                        <Input
                                            value={searchTerms.twitch} 
                                            onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                            onFocus={() => setShowDropdown({ twitch: true, vk: true })}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Найти общую категорию..."
                                            className="h-12 text-lg w-full"
                                        />
                                        {showDropdown.twitch && (
                                            <CategoryDropdown 
                                                platform="twitch" 
                                                search={searchTerms.twitch} 
                                                onSelect={handleCategorySelect} 
                                                results={categories?.twitch || []} 
                                            />
                                        )}
                                    </div>
                                </div>
                        </div>
                    ) : (
                        <>
                            {/* Поле Twitch */}
                            <div className={`space-y-2 relative ${!twitchEnabled ? 'opacity-50' : ''}`}>
                                <Label className="flex items-center gap-2 font-medium">
                                    <TwitchIcon /> Twitch
                                    {!twitchEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                </Label>
                                <div className="flex gap-3 items-center">
                                    {currentData.twitch.category?.box_art_url && (
                                        <img 
                                            src={currentData.twitch.category.box_art_url.replace('{width}x{height}', '40x56')} 
                                            alt={currentData.twitch.category.name} 
                                            className="w-8 h-10 rounded object-cover border border-border/50 flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 relative">
                                        <Input
                                            value={searchTerms.twitch} 
                                            onChange={(e) => handleSearchChange('twitch', e.target.value)}
                                            onFocus={() => twitchEnabled && setShowDropdown({ twitch: true, vk: false })}
                                            onKeyPress={handleKeyPress}
                                            placeholder={twitchEnabled ? "Найти категорию на Twitch..." : "Интеграция отключена"}
                                            className={`h-12 text-lg w-full ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                            disabled={!twitchEnabled}
                                        />
                                        {showDropdown.twitch && twitchEnabled && (
                                            <CategoryDropdown 
                                                platform="twitch" 
                                                search={searchTerms.twitch} 
                                                onSelect={handleCategorySelect} 
                                                results={categories?.twitch || []} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Поле VK Live */}
                            <div className={`space-y-2 relative ${!vkEnabled ? 'opacity-50' : ''}`}>
                                <Label className="flex items-center gap-2 font-medium">
                                    <VKIcon /> VK Live
                                    {!vkEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                </Label>
                                <div className="flex gap-3 items-center">
                                    {currentData.vk.category?.box_art_url && (
                                        <img 
                                            src={currentData.vk.category.box_art_url} 
                                            alt={currentData.vk.category.name} 
                                            className="w-8 h-10 rounded object-cover border border-border/50 flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 relative">
                                        <Input
                                            value={searchTerms.vk} 
                                            onChange={(e) => handleSearchChange('vk', e.target.value)} 
                                            onFocus={() => vkEnabled && setShowDropdown({ twitch: false, vk: true })}
                                            onKeyPress={handleKeyPress}
                                            placeholder={vkEnabled ? "Найти категорию на VK Live..." : "Интеграция отключена"}
                                            className={`h-12 text-lg w-full ${!vkEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                            disabled={!vkEnabled}
                                        />
                                        {showDropdown.vk && vkEnabled && (
                                            <CategoryDropdown 
                                                platform="vk" 
                                                search={searchTerms.vk} 
                                                onSelect={handleCategorySelect} 
                                                results={categories?.vk || []} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    </div>
                </div>

                {/* Кнопка сохранения */}
                {hasAnyIntegration && (
                    <div className="pt-4 flex justify-center flex-shrink-0">
                        <Button 
                            onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                            disabled={status.saveCategory === 'loading' || !isChanged}
                            className="w-full flex items-center gap-2"
                        >
                            {status.saveCategory === 'loading' ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {status.saveCategory === 'loading' ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </div>
                )}

                        
            </CardContent>
        </Card>
    );
};

export default StreamCategoryCard;
