// pure/healthMonitor.js - Sistema de monitoreo de salud de la aplicación
const EventEmitter = require('events');

class HealthMonitor extends EventEmitter {
  constructor() {
    super();
    this.checks = new Map();
    this.metrics = {
      dbOperations: [],
      supabaseOperations: [],
      printerOperations: [],
      lastHeartbeat: Date.now()
    };
    this.isHealthy = true;
    this.startTime = Date.now();
  }

  /**
   * Registra el inicio de una operación
   * @param {string} operation - Nombre de la operación
   * @param {number} timeout - Timeout en ms (default: 10000)
   */
  startOperation(operation, timeout = 10000) {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    const startTime = Date.now();

    this.checks.set(operationId, {
      operation,
      startTime,
      timeout,
      status: 'running'
    });

    console.log(`🏥 [Health] Iniciando: ${operation} (timeout: ${timeout}ms)`);

    // Configurar timeout
    const timeoutId = setTimeout(() => {
      const check = this.checks.get(operationId);
      if (check && check.status === 'running') {
        console.error(`🚨 [Health] TIMEOUT: ${operation} excedió ${timeout}ms`);
        this.emit('timeout', {
          operation,
          duration: Date.now() - startTime,
          timeout
        });
        check.status = 'timeout';
        this.isHealthy = false;
      }
    }, timeout);

    // Retornar función para finalizar la operación
    return () => {
      clearTimeout(timeoutId);
      const check = this.checks.get(operationId);
      if (check) {
        const duration = Date.now() - startTime;
        check.status = 'completed';
        check.duration = duration;

        // Registrar métricas
        this.recordMetric(operation, duration);

        console.log(`✅ [Health] Completado: ${operation} (${duration}ms)`);

        // Limpiar después de 1 minuto
        setTimeout(() => this.checks.delete(operationId), 60000);
      }
    };
  }

  /**
   * Registra una métrica de operación
   */
  recordMetric(operation, duration) {
    const category = this.getCategoryForOperation(operation);
    if (this.metrics[category]) {
      this.metrics[category].push({
        timestamp: Date.now(),
        duration
      });

      // Mantener solo últimas 100 métricas
      if (this.metrics[category].length > 100) {
        this.metrics[category].shift();
      }
    }
  }

  getCategoryForOperation(operation) {
    if (operation.includes('db') || operation.includes('database') || operation.includes('sqlite')) {
      return 'dbOperations';
    }
    if (operation.includes('supabase') || operation.includes('cloud')) {
      return 'supabaseOperations';
    }
    if (operation.includes('print') || operation.includes('printer')) {
      return 'printerOperations';
    }
    return 'dbOperations'; // default
  }

  /**
   * Obtiene estadísticas de salud
   */
  getHealthStats() {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Calcular promedios
    const avgDbTime = this.calculateAverage(this.metrics.dbOperations);
    const avgSupabaseTime = this.calculateAverage(this.metrics.supabaseOperations);
    const avgPrinterTime = this.calculateAverage(this.metrics.printerOperations);

    // Operaciones en curso
    const runningOperations = Array.from(this.checks.values())
      .filter(c => c.status === 'running')
      .map(c => ({
        operation: c.operation,
        duration: now - c.startTime,
        timeout: c.timeout
      }));

    // Operaciones con timeout
    const timedoutOperations = Array.from(this.checks.values())
      .filter(c => c.status === 'timeout');

    return {
      isHealthy: this.isHealthy && runningOperations.length < 5,
      uptime,
      runningOperations: runningOperations.length,
      runningDetails: runningOperations,
      timedoutOperations: timedoutOperations.length,
      averages: {
        db: avgDbTime,
        supabase: avgSupabaseTime,
        printer: avgPrinterTime
      },
      counts: {
        db: this.metrics.dbOperations.length,
        supabase: this.metrics.supabaseOperations.length,
        printer: this.metrics.printerOperations.length
      },
      lastHeartbeat: this.metrics.lastHeartbeat
    };
  }

  calculateAverage(operations) {
    if (!operations || operations.length === 0) return 0;
    const sum = operations.reduce((acc, op) => acc + op.duration, 0);
    return Math.round(sum / operations.length);
  }

  /**
   * Actualiza el heartbeat
   */
  heartbeat() {
    this.metrics.lastHeartbeat = Date.now();
  }

  /**
   * Verifica si hay operaciones colgadas
   */
  checkForHangs() {
    const now = Date.now();
    const hangs = [];

    for (const [id, check] of this.checks.entries()) {
      if (check.status === 'running') {
        const duration = now - check.startTime;
        if (duration > check.timeout * 2) { // 2x el timeout = definitivamente colgado
          hangs.push({
            id,
            operation: check.operation,
            duration,
            timeout: check.timeout
          });
        }
      }
    }

    if (hangs.length > 0) {
      console.error('🚨 [Health] OPERACIONES COLGADAS:', hangs);
      this.emit('hang-detected', hangs);
    }

    return hangs;
  }

  /**
   * Limpia operaciones antiguas
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutos

    for (const [id, check] of this.checks.entries()) {
      if (now - check.startTime > maxAge) {
        console.warn(`⚠️ [Health] Limpiando operación antigua: ${check.operation}`);
        this.checks.delete(id);
      }
    }
  }

  /**
   * Reset del estado de salud
   */
  reset() {
    console.log('🔄 [Health] Reseteando estado de salud');
    this.isHealthy = true;
    this.checks.clear();
    this.metrics = {
      dbOperations: [],
      supabaseOperations: [],
      printerOperations: [],
      lastHeartbeat: Date.now()
    };
  }
}

// Singleton
let instance = null;

function getHealthMonitor() {
  if (!instance) {
    instance = new HealthMonitor();

    // Verificar hangs cada 30 segundos
    setInterval(() => {
      instance.checkForHangs();
      instance.cleanup();
    }, 30000);

    // Heartbeat cada 5 segundos
    setInterval(() => {
      instance.heartbeat();
    }, 5000);
  }
  return instance;
}

module.exports = { HealthMonitor, getHealthMonitor };
