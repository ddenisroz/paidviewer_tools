#!/usr/bin/env node
/**
 * Design System Checker
 * Проверяет соответствие кода Design System правилам
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Правила проверки
const RULES = {
  // Произвольные значения (arbitrary values)
  arbitraryValues: {
    pattern: /className.*?["'`][^"'`]*\[([\d.]+)(px|rem|em|%)[^\]]*\]/g,
    message: 'Использование произвольных значений. Используйте стандартные Tailwind классы',
    severity: 'warning',
    exclude: ['min-h-', 'max-h-', 'min-w-', 'max-w-', 'z-'] // Исключения
  },
  
  // Нестандартные размеры кнопок
  buttonSizes: {
    pattern: /Button.*className.*h-(?!8|10|12|9)(\d+)/g,
    message: 'Нестандартный размер кнопки. Используйте h-8, h-9, h-10 или h-12',
    severity: 'error'
  },
  
  // Нестандартные размеры input
  inputSizes: {
    pattern: /Input.*className.*h-(?!8|9|11)(\d+)/g,
    message: 'Нестандартный размер input. Используйте h-8, h-9 или h-11',
    severity: 'warning'
  },
  
  // Hardcoded цвета вместо CSS переменных
  hardcodedColors: {
    pattern: /className.*?(bg|text|border)-(?!slate|gray|red|green|blue|yellow|purple|pink|indigo|primary|secondary|accent|muted|destructive|foreground|background|card|popover|border|input|ring)/g,
    message: 'Использование hardcoded цветов. Используйте CSS переменные темы',
    severity: 'info'
  },
  
  // Inline styles вместо Tailwind
  inlineStyles: {
    pattern: /style=\{\{[^}]*(?:padding|margin|gap|width|height|fontSize):/g,
    message: 'Использование inline styles. Используйте Tailwind классы',
    severity: 'warning'
  }
};

// Цвета для вывода
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  for (const [ruleName, rule] of Object.entries(RULES)) {
    const matches = content.matchAll(rule.pattern);
    
    for (const match of matches) {
      // Проверяем исключения
      if (rule.exclude) {
        const shouldExclude = rule.exclude.some(exc => match[0].includes(exc));
        if (shouldExclude) continue;
      }
      
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1];
      
      issues.push({
        file: filePath,
        line: lineNumber,
        rule: ruleName,
        severity: rule.severity,
        message: rule.message,
        code: line.trim()
      });
    }
  }
  
  return issues;
}

function formatIssue(issue) {
  const severityColor = {
    error: 'red',
    warning: 'yellow',
    info: 'blue'
  }[issue.severity];
  
  const severity = colorize(issue.severity.toUpperCase().padEnd(7), severityColor);
  const location = colorize(`${issue.file}:${issue.line}`, 'gray');
  
  return `${severity} ${location}\n  ${issue.message}\n  ${colorize(issue.code, 'gray')}\n`;
}

function main() {
  console.log(colorize('\n🎨 Design System Checker\n', 'blue'));
  
  // Находим все файлы для проверки
  const files = glob.sync('frontend/src/**/*.{tsx,jsx}', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/ui/**' // Исключаем базовые UI компоненты
    ]
  });
  
  console.log(colorize(`Проверка ${files.length} файлов...\n`, 'gray'));
  
  let totalIssues = 0;
  const issuesBySeverity = { error: 0, warning: 0, info: 0 };
  
  for (const file of files) {
    const issues = checkFile(file);
    
    if (issues.length > 0) {
      totalIssues += issues.length;
      
      for (const issue of issues) {
        issuesBySeverity[issue.severity]++;
        console.log(formatIssue(issue));
      }
    }
  }
  
  // Итоговая статистика
  console.log(colorize('─'.repeat(80), 'gray'));
  console.log(colorize('\n📊 Статистика:\n', 'blue'));
  console.log(`  ${colorize('Ошибки:', 'red')}      ${issuesBySeverity.error}`);
  console.log(`  ${colorize('Предупреждения:', 'yellow')} ${issuesBySeverity.warning}`);
  console.log(`  ${colorize('Информация:', 'blue')}    ${issuesBySeverity.info}`);
  console.log(`  ${colorize('Всего:', 'gray')}        ${totalIssues}\n`);
  
  if (totalIssues === 0) {
    console.log(colorize('✅ Все проверки пройдены!\n', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('⚠️  Найдены проблемы. См. docs/DESIGN_SYSTEM.md\n', 'yellow'));
    process.exit(issuesBySeverity.error > 0 ? 1 : 0);
  }
}

// Запуск
try {
  main();
} catch (error) {
  console.error(colorize(`\n❌ Ошибка: ${error.message}\n`, 'red'));
  process.exit(1);
}
