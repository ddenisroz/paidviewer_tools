/**
 * Converts API errors and HTTP status codes into user-friendly messages
 */

export const getErrorMessage = (error) => {
    // Если это message строка, вернуть как есть
    if (typeof error === 'string') {
        return error;
    }

    // Ошибка axios с response
    if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // 400 - Bad Request
        if (status === 400) {
            if (data.detail) {
                return data.detail;
            }
            return 'Неверные данные. Проверьте заполненные поля.';
        }

        // 401 - Unauthorized
        if (status === 401) {
            return 'Сеанс истек. Пожалуйста, переавторизуйтесь.';
        }

        // 403 - Forbidden
        if (status === 403) {
            return 'У вас недостаточно прав для этой операции.';
        }

        // 404 - Not Found
        if (status === 404) {
            if (data.detail) {
                return data.detail;
            }
            return 'Ресурс не найден. Проверьте идентификатор.';
        }

        // 409 - Conflict (версионирование)
        if (status === 409) {
            if (data.detail?.includes('Current version')) {
                return 'Данные были обновлены другим пользователем. Перезагружаю...';
            }
            return 'Конфликт данных. Попробуйте еще раз.';
        }

        // 422 - Unprocessable Entity (Pydantic validation)
        if (status === 422) {
            if (data.detail && Array.isArray(data.detail)) {
                const fieldErrors = data.detail
                    .map(err => `${err.loc?.join('.')}: ${err.msg}`)
                    .join('; ');
                return fieldErrors || 'Ошибка валидации данных.';
            }
            return 'Ошибка валидации. Проверьте формат данных.';
        }

        // 500+ - Server Error
        if (status >= 500) {
            return 'Ошибка сервера. Попробуйте позже.';
        }

        // Default response error
        if (data.error) {
            return data.error;
        }
        if (data.detail) {
            return data.detail;
        }
        return `Ошибка ${status}. Попробуйте еще раз.`;
    }

    // Network errors
    if (error.code === 'ERR_NETWORK') {
        return 'Ошибка сети. Проверьте интернет-соединение.';
    }

    if (error.code === 'ECONNABORTED') {
        return 'Запрос истек. Сервер долго не отвечает.';
    }

    if (error.message === 'Network Error') {
        return 'Сервер недоступен. Проверьте соединение.';
    }

    // Timeout
    if (error.code === 'ENOTFOUND') {
        return 'Не удается подключиться к серверу.';
    }

    // Generic error
    if (error.message) {
        return error.message;
    }

    return 'Неизвестная ошибка. Попробуйте еще раз.';
};

/**
 * Get status-specific helpful messages
 */
export const getStatusMessage = (status) => {
    const messages = {
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

/**
 * Category messages for specific operations
 */
export const getOperationMessage = (operation, error) => {
    const operationMessages = {
        'save_settings': {
            'default': 'Ошибка при сохранении настроек.',
            '409': 'Настройки были изменены. Перезагружаю...',
        },
        'delete_item': {
            'default': 'Ошибка при удалении.',
            '404': 'Элемент уже был удален.',
        },
        'create_item': {
            'default': 'Ошибка при создании.',
            '400': 'Проверьте данные и попробуйте снова.',
        },
        'upload_file': {
            'default': 'Ошибка при загрузке файла.',
            '413': 'Файл слишком большой. Максимум 50 МБ.',
        },
        'login': {
            'default': 'Ошибка входа.',
            '401': 'Неверные учетные данные.',
        },
    };

    const opMessages = operationMessages[operation];
    if (!opMessages) {
        return getErrorMessage(error);
    }

    const status = error.response?.status;
    const key = status ? String(status) : 'default';
    
    return opMessages[key] || opMessages.default;
};

