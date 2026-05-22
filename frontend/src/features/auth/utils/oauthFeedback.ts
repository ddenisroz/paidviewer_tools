export const OAUTH_PLATFORM_LABELS: Record<string, string> = {
    twitch: 'Twitch',
    vk: 'VK Live',
    donationalerts: 'DonationAlerts',
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    access_denied:
        'Вход не завершен: провайдер отклонил запрос или была нажата отмена. Нажмите вход еще раз и подтвердите доступ.',
    cancelled: 'Вход не завершен. Нажмите кнопку входа еще раз и подтвердите доступ у провайдера.',
    integration_not_configured: 'Интеграция еще не настроена.',
    provider_unreachable: 'Сервис авторизации временно недоступен. Попробуйте еще раз через минуту.',
    provider_rejected: 'Провайдер не подтвердил авторизацию. Повторите попытку.',
    redirect_mismatch:
        'Callback URL не совпадает с настройками Twitch. Проверьте redirect URI в локальном конфиге и Twitch Developer Console.',
    invalid_state: 'Сессия авторизации устарела. Начните вход заново.',
    identity_conflict: 'Найдены конфликтующие данные аккаунта. Мы уже их вычищаем, попробуйте вход еще раз.',
    internal_error: 'Во время авторизации произошла внутренняя ошибка.',
    invalid_client:
        'DonationAlerts отклонил client_id/client_secret. Проверьте настройки приложения и redirect URI.',
    token_exchange:
        'Не удалось обменять код авторизации на токен. Проверьте настройки DonationAlerts и попробуйте еще раз.',
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
