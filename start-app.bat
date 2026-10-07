@echo off
REM ============================================================
REM  Recruitment Gorilla - one-click launcher
REM  Starts the backend API (port 5134) and the frontend dev
REM  server (port 5173), then opens the app in your browser.
REM ============================================================

setlocal
set "ROOT=%~dp0"

echo Starting Recruitment Gorilla...

REM --- Backend API (loopback only, port 5134) ---
start "Recruitment Gorilla API" cmd /k "cd /d "%ROOT%server\Recruitment.Gorilla.API" && dotnet run --urls http://localhost:5134"

REM --- Frontend (Vite dev server, fixed port 5173) ---
start "Recruitment Gorilla Web" cmd /k "cd /d "%ROOT%client" && npm run dev -- --port 5173 --strictPort"

REM --- Give the servers a moment, then open the browser ---
timeout /t 8 /nobreak >nul
start "" http://localhost:5173

echo.
echo Two windows opened (API + Web). Close them to stop the app.
endlocal
