// src/components/GuestStubs.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, Edit3, Tag } from 'lucide-react';

const GuestStubs = () => {
    return (
        <>
            <Card className="h-80 border-red-500/30 bg-red-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-red-400">
                        <Activity className="h-6 w-6" />
                        Офлайн
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-40 flex items-center justify-center text-center">
                        <div className="space-y-2">
                            <Activity className="h-12 w-12 text-red-400 mx-auto" />
                            <p className="text-sm text-red-300">Функция недоступна в гостевом режиме</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="h-80 border-red-500/30 bg-red-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-red-400">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-32 flex items-center justify-center text-center">
                        <div className="space-y-2">
                            <Edit3 className="h-12 w-12 text-red-400 mx-auto" />
                            <p className="text-sm text-red-300">Функция недоступна в гостевом режиме</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="h-80 border-red-500/30 bg-red-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-red-400">
                        <Tag className="h-6 w-6" />
                        Смена категории
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-32 flex items-center justify-center text-center">
                        <div className="space-y-2">
                            <Tag className="h-12 w-12 text-red-400 mx-auto" />
                            <p className="text-sm text-red-300">Функция недоступна в гостевом режиме</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
        </>
    );
};

export default GuestStubs;
