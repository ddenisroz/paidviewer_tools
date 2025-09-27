#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль для ёфикации русского текста
Основан на python-yoficator: https://github.com/Text-extend-tools/python-yoficator
"""

import os
import re
import codecs
import logging
from pathlib import Path

# Настройка логирования
logger = logging.getLogger(__name__)

class Yoficator:
    """Ёфикатор для русского текста"""
    
    def __init__(self, dictionary_path=None):
        """
        Инициализация ёфикатора
        
        Args:
            dictionary_path: Путь к файлу словаря yo.dat
        """
        if dictionary_path is None:
            # Ищем файл yo.dat в папке python-yoficator
            current_dir = Path(__file__).parent
            dictionary_path = current_dir / "python-yoficator" / "yo.dat"
        
        self.dictionary_path = dictionary_path
        self.dictionary = {}
        self.splitter = re.compile(r'(\s+|\w+|\W+|\S+)', re.UNICODE)
        
        logger.info(f"Загружаем словарь ёфикации из: {self.dictionary_path}")
        # Загружаем словарь
        self._load_dictionary()
    
    def _load_dictionary(self):
        """Загружает словарь для ёфикации"""
        try:
            with codecs.open(self.dictionary_path, "r", "utf-8") as f:
                for line in f:
                    if not "*" in line:
                        cline = line.rstrip('\n')
                        if "(" in cline:
                            bline, sline = cline.split("(")
                            sline = re.sub(r'\)', '', sline)
                        else:
                            bline = cline
                            sline = ""
                        
                        if "|" in sline:
                            ssline = sline.split("|")
                            for ss in ssline:
                                value = bline + ss
                                key = re.sub(r'ё', 'е', value)
                                self.dictionary[key] = value
                        else:
                            value = bline
                            key = re.sub(r'ё', 'е', value)
                            self.dictionary[key] = value
            
            logger.info(f"Словарь ёфикации загружен успешно. Записей: {len(self.dictionary)}")
        except FileNotFoundError:
            logger.warning(f"Словарь {self.dictionary_path} не найден. Ёфикация отключена.")
            self.dictionary = {}
    
    def yoficate(self, text):
        """
        Ёфицирует русский текст
        
        Args:
            text: Исходный текст
            
        Returns:
            Ёфицированный текст
        """
        if not self.dictionary:
            return text
        
        # Разбиваем текст на токены
        tokens = self.splitter.findall(text)
        result = []
        
        for token in tokens:
            if token in self.dictionary:
                result.append(self.dictionary[token])
            else:
                # Дополнительные правила для слов, которых нет в словаре
                yoficated_token = self._apply_additional_rules(token)
                result.append(yoficated_token)
        
        return ''.join(result)
    
    def _apply_additional_rules(self, word: str) -> str:
        """Применяет дополнительные правила ёфикации для слов, которых нет в словаре."""
        if not word or not word.isalpha():
            return word
        
        import re
        word_lower = word.lower()
        
        # 1. Частые слова и исключения
        common_words = {
            "еще": "ещё",
            "ее": "её", 
            "телка": "тёлка",
            "осел": "осёл",
            "произнес": "произнёс",
            "шел": "шёл",
            "вел": "вёл",
            "жел": "жёл",
            "мел": "мёл",
            "тел": "тёл",
            "чё": "чё"
        }
        
        if word_lower in common_words:
            return word.replace(word_lower, common_words[word_lower])
        
        # 2. Глаголы прошедшего времени (заканчивающиеся на "ел")
        if word_lower.endswith("ел") and len(word) > 3:
            # Расширенный список исключений
            exceptions = [
                "медведь", "привет", "удел", "предел", "умел", "смел", "дела", "как",
                "смотрел", "думал", "знал", "был", "жил", "пил", "ел", "спал", 
                "встал", "упал", "взял", "дал", "стал", "встал", "упал", "взял", "дал", "стал",
                "читал", "писал", "рисовал", "играл", "работал", "учился", "училась",
                "гулял", "гуляла", "ходил", "ходила", "бегал", "бегала", "прыгал", "прыгала",
                "танцевал", "танцевала", "пел", "пела", "играл", "играла", "работал", "работала",
                "учил", "учила", "читал", "читала", "писал", "писала", "рисовал", "рисовала",
                "смотрел", "смотрела", "слушал", "слушала", "говорил", "говорила",
                "думал", "думала", "знал", "знала", "понимал", "понимала", "чувствовал", "чувствовала",
                "сел", "села", "гетеро"  # Добавляем исключения для "сел" и "гетеро"
            ]
            if word_lower not in exceptions:
                return word.replace("ел", "ёл")
        
        # 3. Прилагательные женского рода (заканчивающиеся на "ая") - НЕ ёфицируем
        # Все цветовые прилагательные остаются без ё
        
        # 4. Слова с "е" в корне, заканчивающиеся на "а" (женский род)
        if word_lower.endswith("а") and "е" in word_lower[:-1] and len(word) > 3:
            exceptions = ["дела", "щелка", "мелка", "желтка", "белка", "зеленка", "краснка", "стена", "ерунда"]
            if word_lower not in exceptions:
                # Заменяем "е" на "ё" в корне, но не в окончании
                return re.sub(r'е([^ё]*а)$', r'ё\1', word)
        
        # 5. Слова с "е" в корне, заканчивающиеся на "о" (средний род)
        if word_lower.endswith("о") and "е" in word_lower[:-1] and len(word) > 3:
            exceptions = ["дело", "место", "время", "небо", "поле", "море", "озеро", "дерево", "гетеро"]
            if word_lower not in exceptions:
                # Заменяем "е" на "ё" в корне, но не в окончании
                return re.sub(r'е([^ё]*о)$', r'ё\1', word)
        
        # 6. Слова с "е" в корне, заканчивающиеся на "ый" (мужской род) - НЕ ёфицируем
        # Все цветовые прилагательные остаются без ё
        
        # 7. Слова с "е" в корне, заканчивающиеся на "ое" (средний род) - НЕ ёфицируем
        # Все цветовые прилагательные остаются без ё
        
        # 8. Слова с "е" в корне, заканчивающиеся на "ая" (женский род) - удалено, дублирует правило 3
        
        # 9. Слова с "е" в корне, заканчивающиеся на "ие" (множественное число) - НЕ ёфицируем
        # Все цветовые прилагательные остаются без ё
        
        return word

# Создаем глобальный экземпляр для удобства использования
logger.info("Инициализация ёфикатора...")
yoficator = Yoficator()
logger.info("Ёфикатор инициализирован успешно")

def yoficate_text(text):
    """
    Удобная функция для ёфикации текста
    
    Args:
        text: Исходный текст
        
    Returns:
        Ёфицированный текст
    """
    return yoficator.yoficate(text)

if __name__ == "__main__":
    # Тестирование
    test_text = "елка, медведь, осел, все, еще, ее"
    result = yoficate_text(test_text)
    print(f"Исходный текст: {test_text}")
    print(f"Ёфицированный: {result}")
