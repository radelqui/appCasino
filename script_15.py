# Paso 16: Crear estilos CSS para Caja
import os

caja_app_css = '''/* src/renderer/components/Caja/CajaApp.css */

.caja-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  color: #e2e8f0;
}

/* Header */
.app-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem 2rem;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.app-header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #68d391;
  animation: pulse 2s infinite;
}

.status-dot.active {
  background: #68d391;
  box-shadow: 0 0 10px #68d391;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Stats Section */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.stat-label {
  font-size: 0.9rem;
  color: #cbd5e0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* Main Content */
.app-main {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

/* Scanner Section */
.scanner-section {
  width: 100%;
  max-width: 600px;
}

.scanner-container {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scanner-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

.scanner-container h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
}

.scanner-container p {
  margin: 0 0 2rem 0;
  color: #cbd5e0;
  font-size: 1rem;
}

.input-container {
  margin-bottom: 1rem;
}

.qr-input {
  width: 100%;
  padding: 1rem 1.5rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  text-align: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.qr-input::placeholder {
  color: #a0aec0;
}

.qr-input:focus {
  outline: none;
  border-color: #63b3ed;
  box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.2);
  background: rgba(255, 255, 255, 0.15);
}

.qr-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scanner-help {
  color: #a0aec0;
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Ticket Section */
.ticket-section {
  width: 100%;
  max-width: 700px;
  animation: slideUp 0.3s ease;
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

.ticket-container {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.ticket-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: white;
}

.ticket-status {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.ticket-status.valid {
  background: rgba(72, 187, 120, 0.2);
  color: #68d391;
  border: 1px solid rgba(72, 187, 120, 0.3);
}

.ticket-status.invalid {
  background: rgba(245, 101, 101, 0.2);
  color: #fc8181;
  border: 1px solid rgba(245, 101, 101, 0.3);
}

/* Ticket Details */
.ticket-details {
  margin-bottom: 2rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-item.highlight {
  background: rgba(99, 179, 237, 0.1);
  border-color: rgba(99, 179, 237, 0.3);
}

.detail-label {
  font-size: 0.9rem;
  color: #a0aec0;
  font-weight: 500;
}

.detail-value {
  font-size: 1rem;
  color: white;
  font-weight: 600;
  text-align: right;
}

.detail-value.amount {
  font-size: 1.2rem;
  color: #68d391;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.status-emitido {
  color: #68d391;
}

.status-canjeado {
  color: #a0aec0;
}

.status-anulado {
  color: #fc8181;
}

/* Ticket Actions */
.ticket-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.cancel-btn,
.payment-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 150px;
  backdrop-filter: blur(10px);
}

.cancel-btn {
  background: rgba(245, 101, 101, 0.2);
  color: #fc8181;
  border: 1px solid rgba(245, 101, 101, 0.3);
}

.cancel-btn:hover:not(:disabled) {
  background: rgba(245, 101, 101, 0.3);
  transform: translateY(-1px);
}

.payment-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
}

.payment-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(72, 187, 120, 0.6);
}

.payment-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Messages */
.message {
  padding: 1.5rem 2rem;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  max-width: 600px;
  width: 100%;
  text-align: center;
  animation: slideIn 0.3s ease;
  backdrop-filter: blur(10px);
}

.message-success {
  background: rgba(72, 187, 120, 0.2);
  color: #68d391;
  border: 1px solid rgba(72, 187, 120, 0.3);
}

.message-error {
  background: rgba(245, 101, 101, 0.2);
  color: #fc8181;
  border: 1px solid rgba(245, 101, 101, 0.3);
}

.message-info {
  background: rgba(99, 179, 237, 0.2);
  color: #63b3ed;
  border: 1px solid rgba(99, 179, 237, 0.3);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Instructions */
.instructions {
  width: 100%;
  max-width: 600px;
}

.instructions-container {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.instructions-container h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
}

.instructions-container ol {
  margin: 0 0 1.5rem 0;
  padding-left: 1.5rem;
  color: #cbd5e0;
  line-height: 1.6;
}

.instructions-container li {
  margin-bottom: 0.5rem;
}

.safety-note {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.safety-note strong {
  color: #ffd93d;
  display: block;
  margin-bottom: 0.5rem;
}

.safety-note ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #e2e8f0;
}

.safety-note li {
  margin-bottom: 0.25rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .caja-app {
    font-size: 14px;
  }
  
  .app-header {
    padding: 1rem;
  }
  
  .header-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .stats-section {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
  
  .app-main {
    padding: 1rem;
  }
  
  .scanner-container,
  .ticket-container,
  .instructions-container {
    padding: 1.5rem;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .ticket-actions {
    flex-direction: column;
  }
  
  .cancel-btn,
  .payment-btn {
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .app-header h1 {
    font-size: 1.5rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
  
  .qr-input {
    font-size: 1rem;
    padding: 0.75rem 1rem;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .detail-value {
    text-align: left;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .caja-app {
    background: #000;
    color: #fff;
  }
  
  .stat-card,
  .scanner-container,
  .ticket-container,
  .instructions-container {
    background: #222;
    border-color: #555;
  }
}

/* Print styles */
@media print {
  .caja-app {
    display: none;
  }
}
'''

with open('tito-casino-system/src/renderer/components/Caja/CajaApp.css', 'w') as f:
    f.write(caja_app_css)

print("✅ Estilos CSS para Caja creados")