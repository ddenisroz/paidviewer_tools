#!/usr/bin/env python3
"""
Скрипт для автоматического удаления гостевого режима из кодовой базы.
Заменяет паттерны гостевой логики на упрощенные версии только для авторизованных пользователей.
"""

import re
import sys
from pathlib import Path

# Паттерны для замены
REPLACEMENTS = [
    # Удаление is_guest проверок
    (
        r'is_guest\s*=\s*\(not user or user\.get\([\'"]id[\'"]\)\s*==\s*-1\)',
        '# Guest mode removed - all users must be authenticated'
    ),
    (
        r'session_id\s*=\s*user\.get\([\'"]session_id[\'"]\)\s*if\s+is_guest\s+and\s+user\s+else\s+None',
        '# Session ID logic removed with guest mode'
    ),
    (
        r'if\s+is_guest\s+and\s+session_id:',
        'if False:  # Guest mode removed'
    ),
    
    # Упрощение user_id получения
    (
        r'user_id\s*=\s*user\.get\([\'"]id[\'"]\)\s*if\s+user\s+and\s+user\.get\([\'"]id[\'"]\)\s*!=\s*-1\s+else\s+None',
        'user_id = user.get("id") if user and user.get("id") and user.get("id") > 0 else None'
    ),
    
    # Удаление комментариев про гостей
    (
        r'#.*[Гг]ост.*',
        ''
    ),
    (
        r'#.*[Gg]uest.*',
        ''
    ),
]

def process_file(file_path: Path) -> bool:
    """Обработать один файл"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        for pattern, replacement in REPLACEMENTS:
            content = re.sub(pattern, replacement, content)
        
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            print(f"✅ Updated: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    """Главная функция"""
    bot_service = Path(__file__).parent.parent
    
    # Файлы для обработки
    files_to_process = [
        bot_service / "features" / "tts" / "tts_api.py",
        bot_service / "features" / "youtube" / "youtube_api.py",
        bot_service / "features" / "tts" / "tts_service.py",
    ]
    
    updated_count = 0
    for file_path in files_to_process:
        if file_path.exists():
            if process_file(file_path):
                updated_count += 1
        else:
            print(f"⚠️  File not found: {file_path}")
    
    print(f"\n✨ Processed {len(files_to_process)} files, updated {updated_count}")

if __name__ == "__main__":
    main()
