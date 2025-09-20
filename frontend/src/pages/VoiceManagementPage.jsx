import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Copy, Link, RefreshCw } from 'lucide-react';
import { generateObsUrl } from '../services/microservices';


const ObsUrlGenerator = () => {
    const { user, token } = useContext(AuthContext);
    const [obsUrl, setObsUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchUrl = useCallback(async () => {
        if (user && token) {
            setIsLoading(true);
            try {
                const response = await generateObsUrl(token);
                const obsToken = response.data.token;
                const url = `${window.location.origin}/tts-obs/${obsToken}`;
                setObsUrl(url);
            } catch (error) {
                toast.error("Не удалось сгенерировать OBS URL.");
                console.error("Failed to generate OBS URL:", error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [user, token]);

    useEffect(() => {
        fetchUrl();
    }, [fetchUrl]);


    const copyToClipboard = () => {
        if (!obsUrl) return;
        navigator.clipboard.writeText(obsUrl);
        toast.success('URL скопирован в буфер обмена!');
    };

    if (!user) return null;

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Link className="mr-2 h-5 w-5" />
                    Ссылка для OBS
                </CardTitle>
                <CardDescription>
                    Используйте эту ссылку как источник браузера в OBS, чтобы добавить озвучку сообщений на ваш стрим.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-2">
                    <Input type="text" readOnly value={obsUrl || "Нажмите 'Сгенерировать', чтобы получить ссылку..."} className="flex-grow"/>
                    <Button onClick={copyToClipboard} variant="outline" size="icon" disabled={!obsUrl}>
                        <Copy className="h-4 w-4" />
                    </Button>
                    <Button onClick={fetchUrl} variant="secondary" size="icon" disabled={isLoading}>
                       <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                 <p className="mt-2 text-xs text-gray-500">
                    Нажмите <RefreshCw className="inline h-3 w-3 mx-1"/>, чтобы сгенерировать новую ссылку, если старая была скомпрометирована.
                </p>
            </CardContent>
        </Card>
    );
};


const VoiceManagementPage = () => {
    const { user, token } = useContext(AuthContext);
    // ... existing code ...
            <div className="flex flex-col gap-6">
                <UserVoiceManager />
                <ObsUrlGenerator />
            </div>
        </div>
    );
    // ... existing code ...

