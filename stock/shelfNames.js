// ═══════════════════════════════════════════════════════
// src/stock/shelfNames.js
// Nombres personalizados de armarios y naves:
// load/save, get/set, apply al SVG y ventanas flotantes.
// Depende de: storage.js (loadShelfNames/saveShelfNames),
//             stock/shelfWindow.js (refreshShelfWindow)
// ═══════════════════════════════════════════════════════
'use strict';

function loadShelfNames() { try { return JSON.parse(localStorage.getItem('hds_shelf_names') || '{}'); } catch { return {}; } }
function saveShelfNames(n) { try { localStorage.setItem('hds_shelf_names', JSON.stringify(n)); } catch {} }
function getShelfName(nave, id) {
  const n = loadShelfNames();
  return (n[nave] && n[nave][id]) || id;
}
function setShelfName(nave, id, nombre) {
  const n = loadShelfNames();
  if (!n[nave]) n[nave] = {};
  const anterior = n[nave][id] || id;
  n[nave][id] = nombre.trim() || id;
  saveShelfNames(n);
  // Update all open shelf windows and the SVG text label
  applyShelfName(nave, id);
  // Registrar edición en movimientos
  logEdicion('Renombrado', `Armario ${id} → "${nombre.trim() || id}"`, `${naveLbl(nave)} · antes: "${anterior}"`);
}
function applyShelfName(nave, id) {
  const nombre = getShelfName(nave, id);
  // SVG text label — usar getSvgForNave para encontrar el SVG correcto
  const svg = getSvgForNave(nave);
  if (svg) {
    const cell = svg.querySelector('.cell[data-id="' + CSS.escape(id) + '"]');
    if (cell) {
      const t = cell.querySelector('text');
      if (t) {
        // Mostrar el nombre completo (hasta 6 chars) o truncado; ajustar font-size dinámicamente
        const display = nombre.length > 6 ? nombre.slice(0, 6) : nombre;
        t.textContent = display;
        // Escalar la fuente si el nombre es largo
        const svgR = cell.querySelector('rect:not(.shelf-resize-handle)');
        if (svgR) {
          const w = parseFloat(svgR.getAttribute('width'));
          const fs = nombre.length <= 2 ? Math.min(16, w * 0.5) :
                     nombre.length <= 4 ? Math.min(13, w * 0.38) :
                                          Math.min(10, w * 0.28);
          t.setAttribute('font-size', Math.max(8, Math.round(fs)));
        }
      }
    }
  }
  // Shelf window title — actualizar en la ventana flotante si está abierta
  const winKey = nave + '|' + id;
  const shelfWin = document.querySelector('.shelf-win[data-key="' + winKey + '"]');
  if (shelfWin) {
    const titleEl = shelfWin.querySelector('.shelf-win-title');
    if (titleEl) {
      // El título tiene un span.sw-sub adentro — preservarlo
      const sub = titleEl.querySelector('.sw-sub');
      titleEl.textContent = 'Armario ' + nombre;
      if (sub) titleEl.appendChild(sub);
    }
  }
  // Popup head label
  if (POP && POP.nave === nave && POP.cellId === id) {
    const hintEl = document.getElementById('hint-' + nave);
    if (hintEl) hintEl.textContent = 'Armario ' + nombre;
  }
}

function openRenameShelf(nave, id) {
  document.getElementById('rename-shelf-modal')?.remove();
  const nombre = getShelfName(nave, id);
  const modal  = document.createElement('div');
  modal.id     = 'rename-shelf-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:24px 20px;max-width:300px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)';
  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:14px';
  title.textContent = 'Renombrar armario ' + id;
  const inp = document.createElement('input');
  inp.id = 'rename-shelf-inp'; inp.type = 'text'; inp.maxLength = 20;
  inp.value = nombre; inp.className = 'login-input';
  inp.style.cssText = 'width:100%;box-sizing:border-box';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:14px';
  const btnC = document.createElement('button');
  btnC.textContent = 'Cancelar'; btnC.style.cssText = 'flex:1;padding:10px;border:1px solid var(--border2);border-radius:11px;background:var(--surface2);color:var(--text);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer';
  btnC.onclick = function() { modal.remove(); };
  const btnS = document.createElement('button');
  btnS.textContent = 'Guardar'; btnS.style.cssText = 'flex:1;padding:10px;border:none;border-radius:11px;background:var(--accent);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer';
  btnS.onclick = function() {
    const val = (document.getElementById('rename-shelf-inp')?.value || '').trim();
    if (val) { setShelfName(nave, id, val); showToast({type:'success', title:'Armario renombrado', msg: id + ' → ' + val}); }
    modal.remove();
  };
  row.appendChild(btnC); row.appendChild(btnS);
  card.appendChild(title); card.appendChild(inp); card.appendChild(row);
  modal.appendChild(card);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(function() { inp.focus(); inp.select(); }, 80);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btnS.onclick();
    if (e.key === 'Escape') modal.remove();
  });
}
function loadNaveNames() { try { return JSON.parse(localStorage.getItem('hds_nave_names') || '{}'); } catch { return {}; } }
function saveNaveNames(n) { try { localStorage.setItem('hds_nave_names', JSON.stringify(n)); } catch {} }
function getNombreNave(nave) {
  const n = loadNaveNames();
  return n[nave] || (nave === 'n1' ? 'Nave 1' : 'Nave 2');
}
function setNombreNave(nave, nombre) {
  const n = loadNaveNames();
  n[nave] = nombre.trim() || (nave === 'n1' ? 'Nave 1' : 'Nave 2');
  saveNaveNames(n);
  applyNaveNames();
}
function applyNaveNames() {
  const n1 = getNombreNave('n1'), n2 = getNombreNave('n2');
  ['nav-title-n1','nave-lbl-n1'].forEach(function(id) {
    const el = document.getElementById(id); if (el) el.textContent = n1;
  });
  ['nav-title-n2','nave-lbl-n2'].forEach(function(id) {
    const el = document.getElementById(id); if (el) el.textContent = n2;
  });
  document.querySelectorAll('.pill[data-nave="N-1"]').forEach(function(p) { p.textContent = n1; });
  document.querySelectorAll('.pill[data-nave="N-2"]').forEach(function(p) { p.textContent = n2; });
}
function openRenameNave(nave) {
  if (!canAccess('renombrarNaves')) {
    showToast({ type:'danger', title:'Sin permiso', msg:'No tenés permiso para renombrar naves.' }); return;
  }
  document.getElementById('rename-nave-modal')?.remove();
  const nombre = getNombreNave(nave);
  const modal = document.createElement('div');
  modal.id = 'rename-nave-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:20px';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:24px 20px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)';
  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:14px';
  title.textContent = 'Renombrar nave';
  const inp = document.createElement('input');
  inp.id = 'rename-nave-inp'; inp.type = 'text'; inp.maxLength = 30;
  inp.value = nombre; inp.placeholder = 'Nombre de la nave';
  inp.className = 'login-input';
  inp.style.cssText = 'width:100%;box-sizing:border-box';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:14px';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.cssText = 'flex:1;padding:10px;border:1px solid var(--border2);border-radius:11px;background:var(--surface2);color:var(--text);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer';
  btnCancel.onclick = function() { modal.remove(); };
  const btnSave = document.createElement('button');
  btnSave.textContent = 'Guardar';
  btnSave.style.cssText = 'flex:1;padding:10px;border:none;border-radius:11px;background:var(--accent);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer';
  btnSave.onclick = function() { _confirmRenameNave(nave); };
  row.appendChild(btnCancel); row.appendChild(btnSave);
  card.appendChild(title); card.appendChild(inp); card.appendChild(row);
  modal.appendChild(card);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(function() { inp.focus(); inp.select(); }, 80);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') _confirmRenameNave(nave);
    if (e.key === 'Escape') modal.remove();
  });
}
function _confirmRenameNave(nave) {
  const val = (document.getElementById('rename-nave-inp')?.value || '').trim();
  if (val) { setNombreNave(nave, val); showToast({ type:'success', title:'Nombre actualizado', msg: getNombreNave(nave) }); }
  document.getElementById('rename-nave-modal')?.remove();
}
