#!/usr/bin/env node

/**
 * Script to help identify and document exhaustive-deps warnings
 * Run with: node fix-exhaustive-deps.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Analyzing exhaustive-deps warnings...\n');

try {
    // Run lint and capture output
    const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    
    // Parse warnings
    const lines = lintOutput.split('\n');
    const warnings = [];
    let currentFile = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect file path
        if (line.includes('.tsx') || line.includes('.ts')) {
            const match = line.match(/([A-Z]:\\.*?\.tsx?)/);
            if (match) {
                currentFile = match[1];
            }
        }
        
        // Detect exhaustive-deps warning
        if (line.includes('exhaustive-deps') && currentFile) {
            const lineMatch = line.match(/(\d+):(\d+)/);
            if (lineMatch) {
                const lineNum = parseInt(lineMatch[1]);
                const col = parseInt(lineMatch[2]);
                
                warnings.push({
                    file: currentFile.split('\\').pop(),
                    fullPath: currentFile,
                    line: lineNum,
                    col: col,
                    message: line.trim()
                });
            }
        }
    }
    
    // Group by file
    const byFile = {};
    warnings.forEach(w => {
        if (!byFile[w.file]) {
            byFile[w.file] = [];
        }
        byFile[w.file].push(w);
    });
    
    // Print summary
    console.log(`📊 Found ${warnings.length} exhaustive-deps warnings in ${Object.keys(byFile).length} files:\n`);
    
    Object.entries(byFile).forEach(([file, warns]) => {
        console.log(`\n📄 ${file} (${warns.length} warnings):`);
        warns.forEach(w => {
            console.log(`   Line ${w.line}: ${w.message.substring(0, 100)}...`);
        });
    });
    
    // Write detailed report
    const report = {
        total: warnings.length,
        files: Object.keys(byFile).length,
        details: byFile
    };
    
    fs.writeFileSync('exhaustive-deps-report.json', JSON.stringify(report, null, 2));
    console.log('\n\n✅ Detailed report saved to exhaustive-deps-report.json');
    
} catch (error) {
    // Lint will exit with error code if there are warnings
    console.log('Lint completed with warnings (expected)');
}
