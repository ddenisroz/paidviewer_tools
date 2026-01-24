# -*- coding: utf-8 -*-
"""Replace Unicode checkmark [OK] with ASCII [OK] in all Python files."""
import os
import glob

def fix_file(filepath):
    """Fix a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if '[OK]' in content:
            new_content = content.replace('[OK]', '[OK]')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pattern = os.path.join(base_dir, '**', '*.py')
    
    fixed_count = 0
    for filepath in glob.glob(pattern, recursive=True):
        if fix_file(filepath):
            fixed_count += 1
    
    print(f"\nDone! Fixed {fixed_count} files.")

if __name__ == '__main__':
    main()
