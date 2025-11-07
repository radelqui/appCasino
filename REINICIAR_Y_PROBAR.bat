@echo off
echo ============================================
echo REINICIAR APP Y PROBAR FIX
echo ============================================
echo.

echo [1/3] Matando procesos Electron y Node...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Limpiando cache de Node...
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo [3/3] Iniciando aplicacion con codigo actualizado...
echo.
echo ============================================
echo IMPORTANTE:
echo ============================================
echo 1. La app se iniciara en 3 segundos
echo 2. Genera un NUEVO ticket desde Mesa
echo 3. Valida ese NUEVO ticket en Caja
echo 4. NO uses codigos viejos (ej: PREV-3683507)
echo ============================================
echo.
timeout /t 3 /nobreak

start cmd /c "npm start"

echo.
echo App reiniciada con exito
echo.
pause
