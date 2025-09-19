import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Play, Pause, Download, Mic, Volume2, Crown, Star, Check, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const VoiceManagementPage = () => {
    const { user, isAuthenticated } = useAuth();
    const [voices, setVoices] = useState({ standard: [], vip: [] });
    const [selectedVoices, setSelectedVoices] = useState([]);
    const [voiceSettings, setVoiceSettings] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [playingVoice, setPlayingVoice] = useState(null);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showTestDialog, setShowTestDialog] = useState(false);
    const [testVoice, setTestVoice] = useState(null);
    const [testText, setTestText] = useState('Привет, это тестовое воспроизведение голоса');
    const [testAudioUrl, setTestAudioUrl] = useState(null);
    const [testLoading, setTestLoading] = useState(false);
    
    // Состояние для загрузки голоса
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [refText, setRefText] = useState('');
    const [swaySamplingCoef, setSwaySamplingCoef] = useState(1.0);
    const [cfgStrength, setCfgStrength] = useState(1.0);
    const [volume, setVolume] = useState(1.0);
    const [uploading, setUploading] = useState(false);
    
    const fileInputRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated || localStorage.getItem('guestModeEnabled') === 'true') {
            loadVoices();
            loadSelectedVoices();
        }
    }, [isAuthenticated]);

    const loadVoices = async () => {
        try {
            setLoading(true);
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            // Устанавливаем куки для гостевого режима
            if (!isAuthenticated) {
                document.cookie = "guest_mode=true; path=/; max-age=86400"; // 24 часа
            }
            
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices?user_id=${userId}`, {
                credentials: 'include',
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setVoices(data);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSelectedVoices = async () => {
        try {
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices/selected?user_id=${userId}`, {
                credentials: 'include',
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setSelectedVoices(data.selected_voices || []);
            setVoiceSettings(data.voice_settings || {});
        } catch (error) {
            console.error('Error loading selected voices:', error);
        }
    };

    const handleVoiceSelect = (voiceName, category) => {
        const voiceKey = `${category}_${voiceName}`;
        setSelectedVoices(prev => {
            if (prev.includes(voiceKey)) {
                return prev.filter(v => v !== voiceKey);
            } else {
                return [...prev, voiceKey];
            }
        });
    };

    const handleSelectAll = (category) => {
        const categoryVoices = voices[category] || [];
        const categoryKeys = categoryVoices.map(voice => `${category}_${voice.name}`);
        
        setSelectedVoices(prev => {
            const otherCategoryVoices = prev.filter(v => !v.startsWith(`${category}_`));
            return [...otherCategoryVoices, ...categoryKeys];
        });
    };

    const handleDeselectAll = (category) => {
        setSelectedVoices(prev => prev.filter(v => !v.startsWith(`${category}_`)));
    };

    const saveSelectedVoices = async () => {
        try {
            setSaving(true);
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            const requestData = {
                selected_voices: selectedVoices,
                voice_settings: voiceSettings
            };
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices/selected?user_id=${userId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            toast.success('Настройки голосов сохранены');
        } catch (error) {
            toast.error('Ошибка сохранения настроек');
            console.error('Error saving voices:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadFile(file);
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setVoiceName(nameWithoutExt);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !voiceName.trim()) {
            toast.error('Выберите файл и введите имя голоса');
            return;
        }

        // Загрузка голосов доступна в любом режиме
        // if (!isAuthenticated) {
        //     toast.error('Для загрузки голосов необходимо авторизоваться');
        //     return;
        // }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('voice_name', voiceName.trim());
            formData.append('ref_text', refText.trim());
            formData.append('sway_sampling_coef', swaySamplingCoef.toString());
            formData.append('cfg_strength', cfgStrength.toString());
            formData.append('volume', volume.toString());

            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices/upload?user_id=${userId}`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка загрузки голоса');
            }

            const data = await response.json();
            toast.success(data.message);
            setShowUploadDialog(false);
            setUploadFile(null);
            setVoiceName('');
            setRefText('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка загрузки голоса');
        } finally {
            setUploading(false);
        }
    };

    const handleTestVoice = async (voice) => {
        setTestVoice(voice);
        setTestText('Привет, это тестовое воспроизведение голоса');
        setTestAudioUrl(null);
        setShowTestDialog(true);
    };

    const playTestVoice = async () => {
        if (!testVoice || !testText.trim()) {
            toast.error('Введите текст для тестирования');
            return;
        }

        setTestLoading(true);
        try {
            const formData = new FormData();
            formData.append('test_text', testText.trim());
            formData.append('sway_sampling_coef', swaySamplingCoef.toString());
            formData.append('cfg_strength', cfgStrength.toString());
            formData.append('volume', volume.toString());

            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices/${testVoice.name}/test?user_id=${userId}`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка создания тестового голоса');
            }

            const data = await response.json();
            setTestAudioUrl(`${ttsApiUrl}${data.audio_url}`);
        } catch (error) {
            toast.error(error.message || 'Ошибка создания тестового голоса');
        } finally {
            setTestLoading(false);
        }
    };

    const handleDeleteVoice = async (voice) => {
        if (!confirm(`Удалить голос "${voice.name}"?`)) {
            return;
        }

        try {
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const userId = user?.id || 'guest';
            
            const response = await fetch(`${ttsApiUrl}/api/user/voices/${voice.name}?user_id=${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка удаления голоса');
            }

            toast.success('Голос удален');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка удаления голоса');
        }
    };


    const isVoiceSelected = (voiceName, category) => {
        return selectedVoices.includes(`${category}_${voiceName}`);
    };

    const isGuest = !isAuthenticated;
    const hasIntegration = isAuthenticated; // Если авторизован, значит интеграция есть

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Управление голосами</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-muted-foreground">
                            Выберите голоса для использования в чате
                        </p>
                        <div className="flex items-center gap-2">
                            {isGuest ? (
                                <>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span className="text-sm text-gray-400">Гостевой режим</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                    <span className="text-sm text-yellow-400">Авторизованный VIP</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isAuthenticated && hasIntegration && (
                        <Button onClick={() => setShowUploadDialog(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Загрузить голос
                        </Button>
                    )}
                    <Button 
                        onClick={saveSelectedVoices} 
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Check className="h-4 w-4 mr-2" />
                        {saving ? 'Сохранение...' : 'Применить'}
                    </Button>
                </div>
            </div>

            
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Загрузка голосов...</p>
                </div>
            ) : (
                <div className="space-y-8">
            {/* Стандартные голоса */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Mic className="h-5 w-5" />
                        Стандартные голоса
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectAll('standard')}
                                >
                                    Отметить все
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeselectAll('standard')}
                                >
                                    Снять все
                                </Button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {voices.standard.map((voice) => (
                                <Card key={`standard_${voice.name}`} className="relative">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm truncate">{voice.name}</CardTitle>
                                            <Checkbox
                                                checked={isVoiceSelected(voice.name, 'standard')}
                                                onCheckedChange={() => handleVoiceSelect(voice.name, 'standard')}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTestVoice(voice)}
                                            className="w-full"
                                        >
                                            <Play className="h-3 w-3 mr-1" />
                                            Тест
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* VIP голоса (только для авторизованных) */}
                    {isAuthenticated && hasIntegration && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Crown className="h-5 w-5 text-yellow-500" />
                                    VIP индивидуальные голоса
                                </h2>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSelectAll('vip')}
                                    >
                                        Отметить все
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeselectAll('vip')}
                                    >
                                        Снять все
                            </Button>
                        </div>
                            </div>
                            
                            {voices.vip.length === 0 ? (
                                <div className="text-center py-8 bg-muted/50 rounded-lg">
                                    <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">Нет загруженных VIP голосов</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Загрузите свои голоса для персонализации TTS
                                    </p>
                        </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {voices.vip.map((voice) => (
                                        <Card key={`vip_${voice.name}`} className="relative border-yellow-200">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-sm flex items-center gap-1 truncate">
                                                        {voice.name}
                                                        <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                                    </CardTitle>
                                                    <Checkbox
                                                        checked={isVoiceSelected(voice.name, 'vip')}
                                                        onCheckedChange={() => handleVoiceSelect(voice.name, 'vip')}
                                                    />
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleTestVoice(voice)}
                                                        className="flex-1"
                                                    >
                                                        <Play className="h-3 w-3 mr-1" />
                                                        Тест
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDeleteVoice(voice)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Информация для неавторизованных */}
                    {!isAuthenticated && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-400" />
                                <p className="text-slate-300">
                                    Авторизуйтесь для доступа к VIP голосам и загрузке собственных сэмплов
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Диалог загрузки голоса */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Загрузка VIP голоса</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="file">Аудио файл</Label>
                            <Input
                                id="file"
                                type="file"
                                accept=".wav,.mp3,.m4a,.ogg"
                                onChange={handleFileUpload}
                                ref={fileInputRef}
                                className="mt-1"
                            />
                                    </div>
                        <div>
                            <Label htmlFor="voiceName">Имя голоса</Label>
                            <Input
                                id="voiceName"
                                value={voiceName}
                                onChange={(e) => setVoiceName(e.target.value)}
                                placeholder="Введите имя голоса"
                                className="mt-1"
                            />
                            </div>
                                <div>
                            <Label htmlFor="refText">Референсный текст</Label>
                            <Textarea
                                id="refText"
                                value={refText}
                                onChange={(e) => setRefText(e.target.value)}
                                placeholder="Текст, который будет использоваться как референс для TTS"
                                className="mt-1"
                                rows={3}
                                    />
                                </div>
                        <div className="space-y-3">
                            <div>
                                <Label>Параметры синтеза</Label>
                                <div className="space-y-2 mt-2">
                                <div>
                                        <Label className="text-sm">Sway Sampling Coef: {swaySamplingCoef}</Label>
                                    <Slider
                                            value={[swaySamplingCoef]}
                                            onValueChange={([value]) => setSwaySamplingCoef(value)}
                                            min={0.1}
                                        max={2.0}
                                        step={0.1}
                                            className="mt-1"
                                    />
                                </div>
                                <div>
                                        <Label className="text-sm">CFG Strength: {cfgStrength}</Label>
                                    <Slider
                                            value={[cfgStrength]}
                                            onValueChange={([value]) => setCfgStrength(value)}
                                            min={0.1}
                                            max={2.0}
                                        step={0.1}
                                            className="mt-1"
                                    />
                                </div>
                                <div>
                                        <Label className="text-sm">Громкость: {volume}</Label>
                                    <Slider
                                            value={[volume]}
                                            onValueChange={([value]) => setVolume(value)}
                                            min={0.1}
                                            max={2.0}
                                            step={0.1}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleUpload} 
                                disabled={uploading || !uploadFile || !voiceName.trim()}
                                className="flex-1"
                            >
                                {uploading ? 'Загрузка...' : 'Загрузить'}
                                </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setShowUploadDialog(false)}
                            >
                                    Отмена
                                </Button>
                            </div>
                        </div>
                </DialogContent>
            </Dialog>

            {/* Диалог тестирования голоса */}
            <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Тестирование голоса: {testVoice?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="testText">Текст для тестирования</Label>
                            <Textarea
                                id="testText"
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                placeholder="Введите текст для тестирования"
                                className="mt-1"
                                rows={3}
                            />
                        </div>

                        {testAudioUrl && (
                            <div className="space-y-2">
                                <Label>Результат:</Label>
                                <audio controls className="w-full">
                                    <source src={testAudioUrl} type="audio/wav" />
                                    Ваш браузер не поддерживает воспроизведение аудио.
                                </audio>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button 
                                onClick={playTestVoice} 
                                disabled={testLoading || !testText.trim()}
                                className="flex-1"
                            >
                                {testLoading ? 'Создание...' : 'Воспроизвести'}
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setShowTestDialog(false)}
                            >
                                Закрыть
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagementPage;