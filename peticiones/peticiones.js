// ═══════════════════════════════════════════════════════
// src/peticiones/peticiones.js
// Módulo de peticiones de compra:
//   - loadPets / savePets / getPendingCount
//   - updateNavBadges
//   - renderPet / petFilt / petOk / petReject / petDel
//   - openPetModal / savePeticion / closePetModal
//   - checkStockLow / checkDeadlines (alertas automáticas)
// Depende de: storage.js, auth.js, utils.js,
//             shared/toast.js, movimientos.js (logEdicion)
// ═══════════════════════════════════════════════════════
'use strict';

let pets = [];
let pFilt = 'todas', pIdSeq = 10;

function loadPets() {
  try { pets = JSON.parse(localStorage.getItem('hds_pets') || '[]'); } catch { pets = []; }
  pIdSeq = pets.length ? Math.max(...pets.map(p=>p.id))+1 : 10;
}
function savePets() {
  try { localStorage.setItem('hds_pets', JSON.stringify(pets)); } catch {}
}

function getPendingCount() {
  loadPets();
  return pets.filter(p => p.estado === 'pendiente').length;
}

function updateNavBadges() {
  loadPets();
  const hoy = localToday();
  const vencidas = pets.filter(p => p.estado === 'pendiente' && p.fecha && p.fecha < hoy).length;
  const pendientes = pets.filter(p => p.estado === 'pendiente').length;

  document.querySelectorAll('.nav-badge').forEach(b => {
    if (pendientes > 0) {
      b.textContent = pendientes;
      b.style.display = 'flex';
      if (vencidas > 0) b.style.background = 'var(--red)';
      else b.style.background = '#e8a23a';
    } else {
      b.style.display = 'none';
    }
  });
}

function renderPet() {
  loadPets();
  const container = DOM.get('pCards');
  const empty     = DOM.get('pEmpty');
  container.innerHTML = '';
  const hoy = localToday();
  const petQ = (document.getElementById('pet-search-inp')?.value || '').trim().toLowerCase();
  const filt = pets
    .filter(p => pFilt==='todas' || p.estado===pFilt)
    .filter(p => !petQ ||
      (p.producto ||'').toLowerCase().includes(petQ) ||
      (p.desc     ||'').toLowerCase().includes(petQ) ||
      (p.usuario  ||'').toLowerCase().includes(petQ));
  DOM.get('pVis').textContent = filt.length;
  DOM.get('pTot').textContent = pets.length;
  if (!filt.length) { empty.style.display='flex'; return; }
  empty.style.display = 'none';
  const sorted = [...filt].sort((a,b)=>{
    if (a.estado!==b.estado) return a.estado==='pendiente'?-1:1;
    // urgentes primero
    const urgOrd = {critica:0, urgente:1, normal:2};
    if (a.urgencia!==b.urgencia) return (urgOrd[a.urgencia]||2)-(urgOrd[b.urgencia]||2);
    return a.fecha<b.fecha?-1:1;
  });
  sorted.forEach(p => {
    const venc = p.estado==='pendiente' && p.fecha && p.fecha<hoy;
    const proxima = p.estado==='pendiente' && p.fecha && !venc && daysDiff(p.fecha) <= 2;
    const [y,m,d] = (p.fecha||'----  --  --').split('-');
    const isHds = p.usuario === 'HDS S.R.L.';
    const card = document.createElement('div');
    card.className = 'pet-card ' + p.estado + (isHds ? ' auto-hds' : '');

    const urgBadge = p.urgencia && p.urgencia !== 'normal'
      ? `<span class="cpill" style="border-color:${p.urgencia==='critica'?'rgba(232,91,75,.5)':'rgba(232,162,58,.45)'};color:${p.urgencia==='critica'?'var(--red)':'#e8a23a'};background:${p.urgencia==='critica'?'rgba(232,91,75,.08)':'rgba(232,162,58,.08)'}">${p.urgencia.toUpperCase()}</span>`
      : '';

    const stockMinBadge = p.stockMin > 0
      ? `<span class="cpill" style="border-color:rgba(100,160,220,.3);color:var(--blue);background:rgba(100,160,220,.07);font-size:9px">MIN ${p.stockMin}</span>`
      : '';

    card.innerHTML = `
      <div class="pet-pills">
        <div class="pet-pill-row"><span class="cpill ${isHds?'hds':'user'}">${esc(p.usuario)}</span>${urgBadge}</div>
        <div class="pet-pill-row"><span class="cpill">${esc(p.producto)}</span></div>
        <div class="pet-pill-row">
          <span class="cpill cant">${esc(p.cantidad)} UN</span>
          ${p.fecha ? `<span class="cpill ${venc?'venc':proxima?'venc':'fecha'}">${venc?'⚠ ':''}${esc(d)}/${esc(m)}/${esc(y)}</span>` : ''}
          ${stockMinBadge}
        </div>
      </div>
      <div class="pet-desc ${p.desc?'':'empty'}">${esc(p.desc)||'Sin descripción'}</div>
      ${isHds ? '' : `<div class="pet-sign">
        <span>👤 <b>${esc(p.usuario)||'—'}</b></span>
        ${p.rol ? `<span class="sg-rol">${esc(p.rol)}</span>` : ''}
        ${p.sede ? `<span>· ${esc(p.sede)}</span>` : ''}
        ${p.creadaFecha ? `<span>· creada ${esc(p.creadaFecha.split('-').reverse().join('/'))} ${esc(p.creadaHora||'')}</span>` : ''}
      </div>`}
      <div class="pet-right">
        <span class="est-badge ${p.estado}">${p.estado==='completada'?'aprobada':p.estado}</span>
        <span style="font-size:11px;color:var(--muted)">${esc(p.hora||'')}</span>
        <div class="pet-acts">
          ${p.estado==='pendiente' ? (
            canApprove()
              ? `<button class="pa-btn ok" onclick="petOk(${p.id})">✓ Aprobar</button>
                 <button class="pa-btn no" onclick="petReject(${p.id})">✕ Rechazar</button>`
              : `<span class="pa-lock">🔒 Pendiente de aprobación</span>`
          ) : ''}
          ${(canApprove() || p.usuario===currentUser) ? `<button class="pa-btn del" onclick="petDel(${p.id})" title="Eliminar">🗑</button>` : ''}
        </div>
        ${p.resoluPor ? `<div class="resol-sign ${p.estado==='completada'?'ok':'no'}">${p.estado==='completada'?'Aprobada':'Rechazada'} por <b>${esc(p.resoluPor)}</b>${p.resoluRol?' · '+esc(p.resoluRol):''} · ${p.resoluFecha?esc(p.resoluFecha.split('-').reverse().join('/')):''} ${esc(p.resoluHora||'')}</div>` : ''}
      </div>`;
    container.appendChild(card);
  });
  updateNavBadges();
}

function daysDiff(fechaStr) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fechaStr + 'T00:00:00');
  return Math.round((f - hoy) / 86400000);
}

function petFilt(el, val) {
  pFilt = val;
  document.querySelectorAll('.pill[data-f]').forEach(p=>p.classList.remove('on'));
  el.classList.add('on'); renderPet();
}
// Solo Supervisor / Encargado / Administrador pueden aprobar o rechazar
function canApprove() { return canAccess('aprobarPeticiones'); }
function stampResolucion(p) {
  const now = new Date();
  p.resoluPor   = currentUser || 'Sistema';
  p.resoluRol   = currentRol || '';
  p.resoluFecha = localISODate(now);
  p.resoluHora  = now.toTimeString().slice(0,5);
}
function petOk(id) {
  if (!canApprove()) { showToast({type:'warn',title:'Sin permiso',msg:'Solo un Supervisor o Encargado puede aprobar peticiones'}); return; }
  const p = pets.find(x=>x.id===id);
  if(p){ p.estado='completada'; stampResolucion(p); savePets(); renderPet(); updateNavBadges();
    showToast({type:'success',title:'Petición aprobada',msg:`${p.producto} · aprobada por ${p.resoluPor}`}); }
}
function petReject(id) {
  if (!canApprove()) { showToast({type:'warn',title:'Sin permiso',msg:'Solo un Supervisor o Encargado puede rechazar peticiones'}); return; }
  const p = pets.find(x=>x.id===id);
  if(p){ p.estado='rechazada'; stampResolucion(p); savePets(); renderPet(); updateNavBadges();
    showToast({type:'danger',title:'Petición rechazada',msg:`${p.producto} · rechazada por ${p.resoluPor}`}); }
}
function petDel(id) {
  if (!canAccess('borrarPeticiones')) { showToast({type:'warn',title:'Sin permiso',msg:'No tenés permiso para eliminar peticiones.'}); return; }
  pets = pets.filter(x=>x.id!==id); savePets(); renderPet(); updateNavBadges();
}
function openPetModal() {
  const d=new Date(); d.setDate(d.getDate()+7);
  DOM.get('pt-fecha').value = localISODate(d);
  ['pt-prod','pt-cant','pt-desc','pt-stock-min'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  // Solicitante autocompletado con la sesión (quién + rango + sede)
  const usrEl = document.getElementById('pt-usr');
  if (usrEl) usrEl.value = currentUser
    ? `${currentUser}${currentRol?' · '+currentRol:''}${currentSede?' · '+currentSede:''}`
    : 'Sistema';
  const urg = DOM.get('pt-urgencia'); if(urg) urg.value='normal';
  // Campo MIN encapsulado: colapsado por defecto (isOpen:false)
  document.getElementById('pt-adv-panel')?.classList.remove('on');
  document.getElementById('pt-adv-tog')?.classList.remove('on');
  document.getElementById('petModal').classList.add('on');
  setTimeout(()=>DOM.get('pt-prod')?.focus(), 200);
}
function togglePetAdv() {
  const p = document.getElementById('pt-adv-panel');
  const t = document.getElementById('pt-adv-tog');
  const open = !p.classList.contains('on');
  p.classList.toggle('on', open);
  t.classList.toggle('on', open);
}
function closePetModal() { document.getElementById('petModal').classList.remove('on'); }
function savePeticion() {
  if (!canAccess('hacerPeticiones')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para hacer peticiones.'}); closePetModal(); return; }
  const producto  = (DOM.get('pt-prod')?.value||'').trim();
  const cantidad  = parseInt(document.getElementById('pt-cant')?.value)||0;
  const fecha     = DOM.get('pt-fecha')?.value||'';
  const desc      = (DOM.get('pt-desc')?.value||'').trim();
  const stockMin  = parseInt(document.getElementById('pt-stock-min')?.value)||0;
  const urgencia  = DOM.get('pt-urgencia')?.value||'normal';
  const usuario   = currentUser || 'Sistema';   // firmado por la sesión
  // Validación con feedback visible (antes hacía un return silencioso = "no funciona")
  if (!producto) { showToast({type:'warn',title:'Falta el producto',msg:'Escribí qué producto necesitás pedir.'}); DOM.get('pt-prod')?.focus(); return; }
  if (!cantidad || cantidad < 1) { showToast({type:'warn',title:'Falta la cantidad',msg:'Ingresá una cantidad mayor a 0.'}); document.getElementById('pt-cant')?.focus(); return; }
  loadPets();
  const now = new Date();
  pets.unshift({
    id:pIdSeq++, usuario, rol: currentRol || '', sede: currentSede || '',
    producto, cantidad, desc, fecha, stockMin, urgencia,
    creadaFecha: localISODate(now),
    creadaHora:  now.toTimeString().slice(0,5),
    hora:now.toTimeString().slice(0,5), estado:'pendiente'
  });
  savePets(); closePetModal();
  pFilt='todas';
  document.querySelectorAll('.pill[data-f]').forEach(p=>p.classList.remove('on'));
  document.querySelector('.pill[data-f="todas"]')?.classList.add('on');
  try { renderPet(); updateNavBadges(); } catch(e){ console.error('renderPet error', e); }
  showToast({ type:'success', title:'Petición guardada', msg:`${producto} · ${cantidad} UN${fecha?' · vence '+fecha:''}` });
}

// ── Auto-petición por stock bajo ──────────────────────────────────────────────
const STOCK_MIN_DEFAULT = 3; // umbral global si el item no tiene stockMin propio

function checkStockLow(itemName, qty, armario, repisa, nave) {
  // Check if there's already a pending pet for this exact item
  loadPets();
  const already = pets.find(p => p.estado === 'pendiente'
    && p.producto.toUpperCase() === itemName.toUpperCase()
    && p.usuario === 'HDS S.R.L.');
  if (already) return; // already alerted

  const hoy = new Date(); hoy.setDate(hoy.getDate() + 14);
  const fecha = localISODate(hoy);

  pets.unshift({
    id: pIdSeq++,
    usuario: 'HDS S.R.L.',
    producto: itemName,
    cantidad: STOCK_MIN_DEFAULT * 3,
    desc: `⚠ Stock bajo detectado — ${qty} unidad(es) restante(s) en ${nave} / ${armario} / ${repisa}. Reposición automática sugerida.`,
    fecha,
    stockMin: STOCK_MIN_DEFAULT,
    urgencia: qty <= 1 ? 'critica' : 'urgente',
    hora: new Date().toTimeString().slice(0,5),
    estado: 'pendiente',
    autoGenerada: true,
  });
  savePets();
  updateNavBadges();

  showToast({
    type: qty <= 1 ? 'danger' : 'warn',
    title: qty <= 1 ? '⚠ Stock crítico' : '⚠ Stock bajo',
    msg: `${itemName} — ${qty} UN restante(s) en ${nave}/${armario}/${repisa}`,
    actionLabel: 'Ver peticiones',
    action: () => go('pet'),
    duration: 10000,
  });
}

// ── Notificaciones de vencimiento ─────────────────────────────────────────────
function checkDeadlines() {
  loadPets();
  const hoy = localToday();
  const pendientes = pets.filter(p => p.estado === 'pendiente' && p.fecha);
  const vencidas   = pendientes.filter(p => p.fecha < hoy);
  const hoyMismo   = pendientes.filter(p => p.fecha === hoy);
  const manana     = pendientes.filter(p => daysDiff(p.fecha) === 1);

  if (vencidas.length) {
    showToast({
      type: 'danger',
      title: `${vencidas.length} petición(es) vencida(s)`,
      msg: vencidas.map(p => `${p.producto}`).slice(0,2).join(', ') + (vencidas.length>2?'…':''),
      actionLabel: 'Ver',
      action: () => go('pet'),
      duration: 0,
    });
  }
  if (hoyMismo.length) {
    showToast({
      type: 'warn',
      title: `Vence hoy`,
      msg: hoyMismo.map(p => p.producto).join(', '),
      actionLabel: 'Ver',
      action: () => go('pet'),
      duration: 8000,
    });
  }
  if (manana.length) {
    showToast({
      type: 'info',
      title: 'Vence mañana',
      msg: manana.map(p => p.producto).join(', '),
      actionLabel: 'Ver',
      action: () => go('pet'),
      duration: 7000,
    });
  }
}


// ════════════════════════════════════════════════
// BUSCADOR GLOBAL
// ════════════════════════════════════════════════
