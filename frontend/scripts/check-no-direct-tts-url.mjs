import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const FORBIDDEN_PATTERNS = ['F5_TTS_SERVICE_URL', 'VITE_TTS_SERVICE_URL'];

const shouldSkip = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/__tests__/')
    || normalized.includes('/tests/')
    || normalized.endsWith('.test.ts')
    || normalized.endsWith('.test.tsx')
    || normalized.endsWith('.spec.ts')
    || normalized.endsWith('.spec.tsx')
  );
};

const walk = (dirPath, accumulator) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, accumulator);
      continue;
    }
    if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    if (shouldSkip(fullPath)) {
      continue;
    }
    accumulator.push(fullPath);
  }
};

const files = [];
walk(SRC_DIR, files);

const violations = [];
for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (line.includes(pattern)) {
        violations.push(`${path.relative(process.cwd(), filePath)}:${index + 1}: ${pattern}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Direct TTS service URL usage is forbidden in runtime frontend code:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('No forbidden direct TTS URL usage found in runtime frontend code.');

