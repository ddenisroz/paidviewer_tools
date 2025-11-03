import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

const IntegrationsDisabledPlaceholder = () => {
    const navigate = useNavigate();

    return (
        <div className="col-span-full">
            <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 border border-red-500/30 rounded-xl p-8 text-center">
                <div className="flex flex-col items-center space-y-6">
                    <div className="flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-white">
                            Все интеграции отключены
                        </h3>
                        <p className="text-gray-300 max-w-md">
                            Для работы с функциями стрима необходимо подключить хотя бы одну платформу
                        </p>
                    </div>
                    
                    <Button 
                        onClick={() => navigate('/dashboard/settings')}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-lg font-medium"
                        size="lg"
                    >
                        <Settings className="w-5 h-5 mr-2" />
                        Перейти в настройки
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default IntegrationsDisabledPlaceholder;
