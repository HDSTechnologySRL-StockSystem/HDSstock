// ═══════════════════════════════════════════════════════
// src/core/auth.js
// Estado de sesión (in-memory), RBAC, seed admin.
// Depende de: constants.js, storage.js
// ═══════════════════════════════════════════════════════
'use strict';

// ── Estado in-memory de sesión ─────────────────────────
let currentUser = null;
let currentRol  = '';
let currentSede = '';

function getProfile(usr) {
  const u = loadUsers()[usr];
  if (u == null) return null;
  if (typeof u === 'string') return { pass: u, rol: '', sede: '' };
  return {
    pass: u.pass || '', rol: u.rol || '', sede: u.sede || '', mail: u.mail || '',
    estado: u.estado || 'activo', permisos: u.permisos || {},
    avatar: u.avatar || null, displayName: u.displayName || '',
    emailVerificado: u.emailVerificado || false,
  };
}
// Firma de la sesión para registrar en movimientos/peticiones
function currentSignature() {
  if (!currentUser) return 'Sistema';
  return currentRol ? `${currentUser} · ${currentRol}` : currentUser;
}

function canAccess(perm) {
  if (!currentUser) return false;
  if ((currentRol||'').toLowerCase() === 'administrador') return true;
  const prof = getProfile(currentUser);
  return !!(prof && prof.permisos && prof.permisos[perm]);

function _seedAdminIfNeeded() {
  const users = loadUsers();
  // Crear (o restaurar) la cuenta ADMIN siempre que no exista.
  // Si ya existe una cuenta ADMIN no la toca (respeta contraseña y datos).
  if (users['ADMIN']) return;

  const adminPerms = {};
  (PERMS_CATALOG || []).forEach(function(p) { adminPerms[p.key] = true; });

  users['ADMIN'] = {
    pass:           'admin1234',
    rol:            'Administrador',
    sede:           'HDS',
    mail:           '',
    estado:         'activo',
    emailVerificado: false,
    displayName:    'Administrador HDS',
    permisos:       adminPerms,
  };
  saveUsers(users);
  console.info('[HDS] Cuenta ADMIN creada. Credenciales: ADMIN / admin1234');
}

// Migración v2.9.1 — borra items de ejemplo hardcodeados que pueden haber
// quedado persistidos en hds_cells de versiones anteriores del sistema.
// Solo corre una vez (marca 'hds_mig_291' en localStorage).
// Lista de nombres de ejemplo que el sistema nunca debería generar por sí mismo.
const _EXAMPLE_ITEM_NAMES = new Set([
  'TORNILLOS','BULONES','TUERCAS','ARANDELAS',
  'ROD 6205','ROD 6304','ROD 6001',
  'LLAVE ALLEN 6','LLAVE ALLEN 8','DEST PH2',
