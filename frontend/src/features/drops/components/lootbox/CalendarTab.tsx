// src/components/lootbox/CalendarTab.tsx
import React from 'react';

import { BarChart3, Check, Settings } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

interface GameDayData {
    day: number;
    viewerName: string | null;
    isActive: boolean;
    hasViewer: boolean;
}

interface CalendarTabProps {
    gameFieldData: GameDayData[];
    onDayClick: (day: number, currentViewerName: string | null) => void;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ gameFieldData, onDayClick }) => {
    const activeDays = gameFieldData.filter((day) => day.isActive).length;
    const daysWithViewers = gameFieldData.filter((day) => day.hasViewer).length;
    const uniqueViewers = new Set(gameFieldData.filter((day) => day.viewerName).map((day) => day.viewerName)).size;

    let maxStreak = 0;
    let currentStreak = 0;
    gameFieldData.forEach((day) => {
        if (day.isActive) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Игровое поле активности</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Настройки
                    </Button>
                    <Button variant="outline" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Статистика
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-6 gap-2">
                {gameFieldData.map((dayData) => (
                    <div
                        key={dayData.day}
                        className={`
                            aspect-square flex flex-col items-center justify-center text-sm rounded-lg cursor-pointer transition-all duration-200 border-2
                            ${
                                dayData.hasViewer
                                    ? dayData.isActive
                                        ? 'bg-green-600 text-white border-green-500 hover:bg-green-700'
                                        : 'bg-blue-700 text-white border-blue-600 hover:bg-blue-800'
                                    : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                            }
                        `}
                        title={
                            dayData.viewerName
                                ? `День ${dayData.day}: ${dayData.viewerName}`
                                : `День ${dayData.day}: Нет зрителей`
                        }
                        onClick={() => onDayClick(dayData.day, dayData.viewerName)}
                    >
                        <div className="text-xs font-bold">{dayData.day}</div>
                        {dayData.viewerName && (
                            <div className="text-xs truncate w-full text-center px-1">{dayData.viewerName}</div>
                        )}
                        {dayData.hasViewer && dayData.isActive && <Check className="w-3 h-3 mt-1" />}
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-4 gap-3 min-[1280px]:gap-4">
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{activeDays}</div>
                    <div className="text-xs text-gray-300">Активные дни</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{daysWithViewers}</div>
                    <div className="text-xs text-gray-300">Дни с зрителями</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-400">{uniqueViewers}</div>
                    <div className="text-xs text-gray-300">Уникальных зрителей</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{maxStreak}</div>
                    <div className="text-xs text-gray-300">Макс. дней подряд</div>
                </div>
            </div>

            <div className="flex gap-6 mt-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-600 rounded border border-green-500"></div>
                    <span className="text-gray-300">Активный зритель</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-700 rounded border border-blue-600"></div>
                    <span className="text-gray-300">Есть зритель</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-700 rounded border border-gray-600"></div>
                    <span className="text-gray-300">Нет зрителей</span>
                </div>
            </div>
        </div>
    );
};

export default CalendarTab;
