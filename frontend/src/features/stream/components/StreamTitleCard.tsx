// src/components/StreamTitleCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle, Edit3, Link, Loader, Save, Unlink } from 'lucide-react';

import { useData } from '@/context/DataContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useTimeout } from '@/shared/hooks/useTimeout';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

interface StreamTitleCardProps {
    onLinkStateChange?: (isLinked: boolean) => void;
}

const StreamTitleCard: React.FC<StreamTitleCardProps> = ({ onLinkStateChange }) => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    const { getCombineSettings, updateSetting } = useUserSettings();
    const { combine_titles: combineTitles, combine_categories: combineCategories } = getCombineSettings();

    // ANTI-FLASH: Мемоизируем useMemo для вычисления isLinked напрямую из combineTitles
    // Это гарантирует, что значение всегда соответствует и нет моргания переключателя
    const isLinked = useMemo(() => combineTitles || false, [combineTitles]);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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
            // В объединенном режиме проверяем, связаны ли ОБЕ карточки
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
    // isLinked теперь вычисляется напрямую из combineTitles через useMemo, поэтому нет задержек синхронизации
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
            // При включении объединения - синхронизируем значение Twitch на VK Live
            if (value && bothEnabled) {
                const twitchTitle = currentData.twitch?.title || '';
                setCurrentData(prev => ({
                    ...prev,
                    vk: { ...prev.vk, title: twitchTitle }
                }));

                // Моментально сохраняем синхронизированное значение
                const payload = {
                    twitch: { title: twitchTitle },
                    vk: { title: twitchTitle }
                };
                saveChanges(payload, 'saveTitle');
            }
        }
    };

    const handleTitleChange = (platform: string, value: string) => {
        // Удаляем лишние пробелы в начале и конце
        const trimmedValue = value; // .trim() мешает печатать пробелы, убрал

        // Очищаем таймер автосброса, если пользователь печатает
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, title: trimmedValue },
                vk: { ...prev.vk, title: trimmedValue },
            }));
        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform as 'twitch' | 'vk']: { ...prev[platform as 'twitch' | 'vk'], title: trimmedValue },
            }));
        }
    };

    // Используем useTimeout для автосброса если нет сохранения
    const [resetTimerDelay, setResetTimerDelay] = useState<number | null>(null);

    useTimeout(() => {
        // Проверяем, что изменения всё ещё есть (пользователь не сохранил)
        const stillChanged =
            (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
            (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''));

        if (!stillChanged) {
            logger.log('[AUTO-RESET] Skipping reset - changes were already saved');
            return;
        }

        logger.log('[AUTO-RESET] 10 seconds passed - resetting to initial data');

        // Сбрасываем к исходным данным
        setCurrentData(prev => ({
            ...prev,
            twitch: { ...prev.twitch, title: initialData.twitch?.title || '' },
            vk: { ...prev.vk, title: initialData.vk?.title || '' }
        }));

        // Уведомляем пользователя
        toast.info('Изменения сброшены (вы не сохранили в течение 10 секунд)');
        setResetTimerDelay(null); // Останавливаем таймер
    }, resetTimerDelay);

    // FIX: Запускаем таймер автосброса только когда пользователь убрал фокус с инпута
    const handleInputBlur = () => {
        // Если есть несохраненные изменения - запускаем таймер
        if (isChanged && status.saveTitle !== 'loading' && status.saveTitle !== 'success') {
            logger.log('[AUTO-RESET] Input blurred - starting 10s timer to reset unsaved changes');
            setResetTimerDelay(10000); // 10 секунд
        }
    };

    // Очищаем таймер при получении фокуса (пользователь снова начал редактировать)
    const handleInputFocus = () => {
        setResetTimerDelay(null);
        logger.log('[AUTO-RESET] Input focused - clearing timer');
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isChanged && status.saveTitle !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
        }
    };

    const handleSave = (mode: 'both' | 'individual') => {
        // Очищаем таймер автосброса (пользователь сохранил вручную)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
            logger.log('[AUTO-RESET] Timer cleared - user saved manually');
        }

        const payload: { twitch?: { title: string }; vk?: { title: string } } = {};

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
            // Объединенный режим - сохраняем одну и ту же строку для обоих платформ
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
            // Раздельный режим - сохраняем только измененные поля
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
        // Проверяем изменение данных в компоненте
        if (isLinked && bothEnabled) {
            // В объединенном режиме проверяем, отличается ли заголовок хотя бы на одной платформе
            const currentTitle = currentData.twitch?.title || '';
            const initialTwitchTitle = initialData.twitch?.title || '';
            // Если совпадают, то нет смысла даже сравнивать, считаем изменения равны нулю
            return currentTitle !== initialTwitchTitle;
        } else {
            // В раздельном режиме проверяем каждую платформу отдельно
            const titleChanged =
                (twitchEnabled && (initialData.twitch?.title || '') !== (currentData.twitch?.title || '')) ||
                (vkEnabled && (initialData.vk?.title || '') !== (currentData.vk?.title || ''));
            return titleChanged;
        }
    }, [initialData.twitch?.title, initialData.vk?.title, currentData.twitch?.title, currentData.vk?.title, twitchEnabled, vkEnabled, isLinked, bothEnabled]);

    // Cleanup таймеры при размонтировании
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, []);

    // ANTI-FLASH: Показываем skeleton пока данные не загружены
    const isDataLoaded = currentData && (currentData.twitch || currentData.vk);

    return (
        <Card className="flex flex-col overflow-hidden h-full" style={cardStyle}>
            <CardHeader className="flex-shrink-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-green-500" />
                    Название стрима
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 flex flex-col overflow-y-auto" >
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
                                <Label htmlFor="link-titles" className="flex items-center gap-2 cursor-pointer text-sm">
                                    {isLinked ? <Link className="h-4 w-4 text-green-500" /> : <Unlink className="h-4 w-4" />}
                                    Связать поля
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
                                            placeholder={twitchEnabled ? "Изменить название на Twitch..." : "Интеграция отключена"}
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
                                            placeholder={vkEnabled ? "Изменить название на VK Live..." : "Интеграция отключена"}
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

            {/* Кнопка сохранения - вынесена из CardContent (как в StreamCategoryCard) */}
            {isDataLoaded && hasAnyIntegration && (
                <div className="p-3 pt-0 flex-shrink-0">
                    <Button
                        onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                        disabled={status.saveTitle === 'loading' || status.saveTitle === 'success' || !isChanged}
                        size="sm"
                        className="w-full flex items-center gap-2"
                    >
                        {status.saveTitle === 'loading' ? (
                            <Loader className="h-4 w-4 animate-spin" />
                        ) : status.saveTitle === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {status.saveTitle === 'loading' ? 'Сохранение...' : status.saveTitle === 'success' ? 'Сохранено' : 'Сохранить'}
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default StreamTitleCard;
