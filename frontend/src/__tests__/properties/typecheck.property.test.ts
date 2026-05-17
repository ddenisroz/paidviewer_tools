// Feature: frontend-typescript-linting, Property 1: Zero Compilation Errors
// Validates: Requirements 1.1, 2.1, 5.2

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Property 1: Zero Compilation Errors', () => {
    it('should have zero TypeScript compilation errors with strict mode enabled', { timeout: 90000 }, () => {
        try {
            // Run TypeScript compiler in no-emit mode
            const output = execSync('npx tsc --noEmit', {
                cwd: process.cwd(),
                encoding: 'utf-8',
                stdio: 'pipe',
                timeout: 90000,
            });

            // If we get here, tsc succeeded (exit code 0)
            expect(output).toBeDefined();
        } catch (error) {
            // tsc failed with errors
            const err = error as { stdout?: string; stderr?: string; status?: number };
            const errorOutput = err.stdout || err.stderr || '';

            // Count the number of errors
            const errorLines = errorOutput.split('\n').filter((line) => line.includes('error TS'));
            const errorCount = errorLines.length;

            // Fail the test with detailed information
            expect.fail(
                `TypeScript compilation failed with ${errorCount} errors.\n\n` +
                    `First 10 errors:\n${errorLines.slice(0, 10).join('\n')}\n\n` +
                    `Run 'npm run type-check' to see all errors.`
            );
        }
    });

    it('should have strict mode enabled in tsconfig.json', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs') as typeof import('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path') as typeof import('path');

        const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
        const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');

        // Simple check - just look for the strict settings in the file
        expect(tsconfigContent).toContain('"strict": true');
        expect(tsconfigContent).toContain('"strictNullChecks": true');
        expect(tsconfigContent).toContain('"noImplicitAny": true');
    }, 10000); // 10 seconds timeout
});
