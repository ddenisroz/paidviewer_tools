const BOT_AUTH_ERROR_MESSAGES = {
    en: {
        access_denied: 'VK Live denied the authorization request',
        cancelled: 'Authorization was cancelled',
        internal_error: 'Internal bot authorization error',
        invalid_state: 'Authorization session expired, please try again',
        missing_code: 'VK Live did not return an authorization code',
        redirect_mismatch: 'OAuth redirect URL does not match provider settings',
        restart_failed: 'Token was saved, but the bot runtime could not restart',
        save_failed: 'Token was received, but it could not be saved',
    },
    ru: {
        access_denied: 'VK Live отклонил запрос авторизации',
        cancelled: 'Авторизация была отменена',
        internal_error: 'Внутренняя ошибка авторизации бота',
        invalid_state: 'Сессия авторизации устарела, попробуйте ещё раз',
        missing_code: 'VK Live не вернул код авторизации',
        redirect_mismatch: 'OAuth redirect URL не совпадает с настройками провайдера',
        restart_failed: 'Токен сохранён, но runtime бота не удалось перезапустить',
        save_failed: 'Токен получен, но сохранить его не удалось',
    },
} as const;

type BotAuthLocale = keyof typeof BOT_AUTH_ERROR_MESSAGES;

export const formatBotAuthError = (errorCode: string | null | undefined, locale: BotAuthLocale = 'en'): string => {
    if (!errorCode) {
        return locale === 'ru' ? 'Неизвестная ошибка авторизации бота' : 'Unknown bot authorization error';
    }

    const normalized = errorCode.trim().toLowerCase();
    const localizedMessage = BOT_AUTH_ERROR_MESSAGES[locale][normalized as keyof typeof BOT_AUTH_ERROR_MESSAGES.en];

    if (localizedMessage) {
        return localizedMessage;
    }

    return normalized.replace(/_/g, ' ');
};
