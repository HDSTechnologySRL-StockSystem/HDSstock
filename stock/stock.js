// ═══════════════════════════════════════════════════════
// src/stock/stock.js
// Vista "Stock General": búsqueda, filtro por categoría,
// listado unificado de todos los productos de ambas naves.
// Depende de: CELLS, constants.js, storage.js, utils.js
// ═══════════════════════════════════════════════════════
'use strict';

let _stkState = { q:'', cat:'__all__', showFilter:false };

// Recorre todas las naves/armarios/repisas y devuelve un array plano de items
function stockAllItems(){
  const out = [];
  ['n1','n2'].forEach(function(nave){
    Object.entries(CELLS[nave] || {}).forEach(function(entry){
      const armId = entry[0], arm = entry[1];
      Object.entries((arm && arm.repisas) || {}).forEach(function(rEntry){
        const repId = rEntry[0], rep = rEntry[1];
        const cat = ((rep && rep.cat) || '—').toString();
        ((rep && rep.items) || []).forEach(function(it){
          out.push({
            nave: nave, arm: armId, rep: repId, cat: cat,
            n: it.n || '—', q: +it.q || 0, u: it.u || 'UN', s: it.s || '—',
            precio: (it.precio != null ? +it.precio : null)
          });
        });
      });
    });
  });
  return out;
}

function stockSearch(v){
  _stkState.q = (v || '').trim().toLowerCase();
  const c = document.getElementById('stk-clear');
  if (c) c.style.display = _stkState.q ? '' : 'none';
  renderStockList();
}
function stockClearSearch(){
  const i = document.getElementById('stk-q');
  if (i) i.value = '';
  stockSearch('');
}
function stockToggleFilter(){
  _stkState.showFilter = !_stkState.showFilter;
  const ch = document.getElementById('stk-chips');
  const btn = document.getElementById('stk-filter-btn');
  if (ch)  ch.style.display = _stkState.showFilter ? 'flex' : 'none';
  if (btn) btn.classList.toggle('on', _stkState.showFilter);
}
function stockSetCat(cat){ _stkState.cat = cat; renderStock(); }

function renderStock(){
  // Marca "Stock" como activo en la isla de esta pantalla
  const sc = document.getElementById('sc-stock');
  if (sc){
    const sb = sc.querySelector('.nb-stock');
    if (sb){
      sc.querySelectorAll('.bottomnav .nb, .bottomnav .nb-wrap').forEach(function(b){ b.classList.remove('on'); });
      sb.classList.add('on');
    }
  }
  // Chips de categorías (a partir de las categorías reales presentes)
  const items = stockAllItems();
  const cats = Array.from(new Set(items.map(function(i){ return i.cat; }).filter(function(c){ return c && c !== '—'; })))
                    .sort(function(a,b){ return a.localeCompare(b,'es'); });
  const chipsEl = document.getElementById('stk-chips');
  if (chipsEl){
    const mk = function(val,label){
      const safe = String(val).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<button class="stk-chip'+(_stkState.cat===val?' on':'')+'" onclick="stockSetCat(\''+safe+'\')">'+esc(label)+'</button>';
    };
    chipsEl.innerHTML = mk('__all__','Todas')
      + cats.map(function(c){ return mk(c,c); }).join('')
      + (items.some(function(i){ return i.cat==='—'; }) ? mk('—','Sin categoría') : '');
    chipsEl.style.display = _stkState.showFilter ? 'flex' : 'none';
  }
  // Indicador "filtro activo" en el botón
  const fc = document.getElementById('stk-filter-count');
  if (fc) fc.style.display = (_stkState.cat !== '__all__') ? '' : 'none';
  renderStockList(items);
}

function renderStockList(items){
  items = items || stockAllItems();
  const q = _stkState.q, cat = _stkState.cat;
  let rows = items.filter(function(it){
    if (cat !== '__all__' && it.cat !== cat) return false;
    if (q){
      const hay = (it.n + ' ' + it.s + ' ' + it.cat).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  rows.sort(function(a,b){ return a.n.localeCompare(b.n,'es') || a.nave.localeCompare(b.nave); });

  const fmtMoney = function(n){ return '$ ' + Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  const totU = rows.reduce(function(s,r){ return s + r.q; }, 0);
  const totV = rows.reduce(function(s,r){ return s + (r.precio!=null ? r.precio*r.q : 0); }, 0);

  const sum = document.getElementById('stk-summary');
  if (sum){
    sum.innerHTML = '<span><b>'+rows.length+'</b> productos</span>'
      + '<span><b>'+totU.toLocaleString('es-AR')+'</b> unidades</span>'
      + (totV>0 ? '<span><b>'+fmtMoney(totV)+'</b> en stock</span>' : '');
  }

  const list = document.getElementById('stk-list');
  if (!list) return;
  if (!rows.length){
    list.innerHTML = '<div class="stk-empty">No se encontraron productos con esos criterios.<br>Probá limpiar la búsqueda o el filtro.</div>';
    return;
  }
  list.innerHTML = rows.map(function(it){
    const naveLbl = it.nave==='n1' ? 'N-1' : 'N-2';
    return '<div class="stk-card">'
      + '<div class="stk-card-main">'
      +   '<div class="stk-name">'+esc(it.n)+'</div>'
      +   '<div class="stk-meta">'
      +     '<span class="stk-nave-badge '+it.nave+'">'+naveLbl+'</span>'
      +     '<span class="stk-loc">📍 Arm. '+esc(it.arm)+' · Rep. '+esc(it.rep)+'</span>'
      +     (it.s && it.s!=='—' ? '<span>'+esc(it.s)+'</span>' : '')
      +   '</div>'
      +   '<span class="stk-cat">'+esc(it.cat)+'</span>'
      + '</div>'
      + '<div class="stk-right">'
      +   '<div class="stk-qty">'+it.q.toLocaleString('es-AR')+' <small>'+esc(it.u)+'</small></div>'
      +   (it.precio!=null ? '<div class="stk-price">'+fmtMoney(it.precio*it.q)+'</div>' : '')
      + '</div>'
      + '</div>';
  }).join('');
}

// Inyecta el botón "Stock" en todas las islas de navegación (fuente única)
function injectStockNav(){
  const ICON = '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>Stock';
  document.querySelectorAll('.bottomnav').forEach(function(nav){
    if (nav.querySelector('.nb-stock')) return;
    const b = document.createElement('button');
    b.className = 'nb nb-stock';
    b.setAttribute('onclick', "go('stock')");
    b.innerHTML = ICON;
    nav.insertBefore(b, nav.children[1] || null);  // 2º lugar, tras "Inicio"
  });
}

// ── Categorías en NUEVO PRODUCTO (sugerencias + sincronía con la repisa) ──────
