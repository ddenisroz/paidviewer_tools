export const agentStatus = (agentOnline: boolean) => ({
    value: agentOnline ? 'работает' : 'не запущена',
    state: agentOnline ? 'найдена' : 'не найдена',
    tone: agentOnline ? 'text-emerald-300' : 'text-amber-300',
});

export const serviceStatus = (agentOnline: boolean, canOpenVoiceManagement: boolean) => {
    if (canOpenVoiceManagement) return { value: 'отвечает', tone: 'text-emerald-300' };
    if (agentOnline) return { value: 'не отвечает', tone: 'text-amber-300' };
    return { value: 'после запуска', tone: 'text-muted-foreground' };
};

export const voiceStatus = (canOpenVoiceManagement: boolean) => ({
    value: canOpenVoiceManagement ? 'открыты' : 'после проверки',
    state: canOpenVoiceManagement ? 'доступны' : 'после проверки',
    tone: canOpenVoiceManagement ? 'text-emerald-300' : 'text-muted-foreground',
});
