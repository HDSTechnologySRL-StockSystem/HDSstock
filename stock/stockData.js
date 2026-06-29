// ═══════════════════════════════════════════════════════
// src/stock/stockData.js
// Datos de inventario (CELLS), popup del mapa,
// acciones de celda: cellClick, closePopup, flipIfNeeded.
// Depende de: constants.js, storage.js, auth.js
// ═══════════════════════════════════════════════════════
'use strict';

const CELLS = {
  n1: {
    A: { repisas: {
      A1: { cat:'TORNILLERÍA', items:[] },
      A2: { cat:'RODAMIENTOS', items:[] },
      A3: { cat:'HERRAMIENTAS', items:[] },
      A4: { cat:'ADHESIVOS', items:[] }
    }},
    B:{repisas:{B1:{cat:'—',items:[]},B2:{cat:'—',items:[]},B3:{cat:'—',items:[]}}},
    C:{repisas:{C1:{cat:'—',items:[]},C2:{cat:'—',items:[]}}},
    D:{repisas:{D1:{cat:'—',items:[]},D2:{cat:'—',items:[]}}},
    E:{repisas:{E1:{cat:'—',items:[]},E2:{cat:'—',items:[]}}},
    F:{repisas:{F1:{cat:'—',items:[]},F2:{cat:'—',items:[]}}},
    G:{repisas:{G1:{cat:'—',items:[]},G2:{cat:'—',items:[]}}},
    H:{repisas:{H1:{cat:'—',items:[]},H2:{cat:'—',items:[]}}},
    I:{repisas:{I1:{cat:'—',items:[]},I2:{cat:'—',items:[]}}},
    J:{repisas:{J1:{cat:'—',items:[]},J2:{cat:'—',items:[]},J3:{cat:'—',items:[]}}},
    K:{repisas:{K1:{cat:'—',items:[]},K2:{cat:'—',items:[]}}},
    M:{repisas:{M1:{cat:'—',items:[]},M2:{cat:'—',items:[]}}},
    N:{repisas:{N1:{cat:'—',items:[]},N2:{cat:'—',items:[]}}},
    'Ñ':{repisas:{'Ñ1':{cat:'—',items:[]},'Ñ2':{cat:'—',items:[]}}},
    O:{repisas:{O1:{cat:'—',items:[]},O2:{cat:'—',items:[]}}},
    P:{repisas:{P1:{cat:'—',items:[]},P2:{cat:'—',items:[]}}},
    Q:{repisas:{Q1:{cat:'—',items:[]},Q2:{cat:'—',items:[]}}},
    R:{repisas:{R1:{cat:'—',items:[]},R2:{cat:'—',items:[]}}},
    S:{repisas:{S1:{cat:'—',items:[]},S2:{cat:'—',items:[]}}},
    T:{repisas:{T1:{cat:'—',items:[]},T2:{cat:'—',items:[]}}},
    U:{repisas:{U1:{cat:'—',items:[]},U2:{cat:'—',items:[]}}},
    V:{repisas:{V1:{cat:'—',items:[]},V2:{cat:'—',items:[]}}},
    X1:{repisas:{X1a:{cat:'—',items:[]},X1b:{cat:'—',items:[]}}},
    X2:{repisas:{X2a:{cat:'—',items:[]},X2b:{cat:'—',items:[]}}},
    X3:{repisas:{X3a:{cat:'—',items:[]},X3b:{cat:'—',items:[]}}},
    X4:{repisas:{X4a:{cat:'—',items:[]},X4b:{cat:'—',items:[]}}},
  },
  n2: {
    A: { repisas: {
      A1: { cat:'TORNILLERÍA', items:[] },
      A2: { cat:'RODAMIENTOS', items:[] },
      A3: { cat:'HERRAMIENTAS', items:[] },
      A4: { cat:'ADHESIVOS', items:[] }
    }},
    B:{repisas:{B1:{cat:'—',items:[]},B2:{cat:'—',items:[]}}},
    C:{repisas:{C1:{cat:'—',items:[]},C2:{cat:'—',items:[]}}},
    D:{repisas:{D1:{cat:'—',items:[]},D2:{cat:'—',items:[]}}},
    E:{repisas:{E1:{cat:'—',items:[]},E2:{cat:'—',items:[]}}},
    F:{repisas:{F1:{cat:'—',items:[]},F2:{cat:'—',items:[]}}},
    G:{repisas:{G1:{cat:'—',items:[]},G2:{cat:'—',items:[]}}},
    H:{repisas:{H1:{cat:'—',items:[]},H2:{cat:'—',items:[]},H3:{cat:'—',items:[]}}},
    I:{repisas:{I1:{cat:'—',items:[]},I2:{cat:'—',items:[]}}},
    J:{repisas:{J1:{cat:'—',items:[]},J2:{cat:'—',items:[]}}},
    K:{repisas:{K1:{cat:'—',items:[]},K2:{cat:'—',items:[]}}},
    M:{repisas:{M1:{cat:'—',items:[]},M2:{cat:'—',items:[]}}},
    N:{repisas:{N1:{cat:'—',items:[]},N2:{cat:'—',items:[]}}},
    'Ñ':{repisas:{'Ñ1':{cat:'—',items:[]},'Ñ2':{cat:'—',items:[]}}},
    O:{repisas:{O1:{cat:'—',items:[]},O2:{cat:'—',items:[]}}},
  }
};
const UNKNOWN = new Set([]);

// ════════════════════════════════════════════════
// POPUP STATE
// ════════════════════════════════════════════════
let POP = null; // { el, cellId, nave, activeRid, activeForm }

function cellClick(svgG) {
  // No abrir la ventana de stock si el estante está en modo mover/arrastre
  if (_shelfMoveState && _shelfMoveState.cellId === svgG.dataset.id) return;
  if (!canAccess('verStock')) { showToast({type:'danger',title:'Sin permiso',msg:'No tenés permiso para ver el stock de estantes.'}); return; }
  const id   = svgG.dataset.id;
  const nave = svgG.dataset.nave;
  const hintEl = document.getElementById('hint-' + nave);
  if (hintEl) hintEl.textContent = 'Armario ' + id;
  if (UNKNOWN.has(id)) {
    showToast({ type:'info', title:'Armario sin nombre', msg:'Asigná un nombre a este armario antes de usarlo.' });
    return;
  }
  openShelfWindow(nave, id, svgG);
}

function mkConn() {
  const c = document.createElement('div'); c.className = 'conn';
function closePopup() {
  if (!POP) return;
  cancelAllModes();
  // Deselect cell
  const cg = document.querySelector(
    `.cell[data-id="${POP.cellId}"][data-nave="${POP.nave}"]`
  );
  if (cg) cg.classList.remove('sel');
  // Reset hint
  const hint = document.getElementById('hint-' + POP.nave);
  if (hint) hint.textContent = 'Seleccioná un armario';
  // Remove float form from body
  if (POP.ff) POP.ff.remove();
  // Remove popup
  POP.el.remove();
  POP = null;
}

function layerClick(e) {
  if (e.target === document.getElementById('pop-layer')) closePopup();
}

// ── FLIP POPUP if off-screen ──────────────────────────────────────────────────
function flipIfNeeded(popup, anchorBB) {
  const pr = popup.getBoundingClientRect();
  if (pr.right > window.innerWidth - 8) {
    popup.style.left  = '';
    popup.style.right = (window.innerWidth - anchorBB.left + 4) + 'px';
    popup.style.flexDirection = 'row-reverse';
  }
  if (pr.bottom > window.innerHeight - 60) {
    popup.style.top       = '';
    popup.style.bottom    = '65px';
    popup.style.transform = 'none';
  }
  if (pr.top < 52) {
    popup.style.top       = '52px';
    popup.style.transform = 'none';
  }
}

// ════════════════════════════════════════════════
// MOVIMIENTOS
function saveCells() { try { localStorage.setItem('hds_cells', JSON.stringify(CELLS)); } catch {} }
// Copia datos de ejemplo a N-2 una sola vez (solo si el armario A de N-2 está vacío).
function loadCellsInto() {
  try {
    const saved = JSON.parse(localStorage.getItem('hds_cells') || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(CELLS).forEach(k => delete CELLS[k]);
      Object.assign(CELLS, saved);
    }
  } catch {}
}
function saveMovs() { try { localStorage.setItem('hds_movs', JSON.stringify(movs)); } catch {} }
function _migrateWipeExampleItems() {
  try {
    if (localStorage.getItem('hds_mig_291')) return;
    let dirty = false;
    ['n1','n2'].forEach(function(nave) {
      Object.values(CELLS[nave] || {}).forEach(function(arm) {
        Object.values((arm && arm.repisas) || {}).forEach(function(rep) {
          if (!rep || !rep.items) return;
          const before = rep.items.length;
          rep.items = rep.items.filter(function(it) {
            return !_EXAMPLE_ITEM_NAMES.has((it.n || '').toUpperCase().trim());
          });
          if (rep.items.length !== before) dirty = true;
        });
      });
    });
    if (dirty) saveCells();
    localStorage.setItem('hds_mig_291', '1');
  } catch(e) { console.warn('[HDS] migración 291 falló', e); }
}

// Aplica nombres personalizados a TODOS los estantes del SVG al cargar
function _applyAllShelfNames() {
  const n = loadShelfNames();
  ['n1','n2'].forEach(function(nave) {
    if (!n[nave]) return;
    Object.keys(n[nave]).forEach(function(id) {
      applyShelfName(nave, id);
    });
  });
}

function bootstrap() {
  // 0) Crear cuenta Admin por defecto si no existe ningún usuario todavía
  _seedAdminIfNeeded();
