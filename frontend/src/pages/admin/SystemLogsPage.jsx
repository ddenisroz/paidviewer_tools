import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
    FileText, 
    Search, 
    Download, 
    RefreshCw, 
    Filter,
    AlertCircle,
    Info,
    AlertTriangle,
    Bug
} from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const SystemLogsPage = () => {
    console.log('SystemLogsPage загружается');
    
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        level: 'all',
        search: '',
        limit: 100
    });
    const [total, setTotal] = useState(0);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.level && filters.level !== 'all') params.append('level', filters.level);
            if (filters.search) params.append('search', filters.search);
            if (filters.limit) params.append('limit', filters.limit.toString());
            
            const response = await botService.get(`/api/admin/logs?${params.toString()}`);
            setLogs(response.data.logs || []);
            setTotal(response.data.total || 0);
        } catch (error) {
            console.error('Error loading logs:', error);
            toast.error('Ошибка загрузки логов');
        } finally {
            setLoading(false);
        }
    };

    const exportLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.level && filters.level !== 'all') params.append('level', filters.level);
            if (filters.search) params.append('search', filters.search);
            
            const response = await botService.get(`/api/admin/logs/export?${params.toString()}`);
            
            // Создаем и скачиваем файл
            const blob = new Blob([response.data.content], { type: response.data.mime_type });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.data.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast.success('Логи экспортированы');
        } catch (error) {
            console.error('Error exporting logs:', error);
            toast.error('Ошибка экспорта логов');
        }
    };

    const getLevelIcon = (level) => {
        switch (level) {
            case 'ERROR':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'WARN':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'INFO':
                return <Info className="w-4 h-4 text-blue-500" />;
            case 'DEBUG':
                return <Bug className="w-4 h-4 text-gray-500" />;
            default:
                return <FileText className="w-4 h-4 text-gray-500" />;
        }
    };

    const getLevelBadge = (level) => {
        switch (level) {
            case 'ERROR':
                return <Badge variant="destructive" className="text-xs px-1 py-0">E</Badge>;
            case 'WARN':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs px-1 py-0">W</Badge>;
            case 'INFO':
                return <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs px-1 py-0">I</Badge>;
            case 'DEBUG':
                return <Badge variant="secondary" className="text-xs px-1 py-0">D</Badge>;
            default:
                return <Badge variant="outline" className="text-xs px-1 py-0">{level[0]}</Badge>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Не указано';
        const date = new Date(dateString);
        return {
            time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            full: date.toLocaleString('ru-RU')
        };
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            level: 'all',
            search: '',
            limit: 100
        });
    };

    const errorLogs = logs.filter(log => log.level === 'ERROR');
    const warnLogs = logs.filter(log => log.level === 'WARN');
    const infoLogs = logs.filter(log => log.level === 'INFO');
    const debugLogs = logs.filter(log => log.level === 'DEBUG');

    useEffect(() => {
        loadLogs();
    }, [filters]);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center">
                        <FileText className="w-8 h-8 mr-3 text-purple-500" />
                        Системные логи
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Просмотр и анализ системных логов с фильтрацией и экспортом
                    </p>
                </div>
                
                <div className="flex items-center space-x-4">
                    <Button onClick={loadLogs} variant="outline" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                    <Button onClick={exportLogs} variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Экспорт
                    </Button>
                </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-gray-600">Ошибки</p>
                                <p className="text-xl font-bold text-red-600">{errorLogs.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-gray-600">Предупреждения</p>
                                <p className="text-xl font-bold text-yellow-600">{warnLogs.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Info className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-gray-600">Информация</p>
                                <p className="text-xl font-bold text-blue-600">{infoLogs.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Bug className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-gray-600">Отладка</p>
                                <p className="text-xl font-bold text-gray-600">{debugLogs.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Фильтры */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Filter className="w-5 h-5 mr-2" />
                        Фильтры
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="level">Уровень лога</Label>
                            <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Все уровни" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все уровни</SelectItem>
                                    <SelectItem value="ERROR">ERROR</SelectItem>
                                    <SelectItem value="WARN">WARN</SelectItem>
                                    <SelectItem value="INFO">INFO</SelectItem>
                                    <SelectItem value="DEBUG">DEBUG</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label htmlFor="search">Поиск</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    id="search"
                                    placeholder="Поиск по сообщению..."
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <Label htmlFor="limit">Лимит записей</Label>
                            <Select value={filters.limit.toString()} onValueChange={(value) => handleFilterChange('limit', parseInt(value))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="200">200</SelectItem>
                                    <SelectItem value="500">500</SelectItem>
                                    <SelectItem value="1000">1000</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-end">
                            <Button onClick={clearFilters} variant="outline" className="w-full">
                                Очистить фильтры
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Логи */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Логи системы</span>
                        <Badge variant="outline">Всего: {total}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                            <span className="ml-2">Загрузка логов...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Логи не найдены</p>
                    ) : (
                        <div className="space-y-1 max-h-96 overflow-y-auto">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded text-sm">
                                    <div className="flex-shrink-0">
                                        {getLevelIcon(log.level)}
                                    </div>
                                    <div className="flex-shrink-0">
                                        {getLevelBadge(log.level)}
                                    </div>
                                    <div className="flex-shrink-0 text-xs text-gray-500 w-20">
                                        {formatDate(log.timestamp).time}
                                    </div>
                                    <div className="flex-shrink-0 text-xs text-gray-400 w-16">
                                        {log.module}
                                    </div>
                                    <div className="flex-1 min-w-0 text-gray-700 truncate">
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemLogsPage;
