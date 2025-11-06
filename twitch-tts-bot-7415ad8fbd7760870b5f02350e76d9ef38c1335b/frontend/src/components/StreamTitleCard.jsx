// src/components/StreamTitleCard.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit3, CheckCircle, XCircle, Save, Loader, Link, Unlink } from 'lucide-react';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { useData } from '../context/DataContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useUserSettings } from '../context/UserSettingsContext';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

const StreamTitleCard = ({ onLinkStateChange }) => {
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_titles: combineTitles, combine_categories: combineCategories } = getCombineSettings();
    const [isLinked, setIsLinked] = useState(false);
    const autoSaveTimerRef = useRef(null);

    const twitchEnabled = useMemo(() => integrations.twitch?.enabled === true, [integrations.twitch?.enabled]);
    const vkEnabled = useMemo(() => integrations.vk?.enabled === true, [integrations.vk?.enabled]);
    const bothEnabled = useMemo(() => twitchEnabled && vkEnabled, [twitchEnabled, vkEnabled]);
    const hasAnyIntegration = useMemo(() => twitchEnabled || vkEnabled, [twitchEnabled, vkEnabled]);
    const isLoading = useMemo(() => 
        integrationsLoading || integrations.twitch?.enabled === null || integrations.vk?.enabled === null,
        [integrationsLoading, integrations.twitch?.enabled, integrations.vk?.enabled]
    );

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

    // Синхронизируем с сервером и уведомляем родительский компонент
    useEffect(() => {
        setIsLinked(combineTitles);
    }, [combineTitles]);

    useEffect(() => {
        if (onLinkStateChange) {
            onLinkStateChange(isLinked);
        }
    }, [isLinked, onLinkStateChange]);

    // Обработчик изменения переключателя
    const handleToggleChange = async (value) => {
        const success = await updateSetting('combine_titles', value);
        if (success) {
            setIsLinked(value);
            
            // При включении объединения - синхронизируем название Twitch на VK Live
            if (value && bothEnabled) {
                const twitchTitle = currentData.twitch?.title || '';
                setCurrentData(prev => ({
                    ...prev,
                    vk: { ...prev.vk, title: twitchTitle }
                }));
                
                // Автоматически сохраняем синхронизированное название
                const payload = {
                    twitch: { title: twitchTitle },
                    vk: { title: twitchTitle }
                };
                saveChanges(payload, 'saveTitle');
            }
        }
    };

    const handleTitleChange = (platform, value) => {
        // Убираем все пробелы в начале и конце, но сохраняем внутренние пробелы
        const trimmedValue = value.trim();
        
        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, title: trimmedValue },
                vk: { ...prev.vk, title: trimmedValue },
            }));
        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform]: { ...prev[platform], title: trimmedValue },
            }));
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && isChanged && status.saveTitle !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode) => {
        // Очищаем таймер автосброса (пользователь сохраняет вручную)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('⏰ [AUTO-RESET] Timer cleared - user saved manually');
        }
        
        const payload = {};
        
        logger.log('StreamTitleCard handleSave:', {
            mode,
            isLinked,
            bothEnabled,
            twitchEnabled,
            vkEnabled,
            currentData: currentData,
            initialData: initialData
        });
        
        if (mode === 'both') {
            // Объединенный режим - сохраняем одно и то же название для обеих платформ
            const title = currentData.twitch?.title || '';
            const hasChanges = title !== (initialData.twitch?.title || '') || title !== (initialData.vk?.title || '');
            
            logger.log('Combined mode:', {
                title,
                hasChanges,
                initialTwitch: initialData.twitch?.title,
                initialVk: initialData.vk?.title
            });
            
            if (hasChanges) {
                if (twitchEnabled) payload.twitch = { title };
                if (vkEnabled) payload.vk = { title };
            }
        } else {
            // Индивидуальный режим - сохраняем только измененные поля
            if (twitchEnabled && (currentData.twitch?.title || '') !== (initialData.twitch?.title || '')) {
                payload.twitch = { title: currentData.twitch?.title || '' };
            }
            if (vkEnabled && (currentData.vk?.title || '') !== (initialData.vk?.title || '')) {
                payload.vk = { title: currentData.vk?.title || '' };
            }
        }
        
        logger.log('Final payload:', payload);
        
        if (Object.keys(payload).length > 0) {
            saveChanges(payload, 'saveTitle');
        } else {
            logger.log('No changes detected, not saving');
        }
    };
    
    const isChanged = useMemo(() => {
        // Проверяем изменения только в заголовках
        if (isLinked && bothEnabled) {
            // В объединенном режиме проверяем, изменился ли заголовок хотя бы на одной платформе
            const currentTitle = currentData.twitch?.title || '';
            const initialTwitchTitle = initialData.twitch?.title || '';
            const initialVkTitle = initialData.vk?.title || '';
            // Если объединены, то они должны быть одинаковыми, поэтому проверяем только один
            return currentTitle !== initialTwitchTitle;
        } else {
            // В индивидуальном режиме проверяем каждую платформу отдельно
            const titleChanged = 
                (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
                (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''));
            return titleChanged;
        }
    }, [initialData.twitch?.title, initialData.vk?.title, currentData.twitch?.title, currentData.vk?.title, twitchEnabled, vkEnabled, isLinked, bothEnabled]);

    // Автосброс изменений через 10 секунд, если пользователь не сохранил
    useEffect(() => {
        // Очищаем предыдущий таймер
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        // Если есть несохранённые изменения - запускаем таймер
        if (isChanged && status.saveTitle !== 'loading' && status.saveTitle !== 'success') {
            logger.log('⏰ [AUTO-RESET] Starting 10s timer to reset unsaved changes');
            
            autoSaveTimerRef.current = setTimeout(() => {
                logger.log('⏰ [AUTO-RESET] 10 seconds passed - resetting to initial data');
                
                // Сбрасываем к исходным данным
                setCurrentData(prev => ({
                    ...prev,
                    twitch: { ...prev.twitch, title: initialData.twitch?.title || '' },
                    vk: { ...prev.vk, title: initialData.vk?.title || '' }
                }));
                
                // Уведомление пользователю
                toast.info('Изменения названия отменены (не были сохранены в течение 10 секунд)');
            }, 10000); // 10 секунд
        }

        // Cleanup при размонтировании
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [isChanged, status.saveTitle, initialData.twitch?.title, initialData.vk?.title, setCurrentData]);

    if (isLoading) {
        return (
            <Card className="border-yellow-500/50 bg-yellow-500/5 integration-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-500">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
                        <p className="text-sm text-muted-foreground px-4">Загрузка интеграций...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Показываем загрузку если данные еще не загружены
    if (!currentData || (!currentData.twitch && !currentData.vk)) {
        return (
            <Card className="border-blue-500/50 bg-blue-500/5 integration-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-500">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-sm text-muted-foreground px-4">Загрузка данных стрима...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!hasAnyIntegration) {
        return (
            <Card className="border-red-500/50 bg-red-500/5 opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-sm text-muted-foreground px-4">Подключите интеграции для полного функционала</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col overflow-hidden" style={cardStyle}>
            <CardHeader className="flex-shrink-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-green-500" />
                    Смена названия
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 flex flex-col overflow-y-auto" >
                {/* Toggle объединения полей */}
                {bothEnabled && (
                    <div className="flex items-center justify-between p-2 bg-background/10 rounded-lg mb-2">
                        <Label htmlFor="link-titles" className="flex items-center gap-2 cursor-pointer text-sm">
                            {isLinked ? <Link className="h-4 w-4 text-green-500" /> : <Unlink className="h-4 w-4" />}
                            Объединить поля
                        </Label>
                        <Switch 
                            id="link-titles" 
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
                            <TwitchIcon /><VKIcon /> Общее название
                        </Label>
                        <Input 
                            value={currentData.twitch.title || ''} 
                            onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                            onKeyPress={handleKeyPress}
                            placeholder="Введите общее название для обеих платформ..."
                            className="h-10"
                        />
                    </div>
                ) : (
                    <div className="space-y-2 w-full mx-auto max-w-2xl">
                        {/* Поле Twitch */}
                        <div className={`space-y-2 ${!twitchEnabled ? 'opacity-50' : ''}`}>
                            <Label className="flex items-center gap-2 text-sm">
                                <TwitchIcon /> Twitch
                                {!twitchEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                            </Label>
                            <Input 
                                value={currentData.twitch.title || ''} 
                                onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                onKeyPress={handleKeyPress}
                                placeholder={twitchEnabled ? "Название стрима на Twitch..." : "Интеграция отключена"}
                                className={`h-10 ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                disabled={!twitchEnabled}
                            />
                        </div>

                        {/* Поле VK Live */}
                        <div className={`space-y-2 ${!vkEnabled ? 'opacity-50' : ''}`}>
                            <Label className="flex items-center gap-2 text-sm">
                                <VKIcon /> VK Live
                                {!vkEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                            </Label>
                            <Input 
                                value={currentData.vk.title || ''} 
                                onChange={(e) => handleTitleChange('vk', e.target.value)} 
                                onKeyPress={handleKeyPress}
                                placeholder={vkEnabled ? "Название стрима на VK Live..." : "Интеграция отключена"}
                                className={`h-10 ${!vkEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                disabled={!vkEnabled}
                            />
                        </div>
                    </div>
                )}
                </div>
            </CardContent>
            
            {/* Кнопка сохранения - вынесена ИЗ CardContent (как в StreamCategoryCard) */}
            {hasAnyIntegration && (
                <div className="p-3 pt-0 flex-shrink-0">
                    <Button 
                        onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                        disabled={status.saveTitle === 'loading' || !isChanged}
                        size="sm"
                        className="w-full flex items-center gap-2"
                    >
                        {status.saveTitle === 'loading' ? (
                            <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {status.saveTitle === 'loading' ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default StreamTitleCard;
