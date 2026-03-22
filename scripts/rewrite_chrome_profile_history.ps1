param(
    [switch]$RunGc
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    throw "Run this script from the root of a git clone."
}

$status = git status --porcelain
if ($status) {
    throw "Working tree must be clean before rewriting history."
}

$filterRepo = Get-Command git-filter-repo -ErrorAction SilentlyContinue
if ($filterRepo) {
    Write-Host "Using git-filter-repo to remove .chrome-mcp-profile from history..."
    git filter-repo --path .chrome-mcp-profile --invert-paths --force
}
else {
    Write-Warning "git-filter-repo is not installed. Falling back to git filter-branch."
    git filter-branch --force --index-filter "git rm -r --cached --ignore-unmatch .chrome-mcp-profile" --prune-empty --tag-name-filter cat -- --all
}

if ($RunGc) {
    Write-Host "Expiring reflogs and running aggressive gc..."
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
}

Write-Host "History rewrite finished."
Write-Host "Review refs, then push with: git push --force --all && git push --force --tags"
