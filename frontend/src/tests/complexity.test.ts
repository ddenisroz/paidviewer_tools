// src/tests/complexity.test.ts
// Feature: frontend-typescript-linting, Property 4: Cyclomatic Complexity Compliance
// Validates: Requirements 2.4, 3.2

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property 4: Cyclomatic Complexity Compliance
 * 
 * For any function in the frontend codebase, the cyclomatic complexity SHALL not exceed 15.
 * 
 * This test validates that all functions maintain acceptable complexity levels by:
 * 1. Running ESLint with complexity rules
 * 2. Parsing the output for complexity violations
 * 3. Ensuring no functions exceed the threshold
 */

describe('Cyclomatic Complexity Compliance', () => {
    const MAX_COMPLEXITY = 15;
    const SRC_DIR = path.join(process.cwd(), 'src');

    it('should have no functions with complexity > 15', () => {
        try {
            // Run ESLint with complexity rule
            // This will throw if there are any violations
            execSync(
                `npx eslint "${SRC_DIR}/**/*.{ts,tsx}" --rule "complexity: [error, ${MAX_COMPLEXITY}]" --format json`,
                { encoding: 'utf-8', stdio: 'pipe' }
            );
            
            // If we get here, no violations were found
            expect(true).toBe(true);
        } catch (error) {
            const err = error as { stdout?: string; stderr?: string };
            
            if (err.stdout) {
                try {
                    const results = JSON.parse(err.stdout);
                    const violations: Array<{
                        filePath: string;
                        messages: Array<{
                            message: string;
                            line: number;
                            column: number;
                            ruleId: string;
                        }>;
                    }> = results;
                    
                    // Filter for complexity violations
                    const complexityViolations = violations
                        .filter(result => result.messages.length > 0)
                        .map(result => ({
                            file: path.relative(process.cwd(), result.filePath),
                            violations: result.messages
                                .filter(msg => msg.ruleId === 'complexity')
                                .map(msg => ({
                                    line: msg.line,
                                    message: msg.message
                                }))
                        }))
                        .filter(result => result.violations.length > 0);
                    
                    if (complexityViolations.length > 0) {
                        const violationSummary = complexityViolations
                            .map(v => `\n  ${v.file}:\n    ${v.violations.map(viol => `Line ${viol.line}: ${viol.message}`).join('\n    ')}`)
                            .join('\n');
                        
                        throw new Error(
                            `Found ${complexityViolations.length} file(s) with complexity violations:${violationSummary}\n\n` +
                            `All functions must have cyclomatic complexity <= ${MAX_COMPLEXITY}`
                        );
                    }
                } catch (parseError) {
                    // If we can't parse the output, fail with the original error
                    throw new Error(`ESLint complexity check failed: ${err.stderr || err.stdout || 'Unknown error'}`);
                }
            }
            
            // If no stdout, something else went wrong
            throw new Error(`ESLint execution failed: ${err.stderr || 'Unknown error'}`);
        }
    });

    it('should have helper functions extracted for complex logic', () => {
        // Verify that helper files exist
        const helperFiles = [
            'utils/chatboxHelpers.ts',
            'utils/scrollHelpers.ts',
            'utils/chatHistoryHelpers.ts',
            'utils/lootboxAnimationHelpers.ts',
            'utils/platformHelpers.ts',
            'utils/messageFilterHelpers.ts',
            'utils/rarityHelpers.ts'
        ];
        
        const missingHelpers: string[] = [];
        
        helperFiles.forEach(helperFile => {
            const fullPath = path.join(SRC_DIR, helperFile);
            if (!fs.existsSync(fullPath)) {
                missingHelpers.push(helperFile);
            }
        });
        
        expect(missingHelpers).toEqual([]);
    });

    it('should use early returns to reduce nesting', () => {
        // Sample check: verify that our helper functions use early returns
        const platformHelpersPath = path.join(SRC_DIR, 'utils/platformHelpers.ts');
        
        if (fs.existsSync(platformHelpersPath)) {
            const content = fs.readFileSync(platformHelpersPath, 'utf-8');
            
            // Check that functions have early returns (basic heuristic)
            // Look for pattern: if (...) return;
            const hasEarlyReturns = /if\s*\([^)]+\)\s*return/.test(content);
            
            expect(hasEarlyReturns).toBe(true);
        }
    });
});
