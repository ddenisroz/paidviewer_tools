// src/pages/tts/TtsMainPage.jsx
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useTts } from '../../context/TtsContext';
import { useTtsHealth } from '../../context/TtsHealthContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader, Link, Copy, Radio } from 'lucide-react';
import { generateObsUrl } from '../../services/microservices';
import { PageLoader } from '@/components/ui/loader';
import { useLoadingState } from '../../hooks/useLoadingState';
import TtsErrorCard from '../../components/TtsErrorCard';

const TtsMainPageContent = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus, isToggling, initializeTts, setNotificationHandler, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking } = useTtsHealth();
    const { isAuthenticated, user } = useAuth();
    const [notification, setNotification] = useState(null);
    const [listeningMode, setListeningMode] = useState('website'); // 'website' или 'obs'
    const [obsUrl, setObsUrl] = useState('');
    
    // Используем хук для управления состоянием загрузки
    const showLoader = useLoadingState(isChecking);
    
    // Функция для показа уведомления
    const showNotification = useCallback((message, type = 'error') => {
        console.log('TtsMainPage: showNotification called with:', { message, type });
        setNotification({ message, type });
        setTimeout(() => {
            console.log('TtsMainPage: Hiding notification');
            setNotification(null);
        }, 4000);
    }, []);
    
    // Функция для генерации OBS URL
    const handleGenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const fullUrl = `${window.location.origin}/tts-obs/${response.data.obs_token}`;
            setObsUrl(fullUrl);
            showNotification('Ссылка для OBS успешно создана!', 'success');
        } catch (error) {
            showNotification('Не удалось создать ссылку для OBS.');
            console.error('Failed to generate OBS URL:', error);
        }
    };
    
    // Функция для копирования в буфер обмена
    const copyToClipboard = () => {
        navigator.clipboard.writeText(obsUrl);
        showNotification('Ссылка скопирована в буфер обмена!', 'success');
    };
    
    // Для гостей используем user.username как название канала
    const channelName = !isAuthenticated && user?.username ? user.username : '';
    // Бот подключен если есть пользователь (гость или авторизованный)
    const isConnected = !!user;
    
    const checkBotStatus = useCallback(async () => {
        try {
            let response;
            if (isAuthenticated) {
                // Для авторизованных пользователей
                response = await api.get('/api/chat/status');
            } else {
                // Для гостей
                response = await api.get(`/api/chat/guest/status?channel_name=${channelName}`);
            }
            
            const connected = response.data.connected;
            
            // Если бот отключился, перенаправляем на страницу логина
            if (!connected) {
                showNotification('Бот отключился от канала. Перенаправляем на страницу подключения...');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to check bot status:', error);
            // Не показываем ошибку для 401 (это нормально для гостей)
            if (error.response?.status !== 401) {
                showNotification('Ошибка проверки статуса бота');
            }
        }
    }, [isAuthenticated, channelName]);
    
    // Периодическая проверка статуса бота (каждые 30 секунд)
    useEffect(() => {
        if (user) {
            const interval = setInterval(checkBotStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user, checkBotStatus]);


    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);

    // Синхронизируем с TtsHealthContext при изменении isHealthy
    useEffect(() => {
        console.log('TtsMainPage: Syncing with health context, isHealthy:', isHealthy);
        syncWithHealthContext(isHealthy);
    }, [isHealthy, syncWithHealthContext]);
    
    // Регистрируем функцию уведомлений в TtsContext (после определения showNotification)
    useEffect(() => {
        console.log('TtsMainPage: Registering notification handler');
        console.log('TtsMainPage: showNotification function:', typeof showNotification);
        setNotificationHandler(showNotification);
        
        // Проверяем, что handler установился
        setTimeout(() => {
            console.log('TtsMainPage: Notification handler should be set now');
        }, 100);
    }, [setNotificationHandler, showNotification]);

    // Проверяем whitelist статус для гостей только при необходимости
    // (убрали автоматическую проверку при загрузке)

    const handleToggle = useCallback(async (event) => {
        console.log('TtsMainPage: handleToggle called');
        console.log('TtsMainPage: engineStatus.error:', engineStatus.error);
        console.log('TtsMainPage: ttsEnabled:', ttsEnabled);
        console.log('TtsMainPage: showNotification function available:', typeof showNotification);
        
        if (engineStatus.error) {
            console.log('TtsMainPage: Showing error notification');
            showNotification(engineStatus.error);
            return;
        }
        
        console.log('TtsMainPage: Calling toggleTts');
        // Переключаем TTS (whitelist проверка происходит внутри toggleTts)
        try {
            await toggleTts(event);
        } catch (error) {
            console.error('TtsMainPage: Error in toggleTts:', error);
            showNotification('Произошла ошибка при переключении TTS');
        }
    }, [engineStatus.error, showNotification, toggleTts, ttsEnabled]);

    // Показываем прелоадер пока проверяется health или не инициализирован TTS
    if (showLoader) {
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-3xl font-bold mb-4">Озвучка сообщений</h1>
                <PageLoader message="Проверка состояния TTS сервиса..." />
            </div>
        );
    }

    // Заглушка когда TTS недоступен
    if (!isHealthy) {
        return (
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-semibold text-white mb-6">Озвучка сообщений</h1>
                <TtsErrorCard
                    title="TTS сервер недоступен"
                    description="В данный момент сервис TTS недоступен. Озвучка сообщений временно отключена."
                    suggestion="Попробуйте обновить страницу через несколько минут."
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 relative">
            <h1 className="text-3xl font-bold mb-4">Озвучка сообщений</h1>
            
            {/* Анимированное уведомление */}
            {notification && (
                <div 
                    className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
                        notification.type === 'error' 
                            ? 'bg-red-500 text-white' 
                            : 'bg-green-500 text-white'
                    }`}
                    style={{
                        animation: 'slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 3.7s forwards'
                    }}
                >
                    {notification.message}
                </div>
            )}
            
            <style>{`
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%) translateY(-50%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0) translateY(-50%);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0) translateY(-50%);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%) translateY(-50%);
                        opacity: 0;
                    }
                }
            `}</style>
            
            <Card>
                <CardHeader>
                    <CardTitle>Управление озвучкой</CardTitle>
                    <CardDescription>
                        {!isAuthenticated && !isConnected && <span className="text-yellow-500">Сначала подключите бота к каналу.</span>}
                        {isWhitelisted === null && isAuthenticated && <span className="text-yellow-500">Проверка whitelist...</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={ttsEnabled}
                                onCheckedChange={(checked) => handleToggle()}
                                disabled={(!isAuthenticated && !isConnected) || !engineStatus.loaded || isToggling}
                            />
                            <span className="text-sm font-medium">
                                {ttsEnabled ? 'Выключить озвучку чата' : 'Включить озвучку чата'}
                            </span>
                            {isToggling && (
                                <Loader className="h-4 w-4 animate-spin text-primary" />
                            )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <div 
                                className={`w-2 h-2 rounded-full ${ttsEnabled ? 'bg-green-500' : 'bg-red-500'} ${ttsEnabled ? 'shadow-green-500/50 shadow-lg' : 'shadow-red-500/50 shadow-lg'}`}
                            />
                            <span className={`text-sm ${ttsEnabled ? 'text-green-500' : 'text-red-500'}`}>
                                {ttsEnabled ? 'Включено' : 'Выключено'}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Блок выбора способа прослушивания */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Способ прослушивания</CardTitle>
                    <CardDescription>
                        Выберите, как вы хотите слушать озвучку сообщений.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Выбор способа */}
                        <div className="flex space-x-6">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id="website"
                                    name="listeningMode"
                                    value="website"
                                    checked={listeningMode === 'website'}
                                    onChange={(e) => setListeningMode(e.target.value)}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <Label htmlFor="website" className="text-sm font-medium">
                                    Через сайт
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id="obs"
                                    name="listeningMode"
                                    value="obs"
                                    checked={listeningMode === 'obs'}
                                    onChange={(e) => setListeningMode(e.target.value)}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <Label htmlFor="obs" className="text-sm font-medium">
                                    Через OBS
                                </Label>
                            </div>
                        </div>
                        
                        {/* OBS интеграция */}
                        {listeningMode === 'obs' && (
                            <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <Link className="h-4 w-4 text-purple-400" />
                                    <span className="text-sm font-medium text-white">Интеграция с OBS</span>
                                </div>
                                <p className="text-slate-400 text-sm mb-4">
                                    Используйте эту ссылку как источник браузера в OBS для вывода звука TTS в прямой эфир.
                                    Ссылка уникальна для вашего аккаунта, не делитесь ей ни с кем.
                                </p>
                                {obsUrl ? (
                                    <div className="flex items-center gap-2">
                                        <Input type="text" value={obsUrl} readOnly className="bg-slate-900" />
                                        <Button onClick={copyToClipboard} variant="outline" size="icon">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={handleGenerateObsUrl} className="bg-purple-600 hover:bg-purple-700">
                                        Сгенерировать ссылку
                        </Button>
                                )}
                            </div>
                        )}
                        
                        {/* Информация о выбранном способе */}
                        {listeningMode === 'website' && (
                            <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                <p className="text-blue-400 text-sm">
                                    🔊 Звук будет воспроизводиться через ваш браузер. Убедитесь, что звук включен.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const TtsMainPage = () => {
    return <TtsMainPageContent />;
};

export default TtsMainPage;
