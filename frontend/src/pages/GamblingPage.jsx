import React from 'react';
import { Frown } from 'lucide-react';

const GamblingPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Frown className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold text-foreground">В разработке</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Функция гэмблинга временно недоступна. Мы работаем над улучшениями.
      </p>
    </div>
  );
};

export default GamblingPage;
