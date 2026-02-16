@echo off
setlocal enabledelayedexpansion

set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_PROFILE=C:\ChromeDevProfile"
set "DEBUG_HOST=127.0.0.1"
set "DEBUG_PORT=9222"
set "MAX_ATTEMPTS=10"
set "EXIT_CODE=0"

echo [1/4] Starting Chrome with remote debugging...
start "" "%CHROME_EXE%" --remote-debugging-port=%DEBUG_PORT% --user-data-dir="%CHROME_PROFILE%"

echo [2/4] Waiting 3 seconds for Chrome startup...
timeout /t 3 >nul

echo [3/4] Checking %DEBUG_HOST%:%DEBUG_PORT% availability...
set /a ATTEMPT=0

:wait_debug_port
set /a ATTEMPT+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = New-Object Net.Sockets.TcpClient; try { $ar = $c.BeginConnect('%DEBUG_HOST%', %DEBUG_PORT%, $null, $null); if (-not $ar.AsyncWaitHandle.WaitOne(2000)) { exit 1 }; $c.EndConnect($ar); exit 0 } catch { exit 1 } finally { $c.Close() }"

if not errorlevel 1 goto debug_port_ready
if !ATTEMPT! GEQ %MAX_ATTEMPTS% goto debug_port_failed

echo [WAIT] Attempt !ATTEMPT!/%MAX_ATTEMPTS%: debug port is not ready yet...
timeout /t 1 >nul
goto wait_debug_port

:debug_port_ready
echo [OK] Chrome debug port is ready.
goto run_codex

:debug_port_failed
echo [WARN] Could not reach %DEBUG_HOST%:%DEBUG_PORT% after %MAX_ATTEMPTS% attempts.
echo [WARN] Continuing anyway.

:run_codex
echo [4/4] Starting Codex...
codex
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Codex exited with code %EXIT_CODE%.
    echo Press any key to close this window...
    pause >nul
)

endlocal & exit /b %EXIT_CODE%
