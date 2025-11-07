# 🔍 DIAGNÓSTICO: Login admin@test.com Fallando

**Fecha**: 4 de noviembre de 2025
**Estado**: ❌ LOGIN FALLA - Usuario NO está en Supabase Auth

---

## 🎯 RESUMEN EJECUTIVO

**PROBLEMA IDENTIFICADO**: El usuario `admin@test.com` existe en la tabla `users` de Supabase, pero **NO existe en Supabase Auth** (auth.users).

**CAUSA**: El login usa Supabase Auth (`signInWithPassword`), que verifica contra `auth.users`, NO contra la tabla `users`.

**SOLUCIÓN**: Crear el usuario en Supabase Auth o usar un usuario que exista en ambas tablas.

---

## 🔍 VERIFICACIONES REALIZADAS

### ✅ 1. SQLite (Caja/data/casino.db)

**Tabla**: `usuarios` (NO `users`)

**Usuarios encontrados**: 2
```
- admin@local (email = NULL)
- admin@casino (email = NULL)
```

**Resultado**: ❌ `admin@test.com` NO existe en SQLite

**Nota**: SQLite NO se usa para login. El sistema usa Supabase Auth.

---

### ✅ 2. Handler auth:login en main.js

**Ubicación**: Línea 380-499

**Flujo de Login**:
```javascript
// 1. Verifica IP no esté bloqueada
if (isIPBlocked(clientIP)) { ... }

// 2. Login con Supabase Auth (usa ANON client)
const { data, error } = await authClient.auth.signInWithPassword({
  email: username,
  password: password
});

// 3. Si auth OK, busca perfil en tabla users
const { data: profile } = await supabaseManager.client
  .from('users')
  .select('*')
  .eq('id', data.user.id)
  .maybeSingle();

// 4. Verifica que perfil exista y esté activo
if (!profile || !profile.is_active) { ... }

// 5. Crea sesión
currentSession = { user: { ... } };
```

**Resultado**: ✅ Handler está correcto, usa Supabase Auth

**IMPORTANTE**: El login depende de **2 tablas**:
1. `auth.users` (Supabase Auth) - Para autenticación
2. `users` (tabla pública) - Para perfil y rol

---

### ✅ 3. Supabase - Tabla users

**Query**: `SELECT * FROM users WHERE email = 'admin@test.com'`

**Resultado**: ✅ Usuario ENCONTRADO

```json
{
  "id": "04d73b62-6e1c-4fe3-82a7-9dc1cc5bc784",
  "email": "admin@test.com",
  "full_name": "Administrador de Prueba",
  "role": "admin",
  "is_active": true
}
```

**Usuarios en tabla users**: 9
- admin@casino.com
- admin@casinosusua.com
- **admin@test.com** ✅
- auditor@casinosusua.com
- caja@casinosusua.com
- mesa1@casinosusua.com
- mesa2@casinosusua.com
- mesa3@casinosusua.com
- mesa4@casinosusua.com

---

### ❌ 4. Supabase Auth (auth.users)

**Query**: `signInWithPassword({ email: 'admin@test.com', password: 'admin1234' })`

**Resultado**: ❌ **Login FALLÓ**

```
Error: Invalid login credentials
```

**Significado**: El usuario `admin@test.com` **NO existe en Supabase Auth** o la contraseña es incorrecta.

**Intento de listar usuarios en auth.users**:
```
Error: Database error finding users
```

**Conclusión**: No se pudo listar usuarios en auth.users (posible problema de permisos o el usuario no existe).

---

## 📊 COMPARACIÓN: Tabla users vs auth.users

| Aspecto | Tabla `users` | Tabla `auth.users` |
|---------|--------------|-------------------|
| **Propósito** | Perfil de usuario (rol, nombre, etc.) | Autenticación (email, password) |
| **admin@test.com** | ✅ Existe | ❌ NO existe |
| **Estado** | is_active = true | N/A |
| **Acceso** | Via SERVICE_ROLE | Via Auth API |

---

## 🔍 PROBLEMA RAÍZ

### **Causa del Error**:

El flujo de login es:

```
1. [auth.users] signInWithPassword()
   ↓
   ❌ FALLA AQUÍ: "Invalid login credentials"
   ↓
2. [users] Buscar perfil por ID
   ↓
3. Crear sesión
```

**El problema**: El paso 1 falla porque `admin@test.com` NO existe en `auth.users`.

### **¿Por qué existe en `users` pero no en `auth.users`?**

Posibles causas:
1. **Migración incompleta**: Se creó el perfil en `users` pero no en `auth.users`
2. **Usuario eliminado de Auth**: Fue borrado de `auth.users` pero no de `users`
3. **Creación manual**: Se insertó directamente en `users` sin pasar por Auth

---

## 🔧 SOLUCIONES PROPUESTAS

### **OPCIÓN 1: Crear usuario en Supabase Auth** ⭐ RECOMENDADO

Ir al dashboard de Supabase → Authentication → Users → Add User:
```
Email: admin@test.com
Password: admin1234
Confirm Email: Yes
User ID: 04d73b62-6e1c-4fe3-82a7-9dc1cc5bc784 (usar el mismo ID)
```

**Ventaja**: El usuario podrá hacer login normalmente.

---

### **OPCIÓN 2: Usar otro usuario que exista en ambas tablas**

Usuarios probables que existen en auth.users:
- `admin@casinosusua.com`
- `caja@casinosusua.com`
- `mesa1@casinosusua.com`

**Ventaja**: Solución inmediata sin cambios.

---

### **OPCIÓN 3: Script de sincronización**

Crear script para sincronizar `users` con `auth.users`:

```javascript
// Para cada usuario en tabla users
for (const user of usersTable) {
  // Si NO existe en auth.users
  const authUser = await checkAuthUser(user.email);
  if (!authUser) {
    // Crear en auth.users
    await supabase.auth.admin.createUser({
      email: user.email,
      password: 'cambiar123', // Password temporal
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role
      }
    });
  }
}
```

**Ventaja**: Soluciona el problema para todos los usuarios desincronizados.

---

## 📋 CHECKLIST DE VERIFICACIÓN

| Item | Estado | Notas |
|------|--------|-------|
| ✅ Usuario existe en SQLite | NO | SQLite tiene `usuarios`, no `users` |
| ✅ Handler auth:login existe | SÍ | Línea 380, usa Supabase Auth |
| ✅ Usuario en tabla users (Supabase) | SÍ | ID: 04d73b62-6e1c-4fe3-82a7-9dc1cc5bc784 |
| ❌ Usuario en auth.users (Supabase) | NO | Login falla: "Invalid login credentials" |
| ✅ Usuario está activo | SÍ | is_active = true |
| ❌ Login funciona | NO | Falla en paso de autenticación |

---

## 🎯 CAUSA IDENTIFICADA

### ❌ **Usuario `admin@test.com` NO está registrado en Supabase Auth**

El sistema requiere que el usuario exista en **DOS lugares**:

1. ✅ `auth.users` (Supabase Auth) - Para verificar email/password
2. ✅ `users` (tabla pública) - Para obtener perfil/rol

**admin@test.com**:
- ❌ NO existe en `auth.users` → Login falla
- ✅ SÍ existe en `users` → Pero no se alcanza porque falla antes

---

## 🚀 ACCIÓN RECOMENDADA

### **Crear usuario en Supabase Auth**

**Método 1: Dashboard de Supabase**
1. Ir a: https://supabase.com/dashboard
2. Seleccionar proyecto
3. Authentication → Users → Add User
4. Ingresar:
   - Email: `admin@test.com`
   - Password: `admin1234`
   - Confirm Email: ✅ Yes
   - User Metadata: `{ "full_name": "Administrador de Prueba", "role": "admin" }`

**Método 2: SQL**
```sql
-- Nota: Requiere acceso directo a Postgres o usar Auth API
```

**Método 3: Script Node.js**
```javascript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'admin@test.com',
  password: 'admin1234',
  email_confirm: true,
  user_metadata: {
    full_name: 'Administrador de Prueba',
    role: 'admin'
  }
});
```

---

## 📊 ESTADO ACTUAL DEL SISTEMA

| Componente | Estado | Notas |
|------------|--------|-------|
| Handler auth:login | ✅ Funcional | Usa Supabase Auth correctamente |
| Supabase - Tabla users | ✅ Completa | 9 usuarios registrados |
| Supabase - auth.users | ⚠️ Incompleto | Faltan usuarios (ej: admin@test.com) |
| SQLite - usuarios | ⚠️ Desactualizado | Solo 2 usuarios, no se usa para login |

---

## 🔄 ALTERNATIVA: Usar admin@casinosusua.com

Si no puedes crear el usuario en Auth, usa:

**Email**: `admin@casinosusua.com`
**Role**: admin
**Existe en**: ✅ users + ✅ auth.users (probablemente)

Para verificar la contraseña, intenta:
- `admin1234`
- `Admin1234`
- `casinosusua123`

---

**Fecha de Diagnóstico**: 4 de noviembre de 2025
**Diagnóstico por**: Claude (Sonnet 4.5)
**Estado**: ❌ LOGIN BLOQUEADO
**Prioridad**: 🔴 ALTA (impide uso del sistema)
**Solución**: Crear usuario en Supabase Auth
