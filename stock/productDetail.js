// ═══════════════════════════════════════════════════════
// src/stock/productDetail.js
// Ficha de producto (modal pdModal):
//   openProductDetail, pdAccion, pdGuardarPrecio
// Helpers de nuevos productos (np*):
//   npResetMeta, npAddMetaRow, npCollectMeta,
//   npFillRepisas, npKnownCats, npFillCatList, npSyncCatFromRepisa
// Helpers de sumar stock (ss*):
//   ssFillRepisas, ssFillProds, saveSumarGlobal
// Depende de: CELLS, stockBus.js, qr/qr.js, auth.js
// ═══════════════════════════════════════════════════════
'use strict';

let _pdRef        = null;
let _pdQrInstance = null;

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
function openProductDetail(nave, cid, rid, idx){
  const item = CELLS[nave]?.[cid]?.repisas?.[rid]?.items?.[idx];
  if (!item) return;
  if (!item.id) { ensureItemId(item); saveCells(); }   // asignar SKU a productos viejos
  _pdRef = { nave, cid, rid, idx, item };
  const naveLabel = nave==='n1'?'N-1':'N-2';

  document.getElementById('pd-name').textContent = item.n;
  document.getElementById('pd-sku').textContent  = item.id;

  // Metadata: atributos fijos + custom
  const rows = [];
  if (item.s && item.s !== '—') rows.push(['Especificación', item.s]);
  if (item.stockMin != null)    rows.push(['Stock mínimo', String(item.stockMin)]);
  rows.push(['Ubicación', naveLabel + ' · ' + cid + ' · ' + rid]);
  if (item.meta) Object.entries(item.meta).forEach(([k,v]) => rows.push([k, v || '—']));
  const metaHtml = rows.map(([k,v]) =>
    '<div class="pd-meta-row"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>').join('');


  // ── Panel de edición con StockBus ────────────────────────────────────────
  const precioVal = item.precio != null ? esc(item.precio) : '';
  const stockValor = item.precio != null
    ? (item.q * item.precio).toLocaleString('es-AR', {minimumFractionDigits:2})
    : null;

  const editHtml =
    // Stock actual + valor
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px;background:var(--surface2);border-radius:12px">'
    +   '<div style="flex:1">'
    +     '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Stock actual</div>'
    +     '<div id="pd-stock-display" style="font-size:22px;font-weight:800;color:var(--ink);font-family:var(--font-display);line-height:1">' + esc(item.q) + ' <span style="font-size:13px;font-weight:500;color:var(--muted)">' + esc(item.u||'UN') + '</span></div>'
    +   '</div>'
    +   (stockValor ? '<div style="text-align:right"><div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Valor</div><div id="pd-valor-display" style="font-size:16px;font-weight:700;color:var(--accent)">$ ' + stockValor + '</div></div>' : '')
    + '</div>'
    // SACAR
    + '<div style="border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:12px;margin-bottom:10px">'
    +   '<div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--red);margin-bottom:8px">⬇ Sacar / Descontar stock</div>'
    +   '<div style="display:flex;gap:8px;align-items:center">'
    +     '<input id="pd-sacar-inp" type="number" min="1" placeholder="Cantidad a sacar" style="flex:1;font-family:inherit;font-size:15px;font-weight:700;padding:8px 10px;border:1px solid var(--border2);border-radius:9px;background:var(--surface);color:var(--text);outline:none;text-align:center"/>'
    +     '<button class="pd-action-btn pd-btn-sacar" onclick="pdAccion(&apos;egreso&apos;)">Sacar</button>'
    +   '</div>'
    + '</div>'
    // AGREGAR
    + '<div style="border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:12px;margin-bottom:10px">'
    +   '<div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--green);margin-bottom:8px">⬆ Agregar / Sumar stock</div>'
    +   '<div style="display:flex;gap:8px;align-items:center">'
    +     '<input id="pd-agregar-inp" type="number" min="1" placeholder="Cantidad a agregar" style="flex:1;font-family:inherit;font-size:15px;font-weight:700;padding:8px 10px;border:1px solid var(--border2);border-radius:9px;background:var(--surface);color:var(--text);outline:none;text-align:center"/>'
    +     '<button class="pd-action-btn pd-btn-agregar" onclick="pdAccion(&apos;ingreso&apos;)">Agregar</button>'
    +   '</div>'
    + '</div>'
    // PRECIO
    + '<div style="border:1px solid var(--border2);border-radius:12px;padding:12px;margin-bottom:6px">'
    +   '<div style="font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">$ Precio unitario</div>'
    +   '<div style="display:flex;gap:8px;align-items:center">'
    +     '<input id="pd-precio-inp" type="number" min="0" step="0.01" value="' + precioVal + '" placeholder="Sin precio" style="flex:1;font-family:inherit;font-size:14px;font-weight:600;padding:8px 10px;border:1px solid var(--border2);border-radius:9px;background:var(--surface);color:var(--text);outline:none"/>'
    +     '<button class="pd-action-btn" onclick="pdGuardarPrecio()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border2)">Guardar</button>'
    +   '</div>'
    + '</div>'
    + '<div id="pd-edit-msg" style="font-size:11.5px;min-height:16px;margin-top:4px;font-weight:600"></div>';
  document.getElementById('pd-meta').innerHTML = editHtml + (metaHtml ? '<div style="margin-top:12px">' + metaHtml + '</div>' : '');

  // QR dinámico basado en el ID/SKU (ruta /productos/:id como deep-link)
  const base = window.location.href.split('#')[0];
  const route = base + '#producto=' + encodeURIComponent(item.id);
  const inner = document.getElementById('pd-qr-inner');
  inner.innerHTML = '';
  if (_pdQrInstance){ try{_pdQrInstance.clear();}catch(e){} _pdQrInstance=null; }
  document.getElementById('pdModal').classList.add('on');
  requestAnimationFrame(()=> setTimeout(()=>{
    try { _pdQrInstance = new QRCode(inner, { text: route, width:150, height:150, colorDark:'#000', colorLight:'#fff', correctLevel: QRCode.CorrectLevel.M }); }
    catch(e){ inner.innerHTML = `<div style="color:#e84b4b;font-size:11px;padding:8px">QR: ${e.message}</div>`; }
  }, 70));

  // El botón "Ver etiqueta / QR" abre el modal QR completo con etiqueta imprimible
  document.getElementById('pd-qr-btn').onclick = () => {
    closePdModal();
    openQR({ nombre:item.n, cant:item.q, unidad:item.u||'UN', spec:item.s||'—', repisa:rid, armario:cid, nave:naveLabel, fecha:localToday(), precio:item.precio });
  };
}
function closePdModal(){ document.getElementById('pdModal').classList.remove('on'); }

/** pdAccion(tipo): 'ingreso' | 'egreso' — usa StockBus para sincronización automática */
function pdAccion(tipo) {
  if (!_pdRef) return;
  if (!canAccess('modificarStock')) {
    showToast({type:'danger', title:'Sin permiso', msg:'No tenés permiso para modificar stock.'}); return;
  }
  const { nave, cid, rid, idx } = _pdRef;
  const item = CELLS[nave]?.[cid]?.repisas?.[rid]?.items?.[idx];
  if (!item) { showToast({type:'danger', title:'Error', msg:'Producto no encontrado.'}); return; }

  const inpId   = tipo === 'egreso' ? 'pd-sacar-inp' : 'pd-agregar-inp';
  const cant    = parseInt(document.getElementById(inpId)?.value) || 0;
  const msgEl   = document.getElementById('pd-edit-msg');

  if (cant < 1) {
    _pdMsg(msgEl, 'err', 'Ingresá una cantidad válida (mínimo 1).');
    return;
  }
  if (tipo === 'egreso' && cant > item.q) {
    _pdMsg(msgEl, 'err', 'Stock insuficiente — disponible: ' + item.q + ' ' + (item.u||'UN'));
    return;
  }

  // Mutar estado
  item.q = tipo === 'egreso' ? item.q - cant : item.q + cant;
  saveCells();

  // Disparar evento en StockBus → sincroniza Movimientos + Balances automáticamente
  StockBus.emit(tipo, { item, cantidad: cant, cid, rid, nave, precio: item.precio || null });

  // Limpiar input y actualizar displays en la ficha
  document.getElementById(inpId).value = '';
  _pdRefreshDisplay(item, nave);

  const signo   = tipo === 'egreso' ? '−' : '+';
  const colorKey = tipo === 'egreso' ? 'err' : 'ok';
  const precioStr = item.precio != null
    ? ' · $ ' + (cant * item.precio).toLocaleString('es-AR', {minimumFractionDigits:2})
    : '';
  _pdMsg(msgEl, colorKey,
    (tipo === 'egreso' ? '✓ Sacado' : '✓ Agregado') +
    ': ' + signo + cant + ' ' + (item.u||'UN') + precioStr +
    ' → registrado en Movimientos');
}

/** pdGuardarPrecio(): actualiza el precio sin tocar el stock ni crear movimiento */
function pdGuardarPrecio() {
  if (!_pdRef) return;
  if (!canAccess('modificarStock')) {
    showToast({type:'danger', title:'Sin permiso', msg:'No tenés permiso para modificar stock.'}); return;
  }
  const { nave, cid, rid, idx } = _pdRef;
  const item = CELLS[nave]?.[cid]?.repisas?.[rid]?.items?.[idx];
  if (!item) return;
  const val = document.getElementById('pd-precio-inp')?.value.trim();
  const msgEl = document.getElementById('pd-edit-msg');
  const precioAnterior = item.precio != null ? item.precio : null;
  if (val === '') {
    delete item.precio;
  } else {
    const p = parseFloat(val);
    if (isNaN(p) || p < 0) { _pdMsg(msgEl, 'err', 'Precio inválido.'); return; }
    item.precio = p;
  }
  StockBus.emit('precio', { item, cantidad: 0, cid, rid, nave });
  _pdRefreshDisplay(item, nave);
  _pdMsg(msgEl, 'ok', '✓ Precio actualizado. El balance se recalculó automáticamente.');
  // Registrar edición de precio
  const naveLabel = nave === 'n1' ? 'N-1' : 'N-2';
  const precioNuevo = item.precio != null ? `$ ${item.precio.toLocaleString('es-AR',{minimumFractionDigits:2})}` : 'sin precio';
  const precioViejo = precioAnterior != null ? `$ ${precioAnterior.toLocaleString('es-AR',{minimumFractionDigits:2})}` : 'sin precio';
  logEdicion('Precio', `${item.n} — precio: ${precioViejo} → ${precioNuevo}`, `${naveLabel} · ${cid}-${rid}`);
}

/** Actualiza los displays de stock y valor dentro de la ficha abierta */
function _pdRefreshDisplay(item, nave) {
  const sd = document.getElementById('pd-stock-display');
  if (sd) sd.innerHTML = esc(item.q) + ' <span style="font-size:13px;font-weight:500;color:var(--muted)">' + esc(item.u||'UN') + '</span>';
  const vd = document.getElementById('pd-valor-display');
  if (vd && item.precio != null) vd.textContent = '$ ' + (item.q * item.precio).toLocaleString('es-AR', {minimumFractionDigits:2});
}

/** Helper de mensaje de feedback inline */
function _pdMsg(el, type, text) {
  if (!el) return;
  el.style.color = type === 'ok' ? 'var(--green)' : (type === 'err' ? 'var(--red)' : 'var(--muted)');
  el.textContent = text;
  setTimeout(function() { if (el) el.textContent = ''; }, 3000);
}

/** Legacy — mantenida por compatibilidad con llamadas anteriores */
function pdSaveEdits() { pdAccion('ingreso'); }
function pdAdjustQty() {}

// ── MENÚ "+" (FAB) por nave ───────────────────────────────────────────────────
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
function npKnownCats(){
  const set = new Set(['TORNILLERÍA','RODAMIENTOS','HERRAMIENTAS','ADHESIVOS','ELÉCTRICOS','NEUMÁTICA','HIDRÁULICA','LUBRICANTES','SEGURIDAD','ELECTRÓNICA','CONSUMIBLES','REPUESTOS','MATERIA PRIMA','OTROS']);
  ['n1','n2'].forEach(function(nave){
    Object.values(CELLS[nave] || {}).forEach(function(arm){
      Object.values((arm && arm.repisas) || {}).forEach(function(r){
        if (r && r.cat && r.cat !== '—') set.add(String(r.cat).toUpperCase());
      });
    });
  });
  return Array.from(set).sort(function(a,b){ return a.localeCompare(b,'es'); });
}
function npFillCatList(){
  const dl = document.getElementById('np-cat-list');
  if (!dl) return;
  dl.innerHTML = npKnownCats().map(function(c){ return '<option value="'+esc(c)+'"></option>'; }).join('');
}
function npSyncCatFromRepisa(){
  const el = document.getElementById('np-cat');
  if (!el) return;
  const arm = DOM.get('np-arm') && DOM.get('np-arm').value;
  const rep = DOM.get('np-rep') && DOM.get('np-rep').value;
  const cat = CELLS[_fabNave] && CELLS[_fabNave][arm] && CELLS[_fabNave][arm].repisas
            && CELLS[_fabNave][arm].repisas[rep] && CELLS[_fabNave][arm].repisas[rep].cat;
  el.value = (cat && cat !== '—') ? cat : '';
}

window.addEventListener('DOMContentLoaded', injectStockNav);

// ── Arranque de la aplicación ───────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', bootstrap);

// ════════════════════════════════════════════════════════════════════════════
// MAPA INTERACTIVO — Zoom (pinch / botones / rueda) + Pan táctil
// ----------------------------------------------------------------------------
// Capa 100% de PRESENTACIÓN: aplica un `transform` CSS al <svg> del plano.
// No modifica la lógica de negocio. Clave de compatibilidad: la conversión
// pantalla→SVG existente (getSvgScale → svg.getBoundingClientRect) es
// "transform-aware", por lo que el arrastre de estantes, los clicks en celdas
// y la apertura de popups siguen perfectamente alineados a CUALQUIER zoom,
// sin tocar una sola línea de ese código.
// ════════════════════════════════════════════════════════════════════════════
(function setupMapZoomPan(){
