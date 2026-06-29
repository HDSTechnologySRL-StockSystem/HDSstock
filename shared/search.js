// ═══════════════════════════════════════════════════════
// src/shared/search.js
// Modal de búsqueda global (Ctrl+K): abre, cierra,
// busca en CELLS de ambas naves, navegación con teclado.
// Depende de: CELLS (stock/stockData.js), go(), selectRep()
// ═══════════════════════════════════════════════════════
'use strict';

let searchFocusIdx = -1;

function openSearch() {
  DOM.get('search-modal').classList.add('on');
  const inp = DOM.get('search-input');
  inp.value = '';
  searchFocusIdx = -1;
  DOM.get('search-results').innerHTML = '<div class="search-empty" id="search-empty" style="display:none">Sin resultados</div>';
  setTimeout(() => inp.focus(), 80);
}

function closeSearch() {
  DOM.get('search-modal').classList.remove('on');
  searchFocusIdx = -1;
}

function doSearch(query) {
  const q = query.trim().toUpperCase();
  const container = DOM.get('search-results');
  searchFocusIdx = -1;

  if (!q || q.length < 1) {
    container.innerHTML = '<div class="search-empty">Escribí para buscar en Nave 1 y Nave 2</div>';
    return;
  }

  const results = [];
  const naves = [{key:'n1',label:'N-1'},{key:'n2',label:'N-2'}];

  naves.forEach(({key, label}) => {
    const naveData = CELLS[key];
    Object.keys(naveData).forEach(armId => {
      const arm = naveData[armId];
      Object.keys(arm.repisas).forEach(repId => {
        const rep = arm.repisas[repId];
        rep.items.forEach(item => {
          const haystack = (item.n + ' ' + item.s + ' ' + rep.cat + ' ' + armId + ' ' + repId).toUpperCase();
          if (haystack.includes(q)) {
            results.push({ nave: key, naveLabel: label, armId, repId, cat: rep.cat, item });
          }
        });
        if ((armId.toUpperCase().includes(q) || repId.toUpperCase().includes(q)) && rep.items.length > 0) {
          rep.items.forEach(item => {
            const already = results.find(r => r.nave===key && r.armId===armId && r.repId===repId && r.item===item);
            if (!already) results.push({ nave: key, naveLabel: label, armId, repId, cat: rep.cat, item });
          });
        }
      });
    });
  });

  // Deduplicate
  const seen = new Set();
  const unique = results.filter(r => {
    const k = r.nave + r.armId + r.repId + r.item.n;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  container.innerHTML = '';

  if (!unique.length) {
    container.innerHTML = `<div class="search-empty">Sin resultados para "<b style="color:var(--text)">${esc(query.trim())}</b>"</div>`;
    return;
  }

  unique.slice(0, 40).forEach((r, i) => {
    // esc() primero (seguridad), el resaltado <mark> se aplica después sobre texto ya escapado
    const safeName = esc(r.item.n);
    const re = new RegExp('(' + escapeReg(esc(q)) + ')', 'gi');
    const highlighted = safeName.replace(re, '<mark>$1</mark>');
    const catTxt = r.cat && r.cat !== '—' ? `${esc(r.cat)} · ` : '';

    const div = document.createElement('div');
    div.className = 'search-result';
    div.dataset.idx = i;
    div.innerHTML = `
      <div class="sr-loc">
        <span class="sr-nave">${esc(r.naveLabel)}</span>
        <span class="sr-arm">${esc(r.armId)}</span>
        <span class="sr-rep">${esc(r.repId)}</span>
      </div>
      <div class="sr-divider"></div>
      <div class="sr-info">
        <div class="sr-name">${highlighted}</div>
        <div class="sr-meta">${catTxt}${esc(r.item.s)}</div>
      </div>
      <div class="sr-qty">${esc(r.item.q)}<span style="font-size:12px;font-weight:400;opacity:.6"> ${esc(r.item.u)}</span></div>`;
    div.onclick = () => selectSearchResult(r);
    container.appendChild(div);
  });

  if (unique.length > 40) {
    const more = document.createElement('div');
    more.className = 'search-empty';
    more.style.padding = '12px 22px';
    more.textContent = `+${unique.length - 40} resultados más — refiná la búsqueda`;
    container.appendChild(more);
  }
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

function selectSearchResult(r) {
  closeSearch();
  const naveScreen = r.nave === 'n1' ? 'n1' : 'n2';
  go(naveScreen);
  setTimeout(() => {
    const cell = document.querySelector(`.cell[data-id="${cssEsc(r.armId)}"][data-nave="${r.nave}"]`);
    if (cell) {
      document.querySelectorAll('.cell.found').forEach(c => c.classList.remove('found'));
      cell.classList.add('found');
      setTimeout(() => cell.classList.remove('found'), 3200);
    }
    openShelfWindow(r.nave, r.armId);   // abrir la ventana flotante del estante encontrado
  }, 140);
}

function searchKeyNav(e) {
  const items = document.querySelectorAll('.search-result');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchFocusIdx = Math.min(searchFocusIdx + 1, items.length - 1);
    updateSearchFocus(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchFocusIdx = Math.max(searchFocusIdx - 1, 0);
    updateSearchFocus(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (searchFocusIdx >= 0 && items[searchFocusIdx]) items[searchFocusIdx].click();
  } else if (e.key === 'Escape') {
    closeSearch();
  }
}

function updateSearchFocus(items) {
  items.forEach((el, i) => el.classList.toggle('focused', i === searchFocusIdx));
  if (searchFocusIdx >= 0) items[searchFocusIdx]?.scrollIntoView({block:'nearest'});
}

// Ctrl+K shortcut
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (currentUser) openSearch();
  }
  if (e.key === 'Escape' && DOM.get('search-modal').classList.contains('on')) {
    closeSearch();
  }
});

// ════════════════════════════════════════════════
// GESTIÓN DE PLANO — NUEVA ESTANTERÍA, MOVER, BORRAR
// ════════════════════════════════════════════════
