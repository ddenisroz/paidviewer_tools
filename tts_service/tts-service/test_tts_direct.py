#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Прямое тестирование TTS движка для диагностики проблем
"""

import sys
import os
from pathlib import Path

# Добавляем путь к TTS_rus_engine
base_dir = Path(__file__).resolve().parent
tts_engine_dir = str(base_dir / 'TTS_rus_engine')
if tts_engine_dir not in sys.path:
    sys.path.insert(0, tts_engine_dir)

from russian_tts import RussianTTS
import logging

# Включаем детальное логирование
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_tts():
    """Тестирование TTS движка"""
    print("🧪 ТЕСТИРОВАНИЕ TTS ДВИЖКА")
    print("=" * 50)
    
    # Инициализируем TTS
    print("\n📋 Инициализация TTS...")
    tts = RussianTTS()
    
    if not tts.russian_tts:
        print("❌ Русская модель не загружена!")
        return
    
    print("✅ Русская модель загружена")
    
    # Проверяем голоса
    voices_dir = base_dir / "voices"
    available_voices = list(voices_dir.glob("*.wav"))
    print(f"\n🎤 Доступные голоса: {len(available_voices)}")
    for voice in available_voices:
        print(f"  - {voice.name}")
    
    # Тестовые тексты
    test_texts = [
        "Привет мир!",
        "Это тестовое сообщение для проверки синтеза речи.",
        "123",
        "Тестируем длинный текст для проверки работы системы синтеза речи."
    ]
    
    # Используем speaker1_24000.wav если есть, иначе первый доступный
    speaker1_path = base_dir / "voices" / "speaker1_24000.wav"
    if speaker1_path.exists():
        voice_path = str(speaker1_path)
        print(f"\n🎯 Используем приоритетный голос: {voice_path}")
    elif available_voices:
        voice_path = str(available_voices[0])
        print(f"\n🎯 Используем первый доступный голос: {voice_path}")
    else:
        voice_path = None
        print("❌ Нет доступных голосов для тестирования")
        return
    
    # Читаем референсный текст
    ref_text = ""
    ref_text_path = voice_path.replace('.wav', '.txt')
    if os.path.exists(ref_text_path):
        with open(ref_text_path, 'r', encoding='utf-8') as f:
            ref_text = f.read().strip()
        print(f"📝 Референсный текст: '{ref_text[:100]}...'")
    else:
        print("⚠️  Референсный текст не найден, используем дефолтный")
        
    # Тестируем каждый текст
    for i, text in enumerate(test_texts):
        print(f"\n🧪 ТЕСТ {i+1}: '{text}'")
        print("-" * 30)
        
        result = tts.synthesize_speech(
            text=text,
            ref_audio_path=voice_path,
            ref_text=ref_text,
            target_rms=0.4,  # Увеличиваем target RMS
            cfg_strength=2.0,
            sway_sampling_coef=-1.0
        )
        
        if result and os.path.exists(result):
            print(f"✅ Файл создан: {result}")
            
            # Проверяем содержимое файла
            try:
                import soundfile as sf
                import numpy as np
                
                data, sr = sf.read(result)
                rms = np.sqrt(np.mean(data**2))
                max_val = np.max(np.abs(data))
                duration = len(data) / sr
                
                print(f"📊 Статистика:")
                print(f"   RMS: {rms:.10f}")
                print(f"   Max амплитуда: {max_val:.10f}")
                print(f"   Длительность: {duration:.2f}с")
                print(f"   Частота: {sr}Hz")
                print(f"   Сэмплов: {len(data)}")
                
                if max_val < 0.001:
                    print("⚠️  ПРЕДУПРЕЖДЕНИЕ: Звук очень тихий!")
                else:
                    print("🔊 Звук в норме")
                    
            except Exception as e:
                print(f"❌ Ошибка анализа файла: {e}")
        else:
            print(f"❌ Файл не создан или ошибка: {result}")

if __name__ == "__main__":
    test_tts()

