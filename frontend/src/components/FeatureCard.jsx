import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Circle } from 'lucide-react';

const FeatureCard = ({ title, icon, path, enabled = true, actionButton, onActionClick, ttsStatus }) => {
    const navigate = useNavigate();
    

    const handleCardClick = () => {
        if (enabled && path) {
            navigate(path);
        }
    };

    const handleActionClick = (e) => {
        e.stopPropagation();
        if (enabled && onActionClick) {
            onActionClick(e);
        }
    };

    return (
        <Card 
            className={`w-52 h-48 flex flex-col text-center p-4 border-2 transition-all duration-300 group cursor-pointer
                ${enabled 
                    ? 'border-border/40 hover:shadow-lg hover:-translate-y-1 hover:bg-muted/80 hover:border-primary/60 bg-card/80' 
                    : 'bg-muted/40 opacity-60 cursor-not-allowed'
                }
                ${ttsStatus && !ttsStatus.isHealthy ? 'opacity-50 bg-red-500/10 border-red-500/30' : ''}
            `}
            onClick={handleCardClick}
        >
            <div className="relative flex flex-col h-full">
                
                {/* Иконка прибита к верху */}
                <div className="flex justify-center pt-2 pb-2 text-primary">
                    {React.cloneElement(icon, { size: 48 })}
                </div>
                
                {/* Заголовок */}
                <CardTitle className="text-base font-medium leading-tight text-foreground mb-2">
                    {title}
                </CardTitle>
                
                {/* Статус TTS - компактно вверху */}
                {ttsStatus && (
                    <div className="flex items-center justify-center gap-1 mb-3">
                        <Circle 
                            size={6} 
                            fill={ttsStatus.isHealthy ? '#10b981' : '#ef4444'} 
                            className={ttsStatus.isHealthy ? 'text-green-500' : 'text-red-500'}
                        />
                        <span className={`text-xs ${ttsStatus.isHealthy ? 'text-green-500' : 'text-red-500'}`}>
                            {ttsStatus.isChecking ? 'Проверка...' : ttsStatus.isHealthy ? 'Готов' : 'Недоступен'}
                        </span>
                    </div>
                )}
                
                {/* Содержимое карточки (кнопка действия) */}
                <div className="flex-1 flex flex-col justify-end">
                    {actionButton ? (
                         <Button 
                            onClick={handleActionClick} 
                            disabled={!enabled || actionButton.disabled}
                            size="sm"
                            className="w-full"
                            variant={actionButton.variant || "default"}
                        >
                            {actionButton.icon && <span className="mr-2">{actionButton.icon}</span>}
                            {actionButton.text}
                        </Button>
                    ) : (
                        <div className="text-center text-muted-foreground text-sm py-2">
                            TTS недоступен
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default FeatureCard;
