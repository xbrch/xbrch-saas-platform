@echo off
echo Starting XBRCH Platform Server...
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo Starting server...
python -m http.server 8000
echo.
echo Server stopped.
pause
