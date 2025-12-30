#!/usr/bin/env node
/**
 * Design System Migration Tool
 * Автоматически мигрирует компоненты на Design System
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Правила миграции
const MIGRATIONS = {
  // Размеры кнопок
  buttonSizes: [
    { from: /className="([^"]*?)h-11([^"]*?)"/g, to: 'className="$1h-10$2"', desc: 'Button h-11 → h-10' },
    { from: /className="([^"]*?)h-9([^"]*?)"/g, to: 'className="$1h-10$2"', desc: 'Button h-9 → h-10 (если это кнопка)' },
  ],
  
  // Произвольные ширины Select
  selectWidths: [
    { from: /w-\[180px\]/g, to: 'w-44', desc: 'w-[180px] → w-44 (176px)' },
    { from: /w-\[200px\]/g, to: 'w-48', desc: 'w-[200px] → w-48 (192px)' },
    { from: /w-\[160px\]/g, to: 'w-40', desc: 'w-[160px] → w-40 (160px)' },
    { from: /w-\[140px\]/g, to: 'w-36', desc: 'w-[140px] → w-36 (144px)' },
    { from: /w-\[120px\]/g, to: 'w-32', desc: 'w-[120px] → w-32 (128px)' },
  ],
  
  // Произвольные минимальные ширины
  minWidths: [
    { from: /min-w-\[180px\]/g, to: 'min-w-44', desc: 'min-w-[180px] → min-w-44' },
    { from: /min-w-\[160px\]/g, to: 'min-w-40', desc: 'min-w-[160px] → min-w-40' },
    { from: /min-w-\[120px\]/g, to: 'min-w-32', desc: 'min-w-[120px] → min-w-32' },
  ],
  
  // Произвольные gap значения
  gaps: [
    { from: /gap-\[17px\]/g, to: 'gap-4', desc: 'gap-[17px] → gap-4 (16px)' },
    { from: /gap-\[13px\]/g, to: 'gap-3', desc: 'gap-[13px] → gap-3 (12px)' },
  ],
  
  // Произвольные padding значения
  paddings: [
    { from: /p-\[13px\]/g, to: 'p-3', desc: 'p-[13px] → p-3 (12px)' },
    { from: /p-\[17px\]/g, to: 'p-4', desc: 'p-[17px] → p-4 (16px)' },
  ],
};

// Цвета для вывода
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function migrateFile(filePath, dryRun = true) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const changes = [];
  
  // Применяем все миграции
  for (const [category, rules] of Object.entries(MIGRATIONS)) {
    for (const rule of rules) {
      const matches = content.match(rule.from);
      if (matches) {
        content = content.replace(rule.from, rule.to);
        changes.push({
          category,
          description: rule.desc,
          count: matches.length
        });
      }
    }
  }
  
  // Если были изменения
  if (content !== originalContent) {
    if (!dryRun) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    
    return {
      file: filePath,
      changes,
      modified: true
    };
  }
  
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const targetPath = args.find(arg => !arg.startsWith('--')) || 'frontend/src/components';
  
  console.log(colorize('\n[MIGRATE] Design System Migration Tool\n', 'cyan'));
  
  if (dryRun) {
    console.log(colorize('[DRY RUN] No files will be modified', 'yellow'));
    console.log(colorize('   Use --apply to actually modify files\n', 'gray'));
  } else {
    console.log(colorize('[APPLY] Files will be modified\n', 'green'));
  }
  
  // Находим все файлы для миграции
  const files = glob.sync(`${targetPath}/**/*.{tsx,jsx}`, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/ui/**', // Исключаем базовые UI компоненты
      '**/examples/**' // Исключаем примеры
    ]
  });
  
  console.log(colorize(`Проверка ${files.length} файлов...\n`, 'gray'));
  
  const results = [];
  let totalChanges = 0;
  
  for (const file of files) {
    const result = migrateFile(file, dryRun);
    if (result) {
      results.push(result);
      totalChanges += result.changes.reduce((sum, c) => sum + c.count, 0);
    }
  }
  
  // Выводим результаты
  if (results.length === 0) {
    console.log(colorize('[OK] Все файлы уже соответствуют Design System!\n', 'green'));
    process.exit(0);
  }
  
  console.log(colorize('[CHANGES] Найденные изменения:\n', 'blue'));
  
  for (const result of results) {
    console.log(colorize(`  ${result.file}`, 'cyan'));
    for (const change of result.changes) {
      console.log(colorize(`    • ${change.description} (${change.count}x)`, 'gray'));
    }
    console.log();
  }
  
  // Итоговая статистика
  console.log(colorize('─'.repeat(80), 'gray'));
  console.log(colorize('\n[STATS] Статистика:\n', 'blue'));
  console.log(`  ${colorize('Файлов изменено:', 'cyan')} ${results.length}`);
  console.log(`  ${colorize('Всего изменений:', 'cyan')} ${totalChanges}\n`);
  
  if (dryRun) {
    console.log(colorize('[TIP] Чтобы применить изменения, запустите:', 'yellow'));
    console.log(colorize(`   node scripts/migrate-to-design-system.js --apply\n`, 'gray'));
  } else {
    console.log(colorize('[OK] Миграция завершена!\n', 'green'));
    console.log(colorize('[TIP] Рекомендуется:', 'yellow'));
    console.log(colorize('   1. Проверить изменения: git diff', 'gray'));
    console.log(colorize('   2. Запустить проверку: npm run check:design', 'gray'));
    console.log(colorize('   3. Протестировать приложение\n', 'gray'));
  }
}

// Запуск
try {
  main();
} catch (error) {
  console.error(colorize(`\n[ERROR] Ошибка: ${error.message}\n`, 'red'));
  console.error(error.stack);
  process.exit(1);
}
