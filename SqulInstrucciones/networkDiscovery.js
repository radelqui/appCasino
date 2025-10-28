// ============================================
// SISTEMA DE DESCUBRIMIENTO DE RED
// ENVIAR + RECIBIR + DESCUBRIR IPs
// ============================================

const dgram = require('dgram');
const os = require('os');
const EventEmitter = require('events');

/**
 * Sistema para que todas las estaciones del casino se encuentren automáticamente
 * Sin necesidad de configurar IPs manualmente
 */
class NetworkDiscovery extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuración
    this.port = config.port || 3001;
    this.serverPort = config.serverPort || 3000;
    this.isServer = config.isServer || false; // ¿Es el PC Caja (servidor)?
    
    // Información de esta estación
    this.stationId = config.stationId || null;
    this.stationName = config.stationName || 'Unknown';
    this.stationType = config.stationType || 'unknown'; // mesa, caja, auditor, admin
    
    // Socket UDP para enviar/recibir
    this.socket = null;
    
    // Lista de estaciones descubiertas
    this.stations = new Map(); // IP -> { name, type, id, lastSeen, serverPort }
    
    // Mi IP local
    this.myIP = null;
    
    // Timers
    this.broadcastTimer = null;
    this.cleanupTimer = null;
    
    // Configuración de tiempos
    this.broadcastInterval = 10000; // Cada 10 segundos anunciar presencia
    this.cleanupInterval = 30000; // Cada 30 segundos limpiar estaciones inactivas
    this.stationTimeout = 45000; // 45 segundos sin señal = considerada offline
  }

  // ============================================
  // INICIAR / DETENER
  // ============================================

  /**
   * Iniciar el sistema de descubrimiento
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔍 Iniciando descubrimiento de red...');
        
        // Obtener mi IP local
        this.myIP = this.getLocalIP();
        console.log(`📍 Mi IP: ${this.myIP}`);
        
        // Crear socket UDP
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        
        // Configurar eventos del socket
        this.setupSocketEvents();
        
        // Bind al puerto
        this.socket.bind(this.port, () => {
          console.log(`✅ Escuchando en puerto ${this.port}`);
          
          // Habilitar broadcast
          this.socket.setBroadcast(true);
          
          // Empezar a anunciar presencia
          this.startBroadcast();
          
          // Empezar limpieza de estaciones inactivas
          this.startCleanup();
          
          // Enviar primer anuncio inmediatamente
          this.sendAnnouncement();
          
          resolve();
        });
        
      } catch (error) {
        console.error('❌ Error al iniciar descubrimiento:', error);
        reject(error);
      }
    });
  }

  /**
   * Detener el sistema de descubrimiento
   */
  stop() {
    console.log('🛑 Deteniendo descubrimiento de red...');
    
    // Detener timers
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Enviar mensaje de despedida
    this.sendGoodbye();
    
    // Cerrar socket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    console.log('✅ Descubrimiento detenido');
  }

  // ============================================
  // ENVIAR MENSAJES
  // ============================================

  /**
   * Iniciar broadcast periódico
   */
  startBroadcast() {
    this.broadcastTimer = setInterval(() => {
      this.sendAnnouncement();
    }, this.broadcastInterval);
  }

  /**
   * Enviar anuncio de presencia (BROADCAST)
   */
  sendAnnouncement() {
    const message = {
      type: 'ANNOUNCE',
      stationId: this.stationId,
      stationName: this.stationName,
      stationType: this.stationType,
      isServer: this.isServer,
      serverPort: this.serverPort,
      ip: this.myIP,
      timestamp: Date.now()
    };
    
    this.broadcast(message);
  }

  /**
   * Enviar mensaje de despedida
   */
  sendGoodbye() {
    const message = {
      type: 'GOODBYE',
      stationId: this.stationId,
      stationName: this.stationName,
      ip: this.myIP,
      timestamp: Date.now()
    };
    
    this.broadcast(message);
  }

  /**
   * Responder a un anuncio específico (UNICAST)
   */
  sendResponse(targetIP) {
    const message = {
      type: 'RESPONSE',
      stationId: this.stationId,
      stationName: this.stationName,
      stationType: this.stationType,
      isServer: this.isServer,
      serverPort: this.serverPort,
      ip: this.myIP,
      timestamp: Date.now()
    };
    
    this.sendTo(message, targetIP);
  }

  /**
   * Enviar broadcast a toda la red
   */
  broadcast(message) {
    const buffer = Buffer.from(JSON.stringify(message));
    const broadcastIP = this.getBroadcastAddress();
    
    this.socket.send(buffer, 0, buffer.length, this.port, broadcastIP, (err) => {
      if (err) {
        console.error('❌ Error al enviar broadcast:', err);
      }
    });
  }

  /**
   * Enviar mensaje a IP específica (unicast)
   */
  sendTo(message, targetIP) {
    const buffer = Buffer.from(JSON.stringify(message));
    
    this.socket.send(buffer, 0, buffer.length, this.port, targetIP, (err) => {
      if (err) {
        console.error(`❌ Error al enviar a ${targetIP}:`, err);
      }
    });
  }

  // ============================================
  // RECIBIR MENSAJES
  // ============================================

  /**
   * Configurar eventos del socket
   */
  setupSocketEvents() {
    // Cuando llega un mensaje
    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    // Errores
    this.socket.on('error', (err) => {
      console.error('❌ Error en socket:', err);
      this.emit('error', err);
    });

    // Socket cerrado
    this.socket.on('close', () => {
      console.log('🔌 Socket cerrado');
    });
  }

  /**
   * Manejar mensaje recibido
   */
  handleMessage(msg, rinfo) {
    try {
      // Parsear mensaje
      const message = JSON.parse(msg.toString());
      const senderIP = rinfo.address;
      
      // Ignorar mensajes propios
      if (senderIP === this.myIP) {
        return;
      }
      
      // Procesar según tipo de mensaje
      switch (message.type) {
        case 'ANNOUNCE':
          this.handleAnnounce(message, senderIP);
          break;
          
        case 'RESPONSE':
          this.handleResponse(message, senderIP);
          break;
          
        case 'GOODBYE':
          this.handleGoodbye(message, senderIP);
          break;
          
        default:
          console.warn('⚠️  Tipo de mensaje desconocido:', message.type);
      }
      
    } catch (error) {
      console.error('❌ Error al procesar mensaje:', error);
    }
  }

  /**
   * Manejar anuncio de otra estación
   */
  handleAnnounce(message, senderIP) {
    const stationKey = senderIP;
    const wasNew = !this.stations.has(stationKey);
    
    // Actualizar o agregar estación
    this.stations.set(stationKey, {
      ip: senderIP,
      id: message.stationId,
      name: message.stationName,
      type: message.stationType,
      isServer: message.isServer,
      serverPort: message.serverPort,
      lastSeen: Date.now()
    });
    
    if (wasNew) {
      console.log(`✨ Nueva estación descubierta: ${message.stationName} (${senderIP})`);
      this.emit('station-found', this.stations.get(stationKey));
      
      // Responder a la nueva estación
      this.sendResponse(senderIP);
    }
  }

  /**
   * Manejar respuesta de otra estación
   */
  handleResponse(message, senderIP) {
    const stationKey = senderIP;
    const wasNew = !this.stations.has(stationKey);
    
    // Actualizar o agregar estación
    this.stations.set(stationKey, {
      ip: senderIP,
      id: message.stationId,
      name: message.stationName,
      type: message.stationType,
      isServer: message.isServer,
      serverPort: message.serverPort,
      lastSeen: Date.now()
    });
    
    if (wasNew) {
      console.log(`✨ Estación encontrada por respuesta: ${message.stationName} (${senderIP})`);
      this.emit('station-found', this.stations.get(stationKey));
    }
  }

  /**
   * Manejar despedida de estación
   */
  handleGoodbye(message, senderIP) {
    const stationKey = senderIP;
    
    if (this.stations.has(stationKey)) {
      const station = this.stations.get(stationKey);
      console.log(`👋 Estación desconectada: ${station.name} (${senderIP})`);
      
      this.stations.delete(stationKey);
      this.emit('station-lost', station);
    }
  }

  // ============================================
  // LIMPIEZA Y MANTENIMIENTO
  // ============================================

  /**
   * Iniciar limpieza periódica de estaciones inactivas
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveStations();
    }, this.cleanupInterval);
  }

  /**
   * Limpiar estaciones que no responden
   */
  cleanupInactiveStations() {
    const now = Date.now();
    const stationsToRemove = [];
    
    for (const [ip, station] of this.stations.entries()) {
      const timeSinceLastSeen = now - station.lastSeen;
      
      if (timeSinceLastSeen > this.stationTimeout) {
        stationsToRemove.push({ ip, station });
      }
    }
    
    // Remover estaciones inactivas
    for (const { ip, station } of stationsToRemove) {
      console.log(`⏰ Estación timeout: ${station.name} (${ip})`);
      this.stations.delete(ip);
      this.emit('station-lost', station);
    }
  }

  // ============================================
  // CONSULTAS
  // ============================================

  /**
   * Obtener todas las estaciones descubiertas
   */
  getStations() {
    return Array.from(this.stations.values());
  }

  /**
   * Obtener servidor (PC Caja)
   */
  getServer() {
    for (const station of this.stations.values()) {
      if (station.isServer) {
        return station;
      }
    }
    return null;
  }

  /**
   * Obtener estación por ID
   */
  getStationById(stationId) {
    for (const station of this.stations.values()) {
      if (station.id === stationId) {
        return station;
      }
    }
    return null;
  }

  /**
   * Obtener estaciones por tipo
   */
  getStationsByType(type) {
    return this.getStations().filter(s => s.type === type);
  }

  /**
   * Obtener URL del servidor
   */
  getServerURL() {
    const server = this.getServer();
    if (!server) {
      return null;
    }
    return `http://${server.ip}:${server.serverPort}`;
  }

  // ============================================
  // UTILIDADES DE RED
  // ============================================

  /**
   * Obtener IP local de esta máquina
   */
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    // Buscar primera IP no localhost
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // IPv4, no interna, no loopback
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    
    return '127.0.0.1'; // Fallback
  }

  /**
   * Obtener dirección de broadcast
   */
  getBroadcastAddress() {
    const interfaces = os.networkInterfaces();
    
    // Buscar broadcast de la red local
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // Calcular broadcast
          const ip = iface.address.split('.').map(Number);
          const mask = iface.netmask.split('.').map(Number);
          const broadcast = ip.map((octet, i) => octet | (~mask[i] & 255));
          
          return broadcast.join('.');
        }
      }
    }
    
    return '255.255.255.255'; // Broadcast global
  }

  /**
   * Obtener información de esta estación
   */
  getMyInfo() {
    return {
      ip: this.myIP,
      id: this.stationId,
      name: this.stationName,
      type: this.stationType,
      isServer: this.isServer,
      serverPort: this.serverPort
    };
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    const stations = this.getStations();
    const byType = {};
    
    for (const station of stations) {
      if (!byType[station.type]) {
        byType[station.type] = 0;
      }
      byType[station.type]++;
    }
    
    return {
      total: stations.length,
      byType,
      hasServer: this.getServer() !== null
    };
  }
}

// ============================================
// EJEMPLO DE USO
// ============================================

/*
// En PC Caja (Servidor):
const discovery = new NetworkDiscovery({
  port: 3001,
  serverPort: 3000,
  isServer: true,
  stationId: 5,
  stationName: 'Caja Principal',
  stationType: 'caja'
});

discovery.on('station-found', (station) => {
  console.log('Nueva estación:', station.name);
});

discovery.on('station-lost', (station) => {
  console.log('Estación perdida:', station.name);
});

await discovery.start();

// Ver todas las estaciones
console.log(discovery.getStations());

// Ver servidor
console.log(discovery.getServer());


// En Mesa (Cliente):
const discovery = new NetworkDiscovery({
  port: 3001,
  isServer: false,
  stationId: 1,
  stationName: 'Mesa 1',
  stationType: 'mesa'
});

await discovery.start();

// Esperar a encontrar el servidor
setTimeout(() => {
  const serverURL = discovery.getServerURL();
  console.log('Servidor en:', serverURL);
  
  // Ahora puedo conectarme al servidor
  // fetch(`${serverURL}/api/vouchers`)
}, 5000);
*/

module.exports = NetworkDiscovery;
