import { useTts } from '../context/TtsContext';
import { useChat } from '../context/ChatContext'; // Импортируем useChat

const ChannelManager = () => {
    const { user, isAuthenticated } = useAuth();
    const { 
        isTtsEnabled,
        toggleTts,
        isTtsLoading,
    } = useTts();
    const { isChatConnected } = useChat(); // Получаем статус подключения к чату

    const [channelName, setChannelName] = useState('');

    useEffect(() => {
        if (user) {
            // Fetch channels for the authenticated user
            // This part is not provided in the original file,
            // so it's commented out to avoid errors.
            // For demonstration, we'll just set a default channel name.
            setChannelName('My Channel'); 
        }
    }, [user]);

    const handleConnect = () => {
        // Placeholder for connect logic
        console.log('Connecting to channel:', channelName);
    };

    if (!isAuthenticated) {
        return <div>Please log in to manage channels.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="tts-toggle" className="text-lg flex items-center">
                    <Switch 
                        id="tts-toggle"
                        checked={isTtsEnabled}
                        onCheckedChange={toggleTts}
                        disabled={!isChatConnected || isTtsLoading} // Деактивируем если чат не подключен
                        className="mr-3"
                    />
                    {isTtsEnabled ? 'Выключить озвучку' : 'Включить озвучку'}
                </Label>
                {isTtsLoading && <Loader className="w-5 h-5" />}
            </div>
            <p className="text-sm text-muted-foreground">
                {isChatConnected 
                    ? (isTtsEnabled ? 'Озвучка сообщений из чата активна.' : 'Озвучка выключена. Активируйте, чтобы начать.')
                    : 'Сначала подключитесь к каналу, чтобы управлять озвучкой.'
                }
            </p>
        </div>

        <Separator />
        
        {/* Placeholder for other channel management options */}
        <div>
            <h3 className="text-lg font-semibold mb-2">Manage Channels</h3>
            <Input
                placeholder="Enter channel name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="mb-4"
            />
            <Button onClick={handleConnect} disabled={!channelName || isTtsLoading}>
                {isTtsLoading ? 'Connecting...' : 'Connect to Channel'}
            </Button>
        </div>
    );
};

export default ChannelManager;
