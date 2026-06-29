// ═══════════════════════════════════════════════════════
// src/stock/shelfWindow.js
// Ventanas flotantes de estante (multi-ventana drag&drop).
// Drag de chips entre repisas/armarios (moveProductTo).
// Depende de: CELLS, stockData.js, stockBus.js, auth.js
// ═══════════════════════════════════════════════════════
'use strict';

let _shelfWins = {};         // 'nave|cell' → elemento DOM ventana
let _winZ      = 500;        // z-index incremental
let _winN      = 0;          // contador para escalonar posición
let _chipDrag  = null;       // estado del arrastre de producto

function openShelfWindow(nave, cell) {
  const key = nave + '|' + cell;
  if (_shelfWins[key]) { focusWin(_shelfWins[key]); flashWin(_shelfWins[key]); return; }
  if (!CELLS[nave] || !CELLS[nave][cell]) return;

  const win = document.createElement('div');
  win.className = 'shelf-win';
  win.dataset.key = key; win.dataset.nave = nave; win.dataset.cell = cell;
  const n = _winN++;
  win.style.left = (50 + (n % 6) * 30) + 'px';
  win.style.top  = (70 + (n % 6) * 30) + 'px';
  win.style.zIndex = ++_winZ;
  win.innerHTML =
    `<div class="shelf-win-head">
       <span class="shelf-win-title">Armario ${cell}<span class="sw-sub">${naveLbl(nave)}</span></span>
       <button class="shelf-win-btn edit" title="Editar estante (mover/rotar/color/borrar)">✎</button>
       <button class="shelf-win-btn close" title="Cerrar ventana">✕</button>
     </div>
     <div class="shelf-win-body"></div>
     <div class="shelf-win-foot">
       <button class="sw-foot-btn add">+ Producto</button>
     </div>`;
  document.body.appendChild(win);
  _shelfWins[key] = win;

  makeWinDraggable(win, win.querySelector('.shelf-win-head'));
  win.addEventListener('pointerdown', () => focusWin(win));
  win.querySelector('.close').onclick = () => closeShelfWindow(key);
  win.querySelector('.edit').onclick  = (e) => { e.stopPropagation(); openShelfEditMenu(cell, nave, e.currentTarget); };
  win.querySelector('.add').onclick   = () => { if (!canAccess('agregarProductos')) { showToast({type:'danger',title:'Sin permiso',msg:'No podés agregar productos.'}); return; } openNuevoProductoModal(nave); preselectArm('np-arm', npFillRepisas, cell); };

  renderShelfWindow(key);
  focusWin(win);
  // Mobile: tap outside closes
  if (window.matchMedia('(hover:none) and (pointer:coarse)').matches) {
    setTimeout(function() {
      function _outsideTap(e) {
        if (!win.contains(e.target)) {
          closeShelfWindow(key);
          document.removeEventListener('pointerdown', _outsideTap);
        }
      }
      document.addEventListener('pointerdown', _outsideTap);
    }, 200);
  }
}

function preselectArm(selId, fillFn, cell) {
  setTimeout(() => { const s = document.getElementById(selId); if (s) { s.value = cell; try{ fillFn(); }catch(e){} } }, 60);
}
function focusWin(win){ if (win) win.style.zIndex = ++_winZ; }
function flashWin(win){ win.classList.remove('flash'); void win.offsetWidth; win.classList.add('flash'); }
function closeShelfWindow(key){ const w = _shelfWins[key]; if (w){ w.remove(); delete _shelfWins[key]; } }
function closeAllShelfWindows(){ Object.keys(_shelfWins).forEach(closeShelfWindow); }
function refreshShelfWindow(nave, cell){ const key = nave+'|'+cell; if (_shelfWins[key]) renderShelfWindow(key); }

function renderShelfWindow(key){
  const win = _shelfWins[key]; if (!win) return;
  const nave = win.dataset.nave, cell = win.dataset.cell;
  const cellData = CELLS[nave] && CELLS[nave][cell];
  if (!cellData){ closeShelfWindow(key); return; }
  const body = win.querySelector('.shelf-win-body');
  body.innerHTML = '';
  Object.entries(cellData.repisas).forEach(([rid, rep]) => {
    const z = document.createElement('div');
    z.className = 'sw-repisa';
    z.dataset.nave = nave; z.dataset.cell = cell; z.dataset.rep = rid;
    const items = rep.items || [];
    z.innerHTML = `<div class="sw-rep-head"><span>${rid} · ${rep.cat || '—'}</span><span>${items.length} ítem${items.length===1?'':'s'}</span></div><div class="sw-chips"></div>`;
    const chips = z.querySelector('.sw-chips');
    if (!items.length) chips.innerHTML = '<div class="sw-empty">vacío — soltá un producto acá</div>';
    items.forEach((it, idx) => {
      const c = document.createElement('div');
      c.className = 'sw-chip';
      c.innerHTML = `<span class="sw-chip-name">${esc(it.n)}</span><span class="sw-chip-q">${esc(it.q)} ${esc(it.u||'')}</span><span class="sw-chip-x" title="Eliminar">✕</span>`;
      c.addEventListener('pointerdown', (e) => chipPointerDown(e, nave, cell, rid, idx));
      const xb = c.querySelector('.sw-chip-x');
      xb.addEventListener('pointerdown', (e) => e.stopPropagation());
      xb.addEventListener('click', (e) => { e.stopPropagation(); deleteChip(nave, cell, rid, idx); });
      chips.appendChild(c);
    });
    body.appendChild(z);
  });
}

// ── Arrastre de la VENTANA (mouse + touch vía Pointer Events) ──
function makeWinDraggable(win, handle){
  // On touch devices, disable drag (shelf is centered via CSS)
  if (window.matchMedia('(hover:none) and (pointer:coarse)').matches) return;
  let sx, sy, ox, oy, dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.shelf-win-btn')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    const r = win.getBoundingClientRect(); ox = r.left; oy = r.top;
    focusWin(win);
    try { handle.setPointerCapture(e.pointerId); } catch(err){}
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(-260, Math.min(nx, window.innerWidth - 40));
    ny = Math.max(0,    Math.min(ny, window.innerHeight - 40));
    win.style.left = nx + 'px'; win.style.top = ny + 'px';
  });
  const end = () => { dragging = false; };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// ── Arrastre de PRODUCTOS entre ventanas (mouse + touch) ──
function chipPointerDown(e, nave, cell, repisa, idx){
  if (e.target.closest('.sw-chip-x')) return;
  const item = CELLS[nave] && CELLS[nave][cell] && CELLS[nave][cell].repisas[repisa].items[idx];
  if (!item) return;
  _chipDrag = { nave, cell, repisa, idx, item, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, zone: null, chipEl: e.currentTarget };
  document.addEventListener('pointermove', chipPointerMove);
  document.addEventListener('pointerup', chipPointerUp);
  document.addEventListener('pointercancel', chipPointerUp);
  // Bloquear selección de texto durante el arrastre (evita la sombra visual en todo el texto)
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
}
function chipPointerMove(e){
  const d = _chipDrag; if (!d) return;
  const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
  if (!d.moved && Math.hypot(dx, dy) < 6) return;
  if (!d.moved){
    d.moved = true;
    d.chipEl && d.chipEl.classList.add('dragging');
    const g = document.createElement('div');
    g.className = 'sw-chip-ghost';
    g.textContent = `${d.item.n} · ${d.item.q}`;
    document.body.appendChild(g);
    d.ghost = g;
  }
  d.ghost.style.left = (e.clientX + 12) + 'px';
  d.ghost.style.top  = (e.clientY + 12) + 'px';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const zone = el && el.closest('.sw-repisa');
  if (zone !== d.zone){
    if (d.zone) d.zone.classList.remove('dropok');
    d.zone = zone;
    if (zone) zone.classList.add('dropok');
  }
}
function chipPointerUp(){
  const d = _chipDrag;
  document.removeEventListener('pointermove', chipPointerMove);
  document.removeEventListener('pointerup', chipPointerUp);
  document.removeEventListener('pointercancel', chipPointerUp);
  // Restaurar selección de texto
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  if (!d) return;
  _chipDrag = null;
  if (d.ghost) d.ghost.remove();
  if (d.chipEl) d.chipEl.classList.remove('dragging');
  if (d.zone) d.zone.classList.remove('dropok');
  if (!d.moved){ openProductDetail(d.nave, d.cell, d.repisa, d.idx); return; }  // click = ver detalle
  if (d.zone){
    moveProductTo(d, d.zone.dataset.nave, d.zone.dataset.cell, d.zone.dataset.rep);
  }
}

// ── Mutación de estado: mover producto de un estante a otro ──
function moveProductTo(src, dNave, dCell, dRep){
  if (src.nave === dNave && src.cell === dCell && src.repisa === dRep) return; // mismo lugar
  const srcItems = CELLS[src.nave] && CELLS[src.nave][src.cell] && CELLS[src.nave][src.cell].repisas[src.repisa].items;
  const dstItems = CELLS[dNave] && CELLS[dNave][dCell] && CELLS[dNave][dCell].repisas[dRep] && CELLS[dNave][dCell].repisas[dRep].items;
  if (!srcItems || !dstItems) return;
  const item = srcItems[src.idx];
  if (!item) return;
  srcItems.splice(src.idx, 1);
  dstItems.push(item);
  saveCells();
  // Registrar como edición (movimiento de ubicación) en lugar de ingreso/egreso doble
  logEdicion('Movido', `${item.n}: ${naveLbl(src.nave)} ${src.cell}-${src.repisa} → ${naveLbl(dNave)} ${dCell}-${dRep}`, `cant: ${item.q} ${item.u||'UN'}`);
  refreshShelfWindow(src.nave, src.cell);
  refreshShelfWindow(dNave, dCell);
  updateNavBadges && updateNavBadges();
  showToast({ type:'success', title:'Producto movido', msg:`${item.n} → ${naveLbl(dNave)} · ${dCell}-${dRep}` });
}

function deleteChip(nave, cell, rid, idx){
  if (!canAccess('eliminarProductos') && !canAccess('restarStock')) {
    showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para eliminar productos.'}); return;
  }
  const items = CELLS[nave][cell].repisas[rid].items;
  const it = items[idx]; if (!it) return;
  if (!confirm(`¿Eliminar "${it.n}" de ${cell}-${rid}?`)) return;
  items.splice(idx, 1);
  saveCells();
  StockBus.emit('egreso', { item: it, cantidad: it.q, cid: cell, rid, nave, precio: it.precio || null });
  refreshShelfWindow(nave, cell);
}


function selectRep_UNUSED_REPLACED_BELOW(rid, nave, cid, popup) {
  // This function is replaced by the edit-mode-aware version at the bottom of the script.
  // Keep this stub so we don't break references during refactor.
}

// ── TOGGLE FORM ──────────────────────────────────────────────────────────────
function positionFloatForm() {
  const ff = POP.ff;
  const iBox = POP.iBox;
  if (!iBox || !ff) return;
  const bb = iBox.getBoundingClientRect();
  ff.style.left = bb.left + 'px';
  ff.style.width = bb.width + 'px';
  // Try to place above; if not enough room, place below
  const ffH = ff.offsetHeight || 260;
  if (bb.top - ffH - 8 > 52) {
    ff.style.top = (bb.top - ffH - 8) + 'px';
  } else {
    ff.style.top = (bb.bottom + 8) + 'px';
  }
}

function toggleForm(type) {
  if (POP.activeForm === type) {
    closeFloatForm();
    return;
  }
  POP.activeForm = type;

  // Update icon states
  POP.iBox.querySelector('.is-edit')?.classList.toggle('active',  type === 'editar');
  POP.iBox.querySelector('.is-sumar')?.classList.toggle('active', type === 'sumar');
  POP.iBox.querySelector('.is-nuevo')?.classList.toggle('active', type === 'nuevo');

  const ff   = POP.ff;
  const rid  = POP.activeRid;
  const cid  = POP.cellId;
  const nave = POP.nave;
  const cell = CELLS[nave][cid];

  if (type === 'editar') {
    // ── FORM: EDITAR ITEMS ──
    const rep2 = cell.repisas[rid];
    if (!rep2.items.length) {
      ff.innerHTML = `
        <div class="ff-head nuevo">✏ EDITAR ESTANTERÍA</div>
        <div class="ff-body"><div style="font-size:11px;color:var(--muted);letter-spacing:1px;text-align:center;padding:8px 0">— Sin elementos para editar —</div></div>
        <div class="ff-actions"><button class="ff-cancel" onclick="closeFloatForm()">Cerrar</button></div>`;
    } else {
      const editRows = rep2.items.map((it, i) => `
        <div class="edit-row" id="er-${i}">
          <div class="ff-row" style="margin-bottom:4px">
            <div class="ff-field"><label class="ff-label">Nombre</label>
              <input class="ff-input" id="en-${i}" type="text" value="${esc(it.n)}" autocomplete="off"/>
            </div>
            <div class="ff-field"><label class="ff-label">Spec</label>
              <input class="ff-input" id="es-${i}" type="text" value="${esc(it.s)}"/>
            </div>
          </div>
          <div class="ff-row">
            <div class="ff-field"><label class="ff-label">Cantidad</label>
              <input class="ff-input" id="eq-${i}" type="number" value="${esc(it.q)}" min="0"/>
            </div>
            <div class="ff-field"><label class="ff-label">Unidad</label>
              <select class="ff-select" id="eu-${i}">
                ${['UN','KG','M','L','CJ'].map(u=>`<option value="${u}"${u===it.u?' selected':''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:3px">
            <button class="ff-cancel" style="flex:0;padding:3px 9px;font-size:9px;color:var(--red);border-color:rgba(232,91,75,.3)" onclick="deleteItem(${i})">✕ Eliminar</button>
          </div>
          <div style="height:1px;background:rgba(255,255,255,.08);margin:6px 0"></div>
        </div>`).join('');
function deleteChip(nave, cell, rid, idx){
  if (!canAccess('eliminarProductos') && !canAccess('restarStock')) {
    showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para eliminar productos.'}); return;
  }
  const items = CELLS[nave][cell].repisas[rid].items;
  const it = items[idx]; if (!it) return;
  if (!confirm(`¿Eliminar "${it.n}" de ${cell}-${rid}?`)) return;
  items.splice(idx, 1);
  saveCells();
  StockBus.emit('egreso', { item: it, cantidad: it.q, cid: cell, rid, nave, precio: it.precio || null });
  refreshShelfWindow(nave, cell);
}


function selectRep_UNUSED_REPLACED_BELOW(rid, nave, cid, popup) {
  // This function is replaced by the edit-mode-aware version at the bottom of the script.
  // Keep this stub so we don't break references during refactor.
}

