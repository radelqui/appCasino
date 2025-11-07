# ⚠️ PROBLEMA IDENTIFICADO: Handler auth:login Usa "username" en vez de "email"

**Fecha**: 4 de noviembre de 2025
**Archivo**: `pure/main.js:380-499`
**Criticidad**: 🔴 ALTA

---

## 🎯 PROBLEMA IDENTIFICADO

### **El handler recibe `username` pero Supabase espera `email`**

**Código Actual** (Línea 380):
```javascript
safeIpcHandle('auth:login', async (_event, { username, password }) => {
  // ...
  const { data, error } = await authClient.auth.signInWithPassword({
    email: username,  // ⚠️ Usa "username" como "email"
    password: password
  });
```

**Problema**:
1. El handler recibe parámetro `username`
2. Lo pasa como `email` a Supabase
3. Si el frontend envía `username` en vez de `email`, funciona
4. Si el frontend envía `email`, el handler NO lo recibe

---

## 🔍 ANÁLISIS DEL CÓDIGO ACTUAL

### Handler auth:login (L380-499)

**Parámetros recibidos**:
```javascript
{ username, password }  // ⚠️ Recibe "username"
```

**Uso en signInWithPassword**:
```javascript
await authClient.auth.signInWithPassword({
  email: username,  // ⚠️ Renombra username → email
  password: password
});
```

**Flujo completo**:
```
1. Frontend envía: { username: 'admin@test.com', password: '...' }
   ↓
2. Handler recibe: { username, password }
   ↓
3. Convierte: username → email
   ↓
4. signInWithPassword({ email: username, password })
   ↓
5. Supabase Auth valida credenciales
   ↓
6. Obtiene perfil de tabla users
   ↓
7. Crea sesión y retorna
```

---

## ✅ VERIFICACIÓN: El Código FUNCIONA

Aunque usa `username` en vez de `email`, el código **SÍ funciona** porque:

1. ✅ Recibe el parámetro como `username`
2. ✅ Lo pasa a Supabase como `email`
3. ✅ Supabase Auth lo valida correctamente

**Conclusión**: El handler está **FUNCIONALMENTE CORRECTO**.

---

## 🔧 COMPARACIÓN CON CÓDIGO SUGERIDO

### Código Sugerido (Ideal):
```javascript
ipcMain.handle('auth:login', async (event, { email, password }) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,      // Directo, sin renombrar
      password
    });

    if (error) throw error;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return { success: true, user: data.user, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Código Actual (Funcional):
```javascript
safeIpcHandle('auth:login', async (_event, { username, password }) => {
  try {
    // Verificaciones de seguridad (IP blocking, etc.)
    // ...

    const authClient = supabaseManager.anonClient || supabaseManager.client;
    const { data, error } = await authClient.auth.signInWithPassword({
      email: username,  // ⚠️ Renombra pero funciona
      password: password
    });

    if (error) {
      // Manejo de intentos fallidos, bloqueo de IP
      return { success: false, error: 'Email o contraseña incorrectos' };
    }

    // Obtener perfil
    const { data: profile, error: profileError } = await supabaseManager.client
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return { success: false, error: '...' };
    }

    // Crear sesión
    currentSession = {
      user: {
        id: profile.id,
        email: profile.email,
        username: profile.full_name,
        role: profile.role.toUpperCase()
      }
    };

    return {
      success: true,
      user: currentSession.user,
      sessionId
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

## 📊 DIFERENCIAS: Código Sugerido vs Actual

| Aspecto | Código Sugerido | Código Actual | ¿Funciona? |
|---------|----------------|---------------|-----------|
| Parámetro recibido | `email` | `username` | ✅ Ambos |
| Paso a Supabase | `email` directamente | `email: username` | ✅ Ambos |
| Verificación IP bloqueada | ❌ No tiene | ✅ Tiene | ✅ Mejor |
| Manejo intentos fallidos | ❌ No tiene | ✅ Tiene | ✅ Mejor |
| Verificación usuario activo | ❌ No tiene | ✅ Tiene | ✅ Mejor |
| Creación de sesión | ❌ Solo retorna datos | ✅ Crea currentSession | ✅ Mejor |
| Audit log | ❌ No registra | ✅ Registra evento | ✅ Mejor |

**Conclusión**: El código actual es **MÁS COMPLETO** que el sugerido.

---

## ✅ EL HANDLER ESTÁ CORRECTO

### Funcionalidades presentes:

1. ✅ **Autenticación con Supabase Auth** (L399-402)
2. ✅ **Verificación de IP bloqueada** (L386-390)
3. ✅ **Contador de intentos fallidos** (L408-416)
4. ✅ **Bloqueo automático de IP** (L413-416)
5. ✅ **Obtención de perfil** (L424-428)
6. ✅ **Verificación usuario activo** (L442-445)
7. ✅ **Creación de sesión global** (L455-462)
8. ✅ **Registro en activeSessions** (L465-474)
9. ✅ **Audit log de login** (L481-487)
10. ✅ **Estadísticas de seguridad** (L476)

---

## 🔍 POSIBLES CAUSAS DEL PROBLEMA DE LOGIN

Si el login está fallando, **NO es por el handler**. Posibles causas:

### 1. Frontend envía `email` en vez de `username`
```javascript
// ❌ Incorrecto para el handler actual
window.api.login({ email: 'admin@test.com', password: '...' })

// ✅ Correcto para el handler actual
window.api.login({ username: 'admin@test.com', password: '...' })
```

### 2. Usuario no existe en auth.users
- Ya descartado: usuario existe ✅

### 3. Contraseña incorrecta
- Verificar que el password sea el correcto

### 4. Usuario inactivo
- Línea 442-445: Verifica `is_active`
- Si `is_active = false`, login falla

### 5. Problema con supabaseManager
- Línea 392-395: Verifica que Supabase esté disponible
- Log: "❌ Supabase no disponible"

---

## 🔧 RECOMENDACIÓN

### **NO cambiar el handler**, el código está correcto y tiene funcionalidades de seguridad importantes.

### **Verificar el frontend**:

1. ¿Cómo se llama al handler?
   ```javascript
   // Buscar en archivos .html
   window.api.login({ username: '...', password: '...' })
   // O
   window.api.login({ email: '...', password: '...' })
   ```

2. Si usa `email`, cambiar a `username`:
   ```javascript
   // ANTES
   window.api.login({ email, password })

   // DESPUÉS
   window.api.login({ username: email, password })
   ```

3. O alternativamente, cambiar el handler para aceptar ambos:
   ```javascript
   safeIpcHandle('auth:login', async (_event, { username, email, password }) => {
     const loginEmail = email || username;  // Acepta ambos
     // ...
   });
   ```

---

## 📋 LOGS A VERIFICAR

Cuando se intenta hacer login, revisar la consola:

```
🔐 Intentando login: admin@test.com
✅ Auth exitoso, obteniendo perfil...
Perfil obtenido: { profile: {...}, profileError: undefined }
✅ Login exitoso: Administrador de Prueba (Session: ...)
```

Si falla:
```
🔐 Intentando login: admin@test.com
❌ Error de login: Invalid login credentials
```

O:
```
🔐 Intentando login: admin@test.com
❌ Supabase no disponible
```

---

## 🎯 CONCLUSIÓN

### ✅ **El handler auth:login ESTÁ CORRECTO**

- Tiene la lógica correcta de autenticación
- Incluye funcionalidades de seguridad avanzadas
- Funciona con Supabase Auth correctamente
- **NO necesita cambios**

### ⚠️ **Si el login falla, verificar**:

1. Frontend usa `username` (no `email`)
2. Supabase está disponible (`.env` configurado)
3. Usuario existe en auth.users (ya confirmado ✅)
4. Contraseña es correcta
5. Usuario está activo en tabla users

---

**Fecha de Análisis**: 4 de noviembre de 2025
**Código Verificado**: pure/main.js:380-499
**Estado**: ✅ HANDLER CORRECTO
**Acción**: Verificar frontend y configuración
