import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

let totalReplacements = 0;
let filesModified = 0;

// Функция для рекурсивного обхода директорий
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if ((file.endsWith('.js') || file.endsWith('.jsx')) && !file.includes('.test.')) {
      callback(filePath);
    }
  });
}

// Функция для замены console.log на logger.log
function replaceConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Пропускаем файлы которые уже используют logger
    if (content.includes("import { logger }") || content.includes("from '@/utils/prodLogger'") || 
        content.includes("from '../utils/prodLogger'") || content.includes("from '../../utils/prodLogger'")) {
      return 0;
    }
    
    // Пропускаем утилиты логирования
    if (filePath.includes('logger.js') || filePath.includes('prodLogger.js')) {
      return 0;
    }
    
    let replacements = 0;
    
    // Заменяем различные варианты console методов
    // console.log -> logger.log
    const consoleLogRegex = /console\.log\(/g;
    const consoleLogMatches = content.match(consoleLogRegex);
    if (consoleLogMatches) {
      replacements += consoleLogMatches.length;
      content = content.replace(consoleLogRegex, 'logger.log(');
    }
    
    // console.error -> logger.error
    const consoleErrorRegex = /console\.error\(/g;
    const consoleErrorMatches = content.match(consoleErrorRegex);
    if (consoleErrorMatches) {
      replacements += consoleErrorMatches.length;
      content = content.replace(consoleErrorRegex, 'logger.error(');
    }
    
    // console.warn -> logger.warn
    const consoleWarnRegex = /console\.warn\(/g;
    const consoleWarnMatches = content.match(consoleWarnRegex);
    if (consoleWarnMatches) {
      replacements += consoleWarnMatches.length;
      content = content.replace(consoleWarnRegex, 'logger.warn(');
    }
    
    // console.info -> logger.info
    const consoleInfoRegex = /console\.info\(/g;
    const consoleInfoMatches = content.match(consoleInfoRegex);
    if (consoleInfoMatches) {
      replacements += consoleInfoMatches.length;
      content = content.replace(consoleInfoRegex, 'logger.info(');
    }
    
    // console.debug -> logger.debug
    const consoleDebugRegex = /console\.debug\(/g;
    const consoleDebugMatches = content.match(consoleDebugRegex);
    if (consoleDebugMatches) {
      replacements += consoleDebugMatches.length;
      content = content.replace(consoleDebugRegex, 'logger.debug(');
    }
    
    // console.table -> logger.table
    const consoleTableRegex = /console\.table\(/g;
    const consoleTableMatches = content.match(consoleTableRegex);
    if (consoleTableMatches) {
      replacements += consoleTableMatches.length;
      content = content.replace(consoleTableRegex, 'logger.table(');
    }
    
    if (replacements > 0) {
      // Добавляем импорт логгера в начало файла если его нет
      if (!content.includes("import { logger }")) {
        // Определяем правильный path для импорта
        const relativeDepth = filePath.split(path.sep).length - srcDir.split(path.sep).length - 1;
        const importPath = '../'.repeat(relativeDepth) + 'utils/prodLogger';
        
        // Добавляем импорт после других импортов
        if (content.includes('import ')) {
          // Находим последний импорт
          const lastImportIndex = content.lastIndexOf('import ');
          const endOfLastImport = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, endOfLastImport + 1) + `import { logger } from '${importPath}';\n` + content.slice(endOfLastImport + 1);
        } else if (content.includes('const ') || content.includes('function ') || content.includes('class ')) {
          // Если нет импортов, добавляем в начало файла
          content = `import { logger } from '${importPath}';\n\n${content}`;
        }
      }
      
      fs.writeFileSync(filePath, content, 'utf-8');
      return replacements;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
  }
  
  return 0;
}

// Запускаем обход и замену
console.log('[START] Starting console.log replacement...\n');

walkDir(srcDir, (filePath) => {
  const replacements = replaceConsoleLogs(filePath);
  if (replacements > 0) {
    const relativePath = path.relative(srcDir, filePath);
    console.log(`[OK] ${relativePath}: ${replacements} replacements`);
    totalReplacements += replacements;
    filesModified++;
  }
});

console.log(`\n[DONE] Complete! Total: ${totalReplacements} replacements in ${filesModified} files`);
