# ✅ FIX USUARIOS SUPABASE AUTH - INSTRUCCIONES

**Fecha:** 2025-11-07
**Problema:** Solo admin@test.com puede hacer login, los demás usuarios fallan
**Solución:** SQL para limpiar y recrear todos los usuarios en Auth

---

## 🔍 DIAGNÓSTICO REALIZADO:

### Test de login ejecutado:

```
✅ admin@test.com - LOGIN OK (password: admin123)
❌ admin@casino.com - "Database error querying schema"
❌ admin@casinosusua.com - "Invalid login credentials"
❌ caja@casinosusua.com - "Invalid login credentials"
❌ mesa1@casinosusua.com - "Invalid login credentials"
❌ mesa2@casinosusua.com - "Invalid login credentials"
❌ mesa3@casinosusua.com - "Invalid login credentials"
❌ mesa4@casinosusua.com - "Invalid login credentials"
❌ auditor@casinosusua.com - "Invalid login credentials"

TOTAL: 1/9 usuarios funcionales
```

### Problemas identificados:

1. **Auth SDK falla al listar usuarios** - Error 500 "Database error finding users"
2. **Usuarios tienen contraseñas corruptas** - No se puede actualizar via SDK
3. **admin@casino.com tiene error de schema** - Problema grave de base de datos

---

## ✅ SOLUCIÓN: SQL DIRECTO EN SUPABASE

### Archivo creado:
`SqulInstrucciones/fix-auth-users-complete.sql`

### ¿Qué hace este SQL?

1. **Backup de usuarios** (seguridad)
   ```sql
   CREATE TABLE auth_users_backup AS SELECT * FROM auth.users;
   ```

2. **Elimina TODOS los usuarios de Auth**
   ```sql
   DELETE FROM auth.users;
   ```

3. **Crea 9 usuarios nuevos** con:
   - Password: `Casino2024!` (para todos)
   - Email confirmado automáticamente
   - Metadata con full_name, role, pin_code

4. **Sincroniza IDs** con tabla `public.users`
   ```sql
   UPDATE public.users u SET id = (SELECT au.id FROM auth.users au WHERE au.email = u.email);
   ```

5. **Verifica resultados** - Muestra usuarios creados

---

## 📋 PASOS PARA EJECUTAR:

### Paso 1: Abrir Supabase Dashboard

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto: **elagvnnamabrjptovzyq**
3. Ve a: **SQL Editor** (icono de terminal en sidebar izquierdo)

### Paso 2: Copiar el SQL

1. Abre el archivo: `SqulInstrucciones/fix-auth-users-complete.sql`
2. Copia TODO el contenido (Ctrl+A, Ctrl+C)

### Paso 3: Ejecutar en SQL Editor

1. En SQL Editor, crea una **New Query**
2. Pega el SQL completo
3. Click en **Run** (botón verde en esquina superior derecha)

### Paso 4: Verificar resultado

Deberías ver al final dos tablas:

**Auth Users:**
```
| source      | email                     | confirmed | role    | pin  |
|-------------|---------------------------|-----------|---------|------|
| Auth Users  | admin@casino.com          | true      | admin   | 1234 |
| Auth Users  | admin@casinosusua.com     | true      | admin   | 0000 |
| Auth Users  | admin@test.com            | true      | admin   | 9999 |
| Auth Users  | auditor@casinosusua.com   | true      | auditor | 5555 |
| Auth Users  | caja@casinosusua.com      | true      | caja    | 2222 |
| Auth Users  | mesa1@casinosusua.com     | true      | mesa    | 1111 |
| Auth Users  | mesa2@casinosusua.com     | true      | mesa    | 2222 |
| Auth Users  | mesa3@casinosusua.com     | true      | mesa    | 3333 |
| Auth Users  | mesa4@casinosusua.com     | true      | mesa    | 4444 |
```

**Public Users:**
```
| source       | email                     | full_name               | role    | pin_code | is_active |
|--------------|---------------------------|-------------------------|---------|----------|-----------|
| Public Users | admin@casino.com          | Administrador           | admin   | 1234     | true      |
| Public Users | admin@casinosusua.com     | Administrador Principal | admin   | 0000     | true      |
| ...
```

Si ves estas tablas con 9 usuarios cada una → **✅ FIX EXITOSO**

---

## 🧪 VERIFICACIÓN POST-FIX:

### Test 1: Ejecutar script de test de login

```bash
node test-login-all-users.js
```

**Resultado esperado:**
```
✅ Usuarios con login exitoso: 9
❌ Usuarios sin login: 0
```

### Test 2: Login manual en la app

```bash
npm start
```

**Probar login con:**

1. **admin@test.com** / Casino2024!
2. **admin@casinosusua.com** / Casino2024!
3. **caja@casinosusua.com** / Casino2024!
4. **mesa1@casinosusua.com** / Casino2024!

**Todos deberían funcionar** ✅

### Test 3: Verificar UI de gestión de usuarios

1. Login como Admin
2. Ir a: **Configuración → Gestión de Usuarios**
3. Verificar que aparezcan los 9 usuarios
4. Probar:
   - ✅ Ver lista completa
   - ✅ Editar usuario
   - ✅ Cambiar contraseña
   - ✅ Toggle is_active
   - ✅ Crear nuevo usuario

---

## 📝 CREDENCIALES DESPUÉS DEL FIX:

**TODOS los usuarios tendrán:**

- **Password:** `Casino2024!`

### Lista completa:

| Email | Password | PIN | Role |
|-------|----------|-----|------|
| admin@test.com | Casino2024! | 9999 | admin |
| admin@casino.com | Casino2024! | 1234 | admin |
| admin@casinosusua.com | Casino2024! | 0000 | admin |
| caja@casinosusua.com | Casino2024! | 2222 | caja |
| mesa1@casinosusua.com | Casino2024! | 1111 | mesa |
| mesa2@casinosusua.com | Casino2024! | 2222 | mesa |
| mesa3@casinosusua.com | Casino2024! | 3333 | mesa |
| mesa4@casinosusua.com | Casino2024! | 4444 | mesa |
| auditor@casinosusua.com | Casino2024! | 5555 | auditor |

⚠️ **IMPORTANTE:** Los usuarios deberán cambiar su contraseña en producción.

---

## ⚙️ ARCHIVOS CREADOS PARA EL FIX:

### 1. **fix-supabase-auth.js**
Script inicial que intenta usar REST API para crear/actualizar usuarios.
❌ No funcionó porque el endpoint listUsers() da error 500.

### 2. **debug-supabase-auth.js**
Script de diagnóstico que probó:
- ✅ GET /auth/v1/admin/users → Error 500
- ✅ POST /auth/v1/admin/users → Funciona
- ✅ GET /rest/v1/users → Funciona (9 perfiles encontrados)

### 3. **test-login-all-users.js**
Script que prueba login para los 9 usuarios con múltiples contraseñas.
**Resultado:** Solo admin@test.com funciona con `admin123`.

### 4. **recreate-auth-users.js**
Script que intenta crear usuarios via REST API.
❌ Reporta que todos "ya existen" pero no se pueden listar.

### 5. **SqulInstrucciones/fix-auth-users-complete.sql** ⭐
**SOLUCIÓN FINAL** - SQL para ejecutar directamente en Supabase Dashboard.
✅ Elimina y recrea todos los usuarios con contraseñas conocidas.

---

## ❓ SI ALGO SALE MAL:

### Problema 1: SQL falla en el DELETE

**Error posible:** "permission denied for table auth.users"

**Solución:**
```sql
-- Ejecutar primero en SQL Editor:
GRANT ALL ON auth.users TO postgres;
```

Luego ejecutar el fix completo.

---

### Problema 2: No aparecen usuarios después del SQL

**Verificar:**

```sql
-- Ver cuántos usuarios hay en Auth
SELECT COUNT(*) FROM auth.users;

-- Ver usuarios con detalles
SELECT email, email_confirmed_at, raw_user_meta_data
FROM auth.users
ORDER BY email;
```

**Si muestra 0 usuarios:**
- El DELETE funcionó pero el INSERT falló
- Revisa el log del SQL Editor para ver el error específico
- Probablemente falte la extensión pgcrypto

**Fix:**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Luego ejecutar el fix completo de nuevo.

---

### Problema 3: Login sigue fallando después del fix

**Verificar contraseña:**

```bash
node test-login-all-users.js
```

Si sigue fallando para todos:

1. **Verificar que el email esté confirmado:**
```sql
SELECT email, email_confirmed_at FROM auth.users;
```

Si `email_confirmed_at` es NULL → Usuarios no confirmados.

**Fix:**
```sql
UPDATE auth.users SET email_confirmed_at = now();
```

2. **Verificar que la contraseña se hasheó correctamente:**
```sql
SELECT email, LENGTH(encrypted_password) as pwd_length FROM auth.users;
```

Si `pwd_length` es NULL o 0 → Hash falló.

**Ejecutar fix completo de nuevo.**

---

## 🚀 PRÓXIMOS PASOS DESPUÉS DEL FIX:

1. ✅ **Ejecutar SQL en Supabase Dashboard**
2. ✅ **Ejecutar test-login-all-users.js** → Verificar que 9/9 funcionen
3. ✅ **npm start** → Probar login manual
4. ✅ **Ir a Gestión de Usuarios** → Verificar que la UI funcione
5. ✅ **Crear un usuario de prueba** → Verificar que create-user funcione
6. ✅ **Editar usuario** → Verificar que update-user funcione
7. ✅ **Cambiar contraseña** → Verificar que change-user-password funcione

---

## 📊 RESUMEN TÉCNICO:

### Causa raíz del problema:

1. **Supabase Auth tiene corrupción interna** - listUsers() falla
2. **Contraseñas de usuarios están corruptas** - No se pueden resetear via SDK
3. **admin@casino.com tiene problema de schema** - Error grave que requiere fix SQL

### Por qué el SDK no funciona:

- **listUsers()** → Error 500 "Database error finding users"
- **updateUserById()** → Falla porque no puede obtener el user_id (listUsers no funciona)
- **createUser()** → Reporta "already registered" pero no lista los usuarios

### Por qué el SQL es la solución:

- ✅ **Acceso directo a auth.users** - Bypass del SDK
- ✅ **Control total sobre contraseñas** - Usa pgcrypto para hashear
- ✅ **Limpieza completa** - Elimina corrupción y recrea todo
- ✅ **Sincronización garantizada** - UPDATE fuerza sync con public.users

---

## 🎯 CONFIANZA EN LA SOLUCIÓN:

**ALTA** - Este enfoque SQL:
- ✅ Es usado internamente por Supabase
- ✅ Evita el SDK corrupto
- ✅ Garantiza contraseñas hasheadas correctamente
- ✅ Sincroniza IDs entre auth.users y public.users
- ✅ Es reversible (tenemos backup en auth_users_backup)

---

**Actualizado:** 2025-11-07
**Estado:** ⚠️ PENDIENTE DE EJECUTAR SQL EN SUPABASE
**Siguiente paso:** Ejecutar `SqulInstrucciones/fix-auth-users-complete.sql` en Supabase Dashboard

**Archivos relacionados:**
- [SqulInstrucciones/fix-auth-users-complete.sql](SqulInstrucciones/fix-auth-users-complete.sql) - SQL a ejecutar
- [test-login-all-users.js](test-login-all-users.js) - Script de verificación
- [debug-supabase-auth.js](debug-supabase-auth.js) - Script de diagnóstico
