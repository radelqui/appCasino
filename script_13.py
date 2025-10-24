# Paso 14: Crear estilos CSS para Mesa
import os

mesa_app_css = '''/* src/renderer/components/Mesa/MesaApp.css */

.mesa-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  color: #333;
}

/* Header */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 2rem;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
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
  color: #2d3748;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.sync-btn {
  background: #4299e1;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(66, 153, 225, 0.3);
}

.sync-btn:hover:not(:disabled) {
  background: #3182ce;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #718096;
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

.form-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 100%;
  max-width: 500px;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-control {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-control:disabled {
  background: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

/* Value Input */
.value-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 1rem;
  font-weight: 600;
  color: #4a5568;
  z-index: 2;
  background: white;
  padding: 0 0.25rem;
}

.value-input {
  padding-left: 3rem !important;
  font-size: 1.2rem !important;
  font-weight: 600;
  text-align: right;
}

.form-help {
  color: #718096;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

/* Generate Button */
.generate-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 50px;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(72, 187, 120, 0.6);
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.generate-btn.loading {
  background: #a0aec0;
  box-shadow: none;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Messages */
.message {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
  text-align: center;
  animation: slideIn 0.3s ease;
}

.message-success {
  background: linear-gradient(135deg, #48bb78, #38a169);
  color: white;
  border: 1px solid #38a169;
}

.message-error {
  background: linear-gradient(135deg, #f56565, #e53e3e);
  color: white;
  border: 1px solid #e53e3e;
}

.message-info {
  background: linear-gradient(135deg, #4299e1, #3182ce);
  color: white;
  border: 1px solid #3182ce;
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.instructions h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2d3748;
  font-size: 1.1rem;
  font-weight: 600;
}

.instructions ol {
  margin: 0;
  padding-left: 1.5rem;
  color: #4a5568;
  line-height: 1.6;
}

.instructions li {
  margin-bottom: 0.5rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .mesa-app {
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
  
  .form-container {
    padding: 1.5rem;
  }
  
  .app-header h1 {
    font-size: 1.5rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
}

@media (max-width: 480px) {
  .value-input {
    font-size: 1rem !important;
  }
  
  .generate-btn {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  }
  
  .currency-symbol {
    left: 0.75rem;
  }
  
  .value-input {
    padding-left: 2.5rem !important;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mesa-app {
    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  }
  
  .form-control {
    background: #2d3748;
    border-color: #4a5568;
    color: #e2e8f0;
  }
  
  .form-control:focus {
    border-color: #63b3ed;
  }
  
  .currency-symbol {
    background: #2d3748;
    color: #e2e8f0;
  }
}

/* Print styles */
@media print {
  .mesa-app {
    display: none;
  }
}
'''

with open('tito-casino-system/src/renderer/components/Mesa/MesaApp.css', 'w') as f:
    f.write(mesa_app_css)

print("✅ Estilos CSS para Mesa creados")