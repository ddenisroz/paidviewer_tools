/**
 * Утилита для логирования в зависимости от окружения
 */

const isDevelopment = import.meta.env.MODE === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args) => {
    console.warn(...args); // Предупреждения показываем всегда
  },
  
  error: (...args) => {
    console.error(...args); // Ошибки показываем всегда
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

export default logger;
