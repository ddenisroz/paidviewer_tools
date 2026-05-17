import { AxiosError } from 'axios';

interface ErrorResponse {
    detail?: string | Array<{ loc?: string[]; msg?: string }>;
    error?: string;
    message?: string;
}

interface ErrorWithResponse {
    response?: {
        status: number;
        data?: ErrorResponse;
    };
    code?: string;
    message?: string;
}

export const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof AxiosError && error.response) {
        const status: number = error.response.status;
        const data: ErrorResponse = error.response.data || {};

        if (status === 400) {
            return (data.detail as string) || 'Неверные данные. Проверьте заполненные поля.';
        }
        if (status === 401) {
            return 'Сеанс истек. Пожалуйста, переавторизуйтесь.';
        }
        if (status === 403) {
            return 'У вас недостаточно прав для этой операции.';
        }
        if (status === 404) {
            return (data.detail as string) || 'Ресурс не найден. Проверьте идентификатор.';
        }
        if (status === 409) {
            if (typeof data.detail === 'string' && data.detail.includes('Current version')) {
                return 'Данные были обновлены другим пользователем. Перезагружаю...';
            }
            return 'Конфликт данных. Попробуйте еще раз.';
        }
        if (status === 422) {
            if (Array.isArray(data.detail)) {
                const fieldErrors = data.detail.map((err) => `${err.loc?.join('.')}: ${err.msg}`).join('; ');
                return fieldErrors || 'Ошибка валидации данных.';
            }
            return 'Ошибка валидации. Проверьте формат данных.';
        }
        if (status >= 500) {
            return 'Ошибка сервера. Попробуйте позже.';
        }
        if (data.error) return data.error;
        if (data.detail) return data.detail as string;
        return `Ошибка ${status}. Попробуйте еще раз.`;
    }

    const errorWithCode = error as ErrorWithResponse;
    if (errorWithCode.code === 'ERR_NETWORK') {
        return 'Ошибка сети. Проверьте интернет-соединение.';
    }
    if (errorWithCode.code === 'ECONNABORTED') {
        return 'Запрос истек. Сервер долго не отвечает.';
    }
    if (errorWithCode.message === 'Network Error') {
        return 'Сервер недоступен. Проверьте соединение.';
    }
    if (errorWithCode.code === 'ENOTFOUND') {
        return 'Не удается подключиться к серверу.';
    }
    if (errorWithCode.message) {
        return errorWithCode.message;
    }

    return 'Неизвестная ошибка. Попробуйте еще раз.';
};

export const getStatusMessage = (status: number): string => {
    const messages: Record<number, string> = {
        400: 'Проверьте, что все поля заполнены правильно.',
        401: 'Вы не авторизованы. Перезагрузите страницу.',
        403: 'У вас нет доступа к этой функции.',
        404: 'Элемент не найден или был удален.',
        409: 'Данные обновлены. Перезагружаю...',
        422: 'Формат данных неправильный.',
        500: 'На сервере произойдена ошибка. Свяжитесь с поддержкой.',
        502: 'Сервер временно недоступен.',
        503: 'Сервис на обслуживании. Попробуйте позже.',
        504: 'Сервер не отвечает. Попробуйте позже.',
    };
    return messages[status] || 'Попробуйте еще раз.';
};

export const getOperationMessage = (operation: string, error: unknown): string => {
    const operationMessages: Record<string, Record<string, string>> = {
        save_settings: {
            default: 'Ошибка при сохранении настроек.',
            '409': 'Настройки были изменены. Перезагружаю...',
        },
        delete_item: { default: 'Ошибка при удалении.', '404': 'Элемент уже был удален.' },
        create_item: { default: 'Ошибка при создании.', '400': 'Проверьте данные и попробуйте снова.' },
        upload_file: { default: 'Ошибка при загрузке файла.', '413': 'Файл слишком большой. Максимум 50 МБ.' },
        login: { default: 'Ошибка входа.', '401': 'Неверные учетные данные.' },
    };
    const opMessages = operationMessages[operation];
    if (!opMessages) {
        return getErrorMessage(error);
    }

    let status: number | undefined;
    if (error instanceof AxiosError && error.response) {
        status = error.response.status;
    }

    const key = status ? String(status) : 'default';
    return opMessages[key] || opMessages.default;
};
