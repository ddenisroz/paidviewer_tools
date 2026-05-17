export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export const validateUsername = (username: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!username) {
        errors.push('Имя пользователя не может быть пустым');
    } else if (username.length < 2) {
        errors.push('Имя пользователя должно содержать минимум 2 символа');
    } else if (username.length > 20) {
        errors.push('Имя пользователя не должно превышать 20 символов');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errors.push('Имя пользователя может содержать только буквы, цифры, _ и -');
    }
    return { isValid: errors.length === 0, errors };
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!password) {
        errors.push('Пароль не может быть пустым');
    } else if (password.length < 8) {
        errors.push('Пароль должен содержать минимум 8 символов');
    } else if (!/(?=.*[a-z])/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну строчную букву');
    } else if (!/(?=.*[A-Z])/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну заглавную букву');
    } else if (!/(?=.*\d)/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну цифру');
    }
    return { isValid: errors.length === 0, errors };
};

export const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const isValidAge = (age: number): boolean => {
    return typeof age === 'number' && age >= 0 && age <= 150;
};

export const isInRange = (value: number, min: number, max: number): boolean => {
    return typeof value === 'number' && value >= min && value <= max;
};

export default {
    isValidEmail,
    isValidUrl,
    validateUsername,
    validatePassword,
    isValidPhone,
    isValidAge,
    isInRange,
};
