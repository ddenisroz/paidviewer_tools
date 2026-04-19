export const OAUTH_PLATFORM_LABELS: Record<string, string> = {
    twitch: 'Twitch',
    vk: 'VK Live',
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    cancelled: 'Авторизация отменена.',
    integration_not_configured: 'Интеграция еще не настроена.',
    provider_unreachable: 'Сервис авторизации временно недоступен. Попробуйте еще раз через минуту.',
    provider_rejected: 'Провайдер не подтвердил авторизацию. Повторите попытку.',
    invalid_state: 'Сессия авторизации устарела. Начните вход заново.',
    identity_conflict: 'Найдены конфликтующие данные аккаунта. Мы уже их вычищаем, попробуйте вход еще раз.',
    internal_error: 'Во время авторизации произошла внутренняя ошибка.',
};

export function getOAuthErrorMessage(platform: string | null, errorCode: string | null): string | null {
    if (!errorCode) {
        return null;
    }

    const label = OAUTH_PLATFORM_LABELS[platform || ''] || 'Авторизация';
    return `${label}: ${OAUTH_ERROR_MESSAGES[errorCode] || 'Не удалось завершить вход.'}`;
}

export function getOAuthLinkSuccessMessage(platform: string | null): string | null {
    if (!platform) {
        return null;
    }

    return `Интеграция ${platform === 'vk' ? 'VK Live' : 'Twitch'} подключена.`;
}
