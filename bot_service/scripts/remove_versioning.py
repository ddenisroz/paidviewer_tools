#!/usr/bin/env python3
"""Remove broken versioning columns from database.py"""

import os

db_file = os.path.join(os.path.dirname(__file__), '..', 'core', 'database.py')

print("Reading database.py...")
with open(db_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove any line containing version = Column
new_lines = []
skip_next_empty = False

for i, line in enumerate(lines):
    # Skip versioning lines
    if 'version = Column(Integer, default=1)' in line:
        print(f"Removing: {line.strip()}")
        skip_next_empty = True
        continue
    # Skip versioning comment
    if '# Versioning for race condition protection' in line:
        print(f"Removing: {line.strip()}")
        continue
    # Skip empty line after versioning comment
    if skip_next_empty and line.strip() == '':
        skip_next_empty = False
        continue

    new_lines.append(line)

print("\nWriting cleaned database.py...")
with open(db_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS! All versioning removed.")

