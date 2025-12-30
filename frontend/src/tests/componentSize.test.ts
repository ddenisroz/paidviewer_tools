// src/tests/componentSize.test.ts
/**
 * Property Test: Component Size Compliance
 * Feature: frontend-typescript-linting, Property 3: Component Size Compliance
 * Validates: Requirements 2.3, 3.1
 * 
 * This test verifies that all React component files do not exceed 150 lines of code
 * (excluding imports, comments, and type definitions).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const MAX_LINES = 150;
const COMPONENT_DIRS = [
    'src/components',
    'src/features',
    'src/pages',
    'src/widgets'
];

interface ComponentFile {
    path: string;
    lines: number;
    codeLines: number;
}

/**
 * Recursively find all .tsx and .jsx files in a directory
 */
function findComponentFiles(dir: string, baseDir: string = dir): ComponentFile[] {
    const files: ComponentFile[] = [];
    
    try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip node_modules and test directories
                if (entry === 'node_modules' || entry === '__tests__' || entry.endsWith('.test')) {
                    continue;
                }
                files.push(...findComponentFiles(fullPath, baseDir));
            } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
                // Skip test files
                if (entry.includes('.test.') || entry.includes('.spec.')) {
                    continue;
                }
                
                const content = readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                const totalLines = lines.length;
                
                // Count code lines (excluding imports, comments, empty lines, and type definitions)
                let codeLines = 0;
                let inMultilineComment = false;
                let inImportBlock = false;
                let inTypeDefinition = false;
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    // Skip empty lines
                    if (trimmed === '') continue;
                    
                    // Handle multiline comments
                    if (trimmed.startsWith('/*')) {
                        inMultilineComment = true;
                    }
                    if (inMultilineComment) {
                        if (trimmed.endsWith('*/')) {
                            inMultilineComment = false;
                        }
                        continue;
                    }
                    
                    // Skip single-line comments
                    if (trimmed.startsWith('//')) continue;
                    
                    // Skip import statements
                    if (trimmed.startsWith('import ')) {
                        inImportBlock = true;
                        continue;
                    }
                    if (inImportBlock && (trimmed.endsWith(';') || trimmed.endsWith("';") || trimmed.endsWith('";'))) {
                        inImportBlock = false;
                        continue;
                    }
                    if (inImportBlock) continue;
                    
                    // Skip type/interface definitions (but count their content)
                    if (trimmed.startsWith('interface ') || trimmed.startsWith('type ')) {
                        inTypeDefinition = true;
                        continue;
                    }
                    if (inTypeDefinition && trimmed === '}') {
                        inTypeDefinition = false;
                        continue;
                    }
                    if (inTypeDefinition) continue;
                    
                    // Count this as a code line
                    codeLines++;
                }
                
                const relativePath = fullPath.replace(baseDir + '/', '');
                files.push({
                    path: relativePath,
                    lines: totalLines,
                    codeLines
                });
            }
        }
    } catch (error) {
        // Directory might not exist, skip it
        console.warn(`Warning: Could not read directory ${dir}:`, error);
    }
    
    return files;
}

describe('Component Size Compliance', () => {
    // Feature: frontend-typescript-linting, Property 3: Component Size Compliance
    it('should ensure all components are under 150 lines of code', () => {
        const allFiles: ComponentFile[] = [];
        
        // Collect all component files from all directories
        for (const dir of COMPONENT_DIRS) {
            const fullPath = join(process.cwd(), dir);
            allFiles.push(...findComponentFiles(fullPath, fullPath));
        }
        
        // Find files that exceed the limit
        const oversizedFiles = allFiles.filter(file => file.codeLines > MAX_LINES);
        
        // Report oversized files
        if (oversizedFiles.length > 0) {
            console.log('\n❌ Components exceeding 150 lines:');
            oversizedFiles.forEach(file => {
                console.log(`  - ${file.path}: ${file.codeLines} lines (${file.lines} total)`);
            });
            console.log('');
        } else {
            console.log('\n✅ All components are under 150 lines of code');
        }
        
        // The test passes if no files exceed the limit
        expect(oversizedFiles).toHaveLength(0);
    });
    
    it('should report component size statistics', () => {
        const allFiles: ComponentFile[] = [];
        
        // Collect all component files
        for (const dir of COMPONENT_DIRS) {
            const fullPath = join(process.cwd(), dir);
            allFiles.push(...findComponentFiles(fullPath, fullPath));
        }
        
        if (allFiles.length === 0) {
            console.log('\n⚠️  No component files found');
            return;
        }
        
        // Calculate statistics
        const totalFiles = allFiles.length;
        const totalCodeLines = allFiles.reduce((sum, file) => sum + file.codeLines, 0);
        const averageLines = Math.round(totalCodeLines / totalFiles);
        const maxFile = allFiles.reduce((max, file) => file.codeLines > max.codeLines ? file : max);
        const minFile = allFiles.reduce((min, file) => file.codeLines < min.codeLines ? file : min);
        
        console.log('\n📊 Component Size Statistics:');
        console.log(`  Total components: ${totalFiles}`);
        console.log(`  Average lines: ${averageLines}`);
        console.log(`  Largest: ${maxFile.path} (${maxFile.codeLines} lines)`);
        console.log(`  Smallest: ${minFile.path} (${minFile.codeLines} lines)`);
        console.log('');
        
        // This test always passes, it's just for reporting
        expect(totalFiles).toBeGreaterThan(0);
    });
});
