# -*- coding: utf-8 -*-
"""Find and list all files with emoji characters."""
import os
import glob
import re

# Pattern to match common emoji ranges
emoji_pattern = re.compile(
    "["
    "\U0001F300-\U0001F9FF"  # Misc Symbols, Emoticons, etc
    "\U00002700-\U000027BF"  # Dingbats  
    "\U0001F600-\U0001F64F"  # Emoticons
    "]+", 
    flags=re.UNICODE
)

def find_emoji_in_file(filepath):
    """Find lines with emoji in a file."""
    lines_with_emoji = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f, 1):
                if emoji_pattern.search(line):
                    lines_with_emoji.append((i, line.strip()[:80]))
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return lines_with_emoji

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    
    print("Searching for emoji in Python files...")
    
    for filepath in glob.glob(os.path.join(parent_dir, '**', '*.py'), recursive=True):
        if 'find_emoji' in filepath:
            continue
        results = find_emoji_in_file(filepath)
        if results:
            rel_path = os.path.relpath(filepath, parent_dir)
            print(f"\n{rel_path}:")
            for line_num, text in results[:5]:  # Show first 5
                print(f"  L{line_num}: {text}")

if __name__ == '__main__':
    main()
