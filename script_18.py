# Paso 19: Crear archivo HTML base y scripts finales
import os

# Crear directorio public si no existe
os.makedirs('tito-casino-system/public', exist_ok=True)

# Crear index.html para la app React
index_html = '''<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Sistema TITO para Casino - Ticket In Ticket Out" />
    <meta name="author" content="Sistema TITO" />
    
    <!-- Preload critical fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    
    <title>Sistema TITO Casino</title>
    
    <!-- Critical CSS inline para mejor rendimiento -->
    <style>
      /* Minimal critical CSS */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      html, body, #root {
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        background: #1a202c;
        color: #e2e8f0;
        line-height: 1.5;
      }
      
      /* Loading spinner mientras carga React */
      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        flex-direction: column;
        gap: 1rem;
      }
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top: 4px solid #63b3ed;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .loading-text {
        color: #cbd5e0;
        font-size: 1.1rem;
        font-weight: 500;
      }
      
      /* Hide loading when React loads */
      #root:not(:empty) + .loading {
        display: none;
      }
    </style>
  </head>
  <body>
    <noscript>
      <div style="text-align: center; padding: 2rem; color: #e2e8f0;">
        <h1>🚫 JavaScript Requerido</h1>
        <p>Esta aplicación requiere JavaScript para funcionar correctamente.</p>
        <p>Por favor, habilite JavaScript en su navegador.</p>
      </div>
    </noscript>
    
    <!-- React App Container -->
    <div id="root"></div>
    
    <!-- Loading fallback -->
    <div class="loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Cargando Sistema TITO...</div>
    </div>
    
    <!-- Service Worker registration (if needed in production) -->
    <script>
      // Registro de Service Worker para mejor rendimiento en producción
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
              console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
              console.log('SW registration failed: ', registrationError);
            });
        });
      }
    </script>
  </body>
</html>
'''

with open('tito-casino-system/public/index.html', 'w') as f:
    f.write(index_html)

# Crear manifest.json para PWA capabilities
manifest_json = '''{
  "short_name": "TITO Casino",
  "name": "Sistema TITO Casino",
  "description": "Sistema de Ticket-In Ticket-Out para casino",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#1a202c",
  "background_color": "#1a202c",
  "orientation": "landscape-primary"
}
'''

with open('tito-casino-system/public/manifest.json', 'w') as f:
    f.write(manifest_json)

# Crear scripts de instalación y despliegue
install_script = '''#!/bin/bash
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
'''

with open('tito-casino-system/install.sh', 'w') as f:
    f.write(install_script)

# Hacer ejecutable el script
import stat
os.chmod('tito-casino-system/install.sh', stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH)

# Crear script de desarrollo
dev_script = '''#!/bin/bash
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
'''

with open('tito-casino-system/dev.sh', 'w') as f:
    f.write(dev_script)

os.chmod('tito-casino-system/dev.sh', stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH)

print("✅ Archivos HTML, scripts y configuración final creados")