@echo off
echo Starting XBRCH Platform Local Server...
echo.
echo Opening your browser in 3 seconds...
echo.
timeout /t 3 /nobreak > nul
echo.
echo Server running at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
python -m http.server 8000 --bind 0.0.0.0
pause
