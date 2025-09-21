// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActiveChannels } from '../context/ActiveChannelsContext';
import api from '../services/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Circle, Activity } from 'lucide-react';
import CookieConsent from '@/components/CookieConsent';
import '../components/ActiveChannelsCarousel.css';

// Иконка Twitch "Glitch" (точная)
const TwitchIcon = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={props.className}
    >
        <path d="M2.149 0l-2.149 4.774v16.452h5.71v3.226h4.774l4.774-4.774h3.816l6.657-6.657v-13.021h-23.581zm20.573 12.131l-3.816 3.816h-3.816l-3.816 3.816v-3.816h-4.774v-13.021h16.222v9.205zm-5.71-6.425h2.387v5.71h-2.387v-5.71zm-4.774 0h2.387v5.71h-2.387v-5.71z"/>
    </svg>
);

// Официальная иконка VK Video из @vkontakte/icons
const VKIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className={props.className}>
        <path fillRule="evenodd" d="M5 7.6c0-1.96 0-2.94.381-3.689a3.5 3.5 0 0 1 1.53-1.53C7.66 2 8.64 2 10.6 2h.52c2.408 0 3.612 0 4.532.469a4.3 4.3 0 0 1 1.88 1.879C18 5.268 18 6.472 18 8.88v2.24c0 2.408 0 3.612-.469 4.532a4.3 4.3 0 0 1-1.879 1.88c-.92.468-2.124.468-4.532.468h-.52c-1.96 0-2.94 0-3.689-.381a3.5 3.5 0 0 1-1.53-1.53C5 15.34 5 14.36 5 12.4V7.6Zm8.607.971c.789.472 1.183.707 1.317 1.012.116.266.116.57 0 .835-.134.306-.528.541-1.317 1.012l-2.088 1.247c-.825.493-1.237.739-1.576.707a1.04 1.04 0 0 1-.741-.42C9 12.688 9 12.207 9 11.247V8.754c0-.96 0-1.44.202-1.716a1.04 1.04 0 0 1 .74-.42c.34-.032.752.214 1.577.706l2.088 1.247ZM3.5 7.881c0-2.41 0-3.613.469-4.533a4.3 4.3 0 0 1 .736-1.033 3.044 3.044 0 0 0-.357.154 4.3 4.3 0 0 0-1.88 1.879C2 5.268 2 6.472 2 8.88v2.24c0 2.408 0 3.612.469 4.532a4.3 4.3 0 0 0 1.879 1.88c.114.057.232.108.357.153a4.299 4.299 0 0 1-.736-1.033c-.469-.92-.469-2.124-.469-4.532V7.88Z" clipRule="evenodd"/>
    </svg>
);


const LoginPage = () => {
    const { login, setGuestMode } = useAuth();
    const { activeChannels } = useActiveChannels();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [subtitleText, setSubtitleText] = useState('');
    const [subtitleVisible, setSubtitleVisible] = useState(false);
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
    const fullTitle = 'Payedviewer_tools';
    const features = ['TTS озвучка', 'Медиа запросы', 'Анализ чата'];
    
    // Состояние для гостевого режима
    const [guestModalOpen, setGuestModalOpen] = useState(false);
    const [guestUsername, setGuestUsername] = useState('');
    const [guestPlatform, setGuestPlatform] = useState('twitch');
    const [isCheckingChannel, setIsCheckingChannel] = useState(false);
    const [channelError, setChannelError] = useState('');

    useEffect(() => {
        if (isTyping && title.length < fullTitle.length) {
            const timeoutId = setTimeout(() => {
                setTitle(fullTitle.slice(0, title.length + 1));
            }, 60); 
            return () => clearTimeout(timeoutId);
        } else {
            setIsTyping(false);
        }
    }, [title, isTyping]);

    useEffect(() => {
        if (!isTyping) {
            const showFeature = () => {
                setSubtitleText(features[currentFeatureIndex]);
                setSubtitleVisible(true);
                
                setTimeout(() => {
                    setSubtitleVisible(false);
                    setTimeout(() => {
                        setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
                    }, 500); // Время исчезновения
                }, 2500); // Время показа текста
            };
            
            const timeoutId = setTimeout(showFeature, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [isTyping, currentFeatureIndex]);

    const handleVkLogin = () => {
        alert('VK Live авторизация пока не реализована');
    };

    const handleGuestMode = () => {
        setGuestModalOpen(true);
    };

    const checkChannel = async () => {
        if (!guestUsername.trim()) {
            setChannelError('Введите никнейм канала');
            return;
        }

        setIsCheckingChannel(true);
        setChannelError('');

        try {
            // Подключаем бота к каналу
            const response = await api.post('/api/chat/guest/connect', {
                channel_name: guestUsername.trim()
            });
            
            // Если подключение успешно, входим в гостевой режим
            setGuestMode({
                username: guestUsername.trim(),
                platform: guestPlatform,
                isGuest: true
            });
            setGuestModalOpen(false);
            navigate('/dashboard');
            
        } catch (error) {
            console.error('LoginPage: Failed to connect bot:', error);
            const errorMsg = error.response?.data?.detail || 'Канал не найден или недоступен';
            setChannelError(errorMsg);
        } finally {
            setIsCheckingChannel(false);
        }
    };

    return (
        <div className="login-page-bg min-h-screen flex items-center justify-center text-white font-sans p-4 relative">
           {/* Секция активных каналов в правом верхнем углу */}
           {activeChannels.length > 0 && (
               <div className="absolute top-8 right-8 w-80 z-10">
                   <div className="text-center mb-4">
                       <h3 className="text-2xl font-bold text-purple-400 mb-2">Уже подключились</h3>
                   </div>
                   <div className="vertical-carousel relative overflow-hidden rounded-xl" style={{height: `${activeChannels.length * 80}px`}}>
                       <div className="flex flex-col h-full">
                           {/* Показываем только реальные данные без дублирования */}
                           {activeChannels.map((channel, index) => (
                               <div 
                                   key={channel.id}
                                   className="carousel-item flex items-center justify-center px-4 py-2 cursor-pointer h-[80px] flex-shrink-0 hover:bg-purple-500/10 rounded-lg transition-colors"
                                   onClick={() => {
                                       const url = channel.platform === 'twitch' 
                                           ? `https://twitch.tv/${channel.username}`
                                           : `https://vk.com/video/@${channel.username}`;
                                       window.open(url, '_blank');
                                   }}
                               >
                                   <div className="relative">
                                       <img 
                                           src={channel.avatar}
                                           alt={channel.display_name || channel.username}
                                           className={`w-12 h-12 rounded-full object-cover avatar-border ${channel.isOnline ? 'live' : ''}`}
                                           onError={(e) => {
                                               // Fallback на ui-avatars если аватарка не загрузилась
                                               e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.display_name || channel.username)}&background=1f2937&color=ffffff&size=48`;
                                           }}
                                       />
                                       {channel.isOnline && (
                                           <div className="live-badge">LIVE</div>
                                       )}
                                   </div>
                                   <div className="ml-3 text-center">
                                       <div className="text-white font-medium text-sm">
                                           {channel.display_name || channel.username}
                                       </div>
                                       <div className="flex items-center justify-center gap-1 mt-1">
                                           {channel.platform === 'twitch' ? (
                                               <TwitchIcon className="h-3 w-3 text-purple-400" />
                                           ) : (
                                               <VKIcon className="h-3 w-3 text-blue-400" />
                                           )}
                                           <span className="text-xs text-slate-300 capitalize">
                                               {channel.platform}
                                           </span>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}
            
            <Card className="login-card w-full max-w-sm shadow-2xl">
                <CardHeader className="text-center pt-10 pb-4">
                    <h1 className="select-none text-3xl font-bold mb-3 text-green-400 h-10 font-mono tracking-wider">
                        {title}
                        <span className="blinking-cursor">{!isTyping ? '_' : ''}</span>
                    </h1>
                    <p className={`text-slate-400 text-sm h-6 subtitle-fade ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}>
                        {subtitleText}
                    </p>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                console.log('🖱️ Кнопка Twitch нажата!');
                                login();
                            }}
                            className="w-full bg-[#9146FF] hover:bg-[#7a3adc] text-white font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base"
                        >
                            <TwitchIcon className="mr-2 h-5 w-5" />
                            Войти через Twitch
                        </button>

                        <button
                            onClick={handleVkLogin}
                            className="w-full bg-red-800 hover:bg-red-900 text-white font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base"
                        >
                            <VKIcon className="mr-2 h-5 w-5" />
                            Войти через VK Live
                        </button>
                        
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-700/50"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-gradient-to-r from-[#2a2235] to-[#342a40] px-3 text-xs text-slate-300 uppercase font-medium">или</span>
                            </div>
                        </div>

                        <button
                            onClick={handleGuestMode}
                            className="w-full bg-green-500/30 hover:bg-green-500/40 text-green-200 font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base border border-green-500/30 hover:border-green-500/50"
                        >
                            Гостевой режим
                        </button>
                    </div>
                </CardContent>
            </Card>
            
            {/* Модальное окно гостевого режима */}
            <Dialog open={guestModalOpen} onOpenChange={setGuestModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-white">
                            Гостевой режим
                        </DialogTitle>
                        <p className="text-sm text-gray-400 text-center mt-2">
                            Введите данные для входа в гостевой режим. Бот автоматически подключится к указанному каналу.
                        </p>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="platform" className="text-white">
                                Платформа
                            </Label>
                            <Select value={guestPlatform} onValueChange={setGuestPlatform}>
                                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="twitch">
                                        <div className="flex items-center">
                                            <TwitchIcon className="mr-2 h-4 w-4" />
                                            Twitch
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="vk">
                                        <div className="flex items-center">
                                            <VKIcon className="mr-2 h-4 w-4" />
                                            VK Live
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label htmlFor="username" className="text-white">
                                Никнейм канала
                            </Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Введите никнейм канала"
                                value={guestUsername}
                                onChange={(e) => setGuestUsername(e.target.value)}
                                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                onKeyPress={(e) => e.key === 'Enter' && checkChannel()}
                            />
                            {channelError && (
                                <p className="text-red-400 text-sm mt-1">{channelError}</p>
                            )}
                        </div>
                        
                        <div className="flex space-x-2">
                            <Button
                                onClick={checkChannel}
                                disabled={isCheckingChannel || !guestUsername.trim()}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isCheckingChannel ? 'Проверка...' : 'Подключиться'}
                            </Button>
                            <Button
                                onClick={() => setGuestModalOpen(false)}
                                variant="outline"
                                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                Отмена
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            
            <CookieConsent />
        </div>
    );
};

export default LoginPage;
