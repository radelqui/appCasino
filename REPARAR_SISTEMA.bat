@echo off
echo ========================================
echo REPARACION URGENTE DEL SISTEMA
echo Recompilando better-sqlite3 para Electron
echo ========================================
echo.

echo [1/3] Verificando directorio...
cd /d "%~dp0"
echo OK - Directorio: %CD%
echo.

echo [2/3] Recompilando modulos nativos para Electron...
echo Esto puede tomar 2-3 minutos...
echo.
npx electron-rebuild

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: No se pudo recompilar
    echo ========================================
    echo.
    echo Intentando instalar electron-rebuild...
    npm install --save-dev electron-rebuild
    echo.
    echo Reintentando compilacion...
    npx electron-rebuild

    if errorlevel 1 (
        echo.
        echo ERROR: Fallo persistente.
        echo.
        echo Por favor ejecuta manualmente:
        echo   npm install --save-dev electron-rebuild
        echo   npx electron-rebuild
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo REPARACION COMPLETADA
echo ========================================
echo.
echo [3/3] Iniciando aplicacion...
echo.

npm start

if errorlevel 1 (
    echo.
    echo ========================================
    echo ADVERTENCIA: La aplicacion no inicio
    echo ========================================
    echo.
    echo Revisa el archivo REPARAR_BETTER_SQLITE3.md
    echo para mas opciones de reparacion.
    echo.
    pause
    exit /b 1
)
