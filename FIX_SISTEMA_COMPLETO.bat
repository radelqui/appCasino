@echo off
echo ================================================================
echo FIX COMPLETO DEL SISTEMA - Eliminar bloqueos
echo ================================================================
echo.

echo [1/6] Deteniendo procesos Electron...
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul
echo      OK
echo.

echo [2/6] Rebuild de better-sqlite3...
call npm rebuild better-sqlite3
if %errorlevel% neq 0 (
    echo      ERROR: Rebuild fallo
    pause
    exit /b 1
)
echo      OK
echo.

echo [3/6] Ejecutando health check...
node tests/system-health-check.js
if %errorlevel% neq 0 (
    echo      ATENCION: Hay problemas detectados
    echo.
    echo ================================================================
    echo ACCION REQUERIDA:
    echo ================================================================
    echo.
    echo 1. Abrir Supabase Dashboard:
    echo    https://supabase.com/dashboard
    echo.
    echo 2. Ir a SQL Editor
    echo.
    echo 3. Ejecutar estos archivos SQL (en orden):
    echo.
    echo    a) SqulInstrucciones/fix-audit-log-constraint.sql
    echo       (Fix para evitar errores de sincronizacion)
    echo.
    echo    b) SqulInstrucciones/fix-auth-users-UPDATE-ONLY.sql
    echo       (Fix para usuarios que no pueden hacer login)
    echo.
    echo    c) SqulInstrucciones/fix-admin-casino-com.sql
    echo       (Fix para admin@casino.com si aun falla)
    echo.
    echo 4. Despues de ejecutar los SQL, ejecutar este script de nuevo
    echo.
    echo ================================================================
    pause
) else (
    echo      OK - Sistema saludable
)
echo.

echo [4/6] Verificando usuarios de Auth...
node test-login-all-users.js
echo.

echo [5/6] Limpiando archivos temporales...
del /q nul 2>nul
echo      OK
echo.

echo ================================================================
echo FIX COMPLETADO
echo ================================================================
echo.
echo Puedes iniciar la app con: npm start
echo.
pause
