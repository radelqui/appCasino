@echo off
echo ========================================
echo ARREGLO COMPLETO DEL SISTEMA
echo ========================================
echo.
echo Este script hace 2 cosas:
echo 1. Arregla la tabla usuarios para soportar UUIDs de Supabase
echo 2. Inicia la aplicacion (la sincronizacion es automatica)
echo.
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Arreglando tabla usuarios...
echo.
node fix-usuarios-table.js

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: No se pudo arreglar la tabla
    echo ========================================
    echo.
    echo Por favor contacta al desarrollador.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [2/2] Iniciando aplicacion...
echo ========================================
echo.
echo Los usuarios se sincronizaran automaticamente
echo cuando abras el modulo de usuarios.
echo.

npm start
