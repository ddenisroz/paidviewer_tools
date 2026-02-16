#!/usr/bin/env python3
"""
Add version field to database models programmatically.
"""
import os

db_file = os.path.join(os.path.dirname(__file__), '..', 'core', 'database.py')

print("Reading database.py...")
with open(db_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We'll manually add version = Column(...) before created_at lines
# For each target class

output_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # For TTSUserSettings: find the line with filter_mentions and add version after some lines
    if 'class TTSUserSettings' in line:
        print("Found TTSUserSettings class")
        output_lines.append(line)
        i += 1
        
        # Copy until we find filter_mentions
        while i < len(lines) and 'filter_mentions = Column' not in lines[i]:
            output_lines.append(lines[i])
            i += 1
        
        if i < len(lines):
            output_lines.append(lines[i])  # Add filter_mentions line
            i += 1
            
            # Look ahead to find created_at
            version_added = False
            while i < len(lines) and not version_added:
                if 'created_at = Column(DateTime' in lines[i] and 'TTSUserSettings' not in ''.join(output_lines[-50:]).split('class')[-1]:
                    # Insert version before created_at
                    output_lines.append('        \n')
                    output_lines.append('        # Versioning for race condition protection\n')
                    output_lines.append('        version = Column(Integer, default=1)\n')
                    output_lines.append(lines[i])
                    version_added = True
                    print("  Added version to TTSUserSettings")
                else:
                    output_lines.append(lines[i])
                i += 1
    
    elif 'class ChatBoxSettings' in line:
        print("Found ChatBoxSettings class")
        output_lines.append(line)
        i += 1
        
        # Find until show_7tv_emotes
        while i < len(lines) and 'show_7tv_emotes = Column' not in lines[i]:
            output_lines.append(lines[i])
            i += 1
        
        if i < len(lines):
            output_lines.append(lines[i])  # Add show_7tv_emotes
            i += 1
            
            # Look ahead for created_at
            version_added = False
            while i < len(lines) and not version_added:
                if 'created_at = Column(DateTime' in lines[i]:
                    # Insert version
                    output_lines.append('    \n')
                    output_lines.append('    # Versioning for race condition protection\n')
                    output_lines.append('    version = Column(Integer, default=1)\n')
                    output_lines.append(lines[i])
                    version_added = True
                    print("  Added version to ChatBoxSettings")
                else:
                    output_lines.append(lines[i])
                i += 1
    else:
        output_lines.append(line)
        i += 1

print("Writing updated database.py...")
with open(db_file, 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("SUCCESS!")
print("\nModels updated with versioning columns:")
print("  - TTSUserSettings.version")
print("  - ChatBoxSettings.version")
print("  - DropsReward.version (already added)")

