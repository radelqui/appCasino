# Paso 13: Crear componente React para Mesa
import os

# Crear directorio para componentes React si no existe
os.makedirs('tito-casino-system/src/renderer/components/Mesa', exist_ok=True)
os.makedirs('tito-casino-system/src/renderer/components/Caja', exist_ok=True)
os.makedirs('tito-casino-system/src/renderer/components/Common', exist_ok=True)
os.makedirs('tito-casino-system/src/renderer/services', exist_ok=True)

mesa_app_js = '''// src/renderer/components/Mesa/MesaApp.js
import React, { useState, useEffect } from 'react';
import './MesaApp.css';

const { ipcRenderer } = window.require('electron');

function MesaApp() {
  // Estado del componente
  const [formData, setFormData] = useState({
    valor: '',
    moneda: 'DOP',
    mesa_id: 1,
    usuario_emision: 'Mesa1'
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'
  const [stats, setStats] = useState({
    total_emitidos: 0,
    valor_total_dop: 0,
    valor_total_usd: 0
  });

  // Efecto para cargar estadísticas al iniciar
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  /**
   * Carga estadísticas de tickets
   */
  const loadStats = async () => {
    try {
      const result = await ipcRenderer.invoke('get-stats', {
        dateFrom: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
        dateTo: new Date().toISOString()
      });
      
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  /**
   * Maneja cambios en el formulario
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'valor' ? value : 
              name === 'mesa_id' ? parseInt(value) : value
    }));
  };

  /**
   * Valida el formulario antes de enviar
   */
  const validateForm = () => {
    const { valor, moneda } = formData;
    
    if (!valor || valor.trim() === '') {
      throw new Error('Por favor ingrese un valor');
    }
    
    const numericValue = parseFloat(valor);
    if (isNaN(numericValue)) {
      throw new Error('El valor debe ser un número válido');
    }
    
    if (numericValue <= 0) {
      throw new Error('El valor debe ser mayor que cero');
    }
    
    if (numericValue > 50000) {
      throw new Error('El valor máximo permitido es 50,000');
    }
    
    if (!moneda || !['DOP', 'USD'].includes(moneda)) {
      throw new Error('Moneda inválida');
    }
    
    return numericValue;
  };

  /**
   * Maneja la generación de tickets
   */
  const handleGenerateTicket = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      // Validar formulario
      const numericValue = validateForm();
      
      // Preparar datos del ticket
      const ticketData = {
        ...formData,
        valor: numericValue,
        usuario_emision: `Mesa${formData.mesa_id}`
      };
      
      setMessage('Generando ticket...');
      setMessageType('info');
      
      // Enviar a proceso principal
      const result = await ipcRenderer.invoke('generate-ticket', ticketData);
      
      if (result.success) {
        setMessage(
          `✅ Ticket ${result.ticket_number} generado exitosamente\\n` +
          `Valor: ${result.moneda} $${result.valor.toFixed(2)}`
        );
        setMessageType('success');
        
        // Limpiar formulario
        setFormData(prev => ({
          ...prev,
          valor: ''
        }));
        
        // Actualizar estadísticas
        setTimeout(loadStats, 1000);
        
      } else {
        setMessage(`❌ Error: ${result.error}`);
        setMessageType('error');
      }
      
    } catch (error) {
      console.error('Error generando ticket:', error);
      setMessage(`❌ Error: ${error.message}`);
      setMessageType('error');
      
    } finally {
      setLoading(false);
      
      // Limpiar mensaje después de 5 segundos si es exitoso
      if (messageType === 'success') {
        setTimeout(() => {
          setMessage('');
        }, 5000);
      }
    }
  };

  /**
   * Maneja el envío del formulario (Enter)
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) {
      handleGenerateTicket();
    }
  };

  /**
   * Sincronización manual
   */
  const handleSync = async () => {
    try {
      setMessage('Sincronizando...');
      setMessageType('info');
      
      const result = await ipcRenderer.invoke('force-sync');
      
      if (result.success) {
        setMessage('✅ Sincronización completada');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ Error de sincronización: ${result.error}`);
        setMessageType('error');
      }
      
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      setMessageType('error');
    }
  };

  return (
    <div className="mesa-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Sistema TITO - Mesa {formData.mesa_id}</h1>
          <div className="header-actions">
            <button 
              className="sync-btn"
              onClick={handleSync}
              disabled={loading}
              title="Sincronizar con servidor"
            >
              🔄 Sync
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-value">{stats.total_emitidos}</div>
          <div className="stat-label">Tickets Emitidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">RD$ {stats.valor_total_dop?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Total DOP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">US$ {stats.valor_total_usd?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Total USD</div>
        </div>
      </div>

      {/* Main Form */}
      <main className="app-main">
        <div className="form-container">
          <form onSubmit={handleSubmit} className="ticket-form">
            
            {/* Mesa Selection */}
            <div className="form-group">
              <label htmlFor="mesa_id">Mesa:</label>
              <select 
                id="mesa_id"
                name="mesa_id"
                value={formData.mesa_id}
                onChange={handleInputChange}
                disabled={loading}
                className="form-control"
              >
                <option value={1}>Mesa 1</option>
                <option value={2}>Mesa 2</option>
                <option value={3}>Mesa 3</option>
              </select>
            </div>

            {/* Currency Selection */}
            <div className="form-group">
              <label htmlFor="moneda">Moneda:</label>
              <select 
                id="moneda"
                name="moneda"
                value={formData.moneda}
                onChange={handleInputChange}
                disabled={loading}
                className="form-control"
              >
                <option value="DOP">DOP (Pesos Dominicanos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>

            {/* Value Input */}
            <div className="form-group">
              <label htmlFor="valor">Valor del Ticket:</label>
              <div className="value-input-container">
                <span className="currency-symbol">
                  {formData.moneda === 'DOP' ? 'RD$' : 'US$'}
                </span>
                <input
                  type="number"
                  id="valor"
                  name="valor"
                  value={formData.valor}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  min="0"
                  max="50000"
                  step="0.01"
                  disabled={loading}
                  className="form-control value-input"
                  autoFocus
                />
              </div>
              <small className="form-help">
                Ingrese el valor entre 0.01 y 50,000.00
              </small>
            </div>

            {/* Generate Button */}
            <div className="form-group">
              <button 
                type="submit"
                className={`generate-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Generando...
                  </>
                ) : (
                  '🎫 Generar e Imprimir Ticket'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`message message-${messageType}`}>
            <div className="message-content">
              {message.split('\\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="instructions">
          <h3>Instrucciones:</h3>
          <ol>
            <li>Seleccione la mesa correspondiente</li>
            <li>Elija la moneda (DOP o USD)</li>
            <li>Ingrese el valor del ticket</li>
            <li>Presione "Generar e Imprimir Ticket" o Enter</li>
            <li>Entregue el ticket impreso al cliente</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

export default MesaApp;
'''

with open('tito-casino-system/src/renderer/components/Mesa/MesaApp.js', 'w') as f:
    f.write(mesa_app_js)

print("✅ Componente React para Mesa creado")