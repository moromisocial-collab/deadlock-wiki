@echo off
REM Zip the arranged public/ tree. Tries tar first, PowerShell as fallback.
setlocal
set ROOT=%~dp0deadlock-extract\arranged
set ZIP=%~dp0deadlock-public-images.zip
set ERR=%~dp0deadlock-extract\_zip_errors.txt

if exist "%ZIP%" del /f /q "%ZIP%"
if exist "%ERR%" del /f /q "%ERR%"

echo [1] trying tar ...
pushd "%ROOT%"
tar -a -c -f "%ZIP%" public 2>>"%ERR%"
popd

for %%F in ("%ZIP%") do set SIZE=%%~zF
if not "%SIZE%"=="" if %SIZE% GTR 10000 goto ok

echo [2] tar produced nothing usable, trying PowerShell ...
if exist "%ZIP%" del /f /q "%ZIP%"
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { Compress-Archive -Path (Join-Path '%ROOT%' 'public') -DestinationPath '%ZIP%' -Force; 'ps ok' } catch { $_ | Out-String | Add-Content '%ERR%' }"

for %%F in ("%ZIP%") do set SIZE=%%~zF
if not "%SIZE%"=="" if %SIZE% GTR 10000 goto ok

echo FAILED. See "%ERR%"
if exist "%ERR%" type "%ERR%"
goto end

:ok
echo.
echo DONE. Archive size: %SIZE% bytes
echo %SIZE% > "%~dp0deadlock-extract\_zip_size.txt"

:end
echo.
pause
