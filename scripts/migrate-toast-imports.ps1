# Toast imports migration script
# Usage: .\scripts\migrate-toast-imports.ps1

$files = Get-ChildItem -Path "frontend/src" -Recurse -Filter "*.tsx" | 
    Where-Object { $_.FullName -notmatch "node_modules|dist|__tests__" }

$migratedCount = 0
$totalFiles = $files.Count

Write-Host "Found files to check: $totalFiles" -ForegroundColor Cyan

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    if ($content -match "import\s+\{\s*toast\s*\}\s+from\s+['""]sonner['""]") {
        $newContent = $content -replace "import\s+\{\s*toast\s*\}\s+from\s+['""]sonner['""]", "import { toast } from '@/utils/toastManager'"
        
        if ($newContent -ne $content) {
            Set-Content -Path $file.FullName -Value $newContent -NoNewline -Encoding UTF8
            $migratedCount++
            $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
            Write-Host "Migrated: $relativePath" -ForegroundColor Green
        }
    }
}

Write-Host "`nMigration completed!" -ForegroundColor Green
Write-Host "Migrated files: $migratedCount / $totalFiles" -ForegroundColor Cyan
