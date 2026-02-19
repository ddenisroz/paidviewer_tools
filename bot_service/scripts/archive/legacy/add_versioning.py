#!/usr/bin/env python3
"""
Script to add version columns to database models.
This handles the encoding issues with direct file editing.
"""
import os
import sys

# cleaned: removed corrupted comment
db_file = os.path.join(os.path.dirname(__file__), '..', 'core', 'database.py')

print("Adding versioning to " + db_file + "...")

# Read file with proper encoding
with open(db_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Models that need versioning
models_to_update = [
    ('TTSUserSettings', 'filter_mentions = Column(Boolean, nullable=False, default=False)  # Р¤РёР»СЊС‚СЂРѕРІР°С‚СЊ СѓРїРѕРјРёРЅР°РЅРёСЏ (@username)'),
    ('ChatBoxSettings', 'show_7tv_emotes = Column(Boolean, default=True)  # РџРѕРєР°Р·С‹РІР°С‚СЊ СЃРјР°Р№Р»РёРєРё 7TV'),
    ('DropsReward', 'is_active = Column(Boolean, default=True)'),
]

version_code = """
        # Versioning for race condition protection
        version = Column(Integer, default=1)  # Incremented on each update
"""

# For each model - add version column
for model_name, after_line in models_to_update:
    if model_name in content and 'version = Column(Integer, default=1)' not in content:
        # Find line and add version after it
        if after_line in content:
            new_line = after_line + '\n' + version_code
            content = content.replace(after_line, new_line)
            print("  DONE: Added versioning to " + model_name)
        else:
            print("  WARNING: Could not find insertion point for " + model_name)
    else:
        if 'version = Column(Integer, default=1)' in content:
            print("  INFO: " + model_name + " already has versioning")

# Write file with proper encoding
with open(db_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nSUCCESS: Versioning columns added!")
print("File: " + db_file)
print("\nNext step: Run Alembic migration")
print("   cd bot_service")
print("   alembic revision --autogenerate -m 'Add versioning columns'")
print("   alembic upgrade head")

