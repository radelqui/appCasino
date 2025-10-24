# Paso 15: Crear componente React para Caja
import os

caja_app_js = '''// src/renderer/components/Caja/CajaApp.js
import React, { useState, useEffect, useRef } from 'react';
import './CajaApp.css';

const { ipcRenderer } = window.require('electron');

function CajaApp() {
  // Estado del componente
  const [ticketData, setTicketData] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [stats, setStats] = useState({
    total_canjeados: 0,
    valor_canjeado_dop: 0,
    valor_canjeado_usd: 0
  });

  // Referencias
  const inputRef = useRef(null);

  // Efectos
  useEffect(() => {
    // Mantener foco en input para recibir datos del lector QR
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Listener para escaneos QR del proceso principal
    const handleQRScan = (event, scanResult) => {
      console.log('QR escaneado desde hardware:', scanResult);
      handleQRInput(scanResult.data);
    };

    ipcRenderer.on('qr-scanned', handleQRScan);

    // Cargar estadísticas
    loadStats();
    const interval = setInterval(loadStats, 30000);

    return () => {
      ipcRenderer.removeListener('qr-scanned', handleQRScan);
      clearInterval(interval);
    };
  }, []);

  /**
   * Carga estadísticas de caja
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
   * Maneja la entrada de QR (teclado o hardware)
   */
  const handleQRInput = async (qrString) => {
    if (!qrString || qrString.trim() === '') return;
    
    setLoading(true);
    setMessage('Validando ticket...');
    setMessageType('info');
    setTicketData(null);

    try {
      const result = await ipcRenderer.invoke('validate-ticket', qrString.trim());
      
      if (result.success) {
        setTicketData(result.ticket);
        setMessage(`✅ Ticket válido. Proceder con el pago de ${result.ticket.moneda} $${result.ticket.valor.toFixed(2)}`);
        setMessageType('success');
      } else {
        setMessage(`❌ ${result.error}`);
        setMessageType('error');
        setTicketData(null);
      }
    } catch (error) {
      setMessage(`❌ Error de validación: ${error.message}`);
      setMessageType('error');
      setTicketData(null);
    } finally {
      setLoading(false);
      setQrInput('');
      
      // Refocus input para siguiente escaneo
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  /**
   * Maneja cambios en el input manual
   */
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQrInput(value);
    
    // Si el valor contiene el patrón de QR TITO, procesarlo automáticamente
    if (value.includes('|') && value.split('|').length === 5) {
      handleQRInput(value);
    }
  };

  /**
   * Maneja presionar Enter en input manual
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && qrInput.trim()) {
      handleQRInput(qrInput);
    }
  };

  /**
   * Procesa el pago del ticket
   */
  const handleProcessPayment = async () => {
    if (!ticketData) return;

    setLoading(true);
    setMessage('Procesando pago...');
    setMessageType('info');
    
    try {
      const result = await ipcRenderer.invoke('process-payment', {
        ticket_number: ticketData.ticket_number,
        usuario_canje: 'Cajero'
      });
      
      if (result.success) {
        setMessage(
          `✅ Pago procesado exitosamente\\n` +
          `Entregar: ${ticketData.moneda} $${ticketData.valor.toFixed(2)}\\n` +
          `Ticket: ${ticketData.ticket_number}`
        );
        setMessageType('success');
        setTicketData(null);
        
        // Actualizar estadísticas
        setTimeout(loadStats, 1000);
        
        // Limpiar mensaje después de 5 segundos
        setTimeout(() => {
          setMessage('Escanee el siguiente ticket');
          setMessageType('info');
        }, 5000);
        
      } else {
        setMessage(`❌ Error procesando pago: ${result.error}`);
        setMessageType('error');
      }
      
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancela la operación actual
   */
  const handleCancel = () => {
    setTicketData(null);
    setMessage('Operación cancelada');
    setMessageType('info');
    setQrInput('');
    
    setTimeout(() => {
      setMessage('Escanee un ticket para comenzar');
      setMessageType('info');
    }, 2000);
  };

  /**
   * Formatea fecha para mostrar
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="caja-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Sistema TITO - Caja</h1>
          <div className="header-status">
            <div className="status-indicator">
              <div className="status-dot active"></div>
              <span>Sistema Activo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-value">{stats.total_canjeados}</div>
          <div className="stat-label">Tickets Canjeados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">RD$ {stats.valor_canjeado_dop?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Pagado en DOP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">US$ {stats.valor_canjeado_usd?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Pagado en USD</div>
        </div>
      </div>

      {/* Main Content */}
      <main className="app-main">
        
        {/* Scanner Section */}
        <div className="scanner-section">
          <div className="scanner-container">
            <div className="scanner-icon">📱</div>
            <h2>Escanear Ticket</h2>
            <p>Escanee el código QR del ticket o ingrese manualmente</p>
            
            <div className="input-container">
              <input
                ref={inputRef}
                type="text"
                value={qrInput}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Escanee código QR o ingrese manualmente..."
                disabled={loading}
                className="qr-input"
                autoComplete="off"
              />
            </div>
            
            <div className="scanner-help">
              <p>💡 El cursor debe estar en el campo de entrada para recibir escaneos</p>
            </div>
          </div>
        </div>

        {/* Ticket Information */}
        {ticketData && (
          <div className="ticket-section">
            <div className="ticket-container">
              <div className="ticket-header">
                <h3>Información del Ticket</h3>
                <div className="ticket-status valid">✅ Válido</div>
              </div>
              
              <div className="ticket-details">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Número:</span>
                    <span className="detail-value">{ticketData.ticket_number}</span>
                  </div>
                  
                  <div className="detail-item highlight">
                    <span className="detail-label">Valor:</span>
                    <span className="detail-value amount">
                      {ticketData.moneda} ${ticketData.valor.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="detail-label">Fecha Emisión:</span>
                    <span className="detail-value">{formatDate(ticketData.fecha_emision)}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="detail-label">Mesa:</span>
                    <span className="detail-value">Mesa {ticketData.mesa_id || 'N/A'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="detail-label">Estado:</span>
                    <span className={`detail-value status-${ticketData.estado}`}>
                      {ticketData.estado.toUpperCase()}
                    </span>
                  </div>
                  
                  {ticketData.usuario_emision && (
                    <div className="detail-item">
                      <span className="detail-label">Emisor:</span>
                      <span className="detail-value">{ticketData.usuario_emision}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="ticket-actions">
                <button 
                  className="cancel-btn"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  ❌ Cancelar
                </button>
                
                <button 
                  className="payment-btn"
                  onClick={handleProcessPayment}
                  disabled={loading || ticketData.estado !== 'emitido'}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Procesando...
                    </>
                  ) : (
                    `💰 Pagar ${ticketData.moneda} $${ticketData.valor.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
        {!ticketData && (
          <div className="instructions">
            <div className="instructions-container">
              <h3>Instrucciones de Canje:</h3>
              <ol>
                <li>Mantenga el cursor en el campo de entrada</li>
                <li>Escanee el código QR del ticket del cliente</li>
                <li>Verifique la información mostrada</li>
                <li>Presione "Pagar" para procesar el canje</li>
                <li>Entregue el efectivo al cliente</li>
              </ol>
              
              <div className="safety-note">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Verifique siempre la identidad del cliente</li>
                  <li>Cada ticket solo puede canjearse una vez</li>
                  <li>En caso de dudas, consulte con supervisión</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CajaApp;
'''

with open('tito-casino-system/src/renderer/components/Caja/CajaApp.js', 'w') as f:
    f.write(caja_app_js)

print("✅ Componente React para Caja creado")