// ═══════════════════════════════════════════════════════
// src/usuarios/usuarios.js
// Panel de gestión de usuarios (Admin):
//   - goUsers / renderUsersPanel
//   - approveUser / rejectUser / deleteUser / changeUserRol
//   - toggleUserPerm / togglePermGroup / togglePermGroupAll
//   - applyUserPreset / _refreshGroupCount / _permIcon
//   - loadAccessReqs / saveAccessReqs / notifyAdminNewUser
//   - surfaceAccessRequests / updateUsersBadge
// Perfil de usuario:
//   - openMyProfile / closeMyProfile / renderProfileBody
//   - _buildReadonlyPerms / _onAvatarFileSelected
//   - _resizeAvatarImage / _persistAvatar / _removeAvatar
//   - saveProfileBasics / saveProfileMail / saveProfilePassword
// Depende de: auth.js, storage.js, utils.js,
//             constants.js (PERMS_CATALOG, PERMS_GROUPS, ROLES)
//             shared/toast.js
// ═══════════════════════════════════════════════════════
'use strict';

let _profileAvatarTemp = null;

function goUsers() {
  const isAdmin = (currentRol||'').toLowerCase() === 'administrador';
  if (!isAdmin && !canAccess('accesUsuarios')) {
    showToast({ type:'danger', title:'Sin acceso', msg:'No tenés permiso para ver este panel.' }); return;
  }
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('on'); });
  const sc = document.getElementById('sc-users');
  if (sc) { sc.classList.add('on'); renderUsersPanel(); }
}
function renderUsersPanel() {
  const users   = loadUsers();
  const pending = Object.entries(users).filter(function([,u]) { return u.estado === 'pendiente'; });
  const active  = Object.entries(users).filter(function([,u]) { return u.estado !== 'pendiente'; });
  let html = '';

  // ── Solicitudes pendientes ──────────────────────────────────────────────
  html += '<div class="usr-section-title">⏳ Solicitudes pendientes</div>';
  if (!pending.length) {
    html += '<div class="usr-empty" style="margin-bottom:6px">No hay solicitudes pendientes.</div>';
  }
  pending.forEach(function([usr, u]) {
    const emailOk = u.emailVerificado ? '✓ email verificado' : '⚠ email no verificado';
    html += '<div class="usr-card pending">'
      + '<div class="usr-card-top">'
      + '<div class="usr-card-info"><div class="usr-av">' + usr.charAt(0) + '</div>'
      + '<div><div class="usr-name">' + esc(usr) + '</div>'
      + '<div class="usr-meta">' + esc(u.mail||'sin mail') + ' · ' + emailOk + '</div></div></div>'
      + '<div class="usr-actions">'
      + '<button class="usr-btn approve" onclick="approveUser(\'' + esc(usr) + '\')">✓ Aprobar</button>'
      + '<button class="usr-btn reject"  onclick="rejectUser(\''  + esc(usr) + '\')">✗ Rechazar</button>'
      + '<button class="usr-btn delete"  onclick="deleteUser(\'' + esc(usr) + '\')" title="Eliminar">🗑</button>'
      + '</div></div></div>';
  });

  // ── Usuarios activos ────────────────────────────────────────────────────
  html += '<div class="usr-section-title" style="margin-top:20px">👤 Usuarios del sistema</div>';
  if (!active.length) {
    html += '<div class="usr-empty">No hay usuarios activos todavía.</div>';
  }

  active.forEach(function([usr, u]) {
    const perms   = u.permisos || {};
    const isAdmin = (u.rol||'').toLowerCase() === 'administrador';
    const isSelf  = usr === currentUser;
    const avClass = isAdmin ? 'usr-av admin' : 'usr-av';
    const avInner = u.avatar
      ? '<img src="' + u.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>'
      : (u.displayName||usr).charAt(0).toUpperCase();
    const adminBadge = isAdmin ? ' <span class="usr-badge-admin">Admin</span>' : '';
    const selfBadge  = isSelf  ? ' <span style="font-size:10px;color:var(--muted)">(vos)</span>' : '';
    const rolOptions = ['Operario','Supervisor','Encargado','Administrador'].map(function(r) {
      return '<option value="' + r + '"' + (u.rol===r?' selected':'') + '>' + r + '</option>';
    }).join('');
    const deleteBtn = isSelf ? '' : '<button class="usr-btn delete" onclick="deleteUser(\'' + esc(usr) + '\')" title="Eliminar usuario">🗑 Eliminar</button>';
    const canEdit   = !isSelf; // no auto-edit-perms

    // ── Presets rápidos ──────────────────────────────────────────────────
    const presetBar = isAdmin ? '' :
      '<div class="usr-preset-bar">'
      + '<span class="usr-preset-lbl">Perfil rápido:</span>'
      + '<button class="usr-preset-btn" onclick="applyUserPreset(\'' + esc(usr) + '\',\'operario\')">Operario</button>'
      + '<button class="usr-preset-btn" onclick="applyUserPreset(\'' + esc(usr) + '\',\'supervisor\')">Supervisor</button>'
      + '<button class="usr-preset-btn" onclick="applyUserPreset(\'' + esc(usr) + '\',\'encargado\')">Encargado</button>'
      + '<button class="usr-preset-btn danger" onclick="applyUserPreset(\'' + esc(usr) + '\',\'ninguno\')">Sin acceso</button>'
      + '</div>';

    // ── Grupos de permisos con acordeón ─────────────────────────────────
    let permGroupsHtml = '';
    Object.keys(PERMS_GROUPS).forEach(function(g) {
      const gPerms = PERMS_CATALOG.filter(function(p){ return p.group===g; });
      if (!gPerms.length) return;

      // Contar cuántos tiene activos en este grupo
      const activeCount = isAdmin ? gPerms.length : gPerms.filter(function(p){ return perms[p.key]; }).length;
      const totalCount  = gPerms.length;
      const allOn  = activeCount === totalCount;
      const someOn = activeCount > 0 && !allOn;

      // Checkbox "todos" del grupo
      const groupToggleId = 'gtog-' + g + '-' + usr.replace(/[^a-zA-Z0-9]/g,'_');
      const groupChecked  = (isAdmin || allOn) ? ' checked' : '';
      const groupIndet    = someOn ? ' data-indet="1"' : '';
      const groupDisabled = isAdmin ? ' disabled' : '';

      permGroupsHtml += '<div class="usr-perm-group">'
        + '<div class="usr-perm-group-head" onclick="togglePermGroup(\'' + esc(usr) + '\',\'' + g + '\')" style="cursor:pointer">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + PERMS_GROUPS[g]
        + '<span class="usr-perm-count">' + activeCount + '/' + totalCount + '</span>'
        + '</div>'
        + '<label class="usr-perm-toggle-all" onclick="event.stopPropagation()" title="Activar/desactivar todo el grupo">'
        + '<input type="checkbox" class="usr-group-chk" id="' + groupToggleId + '"'
        + groupChecked + groupIndet + groupDisabled
        + ' onchange="togglePermGroupAll(\'' + esc(usr) + '\',\'' + g + '\',this.checked)"/>'
        + '<span style="font-size:10px;font-weight:600;color:var(--muted)">Todo</span>'
        + '</label>'
        + '</div>'
        + '<div class="usr-perm-row" id="prow-' + g + '-' + usr.replace(/[^a-zA-Z0-9]/g,'_') + '">';

      gPerms.forEach(function(p) {
        const checked  = (isAdmin || perms[p.key]) ? ' checked' : '';
        const disabled = isAdmin ? ' disabled' : '';
        const cls      = isAdmin ? 'usr-perm-toggle disabled' : 'usr-perm-toggle';
        const onChange = (isAdmin || !canEdit) ? '' : ' onchange="toggleUserPerm(\'' + esc(usr) + '\',\'' + p.key + '\',this.checked)"';
        // Icono por categoría
        const ico = _permIcon(p.key);
        permGroupsHtml += '<label class="' + cls + '" title="' + esc(p.label) + '">'
          + '<input type="checkbox"' + checked + disabled + onChange + '/>'
          + '<span class="usr-perm-label">' + ico + ' ' + esc(p.label) + '</span>'
          + '</label>';
      });
      permGroupsHtml += '</div></div>';
    });

    html += '<div class="usr-card" id="ucard-' + usr.replace(/[^a-zA-Z0-9]/g,'_') + '">'
      + '<div class="usr-card-top">'
      + '<div class="usr-card-info"><div class="' + avClass + '">' + avInner + '</div>'
      + '<div><div class="usr-name">'
      + (u.displayName ? esc(u.displayName) + ' <span style="font-weight:500;color:var(--muted);font-size:10px">(' + esc(usr) + ')</span>' : esc(usr))
      + adminBadge + selfBadge + '</div>'
      + '<div class="usr-meta">' + esc(u.mail||'sin mail') + ' · ' + esc(u.sede||'HDS')
      + ' · <span style="color:var(--accent);font-weight:600">' + esc(u.rol||'Operario') + '</span></div>'
      + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<select class="usr-rol-select" onchange="changeUserRol(\'' + esc(usr) + '\',this.value)"'
      + (isSelf?' disabled':'') + '>' + rolOptions + '</select>'
      + deleteBtn
      + '</div></div>'
      + presetBar
      + '<div class="usr-perm-groups">' + permGroupsHtml + '</div>'
      + '</div>';
  });

  DOM.get('usr-list').innerHTML = html;

  // Marcar checkboxes indeterminados (estado mixto del grupo)
  document.querySelectorAll('.usr-group-chk[data-indet]').forEach(function(chk) {
    chk.indeterminate = true;
  });
}
function approveUser(usr) {
  const users = loadUsers(); if (!users[usr]) return;
  users[usr].estado = 'activo';
  // Permisos por defecto para usuario aprobado (Operario base)
  const defaults = {
    // Navegación
    accesNave1:true, accesNave2:true,
    accesMovimientos:false, accesPeticiones:true,
    accesEstadisticas:false, accesStockGeneral:false, accesUsuarios:false,
    // Stock
    verStock:true, sumarStock:false, restarStock:false,
    modificarStock:false, agregarProductos:false, eliminarProductos:false,
    verPrecios:false, editarPrecios:false, verQR:true,
    // Estantes
    crearEstantes:false, moverEstantes:false, rotarEstantes:false,
    colorEstantes:false, borrarEstantes:false, renombrarEstantes:false,
    renombrarNaves:false, editarCategorias:false,
    // Movimientos
    verMovimientos:false, exportarMovimientos:false, borrarMovimientos:false,
    // Peticiones
    hacerPeticiones:true, aprobarPeticiones:false,
    borrarPeticiones:false, verTodasPeticiones:false,
    // Balances
    verBalances:false, verHistoricoAnual:false, tomarSnapshotAnual:false,
    // Usuarios
    aprobarUsuarios:false, eliminarUsuarios:false,
    cambiarRoles:false, editarPermisos:false,
  };
  users[usr].permisos = Object.assign(defaults, users[usr].permisos || {});
  saveUsers(users);
  const reqs = loadAccessReqs().filter(function(r) { return r.user !== usr; });
  saveAccessReqs(reqs);
  updateUsersBadge();
  showToast({ type:'success', title:'Usuario aprobado', msg: usr + ' ya puede ingresar' });
  renderUsersPanel();
}
function rejectUser(usr) {
  const users = loadUsers(); delete users[usr]; saveUsers(users);
  const reqs = loadAccessReqs().filter(function(r){ return r.user!==usr; }); saveAccessReqs(reqs);
  updateUsersBadge();
  showToast({ type:'danger', title:'Solicitud rechazada', msg: usr + ' fue eliminado del sistema' });
  renderUsersPanel();
}
function deleteUser(usr) {
  if (!confirm('Borrar al usuario "' + usr + '"? Esta acci\u00f3n no se puede deshacer.')) return;
  const users = loadUsers(); delete users[usr]; saveUsers(users);
  const reqs = loadAccessReqs().filter(function(r){ return r.user!==usr; }); saveAccessReqs(reqs);
  updateUsersBadge();
  showToast({ type:'danger', title:'Usuario eliminado', msg: usr + ' fue borrado del sistema' });
  renderUsersPanel();
}
function changeUserRol(usr, rol) {
  const users = loadUsers(); if (!users[usr]) return;
  users[usr].rol = rol; saveUsers(users);
  showToast({ type:'success', title:'Rol actualizado', msg: usr + ' \u2192 ' + rol });
  renderUsersPanel();
}
function toggleUserPerm(usr, perm, val) {
  const users = loadUsers(); if (!users[usr]) return;
  users[usr].permisos = users[usr].permisos || {};
  users[usr].permisos[perm] = val; saveUsers(users);
  // Actualizar contador del grupo en tiempo real
  _refreshGroupCount(usr, perm);
}

/** Expande/colapsa el panel de permisos de un grupo */
function togglePermGroup(usr, group) {
  const safeUsr = usr.replace(/[^a-zA-Z0-9]/g,'_');
  const row = document.getElementById('prow-' + group + '-' + safeUsr);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : '';
  const head = row.previousElementSibling;
  if (head) head.classList.toggle('collapsed', isOpen);
}

/** Activa/desactiva TODOS los permisos de un grupo de un usuario */
function togglePermGroupAll(usr, group, val) {
  const users = loadUsers(); if (!users[usr]) return;
  users[usr].permisos = users[usr].permisos || {};
  PERMS_CATALOG.filter(function(p){ return p.group===group; }).forEach(function(p) {
    users[usr].permisos[p.key] = val;
  });
  saveUsers(users);
  // Sincronizar checkboxes individuales
  const safeUsr = usr.replace(/[^a-zA-Z0-9]/g,'_');
  const row = document.getElementById('prow-' + group + '-' + safeUsr);
  if (row) {
    row.querySelectorAll('input[type=checkbox]').forEach(function(chk) {
      chk.checked = val;
    });
  }
  // Actualizar contadores
  PERMS_CATALOG.filter(function(p){ return p.group===group; }).forEach(function(p) {
    _refreshGroupCount(usr, p.key);
  });
  showToast({
    type: val ? 'success' : 'info',
    title: val ? '✓ Permisos activados' : 'Permisos desactivados',
    msg: PERMS_GROUPS[group] + ' — ' + usr,
    duration: 2500,
  });
}

/** Aplica un preset de permisos estándar */
function applyUserPreset(usr, preset) {
  const users = loadUsers(); if (!users[usr]) return;
  const PRESETS = {
    operario: {
      accesNave1:true, accesNave2:true,
      accesMovimientos:false, accesPeticiones:true,
      accesEstadisticas:false, accesStockGeneral:false, accesUsuarios:false,
      verStock:true, sumarStock:false, restarStock:false,
      modificarStock:false, agregarProductos:false, eliminarProductos:false,
      verPrecios:false, editarPrecios:false, verQR:true,
      crearEstantes:false, moverEstantes:false, rotarEstantes:false,
      colorEstantes:false, borrarEstantes:false, renombrarEstantes:false,
      renombrarNaves:false, editarCategorias:false,
      verMovimientos:false, exportarMovimientos:false, borrarMovimientos:false,
      hacerPeticiones:true, aprobarPeticiones:false, borrarPeticiones:false, verTodasPeticiones:false,
      verBalances:false, verHistoricoAnual:false, tomarSnapshotAnual:false,
      aprobarUsuarios:false, eliminarUsuarios:false, cambiarRoles:false, editarPermisos:false,
    },
    supervisor: {
      accesNave1:true, accesNave2:true,
      accesMovimientos:true, accesPeticiones:true,
      accesEstadisticas:true, accesStockGeneral:true, accesUsuarios:false,
      verStock:true, sumarStock:true, restarStock:true,
      modificarStock:true, agregarProductos:true, eliminarProductos:false,
      verPrecios:true, editarPrecios:false, verQR:true,
      crearEstantes:false, moverEstantes:false, rotarEstantes:false,
      colorEstantes:true, borrarEstantes:false, renombrarEstantes:true,
      renombrarNaves:false, editarCategorias:true,
      verMovimientos:true, exportarMovimientos:true, borrarMovimientos:false,
      hacerPeticiones:true, aprobarPeticiones:false, borrarPeticiones:false, verTodasPeticiones:true,
      verBalances:true, verHistoricoAnual:true, tomarSnapshotAnual:false,
      aprobarUsuarios:false, eliminarUsuarios:false, cambiarRoles:false, editarPermisos:false,
    },
    encargado: {
      accesNave1:true, accesNave2:true,
      accesMovimientos:true, accesPeticiones:true,
      accesEstadisticas:true, accesStockGeneral:true, accesUsuarios:false,
      verStock:true, sumarStock:true, restarStock:true,
      modificarStock:true, agregarProductos:true, eliminarProductos:true,
      verPrecios:true, editarPrecios:true, verQR:true,
      crearEstantes:true, moverEstantes:true, rotarEstantes:true,
      colorEstantes:true, borrarEstantes:true, renombrarEstantes:true,
      renombrarNaves:true, editarCategorias:true,
      verMovimientos:true, exportarMovimientos:true, borrarMovimientos:true,
      hacerPeticiones:true, aprobarPeticiones:true, borrarPeticiones:true, verTodasPeticiones:true,
      verBalances:true, verHistoricoAnual:true, tomarSnapshotAnual:true,
      aprobarUsuarios:false, eliminarUsuarios:false, cambiarRoles:false, editarPermisos:false,
    },
    ninguno: {}, // todos en false
  };
  const base = {};
  PERMS_CATALOG.forEach(function(p){ base[p.key] = false; });
  users[usr].permisos = Object.assign(base, PRESETS[preset] || {});
  saveUsers(users);
  showToast({ type:'success', title:'Perfil aplicado', msg: usr + ' → ' + preset.charAt(0).toUpperCase() + preset.slice(1), duration:2800 });
  renderUsersPanel();
}

/** Actualiza el contador N/Total de un grupo sin re-renderizar toda la tarjeta */
function _refreshGroupCount(usr, changedPermKey) {
  const p = PERMS_CATALOG.find(function(x){ return x.key === changedPermKey; });
  if (!p) return;
  const g = p.group;
  const safeUsr = usr.replace(/[^a-zA-Z0-9]/g,'_');
  const row = document.getElementById('prow-' + g + '-' + safeUsr);
  if (!row) return;
  const total   = PERMS_CATALOG.filter(function(x){ return x.group===g; }).length;
  const checked = row.querySelectorAll('input[type=checkbox]:checked').length;
  const head    = row.previousElementSibling;
  if (head) {
    const cnt = head.querySelector('.usr-perm-count');
    if (cnt) cnt.textContent = checked + '/' + total;
    // Actualizar el checkbox "Todo" del grupo
    const groupChk = document.getElementById('gtog-' + g + '-' + safeUsr);
    if (groupChk) {
      groupChk.checked       = checked === total;
      groupChk.indeterminate = checked > 0 && checked < total;
    }
  }
}

/** Retorna un emoji/icono para cada tipo de permiso */
function _permIcon(key) {
  const icons = {
    accesNave1:'🏭', accesNave2:'🏭', accesMovimientos:'🔄', accesPeticiones:'📋',
    accesEstadisticas:'📊', accesStockGeneral:'📦', accesUsuarios:'👤',
    verStock:'👁', sumarStock:'➕', restarStock:'➖', modificarStock:'✏️',
    agregarProductos:'🆕', eliminarProductos:'🗑', verPrecios:'💲',
    editarPrecios:'💱', verQR:'📷',
    crearEstantes:'🏗', moverEstantes:'↔️', rotarEstantes:'🔄',
    colorEstantes:'🎨', borrarEstantes:'❌', renombrarEstantes:'🔤',
    renombrarNaves:'✏️', editarCategorias:'🏷',
    verMovimientos:'📜', exportarMovimientos:'📤', borrarMovimientos:'🗑',
    hacerPeticiones:'📝', aprobarPeticiones:'✅', borrarPeticiones:'🗑', verTodasPeticiones:'👁',
    verBalances:'📈', verHistoricoAnual:'📅', tomarSnapshotAnual:'📸',
    aprobarUsuarios:'👍', eliminarUsuarios:'🚫', cambiarRoles:'🎭', editarPermisos:'🔑',
  };
  return icons[key] || '';
}

// ── Exponer al scope global (para onclick en HTML) ───────────────────────────
window.togglePermGroup    = togglePermGroup;
window.togglePermGroupAll = togglePermGroupAll;
window.applyUserPreset    = applyUserPreset;
function loadAccessReqs() { try { return JSON.parse(localStorage.getItem('hds_access_reqs')||'[]'); } catch { return []; } }
function saveAccessReqs(a) { try { localStorage.setItem('hds_access_reqs', JSON.stringify(a)); } catch {} }
function notifyAdminNewUser(usr) {
  const reqs = loadAccessReqs();
  if (!reqs.some(function(r){ return r.user===usr; })) {
    reqs.unshift({ user:usr, fecha: localDateTime() });
    saveAccessReqs(reqs);
  }
}
function surfaceAccessRequests() {
  if ((currentRol||'').toLowerCase() !== 'administrador') return;
  updateUsersBadge();
  const pending = Object.entries(loadUsers()).filter(function([,u]){ return u.estado==='pendiente'; });
  if (!pending.length) return;
  pending.slice(0,3).forEach(function([usr]) {
    showToast({ type:'info', title:'Solicitud de acceso', msg: usr + ' pide acceso al sistema', duration:9000 });
  });
}
function updateUsersBadge() {
  const n = Object.values(loadUsers()).filter(function(u){ return u.estado==='pendiente'; }).length;
  document.querySelectorAll('.nb-users-badge').forEach(function(b) {
    b.textContent = n; b.style.display = n > 0 ? '' : 'none';
  });
}


// ════════════════════════════════════════════════
// MI PERFIL
function openMyProfile() {
  if (!currentUser) return;
  _profileAvatarTemp = null;
  renderProfileBody();
  DOM.get('profile-overlay').style.display = 'flex';
}
function closeMyProfile() {
  DOM.get('profile-overlay').style.display = 'none';
  _profileAvatarTemp = null;
}

function renderProfileBody() {
  const prof = getProfile(currentUser);
  if (!prof) { closeMyProfile(); return; }
  const isAdmin = (prof.rol||'').toLowerCase() === 'administrador';
  const avatarData = _profileAvatarTemp !== null ? _profileAvatarTemp : (prof.avatar || null);
  const displayName = prof.displayName || currentUser;

  const avatarInner = avatarData
    ? '<img src="' + avatarData + '" alt="avatar"/>'
    : displayName.charAt(0).toUpperCase();

  let html = '';

  // ── Avatar ──
  html += '<div class="profile-avatar-row">'
    + '<div class="profile-avatar-wrap">'
    +   '<div class="profile-avatar" id="profile-avatar-disp">' + avatarInner + '</div>'
    +   '<div class="profile-avatar-edit" onclick="document.getElementById(\'profile-avatar-input\').click()" title="Cambiar foto">\uD83D\uDCF7</div>'
    + '</div>'
    + '<button class="profile-avatar-remove"' + (avatarData ? '' : ' disabled') + ' onclick="_removeAvatar()">Quitar foto</button>'
    + '</div>';

  // ── Meta pills ──
  html += '<div class="profile-meta-row">'
    + '<span class="profile-meta-pill' + (isAdmin?' admin':'') + '">' + (prof.rol||'Operario') + '</span>'
    + '<span class="profile-meta-pill">' + (prof.sede||'HDS') + '</span>'
    + '<span class="profile-meta-pill">' + currentUser + '</span>'
    + '</div>';

  // ── Datos personales ──
  html += '<div class="profile-section">'
    + '<div class="profile-section-title">Datos personales</div>'
    + '<div class="profile-field"><label>Nombre para mostrar</label>'
    +   '<input class="profile-input" id="pf-displayname" type="text" maxlength="40" value="' + displayName.replace(/"/g,'&quot;') + '" placeholder="Tu nombre"/></div>'
    + '<div class="profile-field"><label>Usuario (no editable)</label>'
    +   '<input class="profile-input" type="text" value="' + currentUser + '" disabled/></div>'
    + '<button class="profile-btn primary" onclick="saveProfileBasics()">Guardar cambios</button>'
    + '<div class="profile-msg" id="pf-basics-msg"></div>'
    + '</div>';

  // ── Correo electrónico ──
  html += '<div class="profile-section">'
    + '<div class="profile-section-title">Correo electr\u00f3nico</div>'
    + '<div class="profile-field"><label>Mail actual' + (prof.emailVerificado ? ' \u00b7 \u2713 verificado' : ' \u00b7 \u26a0 sin verificar') + '</label>'
    +   '<input class="profile-input" id="pf-mail" type="email" maxlength="80" value="' + (prof.mail||'').replace(/"/g,'&quot;') + '" placeholder="tu@correo.com"/></div>'
    + '<button class="profile-btn ghost" onclick="saveProfileMail()">Actualizar correo</button>'
    + '<div class="profile-msg" id="pf-mail-msg"></div>'
    + '</div>';

  // ── Contraseña ──
  html += '<div class="profile-section">'
    + '<div class="profile-section-title">Cambiar contrase\u00f1a</div>'
    + '<div class="profile-field"><label>Contrase\u00f1a actual</label>'
    +   '<input class="profile-input" id="pf-pass-cur" type="password" maxlength="30" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"/></div>'
    + '<div class="profile-row">'
    +   '<div class="profile-field"><label>Nueva</label><input class="profile-input" id="pf-pass-new" type="password" maxlength="30" placeholder="Nueva contrase\u00f1a"/></div>'
    +   '<div class="profile-field"><label>Repetir</label><input class="profile-input" id="pf-pass-new2" type="password" maxlength="30" placeholder="Repetir"/></div>'
    + '</div>'
    + '<button class="profile-btn ghost" onclick="saveProfilePassword()">Cambiar contrase\u00f1a</button>'
    + '<div class="profile-msg" id="pf-pass-msg"></div>'
    + '</div>';

  // ── Permisos (solo lectura) ──
  html += '<div class="profile-section">'
    + '<div class="profile-section-title">Mis acciones habilitadas</div>'
    + '<div class="profile-perms-readonly">' + _buildReadonlyPerms(prof, isAdmin) + '</div>'
    + '<div class="profile-perms-hint">' + (isAdmin
         ? 'Sos Administrador: ten\u00e9s acceso completo a todas las funciones.'
         : 'Estos permisos los asigna el Administrador desde el panel de Usuarios.') + '</div>'
    + '</div>';

  // ── Cerrar sesión ──
  html += '<div class="profile-danger-zone">'
    + '<button class="profile-logout-btn" onclick="closeMyProfile();logout();">Cerrar sesi\u00f3n</button>'
    + '</div>';

  DOM.get('profile-body').innerHTML = html;
}

function _buildReadonlyPerms(prof, isAdmin) {
  const perms = prof.permisos || {};
  let out = '';
  Object.keys(PERMS_GROUPS).forEach(function(g) {
    const gPerms = PERMS_CATALOG.filter(function(p){ return p.group===g; });
    if (!gPerms.length) return;
    out += '<div class="profile-perm-group"><div class="profile-perm-group-label">' + PERMS_GROUPS[g] + '</div><div class="profile-perm-row">';
    gPerms.forEach(function(p) {
      const granted = isAdmin || !!perms[p.key];
      const cls = granted ? 'profile-perm-chip granted' : 'profile-perm-chip denied';
      const icon = granted
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      out += '<span class="' + cls + '">' + icon + p.label + '</span>';
    });
    out += '</div></div>';
  });
  return out;
}

function _onAvatarFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast({type:'danger',title:'Archivo inv\u00e1lido',msg:'Eleg\u00ed una imagen.'}); return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast({type:'danger',title:'Imagen muy pesada',msg:'M\u00e1ximo 2MB.'}); return;
  }
  const reader = new FileReader();
  reader.onload = function() {
    _resizeAvatarImage(reader.result, function(resizedDataUrl) {
      _profileAvatarTemp = resizedDataUrl;
      const disp = document.getElementById('profile-avatar-disp');
      if (disp) disp.innerHTML = '<img src="' + resizedDataUrl + '" alt="avatar"/>';
      const removeBtn = document.querySelector('.profile-avatar-remove');
      if (removeBtn) removeBtn.disabled = false;
      _persistAvatar(resizedDataUrl);
    });
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
function _resizeAvatarImage(dataUrl, cb) {
  const img = new Image();
  img.onload = function() {
    const SIZE = 160;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const minSide = Math.min(img.width, img.height);
    const sx = (img.width  - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
    cb(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.src = dataUrl;
}
function _persistAvatar(dataUrl) {
  const users = loadUsers();
  if (!users[currentUser]) return;
  if (typeof users[currentUser] === 'string') users[currentUser] = { pass: users[currentUser] };
  users[currentUser].avatar = dataUrl;
  saveUsers(users);
  updateUserChip();
  showToast({type:'success',title:'Foto actualizada',msg:'Tu foto de perfil se guard\u00f3 correctamente.'});
}
function _removeAvatar() {
  const users = loadUsers();
  if (users[currentUser] && typeof users[currentUser] === 'object') {
    delete users[currentUser].avatar;
    saveUsers(users);
  }
  _profileAvatarTemp = null;
  updateUserChip();
  renderProfileBody();
  showToast({type:'info',title:'Foto eliminada'});
}

function saveProfileBasics() {
  const name = (document.getElementById('pf-displayname').value || '').trim();
  const msg  = document.getElementById('pf-basics-msg');
  if (!name) { msg.className='profile-msg err'; msg.textContent='El nombre no puede estar vac\u00edo.'; return; }
  const users = loadUsers();
  if (!users[currentUser]) return;
  if (typeof users[currentUser] === 'string') users[currentUser] = { pass: users[currentUser] };
  users[currentUser].displayName = name;
  saveUsers(users);
  updateUserChip();
  msg.className='profile-msg ok'; msg.textContent='\u2713 Nombre actualizado.';
  setTimeout(function(){ msg.textContent=''; }, 2200);
}

function saveProfileMail() {
  const mail = (document.getElementById('pf-mail').value || '').trim();
  const msg  = document.getElementById('pf-mail-msg');
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    msg.className='profile-msg err'; msg.textContent='Ingres\u00e1 un correo v\u00e1lido.'; return;
  }
  const prof = getProfile(currentUser);
  const sameMail = prof && prof.mail === mail;
  const users = loadUsers();
  if (!users[currentUser]) return;
  if (typeof users[currentUser] === 'string') users[currentUser] = { pass: users[currentUser] };
  users[currentUser].mail = mail;
  users[currentUser].emailVerificado = sameMail ? (users[currentUser].emailVerificado || false) : false;
  saveUsers(users);
  if (!sameMail) {
    msg.className='profile-msg ok';
    msg.textContent='\u2713 Correo actualizado. Qued\u00f3 como no verificado.';
  } else {
    msg.className='profile-msg ok'; msg.textContent='\u2713 Correo guardado.';
  }
  setTimeout(function(){ renderProfileBody(); }, 1400);
}

function saveProfilePassword() {
  const cur   = (document.getElementById('pf-pass-cur').value  || '').trim();
  const next  = (document.getElementById('pf-pass-new').value  || '').trim();
  const next2 = (document.getElementById('pf-pass-new2').value || '').trim();
  const msg   = document.getElementById('pf-pass-msg');
  const prof  = getProfile(currentUser);
  if (!cur)  { msg.className='profile-msg err'; msg.textContent='Ingres\u00e1 tu contrase\u00f1a actual.'; return; }
  if (prof.pass !== cur) { msg.className='profile-msg err'; msg.textContent='La contrase\u00f1a actual es incorrecta.'; return; }
  if (!next || next.length < 4) { msg.className='profile-msg err'; msg.textContent='La nueva contrase\u00f1a debe tener al menos 4 caracteres.'; return; }
  if (next !== next2) { msg.className='profile-msg err'; msg.textContent='Las contrase\u00f1as nuevas no coinciden.'; return; }
  const users = loadUsers();
  if (!users[currentUser]) return;
  if (typeof users[currentUser] === 'string') users[currentUser] = { pass: users[currentUser] };
  users[currentUser].pass = next;
  saveUsers(users);
  msg.className='profile-msg ok'; msg.textContent='\u2713 Contrase\u00f1a actualizada.';
  ['pf-pass-cur','pf-pass-new','pf-pass-new2'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  setTimeout(function(){ msg.textContent=''; }, 2200);
}


// Enter key support on login screen
document.addEventListener('DOMContentLoaded', () => {
  ['li-usr','li-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') loginSubmit();
    });
  });
  setTimeout(() => DOM.get('li-usr')?.focus(), 100);
  DOM.get('rs-usr')?.addEventListener('keydown', e => { if (e.key==='Enter') resetStep1Submit(); });
  DOM.get('rs-code')?.addEventListener('keydown', e => { if (e.key==='Enter') resetStep2Submit(); });
  ['rs-newpass','rs-newpass2'].forEach(id => { document.getElementById(id)?.addEventListener('keydown', e => { if (e.key==='Enter') resetStep3Submit(); }); });
});


