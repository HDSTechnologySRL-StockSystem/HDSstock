// ═══════════════════════════════════════════════════════
// src/login/login.js
// Autenticación: login, registro, logout, recuperar
// contraseña, selector de sede, pantalla pendiente.
// Depende de: core/auth.js, core/storage.js,
//             shared/toast.js, core/router.js
// ═══════════════════════════════════════════════════════
'use strict';

let loginMode = 'login'; // 'login' | 'register'

let _resetState = { usr: null, code: null, ts: null, mail: null };

function pickSeg(group, el) {
  const seg = document.getElementById('li-' + group + '-seg');
  if (!seg) return;
  seg.querySelectorAll('.seg-opt').forEach(o => o.classList.remove('on'));
  el.classList.add('on');
}
function getSeg(group) {
  const on = document.querySelector('#li-' + group + '-seg .seg-opt.on');
  return on ? on.dataset.v : '';
}
function setSeg(group, value) {
  const seg = document.getElementById('li-' + group + '-seg');
  if (!seg) return;
  let matched = false;
  seg.querySelectorAll('.seg-opt').forEach(o => {
    const m = o.dataset.v === value;
    o.classList.toggle('on', m);
    if (m) matched = true;
  });
  if (!matched) { const first = seg.querySelector('.seg-opt'); if (first) first.classList.add('on'); }
}

function loginToggleMode() {
  loginMode = loginMode === 'login' ? 'register' : 'login';
  const title   = DOM.get('login-mode-title');
  const mainBtn = DOM.get('li-main-btn');
  const secBtn  = DOM.get('li-sec-btn');
  const err     = DOM.get('li-err');
  const pass2   = document.getElementById('li-pass2-wrap');
  const mailW   = document.getElementById('li-mail-wrap');
  if (err) { err.textContent = ''; err.style.color = ''; }
  clearLoginFields();                       // limpiar campos al cambiar de modo
  if (loginMode === 'register') {
    title.textContent   = 'Crear cuenta';
    mainBtn.textContent = 'Registrarse';
    secBtn.textContent  = 'Ya tengo cuenta';
    if (pass2) pass2.style.display = '';
    if (mailW) mailW.style.display = '';
  } else {
    title.textContent   = 'Ingresar';
    mainBtn.textContent = 'Ingresar';
    secBtn.textContent  = 'Crear cuenta';
    if (pass2) pass2.style.display = 'none';
    if (mailW) mailW.style.display = 'none';
  }
  const forgotBtn = DOM.get('li-forgot-btn');
  if (forgotBtn) forgotBtn.style.display = loginMode === 'login' ? '' : 'none';
}

function loginSubmit() {
  const usr  = (DOM.get('li-usr')?.value || '').trim().toUpperCase();
  const pass = (DOM.get('li-pass')?.value || '').trim();
  const err  = DOM.get('li-err');
  // La sede ya no se elige en el login; se toma del perfil (o HDS) y se cambia después.

  if (!usr || !pass) { err.textContent = 'Completá usuario y contraseña'; return; }
  if (usr.length < 3) { err.textContent = 'Usuario: mínimo 3 caracteres'; return; }
  if (pass.length < 4) { err.textContent = 'Contraseña: mínimo 4 caracteres'; return; }

  const users = loadUsers();

  if (loginMode === 'register') {
    const pass2 = (document.getElementById('li-pass2')?.value || '').trim();
    const mail  = (document.getElementById('li-mail')?.value || '').trim();
    if (pass !== pass2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    if (users[usr]) { err.textContent = 'El usuario ya existe'; return; }
    // Sin verificación por mail: la cuenta queda pendiente de aprobación del Admin directamente
    users[usr] = { pass, rol: 'Operario', sede: 'HDS', mail: mail || '',
      estado: 'pendiente', emailVerificado: false, permisos: {} };
    saveUsers(users);
    notifyAdminNewUser(usr);
    err.style.color = 'var(--green)';
    err.textContent = '\u2713 Cuenta creada \u2014 esper\u00e1 la aprobaci\u00f3n del Administrador';
    setTimeout(function() { err.style.color = ''; err.textContent = ''; loginToggleMode(); }, 2500);
    return;
  }

  // login
  const prof = getProfile(usr);
  if (!prof) { err.textContent = 'Usuario no encontrado'; return; }
  if (prof.pass !== pass) { err.textContent = 'Contraseña incorrecta'; return; }
  if ((prof.estado || '') === 'pendiente') { showPendingScreen(usr, prof.mail || ''); return; }

  err.textContent = '';
  currentUser = usr;
  currentRol  = prof.rol || 'Operario';
  currentSede = prof.sede || 'HDS';                    // sede del perfil; se cambia después
  // Si el perfil no tenía sede/rol guardados, los persistimos (sin perder mail/estado/permisos)
  if (!prof.sede || !prof.rol) {
    const full = (typeof users[usr] === 'object' && users[usr]) ? users[usr] : {};
    users[usr] = Object.assign({}, full, { pass: prof.pass, rol: currentRol, sede: currentSede });
    saveUsers(users);
  }
  updateUserChip();
  saveSession();
  clearLoginFields();
  go('home');
  // Check pending notifications after login
  setTimeout(() => {
    updateNavBadges();
    checkDeadlines();
    surfaceAccessRequests();
  }, 800);
}

// (Solicitudes de acceso: ver definición única más abajo, junto al módulo RBAC)

function updateUserChip() {
  const nm = DOM.get('home-usr-label');
  const rl = DOM.get('home-rol-label');
  const sd = DOM.get('home-sede-label');
  const av = DOM.get('home-usr-av');
  const sb = DOM.get('sede-btn-label');
  const prof = currentUser ? getProfile(currentUser) : null;
  const displayName = (prof && prof.displayName) ? prof.displayName : (currentUser || '');
  if (nm) nm.textContent = displayName;
  if (rl) rl.textContent = currentRol || '';
  if (sd) sd.textContent = currentSede || '';
  if (av) {
    if (prof && prof.avatar) av.innerHTML = '<img src="' + prof.avatar + '" alt="avatar"/>';
    else av.textContent = (displayName || '?').charAt(0).toUpperCase();
  }
  if (sb) sb.textContent = currentSede || 'HDS';
  const isAdmin = (currentRol || '').toLowerCase() === 'administrador';
  document.querySelectorAll('.nb-users').forEach(b => { b.style.display = isAdmin ? 'flex' : 'none'; });
  const adminCard = document.getElementById('home-admin-card');
  if (adminCard) adminCard.style.display = isAdmin ? '' : 'none';
}

// ── Cambiar de sede (post-login) ──────────────────────────────────────────────
function openSedeModal() {
  document.querySelectorAll('#sede-opt-grid .sede-opt').forEach(o =>
    o.classList.toggle('on', o.dataset.v === currentSede));
  DOM.get('sedeModal').classList.add('on');
}
function closeSedeModal() { DOM.get('sedeModal').classList.remove('on'); }
function setSede(value) {
  currentSede = value;
  // Persistir en el perfil del usuario y en la sesión
  if (currentUser) {
    const users = loadUsers();
    if (typeof users[currentUser] === 'object' && users[currentUser]) {
      users[currentUser].sede = value;
      saveUsers(users);
    }
  }
  saveSession();
  updateUserChip();
  closeSedeModal();
  // Refrescar vistas que muestran la sede
  const cur = document.querySelector('.screen.on')?.id;
  try {
    if (cur === 'sc-mov') renderMov();
    else if (cur === 'sc-pet') renderPet();
    else if (cur === 'sc-bal') renderBal();
  } catch(e){}
  showToast({ type:'success', title:'Sede cambiada', msg:`Ahora operás en: ${value}` });
}

function logout() {
  currentUser = null;
  currentRol  = '';
  currentSede = '';
  saveSession();
  loginMode = 'login';
  DOM.get('login-mode-title').textContent = 'Ingresar';
  DOM.get('li-main-btn').textContent = 'Ingresar';
  DOM.get('li-sec-btn').textContent  = 'Crear cuenta';
  DOM.get('li-err').textContent = '';
  const rolWrap = document.getElementById('li-rol-wrap'); if (rolWrap) rolWrap.style.display = 'none';
  document.getElementById('li-pass2-wrap').style.display = 'none';
  document.getElementById('li-mail-wrap').style.display = 'none';
  clearLoginFields();
  closePopup();
  closeAllShelfWindows();
  document.querySelectorAll('.nb-users').forEach(b => b.style.display = 'none');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  DOM.get('sc-login').classList.add('on');
  setTimeout(() => DOM.get('li-usr')?.focus(), 100);
}

function sendVerificationCode(mail, code, subject) {
  const p = HDS_EMAIL_CONFIG;

  if (p.provider === 'emailjs') {
    if (!window.emailjs) {
      showToast({ type:'danger', title:'EmailJS no cargado',
        msg:'Inclú el SDK: <scr'+'ipt src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></scr'+'ipt>' });
      return;
    }
    window.emailjs.send(p.emailjsServiceId, p.emailjsTemplateId, {
      to_email: mail,
      subject:  subject || 'HDS — Código de verificación',
      code:     code,
    }, p.emailjsPublicKey)
      .then(function() {
        showToast({ type:'success', title:'📧 Código enviado', msg:'Revisá tu correo: ' + mail });
      })
      .catch(function() {
        showToast({ type:'danger', title:'Error al enviar email',
          msg:'Verificá las credenciales en HDS_EMAIL_CONFIG.' });
      });
    return;
  }

  if (p.provider === 'custom') {
    fetch(p.customEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: mail, subject: subject || 'HDS — Código de verificación', code: code }),
    })
      .then(function(r) {
        if (r.ok) showToast({ type:'success', title:'📧 Código enviado', msg:'Revisá tu correo: ' + mail });
        else showToast({ type:'danger', title:'Error al enviar email', msg:'El servidor respondió con error.' });
      })
      .catch(function() {
        showToast({ type:'danger', title:'Sin conexión', msg:'No se pudo enviar el código.' });
      });
    return;
  }

  // provider === 'console': solo para desarrollo local.
  // El código NUNCA aparece en la interfaz; solo en DevTools → Console.
  console.info('[HDS] Código de verificación para', mail, '→', code, '| Asunto:', subject);
  showToast({ type:'info', title:'📧 Código listo',
    msg:'Revisá la consola del navegador (F12 → Console). En producción se envía al correo.' });
}

// Alias de compatibilidad — los dos flujos (registro y recuperación) llaman esta función
// Verificación por mail eliminada — registro va directo a pendiente
function showPendingScreen(usr, mail) {
  let el = DOM.get('pending-overlay');
  if (!el) { el = document.createElement('div'); el.id = 'pending-overlay'; document.body.appendChild(el); }
  el.innerHTML = '<div class="pending-card">'
    + '<div class="pending-icon">\u23f3</div>'
    + '<div class="pending-title">Cuenta pendiente de aprobaci\u00f3n</div>'
    + '<div class="pending-body">Tu cuenta <b>' + usr + '</b> fue creada correctamente'
    + (mail ? ' y verificada con <b>' + mail + '</b>' : '')
    + '.<br><br>El Administrador debe aprobar tu acceso antes de que puedas ingresar.</div>'
    + '<div class="pending-hint">Cuando te aprueben, intent\u00e1 ingresar de nuevo.</div>'
    + '<button class="login-btn primary" style="margin-top:18px" onclick="closePendingScreen()">Volver al inicio de sesi\u00f3n</button>'
    + '</div>';
  el.style.display = 'flex';
}
function closePendingScreen() {
  const el = DOM.get('pending-overlay'); if (el) el.style.display = 'none';
}

function openForgotPassword() {
  _resetState = { usr: null, code: null, ts: null, mail: null };
  _resetGoStep(1);
  ['rs-usr','rs-code','rs-newpass','rs-newpass2'].forEach(function(id) {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['rs-err1','rs-err2','rs-err3'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.color = ''; }
  });
  DOM.get('reset-overlay').style.display = 'flex';
  setTimeout(function() { DOM.get('rs-usr')?.focus(); }, 120);
}
function closeResetOverlay() {
  DOM.get('reset-overlay').style.display = 'none';
  _resetState = { usr: null, code: null, ts: null, mail: null };
}
function _resetGoStep(n) {
  [1,2,3].forEach(function(i) {
    const el = document.getElementById('reset-step' + i);
    if (el) el.classList.toggle('hidden', i !== n);
  });
  const hints = {
    1: 'Ingres\u00e1 tu usuario y te enviamos un c\u00f3digo al mail registrado.',
    2: 'Ingres\u00e1 el c\u00f3digo de 6 d\u00edgitos que enviamos a tu correo.',
    3: 'Eleg\u00ed tu nueva contrase\u00f1a.',
  };
  const hintEl = document.getElementById('reset-hint');
  if (hintEl) hintEl.textContent = hints[n] || '';
}
function _resetErr(step, msg) {
  const el = document.getElementById('rs-err' + step);
  if (el) { el.textContent = msg; el.style.color = ''; }
}
function _resetOk(step, msg) {
  const el = document.getElementById('rs-err' + step);
  if (el) { el.textContent = msg; el.style.color = 'var(--green)'; }
}
function resetStep1Submit() {
  const usr = (DOM.get('rs-usr').value || '').trim().toUpperCase();
  if (!usr) { _resetErr(1, 'Ingres\u00e1 tu nombre de usuario.'); return; }
  const users = loadUsers();
  const prof = users[usr];
  if (!prof || typeof prof === 'string') { _resetErr(1, 'Usuario no encontrado en el sistema.'); return; }
  const mail = prof.mail || '';
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    _resetErr(1, 'Tu cuenta no tiene un mail registrado. Contact\u00e1 al Administrador.'); return;
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  _resetState = { usr: usr, code: code, ts: Date.now(), mail: mail };
  sendVerificationCode(mail, code, 'HDS — Recuperación de contraseña');
  _resetGoStep(2);
  setTimeout(function() { DOM.get('rs-code')?.focus(); }, 120);
}
function resetStep1Retry() {
  if (!_resetState.usr) { _resetGoStep(1); return; }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  _resetState.code = code; _resetState.ts = Date.now();
  sendVerificationCode(_resetState.mail, code, 'HDS — Recuperación de contraseña (reenvío)');
  _resetErr(2, '');
  const el = DOM.get('rs-code'); if (el) { el.value = ''; el.focus(); }
}
function resetStep2Submit() {
  const code = (DOM.get('rs-code').value || '').trim();
  if (!code) { _resetErr(2, 'Ingres\u00e1 el c\u00f3digo.'); return; }
  if (!_resetState.ts || Date.now() - _resetState.ts > 15 * 60 * 1000) {
    _resetErr(2, 'El c\u00f3digo expir\u00f3. Ped\u00ed uno nuevo.'); return;
  }
  if (code !== _resetState.code) { _resetErr(2, 'C\u00f3digo incorrecto. Revis\u00e1 tu correo.'); return; }
  _resetGoStep(3);
  setTimeout(function() { DOM.get('rs-newpass')?.focus(); }, 120);
}
function resetStep3Submit() {
  const pass1 = (DOM.get('rs-newpass').value  || '').trim();
  const pass2 = (DOM.get('rs-newpass2').value || '').trim();
  if (!pass1 || pass1.length < 4) { _resetErr(3, 'La contrase\u00f1a debe tener al menos 4 caracteres.'); return; }
  if (pass1 !== pass2) { _resetErr(3, 'Las contrase\u00f1as no coinciden.'); return; }
  if (!_resetState.usr) { _resetErr(3, 'Sesi\u00f3n expirada. Volv\u00e9 a empezar.'); return; }
  const users = loadUsers();
  if (!users[_resetState.usr]) { _resetErr(3, 'Usuario no encontrado.'); return; }
  users[_resetState.usr].pass = pass1;
  saveUsers(users);
  _resetOk(3, '\u2713 Contrase\u00f1a actualizada correctamente.');
  showToast({ type:'success', title:'Contrase\u00f1a cambiada', msg:'Ya pod\u00e9s ingresar con tu nueva contrase\u00f1a.' });
  setTimeout(closeResetOverlay, 1800);
}

// ════════════════════════════════════════════════
// RBAC + GESTIÓN DE USUARIOS
