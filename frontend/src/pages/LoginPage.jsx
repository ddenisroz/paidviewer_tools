// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import CookieConsent from '@/components/CookieConsent';

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
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [subtitleText, setSubtitleText] = useState('');
    const [subtitleVisible, setSubtitleVisible] = useState(false);
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
    const fullTitle = 'Payedviewer_tools';
    const features = ['TTS озвучка', 'Медиа запросы', 'Анализ чата'];

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
        setGuestMode();
        navigate('/dashboard');
    };

    return (
        <div className="login-page-bg min-h-screen flex flex-col items-center justify-center text-white font-sans p-4">
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
            <CookieConsent />
        </div>
    );
};

export default LoginPage;
