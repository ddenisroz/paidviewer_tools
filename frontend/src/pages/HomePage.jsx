// src/pages/HomePage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, Clapperboard, Power, PowerOff, MessageSquare, Save, Check, RefreshCw, Activity, Edit3, Tag, CheckCircle, XCircle } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Loader } from '@/components/ui/loader';
import FeatureCard from '../components/FeatureCard';

// SVG иконки платформ
const TwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.714v5.143H11.57zm4.714 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
    </svg>
);
const VKIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.162 18.992c.627 0 .94-.493.94-.493s.313-1.042.827-1.666c.513-.624.885-.885 1.4-.885.71 0 1.042.686 1.042 2.054 0 2.29-1.573 2.5-1.573 2.5s-1.72.186-2.583-.58c-1.284-1.1-2.19-2.888-2.61-2.888-.19 0-.343.248-.343.528 0 .685.56 1.04.56 1.04s.405.343 1.34 1.34c1.253 1.31 2.02 1.87 3.14 1.87 1.4 0 2.887-.91 2.887-3.17 0-3.32-2.31-3.66-2.92-3.66-.465 0-.857.28-.857.28s-1.1.91-2.48 2.6c-1.378 1.72-2.32 2.6-3.13 2.6-1.01 0-1.285-.885-1.285-1.57 0-1.1.886-2.67 2.856-4.918C13.064 8.71 14.15 7.6 14.71 7.15c.56-.434.77-.623.65-.97-.12-.348-.685-.405-.685-.405s-2.948.03-4.974 2.418C7.68 10.64 6.84 12.56 6.84 14.16c0 .28.057.56.057.56s.114.743 1.042.943c.928.2 1.31-.372 2.16-1.637.85-1.264 1.13-1.84 1.13-1.84s.285-.624.742-.624c.458 0 .5.494.5.886 0 .743-.113 1.9-.97 3.228-.857 1.33-1.928 2.054-2.556 2.054-1.04 0-2.02-.77-2.73-1.928-1.54-2.476-2.39-4.89-2.39-4.89s-.142-.37.03-.654c.17-.283.58-.313.58-.313s2.7.085 4.88 2.38c1.17 1.18 1.57 2.02 2.13 2.02.56 0 .88-.5.88-1.286 0-1.07-.4-2.19-1.81-3.63-1.4-1.43-2.61-2.445-3.6-2.92C5.993 6.69 5.86 6.13 6.12 5.88c.26-.25.71-.22.71-.22s3.81.087 6.16 2.855c1.1 1.31 1.48 2.22 2.16 2.22.68 0 1.07-.5 1.07-1.664 0-.46-.06-.885-.17-1.31-.77-2.918-2.67-4.17-2.67-4.17s-.34-.22-.53-.22c-.19 0-.4.16-.28.528.11.37.88 1.25.88 1.25s1.28 1.57 1.28 2.825c0 .5-.14.8-.37.91-.23.11-.53.08-.53.08s-.8-.28-1.74-1.22c-1.28-1.28-2.28-2.1-3.65-2.556C9.173 3.16 8.463 3 7.808 3 5.8 3 4 4.48 4 6.27c0 1.636 1.07 3.05 2.22 4.19C7.64 11.87 8.9 13 8.9 14.6c0 .314-.06.6-.06.6s-.17.885-1.226 1.165c-1.057.28-1.84-.46-1.84-.46s-.94-1.166-2.25-2.79C2.2 11.2 1 9.4 1 7.66c0-2.887 2.417-4.66 5.4-4.66 1.4 0 2.94.435 3.93 1.13.99.7 1.63 1.54 1.63 1.54s.14.2.37.22c.23.03.4-.05.4-.05s.23-.22.11-.527C12.72 5 12.01 4.13 11.12 3.52 10.05 2.8 8.66 2.41 7.4 2.41c-3.6 0-6.4 2.02-6.4 5.25 0 2.16 1.37 4.14 2.8 5.92 1.42 1.78 2.7 3.3 4.13 3.3 1.13 0 1.77-.94 1.77-1.57 0-.31-.08-.65-.19-.97-.28-.85-.82-1.48-1.51-2.19-1.2-1.28-2.3-2.25-2.3-3.41 0-.2.03-.37.08-.53.2-1.07 1.31-1.63 1.31-1.63s.2-.14.37-.03c.17.11.2.34.2.34s-.48 2.13 1.48 4.25c1.96 2.11 2.5 2.8 3.51 2.8z"/>
    </svg>
);


const HomePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled, toggleTts: onToggleTts } = useTts();
    const {
        streamTitle, setStreamTitle,
        streamCategory, setStreamCategory,
        categorySearch, setCategorySearch,
        categories, loadCategories,
        streamHistory,
        currentViewers,
        loading,
        status,
        updateStreamTitle,
        updateStreamCategory,
        loadStreamData
    } = useData();

    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    
    const handleCategorySearch = async (value) => {
        setCategorySearch(value);
        setShowCategoryDropdown(true);

        if (value.length === 0) {
            setStreamCategory('');
            await loadCategories();
        } else if (value.length > 2) {
            await loadCategories(value);
        }
    };
    
    const preparedStreamHistory = useMemo(() => {
        if (!streamHistory || streamHistory.length < 1) return [];

        // Сортируем на случай, если данные приходят не по порядку
        const sortedHistory = [...streamHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return []; // Защита от невалидной даты

        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp).getTime();
                if (isNaN(currentTime)) return null; // Пропускаем невалидные точки

                const diffSeconds = Math.round((currentTime - startTime) / 1000);
                const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                const seconds = (diffSeconds % 60).toString().padStart(2, '0');
                
                return {
                    ...d,
                    time: `${minutes}:${seconds}`,
                };
            }).filter(Boolean); // Убираем null значения
    }, [streamHistory]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="p-2 bg-background/90 border border-border/50 rounded-lg shadow-xl backdrop-blur-sm">
                    <p className="label text-sm font-bold text-foreground">{`Время стрима: ${label}`}</p>
                    <p className="intro text-sm" style={{ color: payload[0].stroke }}>
                        {`Зрители: ${data.viewers}`}
                    </p>
                    {data.category && (
                        <p className="desc text-xs text-muted-foreground">{`Категория: ${data.category}`}</p>
                    )}
                </div>
            );
        }
        return null;
    };
    
    const handleUpdateTitle = async () => {
        await updateStreamTitle(streamTitle);
    };

    const handleUpdateCategory = async () => {
        await updateStreamCategory(streamCategory);
    };
    
    const getStatusIcon = (status) => {
        switch (status) {
            case 'loading': return <Loader size="sm" className="text-purple-500" />;
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
            default: return null;
        }
    };
    
    const getStatusText = (status) => {
        switch (status) {
            case 'loading': return 'Обновление...';
            case 'success': return 'Успешно обновлено';
            case 'error': return 'Ошибка обновления';
            default: return '';
        }
    };
    
    return (
        <div className="space-y-8">
            <div className="flex justify-center">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard 
                        title="TTS ИИ озвучка" 
                        icon={<Mic />} 
                        path="/dashboard/tts"
                        enabled={integrations?.twitch?.enabled}
                        actionButton={{
                            text: ttsEnabled ? 'Выключить озвучку' : 'Включить озвучку',
                            icon: ttsEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />,
                            variant: ttsEnabled ? "destructive" : "default",
                        }}
                        onActionClick={onToggleTts}
                    />
                    <FeatureCard 
                        title="Медиа интерактивность" 
                        icon={<Clapperboard />} 
                        path="/dashboard/media"
                        enabled={integrations?.twitch?.enabled}
                        actionButton={{ text: 'Перейти' }}
                        onActionClick={() => navigate('/dashboard/media')}
                    />
                    <FeatureCard 
                        title="Анализ и модерация чата" 
                        icon={<MessageSquare />} 
                        path="/dashboard/commands"
                        enabled={integrations?.twitch?.enabled}
                        actionButton={{ text: 'Перейти' }}
                        onActionClick={() => navigate('/dashboard/commands')}
                    />
                </div>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className={`h-80 transition-all duration-300 ${integrations.twitch?.enabled ? 'border-green-500/50 bg-green-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                            {currentViewers > 0 ? 'Онлайн' : 'Офлайн'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {integrations.twitch?.enabled ? (
                            <div className="h-full flex flex-col justify-between">
                                <div className="h-40 -ml-4 -mr-2 -mb-4">
                                    {loading.history ? (
                                        <div className="flex justify-center items-center h-full"><Loader /></div>
                                    ) : streamHistory.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={preparedStreamHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                <defs><linearGradient id="colorViewers" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8884d8" stopOpacity={0.6}/><stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/></linearGradient></defs>
                                                <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} allowDecimals={false} domain={[0, 'dataMax + 10']} tick={{ fill: 'hsl(var(--muted-foreground))' }}/>
                                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                                                <Area type="monotone" dataKey="viewers" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorViewers)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    ) : (
                                        <div className="flex justify-center items-center h-full text-muted-foreground text-sm">Нет данных для отображения. <br/> Сбор статистики начнется автоматически.</div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                            <span className="text-sm">T: {currentViewers}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-center">
                                <div className="space-y-2"><Activity className="h-12 w-12 text-muted-foreground mx-auto" /><p className="text-sm text-muted-foreground">Подключите интеграции для просмотра статистики</p></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <Card className={`h-80 transition-all duration-300 ${integrations.twitch?.enabled ? 'border-blue-500/50 bg-blue-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Edit3 className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
                            Смена названия
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {integrations.twitch?.enabled ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTitle(); }}>
                                    <div className="space-y-4">
                                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center"><TwitchIcon /></div><span className="text-base font-bold">Twitch</span></div>
                                        <div className="space-y-3">
                                        <Input value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} placeholder="Название стрима" maxLength={140} className="text-sm h-10 title-input"/>
                                            <div className="flex justify-center">
                                            <Button type="submit" disabled={!streamTitle.trim() || status.title === 'loading'} size="lg" className="w-full h-12 text-base font-semibold">
                                                {status.title === 'loading' ? <Loader size="sm" /> : status.title === 'success' ? <div className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /><span>Сохранено!</span></div> : <><Save className="h-5 w-5 mr-2" />Сохранить</>}
                                                </Button>
                                        </div>
                                        {getStatusText(status.title) && (<div className="flex items-center justify-center gap-2">{getStatusIcon(status.title)}<span className="text-sm">{getStatusText(status.title)}</span></div>)}
                                        </div>
                                    </div>
                                    </form>
                        ) : (
                            <div className="h-32 flex items-center justify-center text-center">
                                <div className="space-y-2 flex flex-col items-center justify-center h-full"><Edit3 className="h-12 w-12 text-muted-foreground" /><p className="text-sm text-muted-foreground">Подключите интеграции для смены названия</p></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <Card className={`h-80 transition-all duration-300 ${integrations.twitch?.enabled ? 'border-purple-500/50 bg-purple-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-purple-500' : 'text-muted-foreground'}`} />
                            Смена категории
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {integrations.twitch?.enabled ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleUpdateCategory(); }}>
                                    <div className="space-y-4">
                                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center"><TwitchIcon /></div><span className="text-base font-bold">Twitch</span></div>
                                        <div className="space-y-3">
                                            <div className="relative category-dropdown">
                                            <Input value={categorySearch} onChange={(e) => handleCategorySearch(e.target.value)} onFocus={() => { setShowCategoryDropdown(true); loadCategories(true); }} placeholder="Поиск категории..." className="text-sm h-10"/>
                                            {showCategoryDropdown && categories?.length > 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                    {categories.map((category) => (
                                                        <div key={category.id} onClick={() => { setStreamCategory(category.id); setCategorySearch(category.name); setShowCategoryDropdown(false); }} className="flex items-center gap-3 p-2 hover:bg-muted cursor-pointer">
                                                            {category.box_art_url && (<img src={category.box_art_url.replace('{width}', '52').replace('{height}', '72')} alt={category.name} className="w-8 h-8 rounded object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }}/>)}
                                                            <span className="text-sm flex-1 truncate">{category.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            </div>
                                            <div className="flex justify-center">
                                            <Button type="submit" disabled={!streamCategory || !categorySearch || status.category === 'loading'} size="lg" className="w-full h-12 text-base font-semibold">
                                                {status.category === 'loading' ? <Loader size="sm" /> : status.category === 'success' ? <div className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /><span>Сохранено!</span></div> : <><Save className="h-5 w-5 mr-2" />{!streamCategory || !categorySearch ? 'Выберите категорию' : 'Сохранить'}</>}
                                                </Button>
                                        </div>
                                        {getStatusText(status.category) && (<div className="flex items-center justify-center gap-2">{getStatusIcon(status.category)}<span className="text-sm">{getStatusText(status.category)}</span></div>)}
                                        </div>
                                    </div>
                                    </form>
                        ) : (
                            <div className="h-32 flex items-center justify-center text-center">
                                <div className="space-y-2 flex flex-col items-center justify-center h-full"><Tag className="h-12 w-12 text-muted-foreground" /><p className="text-sm text-muted-foreground">Подключите интеграции для смены категории</p></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default HomePage;
