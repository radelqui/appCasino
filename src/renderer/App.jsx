import React, { useMemo } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import MesaView from './views/MesaView';
import CajaView from './views/CajaView';
import AuditoriaView from './views/AuditoriaView';
import ConfigView from './views/ConfigView';

function usePrintModeLabel() {
  // Mostramos un indicativo simple (no reactivo a .env, sólo UI)
  const mode = useMemo(() => (process.env.PRINT_MODE || 'PDF').toUpperCase(), []);
  return mode === 'ESCPOS' ? 'ESC/POS' : 'PDF';
}

export default function App() {
  const modeLabel = usePrintModeLabel();
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <div className="brand">Sistema TITO Casino</div>
          <div className="mode-badge">Modo: {modeLabel}</div>
        </header>
        <aside className="sidebar">
          <nav className="nav">
            <NavLink to="/mesa" className={({isActive}) => isActive ? 'active' : ''}>Mesa</NavLink>
            <NavLink to="/caja" className={({isActive}) => isActive ? 'active' : ''}>Caja</NavLink>
            <NavLink to="/auditoria" className={({isActive}) => isActive ? 'active' : ''}>Auditoría</NavLink>
            <NavLink to="/config" className={({isActive}) => isActive ? 'active' : ''}>Configuración</NavLink>
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/mesa" element={<MesaView />} />
            <Route path="/caja" element={<CajaView />} />
            <Route path="/auditoria" element={<AuditoriaView />} />
            <Route path="/config" element={<ConfigView />} />
            <Route path="*" element={<MesaView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
