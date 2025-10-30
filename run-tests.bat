@echo off
REM Script para ejecutar tests TDD automatizados
REM Busca errores de código ANTES de que rompan la app

echo ========================================
echo   TESTS TDD - BUSQUEDA DE ERRORES
echo ========================================
echo.

REM Ejecutar tests
echo [1/3] Ejecutando tests unitarios...
call npm test

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ TESTS FALLARON - Se encontraron errores
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ TODOS LOS TESTS PASARON
echo ========================================
echo.

REM Generar reporte de cobertura
echo [2/3] Generando reporte de cobertura...
call npm run test:coverage

echo.
echo [3/3] Reporte generado en: coverage\index.html
echo.

echo ========================================
echo   Sistema listo para producción
echo ========================================
echo.
pause
