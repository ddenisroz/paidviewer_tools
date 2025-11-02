import React, { useState, useEffect } from 'react';
import PageWrapper from '../../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Gift, 
  History, 
  TrendingUp,
  Zap,
  Users,
  DollarSign,
  Clock,
  Star,
  Coins
} from 'lucide-react';

const DropsMainPage = () => {
  const [activeTab, setActiveTab] = useState('streak');

  return (
    <PageWrapper 
      title="🎁 Система лояльности"
      description="Управление наградами и дропами для зрителей"
    >
      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="streak" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Стрик
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Баллы
          </TabsTrigger>
          <TabsTrigger value="donation" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Донат
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Виджет
          </TabsTrigger>
        </TabsList>

        {/* Стрик */}
        <TabsContent value="streak" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Стрик присутствия
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Баллы */}
        <TabsContent value="points" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Награды за баллы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Донат */}
        <TabsContent value="donation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Донатные награды
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Виджет */}
        <TabsContent value="widget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                OBS Виджет
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Компонент в разработке</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default DropsMainPage;
