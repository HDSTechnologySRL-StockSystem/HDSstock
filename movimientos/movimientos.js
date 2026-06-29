// ═══════════════════════════════════════════════════════
// src/movimientos/movimientos.js
// Módulo de movimientos de stock:
//   - logMov / logMovConPrecio / logEdicion  (escritura)
//   - renderMov / setMovTipo / clearMovFecha (lectura)
//   - openDeleteMovsModal / confirmDeleteMovs (limpieza)
// Depende de: storage.js, utils.js, auth.js,
//             shared/toast.js, constants.js
// ═══════════════════════════════════════════════════════
'use strict';

let movs = [];
let mIdSeq = 100;

function logMov(tipo, producto, cantidad, armario, nave, responsable, fecha, sede) {
  logMovConPrecio(tipo, producto, cantidad, armario, nave, responsable, fecha, sede, null);
}

/** Versión extendida de logMov que guarda también el precio unitario y el total */

// ════════════════════════════════════════════════
// StockBus — bus de eventos centralizado
// ════════════════════════════════════════════════
// Punto único de mutación de stock. Cualquier cambio en inventario
// (desde la ficha, drag-drop, sumar, nuevo producto, borrar chip)
// pasa por aquí y actualiza Movimientos + Balances + vistas de forma
// automática e inmediata. Evita duplicación de lógica de sincronización.
//
// Uso:
//   StockBus.emit('egreso',  { item, cantidad, cid, rid, nave, precio })
//   StockBus.emit('ingreso', { item, cantidad, cid, rid, nave, precio })
//   StockBus.emit('precio',  { item })   ← solo cambio de precio (sin movimiento)
//
const StockBus = (function() {
  const _handlers = [];

  function emit(tipo, payload) {
    const { item, cantidad, cid, rid, nave, precio } = payload;
    const naveLabel  = nave === 'n1' ? 'N-1' : 'N-2';
    const precioUnit = precio != null ? +precio
                      : (item && item.precio != null ? +item.precio : null);

    // ── 1. Persistencia ───────────────────────────────────────────────────────
    if (tipo !== 'precio') {
      // logMovConPrecio ya hace unshift + saveMovs
      logMovConPrecio(
        tipo,
        item.n,
        cantidad,
        cid + '-' + rid,
        naveLabel,
        currentSignature(),
        localToday(),
        currentSede,
        precioUnit
      );
    } else {
      // Cambio de precio: solo persistir CELLS (ya mutado por el llamador)
      saveCells();
    }

    // ── 2. Render reactivo inmediato ─────────────────────────────────────────
    // Movimientos: solo re-render si la pantalla está visible
    if (document.getElementById('sc-mov')?.classList.contains('on')) {
      renderMov();
    }
    // Balances: idem
    if (document.getElementById('sc-bal')?.classList.contains('on')) {
      renderBal();
    }
    // Stock General: idem — se actualiza al borrar/agregar/mover productos
    if (document.getElementById('sc-stock')?.classList.contains('on')) {
      renderStock();
    }
    // Ventana flotante del estante (si está abierta para ese armario)
    if (cid && nave) refreshShelfWindow(nave, cid);

    // ── 3. Notificar handlers externos (extensible) ───────────────────────────
    _handlers.forEach(function(h) { try { h(tipo, payload); } catch(e) {} });
  }

  return {
    emit:   emit,
    on:     function(fn) { _handlers.push(fn); },  // hook para extensiones futuras
  };
})();

function logMovConPrecio(tipo, producto, cantidad, armario, nave, responsable, fecha, sede, precioUnitario) {
  const hora = new Date().toTimeString().slice(0,5);
  const mov  = { id: mIdSeq++, tipo, producto, cantidad, armario, nave,
    responsable: responsable || 'Usuario', sede: sede || currentSede || '—',
    hora, fecha: fecha || localToday() };
  if (precioUnitario != null && !isNaN(+precioUnitario) && +precioUnitario > 0) {
    mov.precioUnit = +precioUnitario;
    mov.total      = +(cantidad * precioUnitario).toFixed(2);
  }
  movs.unshift(mov);
  saveMovs();
}

/**
 * logEdicion(subtipo, descripcion, detalle)
 * Registra un movimiento de tipo 'edicion' (naranja) en el historial.
 * subtipo: etiqueta corta que aparece en la col DETALLE  (ej: 'Renombrado', 'Movido', 'Precio', 'Reposicionado', 'Rotado', 'Color')
 * descripcion: texto que aparece en col DESCRIPCIÓN
 * detalle: (opcional) info extra guardada en el registro pero no mostrada en tabla
 */
function logEdicion(subtipo, descripcion, detalle) {
  const hora = new Date().toTimeString().slice(0,5);
  const mov  = {
    id: mIdSeq++,
    tipo: 'edicion',
    subtipo: subtipo || 'Edición',
    producto: descripcion || subtipo || 'Edición',
    cantidad: 0,
    unidad: '',
    armario: detalle || '',
    nave: '',
    responsable: currentSignature(),
    sede: currentSede || '—',
    hora,
    fecha: localToday(),
  };
  movs.unshift(mov);
  saveMovs();
  // Render reactivo si la pantalla está activa
  if (document.getElementById('sc-mov')?.classList.contains('on')) renderMov();
}

let mSortCol = 'fecha', mSortDir = 'desc';
let mMovTipo = 'todas'; // 'todas' | 'ingreso' | 'egreso' | 'edicion'

function setMovTipo(tipo) {
  mMovTipo = tipo;
  ['todas','ingreso','egreso','edicion'].forEach(t => {
    const el = document.getElementById('pill-mov-' + t);
    if (el) el.classList.toggle('on', t === tipo);
  });
  renderMov();
}

function renderMov() {
  const fechaFilt = (document.getElementById('mov-fecha-inp')?.value || '').trim();

  // Badge de fecha activa
  const badge = document.getElementById('mov-fecha-badge');
  const clearBtn = document.getElementById('mov-fecha-clear');
  if (badge) {
    if (fechaFilt) {
      const [y,m,d] = fechaFilt.split('-');
      badge.textContent = `📅 ${d}/${m}/${y}`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
  if (clearBtn) clearBtn.style.display = fechaFilt ? '' : 'none';

  let rows = [...movs];
  if (fechaFilt) rows = rows.filter(m => m.fecha === fechaFilt);
  if (mMovTipo !== 'todas') rows = rows.filter(m => m.tipo === mMovTipo);

  // Ordenar: primero por fecha desc, luego por hora desc
  rows.sort((a, b) => {
    const fa = (a.fecha || '') + (a.hora || '');
    const fb = (b.fecha || '') + (b.hora || '');
    if (fa < fb) return 1;
    if (fa > fb) return -1;
    return 0;
  });

  DOM.get('mVis').textContent = rows.length;
  DOM.get('mTot').textContent = movs.length;
  const body  = DOM.get('mBody');
  const empty = DOM.get('mEmpty');
  body.querySelectorAll('.trow').forEach(r => r.remove());
  if (!rows.length) { empty.style.display='flex'; return; }
  empty.style.display = 'none';
  rows.forEach(m => {
    const ing  = m.tipo === 'ingreso';
    const edit = m.tipo === 'edicion';
    const tr   = document.createElement('div');
    tr.className = 'trow' + (edit ? ' trow-edicion' : '');
    const totalStr = m.total != null
      ? (ing ? '+ ' : (edit ? '' : '− ')) + '$ ' + Number(m.total).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})
      : '—';
    const fechaStr = m.fecha ? m.fecha.split('-').reverse().join('/') : '—';

    // Columna detalle: para ediciones muestra el subtipo, para stock muestra cantidad
    let detalleCel;
    if (edit) {
      const subtipo = m.subtipo || 'edición';
      detalleCel = `<div class="td qty-edit">✏ ${esc(subtipo)}</div>`;
    } else {
      detalleCel = `<div class="td ${ing?'qty-ing':'qty-egr'}">${ing?'+':'-'}${esc(m.cantidad)} ${esc(m.unidad||'UN')}</div>`;
    }

    // Badge de tipo en la última columna
    let tipoBadge;
    if (ing)       tipoBadge = `<span class="badge ing">Ingreso</span>`;
    else if (edit) tipoBadge = `<span class="badge edit">Edición</span>`;
    else           tipoBadge = `<span class="badge egr">Egreso</span>`;

    // Color de total
    const totalColor = edit ? 'var(--amber)' : (ing ? 'var(--green)' : 'var(--red)');

    tr.innerHTML = `
      <div class="td">${esc(m.producto)}</div>
      ${detalleCel}
      <div class="td" style="font-weight:600;color:${totalColor}">${esc(totalStr)}</div>
      <div class="td">${esc(m.responsable)}${m.sede && m.sede!=='—' ? `<span class="td-sub">${esc(m.sede)}</span>` : ''}</div>
      <div class="td" style="color:var(--muted);font-size:11px">${fechaStr}</div>
      <div class="td">${esc(m.hora)}</div>
      <div class="td">${tipoBadge}${m.nave && !edit ? `<span style="font-size:10px;color:var(--muted);margin-left:5px">${esc(m.nave)}</span>` : ''}</div>`;
    body.appendChild(tr);
  });
}

function clearMovFecha() {
  const inp = document.getElementById('mov-fecha-inp');
  if (inp) inp.value = '';
  renderMov();
}

// ════════════════════════════════════════════════
// BORRAR MOVIMIENTOS
// ════════════════════════════════════════════════
let _delMovsSelected = null;  // 'semana' | 'mes' | 'todo'

function openDeleteMovsModal() {
  if (!canAccess('borrarMovimientos')) {
    showToast({ type:'danger', title:'Sin permiso', msg:'No tenés permiso para borrar movimientos.' }); return;
  }
  _delMovsSelected = null;
  const confirmBtn = DOM.get('del-movs-confirm-btn');
  if (confirmBtn) confirmBtn.classList.remove('on');
  renderDeleteMovsOpts();
  DOM.get('del-movs-overlay').classList.add('on');
}

function closeDeleteMovsModal() {
  DOM.get('del-movs-overlay').classList.remove('on');
  _delMovsSelected = null;
}

function renderDeleteMovsOpts() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const semanaAtras = new Date(hoy); semanaAtras.setDate(hoy.getDate() - 7);
  const mesAtras    = new Date(hoy); mesAtras.setMonth(hoy.getMonth() - 1);

  function countOlderThan(fecha) {
    return movs.filter(m => {
      if (!m.fecha) return false;
      const mFecha = new Date(m.fecha + 'T00:00:00');
      return mFecha < fecha;
    }).length;
  }

  const cSemana = countOlderThan(semanaAtras);
  const cMes    = countOlderThan(mesAtras);
  const cTodo   = movs.length;

  const opts = [
    { key:'semana', lbl:'Más de 1 semana', sub:'Borra registros con más de 7 días de antigüedad', count: cSemana },
    { key:'mes',    lbl:'Más de 1 mes',    sub:'Borra registros con más de 30 días de antigüedad', count: cMes    },
    { key:'todo',   lbl:'Todos los movimientos', sub:'Limpia completamente el historial de movimientos', count: cTodo   },
  ];

  const container = document.getElementById('del-movs-opts');
  container.innerHTML = opts.map(o => `
    <div class="del-movs-opt${_delMovsSelected===o.key?' selected-opt':''}" id="dmo-${o.key}" onclick="selectDelMovsOpt('${o.key}')">
      <div class="del-movs-opt-info">
        <div class="del-movs-opt-lbl">${o.lbl}</div>
        <div class="del-movs-opt-sub">${o.sub}</div>
      </div>
      <div class="del-movs-opt-count">${o.count} reg.</div>
    </div>`).join('');
}

function selectDelMovsOpt(key) {
  _delMovsSelected = key;
  document.querySelectorAll('.del-movs-opt').forEach(el => {
    el.style.borderColor = el.id === 'dmo-' + key ? 'var(--red)' : '';
    el.style.background  = el.id === 'dmo-' + key ? 'var(--red-dim)' : '';
  });
  const confirmBtn = DOM.get('del-movs-confirm-btn');
  if (confirmBtn) confirmBtn.classList.add('on');
}

function confirmDeleteMovs() {
  if (!_delMovsSelected) return;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let deleted = 0;

  if (_delMovsSelected === 'todo') {
    deleted = movs.length;
    movs = [];
  } else {
    const cutoff = new Date(hoy);
    if (_delMovsSelected === 'semana') cutoff.setDate(hoy.getDate() - 7);
    else if (_delMovsSelected === 'mes') cutoff.setMonth(hoy.getMonth() - 1);
    const antes = movs.length;
    movs = movs.filter(m => {
      if (!m.fecha) return true;
      const mFecha = new Date(m.fecha + 'T00:00:00');
      return mFecha >= cutoff;
    });
    deleted = antes - movs.length;
  }

  saveMovs();
  closeDeleteMovsModal();
  renderMov();

  const labels = { semana:'de la última semana', mes:'del último mes', todo:'en total' };
  showToast({
    type: deleted > 0 ? 'success' : 'info',
    title: deleted > 0 ? `${deleted} movimiento${deleted===1?'':'s'} eliminado${deleted===1?'':'s'}` : 'Sin movimientos para borrar',
    msg: deleted > 0 ? `Se liberó espacio borrando registros ${labels[_delMovsSelected]}.` : 'No había registros que cumplieran el criterio seleccionado.'
  });
}

// ════════════════════════════════════════════════
// TOASTS
// ════════════════════════════════════════════════
const ICONS = {
  warn:    '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  danger:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  info:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function showToast({ type='info', title, msg, action, actionLabel='Ver', duration=6000 }) {
  const stack = DOM.get('toast-stack');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <div class="toast-icon">${ICONS[type]||ICONS.info}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      ${action ? `<button class="toast-action" id="ta-${Date.now()}">${actionLabel} →</button>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>`;
  if (action) {
    setTimeout(() => {
      const btn = t.querySelector('.toast-action');
      if (btn) btn.onclick = () => { action(); t.remove(); };
    }, 0);
  }
  stack.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  if (duration > 0) setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
  return t;
}

// ════════════════════════════════════════════════
// PETICIONES
// ════════════════════════════════════════════════
