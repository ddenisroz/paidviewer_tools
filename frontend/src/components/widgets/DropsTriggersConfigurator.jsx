import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Play, Settings, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const DropsTriggersConfigurator = () => {
    const [triggers, setTriggers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTrigger, setEditingTrigger] = useState(null);

    const [newTrigger, setNewTrigger] = useState({
        name: '',
        trigger_type: 'donation',
        condition: {},
        reward: { name: '', type: 'points' },
        rarity: 'common',
        enabled: true
    });

    useEffect(() => {
        loadTriggers();
    }, []);

    const loadTriggers = async () => {
        try {
            const response = await fetch('/api/drops/triggers');
            const data = await response.json();
            setTriggers(data.triggers || []);
        } catch (error) {
            logger.error('Error loading triggers:', error);
            toast.error('Ошибка загрузки триггеров');
        }
    };

    const createTrigger = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/drops/triggers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTrigger)
            });
            
            if (response.ok) {
                toast.success('Триггер создан');
                setNewTrigger({
                    name: '',
                    trigger_type: 'donation',
                    condition: {},
                    reward: { name: '', type: 'points' },
                    rarity: 'common',
                    enabled: true
                });
                setShowCreateForm(false);
                loadTriggers();
            } else {
                toast.error('Ошибка создания триггера');
            }
        } catch (error) {
            logger.error('Error creating trigger:', error);
            toast.error('Ошибка создания триггера');
        } finally {
            setIsLoading(false);
        }
    };

    const updateTrigger = async (triggerId, updatedTrigger) => {
        try {
            const response = await fetch(`/api/drops/triggers/${triggerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTrigger)
            });
            
            if (response.ok) {
                toast.success('Триггер обновлен');
                loadTriggers();
            } else {
                toast.error('Ошибка обновления триггера');
            }
        } catch (error) {
            logger.error('Error updating trigger:', error);
            toast.error('Ошибка обновления триггера');
        }
    };

    const deleteTrigger = async (triggerId) => {
        if (!confirm('Удалить триггер?')) return;
        
        try {
            const response = await fetch(`/api/drops/triggers/${triggerId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                toast.success('Триггер удален');
                loadTriggers();
            } else {
                toast.error('Ошибка удаления триггера');
            }
        } catch (error) {
            logger.error('Error deleting trigger:', error);
            toast.error('Ошибка удаления триггера');
        }
    };

    const testTrigger = async (triggerId) => {
        try {
            const response = await fetch(`/api/drops/triggers/test/${triggerId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                toast.success('Тест триггера выполнен');
            } else {
                toast.error('Ошибка тестирования триггера');
            }
        } catch (error) {
            logger.error('Error testing trigger:', error);
            toast.error('Ошибка тестирования триггера');
        }
    };

    const createPresetTriggers = async () => {
        try {
            const response = await fetch('/api/drops/triggers/presets', {
                method: 'POST'
            });
            
            if (response.ok) {
                toast.success('Предустановленные триггеры созданы');
                loadTriggers();
            } else {
                toast.error('Ошибка создания предустановок');
            }
        } catch (error) {
            logger.error('Error creating presets:', error);
            toast.error('Ошибка создания предустановок');
        }
    };

    const updateTriggerCondition = (triggerType) => {
        let condition = {};
        
        switch (triggerType) {
            case 'donation':
                condition = { min_amount: 100 };
                break;
            case 'streak':
                condition = { min_streak: 7 };
                break;
            case 'message_record':
                condition = { min_messages: 100 };
                break;
            default:
                condition = {};
        }
        
        setNewTrigger(prev => ({ ...prev, condition }));
    };

    const getRarityColor = (rarity) => {
        const colors = {
            common: 'bg-gray-500',
            rare: 'bg-blue-500',
            epic: 'bg-purple-500',
            legendary: 'bg-yellow-500'
        };
        return colors[rarity] || 'bg-gray-500';
    };

    const getTriggerTypeLabel = (type) => {
        const labels = {
            donation: 'Донат',
            streak: 'Стрик',
            message_record: 'Сообщения',
            custom: 'Пользовательский'
        };
        return labels[type] || type;
    };

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Триггеры дропов</h1>
                <p className="text-gray-600">
                    Настройте условия получения сундуков и наград
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Список триггеров */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Триггеры</CardTitle>
                                <div className="flex gap-2">
                                    <Button onClick={createPresetTriggers} variant="outline" size="sm">
                                        <Gift className="h-4 w-4 mr-2" />
                                        Предустановки
                                    </Button>
                                    <Button onClick={() => setShowCreateForm(true)} size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Создать
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {triggers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        Нет триггеров. Создайте первый или загрузите предустановки.
                                    </div>
                                ) : (
                                    triggers.map((trigger) => (
                                        <div key={trigger.id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{trigger.name}</h3>
                                                    <Badge className={getRarityColor(trigger.rarity)}>
                                                        {trigger.rarity}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {getTriggerTypeLabel(trigger.trigger_type)}
                                                    </Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => testTrigger(trigger.id)}
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setEditingTrigger(trigger)}
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => deleteTrigger(trigger.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <div>
                                                    <strong>Условие:</strong> {
                                                        trigger.trigger_type === 'donation' ? 
                                                        `Донат от ${trigger.condition.min_amount}₽` :
                                                        trigger.trigger_type === 'streak' ?
                                                        `Стрик ${trigger.condition.min_streak} дней` :
                                                        trigger.trigger_type === 'message_record' ?
                                                        `${trigger.condition.min_messages} сообщений` :
                                                        'Пользовательское условие'
                                                    }
                                                </div>
                                                <div>
                                                    <strong>Награда:</strong> {trigger.reward.name}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <strong>Статус:</strong>
                                                    <Switch
                                                        checked={trigger.enabled}
                                                        onCheckedChange={(checked) => 
                                                            updateTrigger(trigger.id, { ...trigger, enabled: checked })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Форма создания/редактирования */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {editingTrigger ? 'Редактировать триггер' : 'Создать триггер'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Название</Label>
                                    <Input
                                        id="name"
                                        value={editingTrigger?.name || newTrigger.name}
                                        onChange={(e) => editingTrigger ? 
                                            setEditingTrigger({...editingTrigger, name: e.target.value}) :
                                            setNewTrigger({...newTrigger, name: e.target.value})
                                        }
                                        placeholder="Название триггера"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="trigger_type">Тип триггера</Label>
                                    <Select
                                        value={editingTrigger?.trigger_type || newTrigger.trigger_type}
                                        onValueChange={(value) => {
                                            if (editingTrigger) {
                                                setEditingTrigger({...editingTrigger, trigger_type: value});
                                            } else {
                                                setNewTrigger({...newTrigger, trigger_type: value});
                                                updateTriggerCondition(value);
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="donation">Донат</SelectItem>
                                            <SelectItem value="streak">Стрик присутствия</SelectItem>
                                            <SelectItem value="message_record">Рекорд сообщений</SelectItem>
                                            <SelectItem value="custom">Пользовательский</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Условия в зависимости от типа */}
                                {(editingTrigger?.trigger_type || newTrigger.trigger_type) === 'donation' && (
                                    <div>
                                        <Label htmlFor="min_amount">Минимальная сумма (₽)</Label>
                                        <Input
                                            id="min_amount"
                                            type="number"
                                            value={editingTrigger?.condition?.min_amount || newTrigger.condition.min_amount || 100}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                if (editingTrigger) {
                                                    setEditingTrigger({
                                                        ...editingTrigger, 
                                                        condition: {...editingTrigger.condition, min_amount: value}
                                                    });
                                                } else {
                                                    setNewTrigger({
                                                        ...newTrigger, 
                                                        condition: {...newTrigger.condition, min_amount: value}
                                                    });
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {(editingTrigger?.trigger_type || newTrigger.trigger_type) === 'streak' && (
                                    <div>
                                        <Label htmlFor="min_streak">Минимальный стрик (дни)</Label>
                                        <Input
                                            id="min_streak"
                                            type="number"
                                            value={editingTrigger?.condition?.min_streak || newTrigger.condition.min_streak || 7}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                if (editingTrigger) {
                                                    setEditingTrigger({
                                                        ...editingTrigger, 
                                                        condition: {...editingTrigger.condition, min_streak: value}
                                                    });
                                                } else {
                                                    setNewTrigger({
                                                        ...newTrigger, 
                                                        condition: {...newTrigger.condition, min_streak: value}
                                                    });
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {(editingTrigger?.trigger_type || newTrigger.trigger_type) === 'message_record' && (
                                    <div>
                                        <Label htmlFor="min_messages">Минимум сообщений</Label>
                                        <Input
                                            id="min_messages"
                                            type="number"
                                            value={editingTrigger?.condition?.min_messages || newTrigger.condition.min_messages || 100}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                if (editingTrigger) {
                                                    setEditingTrigger({
                                                        ...editingTrigger, 
                                                        condition: {...editingTrigger.condition, min_messages: value}
                                                    });
                                                } else {
                                                    setNewTrigger({
                                                        ...newTrigger, 
                                                        condition: {...newTrigger.condition, min_messages: value}
                                                    });
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="reward_name">Название награды</Label>
                                    <Input
                                        id="reward_name"
                                        value={editingTrigger?.reward?.name || newTrigger.reward.name}
                                        onChange={(e) => {
                                            if (editingTrigger) {
                                                setEditingTrigger({
                                                    ...editingTrigger, 
                                                    reward: {...editingTrigger.reward, name: e.target.value}
                                                });
                                            } else {
                                                setNewTrigger({
                                                    ...newTrigger, 
                                                    reward: {...newTrigger.reward, name: e.target.value}
                                                });
                                            }
                                        }}
                                        placeholder="Название награды"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="rarity">Редкость</Label>
                                    <Select
                                        value={editingTrigger?.rarity || newTrigger.rarity}
                                        onValueChange={(value) => {
                                            if (editingTrigger) {
                                                setEditingTrigger({...editingTrigger, rarity: value});
                                            } else {
                                                setNewTrigger({...newTrigger, rarity: value});
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="common">Обычный</SelectItem>
                                            <SelectItem value="rare">Редкий</SelectItem>
                                            <SelectItem value="epic">Эпический</SelectItem>
                                            <SelectItem value="legendary">Легендарный</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="enabled"
                                        checked={editingTrigger?.enabled ?? newTrigger.enabled}
                                        onCheckedChange={(checked) => {
                                            if (editingTrigger) {
                                                setEditingTrigger({...editingTrigger, enabled: checked});
                                            } else {
                                                setNewTrigger({...newTrigger, enabled: checked});
                                            }
                                        }}
                                    />
                                    <Label htmlFor="enabled">Включен</Label>
                                </div>

                                <div className="flex gap-2">
                                    {editingTrigger ? (
                                        <>
                                            <Button 
                                                onClick={() => {
                                                    updateTrigger(editingTrigger.id, editingTrigger);
                                                    setEditingTrigger(null);
                                                }}
                                                disabled={isLoading}
                                                className="flex-1"
                                            >
                                                Сохранить
                                            </Button>
                                            <Button 
                                                onClick={() => setEditingTrigger(null)}
                                                variant="outline"
                                            >
                                                Отмена
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button 
                                                onClick={createTrigger}
                                                disabled={isLoading}
                                                className="flex-1"
                                            >
                                                Создать
                                            </Button>
                                            <Button 
                                                onClick={() => setShowCreateForm(false)}
                                                variant="outline"
                                            >
                                                Отмена
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DropsTriggersConfigurator;
