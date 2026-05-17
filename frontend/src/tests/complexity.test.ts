// src/tests/complexity.test.ts
// Feature: frontend-typescript-linting, Property 4: Cyclomatic Complexity Compliance (ratchet mode)

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const MAX_COMPLEXITY = 15;
const SRC_DIR = path.join(process.cwd(), 'src');
const BASELINE_PATH = path.join(process.cwd(), 'src/tests/baselines/complexity-baseline.json');

type ComplexityBaseline = Record<string, number>;

interface ComplexityViolation {
    file: string;
    line: number;
    actual: number;
    message: string;
}

function normalizeFilePath(filePath: string): string {
    return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function loadBaseline(): ComplexityBaseline {
    if (!fs.existsSync(BASELINE_PATH)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(BASELINE_PATH, 'utf-8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'object' && parsed !== null ? (parsed as ComplexityBaseline) : {};
    } catch {
        return {};
    }
}

function runComplexityLint(): ComplexityViolation[] {
    const command = `npx eslint "${SRC_DIR}/**/*.{ts,tsx}" --rule "complexity: [error, ${MAX_COMPLEXITY}]" --format json`;

    let stdout = '';
    try {
        stdout = execSync(command, {
            encoding: 'utf-8',
            stdio: 'pipe',
            maxBuffer: 50 * 1024 * 1024,
        });
    } catch (error) {
        const err = error as { stdout?: string; stderr?: string };
        if (!err.stdout) {
            throw new Error(`ESLint execution failed: ${err.stderr || 'Unknown error'}`);
        }
        stdout = err.stdout;
    }

    let results: Array<{
        filePath: string;
        messages: Array<{
            message: string;
            line: number;
            ruleId: string;
        }>;
    }> = [];

    try {
        const start = stdout.indexOf('[');
        const end = stdout.lastIndexOf(']');
        if (start === -1 || end === -1 || end < start) {
            throw new Error('JSON payload boundaries not found');
        }
        const payload = stdout.slice(start, end + 1);
        results = JSON.parse(payload);
    } catch (error) {
        const preview = stdout.slice(0, 400).replace(/\n/g, '\\n');
        throw new Error(
            `Failed to parse ESLint JSON output for complexity check: ${String(error)}; preview=${preview}`
        );
    }

    const violations: ComplexityViolation[] = [];

    for (const result of results) {
        const file = normalizeFilePath(result.filePath);
        for (const msg of result.messages || []) {
            if (msg.ruleId !== 'complexity') {
                continue;
            }

            const match = /complexity of (\d+)/i.exec(msg.message || '');
            const actual = match ? Number(match[1]) : MAX_COMPLEXITY + 1;

            violations.push({
                file,
                line: msg.line,
                actual,
                message: msg.message,
            });
        }
    }

    return violations;
}

describe('Cyclomatic Complexity Compliance', () => {
    it('should enforce complexity limits without regressions', () => {
        const baseline = loadBaseline();
        const violations = runComplexityLint();

        const regressions = violations.filter((violation) => {
            const baselineValue = baseline[violation.file];
            if (baselineValue === undefined) {
                return true; // new file/function above threshold
            }
            return violation.actual > baselineValue; // above recorded technical debt
        });

        if (regressions.length > 0) {
            const grouped = new Map<string, ComplexityViolation[]>();
            for (const violation of regressions) {
                if (!grouped.has(violation.file)) {
                    grouped.set(violation.file, []);
                }
                grouped.get(violation.file)?.push(violation);
            }

            console.log('\n[ERROR] Complexity regressions detected:');
            for (const [file, fileViolations] of grouped) {
                const baselineValue = baseline[file];
                const baselineHint =
                    baselineValue === undefined
                        ? 'no baseline (new high-complexity file)'
                        : `baseline=${baselineValue}`;
                console.log(`  ${file} (${baselineHint})`);
                for (const v of fileViolations) {
                    console.log(`    Line ${v.line}: actual=${v.actual}; ${v.message}`);
                }
            }
            console.log('');
        }

        expect(regressions).toHaveLength(0);
    }, 180000);

    it('should have helper modules extracted for complex logic', () => {
        const helperFiles = [
            'src/features/chatbox/utils/chatboxHelpers.ts',
            'src/features/chat/utils/scrollHelpers.ts',
            'src/features/chat/utils/chatHistoryHelpers.ts',
            'src/features/drops/utils/lootboxAnimationHelpers.ts',
            'src/shared/utils/platformHelpers.ts',
            'src/features/chat/utils/messageFilterHelpers.ts',
            'src/features/drops/utils/rarityHelpers.ts',
        ];

        const missingHelpers = helperFiles.filter((helperFile) => !fs.existsSync(path.join(process.cwd(), helperFile)));
        expect(missingHelpers).toEqual([]);
    });

    it('should use early returns to reduce nesting', () => {
        const platformHelpersPath = path.join(SRC_DIR, 'shared/utils/platformHelpers.ts');

        if (fs.existsSync(platformHelpersPath)) {
            const content = fs.readFileSync(platformHelpersPath, 'utf-8');
            const hasEarlyReturns = /if\s*\([^)]+\)\s*return/.test(content);
            expect(hasEarlyReturns).toBe(true);
        }
    });
});
