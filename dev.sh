#!/bin/bash
# dev.sh - Script para desarrollo

echo "🛠️  Iniciando entorno de desarrollo..."

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo "📝 Creando archivo .env desde template..."
    cp .env.example .env
fi

# Iniciar en modo desarrollo
echo "🚀 Iniciando aplicación en modo desarrollo..."
echo "📱 React: http://localhost:3000"
echo "🖥️  Electron: Se abrirá automáticamente"
echo ""

# Ejecutar concurrentemente React y Electron
npm run electron-dev
