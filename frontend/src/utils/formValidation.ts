export type Validator = (value: any, ...args: any[]) => string | null;

export const validators = {
  email: (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Введите корректный email';
  },
  required: (value: any, fieldName: string = 'Поле'): string | null => {
    if (!value || value.toString().trim() === '') {
      return `${fieldName} обязательно`;
    }
    return null;
  },
  minLength: (value: string, minLength: number, fieldName: string = 'Текст'): string | null => {
    if (!value) return null;
    if (value.length < minLength) {
      return `${fieldName} должен быть минимум ${minLength} символов`;
    }
    return null;
  },
  maxLength: (value: string, maxLength: number, fieldName: string = 'Текст'): string | null => {
    if (!value) return null;
    if (value.length > maxLength) {
      return `${fieldName} не должен превышать ${maxLength} символов`;
    }
    return null;
  },
  username: (value: string): string | null => {
    if (!value) return 'Введите имя пользователя';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Только буквы, цифры и подчеркивание';
    if (value.length < 3) return 'Минимум 3 символа';
    if (value.length > 20) return 'Максимум 20 символов';
    return null;
  },
  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Введите корректный URL';
    }
  },
  number: (value: any): string | null => {
    if (value === '' || value === null || value === undefined) return null;
    if (isNaN(value)) return 'Введите число';
    return null;
  },
  positiveNumber: (value: any): string | null => {
    const numberError = validators.number(value);
    if (numberError) return numberError;
    if (value !== '' && Number(value) < 0) return 'Число должно быть положительным';
    return null;
  },
  password: (value: string): string | null => {
    if (!value) return 'Введите пароль';
    if (value.length < 8) return 'Минимум 8 символов';
    if (!/[A-Z]/.test(value)) return 'Должна быть хотя бы одна заглавная буква';
    if (!/[a-z]/.test(value)) return 'Должна быть хотя бы одна строчная буква';
    if (!/[0-9]/.test(value)) return 'Должна быть хотя бы одна цифра';
    return null;
  },
  match: (value1: any, value2: any, fieldName: string = 'Поля'): string | null => {
    if (value1 !== value2) {
      return `${fieldName} не совпадают`;
    }
    return null;
  },
};

export const compose =
  (...fns: Validator[]) =>
  (value: any): string | null => {
    for (const validator of fns) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };

export const createFormErrors = (values: Record<string, any>, validationSchema: Record<string, Validator>): Record<string, string> => {
  const errors: Record<string, string> = {};
  Object.keys(validationSchema).forEach((field) => {
    const validator = validationSchema[field];
    const error = validator(values[field]);
    if (error) {
      errors[field] = error;
    }
  });
  return errors;
};

export const isFormValid = (errors: Record<string, string | null>): boolean => {
  return Object.keys(errors).length === 0 && Object.values(errors).every((error) => !error);
};

export const getFieldError = (errors: Record<string, string | null>, fieldName: string): string | null => {
  return errors[fieldName] || null;
};

export const hasErrors = (errors: Record<string, string | null>): boolean => {
  return Object.values(errors).some((error) => !!error);
};


