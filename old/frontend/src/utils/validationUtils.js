// src/utils/validationUtils.js

/**
 * Валидация email
 * @param {string} email - Email
 * @returns {boolean} - Валидный ли email
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Валидация URL
 * @param {string} url - URL
 * @returns {boolean} - Валидный ли URL
 */
export const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Валидация имени пользователя
 * @param {string} username - Имя пользователя
 * @returns {Object} - Результат валидации
 */
export const validateUsername = (username) => {
    const errors = [];
    
    if (!username) {
        errors.push('Имя пользователя не может быть пустым');
    } else if (username.length < 2) {
        errors.push('Имя пользователя должно содержать минимум 2 символа');
    } else if (username.length > 20) {
        errors.push('Имя пользователя не должно превышать 20 символов');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errors.push('Имя пользователя может содержать только буквы, цифры, _ и -');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Валидация пароля
 * @param {string} password - Пароль
 * @returns {Object} - Результат валидации
 */
export const validatePassword = (password) => {
    const errors = [];
    
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
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Валидация номера телефона
 * @param {string} phone - Номер телефона
 * @returns {boolean} - Валидный ли номер
 */
export const isValidPhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Валидация возраста
 * @param {number} age - Возраст
 * @returns {boolean} - Валидный ли возраст
 */
export const isValidAge = (age) => {
    return typeof age === 'number' && age >= 0 && age <= 150;
};

/**
 * Валидация диапазона
 * @param {number} value - Значение
 * @param {number} min - Минимум
 * @param {number} max - Максимум
 * @returns {boolean} - Входит ли в диапазон
 */
export const isInRange = (value, min, max) => {
    return typeof value === 'number' && value >= min && value <= max;
};

export default {
    isValidEmail,
    isValidUrl,
    validateUsername,
    validatePassword,
    isValidPhone,
    isValidAge,
    isInRange
};

