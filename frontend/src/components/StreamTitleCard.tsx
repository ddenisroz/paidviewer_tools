// src/components/StreamTitleCard.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit3, CheckCircle, XCircle, Save, Loader, Link, Unlink } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';
import { useData } from '../context/DataContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useUserSettings } from '../context/UserSettingsContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { useTimeout } from '../hooks/useTimeout';

interface StreamTitleCardProps {
    onLinkStateChange?: (isLinked: boolean) => void;
}

const StreamTitleCard: React.FC<StreamTitleCardProps> = ({ onLinkStateChange }) => {
    const { user, isAuthenticated } = useAuth();
    const { integrations, isLoading: integrationsLoading } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_titles: combineTitles, combine_categories: combineCategories } = getCombineSettings();
    // 🚀 ANTI-FLASH: Используем useMemo для вычисления isLinked напрямую из combineTitles
    // Это гарантирует, что значение всегда синхронизировано и нет видимого переключения
    const isLinked = useMemo(() => combineTitles || false, [combineTitles]);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    // isLinked теперь вычисляется напрямую из combineTitles через useMemo, поэтому нет видимого переключения
    useEffect(() => {
        if (onLinkStateChange) {
            onLinkStateChange(isLinked);
        }
    }, [isLinked, onLinkStateChange]);

    // Обработчик изменения переключателя
    const handleToggleChange = async (value: boolean) => {
        const success = await updateSetting('combine_titles', value);
        if (success) {
            // isLinked теперь вычисляется из combineTitles через useMemo, поэтому обновление произойдет автоматически
            // При включении объединения - синхронизируем название Twitch на VK Live
            if (value && bothEnabled) {
                const twitchTitle = currentData.twitch?.title || '';
                setCurrentData((prev: any) => ({
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

    const handleTitleChange = (platform: string, value: string) => {
        // Убираем все пробелы в начале и конце, но сохраняем внутренние пробелы
        const trimmedValue = value.trim();
        
        // Очищаем таймер автосброса, пока пользователь редактирует
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        
        if (isLinked && bothEnabled) {
            setCurrentData((prev: any) => ({
                ...prev,
                twitch: { ...prev.twitch, title: trimmedValue },
                vk: { ...prev.vk, title: trimmedValue },
            }));
        } else {
            setCurrentData((prev: any) => ({
                ...prev,
                [platform]: { ...prev[platform], title: trimmedValue },
            }));
        }
    };
    
    // Используем useTimeout для автоматической очистки таймера
    const [resetTimerDelay, setResetTimerDelay] = useState<number | null>(null);
    
    useTimeout(() => {
        // Проверяем, что изменения все еще есть (пользователь не сохранил)
        const stillChanged = 
            (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
            (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''));
        
        if (!stillChanged) {
            logger.log('⏰ [AUTO-RESET] Skipping reset - changes were already saved');
            return;
        }
        
        logger.log('⏰ [AUTO-RESET] 10 seconds passed - resetting to initial data');
        
        // Сбрасываем к исходным данным
        setCurrentData((prev: any) => ({
            ...prev,
            twitch: { ...prev.twitch, title: initialData.twitch?.title || '' },
            vk: { ...prev.vk, title: initialData.vk?.title || '' }
        }));
        
        // Уведомление пользователю
        toast.info('Изменения названия отменены (не были сохранены в течение 10 секунд)');
        setResetTimerDelay(null); // Останавливаем таймер
    }, resetTimerDelay);

    // 🚀 FIX: Запускаем таймер автосброса только после того, как пользователь убрал фокус с инпута
    const handleInputBlur = () => {
        // Если есть несохранённые изменения - запускаем таймер
        if (isChanged && status.saveTitle !== 'loading' && status.saveTitle !== 'success') {
            logger.log('⏰ [AUTO-RESET] Input blurred - starting 10s timer to reset unsaved changes');
            setResetTimerDelay(10000); // 10 секунд
        }
    };
    
    // Очищаем таймер при получении фокуса (пользователь снова начал редактировать)
    const handleInputFocus = () => {
        setResetTimerDelay(null);
        logger.log('⏰ [AUTO-RESET] Input focused - clearing timer');
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isChanged && status.saveTitle !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode: 'both' | 'individual') => {
        // Очищаем таймер автосброса (пользователь сохраняет вручную)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('⏰ [AUTO-RESET] Timer cleared - user saved manually');
        }
        
        const payload: any = {};
        
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
            <CardHeader className="flex-shrink-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-green-500" />
                    Смена названия
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 flex flex-col overflow-y-auto" >
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
                            value={currentData.twitch?.title || ''} 
                            onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                            onKeyPress={handleKeyPress}
                            onBlur={handleInputBlur}
                            onFocus={handleInputFocus}
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
                                value={currentData.twitch?.title || ''} 
                                onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                onKeyPress={handleKeyPress}
                                onBlur={handleInputBlur}
                                onFocus={handleInputFocus}
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
                                value={currentData.vk?.title || ''} 
                                onChange={(e) => handleTitleChange('vk', e.target.value)} 
                                onKeyPress={handleKeyPress}
                                onBlur={handleInputBlur}
                                onFocus={handleInputFocus}
                                placeholder={vkEnabled ? "Название стрима на VK Live..." : "Интеграция отключена"}
                                className={`h-10 ${!vkEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                disabled={!vkEnabled}
                            />
                        </div>
                    </div>
                )}
                </div>
                </>
                )}
            </CardContent>
            
            {/* Кнопка сохранения - вынесена ИЗ CardContent (как в StreamCategoryCard) */}
            {isDataLoaded && hasAnyIntegration && (
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


