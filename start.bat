@echo off
  taskkill /F /IM chrome.exe >nul 2>nul
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-
  dir="%LOCALAPPDATA%\ChromeDevProfileMCP" --new-window "http://localhost:5173"