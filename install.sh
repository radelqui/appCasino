#!/bin/bash
# install.sh - Script de instalación para producción

echo "🚀 Instalando Sistema TITO Casino..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Por favor instalar Node.js 18+ LTS"
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm no encontrado. Por favor instalar npm"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"
echo "✅ npm $(npm --version) encontrado"

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci --production

# Crear directorio de datos
mkdir -p data
mkdir -p logs

# Configurar permisos
chmod +x scripts/*.sh

# Verificar archivo de configuración
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado, copiando desde .env.example"
    cp .env.example .env
    echo "📝 Por favor editar .env con sus configuraciones"
fi

# Build para producción
echo "🔨 Construyendo aplicación..."
npm run build

echo "✅ Instalación completada"
echo ""
echo "📋 Próximos pasos:"
echo "1. Editar archivo .env con sus configuraciones"
echo "2. Configurar Supabase con el esquema de base de datos"
echo "3. Conectar hardware (impresora y lector QR)"
echo "4. Ejecutar: npm start"
echo ""
echo "📖 Ver README.md para instrucciones detalladas"
