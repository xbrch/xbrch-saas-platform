@echo off
echo 🚀 Opening XBRCH Platform Pages Directly...
echo.

cd /d "%~dp0"

echo 📱 Opening main pages...
echo.

start "" "demo.html"
start "" "index.html"
start "" "admin-dashboard\login.html"
start "" "admin-dashboard\register.html"
start "" "admin-dashboard\index.html"
start "" "admin-dashboard\broadcast.html"
start "" "admin-dashboard\analytics.html"
start "" "public\broadcast-wall.html"

echo.
echo ✅ All pages opened in browser tabs!
echo.
echo 📝 Test these features:
echo    - Language translator (EN/AF/NL)
echo    - Font size controls (A-/A+)
echo    - Modern #F4F2ED/#2FA8E7 design
echo    - No icons, big text
echo.
echo 🌐 If pages show "file:///" URL, they're working locally!
echo.
pause
