@echo off
echo ========================================
echo SINCRONIZACION DE USUARIOS
echo Supabase -^> SQLite
echo ========================================
echo.

REM Configurar Service Role Key
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYWd2bm5hbWFicmpwdG92enlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI5NDk1MiwiZXhwIjoyMDc2ODcwOTUyfQ.3EZrcFg-o6RCl_LRmhRpYn0mUYsHW4Ovg2zm1phYRrw

REM Ejecutar script de sincronización
node scripts\sync-users-supabase-to-sqlite.js

echo.
echo ========================================
echo Presiona cualquier tecla para salir...
pause >nul
