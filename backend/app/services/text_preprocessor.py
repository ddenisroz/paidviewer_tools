"""
Модуль для предобработки текста перед TTS синтезом:
- Конвертация цифр в слова
- Обработка никнеймов с числами
- Нормализация текста для лучшего произношения
"""

import re
import logging

logger = logging.getLogger(__name__)

# Словарь для конвертации цифр в слова
DIGITS_TO_WORDS = {
    '0': 'ноль', '1': 'один', '2': 'два', '3': 'три', '4': 'четыре',
    '5': 'пять', '6': 'шесть', '7': 'семь', '8': 'восемь', '9': 'девять'
}

# Словарь для чисел от 10 до 19
TEENS = {
    '10': 'десять', '11': 'одиннадцать', '12': 'двенадцать', '13': 'тринадцать',
    '14': 'четырнадцать', '15': 'пятнадцать', '16': 'шестнадцать', '17': 'семнадцать',
    '18': 'восемнадцать', '19': 'девятнадцать'
}

# Словарь для десятков
TENS = {
    '20': 'двадцать', '30': 'тридцать', '40': 'сорок', '50': 'пятьдесят',
    '60': 'шестьдесят', '70': 'семьдесят', '80': 'восемьдесят', '90': 'девяносто'
}

# Словарь для сотен
HUNDREDS = {
    '100': 'сто', '200': 'двести', '300': 'триста', '400': 'четыреста',
    '500': 'пятьсот', '600': 'шестьсот', '700': 'семьсот', '800': 'восемьсот', '900': 'девятьсот'
}


def convert_digit_to_word(digit: str) -> str:
    """Конвертирует одну цифру в слово."""
    return DIGITS_TO_WORDS.get(digit, digit)


def convert_number_to_words(number: str) -> str:
    """Конвертирует число в слова."""
    if not number.isdigit():
        return number
    
    num = int(number)
    
    # Обработка специальных случаев
    if num == 0:
        return 'ноль'
    elif num < 10:
        return DIGITS_TO_WORDS[str(num)]
    elif num < 20:
        return TEENS[str(num)]
    elif num < 100:
        tens = (num // 10) * 10
        ones = num % 10
        if ones == 0:
            return TENS[str(tens)]
        else:
            return f"{TENS[str(tens)]} {DIGITS_TO_WORDS[str(ones)]}"
    elif num < 1000:
        hundreds = (num // 100) * 100
        remainder = num % 100
        if remainder == 0:
            return HUNDREDS[str(hundreds)]
        else:
            hundreds_word = HUNDREDS[str(hundreds)]
            if remainder < 10:
                return f"{hundreds_word} {DIGITS_TO_WORDS[str(remainder)]}"
            elif remainder < 20:
                return f"{hundreds_word} {TEENS[str(remainder)]}"
            else:
                tens = (remainder // 10) * 10
                ones = remainder % 10
                if ones == 0:
                    return f"{hundreds_word} {TENS[str(tens)]}"
                else:
                    return f"{hundreds_word} {TENS[str(tens)]} {DIGITS_TO_WORDS[str(ones)]}"
    elif num < 10000:
        # Обработка тысяч (1000-9999)
        thousands = num // 1000
        remainder = num % 1000
        
        if thousands == 1:
            thousands_word = "тысяча"
        elif thousands in [2, 3, 4]:
            thousands_word = f"{DIGITS_TO_WORDS[str(thousands)]} тысячи"
        else:
            thousands_word = f"{DIGITS_TO_WORDS[str(thousands)]} тысяч"
        
        if remainder == 0:
            return thousands_word
        else:
            remainder_word = convert_number_to_words(str(remainder))
            return f"{thousands_word} {remainder_word}"
    else:
        # Для очень больших чисел произносим по цифрам
        return ' '.join([DIGITS_TO_WORDS[digit] for digit in number])


def process_username_numbers(text: str) -> str:
    """Обрабатывает никнеймы с числами, конвертируя числа в слова."""
    # Паттерн для поиска никнеймов (буквы + цифры)
    username_pattern = r'\b[a-zA-Zа-яА-Я]+[0-9]+\b'
    
    def replace_username(match):
        username = match.group()
        # Разделяем буквы и цифры
        parts = re.split(r'(\d+)', username)
        result_parts = []
        
        for part in parts:
            if part.isdigit():
                # Для никнеймов используем полную конвертацию для чисел до 9999 (включая годы)
                if len(part) <= 4:  # Для чисел до 9999 используем полную конвертацию
                    result_parts.append(convert_number_to_words(part))
                else:  # Для очень больших чисел произносим по цифрам
                    result_parts.append(' '.join([DIGITS_TO_WORDS[digit] for digit in part]))
            else:
                # Оставляем буквы как есть
                result_parts.append(part)
        
        return ' '.join(result_parts)
    
    return re.sub(username_pattern, replace_username, text)


def process_standalone_numbers(text: str) -> str:
    """Обрабатывает отдельно стоящие числа."""
    # Паттерн для поиска чисел (включая числа в конце слов)
    number_pattern = r'\b\d+\b'
    
    def replace_number(match):
        number = match.group()
        return convert_number_to_words(number)
    
    return re.sub(number_pattern, replace_number, text)


def process_mixed_text(text: str) -> str:
    """Обрабатывает смешанный текст с буквами и цифрами."""
    # Паттерн для поиска смешанных последовательностей букв и цифр
    # Ищем любые последовательности, содержащие и буквы, и цифры
    mixed_pattern = r'[a-zA-Zа-яА-Я]+\d+[a-zA-Zа-яА-Я]*|\d+[a-zA-Zа-яА-Я]+[a-zA-Zа-яА-Я]*|[a-zA-Zа-яА-Я]*\d+[a-zA-Zа-яА-Я]+'
    
    def replace_mixed(match):
        mixed_text = match.group()
        # Разделяем на буквы и цифры
        parts = re.split(r'(\d+)', mixed_text)
        result_parts = []
        
        for part in parts:
            if part.isdigit():
                # Для чисел в смешанном тексте используем полную конвертацию для чисел до 9999
                if len(part) <= 4:  # Для чисел до 9999 используем полную конвертацию
                    result_parts.append(convert_number_to_words(part))
                else:  # Для очень больших чисел произносим по цифрам
                    result_parts.append(' '.join([DIGITS_TO_WORDS[digit] for digit in part]))
            else:
                result_parts.append(part)
        
        return ' '.join(result_parts)
    
    return re.sub(mixed_pattern, replace_mixed, text)


def preprocess_text_for_tts(text: str) -> str:
    """
    Основная функция предобработки текста для TTS.
    
    Args:
        text: Исходный текст
        
    Returns:
        Обработанный текст с числами, конвертированными в слова
    """
    if not text or not text.strip():
        return text
    
    logger.info(f"Original text: '{text}'")
    
    # Убираем лишние пробелы
    processed_text = ' '.join(text.split())
    
    # Обрабатываем никнеймы с числами
    processed_text = process_username_numbers(processed_text)
    
    # Обрабатываем смешанный текст
    processed_text = process_mixed_text(processed_text)
    
    # Обрабатываем отдельно стоящие числа
    processed_text = process_standalone_numbers(processed_text)
    
    # Убираем лишние пробелы после обработки
    processed_text = ' '.join(processed_text.split())
    
    logger.info(f"Processed text: '{processed_text}'")
    
    return processed_text


# Тестовые примеры для проверки
if __name__ == "__main__":
    test_cases = [
        "Привет, user123!",
        "Пользователь 456 зашел в чат",
        "test2024 и user999",
        "Число 42 и никнейм player1",
        "abc123def456",
        "Просто число 100",
        "user1, user2, user3"
    ]
    
    for test in test_cases:
        result = preprocess_text_for_tts(test)
        print(f"'{test}' -> '{result}'")
