import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Construction } from 'lucide-react';

const AnalyticsPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-12">
          <div className="text-center space-y-6">
            {/* Иконка */}
            <div className="flex justify-center">
              <div className="relative">
                <BarChart3 className="w-24 h-24 text-gray-300" />
                <Construction className="w-12 h-12 text-yellow-500 absolute bottom-0 right-0 transform translate-x-2 translate-y-2" />
              </div>
            </div>
            
            {/* Заголовок */}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Аналитика чата
              </h1>
              <p className="text-lg text-gray-500">
                В разработке
              </p>
            </div>
            
            {/* Описание */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-sm leading-relaxed">
                Здесь будет отображаться подробная аналитика по вашему чату: 
                статистика сообщений, активность пользователей, 
                популярные команды и многое другое.
              </p>
            </div>
            
            {/* Дополнительная информация */}
            <div className="pt-4">
              <p className="text-xs text-gray-400">
                Функционал находится в стадии разработки и скоро будет доступен
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
