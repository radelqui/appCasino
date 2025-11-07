@echo off
REM ============================================
REM SCRIPT DE ROLLBACK A VERSIONES FUNCIONALES
REM Sistema TITO Casino - Gran Casino Sosúa
REM ============================================
REM
REM Este script restaura las versiones funcionales:
REM - Better SQLite3: v8.7.0
REM - Electron: v27.3.11
REM - Último commit funcional: d2182fd (30 oct 2025)
REM
REM ============================================

echo.
echo ========================================
echo   ROLLBACK A VERSIONES FUNCIONALES
echo ========================================
echo.
echo Este script va a:
echo 1. Restaurar package.json del commit funcional
echo 2. Reinstalar dependencias correctas
echo 3. Recompilar Better SQLite3 para Electron
echo 4. Verificar instalacion
echo.

REM Verificar que estamos en la carpeta correcta
if not exist "package.json" (
    echo ERROR: No se encuentra package.json
    echo Por favor ejecuta este script desde C:\appCasino
    pause
    exit /b 1
)

if not exist "pure\main.js" (
    echo ERROR: No se encuentra pure\main.js
    echo Por favor ejecuta este script desde C:\appCasino
    pause
    exit /b 1
)

echo Presiona cualquier tecla para continuar o Ctrl+C para cancelar...
pause >nul

echo.
echo ============================================
echo PASO 1: Restaurando package.json funcional
echo ============================================
echo.

git checkout d2182fd -- package.json package-lock.json

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: No se pudo restaurar package.json desde git
    echo.
    echo SOLUCION ALTERNATIVA:
    echo Voy a modificar package.json manualmente...
    echo.
    
    REM Crear backup del package.json actual
    copy package.json package.json.BACKUP_ANTES_ROLLBACK
    
    REM Modificar package.json para usar versiones funcionales
    powershell -Command "(Get-Content package.json) -replace '\"better-sqlite3\": \"\^12\.4\.1\"', '\"better-sqlite3\": \"^8.7.0\"' | Set-Content package.json"
    powershell -Command "(Get-Content package.json) -replace '\"electron\": \"\^33\.4\.11\"', '\"electron\": \"^27.3.11\"' | Set-Content package.json"
    
    echo ✓ package.json modificado manualmente
)

echo.
echo ============================================
echo PASO 2: Eliminando node_modules corrupto
echo ============================================
echo.

if exist "node_modules" (
    echo Eliminando carpeta node_modules...
    rmdir /s /q node_modules
    echo ✓ node_modules eliminado
) else (
    echo node_modules no existe, continuando...
)

if exist "package-lock.json" (
    echo Eliminando package-lock.json...
    del package-lock.json
    echo ✓ package-lock.json eliminado
)

echo.
echo ============================================
echo PASO 3: Instalando dependencias correctas
echo ============================================
echo.
echo Esto puede tardar 2-3 minutos...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: npm install falló
    echo Por favor revisa los errores arriba
    pause
    exit /b 1
)

echo.
echo ✓ Dependencias instaladas correctamente
echo.

echo.
echo ============================================
echo PASO 4: Recompilando Better SQLite3
echo ============================================
echo.
echo Recompilando para Electron...
echo.

call npx electron-rebuild -f -w better-sqlite3

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: electron-rebuild falló
    echo Intentando método alternativo...
    echo.
    
    call npm rebuild better-sqlite3 --runtime=electron --target=27.3.11 --disturl=https://electronjs.org/headers --abi=119
    
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Ambos métodos de rebuild fallaron
        echo Por favor revisa los errores arriba
        pause
        exit /b 1
    )
)

echo.
echo ✓ Better SQLite3 recompilado para Electron
echo.

echo.
echo ============================================
echo PASO 5: Verificando versiones instaladas
echo ============================================
echo.

echo Versiones actuales:
call npm list better-sqlite3 electron --depth=0

echo.
echo ============================================
echo ROLLBACK COMPLETADO
echo ============================================
echo.
echo Las versiones funcionales han sido restauradas:
echo   - Better SQLite3: v8.7.0
echo   - Electron: v27.3.11
echo.
echo SIGUIENTE PASO:
echo   Ejecuta: npm start
echo.
echo Si el sistema arranca correctamente:
echo   1. Verifica que todo funciona
echo   2. Haz commit de los cambios
echo.
echo Si todavía hay problemas:
echo   1. Comparte el log completo
echo   2. Revisaremos el código
echo.

pause
