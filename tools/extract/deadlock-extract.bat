@echo off
REM ============================================================
REM  Deadlock icon extractor  (Deadlock-jp.wiki)
REM  1. downloads Source2Viewer CLI 20.0 from the official
REM     ValveResourceFormat GitHub release
REM  2. decompiles the panorama image folders out of pak01_dir.vpk
REM  3. writes PNGs to  Downloads\deadlock-extract\game-images\
REM  Nothing is installed, nothing outside this folder is touched.
REM ============================================================
setlocal
set BASE=%~dp0deadlock-extract
set VPK=C:\Program Files (x86)\Steam\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk
set OUT=%BASE%\game-images
set CLI=%BASE%\tool\Source2Viewer-CLI.exe
set LOG=%BASE%\_log.txt
set URL=https://github.com/ValveResourceFormat/ValveResourceFormat/releases/download/20.0/cli-windows-x64.zip

if not exist "%BASE%" mkdir "%BASE%"
cd /d "%BASE%"
echo === Deadlock image extract === > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"

if not exist "%VPK%" (
  echo VPK not found: "%VPK%"
  echo VPK not found >> "%LOG%"
  goto fail
)

if not exist "%CLI%" (
  echo [1/4] Downloading Source2Viewer CLI ...
  curl.exe -L --fail -o "%BASE%\cli.zip" "%URL%" >> "%LOG%" 2>&1
  if errorlevel 1 goto fail
  if not exist "%BASE%\tool" mkdir "%BASE%\tool"
  tar -xf "%BASE%\cli.zip" -C "%BASE%\tool" >> "%LOG%" 2>&1
  if errorlevel 1 goto fail
) else (
  echo [1/4] CLI already present, skipping download.
)

if not exist "%CLI%" (
  echo Source2Viewer-CLI.exe not found. Contents of tool folder: >> "%LOG%"
  dir /s /b "%BASE%\tool" >> "%LOG%" 2>&1
  echo Source2Viewer-CLI.exe not found - see _log.txt
  goto fail
)

echo [2/4] Recording --help ...
"%CLI%" --help > "%BASE%\_help.txt" 2>&1

echo [3/4] Extracting images ... (a few minutes)
echo ---- items >> "%LOG%"
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/items" --vpk_decompile >> "%LOG%" 2>&1
echo ---- upgrades >> "%LOG%"
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/upgrades" --vpk_decompile >> "%LOG%" 2>&1
echo ---- hud/abilities >> "%LOG%"
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/hud/abilities" --vpk_decompile >> "%LOG%" 2>&1
echo ---- hud/icons >> "%LOG%"
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/hud/icons" --vpk_decompile >> "%LOG%" 2>&1
echo ---- heroes >> "%LOG%"
"%CLI%" -i "%VPK%" -o "%OUT%" --vpk_filepath "panorama/images/heroes" --vpk_decompile >> "%LOG%" 2>&1

echo [4/4] Counting ...
dir /s /b "%OUT%\*.png" 2>nul | find /c /v "" > "%BASE%\_count.txt"
dir /s /b "%OUT%" > "%BASE%\_filelist.txt" 2>&1
echo.
echo DONE. PNG count:
type "%BASE%\_count.txt"
goto end

:fail
echo.
echo FAILED - see "%LOG%"

:end
echo.
echo You can close this window.
pause
