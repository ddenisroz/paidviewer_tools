import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, Gamepad2, Music, Camera, Mic, Users, Palette, Zap } from 'lucide-react';
import { useDataContext } from '../context/DataContext';
import { API_BASE_URL } from '../constants';

const VkCategoryCard = () => {
  const { vkCategories, setVkCategories, currentVkCategory, setCurrentVkCategory } = useDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Иконки для разных типов категорий
  const getCategoryIcon = (type) => {
    switch (type) {
      case 'game': return <Gamepad2 className="w-4 h-4" />;
      case 'music': return <Music className="w-4 h-4" />;
      case 'irl': return <Camera className="w-4 h-4" />;
      case 'talk': return <Mic className="w-4 h-4" />;
      case 'social': return <Users className="w-4 h-4" />;
      case 'creative': return <Palette className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  // Загрузка категорий
  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/vk/categories?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      
      const data = await response.json();
      setVkCategories(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading VK categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Обновление категории
  const updateCategory = async (categoryId) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/vk/update-category`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update category');
      }
      
      const result = await response.json();
      setCurrentVkCategory(categoryId);
      
      // Показываем уведомление об успехе
      console.log('Category updated successfully:', result.message);
      
    } catch (err) {
      setError(err.message);
      console.error('Error updating VK category:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Поиск при изменении запроса
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        loadCategories();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Загрузка категорий при монтировании
  useEffect(() => {
    loadCategories();
  }, []);

  // Фильтрация категорий по поисковому запросу
  const filteredCategories = vkCategories.filter(category =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5" />
          VK Live Категории
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Поиск категорий..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Ошибка */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Текущая категория */}
        {currentVkCategory && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-blue-800 text-sm font-medium">Текущая категория:</p>
            <p className="text-blue-600 text-sm">{currentVkCategory}</p>
          </div>
        )}

        {/* Список категорий */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCategories.length > 0 ? (
            filteredCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getCategoryIcon(category.type)}
                  <div>
                    <p className="font-medium text-sm">{category.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {category.type}
                      </Badge>
                      {category.counters?.viewers > 0 && (
                        <span className="text-xs text-gray-500">
                          👥 {category.counters.viewers}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  onClick={() => updateCategory(category.id)}
                  disabled={isUpdating || currentVkCategory === category.id}
                  className="ml-2"
                >
                  {isUpdating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Выбрать'
                  )}
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Категории не найдены</p>
              {searchQuery && (
                <p className="text-sm">Попробуйте изменить поисковый запрос</p>
              )}
            </div>
          )}
        </div>

        {/* Кнопка обновления */}
        <Button
          variant="outline"
          onClick={loadCategories}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          ) : (
            'Обновить список'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VkCategoryCard;
