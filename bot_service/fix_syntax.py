import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Добавляем except для блока try
lines = content.split('\n')
new_lines = []

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # Если это строка с pass и следующая строка пустая, добавляем except
    if 'pass' in line and i + 1 < len(lines) and lines[i + 1].strip() == '':
        new_lines.append('                except Exception as e:')
        new_lines.append('                    logger.error(f"Error processing VK token {token.user_id}: {e}")')

with open('main.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))
print('Added missing except block')
