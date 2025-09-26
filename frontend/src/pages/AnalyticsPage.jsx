import React from 'react';
import { Wrench } from 'lucide-react';

const AnalyticsPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Wrench className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold text-foreground">В разработке</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Функция анализа и модерации чата временно недоступна. Мы работаем над улучшениями.
      </p>
    </div>
  );
};

export default AnalyticsPage;
