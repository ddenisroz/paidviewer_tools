# scripts/start_all.ps1
Write-Host "=== Starting TTS TTV Project ===" -ForegroundColor Cyan

# 1. Start Backend Server
Write-Host "Launching Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {cd bot_service; if (Test-Path .venv) { .\.venv\Scripts\activate } elseif (Test-Path ..\.venv) { ..\.venv\Scripts\activate } else { Write-Host 'Warning: Venv not found in . or ..' -ForegroundColor Red }; python main.py}"

# 2. Start Frontend Client
Write-Host "Launching Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {cd frontend; npm run dev}"

Write-Host ""
Write-Host "✅ Services started in separate windows." -ForegroundColor Green
Write-Host "👉 Open http://localhost:5173 to use the bot." -ForegroundColor Cyan
