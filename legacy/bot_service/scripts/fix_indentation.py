#!/usr/bin/env python3
"""Fix indentation issues in database.py - remove extra spaces from version columns"""

import os
import re

db_file = os.path.join(os.path.dirname(__file__), '..', 'core', 'database.py')

print("Reading database.py...")
with open(db_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all instances of "        version" (8 spaces) with "    version" (4 spaces)
# This fixes the indentation issue
original_count = content.count('        version = Column(Integer, default=1)')
content = content.replace('        version = Column(Integer, default=1)', '    version = Column(Integer, default=1)')
fixed_count = original_count

# Also fix the comment lines before version
content = content.replace('        # Versioning for race condition protection', '    # Versioning for race condition protection')

print(f"Fixed {fixed_count} indentation issues")

print("Writing updated database.py...")
with open(db_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS! All indentation fixed.")

# Verify
try:
    from core.database import User
    print("✓ Database module imports successfully!")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

