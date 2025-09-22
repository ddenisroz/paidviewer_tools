// src/components/StreamCategoryCard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, CheckCircle, XCircle, Save, Loader, Circle } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

const TwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.714v5.143H11.57zm4.714 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
    </svg>
);

const StreamCategoryCard = ({ 
    integrations, 
    streamCategory, 
    setStreamCategory, 
    categorySearch, 
    setCategorySearch, 
    categories, 
    loadCategories, 
    status, 
    updateStreamCategory,
    showCategoryDropdown,
    setShowCategoryDropdown
}) => {
    const dropdownRef = useRef(null);
    const isIdle = !status.category || status.category === 'idle';
    const [isFocused, setIsFocused] = useState(false);
    const [originalCategory, setOriginalCategory] = useState(null);
    const debouncedSearchTerm = useDebounce(categorySearch, 500); // 500ms задержка

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCategoryDropdown(false);
                setIsFocused(false);
                if (originalCategory) {
                    setStreamCategory(originalCategory);
                    setCategorySearch(originalCategory.name);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [setShowCategoryDropdown, originalCategory]);

    useEffect(() => {
        if (debouncedSearchTerm && isFocused) {
            loadCategories(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, isFocused]);

    const handleCategorySelect = (category) => {
        setStreamCategory(category);
        setCategorySearch(category.name);
        setShowCategoryDropdown(false);
        setIsFocused(false);
    };

    const handleFocus = () => {
        setOriginalCategory(streamCategory);
        setIsFocused(true);
        setShowCategoryDropdown(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowCategoryDropdown(false);
            setIsFocused(false);
            if (originalCategory) {
                setStreamCategory(originalCategory);
                setCategorySearch(originalCategory.name);
            }
            e.target.blur();
        }
    };

    return (
        <Card className={`transition-all duration-300 ${integrations.twitch?.enabled ? 'border-green-500/50 bg-green-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Tag className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    Смена категории
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {integrations.twitch?.enabled ? (
                    <div className="flex flex-col space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <TwitchIcon />
                                <span>Twitch</span>
                            </div>
                            <div className="relative" ref={dropdownRef}>
                                {!isFocused && streamCategory && streamCategory.box_art_url && categorySearch === streamCategory.name && (
                                    <img
                                        src={streamCategory.box_art_url.replace('{width}x{height}', '52x72')}
                                        alt={streamCategory.name}
                                        className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-10 rounded object-cover pointer-events-none"
                                    />
                                )}
                                <Input
                                    value={categorySearch}
                                    onChange={(e) => {
                                        setCategorySearch(e.target.value);
                                        setShowCategoryDropdown(true);
                                    }}
                                    onFocus={handleFocus}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Поиск категории..."
                                    className={`w-full bg-background/20 focus:bg-background/50 transition-colors h-12 text-lg ${!isFocused && streamCategory && streamCategory.box_art_url && categorySearch === streamCategory.name ? 'pl-12' : 'pl-3'}`}
                                />
                                {showCategoryDropdown && categories.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                        {categories.map((category) => (
                                            <div
                                                key={category.id}
                                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center gap-2"
                                                onClick={() => handleCategorySelect(category)}
                                            >
                                                {category.box_art_url && (
                                                    <img 
                                                        src={category.box_art_url.replace('{width}x{height}', '52x72')} 
                                                        alt={category.name}
                                                        className="w-8 h-10 rounded object-cover"
                                                    />
                                                )}
                                                <span>{category.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <Button 
                                onClick={updateStreamCategory}
                                disabled={status.category === 'loading'}
                                className={`w-full ${
                                    status.category === 'success' ? 'bg-green-500 hover:bg-green-600' : 
                                    status.category === 'error' ? 'bg-red-500 hover:bg-red-600' : ''
                                }`}
                            >
                                {status.category === 'loading' && <><Loader className="h-4 w-4 mr-2 animate-spin" /> Обновление...</>}
                                {status.category === 'success' && <><CheckCircle className="h-4 w-4 mr-2" /> Успешно обновлено</>}
                                {status.category === 'error' && <><XCircle className="h-4 w-4 mr-2" /> Ошибка обновления</>}
                                {isIdle && <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <Circle className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Интеграция с Twitch отключена</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamCategoryCard;
