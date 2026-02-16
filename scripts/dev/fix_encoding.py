#!/usr/bin/env python3
"""Remove BOM - binary approach"""
from pathlib import Path

FILES = [
    "frontend/src/shared/components/DeleteAccountModal.tsx",
    "frontend/src/pages/InboxPage.tsx",
]

def remove_bom(filepath: Path):
    try:
        # Read as binary
        data = filepath.read_bytes()
        
        # Check and remove UTF-8 BOM (EF BB BF)
        if data.startswith(b'\xef\xbb\xbf'):
            data = data[3:]
            print(f"  Removed BOM from {filepath.name}")
        else:
            print(f"  No BOM found in {filepath.name}")
        
        # Write back
        filepath.write_bytes(data)
        
        print(f"✓ Processed: {filepath}")
        return True
    except Exception as e:
        print(f"✗ Error: {filepath} - {e}")
        return False

def main():
    base = Path(__file__).parent
    fixed = 0
    
    print("Removing BOM (binary mode)...\n")
    
    for file in FILES:
        path = base / file
        if path.exists():
            if remove_bom(path):
                fixed += 1
        else:
            print(f"✗ Not found: {path}")
    
    print(f"\n✓ Processed {fixed}/{len(FILES)} files")

if __name__ == "__main__":
    main()
