// src/tests/componentSize.test.ts
/**
 * Property Test: Component Size Compliance (ratchet mode)
 *
 * Rules:
 * - New components must stay <= 150 code lines.
 * - Existing oversized components are tracked in baseline and must not grow.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const MAX_LINES = 150;
const BASELINE_PATH = join(process.cwd(), 'src/tests/baselines/component-size-baseline.json');
const COMPONENT_DIRS = ['src/components', 'src/features', 'src/pages', 'src/widgets'];

interface ComponentFile {
    path: string;
    lines: number;
    codeLines: number;
}

type ComponentSizeBaseline = Record<string, number>;

function normalizePath(fullPath: string): string {
    return relative(process.cwd(), fullPath).replace(/\\/g, '/');
}

function loadBaseline(): ComponentSizeBaseline {
    if (!existsSync(BASELINE_PATH)) {
        return {};
    }

    try {
        const raw = readFileSync(BASELINE_PATH, 'utf-8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'object' && parsed !== null ? (parsed as ComponentSizeBaseline) : {};
    } catch {
        return {};
    }
}

function findComponentFiles(dir: string): ComponentFile[] {
    const files: ComponentFile[] = [];

    if (!existsSync(dir)) {
        return files;
    }

    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === '__tests__' || entry.endsWith('.test')) {
                continue;
            }
            files.push(...findComponentFiles(fullPath));
            continue;
        }

        if (!entry.endsWith('.tsx') && !entry.endsWith('.jsx')) {
            continue;
        }

        if (entry.includes('.test.') || entry.includes('.spec.')) {
            continue;
        }

        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        let codeLines = 0;
        let inMultilineComment = false;
        let inImportBlock = false;
        let inTypeDefinition = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') continue;

            if (trimmed.startsWith('/*')) {
                inMultilineComment = true;
            }
            if (inMultilineComment) {
                if (trimmed.endsWith('*/')) {
                    inMultilineComment = false;
                }
                continue;
            }

            if (trimmed.startsWith('//')) continue;

            if (trimmed.startsWith('import ')) {
                inImportBlock = true;
                continue;
            }
            if (inImportBlock && (trimmed.endsWith(';') || trimmed.endsWith("';") || trimmed.endsWith('";'))) {
                inImportBlock = false;
                continue;
            }
            if (inImportBlock) continue;

            if (trimmed.startsWith('interface ') || trimmed.startsWith('type ')) {
                inTypeDefinition = true;
                continue;
            }
            if (inTypeDefinition && trimmed === '}') {
                inTypeDefinition = false;
                continue;
            }
            if (inTypeDefinition) continue;

            codeLines++;
        }

        files.push({
            path: normalizePath(fullPath),
            lines: lines.length,
            codeLines,
        });
    }

    return files;
}

describe('Component Size Compliance', () => {
    it('should enforce size limits without regressions', () => {
        const baseline = loadBaseline();
        const allFiles: ComponentFile[] = [];

        for (const dir of COMPONENT_DIRS) {
            allFiles.push(...findComponentFiles(join(process.cwd(), dir)));
        }

        const oversizedFiles = allFiles
            .filter((file) => file.codeLines > MAX_LINES)
            .sort((a, b) => a.path.localeCompare(b.path));

        const regressions = oversizedFiles.filter((file) => {
            const baselineValue = baseline[file.path];
            if (baselineValue === undefined) {
                return true; // new oversized file
            }
            return file.codeLines > baselineValue; // grew above baseline
        });

        if (regressions.length > 0) {
            console.log('\n[ERROR] Component size regressions:');
            regressions.forEach((file) => {
                const baselineValue = baseline[file.path];
                const baselineHint =
                    baselineValue === undefined ? 'new oversized file (no baseline)' : `baseline=${baselineValue}`;
                console.log(`  - ${file.path}: ${file.codeLines} code lines, ${baselineHint}`);
            });
            console.log('');
        }

        expect(regressions).toHaveLength(0);
    });

    it('should report component size statistics', () => {
        const allFiles: ComponentFile[] = [];

        for (const dir of COMPONENT_DIRS) {
            allFiles.push(...findComponentFiles(join(process.cwd(), dir)));
        }

        if (allFiles.length === 0) {
            console.log('\n[WARNING] No component files found');
            return;
        }

        const totalFiles = allFiles.length;
        const totalCodeLines = allFiles.reduce((sum, file) => sum + file.codeLines, 0);
        const averageLines = Math.round(totalCodeLines / totalFiles);
        const maxFile = allFiles.reduce((max, file) => (file.codeLines > max.codeLines ? file : max));
        const minFile = allFiles.reduce((min, file) => (file.codeLines < min.codeLines ? file : min));

        console.log('\n[INFO] Component Size Statistics:');
        console.log(`  Total components: ${totalFiles}`);
        console.log(`  Average lines: ${averageLines}`);
        console.log(`  Largest: ${maxFile.path} (${maxFile.codeLines} lines)`);
        console.log(`  Smallest: ${minFile.path} (${minFile.codeLines} lines)`);
        console.log('');

        expect(totalFiles).toBeGreaterThan(0);
    });
});
