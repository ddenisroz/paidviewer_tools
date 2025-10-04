import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Gift, Hammer } from 'lucide-react';
import LootboxSystem from '../components/LootboxSystem';
import { useAuth } from '../context/AuthContext';

const GamblingPage = () => {
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-6 text-foreground">
            Гэмблинг система
          </h1>
        </div>
      </div>

      <Tabs defaultValue="pvp-auction" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pvp-auction" className="flex items-center gap-2">
            <Hammer className="w-4 h-4" />
            PVP аукцион
          </TabsTrigger>
          <TabsTrigger value="lootboxes" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Лутбоксы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pvp-auction" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hammer className="w-5 h-5" />
                PVP аукцион
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">😢</div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">
                  Раздел находится в разработке
                </h3>
                <p className="text-muted-foreground">
                  Скоро здесь появится система PVP аукционов для соревнований между зрителями
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lootboxes" className="space-y-6">
          <LootboxSystem channelName={user?.username || 'default'} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GamblingPage;