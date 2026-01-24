# -*- coding: utf-8 -*-
"""Remove all emoji from Python files, replacing with ASCII equivalents."""
import os
import glob
import re

# Emoji to ASCII mapping
EMOJI_MAP = {
    '📩': '[MSG]',
    '🧹': '[CLEANUP]',
    '❌': '[ERROR]',
    '🔊': '[UNMUTE]',
    '🔇': '[MUTE]',
    '🎬': '[SESSION]',
    '🚫': '[BLOCKED]',
    '🎲': '[DICE]',
    '🌍': '[LANG]',
    '✓': '[OK]',
    '✗': '[X]',
}

# Pattern to match common emoji
emoji_pattern = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\U00002700-\U000027BF"
    "\U0001F600-\U0001F64F"
    "\u2713\u2717"  # checkmarks
    "]+", 
    flags=re.UNICODE
)

def replace_emoji(text):
    """Replace emoji with ASCII equivalents."""
    for emoji, replacement in EMOJI_MAP.items():
        text = text.replace(emoji, replacement)
    # Replace any remaining emoji with empty string
    text = emoji_pattern.sub('', text)
    return text

def fix_file(filepath):
    """Fix a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        if emoji_pattern.search(content) or any(e in content for e in EMOJI_MAP.keys()):
            new_content = replace_emoji(content)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed: {os.path.relpath(filepath)}")
            return True
        return False
    except Exception as e:
        print(f"Error: {filepath}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    fixed = 0
    for filepath in glob.glob(os.path.join(base_dir, '**', '*.py'), recursive=True):
        if 'fix_all_emoji' in filepath or 'find_emoji' in filepath:
            continue
        if fix_file(filepath):
            fixed += 1
    
    print(f"\nDone! Fixed {fixed} files.")

if __name__ == '__main__':
    main()
