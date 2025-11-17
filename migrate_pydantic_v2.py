#!/usr/bin/env python3
"""
Скрипт для автоматической миграции Pydantic V1 -> V2
"""
import re
from pathlib import Path

def migrate_file(file_path):
    """Мигрирует один файл"""
    print(f"Migrating {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. Заменяем импорты
    content = content.replace('from pydantic import BaseModel, validator', 
                             'from pydantic import BaseModel, field_validator')
    content = content.replace('from pydantic import validator', 
                             'from pydantic import field_validator')
    content = content.replace(', validator', ', field_validator')
    
    # 2. Заменяем @validator на @field_validator с @classmethod
    # Паттерн: @validator('field_name') -> @field_validator('field_name') + @classmethod
    pattern = r'(\s+)@validator\((.*?)\)\s+def\s+(\w+)\(cls,'
    replacement = r'\1@field_validator(\2)\n\1@classmethod\n\1def \3(cls,'
    content = re.sub(pattern, replacement, content)
    
    # 3. Заменяем values на info.data в теле функций
    content = content.replace("values.get('", "info.data.get('")
    content = content.replace("'secret_key' in values", "'secret_key' in info.data")
    
    # 4. Добавляем info параметр где нужно
    content = re.sub(r'def validate_\w+\(cls, v\):', 
                    lambda m: m.group(0).replace('(cls, v):', '(cls, v, info):') 
                    if 'info.data' in content else m.group(0), 
                    content)
    
    # 5. Заменяем class Config на model_config
    config_pattern = r'class Config:\s+extra = "forbid"\s+validate_assignment = True'
    config_replacement = 'model_config = ConfigDict(extra="forbid", validate_assignment=True)'
    content = re.sub(config_pattern, config_replacement, content)
    
    # Добавляем импорт ConfigDict если нужно
    if 'model_config = ConfigDict' in content and 'ConfigDict' not in content[:500]:
        content = content.replace('from pydantic import', 'from pydantic import ConfigDict,', 1)
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ {file_path} migrated")
        return True
    else:
        print(f"⏭️  {file_path} no changes needed")
        return False

def main():
    """Главная функция"""
    files_to_migrate = [
        'bot_service/features/commands/commands_api.py',
        'bot_service/api/points_api_endpoints.py',
        'bot_service/api/support_api.py',
        'bot_service/api/chatbox_api.py',
    ]
    
    migrated = 0
    for file_path in files_to_migrate:
        path = Path(file_path)
        if path.exists():
            if migrate_file(path):
                migrated += 1
        else:
            print(f"❌ {file_path} not found")
    
    print(f"\n✅ Migrated {migrated} files")

if __name__ == '__main__':
    main()
