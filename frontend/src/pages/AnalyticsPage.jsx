import React from 'react';
import { Wrench } from 'lucide-react';

const AnalyticsPage = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-700/60 bg-gray-900/50 px-8 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="rounded-full bg-gray-800/70 p-4 border border-gray-700/70">
          <Wrench className="w-10 h-10 text-gray-300" />
        </div>
        <div className="text-sm tracking-wide uppercase text-gray-400 select-none">ведется разработка</div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
