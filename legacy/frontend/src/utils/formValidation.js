/**
 * Common form validation functions
 */

export const validators = {
    /**
     * Email validation
     */
    email: (value) => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Введите корректный email';
    },

    /**
     * Required field validation
     */
    required: (value, fieldName = 'Поле') => {
        if (!value || value.toString().trim() === '') {
            return `${fieldName} обязательно`;
        }
        return null;
    },

    /**
     * Min length validation
     */
    minLength: (value, minLength, fieldName = 'Текст') => {
        if (!value) return null;
        if (value.length < minLength) {
            return `${fieldName} должен быть минимум ${minLength} символов`;
        }
        return null;
    },

    /**
     * Max length validation
     */
    maxLength: (value, maxLength, fieldName = 'Текст') => {
        if (!value) return null;
        if (value.length > maxLength) {
            return `${fieldName} не должен превышать ${maxLength} символов`;
        }
        return null;
    },

    /**
     * Username validation (alphanumeric + underscore)
     */
    username: (value) => {
        if (!value) return 'Введите имя пользователя';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            return 'Только буквы, цифры и подчеркивание';
        }
        if (value.length < 3) {
            return 'Минимум 3 символа';
        }
        if (value.length > 20) {
            return 'Максимум 20 символов';
        }
        return null;
    },

    /**
     * URL validation
     */
    url: (value) => {
        if (!value) return null;
        try {
            new URL(value);
            return null;
        } catch (e) {
            return 'Введите корректный URL';
        }
    },

    /**
     * Number validation
     */
    number: (value) => {
        if (value === '' || value === null || value === undefined) return null;
        if (isNaN(value)) return 'Введите число';
        return null;
    },

    /**
     * Positive number validation
     */
    positiveNumber: (value) => {
        const numberError = validators.number(value);
        if (numberError) return numberError;
        if (value !== '' && Number(value) < 0) return 'Число должно быть положительным';
        return null;
    },

    /**
     * Password strength validation
     */
    password: (value) => {
        if (!value) return 'Введите пароль';
        if (value.length < 8) return 'Минимум 8 символов';
        if (!/[A-Z]/.test(value)) return 'Должна быть хотя бы одна заглавная буква';
        if (!/[a-z]/.test(value)) return 'Должна быть хотя бы одна строчная буква';
        if (!/[0-9]/.test(value)) return 'Должна быть хотя бы одна цифра';
        return null;
    },

    /**
     * Match fields validation (for confirm password)
     */
    match: (value1, value2, fieldName = 'Поля') => {
        if (value1 !== value2) {
            return `${fieldName} не совпадают`;
        }
        return null;
    },
};

/**
 * Compose multiple validators
 */
export const compose = (...validators) => (value) => {
    for (const validator of validators) {
        const error = validator(value);
        if (error) return error;
    }
    return null;
};

/**
 * Create error object for form
 */
export const createFormErrors = (values, validationSchema) => {
    const errors = {};
    
    Object.keys(validationSchema).forEach(field => {
        const validator = validationSchema[field];
        const error = validator(values[field]);
        if (error) {
            errors[field] = error;
        }
    });

    return errors;
};

/**
 * Check if form is valid
 */
export const isFormValid = (errors) => {
    return Object.keys(errors).length === 0 && 
           Object.values(errors).every(error => !error);
};

/**
 * Get field error
 */
export const getFieldError = (errors, fieldName) => {
    return errors[fieldName] || null;
};

/**
 * Has any errors
 */
export const hasErrors = (errors) => {
    return Object.values(errors).some(error => !!error);
};

