#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ СѓРґР°Р»РµРЅРёСЏ РіРѕСЃС‚РµРІРѕРіРѕ СЂРµР¶РёРјР° РёР· РєРѕРґРѕРІРѕР№ Р±Р°Р·С‹.
Р—Р°РјРµРЅСЏРµС‚ РїР°С‚С‚РµСЂРЅС‹ РіРѕСЃС‚РµРІРѕР№ Р»РѕРіРёРєРё РЅР° СѓРїСЂРѕС‰РµРЅРЅС‹Рµ РІРµСЂСЃРёРё С‚РѕР»СЊРєРѕ РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.
"""

import re
from pathlib import Path

# РџР°С‚С‚РµСЂРЅС‹ РґР»СЏ Р·Р°РјРµРЅС‹
REPLACEMENTS = [
    # РЈРґР°Р»РµРЅРёРµ is_guest РїСЂРѕРІРµСЂРѕРє
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
    
    # РЈРїСЂРѕС‰РµРЅРёРµ user_id РїРѕР»СѓС‡РµРЅРёСЏ
    (
        r'user_id\s*=\s*user\.get\([\'"]id[\'"]\)\s*if\s+user\s+and\s+user\.get\([\'"]id[\'"]\)\s*!=\s*-1\s+else\s+None',
        'user_id = user.get("id") if user and user.get("id") and user.get("id") > 0 else None'
    ),
    
    # РЈРґР°Р»РµРЅРёРµ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ РїСЂРѕ РіРѕСЃС‚РµР№
    (
        r'#.*[Р“Рі]РѕСЃС‚.*',
        ''
    ),
    (
        r'#.*[Gg]uest.*',
        ''
    ),
]

def process_file(file_path: Path) -> bool:
    """РћР±СЂР°Р±РѕС‚Р°С‚СЊ РѕРґРёРЅ С„Р°Р№Р»"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        for pattern, replacement in REPLACEMENTS:
            content = re.sub(pattern, replacement, content)
        
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            print(f" Updated: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"[ERROR] Error processing {file_path}: {e}")
        return False

def main():
    """Р“Р»Р°РІРЅР°СЏ С„СѓРЅРєС†РёСЏ"""
    bot_service = Path(__file__).parent.parent
    
    # Р¤Р°Р№Р»С‹ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё
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
            print(f"вљ пёЏ  File not found: {file_path}")
    
    print(f"\n Processed {len(files_to_process)} files, updated {updated_count}")

if __name__ == "__main__":
    main()
