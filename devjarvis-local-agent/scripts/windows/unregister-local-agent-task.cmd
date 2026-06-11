@echo off
setlocal EnableExtensions

schtasks /Delete /TN "DevJarvisLocalAgent" /F
