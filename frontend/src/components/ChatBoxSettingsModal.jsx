// src/components/ChatBoxSettingsModal.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { botService } from '../services/microservices';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { toast } from 'sonner';
import { twitchBadgesService } from '../services/twitchBadges';

const ChatBoxSettingsModal = ({ isOpen, onClose, onSave }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Загрузка настроек при открытии
    useEffect(() => {
        if (isOpen) {
            loadSettings();
            // Блокируем скролл body
            document.body.style.overflow = 'hidden';
        } else {
            // Восстанавливаем скролл body
            document.body.style.overflow = '';
        }
        
        // Cleanup при размонтировании
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);
    
    // Загружаем выбранный шрифт из Google Fonts
    useEffect(() => {
        if (settings?.font_family && !document.getElementById(`font-${settings.font_family}`)) {
            const link = document.createElement('link');
            link.id = `font-${settings.font_family}`;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${settings.font_family.replace(' ', '+')}:wght@400;600;700&display=swap`;
            document.head.appendChild(link);
        }
    }, [settings?.font_family]);
    
    // Обработчик клавиши Escape для закрытия модального окна
    useEffect(() => {
        if (!isOpen) return;
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);
    
    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/chatbox/settings');
            
            // ✅ Нормализуем данные - убеждаемся что числа это числа
            const normalizedSettings = {
                ...response.data,
                font_size: parseInt(response.data.font_size) || 16,
                text_stroke_width: parseInt(response.data.text_stroke_width) || 0,
                background_opacity: parseFloat(response.data.background_opacity) ?? 0.5,
                max_messages: parseInt(response.data.max_messages) || 20,
                message_spacing: parseInt(response.data.message_spacing) || 4,
                animation_type: response.data.animation_type || 'fade',
                message_fade_seconds: parseInt(response.data.message_fade_seconds) || 60
            };
            
            setSettings(normalizedSettings);
        } catch (error) {
            console.error('Ошибка загрузки настроек ChatBox:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleSave = async (regenerateToken = false) => {
        try {
            setSaving(true);
            const response = await botService.post(
                `/api/chatbox/settings?regenerate_token=${regenerateToken}`,
                settings
            );
            
            // ✅ Нормализуем данные после сохранения
            const normalizedSettings = {
                ...response.data,
                font_size: parseInt(response.data.font_size) || 16,
                text_stroke_width: parseInt(response.data.text_stroke_width) || 0,
                background_opacity: parseFloat(response.data.background_opacity) ?? 0.5,
                max_messages: parseInt(response.data.max_messages) || 20,
                message_fade_seconds: parseInt(response.data.message_fade_seconds) || 60,
                message_spacing: parseInt(response.data.message_spacing) || 4,
                animation_type: response.data.animation_type || 'fade'
            };
            
            setSettings(normalizedSettings);
            onSave?.(normalizedSettings);
            
            if (regenerateToken) {
                toast.success('Токен перегенерирован! Обновите ссылку в OBS.');
            } else {
                toast.success('Настройки ChatBox сохранены!');
            }
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
            toast.error('Не удалось сохранить настройки');
        } finally {
            setSaving(false);
        }
    };
    
    const copyToClipboard = () => {
        if (settings?.widget_url) {
            navigator.clipboard.writeText(settings.widget_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Ссылка скопирована в буфер обмена!');
        }
    };
    
    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };
    
    // Обрезание сообщения до N слов для горизонтального чата
    const truncateWords = (text, maxWords = 6) => {
        if (!text) return '';
        const words = text.trim().split(/\s+/);
        if (words.length <= maxWords) return text;
        return words.slice(0, maxWords).join(' ') + '...';
    };
    
    if (!isOpen) return null;
    
    if (loading) {
        const loadingContent = (
            <>
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/80 z-[9999]" style={{ backdropFilter: 'blur(4px)' }} />
                {/* Loading Content */}
                <div className="fixed inset-0 z-[10000] flex items-center justify-center">
                    <div className="bg-gray-900 p-8 rounded-lg shadow-2xl">
                        <div className="text-white">Загрузка...</div>
                    </div>
                </div>
            </>
        );
        return ReactDOM.createPortal(loadingContent, document.body);
    }
    
    // Google Fonts для выбора (разнообразные стили)
    const GOOGLE_FONTS = [
        'Inter',              // Современный геометрический
        'Roboto',             // Нейтральный гротеск
        'Montserrat',         // Круглый геометрический
        'Oswald',             // Узкий и высокий
        'Ubuntu',             // Гуманистический
        'Comic Neue',         // Комичный стиль
        'Pacifico',           // Рукописный скрипт
        'Russo One',          // Жирный заголовочный
        'Exo 2',              // Футуристичный (кириллица)
        'Play',               // Современный геометрический (кириллица)
        'Rubik',              // Округлый современный (кириллица)
        'Marck Script',       // Рукописный элегантный (кириллица)
        'Ruslan Display',     // Декоративный русский
        'Lobster',            // Декоративный ретро
        'Caveat',             // Небрежный рукописный
        'Bebas Neue',         // Конденсированный заголовочный
        'Permanent Marker',   // Маркер
        'JetBrains Mono',     // Моноширинный для кода
        'Fira Code',          // Моноширинный с лигатурами
        'Comfortaa'           // Круглый дружелюбный
    ];
    
    // Пример сообщений для preview
    const previewMessages = [
        { 
            id: 1, 
            platform: 'twitch', 
            author: 'Yourchy', 
            message: 'Привет, это тестовое сообщение!', 
            time: '12:34',
            role: 'broadcaster',
            badges: ['broadcaster/1', 'premium/1']
        },
        { 
            id: 2, 
            platform: 'vk', 
            author: 'Your4y', 
            message: 'Еще одно сообщение для примера', 
            time: '12:35',
            role: 'moderator',
            badges: [] // VK Live не использует Twitch badges
        },
        { 
            id: 3, 
            platform: 'twitch', 
            author: 'TestUser', 
            message: 'Как дела? Проверка preview', 
            time: '12:36',
            role: 'subscriber',
            badges: ['subscriber/12', 'sub-gifter/1']
        }
    ];
    
    const modalContent = (
        <>
            {/* Backdrop - затемнение заднего фона */}
            <div 
                className="fixed inset-0 bg-black/80 z-[9999]"
                onClick={onClose}
                style={{ backdropFilter: 'blur(4px)' }}
            />
            
            {/* Modal Content */}
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                <div 
                    className="bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Header */}
                <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Настройки ChatBox для OBS</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Content: 2 columns */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 gap-6 h-full">
                        {/* Left: Settings */}
                        <div className="space-y-6">
                            {/* OBS Link */}
                            <div className="space-y-2">
                                <Label className="text-white font-semibold">Ссылка для OBS</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={settings?.widget_url || ''}
                                        readOnly
                                        className="bg-gray-800 text-white border-gray-600 font-mono text-xs flex-1"
                                    />
                                    <Button
                                        onClick={copyToClipboard}
                                        variant="outline"
                                        size="sm"
                                        className="border-gray-600 hover:bg-gray-700"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                    <Button
                                        onClick={() => handleSave(true)}
                                        variant="outline"
                                        size="sm"
                                        className="border-gray-600 hover:bg-gray-700"
                                        title="Обновить токен"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Добавьте эту ссылку в OBS (Browser Source)
                                </p>
                            </div>
                            
                            {/* Font Family */}
                            <div className="space-y-2">
                                <Label className="text-white">Шрифт</Label>
                                <select
                                    value={settings?.font_family || 'Inter'}
                                    onChange={(e) => handleChange('font_family', e.target.value)}
                                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2"
                                >
                                    {GOOGLE_FONTS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Font Size */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-white">Размер шрифта</Label>
                                    <span className="text-sm text-gray-400">{settings?.font_size}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="8"
                                    max="32"
                                    value={settings?.font_size || 16}
                                    onChange={(e) => handleChange('font_size', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings?.font_size - 8) / 24) * 100}%, #374151 ${((settings?.font_size - 8) / 24) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>
                            
                            {/* Animation Type */}
                            <div className="space-y-2">
                                <Label className="text-white">Анимация сообщений</Label>
                                <select
                                    value={settings?.animation_type || 'fade'}
                                    onChange={(e) => handleChange('animation_type', e.target.value)}
                                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2"
                                >
                                    <option value="fade">Появление</option>
                                    <option value="slide-right">← Слева</option>
                                    <option value="slide-left">Справа →</option>
                                    <option value="scale">Увеличение</option>
                                    <option value="bounce">Подпрыгивание</option>
                                </select>
                            </div>
                            
                            {/* Message Fade Duration */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-white">Исчезание сообщений</Label>
                                    <span className="text-sm text-gray-400">
                                        {settings?.message_fade_seconds === 60 ? 'Никогда' : `${settings?.message_fade_seconds}с`}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="60"
                                    step="10"
                                    value={settings?.message_fade_seconds || 60}
                                    onChange={(e) => handleChange('message_fade_seconds', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings?.message_fade_seconds - 10) / 50) * 100}%, #374151 ${((settings?.message_fade_seconds - 10) / 50) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>
                            
                            {/* Text Stroke */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-white">Обводка букв (читаемость)</Label>
                                    <span className="text-sm text-gray-400">
                                        {settings?.text_stroke_width === 0 ? 'Выкл' : `${settings?.text_stroke_width || 0}px`}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.5"
                                    value={settings?.text_stroke_width || 0}
                                    onChange={(e) => handleChange('text_stroke_width', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings?.text_stroke_width || 0) / 3) * 100}%, #374151 ${((settings?.text_stroke_width || 0) / 3) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>
                            
                            {/* Background Opacity */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-white">Непрозрачность фона</Label>
                                    <span className="text-sm text-gray-400">{Math.round((settings?.background_opacity ?? 0.8) * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round((settings?.background_opacity ?? 0.8) * 100)}
                                    onChange={(e) => handleChange('background_opacity', parseFloat(e.target.value) / 100)}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${Math.round((settings?.background_opacity ?? 0.8) * 100)}%, #374151 ${Math.round((settings?.background_opacity ?? 0.8) * 100)}%, #374151 100%)`
                                    }}
                                />
                            </div>
                            
                            {/* Max Messages */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-white">Количество сообщений</Label>
                                    <span className="text-sm text-gray-400">{settings?.max_messages}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={settings?.max_messages || 20}
                                    onChange={(e) => handleChange('max_messages', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings?.max_messages - 1) / 49) * 100}%, #374151 ${((settings?.max_messages - 1) / 49) * 100}%, #374151 100%)`
                                    }}
                                />
                            </div>
                            
                            {/* Chat Direction */}
                            <div className="space-y-2">
                                <Label className="text-white">Направление чата</Label>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => handleChange('chat_direction', 'vertical')}
                                        variant={settings?.chat_direction === 'vertical' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1"
                                    >
                                        ↓ Вертикальный
                                    </Button>
                                    <Button
                                        onClick={() => handleChange('chat_direction', 'horizontal')}
                                        variant={settings?.chat_direction === 'horizontal' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1"
                                    >
                                        → Горизонтальный
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Toggles */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                                    <Label className="text-white cursor-pointer">Показывать иконки платформ</Label>
                                    <Switch
                                        checked={settings?.show_platform_icons ?? true}
                                        onCheckedChange={(checked) => handleChange('show_platform_icons', checked)}
                                    />
                                </div>
                                
                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                                    <Label className="text-white cursor-pointer">Показывать значки</Label>
                                    <Switch
                                        checked={settings?.show_badges ?? true}
                                        onCheckedChange={(checked) => handleChange('show_badges', checked)}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Right: Live Preview */}
                        <div className="space-y-2">
                            <Label className="text-white font-semibold">Предпросмотр</Label>
                            <div 
                                className="rounded-lg p-4 h-[400px] chatbox-preview-scroll"
                                style={{
                                    backgroundColor: (() => {
                                        const hex = settings?.background_color || '#000000';
                                        const opacity = settings?.background_opacity ?? 0.8;
                                        // Конвертируем hex в rgba
                                        const r = parseInt(hex.slice(1, 3), 16);
                                        const g = parseInt(hex.slice(3, 5), 16);
                                        const b = parseInt(hex.slice(5, 7), 16);
                                        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                                    })(),
                                    overflowY: settings?.chat_direction === 'horizontal' ? 'hidden' : 'auto',
                                    overflowX: settings?.chat_direction === 'horizontal' ? 'auto' : 'hidden',
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#4B5563 #1F2937'
                                }}
                            >
                                <div 
                                    className={settings?.chat_direction === 'horizontal' ? 'flex' : 'space-y-2'}
                                    style={{
                                        flexDirection: settings?.chat_direction === 'horizontal' ? 'row' : 'column',
                                        gap: settings?.chat_direction === 'horizontal' ? '16px' : '0',
                                        alignItems: settings?.chat_direction === 'horizontal' ? 'center' : 'stretch'
                                    }}
                                >
                                    {previewMessages.slice(0, Math.min(3, settings?.max_messages || 20)).map((msg, index, array) => {
                                        // Анимация применяется ТОЛЬКО к последнему сообщению в предпросмотре
                                        const isLastMessage = index === array.length - 1;
                                        const animationClass = isLastMessage ? (
                                            settings?.animation_type === 'fade' ? 'animate-fadeIn' :
                                            settings?.animation_type === 'slide-right' ? 'animate-slideRight' :
                                            settings?.animation_type === 'slide-left' ? 'animate-slideLeft' :
                                            settings?.animation_type === 'scale' ? 'animate-scale' :
                                            settings?.animation_type === 'bounce' ? 'animate-bounce' :
                                            'animate-fadeIn'
                                        ) : '';
                                        
                                        return (
                                        <div 
                                            key={msg.id} 
                                            className={animationClass}
                                            style={{
                                                whiteSpace: settings?.chat_direction === 'horizontal' ? 'nowrap' : 'normal',
                                                wordBreak: settings?.chat_direction === 'horizontal' ? 'normal' : 'break-word',
                                                fontSize: `${settings?.font_size}px`,
                                                fontFamily: `'${settings?.font_family || 'Inter'}', system-ui, sans-serif`,
                                                lineHeight: '1.5',
                                                flexShrink: 0,
                                                minWidth: settings?.chat_direction === 'horizontal' ? 'fit-content' : 'auto',
                                                maxWidth: settings?.chat_direction === 'horizontal' ? '400px' : 'auto',
                                                padding: settings?.chat_direction === 'horizontal' ? '12px 16px' : '0',
                                                backgroundColor: settings?.chat_direction === 'horizontal' ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
                                                borderRadius: settings?.chat_direction === 'horizontal' ? `${settings?.border_radius || 8}px` : '0'
                                            }}
                                        >
                                            {/* Platform Icon */}
                                            {settings?.show_platform_icons && (
                                                msg.platform === 'twitch' ? (
                                                    <TwitchIcon 
                                                        style={{ 
                                                            color: '#9147FF',
                                                            width: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                                            height: `${Math.max(12, Math.min(24, settings?.font_size || 16))}px`,
                                                            display: 'inline-block',
                                                            verticalAlign: 'text-bottom',
                                                            marginRight: '4px'
                                                        }} 
                                                    />
                                                ) : (
                                                    <VKIcon 
                                                        style={{ 
                                                            color: '#EF4444',
                                                            // VK иконка на 15% меньше из-за другого viewBox (20x20 vs 24x24)
                                                            width: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                                                            height: `${Math.round(Math.max(12, Math.min(24, settings?.font_size || 16)) * 0.85)}px`,
                                                            display: 'inline-block',
                                                            verticalAlign: 'text-bottom',
                                                            marginRight: '4px'
                                                        }} 
                                                    />
                                                )
                                            )}
                                            
                                            {/* Badges (значки Twitch) */}
                                            {settings?.show_badges && msg.badges && msg.badges.length > 0 && (
                                                <>
                                                    {msg.badges.map((badge, idx) => {
                                                        const [badgeId, version] = badge.split('/');
                                                        const badgeUrl = twitchBadgesService.getBadgeUrl(badgeId, version, '1x');
                                                        
                                                        // Пропускаем badge если URL не найден
                                                        if (!badgeUrl) return null;
                                                        
                                                        const badgeSize = Math.max(14, Math.min(28, (settings?.font_size || 16) * 1.1));
                                                        
                                                        return (
                                                            <img 
                                                                key={idx} 
                                                                src={badgeUrl}
                                                                alt={badgeId}
                                                                title={badge}
                                                                style={{ 
                                                                    width: `${badgeSize}px`, 
                                                                    height: `${badgeSize}px`,
                                                                    display: 'inline-block',
                                                                    verticalAlign: 'text-bottom',
                                                                    marginRight: '2px'
                                                                }}
                                                                onError={(e) => {
                                                                    // Скрываем если значок не загрузился
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </>
                                            )}
                                            
                                            {/* Message Content */}
                                            <span 
                                                style={{
                                                    overflowWrap: 'break-word',
                                                    wordWrap: 'break-word',
                                                    ...(settings?.text_stroke_width > 0 ? {
                                                        textShadow: `
                                                            -${settings.text_stroke_width}px -${settings.text_stroke_width}px 0 ${settings?.text_stroke_color || '#000000'},
                                                            ${settings.text_stroke_width}px -${settings.text_stroke_width}px 0 ${settings?.text_stroke_color || '#000000'},
                                                            -${settings.text_stroke_width}px ${settings.text_stroke_width}px 0 ${settings?.text_stroke_color || '#000000'},
                                                            ${settings.text_stroke_width}px ${settings.text_stroke_width}px 0 ${settings?.text_stroke_color || '#000000'}
                                                        `
                                                    } : {})
                                                }}
                                            >
                                                <span className="font-semibold" style={{ 
                                                    color: msg.platform === 'twitch' ? '#9146FF' : '#FF0000'
                                                }}>
                                                    {msg.author}
                                                </span>
                                                {': '}
                                                <span style={{ color: '#FFFFFF' }}>
                                                    {settings?.chat_direction === 'horizontal' ? truncateWords(msg.message, 6) : msg.message}
                                                </span>
                                            </span>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Изменения применяются в реальном времени
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="border-t border-gray-700 p-4 flex justify-end items-center">
                    <div className="flex gap-3">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="border-gray-600 hover:bg-gray-700"
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </div>
                </div>
                
                <style>{`
                    /* КРУТЫЕ АНИМАЦИИ ДЛЯ ПРЕВЬЮ */
                    
                    @keyframes fadeIn {
                        0% {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes slideRight {
                        0% {
                            opacity: 0;
                            transform: translateX(-40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes slideLeft {
                        0% {
                            opacity: 0;
                            transform: translateX(40px) scale(0.95);
                        }
                        60% {
                            transform: translateX(-5px) scale(1.02);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(0) scale(1);
                        }
                    }
                    
                    @keyframes scale {
                        0% {
                            opacity: 0;
                            transform: scale(0.7) rotate(-3deg);
                        }
                        50% {
                            transform: scale(1.05) rotate(1deg);
                        }
                        100% {
                            opacity: 1;
                            transform: scale(1) rotate(0deg);
                        }
                    }
                    
                    @keyframes bounce {
                        0% {
                            opacity: 0;
                            transform: translateY(30px) scale(0.8);
                        }
                        40% {
                            opacity: 1;
                            transform: translateY(-10px) scale(1.05);
                        }
                        60% {
                            transform: translateY(5px) scale(0.98);
                        }
                        80% {
                            transform: translateY(-3px) scale(1.01);
                        }
                        100% {
                            transform: translateY(0) scale(1);
                        }
                    }
                    
                    .animate-fadeIn {
                        animation: fadeIn 0.4s ease-out;
                    }
                    
                    .animate-slideRight {
                        animation: slideRight 0.4s ease-out;
                    }
                    
                    .animate-slideLeft {
                        animation: slideLeft 0.4s ease-out;
                    }
                    
                    .animate-scale {
                        animation: scale 0.4s ease-out;
                    }
                    
                    .animate-bounce {
                        animation: bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    }
                    
                    input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background: #8b5cf6;
                        cursor: pointer;
                    }
                    
                    input[type="range"]::-moz-range-thumb {
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background: #8b5cf6;
                        cursor: pointer;
                        border: none;
                    }
                `}</style>
                </div> {/* Закрываем bg-gray-900 div */}
            </div> {/* Закрываем wrapper div */}
        </>
    );
    
    // Используем Portal для рендеринга модального окна в корне DOM
    return ReactDOM.createPortal(modalContent, document.body);
};

export default ChatBoxSettingsModal;
