/**
 * Общие утилиты и хелперы для frontend приложения
 */

import { VALIDATION, TIMEOUTS, REGEX } from '../constants';
import { logger } from '../utils/prodLogger';

// === ВАЛИДАЦИЯ ===

/**
 * Валидация имени пользователя
 * @param {string} username - Имя пользователя для валидации
 * @returns {object} Результат валидации {isValid: boolean, error?: string}
 */
export const validateUsername = (username) => {
  if (!username) {
    return { isValid: false, error: 'Имя пользователя обязательно' };
  }
  
  if (username.length < VALIDATION.USERNAME.MIN_LENGTH) {
    return { isValid: false, error: `Минимум ${VALIDATION.USERNAME.MIN_LENGTH} символов` };
  }
  
  if (username.length > VALIDATION.USERNAME.MAX_LENGTH) {
    return { isValid: false, error: `Максимум ${VALIDATION.USERNAME.MAX_LENGTH} символов` };
  }
  
  if (!VALIDATION.USERNAME.PATTERN.test(username)) {
    return { isValid: false, error: 'Только буквы, цифры и подчеркивание' };
  }
  
  return { isValid: true };
};

/**
 * Валидация кода верификации
 * @param {string} code - Код верификации
 * @returns {object} Результат валидации
 */
export const validateVerificationCode = (code) => {
  if (!code) {
    return { isValid: false, error: 'Код верификации обязателен' };
  }
  
  if (code.length < VALIDATION.VERIFICATION_CODE.MIN_LENGTH) {
    return { isValid: false, error: `Минимум ${VALIDATION.VERIFICATION_CODE.MIN_LENGTH} символов` };
  }
  
  if (code.length > VALIDATION.VERIFICATION_CODE.MAX_LENGTH) {
    return { isValid: false, error: `Максимум ${VALIDATION.VERIFICATION_CODE.MAX_LENGTH} символов` };
  }
  
  if (!VALIDATION.VERIFICATION_CODE.PATTERN.test(code)) {
    return { isValid: false, error: 'Только заглавные буквы и цифры' };
  }
  
  return { isValid: true };
};

/**
 * Валидация email
 * @param {string} email - Email для валидации
 * @returns {object} Результат валидации
 */
export const validateEmail = (email) => {
  if (!email) {
    return { isValid: false, error: 'Email обязателен' };
  }
  
  if (!REGEX.EMAIL.test(email)) {
    return { isValid: false, error: 'Неверный формат email' };
  }
  
  return { isValid: true };
};

/**
 * Валидация URL
 * @param {string} url - URL для валидации
 * @returns {object} Результат валидации
 */
export const validateUrl = (url) => {
  if (!url) {
    return { isValid: false, error: 'URL обязателен' };
  }
  
  if (!REGEX.URL.test(url)) {
    return { isValid: false, error: 'Неверный формат URL' };
  }
  
  return { isValid: true };
};

// === РАБОТА С ДАННЫМИ ===

/**
 * Безопасное получение значения из объекта по пути
 * @param {object} obj - Объект
 * @param {string} path - Путь к значению (например, 'user.profile.name')
 * @param {any} defaultValue - Значение по умолчанию
 * @returns {any} Значение или defaultValue
 */
export const safeGet = (obj, path, defaultValue = null) => {
  if (!obj || !path) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  
  return result;
};

/**
 * Глубокое клонирование объекта
 * @param {any} obj - Объект для клонирования
 * @returns {any} Клонированный объект
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Удаление undefined значений из объекта
 * @param {object} obj - Объект для очистки
 * @returns {object} Очищенный объект
 */
export const removeUndefined = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

// === РАБОТА СО СТРОКАМИ ===

/**
 * Форматирование строки с заменой плейсхолдеров
 * @param {string} template - Шаблон строки с {placeholder}
 * @param {object} values - Объект со значениями для замены
 * @returns {string} Форматированная строка
 */
export const formatString = (template, values) => {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values.hasOwnProperty(key) ? values[key] : match;
  });
};

/**
 * Капитализация первой буквы строки
 * @param {string} str - Строка для капитализации
 * @returns {string} Строка с заглавной первой буквой
 */
export const capitalize = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Обрезка строки до максимальной длины с добавлением многоточия
 * @param {string} str - Строка для обрезки
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Обрезанная строка
 */
export const truncate = (str, maxLength) => {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};

/**
 * Удаление HTML тегов из строки
 * @param {string} html - HTML строка
 * @returns {string} Очищенная строка
 */
export const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
};

// === РАБОТА С ВРЕМЕНЕМ ===

/**
 * Форматирование даты в читаемый вид
 * @param {Date|string|number} date - Дата для форматирования
 * @param {object} options - Опции форматирования
 * @returns {string} Форматированная дата
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return dateObj.toLocaleDateString('ru-RU', defaultOptions);
};

/**
 * Получение относительного времени (например, "2 минуты назад")
 * @param {Date|string|number} date - Дата
 * @returns {string} Относительное время
 */
export const getRelativeTime = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffInMs = now - dateObj;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInSeconds < 60) return 'только что';
  if (diffInMinutes < 60) return `${diffInMinutes} мин. назад`;
  if (diffInHours < 24) return `${diffInHours} ч. назад`;
  if (diffInDays < 30) return `${diffInDays} дн. назад`;
  
  return formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Создание таймера с автоматической очисткой
 * @param {function} callback - Функция для выполнения
 * @param {number} delay - Задержка в миллисекундах
 * @returns {function} Функция для отмены таймера
 */
export const createTimer = (callback, delay) => {
  const timerId = setTimeout(callback, delay);
  return () => clearTimeout(timerId);
};

// === РАБОТА С URL ===

/**
 * Получение параметров из URL
 * @param {string} url - URL (опционально, по умолчанию текущий)
 * @returns {object} Объект с параметрами
 */
export const getUrlParams = (url = window.location.href) => {
  const urlObj = new URL(url);
  const params = {};
  
  for (const [key, value] of urlObj.searchParams.entries()) {
    params[key] = value;
  }
  
  return params;
};

/**
 * Создание URL с параметрами
 * @param {string} base - Базовый URL
 * @param {object} params - Параметры для добавления
 * @returns {string} URL с параметрами
 */
export const buildUrl = (base, params = {}) => {
  const url = new URL(base);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.set(key, params[key]);
    }
  });
  
  return url.toString();
};


// === РАБОТА С COOKIES ===

/**
 * Получение значения cookie
 * @param {string} name - Название cookie
 * @returns {string|null} Значение cookie или null
 */
export const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    try {
      return JSON.parse(decodeURIComponent(parts.pop().split(';').shift()));
    } catch (error) {
      logger.warn(`Failed to parse cookie ${name}:`, error);
      return null;
    }
  }
  return null;
};

/**
 * Установка cookie
 * @param {string} name - Название cookie
 * @param {any} value - Значение cookie
 * @param {object} options - Опции cookie
 */
export const setCookie = (name, value, options = {}) => {
  const defaults = {
    path: '/',
    maxAge: 86400 * 30 // 30 дней
  };
  
  const opts = { ...defaults, ...options };
  let cookieString = `${name}=${encodeURIComponent(JSON.stringify(value))}`;
  
  Object.keys(opts).forEach(key => {
    if (opts[key] !== undefined) {
      cookieString += `; ${key}=${opts[key]}`;
    }
  });
  
  document.cookie = cookieString;
};

/**
 * Удаление cookie
 * @param {string} name - Название cookie
 * @param {string} path - Путь cookie
 */
export const removeCookie = (name, path = '/') => {
  document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

// === УТИЛИТЫ ПРОИЗВОДИТЕЛЬНОСТИ ===

/**
 * Debounce функция для ограничения частоты вызовов
 * @param {function} func - Функция для выполнения
 * @param {number} wait - Задержка в миллисекундах
 * @returns {function} Debounced функция
 */
export const debounce = (func, wait = TIMEOUTS.DEBOUNCE_DELAY) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle функция для ограничения частоты вызовов
 * @param {function} func - Функция для выполнения
 * @param {number} limit - Лимит в миллисекундах
 * @returns {function} Throttled функция
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// === КОПИРОВАНИЕ В БУФЕР ОБМЕНА ===

/**
 * Копирование текста в буфер обмена
 * @param {string} text - Текст для копирования
 * @returns {Promise<boolean>} Успешность операции
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    logger.error('Error copying to clipboard:', error);
    return false;
  }
};

// === ГЕНЕРАЦИЯ ID ===

/**
 * Генерация случайного ID
 * @param {number} length - Длина ID
 * @returns {string} Случайный ID
 */
export const generateId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// === ФОРМАТИРОВАНИЕ ЧИСЕЛ ===

/**
 * Форматирование числа с разделителями тысяч
 * @param {number} num - Число для форматирования
 * @returns {string} Форматированное число
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString('ru-RU');
};

/**
 * Форматирование байтов в читаемый вид
 * @param {number} bytes - Количество байтов
 * @param {number} decimals - Количество знаков после запятой
 * @returns {string} Форматированный размер
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
