# Arquitectura SQLite + Supabase - Sistema TITO Casino

## Resumen Ejecutivo

| Módulo | Base de Datos | Estrategia | Sincronización |
|--------|---------------|------------|----------------|
| **Usuarios/Auth** | Supabase ÚNICAMENTE | Supabase Auth + tabla `users` | No aplica |
| **Tickets/Vouchers** | SQLite PRIMERO → Supabase | Híbrida (local first + sync) | Automática al crear |
| **Operadores** | Supabase ÚNICAMENTE | Solo Supabase `operators` | No aplica |
| **Auditoría** | Supabase PRIMERO → SQLite fallback | Lee de Supabase preferentemente | No hay sync |
| **Detección Online/Offline** | Supabase ping | `testConnection()` cada 30s | Automática |

---

## 1. USUARIOS Y AUTENTICACIÓN

### 🗄️ Dónde se guardan

**Supabase ÚNICAMENTE** - No hay tabla de usuarios en SQLite.

- `auth.users` - Sistema de autenticación de Supabase (bcrypt)
- `public.users` - Tabla de perfiles con roles y configuración

### 🔐 Login: ¿Usa Supabase o SQLite?

**Supabase Auth** con arquitectura de doble cliente:

#### Código del Handler (`pure/main.js:79-147`)

```javascript
ipcMain.handle('auth:login', async (event, username, password) => {
  console.log('[main] auth:login recibido, usuario:', username);

  // ✅ PASO 1: Autenticar con Supabase Auth usando cliente ANON
  const authClient = supabaseManager.anonClient || supabaseManager.client;

  const { data, error } = await authClient.auth.signInWithPassword({
    email: username,
    password: password
  });

  if (error) {
    console.error('[auth:login] Error en signInWithPassword:', error.message);
    return { success: false, error: 'Email o contraseña incorrectos' };
  }

  console.log('[auth:login] ✅ Auth exitoso, User ID:', data.user.id);

  // ✅ PASO 2: Obtener perfil usando cliente SERVICE_ROLE (evita RLS)
  const { data: profile, error: profileError } = await supabaseManager.client
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[auth:login] Error obteniendo perfil:', profileError);
  }

  // ✅ PASO 3: Validar que el usuario esté activo
  if (profileError || !profile.is_active) {
    console.error('[auth:login] Usuario inactivo o no encontrado');
    return { success: false, error: 'Usuario inactivo' };
  }

  // ✅ PASO 4: Guardar sesión en memoria (no en SQLite)
  currentSession = {
    user: {
      id: profile.id,
      email: profile.email,
      username: profile.full_name,
      role: profile.role.toUpperCase()
    }
  };

  console.log('[auth:login] ✅ Login exitoso, sesión guardada:', currentSession.user);
  return { success: true, user: currentSession.user };
});
```

#### Arquitectura de Doble Cliente (`pure/supabaseManager.js:5-45`)

```javascript
class SupabaseManager {
  constructor() {
    this.client = null;      // SERVICE_ROLE - operaciones admin
    this.anonClient = null;  // ANON - autenticación usuarios
    this.available = false;
    this.isConnected = false;
    this._initClient();
  }

  _initClient() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    // Cliente SERVICE_ROLE para leer tabla users (evita RLS)
    if (serviceKey) {
      this.client = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    }

    // Cliente ANON para signInWithPassword (seguridad)
    if (anonKey) {
      this.anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    }

    this.available = (this.client !== null) || (this.anonClient !== null);
  }
}
```

**¿Por qué doble cliente?**
- `anonClient` → Para `signInWithPassword()` (simula usuario real)
- `client` (SERVICE_ROLE) → Para leer `users` table (evita restricciones RLS)

### 👤 Crear Usuario: ¿Dónde guarda?

**Supabase ÚNICAMENTE** - En dos tablas:

#### Código del Handler (`pure/main.js:883-948`)

```javascript
ipcMain.handle('create-user', async (event, userData) => {
  console.log('[create-user] Creando usuario:', userData);

  // ✅ PASO 1: Crear usuario en Supabase Auth con auto-confirmación
  const { data: authData, error: authError } = await supabaseManager.client.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true  // ⚠️ Auto-confirmar (app interna)
  });

  if (authError) {
    console.error('[create-user] Error en Auth:', authError);
    return { success: false, error: authError.message };
  }

  console.log('[create-user] ✅ Usuario creado en Auth, ID:', authData.user.id);

  // ✅ PASO 2: Crear perfil en tabla public.users
  const { data: profileData, error: profileError } = await supabaseManager.client
    .from('users')
    .upsert({
      id: authData.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role.toLowerCase(),  // ⚠️ DB requiere lowercase
      pin_code: userData.pin_code || null,
      is_active: true
    })
    .select()
    .single();

  if (profileError) {
    console.error('[create-user] Error creando perfil:', profileError);

    // Rollback: eliminar usuario de Auth si falla el perfil
    await supabaseManager.client.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: profileError.message };
  }

  console.log('[create-user] ✅ Perfil creado exitosamente');
  return { success: true, user: profileData };
});
```

**Flujo de creación:**
1. `auth.admin.createUser()` → Crea en `auth.users` (auto-confirmado)
2. `.from('users').upsert()` → Crea perfil en `public.users`
3. Si falla paso 2 → Rollback del paso 1 (deleteUser)

---

## 2. TICKETS/VOUCHERS

### 📝 Crear Ticket: ¿Dónde guarda?

**SQLite PRIMERO, luego intenta sincronizar con Supabase**

#### Código del Handler (`pure/main.js:292-387`)

```javascript
ipcMain.handle('generate-ticket', async (event, ticketData) => {
  console.log('[main] Generando ticket:', ticketData);

  // ✅ PASO 1: CREAR EN SQLITE SIEMPRE (funciona offline)
  const res = db.createTicket({
    amount: ticketData.amount,
    currency: ticketData.currency || 'USD',
    mesa: ticketData.mesa,
    usuario_emision: ticketData.usuario_emision || null
  });

  const ticketCode = res.ticket_number;
  console.log('✅ Ticket guardado en SQLite local:', ticketCode);

  // ✅ PASO 2: INTENTAR SINCRONIZAR CON SUPABASE (best effort)
  let syncedToCloud = false;

  if (supabaseManager && supabaseManager.isAvailable()) {
    try {
      const supabaseResult = await supabaseManager.createVoucher({
        voucher_code: ticketCode,
        amount: ticketData.amount,
        currency: ticketData.currency || 'USD',
        issued_by_user_id: userId,         // Usuario de sesión
        issued_at_station_id: stationId    // Mesa/Caja actual
      });

      if (supabaseResult.success) {
        syncedToCloud = true;

        // Marcar como sincronizado en SQLite
        db.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE code = ?')
          .run(ticketCode);

        console.log('✅ Ticket sincronizado con Supabase');
      }
    } catch (supaError) {
      console.warn('⚠️  Error sincronizando con Supabase (modo offline):', supaError.message);
      // NO falla la operación, solo registra el error
    }
  }

  // ✅ PASO 3: GENERAR PDF (siempre usa datos de SQLite)
  const pdfResult = await pdfGenerator.generateTicketPDF(ticketCode, mesa, ticketData.amount, ticketData.currency);

  return {
    success: true,
    ticketCode: ticketCode,
    pdfPath: pdfResult.path,
    syncedToCloud: syncedToCloud  // Informa si está en la nube
  };
});
```

**Estrategia "Local First":**
- ✅ SQLite SIEMPRE funciona (offline capable)
- ✅ Supabase es "mejor esfuerzo" (best effort)
- ✅ El ticket es válido aunque falle Supabase
- ✅ Campo `sincronizado` marca qué tickets están en la nube

### 🔍 Validar Ticket: ¿Dónde busca primero?

**Supabase PRIMERO, fallback a SQLite**

#### Código del Handler (`pure/main.js:389-470`)

```javascript
ipcMain.handle('validate-voucher', async (event, code) => {
  console.log('[main] Validando voucher:', code);

  let rowData = null;
  let source = null;

  // ✅ PASO 1: BUSCAR EN SUPABASE PRIMERO (source of truth)
  if (supabaseManager && supabaseManager.isAvailable()) {
    try {
      const supabaseResult = await supabaseManager.getVoucher(code);

      if (supabaseResult.success && supabaseResult.data) {
        source = 'cloud';
        const sv = supabaseResult.data;

        // Mapear formato Supabase → formato local
        rowData = {
          code: sv.voucher_code,
          amount: sv.amount,
          currency: sv.currency,
          status: sv.status,
          mesa: sv.issued_at_station_id,
          created_at: sv.created_at,
          estado: sv.status,
          sincronizado: 1
        };

        console.log('✅ Ticket encontrado en Supabase');

        // CACHEAR EN SQLITE para futuros usos offline
        try {
          db.createTicket({
            ticket_number: sv.voucher_code,
            amount: sv.amount,
            currency: sv.currency,
            mesa: sv.issued_at_station_id,
            usuario_emision: sv.issued_by_user_id
          });
          db.db.prepare('UPDATE tickets SET estado = ?, sincronizado = 1 WHERE code = ?')
            .run(sv.status, sv.voucher_code);
        } catch (e) {
          // Ignorar errores de cache (puede que ya exista)
        }
      }
    } catch (err) {
      console.warn('⚠️  Error consultando Supabase:', err.message);
    }
  }

  // ✅ PASO 2: FALLBACK A SQLITE si no está en Supabase
  if (!rowData && db) {
    const row = db.getTicket(code);
    if (row) {
      rowData = row;
      source = 'local';
      console.log('✅ Ticket encontrado en SQLite local');
    }
  }

  // ✅ PASO 3: VALIDAR ESTADO
  if (!rowData) {
    return { success: false, error: 'Ticket no encontrado' };
  }

  if (rowData.estado === 'redeemed' || rowData.estado === 'canjeado') {
    return { success: false, error: 'Ticket ya canjeado' };
  }

  return {
    success: true,
    ticket: rowData,
    source: source  // 'cloud' o 'local'
  };
});
```

**Estrategia "Cloud First":**
- ✅ Supabase es la fuente de verdad (sincronizado entre estaciones)
- ✅ SQLite es fallback para modo offline
- ✅ Se cachea en SQLite lo que se encuentra en Supabase

### 💰 Canjear Ticket: ¿Dónde actualiza?

**Actualiza en AMBOS lugares**

#### Código del Handler (`pure/main.js:472-572`)

```javascript
ipcMain.handle('redeem-voucher', async (event, code) => {
  console.log('[main] Canjeando voucher:', code);

  let updatedInCloud = false;

  // ✅ PASO 1: INTENTAR CANJEAR EN SUPABASE PRIMERO
  if (supabaseManager && supabaseManager.isAvailable()) {
    try {
      const redeemResult = await supabaseManager.redeemVoucher(
        code,
        userId,      // Usuario que canjea (sesión actual)
        stationId    // Caja donde se canjea
      );

      if (redeemResult.success) {
        updatedInCloud = true;
        console.log('✅ Ticket canjeado en Supabase');
      }
    } catch (err) {
      console.warn('⚠️  Error canjeando en Supabase:', err.message);
    }
  }

  // ✅ PASO 2: CANJEAR EN SQLITE (siempre, offline o no)
  try {
    db.db.prepare(`
      UPDATE tickets
      SET estado = 'canjeado',
          redeemed_at = ?,
          redeemed_by = ?,
          sincronizado = ?
      WHERE code = ?
    `).run(
      new Date().toISOString(),
      userId,
      updatedInCloud ? 1 : 0,  // Marcar si está sincronizado
      code
    );

    console.log('✅ Ticket canjeado en SQLite');
  } catch (sqliteErr) {
    console.error('❌ Error actualizando SQLite:', sqliteErr);
    return { success: false, error: 'Error local actualizando ticket' };
  }

  // ✅ PASO 3: REGISTRAR EN AUDITORÍA
  if (supabaseManager && supabaseManager.isAvailable()) {
    try {
      await supabaseManager.client.from('audit_logs').insert({
        action: 'REDEEM_VOUCHER',
        entity_type: 'voucher',
        entity_id: code,
        user_id: userId,
        details: { amount: ticketData.amount, currency: ticketData.currency }
      });
    } catch (auditErr) {
      console.warn('⚠️  Error registrando auditoría:', auditErr.message);
    }
  }

  return {
    success: true,
    updatedInCloud: updatedInCloud
  };
});
```

**Estrategia "Sync Both":**
- ✅ Intenta actualizar Supabase primero (sincronización entre cajas)
- ✅ Siempre actualiza SQLite (registro local)
- ✅ Campo `sincronizado` indica si el canje está en la nube
- ✅ Si Supabase falla, el ticket se canjea localmente y se puede sincronizar después

### 🔄 Sincronización: ¿Hay sync automática?

**SÍ, hay dos tipos de sincronización:**

#### 1. Sincronización Inmediata (al crear/canjear)

```javascript
// Al crear ticket (generate-ticket):
// 1. Guarda en SQLite
// 2. Sincroniza con Supabase automáticamente
// 3. Marca 'sincronizado = 1' si tiene éxito

// Al canjear ticket (redeem-voucher):
// 1. Actualiza Supabase si está online
// 2. Actualiza SQLite siempre
// 3. Marca 'sincronizado' según resultado

// Al validar ticket (validate-voucher):
// 1. Lee de Supabase (datos frescos)
// 2. Cachea en SQLite para offline
// 3. Fallback a SQLite si no hay conexión
```

#### 2. Worker de Sincronización Automática (cada 2 minutos)

**Código del Worker (`pure/main.js:1680-1759`)**

```javascript
let syncWorkerInterval = null;

function startSyncWorker() {
  console.log('🔄 Iniciando worker de sincronización...');

  // Ejecutar cada 2 minutos
  syncWorkerInterval = setInterval(async () => {
    // Skip si no hay conexión
    if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
      return;
    }

    // Skip si no hay base de datos local
    if (!db || !db.db) {
      return;
    }

    try {
      // Buscar tickets no sincronizados
      const pendingTickets = db.db.prepare(
        'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'
      ).all();

      if (pendingTickets.length === 0) {
        return; // No hay nada que sincronizar
      }

      console.log(`🔄 [Sync Worker] Sincronizando ${pendingTickets.length} tickets pendientes...`);

      let successCount = 0;
      let errorCount = 0;

      for (const ticket of pendingTickets) {
        try {
          const userId = currentSession?.user?.id || null;

          // Subir a Supabase
          const result = await supabaseManager.createVoucher({
            voucher_code: ticket.code,
            amount: ticket.amount,
            currency: ticket.currency || 'USD',
            issued_by_user_id: userId,
            issued_at_station_id: ticket.mesa || ticket.mesa_nombre || 'unknown',
            status: ticket.estado === 'active' ? 'active' : 'redeemed',
            created_at: ticket.created_at,
            redeemed_at: ticket.redeemed_at || null,
            redeemed_by_user_id: ticket.redeemed_by || null
          });

          if (result.success) {
            // Marcar como sincronizado
            db.db.prepare(
              'UPDATE tickets SET sincronizado = 1 WHERE id = ?'
            ).run(ticket.id);

            successCount++;
            console.log(`✅ [Sync Worker] Ticket ${ticket.code} sincronizado`);
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Sync Worker] Error sincronizando ticket ${ticket.code}:`, error.message);
        }
      }

      console.log(`✅ [Sync Worker] Sincronización completada: ${successCount} exitosos, ${errorCount} fallidos`);

      // Notificar a ventanas abiertas si hubo sincronizaciones
      if (successCount > 0 && mainWindow) {
        mainWindow.webContents.send('tickets-synced', { count: successCount });
      }

    } catch (error) {
      console.error('❌ [Sync Worker] Error en worker de sincronización:', error.message);
    }
  }, 2 * 60 * 1000); // 2 minutos

  console.log('✅ Worker de sincronización iniciado (intervalo: 2 minutos)');
}

// Iniciado en app.whenReady()
startSyncWorker();

// Detenido al cerrar la app
app.on('before-quit', () => {
  stopSyncWorker();
});
```

#### 3. Sincronización Manual (handlers IPC)

**Handler: `sync:get-pending-count` (`pure/main.js:1624-1642`)**

```javascript
ipcMain.handle('sync:get-pending-count', async () => {
  if (!db || !db.db) {
    return { success: false, error: 'Base de datos no disponible' };
  }

  const result = db.db.prepare(
    'SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0'
  ).get();

  return {
    success: true,
    count: result.count || 0
  };
});
```

**Handler: `sync:force-sync` (`pure/main.js:1648-1734`)**

```javascript
ipcMain.handle('sync:force-sync', async () => {
  console.log('🔄 [Sync Manual] Iniciando sincronización manual...');

  if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
    return {
      success: false,
      error: 'No hay conexión a Supabase'
    };
  }

  // Buscar tickets no sincronizados
  const pendingTickets = db.db.prepare(
    'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'
  ).all();

  if (pendingTickets.length === 0) {
    return {
      success: true,
      message: 'No hay tickets pendientes de sincronización',
      synced: 0,
      failed: 0
    };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const ticket of pendingTickets) {
    // ... lógica de sincronización igual al worker ...
  }

  return {
    success: true,
    message: `Sincronización completada: ${successCount} exitosos, ${errorCount} fallidos`,
    synced: successCount,
    failed: errorCount
  };
});
```

**Uso desde el Frontend:**

```javascript
// Obtener cantidad de tickets pendientes
const { count } = await window.api.invoke('sync:get-pending-count');
console.log(`Tickets pendientes: ${count}`);

// Forzar sincronización manual
const result = await window.api.invoke('sync:force-sync');
if (result.success) {
  alert(`Sincronizados: ${result.synced}, Fallidos: ${result.failed}`);
}
```

---

## 3. OPERADORES

### 🗄️ Dónde se guardan

**Supabase ÚNICAMENTE** - Tabla `operators`

No hay tabla de operadores en SQLite.

#### Crear Operador (`pure/main.js:950-1011`)

```javascript
ipcMain.handle('create-operator', async (event, operatorData) => {
  console.log('[create-operator] Creando operador:', operatorData);

  // ✅ SOLO SUPABASE - No hay SQLite
  const { data, error } = await supabaseManager.client
    .from('operators')
    .insert({
      name: operatorData.name,
      pin: operatorData.pin,
      role: operatorData.role.toLowerCase(),
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('[create-operator] Error:', error);
    return { success: false, error: error.message };
  }

  console.log('[create-operator] ✅ Operador creado:', data);
  return { success: true, operator: data };
});
```

#### Validar PIN de Operador (`pure/main.js:1013-1043`)

```javascript
ipcMain.handle('validate-operator-pin', async (event, pin) => {
  console.log('[validate-operator-pin] Validando PIN:', pin);

  // ✅ BUSCAR EN SUPABASE ÚNICAMENTE
  const { data, error } = await supabaseManager.client
    .from('operators')
    .select('*')
    .eq('pin', pin)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: 'PIN inválido o operador inactivo' };
  }

  console.log('[validate-operator-pin] ✅ Operador válido:', data.name);
  return {
    success: true,
    operator: {
      id: data.id,
      name: data.name,
      role: data.role.toUpperCase()
    }
  };
});
```

**¿Por qué no hay SQLite para operadores?**
- Los operadores deben estar sincronizados entre TODAS las mesas/cajas
- Si se guardaran localmente, un operador creado en Mesa 1 no existiría en Mesa 2
- Requiere conexión online para validar PINs (seguridad)

---

## 4. AUDITORÍA

### 📊 ¿De dónde lee los datos?

**Supabase PRIMERO, fallback a SQLite para tickets**

#### Código del Módulo (`pure/auditor.html:850-980`)

```javascript
async function cargarAuditoriaCompleta() {
  console.log('[auditor] Cargando datos de auditoría...');

  const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
  const fechaFin = document.getElementById('filtro-fecha-fin').value;

  // ✅ PASO 1: OBTENER TICKETS DE SUPABASE PRIMERO
  let tickets = [];
  let ticketsDesdeSupabase = false;

  try {
    const supabaseTickets = await window.api.invoke('audit:get-vouchers-supabase', {
      fechaInicio,
      fechaFin
    });

    if (supabaseTickets.success && supabaseTickets.data.length > 0) {
      tickets = supabaseTickets.data;
      ticketsDesdeSupabase = true;
      console.log(`✅ ${tickets.length} tickets obtenidos de Supabase`);
    }
  } catch (err) {
    console.warn('⚠️  Error obteniendo tickets de Supabase:', err);
  }

  // ✅ PASO 2: FALLBACK A SQLITE si Supabase falló
  if (!ticketsDesdeSupabase) {
    try {
      const sqliteTickets = await window.api.invoke('audit:get-vouchers-local', {
        fechaInicio,
        fechaFin
      });

      tickets = sqliteTickets.data || [];
      console.log(`✅ ${tickets.length} tickets obtenidos de SQLite local`);
    } catch (err) {
      console.error('❌ Error obteniendo tickets locales:', err);
    }
  }

  // ✅ PASO 3: OBTENER OPERADORES DE SUPABASE (no hay fallback)
  let operadores = [];
  try {
    const operadoresResult = await window.api.invoke('audit:get-operators-supabase');
    operadores = operadoresResult.data || [];
    console.log(`✅ ${operadores.length} operadores obtenidos`);
  } catch (err) {
    console.warn('⚠️  Error obteniendo operadores:', err);
  }

  // ✅ PASO 4: OBTENER USUARIOS DE SUPABASE (no hay fallback)
  let usuarios = [];
  try {
    const usuariosResult = await window.api.invoke('audit:get-users-supabase');
    usuarios = usuariosResult.data || [];
    console.log(`✅ ${usuarios.length} usuarios obtenidos`);
  } catch (err) {
    console.warn('⚠️  Error obteniendo usuarios:', err);
  }

  // ✅ PASO 5: CALCULAR MÉTRICAS
  mostrarMetricas(tickets, operadores, usuarios);
}
```

#### Handlers de Auditoría (`pure/main.js:1045-1120`)

```javascript
// Obtener tickets de Supabase
ipcMain.handle('audit:get-vouchers-supabase', async (event, filters) => {
  let query = supabaseManager.client
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.fechaInicio) {
    query = query.gte('created_at', filters.fechaInicio + 'T00:00:00');
  }
  if (filters.fechaFin) {
    query = query.lte('created_at', filters.fechaFin + 'T23:59:59');
  }

  const { data, error } = await query;
  return { success: !error, data: data || [] };
});

// Obtener tickets de SQLite (fallback)
ipcMain.handle('audit:get-vouchers-local', async (event, filters) => {
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (filters.fechaInicio) {
    sql += ' AND date(created_at) >= date(?)';
    params.push(filters.fechaInicio);
  }
  if (filters.fechaFin) {
    sql += ' AND date(created_at) <= date(?)';
    params.push(filters.fechaFin);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = db.db.prepare(sql).all(...params);
  return { success: true, data: rows };
});
```

**Estrategia "Cloud First, Local Fallback":**
- ✅ Tickets: Supabase primero, SQLite si falla
- ✅ Operadores: Solo Supabase (no hay local)
- ✅ Usuarios: Solo Supabase (no hay local)
- ✅ Esto asegura datos más frescos y sincronizados

---

## 5. SINCRONIZACIÓN Y DETECCIÓN ONLINE/OFFLINE

### 🌐 Detección Online/Offline

**Ping automático cada 30 segundos**

#### Código del Monitor (`pure/supabaseManager.js:47-85`)

```javascript
class SupabaseManager {
  async testConnection() {
    if (!this.client) {
      this.isConnected = false;
      return false;
    }

    try {
      // ✅ Ping simple a la tabla operators (rápido)
      const { error } = await this.client
        .from('operators')
        .select('id')
        .limit(1);

      this.isConnected = !error;
      return this.isConnected;
    } catch (err) {
      this.isConnected = false;
      return false;
    }
  }

  startConnectionMonitoring() {
    // ✅ Verificar conexión cada 30 segundos
    setInterval(async () => {
      const wasConnected = this.isConnected;
      const isNowConnected = await this.testConnection();

      if (wasConnected !== isNowConnected) {
        console.log(isNowConnected ?
          '✅ Conexión a Supabase restaurada' :
          '⚠️  Conexión a Supabase perdida - modo offline'
        );

        // Notificar a ventanas abiertas
        if (mainWindow) {
          mainWindow.webContents.send('supabase-connection-changed', isNowConnected);
        }
      }
    }, 30000); // 30 segundos
  }
}
```

#### Indicador Visual (`pure/health-indicator.html`)

```html
<!-- Indicador en esquina superior derecha -->
<div id="health-indicator" class="health-indicator">
  <span class="status-dot"></span>
  <span class="status-text">Online</span>
</div>
```

```javascript
// Listener de cambios de conexión
window.api.receive('supabase-connection-changed', (isConnected) => {
  const indicator = document.getElementById('health-indicator');
  const dot = indicator.querySelector('.status-dot');
  const text = indicator.querySelector('.status-text');

  if (isConnected) {
    dot.style.backgroundColor = '#4ade80';
    text.textContent = 'Online';
  } else {
    dot.style.backgroundColor = '#f87171';
    text.textContent = 'Offline';
  }
});
```

### 🔄 ¿Qué se sincroniza y cuándo?

#### Tabla de Sincronización

| Operación | SQLite | Supabase | Momento de Sync |
|-----------|--------|----------|-----------------|
| **Crear Ticket** | ✅ Inmediato | ✅ Inmediato + 🔄 Worker | Al crear + cada 2 min |
| **Validar Ticket** | ✅ Cache | 🔍 Lee primero | Al validar |
| **Canjear Ticket** | ✅ Inmediato | ✅ Inmediato + 🔄 Worker | Al canjear + cada 2 min |
| **Crear Usuario** | ❌ No | ✅ Inmediato | Al crear |
| **Login** | ❌ No | 🔍 Siempre | Al intentar login |
| **Crear Operador** | ❌ No | ✅ Inmediato | Al crear |
| **Validar PIN** | ❌ No | 🔍 Siempre | Al validar |
| **Auditoría** | 📖 Lectura fallback | 🔍 Lee primero | Al cargar módulo |
| **Sincronización** | 🔍 Query pendientes | ✅ Subir pendientes | 🔄 Cada 2 min (automático) |

#### Comportamiento por Modo

**MODO ONLINE (Supabase disponible):**
```javascript
// Tickets
CREATE → SQLite + Supabase (sync: 1)
VALIDATE → Lee de Supabase (cachea en SQLite)
REDEEM → Actualiza ambos (sync: 1)

// Usuarios
LOGIN → Solo Supabase Auth
CREATE → Solo Supabase (no local)

// Operadores
VALIDATE_PIN → Solo Supabase (no local)
CREATE → Solo Supabase (no local)

// Auditoría
LOAD → Lee de Supabase (datos frescos)
```

**MODO OFFLINE (Supabase NO disponible):**
```javascript
// Tickets
CREATE → Solo SQLite (sync: 0)
VALIDATE → Solo SQLite (datos cacheados)
REDEEM → Solo SQLite (sync: 0)

// Usuarios
LOGIN → ❌ FALLA (requiere Supabase)
CREATE → ❌ FALLA (requiere Supabase)

// Operadores
VALIDATE_PIN → ❌ FALLA (requiere Supabase)
CREATE → ❌ FALLA (requiere Supabase)

// Auditoría
LOAD → Lee de SQLite (datos locales)
```

### 📝 Tickets No Sincronizados

**Identificar tickets pendientes de sincronización:**

```javascript
// Handler IPC para obtener cantidad de tickets pendientes
ipcMain.handle('sync:get-pending-count', async () => {
  const result = db.db.prepare(
    'SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0'
  ).get();

  return { success: true, count: result.count || 0 };
});
```

**✅ SINCRONIZACIÓN AUTOMÁTICA**:
- El worker de sincronización se ejecuta **cada 2 minutos** automáticamente
- Busca todos los tickets con `sincronizado = 0`
- Los sube a Supabase en orden cronológico
- Marca como `sincronizado = 1` los exitosos
- Los que fallan se reintentarán en la próxima ejecución

**🔄 SINCRONIZACIÓN MANUAL**:
```javascript
// Forzar sincronización inmediata desde el frontend
const result = await window.api.invoke('sync:force-sync');
console.log(`Sincronizados: ${result.synced}, Fallidos: ${result.failed}`);
```

---

## 6. RESUMEN DE DECISIONES ARQUITECTÓNICAS

### ✅ Por qué Usuarios en Supabase únicamente

1. **Seguridad**: Hashing con bcrypt (más seguro que PBKDF2)
2. **Centralización**: Un usuario existe en TODAS las estaciones
3. **Auditoría**: Registro automático de intentos de login
4. **Permisos**: Sistema RLS de Supabase protege datos sensibles

### ✅ Por qué Tickets en Híbrido (SQLite + Supabase)

1. **Resiliencia**: Funciona offline (impresoras no pueden parar)
2. **Performance**: SQLite es más rápido para crear/imprimir
3. **Sincronización**: Supabase permite ver tickets entre mesas/cajas
4. **Fallback**: Si Supabase falla, la operación continúa

### ✅ Por qué Operadores solo en Supabase

1. **Consistencia**: Un operador debe existir en TODAS las mesas
2. **Validación en tiempo real**: PIN se valida contra datos frescos
3. **Sin offline**: Mesa sin conexión no debería operar

### ⚠️ Limitaciones Actuales

1. ~~**No hay reconciliación automática**: Tickets creados offline no se suben después~~ ✅ **IMPLEMENTADO** - Worker cada 2 minutos
2. **Login requiere conexión**: No hay modo offline para usuarios
3. **Validación de PIN requiere conexión**: Operadores no se cachean localmente
4. **No hay conflict resolution**: Si dos cajas canjean el mismo ticket offline, puede haber conflictos

### 🔮 Mejoras Futuras Recomendadas

1. ~~**Worker de sincronización**: Subir tickets no sincronizados cada N minutos~~ ✅ **COMPLETADO**
2. **Cache de operadores**: Permitir validación de PIN offline con datos cacheados
3. **Conflict resolution**: Detectar y resolver conflictos de tickets canjeados en múltiples cajas
4. **Sesión persistente**: Recordar login con tokens para evitar re-autenticación constante

---

## 7. DIAGRAMAS DE FLUJO

### Flujo: Crear Ticket

```
┌─────────────────┐
│ Usuario en Mesa │
│ Click "Emitir"  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ 1. Guardar en SQLite        │
│    (SIEMPRE funciona)       │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. ¿Supabase disponible?    │
└────┬────────────────────┬───┘
     │ SÍ                 │ NO
     ▼                    ▼
┌─────────────────┐  ┌──────────────────┐
│ Sincronizar     │  │ Marcar sync: 0   │
│ con Supabase    │  │ (pendiente)      │
└────┬────────────┘  └────┬─────────────┘
     │                    │
     ▼                    │
┌─────────────────┐       │
│ Marcar sync: 1  │       │
└────┬────────────┘       │
     │                    │
     └────────┬───────────┘
              │
              ▼
     ┌─────────────────┐
     │ 3. Generar PDF  │
     │    e Imprimir   │
     └─────────────────┘
```

### Flujo: Canjear Ticket

```
┌─────────────────┐
│ Usuario en Caja │
│ Escanea código  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ 1. Validar código            │
│    (Supabase → SQLite)       │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. ¿Estado = "active"?       │
└────┬──────────────────────┬──┘
     │ SÍ                   │ NO
     ▼                      ▼
┌─────────────────┐   ┌──────────────────┐
│ Continuar       │   │ Error: Ya        │
└────┬────────────┘   │ canjeado         │
     │                └──────────────────┘
     ▼
┌──────────────────────────────┐
│ 3. Actualizar Supabase       │
│    (si está online)          │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 4. Actualizar SQLite         │
│    estado = "canjeado"       │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 5. Registrar en Auditoría    │
│    (si Supabase disponible)  │
└────────┬─────────────────────┘
         │
         ▼
     ┌─────────────────┐
     │ ✅ Ticket        │
     │    Canjeado      │
     └─────────────────┘
```

### Flujo: Login

```
┌─────────────────┐
│ Usuario ingresa │
│ email/password  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ 1. signInWithPassword()      │
│    (anonClient)              │
└────┬─────────────────────┬───┘
     │ ✅                  │ ❌
     ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│ Auth exitoso    │   │ Error:           │
│ User ID: xxx    │   │ "Email o         │
└────┬────────────┘   │  contraseña      │
     │                │  incorrectos"    │
     ▼                └──────────────────┘
┌──────────────────────────────┐
│ 2. Obtener perfil            │
│    from users table          │
│    (SERVICE_ROLE client)     │
└────┬─────────────────────┬───┘
     │ ✅                  │ ❌
     ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│ Perfil obtenido │   │ Error:           │
└────┬────────────┘   │ "Usuario no      │
     │                │  encontrado"     │
     ▼                └──────────────────┘
┌──────────────────────────────┐
│ 3. Validar is_active = true  │
└────┬─────────────────────┬───┘
     │ SÍ                  │ NO
     ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│ 4. Guardar      │   │ Error:           │
│    sesión       │   │ "Usuario         │
│    en memoria   │   │  inactivo"       │
└────┬────────────┘   └──────────────────┘
     │
     ▼
┌─────────────────┐
│ ✅ Login        │
│    Exitoso      │
└─────────────────┘
```

---

## 8. CONFIGURACIÓN REQUERIDA

### Variables de Entorno (`.env`)

```env
# Supabase Connection
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...  # Para auth de usuarios
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Para operaciones admin

# SQLite Local
DB_PATH=./db/casino.db
```

### Estructura de Tablas

#### Supabase (`auth.users`)
```sql
-- Tabla gestionada por Supabase Auth
-- NO se modifica directamente
```

#### Supabase (`public.users`)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'caja', 'mesa', 'auditor')),
  pin_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

#### Supabase (`public.operators`)
```sql
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('mesa', 'caja')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

#### Supabase (`public.vouchers`)
```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'void')),
  issued_by_user_id UUID REFERENCES users(id),
  issued_at_station_id TEXT,
  redeemed_by_user_id UUID REFERENCES users(id),
  redeemed_at_station_id TEXT,
  created_at TIMESTAMP DEFAULT now(),
  redeemed_at TIMESTAMP
);
```

#### SQLite (`tickets`)
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  estado TEXT DEFAULT 'active',
  mesa TEXT,
  usuario_emision TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TEXT,
  redeemed_by TEXT,
  sincronizado INTEGER DEFAULT 0  -- 0: no sync, 1: synced
);
```

---

## CONCLUSIÓN

Este sistema usa una **arquitectura híbrida inteligente**:

- **Usuarios/Auth**: Solo Supabase (seguridad + centralización)
- **Tickets**: SQLite primero + Supabase sync (resiliencia + sincronización)
- **Operadores**: Solo Supabase (consistencia entre estaciones)
- **Auditoría**: Supabase primero, SQLite fallback (datos frescos + disponibilidad)

**Ventajas:**
✅ Funciona offline para operaciones críticas (emitir tickets)
✅ Sincroniza datos entre múltiples estaciones
✅ Seguridad centralizada con Supabase Auth
✅ Fallback local cuando la conexión falla

**Limitaciones:**
⚠️  Login requiere conexión (no hay cache de credenciales)
⚠️  Operadores requieren conexión (no hay cache de PINs)
⚠️  No hay reconciliación automática de tickets no sincronizados

**Recomendaciones:**
💡 Implementar worker de sincronización para tickets offline
💡 Cachear operadores localmente para validación offline
💡 Agregar sesión persistente con tokens JWT
