// src/main/security/roles.js
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const ROLE_FILE = path.join(app.getPath('userData'), 'role.json');
const DEFAULT_ROLE = (process.env.USER_ROLE || 'MESA').toUpperCase();

function readRole() {
  try {
    if (fs.existsSync(ROLE_FILE)) {
      const raw = fs.readFileSync(ROLE_FILE, 'utf8');
      const j = JSON.parse(raw);
      if (j && j.role) return String(j.role).toUpperCase();
    }
  } catch (e) {
    console.warn('[roles] No se pudo leer rol persistido:', e.message);
  }
  return DEFAULT_ROLE;
}

function writeRole(role) {
  const r = String(role || DEFAULT_ROLE).toUpperCase();
  try {
    fs.writeFileSync(ROLE_FILE, JSON.stringify({ role: r }, null, 2), 'utf8');
    return r;
  } catch (e) {
    console.warn('[roles] No se pudo escribir rol:', e.message);
    return r;
  }
}

function getRole() {
  return readRole();
}

const ROLES = { MESA: 'MESA', CAJA: 'CAJA', AUDITOR: 'AUDITOR', ADMIN: 'ADMIN' };

module.exports = { getRole, setRole: writeRole, ROLES };
