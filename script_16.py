# Paso 17: Crear App.js principal y archivo de configuración
import os

# Crear App.js principal
app_js = '''// src/renderer/App.js
import React, { useState, useEffect } from 'react';
import MesaApp from './components/Mesa/MesaApp';
import CajaApp from './components/Caja/CajaApp';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('mesa'); // 'mesa' o 'caja'
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Detectar cambios de conectividad
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detectar modo basado en parámetros URL o configuración
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'caja') {
      setCurrentView('caja');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  return (
    <div className="app">
      {/* Navigation Bar */}
      <nav className="app-nav">
        <div className="nav-content">
          <div className="nav-brand">
            <span className="brand-icon">🎰</span>
            <span className="brand-text">Sistema TITO</span>
          </div>
          
          <div className="nav-controls">
            <button 
              className={`nav-btn ${currentView === 'mesa' ? 'active' : ''}`}
              onClick={() => handleViewChange('mesa')}
            >
              🎫 Mesa
            </button>
            <button 
              className={`nav-btn ${currentView === 'caja' ? 'active' : ''}`}
              onClick={() => handleViewChange('caja')}
            >
              💰 Caja
            </button>
          </div>
          
          <div className="nav-status">
            <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
              <div className="status-dot"></div>
              <span>{isOnline ? 'Conectado' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="app-content">
        {currentView === 'mesa' ? <MesaApp /> : <CajaApp />}
      </div>
    </div>
  );
}

export default App;
'''

with open('tito-casino-system/src/renderer/App.js', 'w') as f:
    f.write(app_js)

# Crear App.css
app_css = '''/* src/renderer/App.css */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a202c;
}

/* Navigation */
.app-nav {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  z-index: 1000;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
}

.brand-icon {
  font-size: 1.5rem;
}

.nav-controls {
  display: flex;
  gap: 0.5rem;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: translateY(-1px);
}

.nav-btn.active {
  background: rgba(66, 153, 225, 0.3);
  color: #63b3ed;
  border-color: rgba(99, 179, 237, 0.5);
}

.nav-status {
  display: flex;
  align-items: center;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.connection-status.online {
  color: #68d391;
}

.connection-status.offline {
  color: #fc8181;
}

.connection-status .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.connection-status.online .status-dot {
  background: #68d391;
}

.connection-status.offline .status-dot {
  background: #fc8181;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Main Content */
.app-content {
  flex: 1;
  overflow: hidden;
}

/* Responsive */
@media (max-width: 768px) {
  .nav-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .nav-controls {
    order: 2;
  }
  
  .nav-status {
    order: 3;
  }
  
  .nav-btn {
    flex: 1;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .app-nav {
    padding: 0.5rem;
  }
  
  .brand-text {
    display: none;
  }
  
  .nav-btn {
    padding: 0.5rem;
    font-size: 0.8rem;
  }
}

/* Scrollbars */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Focus styles for accessibility */
.nav-btn:focus {
  outline: 2px solid #63b3ed;
  outline-offset: 2px;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .app {
    background: #000;
  }
  
  .app-nav {
    background: #222;
    border-color: #555;
  }
  
  .nav-btn {
    background: #333;
    border-color: #666;
    color: #fff;
  }
}
'''

with open('tito-casino-system/src/renderer/App.css', 'w') as f:
    f.write(app_css)

# Crear index.js
index_js = '''// src/renderer/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'''

with open('tito-casino-system/src/renderer/index.js', 'w') as f:
    f.write(index_js)

# Crear index.css
index_css = '''/* src/renderer/index.css */

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #1a202c;
  color: #e2e8f0;
  overflow: hidden;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Global utility classes */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.text-center {
  text-align: center;
}

.text-left {
  text-align: left;
}

.text-right {
  text-align: right;
}

.font-bold {
  font-weight: 700;
}

.font-semibold {
  font-weight: 600;
}

.font-medium {
  font-weight: 500;
}

/* Animation utilities */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Selection styles */
::selection {
  background: rgba(99, 179, 237, 0.3);
  color: white;
}

/* Focus styles for better accessibility */
:focus {
  outline: 2px solid #63b3ed;
  outline-offset: 2px;
}

/* Print styles */
@media print {
  body {
    background: white;
    color: black;
  }
}
'''

with open('tito-casino-system/src/renderer/index.css', 'w') as f:
    f.write(index_css)

print("✅ Aplicación React principal creada")