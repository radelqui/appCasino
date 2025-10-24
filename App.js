// src/renderer/App.js
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
