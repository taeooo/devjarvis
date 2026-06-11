@echo off
setlocal EnableExtensions

echo Checking DevJarvis Local Agent...
curl http://127.0.0.1:17997/health

echo.
echo Checking local screen reader...
curl http://127.0.0.1:17997/internal/local-ocr/health

echo.
echo Checking local reasoning runtime...
curl http://127.0.0.1:17997/internal/local-llm/health
