// ═══════════════════════════════════════════════════════
// src/stock/productForms.js
// Formularios flotantes del popup de estante:
// toggleForm (nuevo/sumar/editar), positionFloatForm,
// saveNuevo, saveSumar, saveEdit, deleteItem,
// selectRep (popup inline), saveRepCat, inlineSaveAll,
// inlineDeleteItem, buildProdOpts.
// Depende de: CELLS, stockBus.js, auth.js, movimientos.js
// ═══════════════════════════════════════════════════════
'use strict';

let editMode = false;

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
      ff.innerHTML = `
        <div class="ff-head editar">✏ EDITAR ESTANTERÍA</div>
        <div class="ff-body" style="max-height:220px;overflow-y:auto">${editRows}</div>
        <div class="ff-err" id="fe-err">Error al guardar</div>
        <div class="ff-actions">
          <button class="ff-cancel" onclick="closeFloatForm()">Cancelar</button>
          <button class="ff-save-nuevo" onclick="saveEdit()">Guardar cambios</button>
        </div>`;
    }
    ff.style.display = 'block';
    setTimeout(positionFloatForm, 10);

  } else if (type === 'nuevo') {
    // ── FORM: NUEVO PRODUCTO ──
    const repOpts = Object.keys(cell.repisas)
      .map(r => `<option value="${r}"${r===rid?' selected':''}>${r}</option>`).join('');
    const hoy = localToday();
    ff.innerHTML = `
      <div class="ff-head nuevo">＋ NUEVO PRODUCTO</div>
      <div class="ff-body">
        <div class="ff-field">
          <label class="ff-label">Producto</label>
          <input class="ff-input" id="fn-nombre" type="text" placeholder="Ej: TORNILLOS 5CM" autocomplete="off"/>
        </div>
        <div class="ff-row">
          <div class="ff-field">
            <label class="ff-label">Cantidad</label>
            <input class="ff-input" id="fn-cant" type="number" placeholder="0" min="1"/>
          </div>
          <div class="ff-field">
            <label class="ff-label">Fecha</label>
            <input class="ff-input" id="fn-fecha" type="date" value="${hoy}"/>
          </div>
        </div>
        <div class="ff-field">
          <label class="ff-label">Ubicación</label>
          <select class="ff-select" id="fn-repisa">${repOpts}</select>
        </div>
        <div class="ff-row">
          <div class="ff-field">
            <label class="ff-label">Especificación</label>
            <input class="ff-input" id="fn-spec" type="text" placeholder="Ej: 5CM, 52Ø…"/>
          </div>
          <div class="ff-field">
            <label class="ff-label">Precio ($)</label>
            <input class="ff-input" id="fn-precio" type="number" step="0.01" min="0" placeholder="0.00"/>
          </div>
        </div>
        <div class="ff-field">
          <label class="ff-label">Stock mínimo (alerta automática)</label>
          <input class="ff-input" id="fn-min" type="number" placeholder="Ej: 5 — dejá vacío para no alertar" min="0"/>
        </div>
      </div>
      <div class="ff-err" id="fn-err">Completá nombre y cantidad</div>
      <div class="ff-actions">
        <button class="ff-cancel" onclick="closeFloatForm()">Cancelar</button>
        <button class="ff-save-nuevo" onclick="saveNuevo()">Guardar</button>
      </div>`;
    ff.style.display = 'block';
    setTimeout(positionFloatForm, 10);
    setTimeout(() => document.getElementById('fn-nombre')?.focus(), 60);

  } else {
    // ── FORM: SUMAR STOCK ──
    const repOpts = Object.keys(cell.repisas)
      .map(r => `<option value="${r}"${r===rid?' selected':''}>${r}</option>`).join('');
    const prodOpts = buildProdOpts(cell, rid);
    const hoy = localToday();
    ff.innerHTML = `
      <div class="ff-head sumar">↺ SUMAR STOCK</div>
      <div class="ff-body">
        <div class="ff-field">
          <label class="ff-label">Ubicación</label>
          <select class="ff-select" id="fs-repisa" onchange="updateProdSelect()">${repOpts}</select>
        </div>
        <div class="ff-field">
          <label class="ff-label">Producto</label>
          <select class="ff-select" id="fs-prod">${prodOpts}</select>
        </div>
        <div class="ff-row">
          <div class="ff-field">
            <label class="ff-label">Cantidad</label>
            <input class="ff-input" id="fs-cant" type="number" placeholder="0" min="1"/>
          </div>
          <div class="ff-field">
            <label class="ff-label">Fecha</label>
            <input class="ff-input" id="fs-fecha" type="date" value="${hoy}"/>
          </div>
        </div>
      </div>
      <div class="ff-err" id="fs-err">Completá todos los campos</div>
      <div class="ff-actions">
        <button class="ff-cancel" onclick="closeFloatForm()">Cancelar</button>
        <button class="ff-save-sumar" onclick="saveSumar()">Sumar</button>
      </div>`;
    ff.style.display = 'block';
    setTimeout(positionFloatForm, 10);
    setTimeout(() => document.getElementById('fs-usr')?.focus(), 60);
  }
}

function buildProdOpts(cell, rid) {
  const items = cell.repisas[rid]?.items || [];
  if (!items.length) return '<option value="">— Sin productos —</option>';
  return items.map((it, i) =>
    `<option value="${rid}|${i}">${it.n} (${it.q} ${it.u})</option>`
  ).join('');
}

function updateProdSelect() {
  const repisa = document.getElementById('fs-repisa')?.value;
  const cell   = CELLS[POP.nave][POP.cellId];
  const sel    = document.getElementById('fs-prod');
  if (sel && repisa) sel.innerHTML = buildProdOpts(cell, repisa);
}

function closeFloatForm() {
  if (!POP) return;
  POP.activeForm = null;
  POP.iBox?.querySelector('.is-edit')?.classList.remove('active');
  POP.iBox?.querySelector('.is-sumar')?.classList.remove('active');
  POP.iBox?.querySelector('.is-nuevo')?.classList.remove('active');
  if (POP.ff) { POP.ff.style.display = 'none'; POP.ff.classList.remove('on'); }
}

// ── SAVE: EDIT ───────────────────────────────────────────────────────────────
function saveEdit() {
  const rid  = POP.activeRid;
  const cell = CELLS[POP.nave][POP.cellId];
  const items = cell.repisas[rid].items;
  let changed = false;
  const cambios = [];
  items.forEach((it, i) => {
    const nombre = (document.getElementById('en-'+i)?.value||'').trim().toUpperCase();
    const cant   = parseInt(document.getElementById('eq-'+i)?.value) || 0;
    const unidad = document.getElementById('eu-'+i)?.value || it.u;
    const spec   = (document.getElementById('es-'+i)?.value||'').trim() || '—';
    if (nombre) {
      if (nombre !== it.n || cant !== it.q) {
        cambios.push(`${it.n}${nombre !== it.n ? ' → ' + nombre : ''} (${it.q}→${cant})`);
      }
      it.n = nombre; it.q = cant; it.u = unidad; it.s = spec; changed = true;
    }
    const stockMin = it.stockMin || STOCK_MIN_DEFAULT;
    if (nombre && cant <= stockMin && cant > 0) {
      checkStockLow(it.n, cant, POP.cellId, rid, POP.nave === 'n1' ? 'N-1' : 'N-2');
    }
  });
  if (!changed) return;
  saveCells();
  if (cambios.length) {
    logEdicion('Editado', `Repisa ${rid} (${POP.cellId}) — ${cambios.join('; ')}`, `${naveLbl(POP.nave)}`);
  }
  closeFloatForm();
  selectRep(rid, POP.nave, POP.cellId, POP.el);
}

function deleteItem(idx) {
  if (!canAccess('eliminarProductos')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para eliminar productos.'}); return; }
  const rid   = POP.activeRid;
  const cell  = CELLS[POP.nave][POP.cellId];
  const items = cell.repisas[rid].items;
  const item  = items[idx];
  if (!item) return;
  if (!confirm(`¿Eliminar "${item.n}" de ${rid}?`)) return;
  items.splice(idx, 1);
  saveCells();
  StockBus.emit('egreso', { item, cantidad: item.q, cid: POP.cellId, rid, nave: POP.nave, precio: item.precio || null });
  closeFloatForm();
  selectRep(rid, POP.nave, POP.cellId, POP.el);
}

// ── SAVE: NUEVO ──────────────────────────────────────────────────────────────
function saveNuevo() {
  const nombre = (document.getElementById('fn-nombre')?.value || '').trim().toUpperCase();
  const cant   = parseInt(document.getElementById('fn-cant')?.value) || 0;
  const repisa = document.getElementById('fn-repisa')?.value;
  const spec   = (document.getElementById('fn-spec')?.value || '').trim() || '—';
  const precio = Math.max(0, parseFloat(document.getElementById('fn-precio')?.value) || 0);
  const fecha  = document.getElementById('fn-fecha')?.value || localToday();
  const errEl  = document.getElementById('fn-err');

  if (!nombre || cant < 1) {
    if (errEl) errEl.style.display = 'block';
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const cell = CELLS[POP.nave][POP.cellId];
  const stockMin = Math.max(0, parseInt(document.getElementById('fn-min')?.value) || 0);
  const newItem = { n: nombre, q: cant, u: 'UN', s: spec };   // unidad fija (campo removido del form)
  if (precio > 0)   newItem.precio = precio;
  if (stockMin > 0) newItem.stockMin = stockMin;
  cell.repisas[repisa].items.push(newItem);
  saveCells();

  StockBus.emit('ingreso', { item: newItem, cantidad: cant, cid: POP.cellId, rid: repisa, nave: POP.nave, precio: null });

  // Si ya entra por debajo del mínimo, generar petición automática
  if (stockMin > 0 && cant <= stockMin) {
    checkStockLow(nombre, cant, POP.cellId, repisa, POP.nave === 'n1' ? 'N-1' : 'N-2');
  }

  closeFloatForm();
  selectRep(repisa, POP.nave, POP.cellId, POP.el);

  // Generate QR
  const naveLabel = POP.nave === 'n1' ? 'N-1' : 'N-2';
  openQR({ nombre, cant, unidad:'UN', spec, repisa, armario: POP.cellId, nave: naveLabel, fecha, precio });
}

// ════════════════════════════════════════════════
// QR MODAL + FICHA DE PRODUCTO
      checkStockLow(it.n, cant, cid, rid, naveLabel);
    }
  });
  saveCells();
  if (cambios.length) {
    logEdicion('Editado', `Repisa ${rid} (${cid}) — ${cambios.join('; ')}`, `${naveLbl(nave)}`);
  }
  selectRep(rid, nave, cid, POP.el);
}

function inlineDeleteItem(idx, rid, nave, cid) {
  const items = CELLS[nave][cid].repisas[rid].items;
  const item  = items[idx];
  if (!item) return;
  if (!confirm(`¿Eliminar "${item.n}" de ${rid}?`)) return;
  items.splice(idx, 1);
  saveCells();
  selectRep(rid, nave, cid, POP.el);
}
// ════════════════════════════════════════════════
// WELCOME / SPLASH
// ════════════════════════════════════════════════
let welcomeGone = false;
function dismissWelcome() {
  if (welcomeGone) return;
  welcomeGone = true;
  const w = document.getElementById('sc-welcome');
  if (!w) return;
  w.classList.add('lift');
  setTimeout(() => {
    w.style.display = 'none';
    const u = DOM.get('li-usr');
function selectRep(rid, nave, cid, popup) {
  // Update active rep
  popup.querySelectorAll('.rep-row').forEach(r => r.classList.remove('on'));
  const rrow = popup.querySelector('#rr-' + rid);
  if (rrow) rrow.classList.add('on');

  POP.activeRid  = rid;
  POP.activeForm = null;
  closeFloatForm();

  const cellData = CELLS[nave][cid];
  const rep = cellData.repisas[rid];
  const total = rep.items.reduce((s, i) => s + i.q, 0);

  POP.iBox.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'p-items-head';

  if (editMode) {
    // Editable category label
    head.innerHTML = `
      <span style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.45);text-transform:uppercase">${rid}</span>
      <div class="icon-btns" style="flex:1;margin-left:8px">
        <input class="rep-cat-input" id="rep-cat-inp" type="text" value="${rep.cat === '—' ? '' : esc(rep.cat)}" placeholder="Categoría…" autocomplete="off"/>
        <button class="rep-cat-save" title="Guardar categoría" onclick="saveRepCat('${rid}','${nave}','${cid}')">✓</button>
      </div>`;
  } else {
    head.innerHTML = `
      <span>${esc(rid)} · ${esc(rep.cat)}</span>
      <div class="icon-btns">
        <button class="icon-btn is-edit" title="Editar ítems" onclick="toggleForm('editar')">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>`;
  }
  POP.iBox.appendChild(head);

  const body = document.createElement('div');

  if (editMode) {
    if (rep.items.length === 0) {
      body.innerHTML = '<div class="items-empty">— MODO EDICIÓN · Sin elementos —</div>';
    } else {
      rep.items.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'item-row editable';
        row.id = 'erow-' + i;
        row.innerHTML = `
          <input class="ir-name-input" id="eim-n-${i}" type="text" value="${esc(it.n)}" autocomplete="off"/>
          <input class="ir-qty-input" id="eim-q-${i}" type="number" value="${esc(it.q)}" min="0"/>
          <span class="ir-spec" style="font-size:10px">${esc(it.s)}</span>
          <button class="ir-del-btn" title="Eliminar" onclick="inlineDeleteItem(${i},'${cssAttr(rid)}','${cssAttr(nave)}','${cssAttr(cid)}')">✕</button>`;
        body.appendChild(row);
      });
    }
    POP.iBox.appendChild(body);

    if (rep.items.length > 0) {
      const saveBar = document.createElement('div');
      saveBar.className = 'edit-save-bar';
      saveBar.innerHTML = `<button class="edit-save-all" onclick="inlineSaveAll('${rid}','${nave}','${cid}')">✓ Guardar cambios</button>`;
      POP.iBox.appendChild(saveBar);
    }
  } else {
    // Normal mode
    if (rep.items.length === 0) {
      body.innerHTML = '<div class="items-empty">— SIN ELEMENTOS —</div>';
    } else {
      body.innerHTML = rep.items.map((it, i) =>
        `<div class="item-row clickable" role="button" tabindex="0" onclick="openProductDetail('${cssAttr(nave)}','${cssAttr(cid)}','${cssAttr(rid)}',${i})" title="Ver detalle" aria-label="Ver detalle de ${escAttr(it.n)}">
          <span class="ir-name">${esc(it.n)}</span>
          <span class="ir-qty">${esc(it.q)} ${esc(it.u||'')}</span>
          <span class="ir-spec">${esc(it.s)}</span>
        </div>`
      ).join('');
    }
    POP.iBox.appendChild(body);
  }

  const foot = document.createElement('div');
  foot.className = 'items-foot';
  foot.innerHTML = `<span>${editMode ? '✏ EDITANDO' : 'TOTAL'}</span><span>${total} UN</span>`;
  POP.iBox.appendChild(foot);

  // Show items panel
  POP.c2.classList.add('on');
  setTimeout(() => {
    POP.iWrap.classList.add('on');
    setTimeout(() => flipIfNeeded(POP.el, POP.el.getBoundingClientRect()), 280);
  }, 60);
}

function saveRepCat(rid, nave, cid) {
  if (!canAccess('editarCategorias')) {
    showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para editar categorías de repisas.'}); return;
  }
  const val = (document.getElementById('rep-cat-inp')?.value || '').trim().toUpperCase() || '—';
  const anterior = CELLS[nave]?.[cid]?.repisas?.[rid]?.cat || '—';
  CELLS[nave][cid].repisas[rid].cat = val;
  saveCells();
  if (val !== anterior) {
    logEdicion('Categoría', `Repisa ${rid} (${cid}) — categoría: "${anterior}" → "${val}"`, `${naveLbl(nave)}`);
  }
  selectRep(rid, nave, cid, POP.el);
}

function inlineSaveAll(rid, nave, cid) {
  const items = CELLS[nave][cid].repisas[rid].items;
  const cambios = [];
  items.forEach((it, i) => {
    const nombre = (document.getElementById('eim-n-' + i)?.value || '').trim().toUpperCase();
    const cant   = parseInt(document.getElementById('eim-q-' + i)?.value) || 0;
    if (nombre) {
      if (nombre !== it.n || cant !== it.q) {
        cambios.push(`${it.n}${nombre !== it.n ? ' → ' + nombre : ''} (${it.q}→${cant})`);
      }
      it.n = nombre; it.q = cant;
    }
    // Check stock low after edit
    const stockMin = it.stockMin || STOCK_MIN_DEFAULT;
    if (nombre && cant <= stockMin && cant > 0) {
      const naveLabel = nave === 'n1' ? 'N-1' : 'N-2';
