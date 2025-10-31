import React from 'react';
import { Wrench } from 'lucide-react';

const AnalyticsPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4 text-gray-300">
        <Wrench className="w-16 h-16" />
        <div className="text-lg">ведется разаработка</div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
