import React from 'react';

import { AlertCircle, Settings, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useAuth } from '../context/AuthContext';
import PageWrapper from '../shared/components/PageWrapper';

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Управление чатом">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Требуется авторизация
              </h3>
              <p className="text-gray-400 text-sm">
                Для использования управления чатом необходимо войти в систему и подключить хотя бы одну платформу (Twitch или VK Live)
              </p>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Войти в систему
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
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

