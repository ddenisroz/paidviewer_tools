@echo off
echo [1/2] Запускаю Chrome для отладки...
:: start "" запускает процесс независимо, чтобы консоль не висла
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDevProfile"

echo [2/2] Жду 3 секунды, пока Chrome проснется...
timeout /t 3 >nul

echo [3/3] Запускаю Codex...
:: Запускаем Codex в этой же папке
codex