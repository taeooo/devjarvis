@echo off
setlocal enabledelayedexpansion

set BASE_URL=http://127.0.0.1:17997
set OLLAMA_URL=http://127.0.0.1:11434
set DESKTOP_DIR=%~dp0..\..\..\devjarvis-desktop
set FAILED=0

echo [DevJarvis] Local Assistant smoke check

echo.
echo [1/5] Local Agent /health
curl -fsS %BASE_URL%/health >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

echo.
echo [2/5] Local OCR health
curl -fsS %BASE_URL%/internal/local-ocr/health >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

echo.
echo [3/5] Local LLM health
curl -fsS %BASE_URL%/internal/local-llm/health >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

echo.
echo [4/5] Local STT health
curl -fsS %BASE_URL%/internal/local-stt/health >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

echo.
echo [5/5] Ollama tags
curl -fsS %OLLAMA_URL%/api/tags >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

echo.
echo [CSP] Checking Local Agent connect-src entries
findstr /C:"http://127.0.0.1:17997" "%DESKTOP_DIR%\index.html" "%DESKTOP_DIR%\src-tauri\tauri.conf.json" >nul || set FAILED=1
findstr /C:"http://localhost:17997" "%DESKTOP_DIR%\index.html" "%DESKTOP_DIR%\src-tauri\tauri.conf.json" >nul || set FAILED=1
if !FAILED! EQU 0 (echo OK) else (echo FAILED)

if !FAILED! NEQ 0 (
  echo.
  echo Local Assistant smoke check failed.
  exit /b 1
)

echo.
echo Local Assistant smoke check passed.
exit /b 0
