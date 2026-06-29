// ═══════════════════════════════════════════════════════
// src/stock/shelfEditor.js
// Editor de estantes en el plano SVG:
// mover, rotar, color, borrar, copiar, resize,
// FAB menu, modal nueva estantería, snap grid.
// Depende de: CELLS, constants.js, auth.js, stockBus.js,
//             shelfNames.js, stockData.js
// ═══════════════════════════════════════════════════════
'use strict';

let _newShelfNave      = null;
let _shelfMoveState    = null;
let _shelfDeleteMode   = false;
let _shelfDeleteTarget = null;
let _shelfClipboard    = null;
let _colorPickerTemp   = null;
let _fabNave           = null;

function getSvgForNave(nave) {
  const screen = document.getElementById('sc-' + nave);
  if (!screen) return null;
  // IMPORTANTE: el topbar tiene íconos <svg> antes del plano, así que
  // hay que apuntar específicamente al SVG del mapa (dentro de .map-canvas).
  return screen.querySelector('.map-canvas svg') || screen.querySelector('svg');
}

function getCellEl(cellId, nave) {
  return document.querySelector(`.cell[data-id="${cellId}"][data-nave="${nave}"]`);
}

function snapToGrid(val) {
  return Math.round(val / GRID) * GRID;
}

function getSvgScale(svg) {
  const bb = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return { sx: vb.width / bb.width, sy: vb.height / bb.height, bb, vb };
}

// ── PRODUCTO: ID/SKU, metadata y detalle (B1) ────────────────────────────────
function cssAttr(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function ensureItemId(item){
  if (!item.id) item.id = 'SKU-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
  return item.id;
}
// Atributos personalizados en el form Nuevo Producto
function npResetMeta(){ const c=document.getElementById('np-meta-rows'); if(c) c.innerHTML=''; }
function npAddMetaRow(k='', v=''){
  const c = document.getElementById('np-meta-rows'); if(!c) return;
  const row = document.createElement('div'); row.className='np-meta-row';
  row.innerHTML = `<input type="text" class="np-meta-k" placeholder="Atributo (ej. Marca)" value="${esc(k)}"/>
    <input type="text" class="np-meta-v" placeholder="Valor (ej. SKF)" value="${esc(v)}"/>
    <button type="button" class="np-meta-del" onclick="this.parentNode.remove()">×</button>`;
  c.appendChild(row);
}
function npCollectMeta(){
  const meta = {};
  document.querySelectorAll('#np-meta-rows .np-meta-row').forEach(r=>{
    const k=(r.querySelector('.np-meta-k')?.value||'').trim();
    const v=(r.querySelector('.np-meta-v')?.value||'').trim();
    if(k) meta[k]=v;
  });
  return meta;
}

let _pdRef = null, _pdQrInstance = null;
let _fabNave = null;
function toggleFabMenu(nave) {
  _fabNave = nave;
  const menu = document.getElementById('fab-menu-' + nave);
  const fab  = document.getElementById('fab-' + nave);
  const willOpen = !menu.classList.contains('on');
  closeFabMenus();
  if (willOpen) { menu.classList.add('on'); fab.classList.add('on'); }
}
function closeFabMenus() {
  document.querySelectorAll('.fab-menu').forEach(m => m.classList.remove('on'));
  document.querySelectorAll('.map-fab').forEach(f => f.classList.remove('on'));
}
document.addEventListener('click', e => { if (!e.target.closest('.fab-wrap')) closeFabMenus(); });

function fabAction(type) {
  const nave = _fabNave;
  closeFabMenus();
  if (type === 'estante') {
    if (!canAccess('crearEstantes')) { showToast({type:'danger',title:'Sin permiso',msg:'No podés crear estantes.'}); return; }
    openNewShelfModal(nave);
  } else if (type === 'producto') {
    if (!canAccess('agregarProductos')) { showToast({type:'danger',title:'Sin permiso',msg:'No podés agregar productos.'}); return; }
    openNuevoProductoModal(nave);
  } else if (type === 'sumar') {
    if (!canAccess('sumarStock')) { showToast({type:'danger',title:'Sin permiso',msg:'No podés sumar stock.'}); return; }
    openSumarStockModal(nave);
  }
}

// Lista de armarios (con repisas) de una nave, ordenada
function armariosDeNave(nave) {
  return Object.keys(CELLS[nave] || {}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
}
function fillSelect(sel, values, makeLabel) {
  if (!sel) return;
  sel.innerHTML = values.map(v => `<option value="${esc(v)}">${esc(makeLabel?makeLabel(v):v)}</option>`).join('');
}

// ── NUEVO PRODUCTO (global, desde el +) ───────────────────────────────────────
function openNuevoProductoModal(nave) {
  _fabNave = nave;
  const arms = armariosDeNave(nave);
  if (!arms.length) { showToast({type:'warn',title:'Sin estanterías',msg:'Creá primero una estantería con "Nuevo estante".'}); return; }
  fillSelect(DOM.get('np-arm'), arms);
  npFillCatList();
  npFillRepisas();
  ['np-nombre','np-cant','np-spec','np-min','np-precio'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const npTipoBienEl = document.getElementById('np-tipo-bien'); if (npTipoBienEl) npTipoBienEl.value = '';
  npResetMeta();
  DOM.get('np-fecha').value = localToday();
  DOM.get('np-err').style.display = 'none';
  document.getElementById('npModal').classList.add('on');
  setTimeout(() => DOM.get('np-nombre')?.focus(), 150);
}
function closeNpModal() { document.getElementById('npModal').classList.remove('on'); }
function npFillRepisas() {
  const arm = DOM.get('np-arm').value;
  const reps = Object.keys(CELLS[_fabNave]?.[arm]?.repisas || {});
  fillSelect(DOM.get('np-rep'), reps);
  npSyncCatFromRepisa();
}
function saveNuevoGlobal() {
  if (!canAccess('agregarProductos')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para agregar productos.'}); return; }
  const nave   = _fabNave;
  const arm    = DOM.get('np-arm').value;
  const repisa = DOM.get('np-rep').value;
  const nombre = (DOM.get('np-nombre').value || '').trim().toUpperCase();
  const cant   = parseInt(DOM.get('np-cant').value) || 0;
  const spec   = (DOM.get('np-spec').value || '').trim() || '—';
  const precio = Math.max(0, parseFloat(DOM.get('np-precio')?.value) || 0);
  const stockMin = Math.max(0, parseInt(DOM.get('np-min').value) || 0);
  const fecha  = DOM.get('np-fecha').value || localToday();
  const errEl  = DOM.get('np-err');
  if (!arm || !repisa || !nombre || cant < 1) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  // Categoría: clasifica la repisa donde se guarda el producto (modelo: cat por repisa)
  const catVal = (document.getElementById('np-cat')?.value || '').trim().toUpperCase();
  if (catVal && CELLS[nave]?.[arm]?.repisas?.[repisa]) {
    CELLS[nave][arm].repisas[repisa].cat = catVal;
  }

  const tipoBien = (document.getElementById('np-tipo-bien')?.value || '') || null;
  const newItem = { n: nombre, q: cant, u: 'UN', s: spec };
  if (precio > 0)   newItem.precio = precio;
  if (stockMin > 0) newItem.stockMin = stockMin;
  if (tipoBien)     newItem.tipoBien = tipoBien;
  const meta = npCollectMeta();
  if (Object.keys(meta).length) newItem.meta = meta;
  ensureItemId(newItem);                       // SKU/ID estable para QR y ruta
  CELLS[nave][arm].repisas[repisa].items.push(newItem);
  saveCells();

  const naveLabel = nave === 'n1' ? 'N-1' : 'N-2';
  StockBus.emit('ingreso', { item: newItem, cantidad: cant, cid: arm, rid: repisa, nave, precio: precio || null });
  if (stockMin > 0 && cant <= stockMin) checkStockLow(nombre, cant, arm, repisa, naveLabel);

  closeNpModal();
  // Si el popup de ese armario está abierto, refrescarlo
  if (POP && POP.cellId === arm && POP.nave === nave) selectRep(repisa, nave, arm, POP.el);
  refreshShelfWindow(nave, arm);
  openQR({ nombre, cant, unidad:'UN', spec, repisa, armario: arm, nave: naveLabel, fecha, precio });
}

// ── SUMAR STOCK (global, desde el +) ──────────────────────────────────────────
function openSumarStockModal(nave) {
  _fabNave = nave;
  const arms = armariosDeNave(nave);
  if (!arms.length) { showToast({type:'warn',title:'Sin estanterías',msg:'No hay estanterías en esta nave.'}); return; }
  fillSelect(DOM.get('ss-arm'), arms);
  ssFillRepisas();
  DOM.get('ss-cant').value = '';
  DOM.get('ss-fecha').value = localToday();
  DOM.get('ss-err').style.display = 'none';
  DOM.get('ssModal').classList.add('on');
}
function closeSsModal() { DOM.get('ssModal').classList.remove('on'); }
function ssFillRepisas() {
  const arm = DOM.get('ss-arm').value;
  const reps = Object.keys(CELLS[_fabNave]?.[arm]?.repisas || {});
  fillSelect(DOM.get('ss-rep'), reps);
  ssFillProds();
}
function ssFillProds() {
  const arm = DOM.get('ss-arm').value;
  const rep = DOM.get('ss-rep').value;
  const items = CELLS[_fabNave]?.[arm]?.repisas?.[rep]?.items || [];
  const sel = DOM.get('ss-prod');
  if (!items.length) {
    sel.innerHTML = '<option value="">— Sin productos en esta repisa —</option>';
  } else {
    sel.innerHTML = items.map((it,i) => `<option value="${i}">${esc(it.n)} · ${esc(it.q)} ${esc(it.u)} (${esc(it.s)})</option>`).join('');
  }
}
function saveSumarGlobal() {
  if (!canAccess('sumarStock')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para sumar stock.'}); return; }
  const nave = _fabNave;
  const arm  = DOM.get('ss-arm').value;
  const rep  = DOM.get('ss-rep').value;
  const idx  = parseInt(DOM.get('ss-prod').value);
  const cant = parseInt(DOM.get('ss-cant').value) || 0;
  const fecha = DOM.get('ss-fecha').value || localToday();
  const errEl = DOM.get('ss-err');
  const item = CELLS[nave]?.[arm]?.repisas?.[rep]?.items?.[idx];
  if (!item || cant < 1) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  item.q += cant;
  saveCells();
  const naveLabel = nave === 'n1' ? 'N-1' : 'N-2';
  StockBus.emit('ingreso', { item, cantidad: cant, cid: arm, rid: rep, nave, precio: item.precio || null });

  closeSsModal();
  if (POP && POP.cellId === arm && POP.nave === nave) selectRep(rep, nave, arm, POP.el);
  refreshShelfWindow(nave, arm);
  showToast({ type:'success', title:'Stock sumado', msg:`+${cant} ${item.u} a ${item.n} (${arm}-${rep})` });
}

// ── NUEVA ESTANTERÍA ──────────────────────────────────────────────────────────
function openNewShelfModal(nave) {
  _newShelfNave = nave;
  ['ns-id','ns-cat'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('ns-repisas').value = '2';
  document.getElementById('ns-w').value = '80';
  document.getElementById('ns-h').value = '40';
  document.getElementById('ns-err').style.display = 'none';
  document.getElementById('new-shelf-modal').classList.add('on');
  setTimeout(() => document.getElementById('ns-id')?.focus(), 120);
}
function closeNewShelfModal() {
  document.getElementById('new-shelf-modal').classList.remove('on');
}

function saveNewShelf() {
  const id   = (document.getElementById('ns-id').value || '').trim().toUpperCase();
  const nRep = Math.max(1, parseInt(document.getElementById('ns-repisas').value) || 2);
  const wcm  = Math.max(20, parseInt(document.getElementById('ns-w').value) || 80);
  const hcm  = Math.max(20, parseInt(document.getElementById('ns-h').value) || 40);
  const cat  = (document.getElementById('ns-cat').value || '').trim().toUpperCase() || '—';
  const color= document.getElementById('ns-color')?.value || '';
  const errEl = document.getElementById('ns-err');
  if (!id) { errEl.textContent = 'Ingresá un ID'; errEl.style.display='block'; return; }
  if (CELLS[_newShelfNave][id]) { errEl.textContent = `Ya existe "${id}"`; errEl.style.display='block'; return; }

  // Convertir cm a unidades SVG (1 cm = 1 SVG unit en esta escala)
  const w = Math.round(wcm / CM_PER_SVG);
  const h = Math.round(hcm / CM_PER_SVG);

  const repisas = {};
  for (let i = 1; i <= nRep; i++) repisas[id + i] = { cat, items: [] };
  CELLS[_newShelfNave][id] = { repisas, color };   // color en el modelo
  saveCells();

  const svg = getSvgForNave(_newShelfNave);
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  const sx = snapToGrid(vb.width/2 - w/2);
  const sy = snapToGrid(vb.height/2 - h/2);
  drawShelfNode(svg, _newShelfNave, id, sx, sy, w, h, { color, rot:0 });
  recordShelfGeom(_newShelfNave, id, { x:sx, y:sy, w, h });
  if (color) setCellStyle(_newShelfNave, id, { color });
  closeNewShelfModal();
  showToast({ type:'success', title:'Estantería creada', msg:`"${id}" ${wcm}×${hcm} cm — usá Mover para reposicionarla` });
  setTimeout(() => activateMoveMode(id, _newShelfNave), 200);
}

// Aplica color (y tinte de texto contrastante) a un nodo de celda
function applyShelfColor(g, color) {
  if (!color) { g.classList.remove('colored'); g.style.removeProperty('--shelf-color'); g.style.removeProperty('--shelf-ink'); return; }
  g.classList.add('colored');
  // Store the solid hex so the stroke and text ink stay vivid
  g.style.setProperty('--shelf-color', color);
  g.style.setProperty('--shelf-ink', textInkFor(color));
  // Apply translucent fill directly on the rect element
  const rect = g.querySelector('rect:not(.shelf-resize-handle)');
  if (rect) {
    rect.setAttribute('fill', color);
    rect.setAttribute('fill-opacity', '0.42');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-opacity', '0.80');
    rect.setAttribute('stroke-width', '1.5');
  }
}
function textInkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#0B1C3F';
  const n = parseInt(m[1],16), r=(n>>16)&255, gC=(n>>8)&255, b=n&255;
  const lum = (0.299*r + 0.587*gC + 0.114*b);
  // With translucent fill, use the solid color for text so it's always readable
  return lum > 128 ? '#0B1C3F' : '#FFFFFF';
}
// Rota visualmente el nodo en pasos de 90°, manteniendo el texto derecho
function applyShelfRotation(g, rot) {
  const r = g.querySelector('rect:not(.shelf-resize-handle)'); if (!r) return;
  const x=+r.getAttribute('x'), y=+r.getAttribute('y'), w=+r.getAttribute('width'), h=+r.getAttribute('height');
  const cx=x+w/2, cy=y+h/2;
  g.dataset.rot = rot;
  if (rot % 360 === 0) { g.removeAttribute('transform'); g.querySelector('text')?.removeAttribute('transform'); }
  else {
    g.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
    g.querySelector('text')?.setAttribute('transform', `rotate(${-rot} ${cx} ${cy})`); // texto derecho
  }
}

// Crea el nodo SVG (g/rect/text) de una estantería dinámica
function drawShelfNode(svg, nave, id, x, y, w, h, opts) {
  opts = opts || {};
  const NS = 'http://www.w3.org/2000/svg';
  const g  = document.createElementNS(NS,'g');
  const r  = document.createElementNS(NS,'rect');
  const t  = document.createElementNS(NS,'text');
  g.setAttribute('class','cell');
  g.dataset.id = id; g.dataset.nave = nave; g.dataset.dynamic = '1';
  g.setAttribute('onclick','cellClick(this)');
  g.setAttribute('role','button');
  g.setAttribute('tabindex','0');
  g.setAttribute('aria-label','Armario ' + id + ', ver contenido');
  r.setAttribute('x',x); r.setAttribute('y',y);
  r.setAttribute('width',w); r.setAttribute('height',h); r.setAttribute('rx','3');
  t.setAttribute('x',x+w/2); t.setAttribute('y',y+h/2);
  t.setAttribute('font-size', w<32?9:w<55?12:16);
  t.textContent = id;
  g.appendChild(r); g.appendChild(t); svg.appendChild(g);
  if (opts.color) applyShelfColor(g, opts.color);
  if (opts.rot)   applyShelfRotation(g, opts.rot);
  return g;
}

// Re-dibuja las estanterías creadas dinámicamente al cargar la página
function restoreShelves() {
  const geom = loadShelfGeom();
  ['n1','n2'].forEach(nave => {
    const svg = getSvgForNave(nave);
    if (!svg) return;
    Object.entries(geom[nave] || {}).forEach(([id, gm]) => {
      if (svg.querySelector(`g.cell[data-id="${cssEsc(id)}"]`)) return; // ya existe
      if (!CELLS[nave] || !CELLS[nave][id]) return; // sin datos => ignorar
      const st = getCellStyle(nave, id);
      drawShelfNode(svg, nave, id, gm.x, gm.y, gm.w, gm.h, { color: st.color || CELLS[nave][id].color, rot: st.rot || 0 });
    });
  });
  applyCellStyles();
}
// Aplica color/rotación guardados a TODAS las celdas (estáticas + dinámicas)
function applyCellStyles() {
  const s = loadCellStyles();
  ['n1','n2'].forEach(nave => {
    Object.entries(s[nave] || {}).forEach(([id, st]) => {
      const g = getCellEl(id, nave);
      if (!g) return;
      if (st.color) applyShelfColor(g, st.color);
      if (st.rot)   applyShelfRotation(g, st.rot);
    });
  });
}
function cssEsc(s){ try { return (window.CSS&&CSS.escape)?CSS.escape(s):s.replace(/([^\w-])/g,'\\$1'); } catch { return s; } }

// ── MENÚ CONTEXTUAL "EDITAR ESTANTE" (Mover / Rotar / Color / Borrar) ─────────
function closeShelfEditMenu() {
  const m = document.getElementById('shelf-edit-menu');
  if (m) m.remove();
  document.removeEventListener('click', _shelfMenuOutside, true);
}
function _shelfMenuOutside(e) {
  if (!e.target.closest('#shelf-edit-menu') && !e.target.closest('.shelf-win-btn.edit')) closeShelfEditMenu();
}
function openShelfEditMenu(id, nave, btn) {
  closeShelfEditMenu();
  const menu = document.createElement('div');
  menu.className = 'shelf-edit-menu';
  menu.id        = 'shelf-edit-menu';

  const SVG = {
    renombrar: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    mover: '<svg viewBox="0 0 24 24"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
    rotar: '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
    color: '<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 000 20c.94 0 1.7-.76 1.7-1.7 0-.44-.17-.84-.44-1.14-.27-.3-.44-.7-.44-1.14 0-.94.76-1.7 1.7-1.7H16a6 6 0 006-6c0-4.42-4.48-8-10-8z"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    pegar:  '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
    borrar:'<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  };

  // Build items (only show what user has permission for, or all if admin)
  const hasPaste = !!_shelfClipboard;
  const items = [
    { action:'renombrar', label:'Renombrar armario', perm:'renombrarEstantes', cls:'rotar'  },
    { action:'copiar',  label:'Copiar estante',       perm:'moverEstantes',    cls:'copiar' },
    { action:'pegar',   label:'Pegar estante',        perm:'crearEstantes',    cls:'pegar', disabled: !hasPaste },
    { action:'mover',   label:'Mover estante',        perm:'moverEstantes',    cls:'mover'  },
    { action:'rotar',   label:'Rotar 90°',            perm:'rotarEstantes',    cls:'rotar'  },
    { action:'color',   label:'Cambiar color',        perm:'colorEstantes',    cls:'color'  },
    { action:'borrar',  label:'Borrar estante',       perm:'borrarEstantes',   cls:'danger', divBefore:true },
  ];

  let html = '';
  items.forEach(function(it) {
    if (it.divBefore) html += '<div class="sem-divider"></div>';
    const permBlocked = !canAccess(it.perm);
    const isDisabled  = permBlocked || it.disabled;
    const style    = isDisabled ? ' style="opacity:.4;cursor:not-allowed"' : '';
    let onclick;
    if (permBlocked) {
      onclick = 'showToast({type:\'danger\',title:\'Sin permiso\',msg:\'No ten\u00e9s permiso para esta acci\u00f3n.\'})';
    } else if (it.disabled) {
      onclick = 'showToast({type:\'info\',title:\'Sin nada copiado\',msg:\'Copi\u00e1 un estante primero con clic derecho.\' })';
    } else {
      onclick = 'shelfEditAction(\'' + it.action + '\',\'' + id + '\',\'' + nave + '\')';
    }
    html += '<button class="' + it.cls + '"' + style + ' onclick="' + onclick + '">'
          + SVG[it.action] + it.label + '</button>';
  });

  menu.innerHTML = html;
  document.body.appendChild(menu);

  // Smart positioning: prefer below btn, flip up if no room
  const r   = btn.getBoundingClientRect();
  const mH  = 200; // estimated menu height
  const mW  = 200;
  let top  = r.bottom + 6;
  let left = r.left;

  if (top + mH > window.innerHeight - 10) top = Math.max(10, r.top - mH - 6);
  if (left + mW > window.innerWidth  - 10) left = Math.max(8, window.innerWidth - mW - 10);

  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';

  requestAnimationFrame(function() { menu.classList.add('on'); });
  setTimeout(function() { document.addEventListener('click', _shelfMenuOutside, true); }, 0);
}
// Portapapeles de estante (en memoria)
let _shelfClipboard = null;

function shelfEditAction(action, id, nave) {
  closeShelfEditMenu();
  if (action === 'renombrar') {
    if (!canAccess('renombrarEstantes')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para renombrar armarios.'}); return; }
    openRenameShelf(nave, id); return;
  }
  if (action === 'copiar') { _copyShelf(id, nave); return; }
  if (action === 'pegar')  { _pasteShelf(id, nave); return; }
  const guardMap = { mover:'moverEstantes', borrar:'borrarEstantes', rotar:'rotarEstantes', color:'colorEstantes' };
  const perm = guardMap[action];
  if (perm && !canAccess(perm)) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para esta acción sobre estantes.'}); return; }
  if (action === 'mover')  { activateMoveMode(id, nave); return; }
  if (action === 'borrar') { activateDeleteMode(id, nave); return; }
  if (action === 'rotar')  { rotateShelf(id, nave); return; }
  if (action === 'color')  { recolorShelf(id, nave); return; }
}

function _copyShelf(id, nave) {
  const g = getCellEl(id, nave);
  if (!g) return;
  const r = g.querySelector('rect:not(.shelf-resize-handle)');
  if (!r) return;
  const st  = getCellStyle(nave, id);
  const name = getShelfName(nave, id);
  _shelfClipboard = {
    w: parseFloat(r.getAttribute('width')),
    h: parseFloat(r.getAttribute('height')),
    color: st.color || null,
    rot:   st.rot   || 0,
    nombre: name !== id ? name : null,
    sourceNave: nave,
    sourceId: id,
  };
  showToast({ type:'success', title:'Estante copiado', msg:'"' + (name) + '" — usá Pegar para duplicarlo.' });
}

function _pasteShelf(nearId, nave) {
  if (!_shelfClipboard) { showToast({type:'info',title:'Sin nada copiado',msg:'Copiá un estante primero.'}); return; }
  if (!canAccess('crearEstantes')) { showToast({type:'danger',title:'Sin permiso',msg:'No podés crear estantes.'}); return; }
  const svg = getSvgForNave(nave);
  if (!svg) return;

  // Generar ID único para la copia
  const existing = new Set(Object.keys(CELLS[nave] || {}));
  let suffix = 1;
  let newId;
  do { newId = 'C' + suffix++; } while (existing.has(newId));

  // Posición: desplazada 30px respecto al estante de origen si existe, si no centro
  const srcG = nearId ? getCellEl(nearId, nave) : null;
  let nx = 60, ny = 60;
  if (srcG) {
    const sr = srcG.querySelector('rect:not(.shelf-resize-handle)');
    if (sr) { nx = parseFloat(sr.getAttribute('x')) + 30; ny = parseFloat(sr.getAttribute('y')) + 30; }
  }
  nx = snapToGrid(nx); ny = snapToGrid(ny);

  const { w, h, color, rot, nombre } = _shelfClipboard;
  const g = drawShelfNode(svg, nave, newId, nx, ny, w, h, { color, rot });
  enhanceA11y(g.parentElement);
  CELLS[nave][newId] = { repisas: { [newId+'1']:{cat:'—',items:[]}, [newId+'2']:{cat:'—',items:[]} } };
  saveCells();
  recordShelfGeom(nave, newId, { x:nx, y:ny, w, h });
  if (color) setCellStyle(nave, newId, { color });
  if (rot)   setCellStyle(nave, newId, { rot });
  if (nombre) { setShelfName(nave, newId, nombre + ' (copia)'); }

  showToast({ type:'success', title:'Estante pegado', msg:'Nuevo estante "' + newId + '" creado. Podés renombrarlo.' });
}
function rotateShelf(id, nave) {
  const g = getCellEl(id, nave);
  if (!g) return;
  const rot = ((parseInt(g.dataset.rot || '0') + 90) % 360);
  applyShelfRotation(g, rot);
  setCellStyle(nave, id, { rot });
  logEdicion('Rotado', `Armario ${id} rotado a ${rot}°`, `${naveLbl(nave)}`);
  showToast({ type:'info', title:'Estante rotado', msg:`"${id}" a ${rot}°` });
}
function recolorShelf(id, nave) {
  const g = getCellEl(id, nave);
  if (!g) return;
  _openColorPicker(id, nave, g);
}

function _openColorPicker(id, nave, g) {
  // Remove any existing picker
  DOM.get('shelf-color-modal')?.remove();

  const PALETTE = [
    '#16A35A','#0D63EA','#E5484D','#F59E0B','#8B5CF6',
    '#EC4899','#14B8A6','#F97316','#6B7280','#1E293B',
    '#FFFFFF','#059669','#DC2626','#2563EB','#7C3AED',
  ];

  const cur = getCellStyle(nave, id).color || '#16A35A';

  const modal = document.createElement('div');
  modal.id = 'shelf-color-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);padding:20px';

  let swatchHtml = PALETTE.map(function(col) {
    const active = col.toLowerCase() === cur.toLowerCase() ? ' scm-active' : '';
    return '<button class="scm-swatch' + active + '" style="background:' + col + '" onclick="_pickColor(\'' + id + '\',\'' + nave + '\',\'' + col + '\')" title="' + col + '"></button>';
  }).join('');

  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:22px 20px;max-width:300px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px)">'
    + '<div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:4px">Color del estante <b>' + id + '</b></div>'
    + '<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Elegí un color o ingresá un código hex</div>'
    + '<div class="scm-grid">' + swatchHtml + '</div>'
    + '<div style="margin-top:14px;display:flex;gap:8px;align-items:center">'
    +   '<input id="scm-hex" type="color" value="' + cur + '" style="width:40px;height:36px;border:1px solid var(--border2);border-radius:8px;cursor:pointer;padding:2px;background:var(--surface)" oninput="_previewColor(\'' + id + '\',\'' + nave + '\',this.value)" onchange="_pickColor(\'' + id + '\',\'' + nave + '\',this.value)"/>'
    +   '<input id="scm-hex-text" type="text" value="' + cur + '" maxlength="7" placeholder="#RRGGBB" style="flex:1;font-family:inherit;font-size:13px;font-weight:600;padding:8px 10px;border:1px solid var(--border2);border-radius:9px;background:var(--surface);color:var(--text);outline:none" oninput="_hexTextInput(\'' + id + '\',\'' + nave + '\')" />'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    +   '<button onclick="_closeColorPicker()" style="flex:1;padding:10px;border:1px solid var(--border2);border-radius:11px;background:var(--surface2);color:var(--text);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>'
    +   '<button onclick="_confirmColor(\'' + id + '\',\'' + nave + '\')" style="flex:1;padding:10px;border:none;border-radius:11px;background:var(--accent);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">Confirmar</button>'
    + '</div>'
    + '</div>';

  modal.addEventListener('click', function(e) { if (e.target === modal) _closeColorPicker(); });
  document.body.appendChild(modal);
}

let _colorPickerTemp = null;
function _previewColor(id, nave, hex) {
  _colorPickerTemp = { id, nave, hex };
  const g = getCellEl(id, nave);
  if (g) applyShelfColor(g, hex);
  const hexText = DOM.get('scm-hex-text');
  if (hexText) hexText.value = hex;
}
function _pickColor(id, nave, hex) {
  _colorPickerTemp = { id, nave, hex };
  const g = getCellEl(id, nave);
  if (g) applyShelfColor(g, hex);
  const hexInput = DOM.get('scm-hex');
  if (hexInput) hexInput.value = hex;
  const hexText  = DOM.get('scm-hex-text');
  if (hexText)  hexText.value = hex;
  // Update active swatch
  document.querySelectorAll('.scm-swatch').forEach(function(s) {
    s.classList.toggle('scm-active', s.title.toLowerCase() === hex.toLowerCase());
  });
}
function _hexTextInput(id, nave) {
  const val = (DOM.get('scm-hex-text')?.value || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) _pickColor(id, nave, val);
}
function _confirmColor(id, nave) {
  const hex = _colorPickerTemp?.hex || getCellStyle(nave, id).color || '#16A35A';
  const g = getCellEl(id, nave);
  if (g) applyShelfColor(g, hex);
  setCellStyle(nave, id, { color: hex });
  logEdicion('Color', `Armario ${id} — color cambiado a ${hex}`, `${naveLbl(nave)}`);
  showToast({ type:'success', title:'Color guardado', msg: '"' + id + '" \u2192 ' + hex });
  _colorPickerTemp = null;
  _closeColorPicker();
}
function _closeColorPicker() {
  DOM.get('shelf-color-modal')?.remove();
  _colorPickerTemp = null;
}

// ── MOVE MODE — flechas sobre el SVG + teclado ───────────────────────────────

// ════════════════════════════════════════════════
// RESIZE DE ESTANTES
// Handle (cuadrado azul) en esquina inferior derecha.
// Se activa junto con el modo mover; se elimina al cancelar.
// ════════════════════════════════════════════════
const SHELF_MIN_W = 40;
const SHELF_MIN_H = 30;

function addResizeHandle(g, nave, cellId, svg) {
  // Limpiar handles anteriores
  g.querySelectorAll('.shelf-resize-handle').forEach(function(el){ el.remove(); });
  const NS = 'http://www.w3.org/2000/svg';

  // Función para crear un handle genérico
  function makeHandle(cls, cursor, fillColor) {
    const h = document.createElementNS(NS, 'rect');
    h.setAttribute('class', 'shelf-resize-handle ' + cls);
    h.setAttribute('rx', '3');
    h.setAttribute('fill', fillColor || 'var(--accent)');
    h.setAttribute('stroke', '#fff');
    h.setAttribute('stroke-width', '1.5');
    h.setAttribute('opacity', '0.85');
    h.style.cursor = cursor;
    h.style.touchAction = 'none';
    g.appendChild(h);
    return h;
  }

  // Esquina SE (redimensionar ancho + alto)
  const hSE = makeHandle('h-se', 'se-resize', 'var(--accent)');
  hSE.setAttribute('width', '12'); hSE.setAttribute('height', '12');

  // Bordes: E (derecha), W (izquierda), S (abajo), N (arriba)
  const hE = makeHandle('h-e', 'e-resize', 'var(--blue)');
  const hW = makeHandle('h-w', 'w-resize', 'var(--blue)');
  const hS = makeHandle('h-s', 's-resize', 'var(--blue)');
  const hN = makeHandle('h-n', 'n-resize', 'var(--blue)');
  [hE, hW, hS, hN].forEach(function(h) {
    h.setAttribute('rx', '3');
    h.setAttribute('opacity', '0.7');
  });

  function getRectData() {
    const svgR = g.querySelector('rect:not(.shelf-resize-handle)');
    if (!svgR) return null;
    return {
      x: parseFloat(svgR.getAttribute('x')),
      y: parseFloat(svgR.getAttribute('y')),
      w: parseFloat(svgR.getAttribute('width')),
      h: parseFloat(svgR.getAttribute('height')),
      el: svgR,
    };
  }

  function syncAllHandles() {
    const d = getRectData();
    if (!d) return;
    const {x, y, w, h} = d;
    const ht = 8, hw = 8; // height/width of edge handles
    // SE corner
    hSE.setAttribute('x', x + w - 6); hSE.setAttribute('y', y + h - 6);
    // E right edge (center)
    hE.setAttribute('x', x + w - 4); hE.setAttribute('y', y + h/2 - hw/2);
    hE.setAttribute('width', '8'); hE.setAttribute('height', String(hw));
    // W left edge
    hW.setAttribute('x', x - 4); hW.setAttribute('y', y + h/2 - hw/2);
    hW.setAttribute('width', '8'); hW.setAttribute('height', String(hw));
    // S bottom edge
    hS.setAttribute('x', x + w/2 - ht/2); hS.setAttribute('y', y + h - 4);
    hS.setAttribute('width', String(ht)); hS.setAttribute('height', '8');
    // N top edge
    hN.setAttribute('x', x + w/2 - ht/2); hN.setAttribute('y', y - 4);
    hN.setAttribute('width', String(ht)); hN.setAttribute('height', '8');
  }
  syncAllHandles();

  // Función genérica de drag para cualquier handle
  function makeDrag(handle, onMove) {
    let rs = null;
    handle.addEventListener('pointerdown', function(e) {
      e.preventDefault(); e.stopPropagation();
      const d = getRectData(); if (!d) return;
      rs = { pid: e.pointerId, startCX: e.clientX, startCY: e.clientY, ...d };
      try { handle.setPointerCapture(e.pointerId); } catch {}
    });
    handle.addEventListener('pointermove', function(e) {
      if (!rs || e.pointerId !== rs.pid) return;
      e.preventDefault();
      const sc = getSvgScale(svg);
      if (!isFinite(sc.sx) || !isFinite(sc.sy)) return;
      const dx = (e.clientX - rs.startCX) * sc.sx;
      const dy = (e.clientY - rs.startCY) * sc.sy;
      onMove(rs, dx, dy, false);
      syncAllHandles();
    });
    handle.addEventListener('pointerup', function(e) {
      if (!rs || e.pointerId !== rs.pid) return;
      try { handle.releasePointerCapture(e.pointerId); } catch {}
      const sc = getSvgScale(svg);
      if (isFinite(sc.sx) && isFinite(sc.sy)) {
        const dx = (e.clientX - rs.startCX) * sc.sx;
        const dy = (e.clientY - rs.startCY) * sc.sy;
        onMove(rs, dx, dy, true);
        syncAllHandles();
        const d2 = getRectData();
        if (d2 && g.dataset.dynamic === '1') recordShelfGeom(nave, cellId, { x:d2.x, y:d2.y, w:d2.w, h:d2.h });
        showToast({ type:'info', title:'Tamaño guardado', msg: cellId + ': ' + Math.round((d2?.w||0) * CM_PER_SVG) + '×' + Math.round((d2?.h||0) * CM_PER_SVG) + ' cm', duration: 2000 });
      }
      rs = null;
    });
    handle.addEventListener('pointercancel', function() { rs = null; });
  }

  function applyToRect(x, y, w, h) {
    const d = getRectData(); if (!d) return;
    const fw = Math.max(SHELF_MIN_W, w);
    const fh = Math.max(SHELF_MIN_H, h);
    d.el.setAttribute('x', x); d.el.setAttribute('y', y);
    d.el.setAttribute('width', fw); d.el.setAttribute('height', fh);
    const svgT = g.querySelector('text');
    if (svgT) { svgT.setAttribute('x', x + fw/2); svgT.setAttribute('y', y + fh/2); }
  }

  // SE — aumenta W y H
  makeDrag(hSE, function(rs, dx, dy, snap) {
    const nw = snap ? snapToGrid(rs.w + dx) : rs.w + dx;
    const nh = snap ? snapToGrid(rs.h + dy) : rs.h + dy;
    applyToRect(rs.x, rs.y, nw, nh);
  });
  // E — solo W
  makeDrag(hE, function(rs, dx, dy, snap) {
    const nw = snap ? snapToGrid(rs.w + dx) : rs.w + dx;
    applyToRect(rs.x, rs.y, nw, rs.h);
  });
  // W — mueve X y resta W
  makeDrag(hW, function(rs, dx, dy, snap) {
    const nx = snap ? snapToGrid(rs.x + dx) : rs.x + dx;
    const nw = rs.w - (nx - rs.x);
    applyToRect(nx, rs.y, nw, rs.h);
  });
  // S — solo H
  makeDrag(hS, function(rs, dx, dy, snap) {
    const nh = snap ? snapToGrid(rs.h + dy) : rs.h + dy;
    applyToRect(rs.x, rs.y, rs.w, nh);
  });
  // N — mueve Y y resta H
  makeDrag(hN, function(rs, dx, dy, snap) {
    const ny = snap ? snapToGrid(rs.y + dy) : rs.y + dy;
    const nh = rs.h - (ny - rs.y);
    applyToRect(rs.x, ny, rs.w, nh);
  });
}

function activateMoveMode(cellId, nave) {
  cancelAllModes();
  closePopup();

  const g = getCellEl(cellId, nave);
  if (!g) { showToast({type:'danger',title:'Error',msg:`No se encontró "${cellId}"`}); return; }
  const svg = getSvgForNave(nave);
  if (!svg) return;

  g.classList.add('moving');
  document.body.classList.add('shelf-move-mode');
  showModeBanner(nave, 'move', '✥ MOVER — flechas en el plano o teclas ↑↓←→ · Esc para terminar');
  drawSnapGrid(nave);
  addResizeHandle(g, nave, cellId, svg);

  const svgR = g.querySelector('rect:not(.shelf-resize-handle)');
  const svgT = g.querySelector('text');
  const NS   = 'http://www.w3.org/2000/svg';
  const SIZE = 20, GAP = 5;

  function pos() {
    const x=parseFloat(svgR.getAttribute('x')), y=parseFloat(svgR.getAttribute('y'));
    const w=parseFloat(svgR.getAttribute('width')), h=parseFloat(svgR.getAttribute('height'));
    return {x,y,w,h,cx:x+w/2,cy:y+h/2};
  }

  function move(dx,dy) {
    const {x,y,w,h} = pos();
    const nx=snapToGrid(x+dx*GRID), ny=snapToGrid(y+dy*GRID);
    svgR.setAttribute('x',nx); svgR.setAttribute('y',ny);
    svgT.setAttribute('x',nx+w/2); svgT.setAttribute('y',ny+h/2);
    placeArrows();
    if (g.dataset.dynamic === '1') recordShelfGeom(nave, cellId, { x:nx, y:ny, w, h });
  }

  // Arrow group
  const ag = document.createElementNS(NS,'g');
  ag.id = 'move-arrow-group';

  function makeArrow(dir, dx, dy, glyph) {
    const grp = document.createElementNS(NS,'g');
    grp.style.cursor = 'pointer';
    const bg = document.createElementNS(NS,'rect');
    bg.setAttribute('width',SIZE); bg.setAttribute('height',SIZE);
    bg.setAttribute('rx','5');
    bg.setAttribute('fill','rgba(75,148,232,0.25)');
    bg.setAttribute('stroke','rgba(75,148,232,0.8)');
    bg.setAttribute('stroke-width','1.5');
    const lbl = document.createElementNS(NS,'text');
    lbl.setAttribute('x',SIZE/2); lbl.setAttribute('y',SIZE/2+4);
    lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('font-size','12');
    lbl.setAttribute('fill','#fff');
    lbl.setAttribute('font-weight','700');
    lbl.setAttribute('pointer-events','none');
    lbl.textContent = glyph;
    grp.appendChild(bg); grp.appendChild(lbl);
    grp.addEventListener('click', e => { e.stopPropagation(); move(dx,dy); });
    grp.addEventListener('mouseenter', () => bg.setAttribute('fill','rgba(75,148,232,0.65)'));
    grp.addEventListener('mouseleave', () => bg.setAttribute('fill','rgba(75,148,232,0.25)'));
    ag.appendChild(grp);
    return grp;
  }

  const aU = makeArrow('up',   0,-1,'▲');
  const aD = makeArrow('down', 0, 1,'▼');
  const aL = makeArrow('left',-1, 0,'◀');
  const aR = makeArrow('right',1, 0,'▶');

  // Done button — green checkmark to finish
  const doneGrp = document.createElementNS(NS,'g');
  doneGrp.style.cursor = 'pointer';
  const doneBg = document.createElementNS(NS,'rect');
  doneBg.setAttribute('width',SIZE); doneBg.setAttribute('height',SIZE);
  doneBg.setAttribute('rx','5');
  doneBg.setAttribute('fill','rgba(61,191,126,0.25)');
  doneBg.setAttribute('stroke','rgba(61,191,126,0.8)');
  doneBg.setAttribute('stroke-width','1.5');
  const doneLbl = document.createElementNS(NS,'text');
  doneLbl.setAttribute('x',SIZE/2); doneLbl.setAttribute('y',SIZE/2+4);
  doneLbl.setAttribute('text-anchor','middle');
  doneLbl.setAttribute('font-size','13');
  doneLbl.setAttribute('fill','#3dbf7e');
  doneLbl.setAttribute('font-weight','700');
  doneLbl.setAttribute('pointer-events','none');
  doneLbl.textContent = '✓';
  doneGrp.appendChild(doneBg); doneGrp.appendChild(doneLbl);
  doneGrp.addEventListener('click', e => { e.stopPropagation(); cancelAllModes(); logEdicion('Reposicionado', `Armario ${cellId} reposicionado`, `${naveLbl(nave)}`); showToast({type:'success',title:'Listo',msg:`Armario "${cellId}" guardado`,duration:2000}); });
  doneGrp.addEventListener('mouseenter', () => doneBg.setAttribute('fill','rgba(61,191,126,0.55)'));
  doneGrp.addEventListener('mouseleave', () => doneBg.setAttribute('fill','rgba(61,191,126,0.25)'));
  ag.appendChild(doneGrp);

  svg.appendChild(ag);

  function placeArrows() {
    const {x,y,w,h,cx,cy} = pos();
    aU.setAttribute('transform',    `translate(${cx-SIZE/2},${y-SIZE-GAP})`);
    aD.setAttribute('transform',    `translate(${cx-SIZE/2},${y+h+GAP})`);
    aL.setAttribute('transform',    `translate(${x-SIZE-GAP},${cy-SIZE/2})`);
    aR.setAttribute('transform',    `translate(${x+w+GAP},${cy-SIZE/2})`);
    // Done button: top-right of cell
    doneGrp.setAttribute('transform',`translate(${x+w+GAP},${y-SIZE-GAP})`);
  }
  placeArrows();

  // Keyboard
  function onKey(e) {
    const map = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
    if (!map[e.key]) return;
    e.preventDefault();
    move(...map[e.key]);
  }
  window.addEventListener('keydown', onKey);

  // ── Arrastre directo con mouse / dedo (Pointer Events unifica ambos) ──────
  // Permite tomar el estante con el mouse o el dedo y arrastrarlo
  // libremente por el plano, además de las flechas/teclado de arriba.
  let dragState = null; // { pointerId, startClientX, startClientY, startX, startY }

  function onPointerDown(e) {
    // Ignorar si el toque empezó sobre una de las flechas/botón done
    if (e.target.closest('#move-arrow-group')) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = pos();
    dragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: x,
      startY: y,
    };
    g.classList.add('dragging');
    try { g.setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMoveRaw(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    e.preventDefault();
    const { sx, sy } = getSvgScale(svg);
    // Si el SVG todavía no tiene layout calculado (bb.width=0, ej. justo
    // tras un cambio de orientación en mobile), sx/sy darían Infinity/NaN —
    // en ese caso ignoramos este evento de movimiento puntual sin romper
    // el arrastre; el siguiente pointermove ya debería tener layout válido.
    if (!isFinite(sx) || !isFinite(sy)) return;
    const dxPx = e.clientX - dragState.startClientX;
    const dyPx = e.clientY - dragState.startClientY;
    // Sin snap mientras se arrastra — fluido; el snap se aplica al soltar
    const { w, h } = pos();
    const nx = dragState.startX + dxPx * sx;
    const ny = dragState.startY + dyPx * sy;
    svgR.setAttribute('x', nx);
    svgR.setAttribute('y', ny);
    svgT.setAttribute('x', nx + w/2);
    svgT.setAttribute('y', ny + h/2);
    placeArrows();
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    g.classList.remove('dragging');
    try { g.releasePointerCapture(e.pointerId); } catch {}
    // Snap final a la grilla (con guarda por si x/y quedaron en un estado inválido)
    const { x, y, w, h } = pos();
    if (isFinite(x) && isFinite(y)) {
      const nx = snapToGrid(x), ny = snapToGrid(y);
      svgR.setAttribute('x', nx); svgR.setAttribute('y', ny);
      svgT.setAttribute('x', nx + w/2); svgT.setAttribute('y', ny + h/2);
      placeArrows();
      if (g.dataset.dynamic === '1') recordShelfGeom(nave, cellId, { x: nx, y: ny, w, h });
    }
    dragState = null;
  }

  g.style.touchAction = 'none';
  g.style.cursor = 'grab';
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  g.addEventListener('pointerdown', onPointerDown);
  g.addEventListener('pointermove', onPointerMoveRaw);
  g.addEventListener('pointerup', onPointerUp);
  g.addEventListener('pointercancel', onPointerUp);

  _shelfMoveState = {
    cellId, nave,
    _cleanup() {
      ag.remove();
      window.removeEventListener('keydown', onKey);
      g.removeEventListener('pointerdown', onPointerDown);
      g.removeEventListener('pointermove', onPointerMoveRaw);
      g.removeEventListener('pointerup', onPointerUp);
      g.removeEventListener('pointercancel', onPointerUp);
      g.querySelectorAll('.shelf-resize-handle').forEach(function(el){ el.remove(); });
      g.style.touchAction = '';
      g.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      g.classList.remove('moving', 'dragging');
    }
  };
}

// ── DELETE: confirm → remove from data + DOM ─────────────────────────────────
function activateDeleteMode(cellId, nave) {
  // Just confirm immediately — no intermediate mode
  const itemCount = Object.values(CELLS[nave]?.[cellId]?.repisas || {})
    .reduce((s,r) => s + r.items.length, 0);
  const msg = itemCount > 0
    ? `¿Eliminar el armario "${cellId}"? Tiene ${itemCount} producto(s).`
    : `¿Eliminar el armario "${cellId}"?`;
  if (!confirm(msg)) return;

  // Close popup first (before removing the element)
  closePopup();

  // Remove from data
  delete CELLS[nave][cellId];
  saveCells();
  removeShelfGeom(nave, cellId);
  closeShelfWindow(nave + '|' + cellId);

  // Remove from SVG by dataset iteration (avoids CSS escape issues)
  document.querySelectorAll('.cell[data-nave="' + nave + '"]').forEach(el => {
    if (el.dataset.id === cellId) el.remove();
  });

  showToast({ type:'warn', title:'Estantería eliminada', msg:`Armario "${cellId}" removido del plano`, duration:4000 });
}

// ── Banner ────────────────────────────────────────────────────────────────────
function showModeBanner(nave, type, text) {
  document.querySelectorAll('.mode-banner-el').forEach(b => b.remove());
  const mapMain = document.querySelector('#sc-' + nave + ' .map-main');
  if (!mapMain) return;
  const b = document.createElement('div');
  b.className = 'mode-banner-el ' + type;
  b.textContent = text;
  mapMain.appendChild(b);
}

// ── Cancel all modes ──────────────────────────────────────────────────────────
function cancelAllModes() {
  document.body.classList.remove('shelf-move-mode','shelf-delete-mode');
  document.querySelectorAll('.mode-banner-el').forEach(b => b.remove());
  document.getElementById('move-arrow-group')?.remove();
  if (_shelfMoveState) {
    if (_shelfMoveState._cleanup) _shelfMoveState._cleanup();
    _shelfMoveState = null;
  }
  if (_shelfDeleteTarget) {
    if (_shelfDeleteTarget._cleanup) _shelfDeleteTarget._cleanup();
    _shelfDeleteTarget = null;
  }
  _shelfDeleteMode = false;
  clearSnapGrid();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _shelfMoveState) cancelAllModes();
});

// ── Snap Grid (drawn on a dynamic canvas inside map-main) ────────────────────
function drawSnapGrid(nave) {
  clearSnapGrid();
  const svg = getSvgForNave(nave);
  if (!svg) return;
  const mapMain = document.querySelector('#sc-' + nave + ' .map-main');
  if (!mapMain) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'snap-grid-canvas';
  Object.assign(canvas.style, {
    position:'absolute', inset:'0',
    width:'100%', height:'100%',
    pointerEvents:'none', zIndex:'4'
  });
  mapMain.appendChild(canvas);

  const mapBB = mapMain.getBoundingClientRect();
  const dpr   = window.devicePixelRatio || 1;
  canvas.width  = mapBB.width  * dpr;
  canvas.height = mapBB.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const { bb, vb } = getSvgScale(svg);
  const sx = bb.width  / vb.width;
  const sy = bb.height / vb.height;
  const ox = bb.left   - mapBB.left;
  const oy = bb.top    - mapBB.top;

  ctx.strokeStyle = 'rgba(100,160,220,0.14)';
  ctx.lineWidth   = 0.5;
  for (let x=0; x<=vb.width; x+=GRID) {
    const px = ox + x*sx;
    ctx.beginPath(); ctx.moveTo(px,oy); ctx.lineTo(px,oy+vb.height*sy); ctx.stroke();
  }
  for (let y=0; y<=vb.height; y+=GRID) {
    const py = oy + y*sy;
    ctx.beginPath(); ctx.moveTo(ox,py); ctx.lineTo(ox+vb.width*sx,py); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(100,160,220,0.25)';
  for (let x=0; x<=vb.width; x+=GRID) {
    for (let y=0; y<=vb.height; y+=GRID) {
      ctx.beginPath();
      ctx.arc(ox+x*sx, oy+y*sy, 1.2, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function clearSnapGrid() {
  document.querySelectorAll('.snap-grid-canvas').forEach(c => c.remove());
}
// ════════════════════════════════════════════════
// MODO EDICIÓN INLINE (items dentro del popup)
// ════════════════════════════════════════════════
let editMode = false;

// ── Override selectRep to support edit mode ────────────────────────────────────

// We patch selectRep to render editable rows when editMode is on
function _applyAllShelfNames() {
  const n = loadShelfNames();
  ['n1','n2'].forEach(function(nave) {
    if (!n[nave]) return;
    Object.keys(n[nave]).forEach(function(id) {
      applyShelfName(nave, id);
    });
  });
}

