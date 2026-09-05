@echo off
REM Follow-up: the one manifest entry that lives outside the five folders
REM already extracted (panorama/images/npcs/vanguard_aoe_buff).
setlocal
set BASE=%~dp0deadlock-extract
set VPK=C:\Program Files (x86)\Steam\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk
set OUT=%BASE%\game-images
set CLI=%BASE%\tool\Source2Viewer-CLI.exe

if not exist "%CLI%" (
  echo Run deadlock-extract.bat first.
  pause
  exit /b 1
)

echo Extracting panorama/images/npcs ...
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/npcs" --vpk_decompile >> "%BASE%\_log.txt" 2>&1

dir /s /b "%OUT%\*.png" 2>nul | find /c /v "" > "%BASE%\_count.txt"
dir /s /b "%OUT%" > "%BASE%\_filelist.txt" 2>&1
echo.
echo DONE. PNG count:
type "%BASE%\_count.txt"
echo.
echo You can close this window.
pause
