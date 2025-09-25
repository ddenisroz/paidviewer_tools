import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useData } from '../context/DataContext';

const SaveChangesBar = () => {
    const { saveChanges, status, initialData, currentData } = useData();

    const isChanged = React.useMemo(() => {
        return JSON.stringify(initialData) !== JSON.stringify(currentData);
    }, [initialData, currentData]);

    if (!isChanged) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-4 border-t border-border z-50 animate-in slide-in-from-bottom-full duration-500">
            <div className="container mx-auto flex items-center justify-between">
                <p className="text-lg font-semibold">
                    У вас есть несохраненные изменения
                </p>
                <Button 
                    onClick={saveChanges} 
                    disabled={status.save === 'loading'} 
                    size="lg"
                >
                    {status.save === 'loading' && <><Loader className="h-5 w-5 mr-2 animate-spin" /> Сохранение...</>}
                    {status.save === 'success' && <><CheckCircle className="h-5 w-5 mr-2" /> Сохранено!</>}
                    {status.save === 'error' && <><XCircle className="h-5 w-5 mr-2" /> Ошибка сохранения</>}
                    {status.save === 'idle' && <><Save className="h-5 w-5 mr-2" /> Сохранить все</>}
                </Button>
            </div>
        </div>
    );
};

export default SaveChangesBar;
